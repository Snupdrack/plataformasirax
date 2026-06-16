"""
Servicio de autenticación y gestión de usuarios para SynkData.

Este servicio encapsula toda la lógica de negocio relacionada con:

- Registro público de solicitudes de acceso (landing page).
- Inicio de sesión con JWT y bloqueo tras intentos fallidos (Redis).
- Creación de usuarios por parte del administrador.
- Revisión de solicitudes de acceso por parte del administrador.
- Consulta, actualización y desactivación de usuarios.

Utiliza:
- ``passlib`` con bcrypt para el hashing seguro de contraseñas.
- ``app.middleware.auth.create_access_token`` para emitir tokens JWT.
- Redis para rastrear intentos fallidos de login y tokens revocados.
- SQLAlchemy asíncrono para todas las operaciones de base de datos.

Todos los mensajes dirigidos al usuario están en español.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from passlib.context import CryptContext
from redis.asyncio import Redis
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import create_access_token
from app.models.user import (
    AccessRequest,
    AccessRequestStatus,
    User,
    UserRole,
)
from app.schemas.user import (
    AccessRequestCreate,
    AccessRequestResponse,
    AdminCreateUserRequest,
    AdminReviewRequest,
    LoginRequest,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constantes — bloqueo de cuenta por intentos fallidos
# ---------------------------------------------------------------------------
_MAX_FAILED_ATTEMPTS = 5
_LOCKOUT_TTL_SECONDS = 15 * 60  # 15 minutos
_FAILED_ATTEMPTS_TTL_SECONDS = 15 * 60


# ---------------------------------------------------------------------------
# Utilidades de hashing de contraseñas
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Genera un hash bcrypt de la contraseña proporcionada.

    Args:
        password: Contraseña en texto plano.

    Returns:
        str: Hash bcrypt de la contraseña.
    """
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifica que una contraseña en texto plano coincida con un hash bcrypt.

    Args:
        plain: Contraseña en texto plano.
        hashed: Hash bcrypt almacenado.

    Returns:
        bool: True si la contraseña coincide con el hash.
    """
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception as exc:
        logger.warning("Error verificando contraseña: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Excepciones de dominio
# ---------------------------------------------------------------------------
class AuthError(Exception):
    """Excepción base para errores de autenticación y usuarios."""


class InvalidCredentialsError(AuthError):
    """Credenciales inválidas (email o contraseña incorrectos)."""


class AccountLockedError(AuthError):
    """La cuenta está bloqueada por exceso de intentos fallidos."""


class AccountInactiveError(AuthError):
    """La cuenta del usuario está inactiva."""


class EmailAlreadyExistsError(AuthError):
    """Ya existe un usuario con ese correo electrónico."""


class UserNotFoundError(AuthError):
    """No se encontró el usuario solicitado."""


class AccessRequestNotFoundError(AuthError):
    """No se encontró la solicitud de acceso solicitada."""


class AccessRequestAlreadyReviewedError(AuthError):
    """La solicitud de acceso ya fue revisada."""


# ---------------------------------------------------------------------------
# Servicio de autenticación
# ---------------------------------------------------------------------------
class AuthService:
    """
    Servicio central de autenticación y gestión de usuarios.

    Encapsula toda la lógica de negocio para:
    - Solicitudes de acceso públicas.
    - Inicio de sesión (con bloqueo por intentos fallidos).
    - Creación de usuarios por administradores.
    - Revisión de solicitudes de acceso.
    - Consulta, actualización y desactivación de usuarios.

    Attributes:
        db: Sesión asíncrona de SQLAlchemy.
        redis: Cliente Redis asíncrono para rate-limiting y revocación.

    Example:
        >>> async with get_db_session() as session:
        ...     service = AuthService(db=session, redis=get_redis())
        ...     token = await service.login("admin@synkdata.io", "S3cret!")
    """

    def __init__(self, db: AsyncSession, redis: Redis) -> None:
        """
        Inicializa el servicio de autenticación.

        Args:
            db: Sesión asíncrona de SQLAlchemy.
            redis: Cliente Redis asíncrono.
        """
        self.db = db
        self.redis = redis

    # ------------------------------------------------------------------
    # Solicitudes de acceso públicas
    # ------------------------------------------------------------------
    async def register_access_request(
        self, data: AccessRequestCreate
    ) -> AccessRequest:
        """
        Registra una nueva solicitud de acceso desde la landing page.

        Args:
            data: Datos de la solicitud de acceso.

        Returns:
            AccessRequest: La solicitud de acceso creada.

        Raises:
            EmailAlreadyExistsError: Si ya existe una solicitud PENDING
                con el mismo correo electrónico.
        """
        logger.info(
            "Registrando nueva solicitud de acceso — email=%s, nombre=%s",
            data.email,
            data.full_name,
        )

        # Verificar si ya existe una solicitud pendiente con el mismo email.
        existing_stmt = select(AccessRequest).where(
            AccessRequest.email == data.email,
            AccessRequest.status == AccessRequestStatus.PENDING,
        )
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()
        if existing is not None:
            raise EmailAlreadyExistsError(
                "Ya existe una solicitud de acceso pendiente con ese correo "
                "electrónico. Espere a que un administrador la revise."
            )

        access_request = AccessRequest(
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            company=data.company,
            position=data.position,
            curp=data.curp,
            rfc=data.rfc,
            use_case=data.use_case,
            expected_volume=data.expected_volume,
            status=AccessRequestStatus.PENDING,
        )

        self.db.add(access_request)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise EmailAlreadyExistsError(
                "Error de integridad al crear la solicitud de acceso. "
                "Verifique los datos e intente de nuevo."
            ) from exc

        await self.db.refresh(access_request)
        logger.info(
            "Solicitud de acceso registrada — id=%s, email=%s",
            access_request.id,
            access_request.email,
        )
        return access_request

    async def get_access_request(
        self, request_id: UUID
    ) -> AccessRequest:
        """
        Obtiene una solicitud de acceso por su ID.

        Args:
            request_id: ID de la solicitud de acceso.

        Returns:
            AccessRequest: La solicitud de acceso encontrada.

        Raises:
            AccessRequestNotFoundError: Si no se encuentra la solicitud.
        """
        stmt = select(AccessRequest).where(AccessRequest.id == str(request_id))
        result = (await self.db.execute(stmt)).scalar_one_or_none()
        if result is None:
            raise AccessRequestNotFoundError(
                "No se encontró la solicitud de acceso especificada."
            )
        return result

    async def get_access_requests(
        self,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[AccessRequest]:
        """
        Obtiene la lista de solicitudes de acceso, opcionalmente filtradas por estado.

        Args:
            status: Filtrar por estado (PENDING/APPROVED/REJECTED). Opcional.
            skip: Número de registros a omitir (paginación).
            limit: Número máximo de registros a retornar.

        Returns:
            list[AccessRequest]: Lista de solicitudes de acceso.
        """
        stmt = select(AccessRequest).order_by(
            AccessRequest.created_at.desc()
        )

        if status is not None and status:
            try:
                status_enum = AccessRequestStatus(status.upper())
            except ValueError as exc:
                raise ValueError(
                    f"Estado de solicitud inválido: '{status}'. "
                    f"Valores válidos: PENDING, APPROVED, REJECTED."
                ) from exc
            stmt = stmt.where(AccessRequest.status == status_enum)

        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_requests_count(self) -> int:
        """
        Retorna el número de solicitudes de acceso pendientes de revisión.

        Returns:
            int: Número de solicitudes pendientes.
        """
        stmt = select(func.count()).select_from(AccessRequest).where(
            AccessRequest.status == AccessRequestStatus.PENDING
        )
        result = await self.db.execute(stmt)
        return int(result.scalar() or 0)

    # ------------------------------------------------------------------
    # Autenticación / Login
    # ------------------------------------------------------------------
    async def login(self, email: str, password: str) -> TokenResponse:
        """
        Autentica a un usuario y emite un token JWT.

        Implementa bloqueo de cuenta tras 5 intentos fallidos durante
        15 minutos (almacenado en Redis).

        Args:
            email: Correo electrónico del usuario.
            password: Contraseña en texto plano.

        Returns:
            TokenResponse: Token JWT y datos del usuario autenticado.

        Raises:
            AccountLockedError: Si la cuenta está bloqueada por intentos fallidos.
            InvalidCredentialsError: Si las credenciales son inválidas.
            AccountInactiveError: Si la cuenta está inactiva.
        """
        email_normalized = email.strip().lower()
        lockout_key = f"login_lockout:{email_normalized}"

        # Verificar bloqueo previo.
        is_locked = await self.redis.get(lockout_key)
        if is_locked is not None:
            ttl = await self.redis.ttl(lockout_key)
            raise AccountLockedError(
                f"La cuenta está bloqueada por exceso de intentos fallidos. "
                f"Intente de nuevo en {max(ttl, 1)} segundos."
            )

        # Buscar al usuario.
        user = await self.get_user_by_email(email_normalized)
        if user is None or not verify_password(password, user.hashed_password):
            await self._register_failed_attempt(email_normalized)
            raise InvalidCredentialsError(
                "Correo electrónico o contraseña incorrectos."
            )

        if not user.is_active:
            raise AccountInactiveError(
                "La cuenta está inactiva. Contacte al administrador."
            )

        # Resetear contador de intentos fallidos tras login exitoso.
        await self.redis.delete(f"login_failed:{email_normalized}")

        # Actualizar último login.
        await self.db.execute(
            update(User)
            .where(User.id == user.id)
            .values(last_login=datetime.now(timezone.utc))
        )

        # Emitir token JWT.
        token = create_access_token(
            data={
                "sub": user.id,
                "email": user.email,
                "role": user.role.value,
            }
        )

        logger.info(
            "Inicio de sesión exitoso — user_id=%s, email=%s, role=%s",
            user.id,
            user.email,
            user.role.value,
        )

        return TokenResponse(
            access_token=token.access_token,
            token_type=token.token_type,
            expires_in=token.expires_in,
            user=UserResponse.model_validate(user),
        )

    async def _register_failed_attempt(self, email: str) -> None:
        """
        Registra un intento fallido de login en Redis y bloquea si corresponde.

        Args:
            email: Correo electrónico del usuario (normalizado).
        """
        key = f"login_failed:{email}"
        attempts = await self.redis.incr(key)
        if attempts == 1:
            await self.redis.expire(key, _FAILED_ATTEMPTS_TTL_SECONDS)

        if attempts >= _MAX_FAILED_ATTEMPTS:
            await self.redis.set(
                lockout_key_email := f"login_lockout:{email}",
                "1",
                ex=_LOCKOUT_TTL_SECONDS,
            )
            logger.warning(
                "Cuenta bloqueada por exceso de intentos fallidos — email=%s",
                email,
            )

    async def logout(self, token: str) -> None:
        """
        Invalida un token JWT agregándolo a la lista negra en Redis.

        Args:
            token: Token JWT a invalidar.
        """
        # TTL del token: 30 minutos por defecto en la configuración.
        ttl = 30 * 60
        await self.redis.set(
            f"token_revoked:{token}",
            "1",
            ex=ttl,
        )
        logger.info("Token revocado mediante logout.")

    # ------------------------------------------------------------------
    # Gestión de usuarios — administrador
    # ------------------------------------------------------------------
    async def create_user(
        self, data: AdminCreateUserRequest, admin_id: UUID
    ) -> User:
        """
        Crea un nuevo usuario (solo administradores).

        Si ``data.from_access_request_id`` se proporciona, marca la solicitud
        de acceso original como APPROVED y la vincula al nuevo usuario.

        Args:
            data: Datos del nuevo usuario.
            admin_id: ID del administrador que crea el usuario.

        Returns:
            User: El usuario recién creado.

        Raises:
            EmailAlreadyExistsError: Si ya existe un usuario con ese email.
            AccessRequestNotFoundError: Si el ``from_access_request_id`` no existe.
        """
        logger.info(
            "Creando nuevo usuario — email=%s, role=%s, admin_id=%s",
            data.email,
            data.role.value,
            admin_id,
        )

        email_normalized = data.email.strip().lower()

        # Validar unicidad del email.
        existing = await self.get_user_by_email(email_normalized)
        if existing is not None:
            raise EmailAlreadyExistsError(
                "Ya existe un usuario con ese correo electrónico."
            )

        # Validar y vincular la solicitud de acceso, si se proporciona.
        linked_request: Optional[AccessRequest] = None
        if data.from_access_request_id is not None:
            linked_request = await self.get_access_request(
                data.from_access_request_id
            )

        user = User(
            email=email_normalized,
            full_name=data.full_name,
            company=data.company,
            phone=data.phone,
            position=data.position,
            curp=data.curp,
            rfc=data.rfc,
            hashed_password=hash_password(data.password),
            role=data.role,
            is_active=True,
            is_verified=True,  # El admin verificó al crear la cuenta.
        )

        self.db.add(user)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise EmailAlreadyExistsError(
                "Error de integridad al crear el usuario. Verifique los datos."
            ) from exc

        # Vincular y aprobar la solicitud de acceso original, si aplica.
        if linked_request is not None:
            linked_request.status = AccessRequestStatus.APPROVED
            linked_request.reviewed_by = str(admin_id)
            linked_request.reviewed_at = datetime.now(timezone.utc)
            linked_request.converted_user_id = user.id
            await self.db.flush()

        await self.db.refresh(user)
        logger.info(
            "Usuario creado — id=%s, email=%s, role=%s",
            user.id,
            user.email,
            user.role.value,
        )
        return user

    async def review_access_request(
        self,
        request_id: UUID,
        admin_id: UUID,
        review: AdminReviewRequest,
    ) -> AccessRequest:
        """
        Revisa una solicitud de acceso (aprobar o rechazar).

        Args:
            request_id: ID de la solicitud a revisar.
            admin_id: ID del administrador que revisa.
            review: Datos de la revisión (estado, motivo, notas).

        Returns:
            AccessRequest: La solicitud actualizada.

        Raises:
            AccessRequestNotFoundError: Si no se encuentra la solicitud.
            AccessRequestAlreadyReviewedError: Si la solicitud ya fue revisada.
            ValueError: Si el estado es inválido o falta el motivo de rechazo.
        """
        logger.info(
            "Revisando solicitud de acceso — request_id=%s, admin_id=%s, estado=%s",
            request_id,
            admin_id,
            review.status.value,
        )

        access_request = await self.get_access_request(request_id)

        if access_request.status != AccessRequestStatus.PENDING:
            raise AccessRequestAlreadyReviewedError(
                f"La solicitud de acceso ya fue revisada "
                f"(estado actual: {access_request.status.value})."
            )

        if review.status == AccessRequestStatus.REJECTED and not review.rejection_reason:
            raise ValueError(
                "Debe proporcionar un motivo de rechazo cuando el estado "
                "es REJECTED."
            )

        access_request.status = review.status
        access_request.reviewed_by = str(admin_id)
        access_request.reviewed_at = datetime.now(timezone.utc)
        access_request.admin_notes = review.admin_notes

        if review.status == AccessRequestStatus.REJECTED:
            access_request.rejection_reason = review.rejection_reason

        await self.db.flush()
        await self.db.refresh(access_request)

        logger.info(
            "Solicitud de acceso revisada — id=%s, estado=%s",
            access_request.id,
            access_request.status.value,
        )
        return access_request

    # ------------------------------------------------------------------
    # Consulta y actualización de usuarios
    # ------------------------------------------------------------------
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Obtiene un usuario por su correo electrónico.

        Args:
            email: Correo electrónico del usuario.

        Returns:
            Optional[User]: El usuario encontrado o None si no existe.
        """
        email_normalized = email.strip().lower()
        stmt = select(User).where(User.email == email_normalized)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_user(self, user_id: UUID) -> User:
        """
        Obtiene un usuario por su ID.

        Args:
            user_id: ID del usuario.

        Returns:
            User: El usuario encontrado.

        Raises:
            UserNotFoundError: Si no se encuentra el usuario.
        """
        stmt = select(User).where(User.id == str(user_id))
        user = (await self.db.execute(stmt)).scalar_one_or_none()
        if user is None:
            raise UserNotFoundError(
                "No se encontró el usuario especificado."
            )
        return user

    async def update_user(
        self, user_id: UUID, data: UpdateUserRequest
    ) -> User:
        """
        Actualiza los datos del propio usuario.

        Args:
            user_id: ID del usuario a actualizar.
            data: Datos a actualizar.

        Returns:
            User: El usuario actualizado.
        """
        user = await self.get_user(user_id)

        update_data = data.model_dump(exclude_unset=True)
        # La contraseña se hashea antes de almacenarla.
        if "password" in update_data and update_data["password"] is not None:
            update_data["hashed_password"] = hash_password(
                update_data.pop("password")
            )
        else:
            update_data.pop("password", None)

        for field, value in update_data.items():
            setattr(user, field, value)

        await self.db.flush()
        await self.db.refresh(user)
        logger.info("Usuario actualizado — id=%s", user.id)
        return user

    async def change_password(
        self,
        user_id: UUID,
        current_password: str,
        new_password: str,
    ) -> User:
        """
        Cambia la contraseña de un usuario tras verificar la actual.

        Args:
            user_id: ID del usuario.
            current_password: Contraseña actual en texto plano.
            new_password: Nueva contraseña en texto plano.

        Returns:
            User: El usuario actualizado.

        Raises:
            InvalidCredentialsError: Si la contraseña actual es incorrecta.
        """
        user = await self.get_user(user_id)
        if not verify_password(current_password, user.hashed_password):
            raise InvalidCredentialsError(
                "La contraseña actual es incorrecta."
            )

        user.hashed_password = hash_password(new_password)
        await self.db.flush()
        await self.db.refresh(user)
        logger.info("Contraseña actualizada — user_id=%s", user.id)
        return user

    async def list_users(
        self,
        role: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[User]:
        """
        Obtiene la lista de usuarios, opcionalmente filtrados por rol.

        Args:
            role: Filtrar por rol (ADMIN/CLIENT). Opcional.
            skip: Número de registros a omitir (paginación).
            limit: Número máximo de registros a retornar.

        Returns:
            list[User]: Lista de usuarios.
        """
        stmt = select(User).order_by(User.created_at.desc())

        if role:
            try:
                role_enum = UserRole(role.upper())
            except ValueError as exc:
                raise ValueError(
                    f"Rol inválido: '{role}'. Valores válidos: ADMIN, CLIENT."
                ) from exc
            stmt = stmt.where(User.role == role_enum)

        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def deactivate_user(self, user_id: UUID) -> User:
        """
        Desactiva un usuario (soft delete) marcándolo como inactivo.

        Args:
            user_id: ID del usuario a desactivar.

        Returns:
            User: El usuario desactivado.

        Raises:
            UserNotFoundError: Si no se encuentra el usuario.
        """
        user = await self.get_user(user_id)
        user.is_active = False
        await self.db.flush()
        await self.db.refresh(user)
        logger.info("Usuario desactivado — id=%s", user.id)
        return user
