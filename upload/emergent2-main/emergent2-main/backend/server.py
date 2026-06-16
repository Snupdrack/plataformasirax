"""SynkData Identity Intelligence Platform — Main API server."""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
import os
import logging
import time
from typing import Optional, List

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from models import (
    UserCreate, UserLogin, AuthResponse, UserPublic, User,
    CheckRequest, CheckResult,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role, TokenData,
)
from services.identity import validate_curp, validate_rfc
from services.government import query_renapo, query_sat, query_imss, query_rnd
from services.sanctions import screen_sanctions, ALL_LISTS
from services.digital import enrich_email, enrich_phone, discover_username, calculate_digital_footprint
from services.relationship import build_relationship_graph
from services.scoring import calculate_scores
from services.ai_investigator import generate_investigation_report

# ──────────────── App / DB setup ────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("synkdata")

app = FastAPI(title="SynkData Identity Intelligence Platform", version="1.0.0")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def seed_admin():
    """Seed an admin user if none exists."""
    existing = await db.users.find_one({"email": "admin@synkdata.mx"})
    if not existing:
        admin = {
            "id": "admin-seed-001",
            "full_name": "SynkData Administrator",
            "email": "admin@synkdata.mx",
            "password_hash": hash_password("Admin2026!"),
            "role": "admin",
            "organization": "SynkData",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin)
        logger.info("Seeded admin user admin@synkdata.mx / Admin2026!")

    analyst = await db.users.find_one({"email": "analyst@synkdata.mx"})
    if not analyst:
        await db.users.insert_one({
            "id": "analyst-seed-001",
            "full_name": "Demo Analyst",
            "email": "analyst@synkdata.mx",
            "password_hash": hash_password("Analyst2026!"),
            "role": "analyst",
            "organization": "SynkData",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded analyst user analyst@synkdata.mx / Analyst2026!")


# ──────────────── HEALTH ────────────────
@api.get("/")
async def root():
    return {"service": "SynkData Identity Intelligence Platform", "version": "1.0.0", "status": "operational"}


@api.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# ──────────────── AUTH ────────────────
@api.post("/auth/register", response_model=AuthResponse)
async def register(payload: UserCreate):
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user = {
        "id": f"user-{int(time.time()*1000)}",
        "full_name": payload.full_name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "organization": payload.organization,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token({
        "sub": user["id"], "email": user["email"], "role": user["role"], "full_name": user["full_name"],
    })
    public = {k: v for k, v in user.items() if k != "password_hash"}
    return {"token": token, "user": public}


@api.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token({
        "sub": user["id"], "email": user["email"], "role": user["role"], "full_name": user["full_name"],
    })
    public = {k: v for k, v in user.items() if k != "password_hash"}
    return {"token": token, "user": public}


@api.get("/auth/me", response_model=UserPublic)
async def me(user: TokenData = Depends(get_current_user)):
    db_user = await db.users.find_one({"id": user.user_id}, {"_id": 0, "password_hash": 0})
    if not db_user:
        raise HTTPException(404, "Usuario no encontrado")
    return db_user


# ──────────────── IDENTITY VERIFICATION ────────────────
@api.post("/identity/curp")
async def curp_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return validate_curp(payload.get("curp", ""), payload.get("full_name"), payload.get("birth_date"))


@api.post("/identity/rfc")
async def rfc_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return validate_rfc(payload.get("rfc", ""))


# ──────────────── GOVERNMENT ────────────────
@api.post("/government/renapo")
async def renapo_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return query_renapo(payload.get("curp", ""), payload.get("full_name"))


@api.post("/government/sat")
async def sat_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return query_sat(payload.get("rfc", ""))


@api.post("/government/imss")
async def imss_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return query_imss(payload.get("nss"), payload.get("curp"))


@api.post("/government/rnd")
async def rnd_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return query_rnd(
        nombre=payload.get("first_name", ""),
        paterno=payload.get("paternal_surname", ""),
        materno=payload.get("maternal_surname", ""),
        fecha_nac=payload.get("birth_date", ""),
        estado=payload.get("state", "Nacional"),
    )


# ──────────────── SANCTIONS ────────────────
@api.post("/sanctions/screen")
async def sanctions_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return screen_sanctions(payload.get("full_name", ""), int(payload.get("threshold", 80)))


@api.get("/sanctions/lists")
async def sanctions_lists():
    return {"lists": ALL_LISTS}


# ──────────────── DIGITAL ────────────────
@api.post("/digital/email")
async def email_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return enrich_email(payload.get("email", ""))


@api.post("/digital/phone")
async def phone_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return enrich_phone(payload.get("phone", ""))


@api.post("/digital/username")
async def username_endpoint(payload: dict, user: TokenData = Depends(get_current_user)):
    return discover_username(payload.get("username", ""))


# ──────────────── BACKGROUND CHECK (master endpoint) ────────────────
@api.post("/checks", response_model=CheckResult)
async def create_check(payload: CheckRequest, user: TokenData = Depends(get_current_user)):
    start = time.time()

    # Auto-split name if components not provided
    first_name = payload.first_name
    paternal_surname = payload.paternal_surname
    maternal_surname = payload.maternal_surname
    if not first_name and payload.full_name:
        parts = payload.full_name.split()
        if len(parts) >= 3:
            first_name = " ".join(parts[:-2])
            paternal_surname = parts[-2]
            maternal_surname = parts[-1]
        elif len(parts) == 2:
            first_name = parts[0]
            paternal_surname = parts[1]
        else:
            first_name = payload.full_name

    sources_consulted = []
    flags = []
    critical_alerts = []
    modules = {}

    # 1. CURP
    curp_validation = None
    if payload.curp:
        curp_validation = validate_curp(payload.curp, payload.full_name, payload.birth_date)
        modules["curp_validation"] = curp_validation
        sources_consulted.append("Algoritmo Oficial CURP")

    # 2. RFC
    rfc_validation = None
    if payload.rfc:
        rfc_validation = validate_rfc(payload.rfc)
        modules["rfc_validation"] = rfc_validation
        sources_consulted.append("Algoritmo Oficial RFC")

    # 3. Government Intelligence
    government = {}
    if payload.include_government:
        if payload.curp:
            government["renapo"] = query_renapo(payload.curp, payload.full_name)
            sources_consulted.append("RENAPO")
        if payload.rfc:
            government["sat"] = query_sat(payload.rfc)
            sources_consulted.append("SAT")
        if payload.curp:
            government["imss"] = query_imss(curp=payload.curp)
            sources_consulted.append("IMSS")
        government["rnd"] = query_rnd(
            nombre=first_name or "",
            paterno=paternal_surname or "",
            materno=maternal_surname or "",
            fecha_nac=payload.birth_date or "",
            estado=payload.state or "Nacional",
        )
        sources_consulted.append("RND (SSPC)")
        modules["government"] = government

    # 4. Sanctions
    sanctions = None
    if payload.include_sanctions:
        sanctions = screen_sanctions(payload.full_name)
        modules["sanctions"] = sanctions
        sources_consulted.extend(["OFAC SDN", "ONU", "OpenSanctions", "PEP DB", "SAT 69-B", "DOF", "SCJN", "Interpol"])
        if sanctions["is_sanctioned"]:
            critical_alerts.append({
                "type": "SANCTIONS_MATCH",
                "severity": "CRITICAL",
                "message": f"Coincidencia en {len(sanctions['matches'])} lista(s) de sanciones",
            })

    # 5. Digital Identity
    digital_identity = {}
    if payload.include_digital_identity:
        if payload.email:
            digital_identity["email"] = enrich_email(payload.email)
            sources_consulted.extend(["HaveIBeenPwned", "Hunter.io", "Gravatar", "MX Records"])
        if payload.phone:
            digital_identity["phone"] = enrich_phone(payload.phone)
            sources_consulted.append("NumVerify")
        if payload.username:
            digital_identity["username"] = discover_username(payload.username)
            sources_consulted.append("Sherlock / Maigret")
        modules["digital_identity"] = digital_identity

    # 6. Digital Footprint
    digital_footprint = None
    if payload.include_digital_footprint:
        digital_footprint = calculate_digital_footprint(
            email_data=digital_identity.get("email"),
            username_data=digital_identity.get("username"),
        )
        modules["digital_footprint"] = digital_footprint

    # 7. Scoring
    scoring = calculate_scores(modules)
    flags.extend(scoring["flags"])

    # 8. Relationship
    relationship = None
    if payload.include_relationship:
        relationship = build_relationship_graph(
            subject_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            curp=payload.curp,
            rfc=payload.rfc,
            address=payload.address,
            username=payload.username,
            digital_profiles=(digital_identity.get("username") or {}).get("profiles", []),
            sanctions_matches=(sanctions or {}).get("matches", []),
            risk_score=scoring["risk_score"],
            risk_level=scoring["risk_level"],
        )

    # 9. Build result
    check = CheckResult(
        requested_by_id=user.user_id,
        requested_by_email=user.email,
        subject={
            "full_name": payload.full_name,
            "first_name": first_name,
            "paternal_surname": paternal_surname,
            "maternal_surname": maternal_surname,
            "curp": payload.curp,
            "rfc": payload.rfc,
            "email": payload.email,
            "phone": payload.phone,
            "username": payload.username,
            "birth_date": payload.birth_date,
            "address": payload.address,
            "state": payload.state,
        },
        request=payload.model_dump(),
        curp_validation=curp_validation,
        rfc_validation=rfc_validation,
        government=government if payload.include_government else None,
        sanctions=sanctions,
        digital_identity=digital_identity if payload.include_digital_identity else None,
        digital_footprint=digital_footprint,
        relationship=relationship,
        trust_score=scoring["trust_score"],
        risk_score=scoring["risk_score"],
        risk_level=scoring["risk_level"],
        recommendation=scoring["recommendation"],
        identity_confidence=scoring["identity_confidence"],
        flags=flags,
        critical_alerts=critical_alerts,
        sources_consulted=list(dict.fromkeys(sources_consulted)),
        processing_time_ms=(time.time() - start) * 1000,
    )

    # 10. AI Report (always sync for now — quick prompt)
    if payload.include_ai_report:
        try:
            check.ai_report = await generate_investigation_report(check.model_dump())
        except Exception as e:
            logger.error(f"AI report failed: {e}")
            check.ai_report = None

    # 11. Save
    doc = check.model_dump()
    await db.checks.insert_one({**doc, "_search_name": payload.full_name.lower()})
    logger.info(f"Check {check.id} | Risk={check.risk_level} ({check.risk_score}) | Trust={check.trust_score}")

    return check


@api.get("/checks", response_model=List[CheckResult])
async def list_checks(
    q: Optional[str] = None,
    risk_level: Optional[str] = None,
    limit: int = Query(50, le=200),
    user: TokenData = Depends(get_current_user),
):
    query = {}
    if user.role == "viewer":
        query["requested_by_id"] = user.user_id
    if q:
        query["_search_name"] = {"$regex": q.lower(), "$options": "i"}
    if risk_level:
        query["risk_level"] = risk_level.upper()

    items = await db.checks.find(query, {"_id": 0, "_search_name": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items


@api.get("/checks/{check_id}", response_model=CheckResult)
async def get_check(check_id: str, user: TokenData = Depends(get_current_user)):
    doc = await db.checks.find_one({"id": check_id}, {"_id": 0, "_search_name": 0})
    if not doc:
        raise HTTPException(404, "Check no encontrado")
    return doc


@api.delete("/checks/{check_id}")
async def delete_check(check_id: str, user: TokenData = Depends(require_role("admin", "analyst"))):
    res = await db.checks.delete_one({"id": check_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Check no encontrado")
    return {"deleted": True}


# ──────────────── ANALYTICS ────────────────
@api.get("/analytics/dashboard")
async def analytics_dashboard(user: TokenData = Depends(get_current_user)):
    total = await db.checks.count_documents({})
    by_level = {}
    for lvl in ["BAJO", "MEDIO", "ALTO", "CRITICO"]:
        by_level[lvl] = await db.checks.count_documents({"risk_level": lvl})

    by_recommendation = {}
    for rec in ["APPROVE", "REVIEW", "REJECT"]:
        by_recommendation[rec] = await db.checks.count_documents({"recommendation": rec})

    # Trust score avg (compute in python from sample)
    sample = await db.checks.find({}, {"_id": 0, "trust_score": 1, "risk_score": 1, "created_at": 1, "subject": 1, "risk_level": 1, "id": 1, "recommendation": 1}).sort("created_at", -1).limit(500).to_list(500)
    avg_trust = round(sum(s.get("trust_score", 0) for s in sample) / len(sample), 1) if sample else 0
    avg_risk = round(sum(s.get("risk_score", 0) for s in sample) / len(sample), 1) if sample else 0

    sanctioned_count = await db.checks.count_documents({"sanctions.is_sanctioned": True})
    pep_count = await db.checks.count_documents({"sanctions.is_pep": True})

    # Trend: count by day for last 14 days
    from collections import defaultdict
    trend = defaultdict(int)
    for s in sample:
        day = (s.get("created_at") or "")[:10]
        if day:
            trend[day] += 1
    trend_data = [{"date": d, "count": c} for d, c in sorted(trend.items())[-14:]]

    return {
        "total_checks": total,
        "average_trust_score": avg_trust,
        "average_risk_score": avg_risk,
        "risk_distribution": by_level,
        "recommendation_distribution": by_recommendation,
        "sanctions_matches": sanctioned_count,
        "pep_matches": pep_count,
        "trend_14_days": trend_data,
        "recent_checks": sample[:8],
    }


# Mount router & CORS
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
