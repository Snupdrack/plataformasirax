"""
Esquemas Pydantic para el módulo de usuarios, autenticación y acceso.

Define los modelos de entrada y salida para las APIs públicas y
administrativas de SynkData, incluyendo:

Esquemas de entrada:
- ``AccessRequestCreate``: Solicitud de acceso desde la landing page.
- ``LoginRequest``: Credenciales de inicio de sesión.
- ``AdminCreateUserRequest``: Datos para que un admin cree un usuario.
- ``AdminReviewRequest``: Datos para que un admin revise una solicitud.
- ``UpdateUserRequest``: Datos para actualización del propio perfil.
- ``ChangePasswordRequest``: Datos para cambio de contraseña.

Esquemas de salida:
- ``UserResponse``: Respuesta con la información del usuario.
- ``AccessRequestResponse``: Respuesta completa de una solicitud de acceso.
- ``AccessRequestSummary``: Resumen de una solicitud (vista de listado).
- ``TokenResponse``: Respuesta con el token JWT y datos del usuario.
- ``AuthStatus``: Estado de autenticación del usuario actual.

Todos los esquemas usan ``model_config`` con ``from_attributes=True``
para compatibilidad con modelos SQLAlchemy.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import AccessRequestStatus, UserRole


# ---------------------------------------------------------------------------
# Esquemas de entrada
# ---------------------------------------------------------------------------
class AccessRequestCreate(BaseModel):
    """
    Solicitud de acceso enviada desde la landing page pública.

    Attributes:
        full_name: Nombre completo del solicitante.
        email: Correo electrónico del solicitante.
        phone: Teléfono de contacto del solicitante.
        company: Empresa del solicitante (opcional).
        position: Cargo del solicitante (opcional).
        curp: CURP del solicitante (opcional).
        rfc: RFC del solicitante (opcional).
        use_case: Descripción del caso de uso de la plataforma.
        expected_volume: Volumen esperado de verificaciones por mes.
    """

    full_name: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Nombre completo del solicitante.",
        examples=["María Fernández López"],
    )

    email: EmailStr = Field(
        ...,
        description="Correo electrónico del solicitante.",
        examples=["maria.fernandez@empresa.com"],
    )

    phone: str = Field(
        ...,
        min_length=7,
        max_length=30,
        description="Teléfono de contacto del solicitante.",
        examples=["+525512345678"],
    )

    company: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Empresa u organización del solicitante.",
        examples=["Empresa S.A. de C.V."],
    )

    position: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Cargo o puesto del solicitante.",
        examples=["Director de Cumplimiento"],
    )

    curp: Optional[str] = Field(
        default=None,
        min_length=18,
        max_length=18,
        description="CURP del solicitante (opcional).",
        examples=["FELM850101MDFRRN09"],
    )

    rfc: Optional[str] = Field(
        default=None,
        min_length=12,
        max_length=13,
        description="RFC del solicitante (opcional).",
        examples=["FELM850101AB1"],
    )

    use_case: str = Field(
        ...,
        min_length=10,
        description="Descripción del caso de uso de la plataforma.",
        examples=[
            "Necesitamos verificar la identidad de nuestros clientes "
            "para cumplir con normativas KYC/AML."
        ],
    )

    expected_volume: Optional[int] = Field(
        default=None,
        ge=0,
        le=1_000_000,
        description="Volumen esperado de verificaciones por mes.",
        examples=[500],
    )


class LoginRequest(BaseModel):
    """
    Credenciales de inicio de sesión.

    Attributes:
        email: Correo electrónico del usuario.
        password: Contraseña en texto plano.
    """

    email: EmailStr = Field(
        ...,
        description="Correo electrónico del usuario.",
        examples=["admin@synkdata.io"],
    )

    password: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Contraseña del usuario.",
        examples=["S3cret!Password"],
    )


class AdminCreateUserRequest(BaseModel):
    """
    Datos para que un administrador cree una cuenta de usuario.

    Attributes:
        email: Correo electrónico del nuevo usuario.
        full_name: Nombre completo del nuevo usuario.
        phone: Teléfono del nuevo usuario.
        company: Empresa del nuevo usuario (opcional).
        position: Cargo del nuevo usuario (opcional).
        curp: CURP del nuevo usuario (opcional).
        rfc: RFC del nuevo usuario (opcional).
        password: Contraseña inicial del nuevo usuario.
        role: Rol del usuario (por defecto CLIENT).
        from_access_request_id: ID de la solicitud de acceso de la que
            proviene este usuario (opcional).
    """

    email: EmailStr = Field(
        ...,
        description="Correo electrónico del nuevo usuario.",
        examples=["cliente@empresa.com"],
    )

    full_name: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Nombre completo del nuevo usuario.",
        examples=["Juan Pérez García"],
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
        description="Teléfono del nuevo usuario.",
        examples=["+525512345678"],
    )

    company: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Empresa del nuevo usuario.",
        examples=["Empresa S.A. de C.V."],
    )

    position: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Cargo del nuevo usuario.",
        examples=["Analista de Cumplimiento"],
    )

    curp: Optional[str] = Field(
        default=None,
        min_length=18,
        max_length=18,
        description="CURP del nuevo usuario (opcional).",
    )

    rfc: Optional[str] = Field(
        default=None,
        min_length=12,
        max_length=13,
        description="RFC del nuevo usuario (opcional).",
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Contraseña inicial del nuevo usuario (mínimo 8 caracteres).",
    )

    role: UserRole = Field(
        default=UserRole.CLIENT,
        description="Rol del usuario: ADMIN o CLIENT.",
    )

    from_access_request_id: Optional[UUID] = Field(
        default=None,
        description="ID de la solicitud de acceso de la que proviene este usuario.",
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Valida que la contraseña tenga una complejidad mínima."""
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        if not any(c.isalpha() for c in v):
            raise ValueError("La contraseña debe contener al menos una letra.")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número.")
        return v


class AdminReviewRequest(BaseModel):
    """
    Datos para que un administrador revise una solicitud de acceso.

    Attributes:
        status: Nuevo estado de la solicitud (APPROVED o REJECTED).
        rejection_reason: Motivo de rechazo (obligatorio si status=REJECTED).
        admin_notes: Notas internas del administrador.
    """

    status: AccessRequestStatus = Field(
        ...,
        description="Nuevo estado de la solicitud: APPROVED o REJECTED.",
    )

    rejection_reason: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Motivo de rechazo (obligatorio si status=REJECTED).",
    )

    admin_notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Notas internas del administrador sobre la solicitud.",
    )

    @field_validator("rejection_reason")
    @classmethod
    def validate_rejection_reason(
        cls, v: Optional[str], info
    ) -> Optional[str]:
        """
        Valida que se proporcione un motivo de rechazo cuando el estado
        es REJECTED.
        """
        # ``info.data`` puede contener el estado ya validado.
        status = info.data.get("status") if info.data else None
        if status == AccessRequestStatus.REJECTED and not v:
            raise ValueError(
                "Debe proporcionar un motivo de rechazo cuando el estado "
                "es REJECTED."
            )
        return v


class UpdateUserRequest(BaseModel):
    """
    Datos para la actualización del propio perfil de usuario.

    Todos los campos son opcionales; solo se actualizan los proporcionados.

    Attributes:
        full_name: Nuevo nombre completo.
        company: Nueva empresa.
        phone: Nuevo teléfono.
        position: Nuevo cargo.
        password: Nueva contraseña (si se desea cambiar).
    """

    full_name: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=255,
        description="Nuevo nombre completo.",
    )

    company: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Nueva empresa.",
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
        description="Nuevo teléfono.",
    )

    position: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Nuevo cargo.",
    )

    password: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=128,
        description="Nueva contraseña (si se desea cambiar).",
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: Optional[str]) -> Optional[str]:
        """Valida la complejidad de la nueva contraseña, si se proporciona."""
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        if not any(c.isalpha() for c in v):
            raise ValueError("La contraseña debe contener al menos una letra.")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número.")
        return v


class ChangePasswordRequest(BaseModel):
    """
    Datos para el cambio de contraseña del propio usuario.

    Attributes:
        current_password: Contraseña actual del usuario.
        new_password: Nueva contraseña del usuario.
    """

    current_password: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Contraseña actual del usuario.",
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Nueva contraseña (mínimo 8 caracteres).",
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Valida la complejidad de la nueva contraseña."""
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        if not any(c.isalpha() for c in v):
            raise ValueError("La contraseña debe contener al menos una letra.")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número.")
        return v


# ---------------------------------------------------------------------------
# Esquemas de salida
# ---------------------------------------------------------------------------
class UserResponse(BaseModel):
    """
    Respuesta con la información pública de un usuario.

    Attributes:
        id: Identificador único del usuario.
        email: Correo electrónico.
        full_name: Nombre completo.
        company: Empresa.
        phone: Teléfono.
        role: Rol del usuario.
        is_active: Si la cuenta está activa.
        is_verified: Si la cuenta está verificada.
        curp: CURP.
        rfc: RFC.
        position: Cargo.
        last_login: Fecha y hora del último inicio de sesión.
        created_at: Fecha y hora de creación.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Identificador único del usuario.")
    email: str = Field(..., description="Correo electrónico del usuario.")
    full_name: str = Field(..., description="Nombre completo del usuario.")
    company: Optional[str] = Field(default=None, description="Empresa del usuario.")
    phone: Optional[str] = Field(default=None, description="Teléfono del usuario.")
    role: UserRole = Field(..., description="Rol del usuario.")
    is_active: bool = Field(..., description="Si la cuenta está activa.")
    is_verified: bool = Field(..., description="Si la cuenta está verificada.")
    curp: Optional[str] = Field(default=None, description="CURP del usuario.")
    rfc: Optional[str] = Field(default=None, description="RFC del usuario.")
    position: Optional[str] = Field(default=None, description="Cargo del usuario.")
    last_login: Optional[datetime] = Field(
        default=None, description="Fecha y hora del último inicio de sesión."
    )
    created_at: datetime = Field(..., description="Fecha y hora de creación.")

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_uuid(cls, v):
        """Convierte strings UUID a objetos UUID para compatibilidad."""
        if v is None:
            return v
        if isinstance(v, UUID):
            return v
        return UUID(str(v))


class AccessRequestResponse(BaseModel):
    """
    Respuesta completa de una solicitud de acceso.

    Attributes:
        id: Identificador único de la solicitud.
        full_name: Nombre completo del solicitante.
        email: Correo electrónico del solicitante.
        phone: Teléfono del solicitante.
        company: Empresa del solicitante.
        position: Cargo del solicitante.
        curp: CURP del solicitante.
        rfc: RFC del solicitante.
        use_case: Caso de uso descrito.
        expected_volume: Volumen esperado de verificaciones por mes.
        status: Estado de la solicitud.
        reviewed_by: ID del administrador que revisó la solicitud.
        reviewed_at: Fecha y hora de revisión.
        rejection_reason: Motivo de rechazo.
        admin_notes: Notas internas del administrador.
        converted_user_id: ID del usuario creado a partir de la solicitud.
        created_at: Fecha y hora de creación.
        updated_at: Fecha y hora de última actualización.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Identificador único de la solicitud.")
    full_name: str = Field(..., description="Nombre completo del solicitante.")
    email: str = Field(..., description="Correo electrónico del solicitante.")
    phone: str = Field(..., description="Teléfono del solicitante.")
    company: Optional[str] = Field(default=None, description="Empresa del solicitante.")
    position: Optional[str] = Field(default=None, description="Cargo del solicitante.")
    curp: Optional[str] = Field(default=None, description="CURP del solicitante.")
    rfc: Optional[str] = Field(default=None, description="RFC del solicitante.")
    use_case: str = Field(..., description="Caso de uso descrito.")
    expected_volume: Optional[int] = Field(
        default=None, description="Volumen esperado de verificaciones por mes."
    )
    status: AccessRequestStatus = Field(..., description="Estado de la solicitud.")
    reviewed_by: Optional[UUID] = Field(
        default=None, description="ID del administrador que revisó la solicitud."
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, description="Fecha y hora de revisión."
    )
    rejection_reason: Optional[str] = Field(
        default=None, description="Motivo de rechazo."
    )
    admin_notes: Optional[str] = Field(
        default=None, description="Notas internas del administrador."
    )
    converted_user_id: Optional[UUID] = Field(
        default=None, description="ID del usuario creado a partir de la solicitud."
    )
    created_at: datetime = Field(..., description="Fecha y hora de creación.")
    updated_at: datetime = Field(..., description="Fecha y hora de última actualización.")

    @field_validator("id", "reviewed_by", "converted_user_id", mode="before")
    @classmethod
    def _coerce_uuid(cls, v):
        """Convierte strings UUID a objetos UUID para compatibilidad."""
        if v is None:
            return v
        if isinstance(v, UUID):
            return v
        return UUID(str(v))


class AccessRequestSummary(BaseModel):
    """
    Resumen de una solicitud de acceso (vista de listado para admin).

    Attributes:
        id: Identificador único de la solicitud.
        full_name: Nombre completo del solicitante.
        email: Correo electrónico del solicitante.
        company: Empresa del solicitante.
        status: Estado de la solicitud.
        created_at: Fecha y hora de creación.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Identificador único de la solicitud.")
    full_name: str = Field(..., description="Nombre completo del solicitante.")
    email: str = Field(..., description="Correo electrónico del solicitante.")
    company: Optional[str] = Field(default=None, description="Empresa del solicitante.")
    status: AccessRequestStatus = Field(..., description="Estado de la solicitud.")
    created_at: datetime = Field(..., description="Fecha y hora de creación.")

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_uuid(cls, v):
        """Convierte strings UUID a objetos UUID para compatibilidad."""
        if v is None:
            return v
        if isinstance(v, UUID):
            return v
        return UUID(str(v))


class TokenResponse(BaseModel):
    """
    Respuesta con el token JWT y los datos del usuario autenticado.

    Attributes:
        access_token: Token JWT codificado.
        token_type: Tipo de token (siempre 'bearer').
        expires_in: Segundos hasta la expiración del token.
        user: Información del usuario autenticado.
    """

    access_token: str = Field(..., description="Token JWT codificado.")
    token_type: str = Field(default="bearer", description="Tipo de token.")
    expires_in: int = Field(..., description="Segundos hasta la expiración del token.")
    user: UserResponse = Field(..., description="Información del usuario autenticado.")


class AuthStatus(BaseModel):
    """
    Estado de autenticación del usuario actual.

    Attributes:
        is_authenticated: True si el usuario está autenticado.
        user: Información del usuario si está autenticado.
        role: Rol del usuario si está autenticado.
    """

    is_authenticated: bool = Field(..., description="Si el usuario está autenticado.")
    user: Optional[UserResponse] = Field(
        default=None, description="Información del usuario si está autenticado."
    )
    role: Optional[UserRole] = Field(
        default=None, description="Rol del usuario si está autenticado."
    )
