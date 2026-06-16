"""add verification screening identity analytics tables

Revision ID: 0002_core_tables
Revises: 0001_users_access
Create Date: 2024-06-16 12:01:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = "0002_core_tables"
down_revision = "0001_users_access"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── verification_requests ─────────────────────────────────────────────
    op.create_table(
        "verification_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("curp", sa.String(18), nullable=True, index=True),
        sa.Column("rfc", sa.String(13), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("birth_date", sa.Date, nullable=True),
        sa.Column("gender", sa.String(1), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("results", postgresql.JSONB, nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── curp_validations ──────────────────────────────────────────────────
    op.create_table(
        "curp_validations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("verification_requests.id"), nullable=True, index=True),
        sa.Column("curp", sa.String(18), nullable=False, index=True),
        sa.Column("is_valid", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("check_digit_valid", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("renapo_match", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("renapo_data", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── rfc_validations ───────────────────────────────────────────────────
    op.create_table(
        "rfc_validations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("verification_requests.id"), nullable=True, index=True),
        sa.Column("rfc", sa.String(13), nullable=False, index=True),
        sa.Column("is_valid", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("person_type", sa.String(10), nullable=True),
        sa.Column("sat_active", sa.Boolean, nullable=True),
        sa.Column("sat_data", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── screening_requests ────────────────────────────────────────────────
    op.create_table(
        "screening_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("curp", sa.String(18), nullable=True),
        sa.Column("rfc", sa.String(13), nullable=True),
        sa.Column("entity_type", sa.String(20), nullable=False, server_default="person"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("results", postgresql.JSONB, nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── screening_matches ─────────────────────────────────────────────────
    op.create_table(
        "screening_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("screening_requests.id"), nullable=True, index=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("match_score", sa.Float, nullable=False),
        sa.Column("match_type", sa.String(20), nullable=False),
        sa.Column("entity_name", sa.String(255), nullable=False),
        sa.Column("entity_data", postgresql.JSONB, nullable=True),
        sa.Column("is_confirmed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── watchlist_entries ─────────────────────────────────────────────────
    op.create_table(
        "watchlist_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("source", sa.String(50), nullable=False, index=True),
        sa.Column("entity_name", sa.String(255), nullable=False, index=True),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("aliases", postgresql.JSONB, nullable=True),
        sa.Column("country", sa.String(10), nullable=True),
        sa.Column("data", postgresql.JSONB, nullable=True),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── identity_correlations ─────────────────────────────────────────────
    op.create_table(
        "identity_correlations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("curp", sa.String(18), nullable=True, index=True),
        sa.Column("rfc", sa.String(13), nullable=True, index=True),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("username", sa.String(100), nullable=True),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("identity_confidence", sa.Float, nullable=False),
        sa.Column("signals", postgresql.JSONB, nullable=True),
        sa.Column("warnings", postgresql.JSONB, nullable=True),
        sa.Column("flags", postgresql.JSONB, nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── risk_assessments ──────────────────────────────────────────────────
    op.create_table(
        "risk_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("correlation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("identity_correlations.id"), nullable=True, index=True),
        sa.Column("trust_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("risk_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("recommendation", sa.String(20), nullable=False, server_default="REVIEW"),
        sa.Column("risk_factors", postgresql.JSONB, nullable=True),
        sa.Column("mitigating_factors", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── verification_events (analytics) ───────────────────────────────────
    op.create_table(
        "verification_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_name", sa.String(255), nullable=True, index=True),
        sa.Column("curp", sa.String(18), nullable=True),
        sa.Column("rfc", sa.String(13), nullable=True),
        sa.Column("recommendation", sa.String(20), nullable=True, index=True),
        sa.Column("trust_score", sa.Float, nullable=True),
        sa.Column("risk_score", sa.Float, nullable=True),
        sa.Column("processing_time_ms", sa.Integer, nullable=True),
        sa.Column("region", sa.String(50), nullable=True, index=True),
        sa.Column("industry", sa.String(100), nullable=True, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )

    # ── alerts ────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("severity", sa.String(20), nullable=False, index=True),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.text("false"), index=True),
        sa.Column("is_resolved", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("verification_events")
    op.drop_table("risk_assessments")
    op.drop_table("identity_correlations")
    op.drop_table("watchlist_entries")
    op.drop_table("screening_matches")
    op.drop_table("screening_requests")
    op.drop_table("rfc_validations")
    op.drop_table("curp_validations")
    op.drop_table("verification_requests")
