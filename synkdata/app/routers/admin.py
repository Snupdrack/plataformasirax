"""
Router administrativo — gestión de usuarios y solicitudes de acceso.

Endpoints disponibles (todos requieren rol ``ADMIN``):
- ``GET /admin/stats`` — Estadísticas globales del dashboard.
- ``GET /admin/access-requests`` — Lista de solicitudes de acceso.
- ``GET /admin/access-requests/{id}`` — Detalle de una solicitud.
- ``PATCH /admin/access-requests/{id}`` — Revisar (aprobar/rechazar) solicitud.
- ``POST /admin/users`` — Crear nuevo usuario.
- ``GET /admin/users`` — Listar todos los usuarios.
- ``GET /admin/users/{id}`` — Detalle de un usuario con su historial.
- ``PATCH /admin/users/{id}`` — Actualizar un usuario.
- ``DELETE /admin/users/{id}`` — Desactivar un usuario (soft delete).
- ``GET /admin/activity`` — Feed de actividad reciente.
- ``GET /admin/users/export`` — Exporta el listado de usuarios (CSV).

Todos los endpoints requieren autenticación y el rol ``ADMIN`` mediante
la dependencia ``require_role("ADMIN")``.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import db_session, redis_client
from app.middleware.auth import require_role
from app.models.user import UserRole
from app.schemas.user import (
    AccessRequestResponse,
    AccessRequestSummary,
    AdminCreateUserRequest,
    AdminReviewRequest,
    UpdateUserRequest,
    UserResponse,
)
from app.services.admin_service import (
    AdminService,
    AdminStats,
    UserDetail,
)
from app.services.auth_service import (
    AccessRequestAlreadyReviewedError,
    AccessRequestNotFoundError,
    AuthService,
    AuthError,
    EmailAlreadyExistsError,
    UserNotFoundError,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    dependencies=[Depends(require_role(UserRole.ADMIN.value))],
)


# ---------------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------------
async def get_auth_service(
    db: AsyncSession = Depends(db_session),
    redis: Redis = Depends(redis_client),
) -> AuthService:
    """Proveedor del servicio de autenticación."""
    return AuthService(db=db, redis=redis)


async def get_admin_service(
    db: AsyncSession = Depends(db_session),
    redis: Redis = Depends(redis_client),
) -> AdminService:
    """Proveedor del servicio administrativo."""
    return AdminService(db=db, redis=redis)


# ---------------------------------------------------------------------------
# Estadísticas y actividad
# ---------------------------------------------------------------------------
@router.get(
    "/stats",
    response_model=AdminStats,
    summary="Estadísticas del dashboard administrativo",
    description=(
        "Retorna métricas agregadas: total de usuarios, clientes, "
        "administradores, solicitudes pendientes/aprobadas/rechazadas, "
        "verificaciones de hoy, usuarios activos y nuevos usuarios en 30 días."
    ),
)
async def get_admin_stats(
    admin_service: AdminService = Depends(get_admin_service),
) -> AdminStats:
    """
    Obtiene las estadísticas globales del dashboard de administración.

    Args:
        admin_service: Servicio administrativo inyectado.

    Returns:
        AdminStats: Métricas agregadas.
    """
    try:
        return await admin_service.get_admin_stats()
    except Exception as exc:
        logger.exception("Error al obtener estadísticas admin: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al obtener las estadísticas.",
        ) from exc


@router.get(
    "/activity",
    summary="Feed de actividad reciente",
    description=(
        "Retorna los eventos recientes: registros de usuario, solicitudes "
        "de acceso y verificaciones. Ordenados por fecha descendente."
    ),
)
async def get_recent_activity(
    limit: int = Query(
        default=20, ge=1, le=100, description="Número máximo de elementos."
    ),
    admin_service: AdminService = Depends(get_admin_service),
) -> list:
    """
    Obtiene el feed de actividad reciente.

    Args:
        limit: Número máximo de elementos a retornar.
        admin_service: Servicio administrativo inyectado.

    Returns:
        list: Lista de elementos de actividad.
    """
    try:
        items = await admin_service.get_recent_activity(limit=limit)
        return [item.model_dump(mode="json") for item in items]
    except Exception as exc:
        logger.exception("Error al obtener actividad reciente: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al obtener la actividad.",
        ) from exc


# ---------------------------------------------------------------------------
# Gestión de solicitudes de acceso
# ---------------------------------------------------------------------------
@router.get(
    "/access-requests",
    response_model=list[AccessRequestSummary],
    summary="Listar solicitudes de acceso",
    description=(
        "Lista las solicitudes de acceso recibidas, opcionalmente filtradas "
        "por estado (PENDING/APPROVED/REJECTED)."
    ),
)
async def list_access_requests(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filtrar por estado: PENDING, APPROVED o REJECTED.",
    ),
    skip: int = Query(default=0, ge=0, description="Offset de paginación."),
    limit: int = Query(
        default=50, ge=1, le=200, description="Límite de paginación."
    ),
    auth_service: AuthService = Depends(get_auth_service),
) -> list[AccessRequestSummary]:
    """
    Lista las solicitudes de acceso, opcionalmente filtradas por estado.

    Args:
        status_filter: Filtrar por estado (PENDING/APPROVED/REJECTED).
        skip: Paginación (offset).
        limit: Paginación (límite).
        auth_service: Servicio de autenticación inyectado.

    Returns:
        list[AccessRequestSummary]: Lista de resúmenes de solicitudes.
    """
    try:
        requests = await auth_service.get_access_requests(
            status=status_filter, skip=skip, limit=limit
        )
        return [AccessRequestSummary.model_validate(r) for r in requests]
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al listar solicitudes de acceso: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al listar las solicitudes.",
        ) from exc


@router.get(
    "/access-requests/{request_id}",
    response_model=AccessRequestResponse,
    summary="Obtener detalle de una solicitud de acceso",
)
async def get_access_request(
    request_id: UUID,
    auth_service: AuthService = Depends(get_auth_service),
) -> AccessRequestResponse:
    """
    Obtiene el detalle de una solicitud de acceso por su ID.

    Args:
        request_id: ID de la solicitud.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        AccessRequestResponse: Detalle de la solicitud.

    Raises:
        HTTPException 404: Si la solicitud no existe.
    """
    try:
        req = await auth_service.get_access_request(request_id)
        return AccessRequestResponse.model_validate(req)
    except AccessRequestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al obtener solicitud de acceso: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al obtener la solicitud.",
        ) from exc


@router.patch(
    "/access-requests/{request_id}",
    response_model=AccessRequestResponse,
    summary="Revisar (aprobar/rechazar) una solicitud de acceso",
    description=(
        "Permite a un administrador aprobar o rechazar una solicitud de "
        "acceso. Si se rechaza, debe proporcionarse ``rejection_reason``."
    ),
)
async def review_access_request(
    request_id: UUID,
    review: AdminReviewRequest,
    current_user: dict = Depends(require_role(UserRole.ADMIN.value)),
    auth_service: AuthService = Depends(get_auth_service),
) -> AccessRequestResponse:
    """
    Revisa (aprueba o rechaza) una solicitud de acceso.

    Args:
        request_id: ID de la solicitud a revisar.
        review: Datos de la revisión (estado, motivo, notas).
        current_user: Payload del JWT del administrador.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        AccessRequestResponse: Solicitud actualizada.

    Raises:
        HTTPException 404: Si la solicitud no existe.
        HTTPException 409: Si la solicitud ya fue revisada.
        HTTPException 400: Si los datos son inválidos.
    """
    try:
        admin_id = UUID(str(current_user["sub"]))
        updated = await auth_service.review_access_request(
            request_id=request_id, admin_id=admin_id, review=review
        )
        return AccessRequestResponse.model_validate(updated)
    except AccessRequestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except AccessRequestAlreadyReviewedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al revisar solicitud de acceso: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al revisar la solicitud.",
        ) from exc


# ---------------------------------------------------------------------------
# Gestión de usuarios
# ---------------------------------------------------------------------------
@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nuevo usuario",
    description=(
        "Crea una nueva cuenta de usuario. Solo los administradores pueden "
        "crear cuentas. Opcionalmente, vincula la cuenta a una solicitud de "
        "acceso existente mediante ``from_access_request_id``."
    ),
)
async def create_user(
    data: AdminCreateUserRequest,
    current_user: dict = Depends(require_role(UserRole.ADMIN.value)),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Crea un nuevo usuario (solo administradores).

    Args:
        data: Datos del nuevo usuario.
        current_user: Payload del JWT del administrador.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        UserResponse: Usuario recién creado.

    Raises:
        HTTPException 409: Si ya existe un usuario con ese email.
        HTTPException 400: Si los datos son inválidos.
    """
    try:
        admin_id = UUID(str(current_user["sub"]))
        user = await auth_service.create_user(data=data, admin_id=admin_id)
        return UserResponse.model_validate(user)
    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except AccessRequestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al crear usuario: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al crear el usuario.",
        ) from exc


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="Listar usuarios",
    description="Lista todos los usuarios, opcionalmente filtrados por rol.",
)
async def list_users(
    role: Optional[str] = Query(
        default=None,
        description="Filtrar por rol: ADMIN o CLIENT.",
    ),
    skip: int = Query(default=0, ge=0, description="Offset de paginación."),
    limit: int = Query(
        default=50, ge=1, le=200, description="Límite de paginación."
    ),
    auth_service: AuthService = Depends(get_auth_service),
) -> list[UserResponse]:
    """
    Lista los usuarios, opcionalmente filtrados por rol.

    Args:
        role: Filtrar por rol (ADMIN/CLIENT).
        skip: Paginación (offset).
        limit: Paginación (límite).
        auth_service: Servicio de autenticación inyectado.

    Returns:
        list[UserResponse]: Lista de usuarios.
    """
    try:
        users = await auth_service.list_users(
            role=role, skip=skip, limit=limit
        )
        return [UserResponse.model_validate(u) for u in users]
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al listar usuarios: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al listar los usuarios.",
        ) from exc


@router.get(
    "/users/export",
    summary="Exportar listado de usuarios (CSV)",
    description="Exporta el listado completo de usuarios en formato CSV.",
)
async def export_users(
    format: str = Query(default="csv", description="Formato de exportación."),
    admin_service: AdminService = Depends(get_admin_service),
) -> Response:
    """
    Exporta el listado de usuarios en el formato solicitado (CSV).

    Args:
        format: Formato de exportación. Actualmente solo 'csv'.
        admin_service: Servicio administrativo inyectado.

    Returns:
        Response: Archivo CSV con el listado de usuarios.
    """
    try:
        content = await admin_service.export_users(format=format)
        return Response(
            content=content,
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    'attachment; filename="synkdata_usuarios.csv"'
                )
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al exportar usuarios: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al exportar los usuarios.",
        ) from exc


@router.get(
    "/users/{user_id}",
    response_model=UserDetail,
    summary="Obtener detalle de un usuario",
    description=(
        "Obtiene el detalle completo de un usuario: información del perfil, "
        "verificaciones recientes y resumen agregado de riesgo."
    ),
)
async def get_user_detail(
    user_id: UUID,
    admin_service: AdminService = Depends(get_admin_service),
) -> UserDetail:
    """
    Obtiene el detalle completo de un usuario.

    Args:
        user_id: ID del usuario.
        admin_service: Servicio administrativo inyectado.

    Returns:
        UserDetail: Detalle del usuario con verificaciones y riesgo.

    Raises:
        HTTPException 404: Si el usuario no existe.
    """
    try:
        return await admin_service.get_user_detail(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al obtener detalle de usuario: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al obtener el detalle del usuario.",
        ) from exc


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Actualizar un usuario",
    description="Actualiza los datos de un usuario (nombre, empresa, teléfono, etc.).",
)
async def update_user(
    user_id: UUID,
    data: UpdateUserRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Actualiza los datos de un usuario.

    Args:
        user_id: ID del usuario a actualizar.
        data: Datos a actualizar.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        UserResponse: Usuario actualizado.

    Raises:
        HTTPException 404: Si el usuario no existe.
        HTTPException 400: Si los datos son inválidos.
    """
    try:
        updated = await auth_service.update_user(user_id, data)
        return UserResponse.model_validate(updated)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al actualizar usuario: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el usuario.",
        ) from exc


@router.delete(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Desactivar un usuario (soft delete)",
    description=(
        "Desactiva un usuario marcándolo como inactivo. No se elimina "
        "físicamente el registro para preservar la auditoría."
    ),
)
async def deactivate_user(
    user_id: UUID,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Desactiva un usuario (soft delete).

    Args:
        user_id: ID del usuario a desactivar.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        UserResponse: Usuario desactivado.

    Raises:
        HTTPException 404: Si el usuario no existe.
    """
    try:
        deactivated = await auth_service.deactivate_user(user_id)
        return UserResponse.model_validate(deactivated)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al desactivar usuario: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al desactivar el usuario.",
        ) from exc
