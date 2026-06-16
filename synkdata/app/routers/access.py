"""
Router de acceso público — landing page y solicitudes de acceso.

Endpoints disponibles (sin autenticación):
- ``GET /`` — Landing page HTML de la plataforma.
- ``POST /access/request`` — Envía una solicitud de acceso (JSON API).
- ``GET /access/status/{request_id}`` — Consulta el estado de una solicitud.
- ``GET /access/success`` — Página HTML de confirmación tras enviar la solicitud.

Estos endpoints son públicos: cualquier visitante puede enviar una
solicitud de acceso, pero solo un administrador puede aprobarla y
crear la cuenta de usuario correspondiente.
"""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import db_session, redis_client
from app.schemas.user import (
    AccessRequestCreate,
    AccessRequestResponse,
)
from app.services.auth_service import (
    AccessRequestNotFoundError,
    AuthService,
    EmailAlreadyExistsError,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Templates Jinja2
# ---------------------------------------------------------------------------
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))


# ---------------------------------------------------------------------------
# Dependencias para los servicios
# ---------------------------------------------------------------------------
async def get_auth_service(
    db: AsyncSession = Depends(db_session),
    redis: Redis = Depends(redis_client),
) -> AuthService:
    """
    Proveedor del servicio de autenticación por inyección de dependencias.

    Args:
        db: Sesión asíncrona de PostgreSQL.
        redis: Cliente Redis asíncrono.

    Returns:
        AuthService: Instancia del servicio configurada.
    """
    return AuthService(db=db, redis=redis)


# ---------------------------------------------------------------------------
# Endpoints públicos
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_class=HTMLResponse,
    summary="Landing page de SynkData",
    include_in_schema=False,
)
async def landing_page(request: Request) -> HTMLResponse:
    """
    Renderiza la landing page pública de la plataforma.

    Args:
        request: Objeto de petición de FastAPI.

    Returns:
        HTMLResponse: Página HTML de la landing page.
    """
    return templates.TemplateResponse(
        request,
        "landing.html",
        {"title": "SynkData — Inteligencia de Identidad"},
    )


@router.post(
    "/request",
    response_model=AccessRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar solicitud de acceso",
    description=(
        "Recibe una solicitud de acceso desde la landing page pública. "
        "Un administrador revisará la solicitud y, de aprobarla, creará la "
        "cuenta de usuario correspondiente."
    ),
    responses={
        201: {"description": "Solicitud creada exitosamente."},
        400: {"description": "Datos inválidos o solicitud duplicada."},
        500: {"description": "Error interno del servidor."},
    },
)
async def submit_access_request(
    data: AccessRequestCreate,
    auth_service: AuthService = Depends(get_auth_service),
) -> AccessRequestResponse:
    """
    Procesa el envío de una nueva solicitud de acceso desde la landing page.

    Args:
        data: Datos de la solicitud de acceso.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        AccessRequestResponse: La solicitud de acceso creada.

    Raises:
        HTTPException 400: Si ya existe una solicitud pendiente con el mismo email.
        HTTPException 500: Si ocurre un error interno.
    """
    try:
        access_request = await auth_service.register_access_request(data)
        return AccessRequestResponse.model_validate(access_request)
    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al crear solicitud de acceso: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al procesar la solicitud. Intente de nuevo más tarde.",
        ) from exc


@router.get(
    "/status/{request_id}",
    response_model=AccessRequestResponse,
    summary="Consultar estado de una solicitud de acceso",
    description=(
        "Permite al solicitante consultar el estado de su solicitud de "
        "acceso usando el ID retornado al enviarla."
    ),
    responses={
        200: {"description": "Estado de la solicitud."},
        400: {"description": "ID de solicitud inválido."},
        404: {"description": "Solicitud no encontrada."},
    },
)
async def get_request_status(
    request_id: UUID,
    auth_service: AuthService = Depends(get_auth_service),
) -> AccessRequestResponse:
    """
    Consulta el estado de una solicitud de acceso por su ID.

    Args:
        request_id: ID de la solicitud de acceso.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        AccessRequestResponse: La solicitud con su estado actual.

    Raises:
        HTTPException 404: Si no se encuentra la solicitud.
    """
    try:
        access_request = await auth_service.get_access_request(request_id)
        return AccessRequestResponse.model_validate(access_request)
    except AccessRequestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al consultar estado de solicitud: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al consultar la solicitud.",
        ) from exc


@router.get(
    "/success",
    response_class=HTMLResponse,
    summary="Página de confirmación tras enviar solicitud",
    include_in_schema=False,
)
async def success_page(request: Request) -> HTMLResponse:
    """
    Renderiza la página HTML de confirmación tras enviar una solicitud.

    Args:
        request: Objeto de petición de FastAPI.

    Returns:
        HTMLResponse: Página HTML de confirmación.
    """
    return templates.TemplateResponse(
        request,
        "success.html",
        {"title": "Solicitud recibida — SynkData"},
    )
