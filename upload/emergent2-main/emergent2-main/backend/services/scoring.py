"""Risk Intelligence Engine.
Computes:
  - Trust Score (0-100): positive signals
  - Risk Score (0-100): negative signals
  - Identity Confidence (0-100)
  - Recommendation: APPROVE | REVIEW | REJECT
"""
from typing import Dict, Any, Optional


def calculate_scores(modules: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate Trust Score, Risk Score, Identity Confidence and Recommendation."""
    trust = 0
    risk = 0
    flags = []
    breakdown = {"trust_components": [], "risk_components": []}

    # ──────────────── CURP ────────────────
    curp_v = modules.get("curp_validation")
    if curp_v:
        if curp_v.get("is_valid"):
            trust += 20
            breakdown["trust_components"].append({"label": "CURP válido (RENAPO)", "points": 20})
        else:
            risk += 25
            breakdown["risk_components"].append({"label": "CURP inválida", "points": 25})
            flags.append("CURP inválida o con dígito verificador incorrecto")

    # ──────────────── RFC ────────────────
    rfc_v = modules.get("rfc_validation")
    if rfc_v:
        if rfc_v.get("is_valid"):
            trust += 15
            breakdown["trust_components"].append({"label": "RFC válido", "points": 15})
            sat_status = (rfc_v.get("sat_status") or "").upper()
            if sat_status == "ACTIVO":
                trust += 15
                breakdown["trust_components"].append({"label": "SAT activo", "points": 15})
            elif sat_status == "SUSPENDIDO":
                risk += 20
                breakdown["risk_components"].append({"label": "RFC suspendido en SAT", "points": 20})
                flags.append("RFC suspendido en SAT")
        else:
            risk += 15
            breakdown["risk_components"].append({"label": "RFC inválido", "points": 15})

    # ──────────────── Government ────────────────
    gov = modules.get("government") or {}
    renapo = gov.get("renapo")
    if renapo and renapo.get("found") and renapo.get("registry_status") == "VIGENTE":
        trust += 10
        breakdown["trust_components"].append({"label": "Registro RENAPO vigente", "points": 10})

    rnd = gov.get("rnd")
    if rnd and not rnd.get("sin_resultados") and rnd.get("found"):
        risk += 60
        breakdown["risk_components"].append({"label": "Registro en RND (Detenciones)", "points": 60})
        flags.append("Detención registrada en el Registro Nacional de Detenciones")

    # ──────────────── Sanctions ────────────────
    sanc = modules.get("sanctions")
    if sanc:
        if sanc.get("is_sanctioned"):
            risk = 100  # auto critical
            breakdown["risk_components"].append({"label": "Match en lista de sanciones", "points": 100})
            flags.append("Coincidencia en listas de sanciones (OFAC/ONU/Interpol)")
        elif sanc.get("is_pep"):
            risk += 25
            breakdown["risk_components"].append({"label": "Persona Expuesta Políticamente (PEP)", "points": 25})
            flags.append("Persona Expuesta Políticamente (PEP)")
        else:
            trust += 20
            breakdown["trust_components"].append({"label": "Sin coincidencias en listas restringidas", "points": 20})

    # ──────────────── Digital Identity ────────────────
    di = modules.get("digital_identity") or {}
    email = di.get("email")
    if email:
        if email.get("is_disposable"):
            risk += 25
            breakdown["risk_components"].append({"label": "Email desechable", "points": 25})
            flags.append("Email desechable detectado")
        elif email.get("is_corporate_business"):
            trust += 5
            breakdown["trust_components"].append({"label": "Email corporativo propio", "points": 5})
        breach_count = email.get("breach_count", 0)
        if breach_count >= 5:
            risk += 15
            breakdown["risk_components"].append({"label": f"{breach_count} brechas de datos", "points": 15})

    phone = di.get("phone")
    if phone and phone.get("is_spam_reported"):
        risk += 15
        breakdown["risk_components"].append({"label": "Teléfono reportado como spam", "points": 15})
        flags.append("Teléfono con reportes de spam")

    # ──────────────── Digital Footprint ────────────────
    df = modules.get("digital_footprint")
    if df:
        presence = df.get("presence_score", 0)
        if presence >= 60:
            trust += 10
            breakdown["trust_components"].append({"label": "Presencia digital consistente", "points": 10})
        if df.get("professional_presence"):
            trust += 5
            breakdown["trust_components"].append({"label": "Presencia profesional (LinkedIn)", "points": 5})
        if df.get("developer_profiles_count", 0) > 0:
            trust += 5
            breakdown["trust_components"].append({"label": "Perfiles de desarrollador (GitHub)", "points": 5})

    # Clamp
    trust = max(0, min(100, trust))
    risk = max(0, min(100, risk))

    # Identity Confidence: based on number of validated signals
    signals_validated = sum([
        bool(curp_v and curp_v.get("is_valid")),
        bool(rfc_v and rfc_v.get("is_valid")),
        bool(renapo and renapo.get("found")),
        bool(email and not email.get("is_disposable") and email.get("is_valid")),
        bool(phone and phone.get("is_valid") and not phone.get("is_spam_reported")),
        bool(df and df.get("presence_score", 0) >= 40),
        bool(sanc and not sanc.get("is_sanctioned")),
    ])
    identity_confidence = round(min(100, signals_validated * 14 + (10 if trust >= 60 else 0)), 1)

    # Level + recommendation
    if risk >= 70:
        level = "CRITICO"
        recommendation = "REJECT"
    elif risk >= 40:
        level = "ALTO"
        recommendation = "REVIEW"
    elif risk >= 20:
        level = "MEDIO"
        recommendation = "REVIEW"
    else:
        level = "BAJO"
        recommendation = "APPROVE"

    return {
        "trust_score": round(trust, 1),
        "risk_score": round(risk, 1),
        "identity_confidence": identity_confidence,
        "risk_level": level,
        "recommendation": recommendation,
        "flags": flags,
        "breakdown": breakdown,
    }
