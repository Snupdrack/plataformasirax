"""AI Investigation Engine using Claude Sonnet 4.5 via Emergent LLM Key.
Generates professional Identity Intelligence reports in Spanish.
"""
import os
import json
from typing import Dict, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

SYSTEM_PROMPT = """Eres SynkData AI, un analista experto en Identity Intelligence, Background Checks, KYC/AML y Risk Intelligence para México y Latinoamérica.

Tu tarea es generar un REPORTE DE INVESTIGACIÓN profesional en ESPAÑOL para un sujeto verificado por la plataforma SynkData. El reporte debe ser:

- Conciso y autoritativo (máximo 400 palabras)
- Estructurado en secciones claramente delimitadas con encabezados markdown (## sección)
- Basado únicamente en los hallazgos proporcionados (no inventes datos)
- Profesional, en tono de analista de inteligencia/compliance
- Con recomendación final clara

ESTRUCTURA OBLIGATORIA del reporte:
## Resumen Ejecutivo
(2-3 oraciones con la conclusión clave)

## Hallazgos de Identidad
(CURP, RFC, datos gubernamentales)

## Cumplimiento y Sanciones
(Resultado del screening contra OFAC, ONU, PEP, SAT 69-B, etc.)

## Inteligencia Digital
(Email, teléfono, huella digital, presencia profesional)

## Análisis de Riesgo
(Trust Score, Risk Score, factores positivos y negativos)

## Recomendación
(APROBAR / REVISAR / RECHAZAR con justificación)

No uses emojis. Usa terminología técnica de compliance (KYC, AML, PEP, EFOS, etc.) cuando aplique."""


async def generate_investigation_report(check_data: Dict[str, Any]) -> str:
    """Generate an AI investigation report from the check results."""
    # Build a clean summary of findings for the LLM
    summary = {
        "sujeto": check_data.get("subject", {}),
        "trust_score": check_data.get("trust_score"),
        "risk_score": check_data.get("risk_score"),
        "risk_level": check_data.get("risk_level"),
        "identity_confidence": check_data.get("identity_confidence"),
        "recommendation": check_data.get("recommendation"),
        "flags": check_data.get("flags", []),
        "curp_validation": check_data.get("curp_validation"),
        "rfc_validation": check_data.get("rfc_validation"),
        "government": check_data.get("government"),
        "sanctions_summary": {
            "is_sanctioned": (check_data.get("sanctions") or {}).get("is_sanctioned"),
            "is_pep": (check_data.get("sanctions") or {}).get("is_pep"),
            "match_count": len((check_data.get("sanctions") or {}).get("matches", [])),
            "matches_top": (check_data.get("sanctions") or {}).get("matches", [])[:3],
        },
        "digital_identity": check_data.get("digital_identity"),
        "digital_footprint": {
            "presence_score": (check_data.get("digital_footprint") or {}).get("presence_score"),
            "social_count": (check_data.get("digital_footprint") or {}).get("social_profiles_count"),
            "developer_count": (check_data.get("digital_footprint") or {}).get("developer_profiles_count"),
            "professional": (check_data.get("digital_footprint") or {}).get("professional_presence"),
        },
        "sources_consulted": check_data.get("sources_consulted", []),
    }

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"report_{check_data.get('id', 'new')}",
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_msg = UserMessage(
        text=f"Genera el reporte de investigación basado en los siguientes hallazgos:\n\n```json\n{json.dumps(summary, ensure_ascii=False, indent=2, default=str)}\n```"
    )

    try:
        response = await chat.send_message(user_msg)
        return response if isinstance(response, str) else str(response)
    except Exception as e:
        return f"## Resumen Ejecutivo\n\nNo se pudo generar el reporte automático con IA. Error: {str(e)}\n\nPor favor consulte los datos individuales del check para análisis manual."
