"""
Modelos SQLAlchemy para el módulo de usuarios y autenticación.

Define los modelos ORM para persistir usuarios de la plataforma y las
solicitudes de acceso público, incluyendo:

- ``User``: Usuario autenticable de la plataforma (ADMIN o CLIENT).
- ``AccessRequest``: Solicitud de acceso enviada desde la landing page.

Ambos modelos heredan de ``Base`` y ``TimestampMixin`` para auditoría
y trazabilidad, siguiendo los patrones del proyecto.

El flujo de alta de usuarios es:
1. Un visitante envía ``AccessRequest`` desde la landing page pública.
2. Un administrador revisa la solicitud (``review_access_request``).
3. El administrador crea el ``User`` definitivo, opcionalmente
   vinculándolo a la solicitud original mediante ``converted_user_id``.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Enumeraciones
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    """
    Rol de un usuario dentro de la plataforma.

    Attributes:
        ADMIN: Administrador con acceso total al backend administrativo.
        CLIENT: Cliente que utiliza la plataforma para realizar verificaciones.
    """

    ADMIN = "ADMIN"
    CLIENT = "CLIENT"


class AccessRequestStatus(str, enum.Enum):
    """
    Estado de una solicitud de acceso.

    Attributes:
        PENDING: Solicitud recibida, pendiente de revisión por un admin.
        APPROVED: Solicitud aprobada por un administrador.
        REJECTED: Solicitud rechazada por un administrador.
    """

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ---------------------------------------------------------------------------
# Modelo: Usuario
# ---------------------------------------------------------------------------
class User(TimestampMixin, Base):
    """
    Usuario autenticable de la plataforma SynkData.

    Solo los administradores pueden crear cuentas de usuario. Los
    clientes pueden solicitar acceso desde la landing page pública;
    un administrador revisa la solicitud y, de aprobarla, crea la
    cuenta de usuario correspondiente.

    Attributes:
        id: Identificador único del usuario (UUID v4).
        email: Correo electrónico único (sirve como login).
        full_name: Nombre completo del usuario.
        company: Empresa u organización (opcional).
        phone: Teléfono de contacto (opcional).
        hashed_password: Hash bcrypt de la contraseña.
        role: Rol del usuario (ADMIN o CLIENT).
        is_active: Si la cuenta está activa.
        is_verified: Si la cuenta ha sido verificada (email, etc.).
        curp: CURP del cliente mexicano (opcional).
        rfc: RFC del cliente (opcional).
        position: Cargo o puesto del usuario (opcional).
        access_requests_count: Número de verificaciones realizadas.
        last_login: Fecha y hora del último inicio de sesión.
        created_at: Fecha y hora de creación del registro.
        updated_at: Fecha y hora de última actualización.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        comment="Identificador único del usuario (UUID v4).",
    )

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        nullable=False,
        index=True,
        comment="Correo electrónico único del usuario (sirve como login).",
    )

    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Nombre completo del usuario.",
    )

    company: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Empresa u organización del usuario.",
    )

    phone: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        comment="Teléfono de contacto en formato E.164.",
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hash bcrypt de la contraseña del usuario.",
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.CLIENT,
        index=True,
        comment="Rol del usuario: ADMIN o CLIENT.",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Si la cuenta del usuario está activa.",
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Si la cuenta ha sido verificada (email, identidad, etc.).",
    )

    curp: Mapped[Optional[str]] = mapped_column(
        String(18),
        nullable=True,
        index=True,
        comment="CURP del cliente mexicano (opcional).",
    )

    rfc: Mapped[Optional[str]] = mapped_column(
        String(13),
        nullable=True,
        index=True,
        comment="RFC del cliente (opcional).",
    )

    position: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Cargo o puesto del usuario.",
    )

    access_requests_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Número de verificaciones realizadas por el usuario.",
    )

    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Fecha y hora del último inicio de sesión (UTC).",
    )

    # ── Relaciones ───────────────────────────────────────────────────────
    # Solicitudes de acceso revisadas por este usuario (si es administrador).
    reviewed_requests: Mapped[list["AccessRequest"]] = relationship(
        "AccessRequest",
        foreign_keys="AccessRequest.reviewed_by",
        back_populates="reviewer",
        lazy="selectin",
    )

    # Solicitudes de acceso convertidas en esta cuenta de usuario.
    converted_from_request: Mapped[Optional["AccessRequest"]] = relationship(
        "AccessRequest",
        foreign_keys="AccessRequest.converted_user_id",
        back_populates="converted_user",
        uselist=False,
        lazy="selectin",
    )

    # ── Índices compuestos ───────────────────────────────────────────────
    __table_args__ = (
        Index("ix_users_role_active", "role", "is_active"),
        Index("ix_users_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<User(id={self.id!r}, email={self.email!r}, "
            f"role={self.role.value!r}, is_active={self.is_active!r})>"
        )


# ---------------------------------------------------------------------------
# Modelo: Solicitud de acceso
# ---------------------------------------------------------------------------
class AccessRequest(TimestampMixin, Base):
    """
    Solicitud de acceso enviada desde la landing page pública.

    Cualquier visitante puede enviar una solicitud de acceso. Un
    administrador revisa la solicitud y decide aprobarla o rechazarla.
    Si la aprueba, crea la cuenta de usuario correspondiente y
    vincula esa cuenta mediante ``converted_user_id``.

    Attributes:
        id: Identificador único de la solicitud (UUID v4).
        full_name: Nombre completo del solicitante (obligatorio).
        email: Correo electrónico del solicitante (obligatorio).
        phone: Teléfono del solicitante (obligatorio).
        company: Empresa del solicitante (opcional).
        position: Cargo del solicitante (opcional).
        curp: CURP del solicitante (opcional).
        rfc: RFC del solicitante (opcional).
        use_case: Caso de uso de la plataforma (obligatorio).
        expected_volume: Volumen esperado de verificaciones por mes.
        status: Estado de la solicitud (PENDING/APPROVED/REJECTED).
        reviewed_by: ID del administrador que revisó la solicitud.
        reviewed_at: Fecha y hora de revisión.
        rejection_reason: Motivo de rechazo (si aplica).
        admin_notes: Notas internas del administrador.
        converted_user_id: ID del usuario creado a partir de esta solicitud.
        created_at: Fecha y hora de creación del registro.
        updated_at: Fecha y hora de última actualización.
    """

    __tablename__ = "access_requests"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        comment="Identificador único de la solicitud (UUID v4).",
    )

    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Nombre completo del solicitante.",
    )

    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        index=True,
        comment="Correo electrónico del solicitante.",
    )

    phone: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="Teléfono de contacto del solicitante.",
    )

    company: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Empresa u organización del solicitante.",
    )

    position: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Cargo o puesto del solicitante.",
    )

    curp: Mapped[Optional[str]] = mapped_column(
        String(18),
        nullable=True,
        comment="CURP del solicitante (opcional).",
    )

    rfc: Mapped[Optional[str]] = mapped_column(
        String(13),
        nullable=True,
        comment="RFC del solicitante (opcional).",
    )

    use_case: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Descripción del caso de uso de la plataforma.",
    )

    expected_volume: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Volumen esperado de verificaciones por mes.",
    )

    status: Mapped[AccessRequestStatus] = mapped_column(
        Enum(AccessRequestStatus, name="access_request_status"),
        nullable=False,
        default=AccessRequestStatus.PENDING,
        index=True,
        comment="Estado de la solicitud: PENDING, APPROVED o REJECTED.",
    )

    reviewed_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="ID del administrador que revisó la solicitud.",
    )

    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Fecha y hora en que se revisó la solicitud (UTC).",
    )

    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Motivo de rechazo de la solicitud (si aplica).",
    )

    admin_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas internas del administrador sobre la solicitud.",
    )

    converted_user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="ID del usuario creado a partir de esta solicitud.",
    )

    # ── Relaciones ───────────────────────────────────────────────────────
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[reviewed_by],
        back_populates="reviewed_requests",
        lazy="selectin",
    )

    converted_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[converted_user_id],
        back_populates="converted_from_request",
        lazy="selectin",
    )

    # ── Índices compuestos ───────────────────────────────────────────────
    __table_args__ = (
        Index("ix_access_requests_status_created", "status", "created_at"),
        Index("ix_access_requests_email_status", "email", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<AccessRequest(id={self.id!r}, email={self.email!r}, "
            f"status={self.status.value!r})>"
        )
