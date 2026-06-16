"""Government Intelligence sources mock services.
RENAPO, SAT, IMSS, RND — placeholders for user's real integrations.
These services return realistic mock data; replace internals with real API calls.
"""
from typing import Dict, Any, Optional
import hashlib
import random

# Deterministic mocking: same input → same output
def _seed(s: str) -> random.Random:
    h = int(hashlib.md5(s.encode()).hexdigest(), 16)
    return random.Random(h)


def query_renapo(curp: str, full_name: Optional[str] = None) -> Dict[str, Any]:
    """RENAPO lookup mock. Returns registration data if CURP is structurally valid."""
    if not curp or len(curp) != 18:
        return {"found": False, "message": "CURP no proporcionado o inválido", "source": "RENAPO"}
    estado_code = curp[11:13]
    return {
        "found": True,
        "source": "RENAPO",
        "registry_status": "VIGENTE",
        "data": {
            "curp": curp,
            "registered_name": full_name or "Nombre verificado en RENAPO",
            "birth_date": f"19{curp[4:6]}-{curp[6:8]}-{curp[8:10]}",
            "sex": "HOMBRE" if curp[10] == "H" else "MUJER",
            "nationality": "MEXICANA",
            "state_birth": estado_code,
            "document_status": "ACTIVO",
            "last_update": "2024-11-15",
        },
        "ttl_seconds": 86400,
    }


def query_sat(rfc: str) -> Dict[str, Any]:
    """SAT lookup mock (Constancia de Situación Fiscal)."""
    if not rfc:
        return {"found": False, "source": "SAT"}
    rng = _seed(rfc)
    statuses = ["ACTIVO", "ACTIVO", "ACTIVO", "SUSPENDIDO"]
    rfc_type = "MORAL" if len(rfc) == 12 else "FISICA"
    return {
        "found": True,
        "source": "SAT",
        "rfc": rfc,
        "status": rng.choice(statuses),
        "type": rfc_type,
        "regimen_fiscal": "612 - Personas Físicas con Actividades Empresariales y Profesionales" if rfc_type == "FISICA" else "601 - General de Ley Personas Morales",
        "tax_obligations": [
            "Declaración anual del ISR",
            "Declaración mensual del IVA",
            "Declaración informativa de operaciones con terceros",
        ],
        "constancia_url": f"https://siat.sat.gob.mx/app/seg/SegConstancia.aspx?rfc={rfc}",
        "registered_date": "2018-03-22",
        "last_update": "2024-12-01",
    }


def query_imss(nss: Optional[str] = None, curp: Optional[str] = None) -> Dict[str, Any]:
    """IMSS lookup mock (limited per regulations)."""
    if not nss and not curp:
        return {"found": False, "source": "IMSS"}
    rng = _seed((nss or curp) + "imss")
    return {
        "found": True,
        "source": "IMSS",
        "nss": nss or f"{rng.randint(10**10, 10**11 - 1)}",
        "status": "VIGENTE" if rng.random() > 0.15 else "BAJA",
        "weeks_contributed": rng.randint(50, 1500),
        "current_employer_registered": rng.random() > 0.3,
        "authorized_info_only": True,
        "note": "Información limitada según marco legal aplicable (LFT/LGSS).",
    }


def query_rnd(
    nombre: str,
    paterno: str,
    materno: str = "",
    fecha_nac: str = "",
    estado: str = "Nacional",
) -> Dict[str, Any]:
    """RND (Registro Nacional de Detenciones) lookup mock.
    In production: replaces with user's RNDScraper which uses requests + OCR captcha solving.
    """
    nombre_completo = f"{nombre} {paterno} {materno}".strip()
    rng = _seed(nombre_completo + estado + "rnd")
    # 95% no results (realistic for general population)
    has_records = rng.random() < 0.05

    if not has_records:
        return {
            "found": False,
            "source": "RND (SSPC)",
            "nombre_buscado": nombre_completo,
            "estado": estado,
            "sin_resultados": True,
            "message": "Sin coincidencias en el Registro Nacional de Detenciones",
        }

    return {
        "found": True,
        "source": "RND (SSPC)",
        "nombre_buscado": nombre_completo,
        "estado": estado,
        "sin_resultados": False,
        "records": [{
            "nombre": nombre_completo.upper(),
            "lugar_detencion": f"Calle Falsa 123, Col. Centro, {estado}",
            "fecha_hora": "2022-08-15 03:42",
            "autoridad_detiene": "POLICIA MUNICIPAL",
            "autoridad_resguarda": "MINISTERIO PUBLICO FEDERAL",
            "delito": "FALTA ADMINISTRATIVA",
            "estatus": "LIBERTAD",
        }],
    }
