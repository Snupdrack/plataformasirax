"""
Router del dashboard del cliente — métricas personales y verificaciones.

Endpoints disponibles (todos requieren autenticación):
- ``GET /dashboard/overview`` — Resumen general del cliente.
- ``GET /dashboard/verifications`` — Historial de verificaciones (paginado).
- ``GET /dashboard/verifications/{id}`` — Detalle de una verificación.
- ``GET /dashboard/risk-summary`` — Agregados de riesgo del cliente.
- ``GET /dashboard/analytics`` — Analítica personal del cliente.

Los endpoints usan la dependencia ``get_current_user`` para identificar
al usuario y filtrar sus datos (verificaciones, evaluaciones de riesgo).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import db_session, get_current_user, redis_client
from app.models.analytics import VerificationEvent
from app.models.identity import IdentityCorrelation, RiskAssessment
from app.models.user import User, UserRole
from app.services.auth_service import AuthService, UserNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Esquemas de salida del dashboard
# ---------------------------------------------------------------------------
class ClientOverview(BaseModel):
    """
    Resumen general del cliente autenticado.

    Attributes:
        user_id: ID del usuario.
        full_name: Nombre completo.
        email: Correo electrónico.
        company: Empresa.
        role: Rol del usuario.
        total_verifications: Número total de verificaciones.
        verifications_today: Verificaciones realizadas hoy.
        verifications_30d: Verificaciones en los últimos 30 días.
        average_risk_score: Puntuación de riesgo promedio.
        last_verification_at: Fecha de la última verificación.
        access_requests_count: Contador de verificaciones del usuario.
    """

    user_id: UUID = Field(..., description="ID del usuario.")
    full_name: str = Field(..., description="Nombre completo.")
    email: str = Field(..., description="Correo electrónico.")
    company: Optional[str] = Field(default=None, description="Empresa.")
    role: UserRole = Field(..., description="Rol del usuario.")
    total_verifications: int = Field(..., description="Verificaciones totales.")
    verifications_today: int = Field(..., description="Verificaciones hoy.")
    verifications_30d: int = Field(..., description="Verificaciones últimos 30 días.")
    average_risk_score: float = Field(..., description="Riesgo promedio (0-100).")
    last_verification_at: Optional[datetime] = Field(
        default=None, description="Fecha de la última verificación."
    )
    access_requests_count: int = Field(
        ..., description="Contador de verificaciones del usuario."
    )


class VerificationListItem(BaseModel):
    """
    Elemento del listado de verificaciones del cliente.

    Attributes:
        id: ID del evento.
        entity_name: Nombre de la entidad verificada.
        entity_type: Tipo de entidad.
        recommendation: Recomendación resultante.
        risk_score: Puntuación de riesgo.
        trust_score: Puntuación de confianza.
        region: Región geográfica.
        created_at: Fecha y hora.
    """

    id: str = Field(..., description="ID del evento de verificación.")
    entity_name: str = Field(..., description="Nombre de la entidad.")
    entity_type: str = Field(..., description="Tipo de entidad.")
    recommendation: str = Field(..., description="Recomendación.")
    risk_score: float = Field(..., description="Puntuación de riesgo (0-100).")
    trust_score: float = Field(..., description="Puntuación de confianza (0-100).")
    region: Optional[str] = Field(default=None, description="Región geográfica.")
    created_at: datetime = Field(..., description="Fecha y hora.")


class VerificationDetail(BaseModel):
    """
    Detalle completo de una verificación del cliente.

    Attributes:
        id: ID del evento.
        entity_name: Nombre de la entidad.
        entity_type: Tipo de entidad.
        curp: CURP verificada (si aplica).
        rfc: RFC verificado (si aplica).
        recommendation: Recomendación resultante.
        risk_score: Puntuación de riesgo.
        trust_score: Puntuación de confianza.
        processing_time_ms: Tiempo de procesamiento.
        region: Región geográfica.
        industry: Industria.
        created_at: Fecha y hora de la verificación.
    """

    id: str = Field(..., description="ID del evento.")
    entity_name: str = Field(..., description="Nombre de la entidad.")
    entity_type: str = Field(..., description="Tipo de entidad.")
    curp: Optional[str] = Field(default=None, description="CURP verificada.")
    rfc: Optional[str] = Field(default=None, description="RFC verificado.")
    recommendation: str = Field(..., description="Recomendación.")
    risk_score: float = Field(..., description="Puntuación de riesgo (0-100).")
    trust_score: float = Field(..., description="Puntuación de confianza (0-100).")
    processing_time_ms: Optional[int] = Field(
        default=None, description="Tiempo de procesamiento en ms."
    )
    region: Optional[str] = Field(default=None, description="Región.")
    industry: Optional[str] = Field(default=None, description="Industria.")
    created_at: datetime = Field(..., description="Fecha y hora.")


class ClientRiskSummary(BaseModel):
    """
    Resumen de riesgo agregado del cliente.

    Attributes:
        total_assessments: Total de evaluaciones de riesgo.
        average_risk_score: Riesgo promedio (0-100).
        average_trust_score: Confianza promedio (0-100).
        approve_count: Evaluaciones con APPROVE.
        review_count: Evaluaciones con REVIEW.
        reject_count: Evaluaciones con REJECT.
        highest_risk_score: Riesgo máximo observado.
        lowest_risk_score: Riesgo mínimo observado.
    """

    total_assessments: int = Field(..., description="Total de evaluaciones.")
    average_risk_score: float = Field(..., description="Riesgo promedio (0-100).")
    average_trust_score: float = Field(..., description="Confianza promedio (0-100).")
    approve_count: int = Field(..., description="Evaluaciones APPROVE.")
    review_count: int = Field(..., description="Evaluaciones REVIEW.")
    reject_count: int = Field(..., description="Evaluaciones REJECT.")
    highest_risk_score: float = Field(..., description="Riesgo máximo observado.")
    lowest_risk_score: float = Field(..., description="Riesgo mínimo observado.")


class ClientAnalytics(BaseModel):
    """
    Analítica personal del cliente.

    Attributes:
        verifications_by_day: Verificaciones agrupadas por día (últimos 30 días).
        verifications_by_region: Verificaciones por región geográfica.
        verifications_by_industry: Verificaciones por industria.
        recommendation_distribution: Distribución de recomendaciones.
        risk_trend: Tendencia de riesgo en el tiempo.
    """

    verifications_by_day: list[dict[str, Any]] = Field(
        default_factory=list, description="Verificaciones por día (últimos 30 días)."
    )
    verifications_by_region: list[dict[str, Any]] = Field(
        default_factory=list, description="Verificaciones por región."
    )
    verifications_by_industry: list[dict[str, Any]] = Field(
        default_factory=list, description="Verificaciones por industria."
    )
    recommendation_distribution: dict[str, int] = Field(
        default_factory=dict, description="Distribución de recomendaciones."
    )
    risk_trend: list[dict[str, Any]] = Field(
        default_factory=list, description="Tendencia de riesgo en el tiempo."
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


# ---------------------------------------------------------------------------
# Utilidad — construir condiciones de filtrado por usuario
# ---------------------------------------------------------------------------
def _user_filter_conditions(user: User):
    """
    Construye las condiciones SQLAlchemy para filtrar verificaciones
    y correlaciones de identidad asociadas a un usuario.

    Se relacionan por email, CURP o RFC del usuario.

    Args:
        user: Usuario autenticado.

    Returns:
        list: Lista de condiciones SQLAlchemy (vacía si no hay filtros).
    """
    conditions = []
    if user.email:
        conditions.append(VerificationEvent.entity_name.ilike(f"%{user.email}%"))
    if user.curp:
        conditions.append(VerificationEvent.curp == user.curp)
    if user.rfc:
        conditions.append(VerificationEvent.rfc == user.rfc)
    return conditions


def _identity_filter_conditions(user: User):
    """
    Construye las condiciones SQLAlchemy para filtrar correlaciones de
    identidad asociadas a un usuario.

    Args:
        user: Usuario autenticado.

    Returns:
        list: Lista de condiciones SQLAlchemy.
    """
    conditions = []
    if user.email:
        conditions.append(IdentityCorrelation.email == user.email)
    if user.curp:
        conditions.append(IdentityCorrelation.curp == user.curp)
    if user.rfc:
        conditions.append(IdentityCorrelation.rfc == user.rfc)
    return conditions


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/overview",
    response_model=ClientOverview,
    summary="Resumen general del cliente",
    description=(
        "Retorna el resumen general del cliente autenticado: total de "
        "verificaciones, verificaciones de hoy y de los últimos 30 días, "
        "riesgo promedio y fecha de la última verificación."
    ),
)
async def get_overview(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(db_session),
) -> ClientOverview:
    """
    Obtiene el resumen general del cliente autenticado.

    Args:
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.
        db: Sesión asíncrona de PostgreSQL.

    Returns:
        ClientOverview: Resumen general.
    """
    try:
        user_id = UUID(str(current_user["sub"]))
        user = await auth_service.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)

    conditions = _user_filter_conditions(user)

    if not conditions:
        return ClientOverview(
            user_id=UUID(user.id),
            full_name=user.full_name,
            email=user.email,
            company=user.company,
            role=user.role,
            total_verifications=0,
            verifications_today=0,
            verifications_30d=0,
            average_risk_score=0.0,
            last_verification_at=None,
            access_requests_count=user.access_requests_count,
        )

    # Conteos.
    total_q = select(func.count()).select_from(VerificationEvent).where(
        or_(*conditions)
    )
    today_q = select(func.count()).select_from(VerificationEvent).where(
        or_(*conditions), VerificationEvent.created_at >= today_start
    )
    last_30d_q = select(func.count()).select_from(VerificationEvent).where(
        or_(*conditions), VerificationEvent.created_at >= thirty_days_ago
    )
    avg_q = select(func.avg(VerificationEvent.risk_score)).where(
        or_(*conditions)
    )
    last_q = select(func.max(VerificationEvent.created_at)).where(
        or_(*conditions)
    )

    total_v = int((await db.execute(total_q)).scalar() or 0)
    today_v = int((await db.execute(today_q)).scalar() or 0)
    last_30d_v = int((await db.execute(last_30d_q)).scalar() or 0)
    avg_v = float((await db.execute(avg_q)).scalar() or 0.0)
    last_v = (await db.execute(last_q)).scalar()

    return ClientOverview(
        user_id=UUID(user.id),
        full_name=user.full_name,
        email=user.email,
        company=user.company,
        role=user.role,
        total_verifications=total_v,
        verifications_today=today_v,
        verifications_30d=last_30d_v,
        average_risk_score=round(avg_v, 2),
        last_verification_at=last_v,
        access_requests_count=user.access_requests_count,
    )


@router.get(
    "/verifications",
    response_model=list[VerificationListItem],
    summary="Historial de verificaciones del cliente",
    description=(
        "Lista el historial de verificaciones del cliente autenticado, "
        "ordenado por fecha descendente y paginado."
    ),
)
async def list_verifications(
    skip: int = Query(default=0, ge=0, description="Offset de paginación."),
    limit: int = Query(
        default=20, ge=1, le=100, description="Límite de paginación."
    ),
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(db_session),
) -> list[VerificationListItem]:
    """
    Lista el historial de verificaciones del cliente.

    Args:
        skip: Offset de paginación.
        limit: Límite de paginación.
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.
        db: Sesión asíncrona de PostgreSQL.

    Returns:
        list[VerificationListItem]: Lista de verificaciones.
    """
    try:
        user = await auth_service.get_user(UUID(str(current_user["sub"])))
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    conditions = _user_filter_conditions(user)
    if not conditions:
        return []

    stmt = (
        select(VerificationEvent)
        .where(or_(*conditions))
        .order_by(VerificationEvent.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    events = result.scalars().all()

    return [
        VerificationListItem(
            id=ev.id,
            entity_name=ev.entity_name,
            entity_type=ev.entity_type,
            recommendation=ev.recommendation,
            risk_score=float(ev.risk_score),
            trust_score=float(ev.trust_score),
            region=ev.region,
            created_at=ev.created_at,
        )
        for ev in events
    ]


@router.get(
    "/verifications/{verification_id}",
    response_model=VerificationDetail,
    summary="Detalle de una verificación",
    description="Obtiene el detalle de una verificación específica del cliente.",
)
async def get_verification_detail(
    verification_id: str,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(db_session),
) -> VerificationDetail:
    """
    Obtiene el detalle de una verificación del cliente.

    Args:
        verification_id: ID de la verificación.
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.
        db: Sesión asíncrona de PostgreSQL.

    Returns:
        VerificationDetail: Detalle de la verificación.

    Raises:
        HTTPException 404: Si la verificación no existe o no pertenece al usuario.
    """
    try:
        user = await auth_service.get_user(UUID(str(current_user["sub"])))
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    conditions = _user_filter_conditions(user)

    stmt = select(VerificationEvent).where(
        VerificationEvent.id == verification_id
    )
    if conditions:
        stmt = stmt.where(or_(*conditions))

    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verificación no encontrada o no pertenece al usuario.",
        )

    return VerificationDetail(
        id=event.id,
        entity_name=event.entity_name,
        entity_type=event.entity_type,
        curp=event.curp,
        rfc=event.rfc,
        recommendation=event.recommendation,
        risk_score=float(event.risk_score),
        trust_score=float(event.trust_score),
        processing_time_ms=event.processing_time_ms,
        region=event.region,
        industry=event.industry,
        created_at=event.created_at,
    )


@router.get(
    "/risk-summary",
    response_model=ClientRiskSummary,
    summary="Resumen de riesgo del cliente",
    description=(
        "Calcula agregados de riesgo a partir de las evaluaciones de riesgo "
        "asociadas al cliente (por email, CURP o RFC)."
    ),
)
async def get_risk_summary(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(db_session),
) -> ClientRiskSummary:
    """
    Obtiene el resumen de riesgo agregado del cliente.

    Args:
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.
        db: Sesión asíncrona de PostgreSQL.

    Returns:
        ClientRiskSummary: Resumen de riesgo.
    """
    try:
        user = await auth_service.get_user(UUID(str(current_user["sub"])))
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    conditions = _identity_filter_conditions(user)
    if not conditions:
        return ClientRiskSummary(
            total_assessments=0,
            average_risk_score=0.0,
            average_trust_score=0.0,
            approve_count=0,
            review_count=0,
            reject_count=0,
            highest_risk_score=0.0,
            lowest_risk_score=0.0,
        )

    stmt = (
        select(
            func.count().label("total"),
            func.avg(RiskAssessment.risk_score).label("avg_risk"),
            func.avg(RiskAssessment.trust_score).label("avg_trust"),
            func.max(RiskAssessment.risk_score).label("max_risk"),
            func.min(RiskAssessment.risk_score).label("min_risk"),
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

    row = (await db.execute(stmt)).one()

    return ClientRiskSummary(
        total_assessments=int(row.total or 0),
        average_risk_score=round(float(row.avg_risk or 0.0), 2),
        average_trust_score=round(float(row.avg_trust or 0.0), 2),
        approve_count=int(row.approve_count or 0),
        review_count=int(row.review_count or 0),
        reject_count=int(row.reject_count or 0),
        highest_risk_score=round(float(row.max_risk or 0.0), 2),
        lowest_risk_score=round(float(row.min_risk or 0.0), 2),
    )


@router.get(
    "/analytics",
    response_model=ClientAnalytics,
    summary="Analítica personal del cliente",
    description=(
        "Retorna analítica agregada del cliente: verificaciones por día, "
        "por región, por industria, distribución de recomendaciones y "
        "tendencia de riesgo en el tiempo."
    ),
)
async def get_analytics(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(db_session),
) -> ClientAnalytics:
    """
    Calcula la analítica personal del cliente.

    Args:
        current_user: Payload del JWT decodificado.
        auth_service: Servicio de autenticación inyectado.
        db: Sesión asíncrona de PostgreSQL.

    Returns:
        ClientAnalytics: Analítica agregada.
    """
    try:
        user = await auth_service.get_user(UUID(str(current_user["sub"])))
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    conditions = _user_filter_conditions(user)
    if not conditions:
        return ClientAnalytics()

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    # ── Verificaciones por día (últimos 30 días) ───────────────────────
    by_day_stmt = (
        select(
            func.date_trunc("day", VerificationEvent.created_at).label("day"),
            func.count().label("count"),
            func.avg(VerificationEvent.risk_score).label("avg_risk"),
        )
        .where(or_(*conditions), VerificationEvent.created_at >= thirty_days_ago)
        .group_by("day")
        .order_by("day")
    )
    by_day_rows = (await db.execute(by_day_stmt)).all()
    verifications_by_day = [
        {
            "day": row.day.isoformat() if row.day else None,
            "count": int(row.count or 0),
            "avg_risk": round(float(row.avg_risk or 0.0), 2),
        }
        for row in by_day_rows
    ]

    # ── Verificaciones por región ───────────────────────────────────────
    by_region_stmt = (
        select(
            VerificationEvent.region.label("region"),
            func.count().label("count"),
            func.avg(VerificationEvent.risk_score).label("avg_risk"),
        )
        .where(or_(*conditions), VerificationEvent.region.isnot(None))
        .group_by(VerificationEvent.region)
        .order_by(func.count().desc())
        .limit(10)
    )
    by_region_rows = (await db.execute(by_region_stmt)).all()
    verifications_by_region = [
        {
            "region": row.region,
            "count": int(row.count or 0),
            "avg_risk": round(float(row.avg_risk or 0.0), 2),
        }
        for row in by_region_rows
    ]

    # ── Verificaciones por industria ────────────────────────────────────
    by_industry_stmt = (
        select(
            VerificationEvent.industry.label("industry"),
            func.count().label("count"),
            func.avg(VerificationEvent.risk_score).label("avg_risk"),
        )
        .where(or_(*conditions), VerificationEvent.industry.isnot(None))
        .group_by(VerificationEvent.industry)
        .order_by(func.count().desc())
        .limit(10)
    )
    by_industry_rows = (await db.execute(by_industry_stmt)).all()
    verifications_by_industry = [
        {
            "industry": row.industry,
            "count": int(row.count or 0),
            "avg_risk": round(float(row.avg_risk or 0.0), 2),
        }
        for row in by_industry_rows
    ]

    # ── Distribución de recomendaciones ─────────────────────────────────
    rec_stmt = (
        select(
            VerificationEvent.recommendation.label("rec"),
            func.count().label("count"),
        )
        .where(or_(*conditions))
        .group_by(VerificationEvent.recommendation)
    )
    rec_rows = (await db.execute(rec_stmt)).all()
    recommendation_distribution = {
        (row.rec or "UNKNOWN"): int(row.count or 0) for row in rec_rows
    }

    # ── Tendencia de riesgo (por día, últimos 30 días) ─────────────────
    risk_trend = verifications_by_day  # Reutilizamos el cálculo por día.

    return ClientAnalytics(
        verifications_by_day=verifications_by_day,
        verifications_by_region=verifications_by_region,
        verifications_by_industry=verifications_by_industry,
        recommendation_distribution=recommendation_distribution,
        risk_trend=risk_trend,
    )
