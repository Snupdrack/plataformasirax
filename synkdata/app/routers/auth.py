"""
Router de autenticación — login, logout, perfil y cambio de contraseña.

Endpoints disponibles:
- ``POST /auth/login`` — Inicia sesión y retorna un token JWT.
- ``GET /auth/me`` — Obtiene la información del usuario autenticado.
- ``POST /auth/refresh`` — Emite un nuevo token JWT (refresh).
- ``POST /auth/logout`` — Cierra sesión revocando el token en Redis.
- ``PATCH /auth/me`` — Actualiza el propio perfil.
- ``POST /auth/change-password`` — Cambia la contraseña del usuario actual.

Los endpoints protegidos usan la dependencia ``get_current_user`` de
``app.dependencies`` que valida el JWT y verifica que no esté revocado.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import db_session, get_current_user, redis_client
from app.middleware.auth import create_access_token
from app.models.user import User, UserRole
from app.schemas.user import (
    AuthStatus,
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.services.auth_service import (
    AccountInactiveError,
    AccountLockedError,
    AuthService,
    AuthError,
    InvalidCredentialsError,
    UserNotFoundError,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Esquema Bearer para extraer el token del header Authorization.
_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Dependencias
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


def _extract_token(request: Request) -> Optional[str]:
    """
    Extrae el token JWT del header ``Authorization: Bearer <token>``.

    Args:
        request: Objeto de petición de FastAPI.

    Returns:
        Optional[str]: El token JWT o None si no está presente.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
    description=(
        "Autentica al usuario con email y contraseña y retorna un token JWT "
        "junto con los datos del usuario. Tras 5 intentos fallidos, la "
        "cuenta se bloquea por 15 minutos."
    ),
    responses={
        200: {"description": "Token JWT y datos del usuario."},
        400: {"description": "Datos de entrada inválidos."},
        401: {"description": "Credenciales inválidas o cuenta bloqueada."},
        403: {"description": "La cuenta está inactiva."},
    },
)
async def login(
    data: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """
    Inicia sesión y emite un token JWT.

    Args:
        data: Credenciales de login (email + password).
        auth_service: Servicio de autenticación inyectado.

    Returns:
        TokenResponse: Token JWT y datos del usuario.

    Raises:
        HTTPException 401: Si las credenciales son inválidas o la cuenta está bloqueada.
        HTTPException 403: Si la cuenta está inactiva.
        HTTPException 500: Si ocurre un error interno.
    """
    try:
        token = await auth_service.login(
            email=data.email, password=data.password
        )
        return token
    except AccountLockedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"Retry-After": "900"},
        ) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except AccountInactiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error inesperado en login: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al iniciar sesión. Intente de nuevo más tarde.",
        ) from exc


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Obtener usuario actual",
    description="Retorna la información del usuario autenticado.",
    responses={
        200: {"description": "Información del usuario."},
        401: {"description": "Token inválido o ausente."},
        404: {"description": "Usuario no encontrado."},
    },
)
async def get_me(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Obtiene la información del usuario autenticado.

    Args:
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        UserResponse: Información del usuario autenticado.

    Raises:
        HTTPException 404: Si el usuario ya no existe en la base de datos.
    """
    try:
        user_id = UUID(str(current_user["sub"]))
        user = await auth_service.get_user(user_id)
        return UserResponse.model_validate(user)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al obtener usuario actual: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al obtener el usuario.",
        ) from exc


@router.get(
    "/status",
    response_model=AuthStatus,
    summary="Estado de autenticación",
    description=(
        "Retorna si el usuario actual está autenticado y, en caso afirmativo, "
        "su rol. Útil para el frontend al cargar la aplicación."
    ),
)
async def get_auth_status(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthStatus:
    """
    Retorna el estado de autenticación del usuario actual.

    Acepta opcionalmente un header ``Authorization: Bearer <token>``.

    Args:
        request: Objeto de petición de FastAPI.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        AuthStatus: Estado de autenticación.
    """
    token = _extract_token(request)
    if not token:
        return AuthStatus(is_authenticated=False)

    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
        )
    except JWTError:
        return AuthStatus(is_authenticated=False)

    user_id_str = payload.get("sub")
    if not user_id_str:
        return AuthStatus(is_authenticated=False)

    try:
        user = await auth_service.get_user(UUID(str(user_id_str)))
    except (UserNotFoundError, ValueError):
        return AuthStatus(is_authenticated=False)

    return AuthStatus(
        is_authenticated=True,
        user=UserResponse.model_validate(user),
        role=user.role,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refrescar token",
    description=(
        "Emite un nuevo token JWT para el usuario autenticado, extendiendo "
        "su sesión. El token anterior no se revoca automáticamente."
    ),
    responses={
        200: {"description": "Nuevo token JWT."},
        401: {"description": "Token inválido o ausente."},
    },
)
async def refresh_token(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """
    Emite un nuevo token JWT para el usuario autenticado.

    Args:
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        TokenResponse: Nuevo token JWT y datos del usuario.

    Raises:
        HTTPException 401: Si el usuario no existe o está inactivo.
    """
    try:
        user_id = UUID(str(current_user["sub"]))
        user = await auth_service.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        ) from exc

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta está inactiva.",
        )

    token = create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,
        }
    )

    return TokenResponse(
        access_token=token.access_token,
        token_type=token.token_type,
        expires_in=token.expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
    summary="Cerrar sesión",
    description="Revoca el token JWT actual agregándolo a la lista negra en Redis.",
    responses={
        200: {"description": "Sesión cerrada exitosamente."},
        401: {"description": "Token inválido o ausente."},
    },
)
async def logout(
    request: Request,
    current_user: dict = Depends(get_current_user),
    redis: Redis = Depends(redis_client),
) -> dict:
    """
    Cierra la sesión del usuario revocando el token JWT en Redis.

    Args:
        request: Objeto de petición de FastAPI.
        current_user: Payload del JWT decodificado.
        redis: Cliente Redis asíncrono.

    Returns:
        dict: Mensaje de confirmación.
    """
    token = _extract_token(request)
    if token:
        # TTL igual a la expiración configurada del token (30 min por defecto).
        settings = get_settings()
        ttl = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        await redis.set(f"token_revoked:{token}", "1", ex=ttl)

    logger.info(
        "Logout exitoso — user_id=%s", current_user.get("sub")
    )
    return {"message": "Sesión cerrada exitosamente."}


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Actualizar propio perfil",
    description=(
        "Actualiza los datos del propio perfil del usuario autenticado: "
        "nombre, empresa, teléfono, cargo y contraseña (opcional)."
    ),
    responses={
        200: {"description": "Perfil actualizado."},
        400: {"description": "Datos inválidos."},
        401: {"description": "Token inválido o ausente."},
    },
)
async def update_me(
    data: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Actualiza el perfil del usuario autenticado.

    Args:
        data: Datos a actualizar.
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        UserResponse: Usuario actualizado.

    Raises:
        HTTPException 400: Si los datos son inválidos.
        HTTPException 401: Si el usuario no está autenticado.
    """
    try:
        user_id = UUID(str(current_user["sub"]))
        updated_user = await auth_service.update_user(user_id, data)
        return UserResponse.model_validate(updated_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al actualizar perfil: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el perfil.",
        ) from exc


@router.post(
    "/change-password",
    response_model=UserResponse,
    summary="Cambiar contraseña",
    description=(
        "Cambia la contraseña del usuario autenticado tras verificar la "
        "contraseña actual."
    ),
    responses={
        200: {"description": "Contraseña actualizada."},
        400: {"description": "Datos inválidos."},
        401: {"description": "Contraseña actual incorrecta."},
    },
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Cambia la contraseña del usuario autenticado.

    Args:
        data: Contraseña actual y nueva contraseña.
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.

    Returns:
        UserResponse: Usuario actualizado.

    Raises:
        HTTPException 401: Si la contraseña actual es incorrecta.
        HTTPException 400: Si la nueva contraseña no cumple los requisitos.
    """
    try:
        user_id = UUID(str(current_user["sub"]))
        user = await auth_service.change_password(
            user_id=user_id,
            current_password=data.current_password,
            new_password=data.new_password,
        )
        return UserResponse.model_validate(user)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Error al cambiar contraseña: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al cambiar la contraseña.",
        ) from exc
