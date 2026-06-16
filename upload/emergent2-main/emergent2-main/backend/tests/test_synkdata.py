"""Backend tests for SynkData Identity Intelligence Platform."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://risk-engine-23.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@synkdata.mx"
ADMIN_PASS = "Admin2026!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ──────── HEALTH ────────
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_root():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert "SynkData" in r.json()["service"]


# ──────── AUTH ────────
def test_login_invalid_credentials():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"}, timeout=10)
    assert r.status_code == 401


def test_auth_me_with_token(auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "admin"


def test_auth_me_without_token():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code in (401, 403)


def test_auth_me_invalid_token():
    r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid.token.here"}, timeout=10)
    assert r.status_code == 401


def test_register_new_user():
    unique_email = f"test_{int(time.time()*1000)}@synkdata.mx"
    payload = {
        "full_name": "TEST User",
        "email": unique_email,
        "password": "TestPass123!",
        "role": "analyst",
        "organization": "TEST",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == unique_email
    # Duplicate should fail
    r2 = requests.post(f"{API}/auth/register", json=payload, timeout=10)
    assert r2.status_code == 400


# ──────── IDENTITY ────────
def test_curp_invalid_format(auth_headers):
    r = requests.post(f"{API}/identity/curp", json={"curp": "INVALID"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["is_valid"] is False


def test_curp_bad_check_digit(auth_headers):
    # Valid format but wrong check digit
    r = requests.post(f"{API}/identity/curp", json={"curp": "LOHJ850315HDFPRN03"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "is_valid" in data
    assert "message" in data


def test_rfc_valid_persona_fisica(auth_headers):
    r = requests.post(f"{API}/identity/rfc", json={"rfc": "LOHJ850315A12"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "is_valid" in data
    assert "type" in data or "message" in data


def test_rfc_invalid(auth_headers):
    r = requests.post(f"{API}/identity/rfc", json={"rfc": "XX"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["is_valid"] is False


# ──────── SANCTIONS ────────
def test_sanctions_el_chapo(auth_headers):
    r = requests.post(f"{API}/sanctions/screen", json={"full_name": "Joaquin Guzman Loera", "threshold": 80}, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["is_sanctioned"] is True
    assert len(data["matches"]) >= 1


def test_sanctions_amlo_is_pep(auth_headers):
    r = requests.post(f"{API}/sanctions/screen", json={"full_name": "Andres Manuel Lopez Obrador", "threshold": 80}, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["is_pep"] is True


def test_sanctions_random_name(auth_headers):
    r = requests.post(f"{API}/sanctions/screen", json={"full_name": "Nombre Aleatorio Inexistente XYZQRS", "threshold": 85}, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["is_sanctioned"] is False
    assert data["is_pep"] is False


def test_sanctions_lists_public():
    r = requests.get(f"{API}/sanctions/lists", timeout=10)
    assert r.status_code == 200
    assert "lists" in r.json()


# ──────── BACKGROUND CHECK (master) ────────
@pytest.fixture(scope="session")
def created_check(auth_headers):
    payload = {
        "full_name": "Juan Carlos Lopez Hernandez",
        "curp": "LOHJ850315HDFPRN03",
        "rfc": "LOHJ850315A12",
        "email": "juan@example.com",
        "phone": "+525512345678",
        "username": "juanlopez",
        "birth_date": "15/03/1985",
        "include_ai_report": True,
    }
    r = requests.post(f"{API}/checks", json=payload, headers=auth_headers, timeout=90)
    assert r.status_code == 200, f"Check creation failed: {r.status_code} {r.text[:500]}"
    return r.json()


def test_check_master_create(created_check):
    data = created_check
    assert "id" in data
    assert "trust_score" in data
    assert "risk_score" in data
    assert "recommendation" in data
    assert data["recommendation"] in ("APPROVE", "REVIEW", "REJECT")
    assert isinstance(data["sources_consulted"], list) and len(data["sources_consulted"]) > 0
    assert data["relationship"] is not None
    assert "graph" in data["relationship"]
    assert "nodes" in data["relationship"]["graph"]
    assert "edges" in data["relationship"]["graph"]


def test_check_ai_report(created_check):
    ai = created_check.get("ai_report")
    assert ai is not None, "AI report missing — Claude/Emergent integration may have failed"
    assert isinstance(ai, str)
    assert len(ai) > 500, f"AI report too short: {len(ai)} chars"


def test_check_persisted_get(auth_headers, created_check):
    cid = created_check["id"]
    r = requests.get(f"{API}/checks/{cid}", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["id"] == cid


def test_check_list(auth_headers, created_check):
    r = requests.get(f"{API}/checks?limit=20", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert any(c["id"] == created_check["id"] for c in items)


def test_check_list_search_q(auth_headers, created_check):
    r = requests.get(f"{API}/checks?q=Juan", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    items = r.json()
    assert any("juan" in (c.get("subject", {}).get("full_name", "").lower()) for c in items)


def test_check_list_risk_level_filter(auth_headers):
    r = requests.get(f"{API}/checks?risk_level=BAJO", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    for c in r.json():
        assert c["risk_level"] == "BAJO"


# ──────── ANALYTICS ────────
def test_analytics_dashboard(auth_headers):
    r = requests.get(f"{API}/analytics/dashboard", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    for key in ["total_checks", "average_trust_score", "average_risk_score",
                "risk_distribution", "recommendation_distribution",
                "sanctions_matches", "pep_matches", "trend_14_days", "recent_checks"]:
        assert key in data, f"Missing key {key}"
    assert isinstance(data["risk_distribution"], dict)
    assert isinstance(data["trend_14_days"], list)


# ──────── DIGITAL ────────
def test_digital_email(auth_headers):
    r = requests.post(f"{API}/digital/email", json={"email": "test@example.com"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200


def test_digital_phone(auth_headers):
    r = requests.post(f"{API}/digital/phone", json={"phone": "+525512345678"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200


def test_digital_username(auth_headers):
    r = requests.post(f"{API}/digital/username", json={"username": "juanlopez"}, headers=auth_headers, timeout=10)
    assert r.status_code == 200
