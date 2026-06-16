"""
Servicio de lógica administrativa para SynkData.

Este servicio encapsula las operaciones de negocio específicas del
backend administrativo, incluyendo:

- Estadísticas globales del dashboard de administración.
- Feed de actividad reciente (registros, solicitudes, verificaciones).
- Detalle individual de un usuario con su historial de verificaciones
  y agregados de riesgo.
- Exportación del listado de usuarios en formato CSV.

Utiliza SQLAlchemy asíncrono para todas las consultas y consulta
los modelos existentes (User, AccessRequest, VerificationEvent,
RiskAssessment, IdentityCorrelation) para construir los agregados.

Todos los mensajes dirigidos al usuario están en español.
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from redis.asyncio import Redis
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import VerificationEvent
from app.models.identity import IdentityCorrelation, RiskAssessment
from app.models.user import (
    AccessRequest,
    AccessRequestStatus,
    User,
    UserRole,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService, UserNotFoundError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Esquemas auxiliares — Activity, Stats, UserDetail
# ---------------------------------------------------------------------------
class ActivityItem(BaseModel):
    """
    Elemento del feed de actividad reciente del administrador.

    Attributes:
        type: Tipo de actividad (user_registered, access_request,
            verification, etc.).
        description: Descripción legible en español.
        timestamp: Fecha y hora del evento.
        user_email: Correo del usuario relacionado (si aplica).
    """

    type: str = Field(..., description="Tipo de actividad.")
    description: str = Field(..., description="Descripción legible.")
    timestamp: datetime = Field(..., description="Fecha y hora del evento.")
    user_email: Optional[str] = Field(
        default=None, description="Correo del usuario relacionado (si aplica)."
    )


class AdminStats(BaseModel):
    """
    Estadísticas del dashboard de administración.

    Attributes:
        total_users: Total de usuarios registrados.
        total_clients: Total de usuarios con rol CLIENT.
        total_admins: Total de usuarios con rol ADMIN.
        pending_requests: Solicitudes de acceso pendientes.
        approved_requests: Solicitudes de acceso aprobadas.
        rejected_requests: Solicitudes de acceso rechazadas.
        verifications_today: Verificaciones realizadas hoy.
        active_users: Usuarios con cuenta activa.
        new_users_30d: Usuarios creados en los últimos 30 días.
    """

    total_users: int = Field(..., description="Total de usuarios registrados.")
    total_clients: int = Field(..., description="Total de usuarios con rol CLIENT.")
    total_admins: int = Field(..., description="Total de usuarios con rol ADMIN.")
    pending_requests: int = Field(..., description="Solicitudes de acceso pendientes.")
    approved_requests: int = Field(..., description="Solicitudes aprobadas.")
    rejected_requests: int = Field(..., description="Solicitudes rechazadas.")
    verifications_today: int = Field(..., description="Verificaciones realizadas hoy.")
    active_users: int = Field(..., description="Usuarios con cuenta activa.")
    new_users_30d: int = Field(..., description="Usuarios nuevos en los últimos 30 días.")


class RiskSummary(BaseModel):
    """
    Resumen agregado de riesgo para un usuario.

    Attributes:
        total_assessments: Número total de evaluaciones de riesgo.
        average_risk_score: Puntuación de riesgo promedio (0-100).
        average_trust_score: Puntuación de confianza promedio (0-100).
        approve_count: Evaluaciones con recomendación APPROVE.
        review_count: Evaluaciones con recomendación REVIEW.
        reject_count: Evaluaciones con recomendación REJECT.
    """

    total_assessments: int = Field(..., description="Total de evaluaciones.")
    average_risk_score: float = Field(..., description="Riesgo promedio (0-100).")
    average_trust_score: float = Field(..., description="Confianza promedio (0-100).")
    approve_count: int = Field(..., description="Evaluaciones con APPROVE.")
    review_count: int = Field(..., description="Evaluaciones con REVIEW.")
    reject_count: int = Field(..., description="Evaluaciones con REJECT.")


class VerificationHistoryItem(BaseModel):
    """
    Elemento del historial de verificaciones de un usuario.

    Attributes:
        id: ID del evento de verificación.
        entity_name: Nombre de la entidad verificada.
        recommendation: Recomendación resultante.
        risk_score: Puntuación de riesgo.
        trust_score: Puntuación de confianza.
        created_at: Fecha y hora de la verificación.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="ID del evento de verificación.")
    entity_name: str = Field(..., description="Nombre de la entidad verificada.")
    recommendation: str = Field(..., description="Recomendación resultante.")
    risk_score: float = Field(..., description="Puntuación de riesgo (0-100).")
    trust_score: float = Field(..., description="Puntuación de confianza (0-100).")
    created_at: datetime = Field(..., description="Fecha y hora de la verificación.")


class UserDetail(BaseModel):
    """
    Detalle completo de un usuario para el administrador.

    Attributes:
        user: Información del usuario.
        recent_verifications: Verificaciones recientes asociadas.
        risk_summary: Resumen agregado de riesgo.
    """

    user: UserResponse = Field(..., description="Información del usuario.")
    recent_verifications: list[VerificationHistoryItem] = Field(
        default_factory=list, description="Verificaciones recientes."
    )
    risk_summary: RiskSummary = Field(..., description="Resumen de riesgo.")


# ---------------------------------------------------------------------------
# Servicio de administración
# ---------------------------------------------------------------------------
class AdminService:
    """
    Servicio de lógica de negocio para el backend administrativo.

    Provee métricas agregadas, feed de actividad, detalle de usuario
    y exportación de datos. Todas las consultas usan SQLAlchemy asíncrono
    y se cachean en Redis cuando aplica.

    Attributes:
        db: Sesión asíncrona de SQLAlchemy.
        redis: Cliente Redis asíncrono para caché.

    Example:
        >>> async with get_db_session() as session:
        ...     service = AdminService(db=session, redis=get_redis())
        ...     stats = await service.get_admin_stats()
    """

    def __init__(self, db: AsyncSession, redis: Redis) -> None:
        """
        Inicializa el servicio administrativo.

        Args:
            db: Sesión asíncrona de SQLAlchemy.
            redis: Cliente Redis asíncrono.
        """
        self.db = db
        self.redis = redis
        self._auth_service = AuthService(db=db, redis=redis)

    # ------------------------------------------------------------------
    # Estadísticas
    # ------------------------------------------------------------------
    async def get_admin_stats(self) -> AdminStats:
        """
        Calcula las estadísticas globales del dashboard de administración.

        Returns:
            AdminStats: Estadísticas agregadas.
        """
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # Conteos de usuarios.
        total_users = await self._count(select(func.count()).select_from(User))
        total_clients = await self._count(
            select(func.count())
            .select_from(User)
            .where(User.role == UserRole.CLIENT)
        )
        total_admins = await self._count(
            select(func.count())
            .select_from(User)
            .where(User.role == UserRole.ADMIN)
        )
        active_users = await self._count(
            select(func.count())
            .select_from(User)
            .where(User.is_active.is_(True))
        )
        new_users_30d = await self._count(
            select(func.count())
            .select_from(User)
            .where(User.created_at >= thirty_days_ago)
        )

        # Conteos de solicitudes de acceso.
        pending_requests = await self._count(
            select(func.count())
            .select_from(AccessRequest)
            .where(AccessRequest.status == AccessRequestStatus.PENDING)
        )
        approved_requests = await self._count(
            select(func.count())
            .select_from(AccessRequest)
            .where(AccessRequest.status == AccessRequestStatus.APPROVED)
        )
        rejected_requests = await self._count(
            select(func.count())
            .select_from(AccessRequest)
            .where(AccessRequest.status == AccessRequestStatus.REJECTED)
        )

        # Verificaciones hoy.
        verifications_today = await self._count(
            select(func.count())
            .select_from(VerificationEvent)
            .where(VerificationEvent.created_at >= today_start)
        )

        return AdminStats(
            total_users=total_users,
            total_clients=total_clients,
            total_admins=total_admins,
            pending_requests=pending_requests,
            approved_requests=approved_requests,
            rejected_requests=rejected_requests,
            verifications_today=verifications_today,
            active_users=active_users,
            new_users_30d=new_users_30d,
        )

    # ------------------------------------------------------------------
    # Feed de actividad reciente
    # ------------------------------------------------------------------
    async def get_recent_activity(
        self, limit: int = 20
    ) -> list[ActivityItem]:
        """
        Construye un feed de actividad reciente mezclando:
        - Registros de usuarios nuevos.
        - Solicitudes de acceso recibidas.
        - Verificaciones realizadas.

        Args:
            limit: Número máximo de elementos a retornar.

        Returns:
            list[ActivityItem]: Actividad reciente ordenada por fecha desc.
        """
        activities: list[ActivityItem] = []

        # ── Usuarios nuevos ────────────────────────────────────────────
        users_stmt = (
            select(User)
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        async for user in (await self.db.stream(users_stmt)).scalars():
            activities.append(
                ActivityItem(
                    type="user_registered",
                    description=(
                        f"Nuevo usuario registrado: {user.full_name} "
                        f"(rol: {user.role.value})."
                    ),
                    timestamp=user.created_at,
                    user_email=user.email,
                )
            )

        # ── Solicitudes de acceso ──────────────────────────────────────
        requests_stmt = (
            select(AccessRequest)
            .order_by(AccessRequest.created_at.desc())
            .limit(limit)
        )
        async for req in (await self.db.stream(requests_stmt)).scalars():
            status_label = {
                AccessRequestStatus.PENDING: "pendiente",
                AccessRequestStatus.APPROVED: "aprobada",
                AccessRequestStatus.REJECTED: "rechazada",
            }.get(req.status, req.status.value)
            activities.append(
                ActivityItem(
                    type="access_request",
                    description=(
                        f"Solicitud de acceso de {req.full_name} "
                        f"({status_label})."
                    ),
                    timestamp=req.created_at,
                    user_email=req.email,
                )
            )

        # ── Verificaciones recientes ───────────────────────────────────
        verifications_stmt = (
            select(VerificationEvent)
            .order_by(VerificationEvent.created_at.desc())
            .limit(limit)
        )
        async for ev in (await self.db.stream(verifications_stmt)).scalars():
            activities.append(
                ActivityItem(
                    type="verification",
                    description=(
                        f"Verificación de '{ev.entity_name}' — "
                        f"recomendación: {ev.recommendation}."
                    ),
                    timestamp=ev.created_at,
                    user_email=None,
                )
            )

        # Ordenar y limitar.
        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:limit]

    # ------------------------------------------------------------------
    # Detalle de usuario
    # ------------------------------------------------------------------
    async def get_user_detail(self, user_id: UUID) -> UserDetail:
        """
        Obtiene el detalle completo de un usuario, incluyendo su historial
        de verificaciones y el resumen agregado de riesgo.

        Args:
            user_id: ID del usuario.

        Returns:
            UserDetail: Detalle del usuario.

        Raises:
            UserNotFoundError: Si no se encuentra el usuario.
        """
        user = await self._auth_service.get_user(user_id)
        user_response = UserResponse.model_validate(user)

        # Buscar verificaciones asociadas al usuario por email o CURP/RFC.
        verifications = await self._fetch_user_verifications(user, limit=20)
        risk_summary = await self._compute_risk_summary(user)

        return UserDetail(
            user=user_response,
            recent_verifications=verifications,
            risk_summary=risk_summary,
        )

    async def _fetch_user_verifications(
        self, user: User, limit: int = 20
    ) -> list[VerificationHistoryItem]:
        """
        Obtiene las verificaciones asociadas a un usuario.

        Se relaciona por correo electrónico, CURP o RFC del usuario.

        Args:
            user: Usuario cuyas verificaciones se buscan.
            limit: Número máximo de verificaciones a retornar.

        Returns:
            list[VerificationHistoryItem]: Verificaciones recientes.
        """
        conditions = []
        if user.email:
            conditions.append(VerificationEvent.entity_name.ilike(f"%{user.email}%"))
        if user.curp:
            conditions.append(VerificationEvent.curp == user.curp)
        if user.rfc:
            conditions.append(VerificationEvent.rfc == user.rfc)

        if not conditions:
            return []

        stmt = (
            select(VerificationEvent)
            .where(or_(*conditions))
            .order_by(VerificationEvent.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        events = result.scalars().all()

        return [
            VerificationHistoryItem(
                id=ev.id,
                entity_name=ev.entity_name,
                recommendation=ev.recommendation,
                risk_score=float(ev.risk_score),
                trust_score=float(ev.trust_score),
                created_at=ev.created_at,
            )
            for ev in events
        ]

    async def _compute_risk_summary(self, user: User) -> RiskSummary:
        """
        Calcula el resumen de riesgo agregado para un usuario.

        Busca evaluaciones de riesgo cuyas correlaciones de identidad
        coincidan con el email/CURP/RFC del usuario.

        Args:
            user: Usuario cuyo riesgo se resume.

        Returns:
            RiskSummary: Resumen de riesgo agregado.
        """
        conditions = []
        if user.email:
            conditions.append(IdentityCorrelation.email == user.email)
        if user.curp:
            conditions.append(IdentityCorrelation.curp == user.curp)
        if user.rfc:
            conditions.append(IdentityCorrelation.rfc == user.rfc)

        if not conditions:
            return RiskSummary(
                total_assessments=0,
                average_risk_score=0.0,
                average_trust_score=0.0,
                approve_count=0,
                review_count=0,
                reject_count=0,
            )

        stmt = (
            select(
                func.count().label("total"),
                func.avg(RiskAssessment.risk_score).label("avg_risk"),
                func.avg(RiskAssessment.trust_score).label("avg_trust"),
                func.sum(
                    case(
                        (RiskAssessment.recommendation == "APPROVE", 1),
                        else_=0,
                    )
                ).label("approve_count"),
                func.sum(
                    case(
                        (RiskAssessment.recommendation == "REVIEW", 1),
                        else_=0,
                    )
                ).label("review_count"),
                func.sum(
                    case(
                        (RiskAssessment.recommendation == "REJECT", 1),
                        else_=0,
                    )
                ).label("reject_count"),
            )
            .select_from(RiskAssessment)
            .join(
                IdentityCorrelation,
                IdentityCorrelation.id == RiskAssessment.correlation_id,
            )
            .where(or_(*conditions))
        )

        row = (await self.db.execute(stmt)).one()
        total = int(row.total or 0)
        avg_risk = float(row.avg_risk or 0.0)
        avg_trust = float(row.avg_trust or 0.0)

        return RiskSummary(
            total_assessments=total,
            average_risk_score=round(avg_risk, 2),
            average_trust_score=round(avg_trust, 2),
            approve_count=int(row.approve_count or 0),
            review_count=int(row.review_count or 0),
            reject_count=int(row.reject_count or 0),
        )

    # ------------------------------------------------------------------
    # Exportación
    # ------------------------------------------------------------------
    async def export_users(self, format: str = "csv") -> bytes:
        """
        Exporta el listado completo de usuarios en el formato solicitado.

        Args:
            format: Formato de exportación. Actualmente soporta 'csv'.

        Returns:
            bytes: Contenido del archivo exportado.

        Raises:
            ValueError: Si el formato no es soportado.
        """
        if format.lower() != "csv":
            raise ValueError(
                f"Formato de exportación no soportado: '{format}'. "
                f"Actualmente solo se soporta 'csv'."
            )

        stmt = select(User).order_by(User.created_at.desc())
        result = await self.db.execute(stmt)
        users = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "email",
                "full_name",
                "company",
                "phone",
                "role",
                "is_active",
                "is_verified",
                "curp",
                "rfc",
                "position",
                "access_requests_count",
                "last_login",
                "created_at",
            ]
        )

        for u in users:
            writer.writerow(
                [
                    u.id,
                    u.email,
                    u.full_name,
                    u.company or "",
                    u.phone or "",
                    u.role.value,
                    "1" if u.is_active else "0",
                    "1" if u.is_verified else "0",
                    u.curp or "",
                    u.rfc or "",
                    u.position or "",
                    u.access_requests_count,
                    u.last_login.isoformat() if u.last_login else "",
                    u.created_at.isoformat() if u.created_at else "",
                ]
            )

        return output.getvalue().encode("utf-8")

    # ------------------------------------------------------------------
    # Utilidades internas
    # ------------------------------------------------------------------
    async def _count(self, stmt) -> int:
        """
        Ejecuta una consulta ``SELECT COUNT(*)`` y retorna el valor entero.

        Args:
            stmt: Sentencia SQLAlchemy de tipo count.

        Returns:
            int: Resultado de la cuenta (0 si es None).
        """
        result = await self.db.execute(stmt)
        value = result.scalar()
        return int(value or 0)
