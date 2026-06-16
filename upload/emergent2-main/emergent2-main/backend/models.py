"""Pydantic models for SynkData Identity Intelligence Platform."""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import uuid


def _id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ──────────────── USERS ────────────────
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Literal["admin", "analyst", "viewer"] = "analyst"
    organization: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: str
    organization: Optional[str] = None
    created_at: str


class User(UserPublic):
    password_hash: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


# ──────────────── BACKGROUND CHECK ────────────────
class CheckRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(..., min_length=2)
    first_name: Optional[str] = None
    paternal_surname: Optional[str] = None
    maternal_surname: Optional[str] = None
    birth_date: Optional[str] = Field(None, description="DD/MM/YYYY")
    curp: Optional[str] = None
    rfc: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = "Nacional"
    nationality: Optional[str] = "Mexicana"

    include_government: bool = True
    include_sanctions: bool = True
    include_digital_identity: bool = True
    include_digital_footprint: bool = True
    include_relationship: bool = True
    include_ai_report: bool = True

    consent_id: Optional[str] = None
    purpose: Optional[str] = "Background Check KYC"


class CurpValidationResult(BaseModel):
    is_valid: bool
    message: str
    curp: Optional[str] = None
    components: Optional[Dict[str, Any]] = None
    check_digit_valid: Optional[bool] = None
    renapo_match: Optional[bool] = None


class RfcValidationResult(BaseModel):
    is_valid: bool
    message: str
    rfc: Optional[str] = None
    type: Optional[str] = None  # "fisica" or "moral"
    components: Optional[Dict[str, Any]] = None
    sat_status: Optional[str] = None


class SanctionsMatch(BaseModel):
    list_name: str
    matched_name: str
    score: float
    program: Optional[str] = None
    country: Optional[str] = None
    type: Optional[str] = None  # SDN, PEP, etc.
    source_id: Optional[str] = None


class SanctionsResult(BaseModel):
    is_sanctioned: bool
    is_pep: bool
    matches: List[SanctionsMatch] = []
    lists_checked: List[str]


class CheckResult(BaseModel):
    id: str = Field(default_factory=_id)
    created_at: str = Field(default_factory=_now)
    requested_by_id: str
    requested_by_email: str

    subject: Dict[str, Any]
    request: Dict[str, Any]

    curp_validation: Optional[Dict[str, Any]] = None
    rfc_validation: Optional[Dict[str, Any]] = None
    government: Optional[Dict[str, Any]] = None
    sanctions: Optional[Dict[str, Any]] = None
    digital_identity: Optional[Dict[str, Any]] = None
    digital_footprint: Optional[Dict[str, Any]] = None
    relationship: Optional[Dict[str, Any]] = None

    trust_score: float = 0
    risk_score: float = 0
    risk_level: str = "BAJO"
    recommendation: str = "REVIEW"
    identity_confidence: float = 0

    flags: List[str] = []
    critical_alerts: List[Dict[str, Any]] = []
    sources_consulted: List[str] = []

    ai_report: Optional[str] = None
    processing_time_ms: float = 0
