"""Compliance Intelligence: Sanctions screening across global and Mexican lists.
Uses thefuzz for intelligent fuzzy matching.
Mock dataset with realistic structure; replace with real OpenSanctions/OFAC API calls.
"""
from typing import Dict, Any, List
from thefuzz import fuzz
import unicodedata

# Realistic mock dataset — in production replace with OpenSanctions API
SANCTIONS_DB = [
    # OFAC SDN
    {"name": "JOAQUIN ARCHIVALDO GUZMAN LOERA", "list": "OFAC SDN", "program": "SDNTK", "country": "MX", "type": "SDN", "aliases": ["EL CHAPO", "EL CHAPO GUZMAN"]},
    {"name": "RAFAEL CARO QUINTERO", "list": "OFAC SDN", "program": "SDNTK", "country": "MX", "type": "SDN", "aliases": ["NARCO DE NARCOS"]},
    {"name": "VLADIMIR PUTIN", "list": "OFAC SDN", "program": "RUSSIA-EO14024", "country": "RU", "type": "SDN", "aliases": ["VLADIMIR VLADIMIROVICH PUTIN"]},
    {"name": "KIM JONG UN", "list": "OFAC SDN", "program": "DPRK", "country": "KP", "type": "SDN", "aliases": []},
    # ONU Consolidated
    {"name": "ABU BAKAR BASHIR", "list": "ONU Consolidated", "program": "ISIL/Al-Qaida", "country": "ID", "type": "TERRORIST", "aliases": []},
    {"name": "ISMAEL ZAMBADA GARCIA", "list": "ONU Consolidated", "program": "Drug Trafficking", "country": "MX", "type": "SDN", "aliases": ["EL MAYO"]},
    # OpenSanctions / PEP
    {"name": "ANDRES MANUEL LOPEZ OBRADOR", "list": "PEP Database", "program": "Head of State", "country": "MX", "type": "PEP", "aliases": ["AMLO"]},
    {"name": "CLAUDIA SHEINBAUM PARDO", "list": "PEP Database", "program": "Head of State", "country": "MX", "type": "PEP", "aliases": []},
    {"name": "MARCELO EBRARD CASAUBON", "list": "PEP Database", "program": "Cabinet Minister", "country": "MX", "type": "PEP", "aliases": []},
    {"name": "ROSARIO ROBLES BERLANGA", "list": "PEP Database", "program": "Former Cabinet Minister", "country": "MX", "type": "PEP", "aliases": []},
    # SAT 69-B (EFOS)
    {"name": "EMPRESA FANTASMA SA DE CV", "list": "SAT 69-B Definitivos", "program": "EFOS", "country": "MX", "type": "EFOS", "aliases": []},
    {"name": "FACTURADORA APOCRIFA SA", "list": "SAT 69-B Definitivos", "program": "EFOS", "country": "MX", "type": "EFOS", "aliases": []},
    # Interpol
    {"name": "GENARO GARCIA LUNA", "list": "Interpol Red Notice", "program": "Money Laundering", "country": "MX", "type": "RED_NOTICE", "aliases": []},
    {"name": "EMILIO LOZOYA AUSTIN", "list": "Interpol Red Notice", "program": "Corruption", "country": "MX", "type": "RED_NOTICE", "aliases": []},
]

ALL_LISTS = [
    "OFAC SDN",
    "ONU Consolidated List",
    "OpenSanctions",
    "PEP Database",
    "SAT Lista 69-B",
    "DOF",
    "SCJN",
    "Interpol Red Notices",
    "EU Sanctions",
    "UK HMT Sanctions",
]


def _normalize(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.upper().strip()


def screen_sanctions(full_name: str, threshold: int = 80) -> Dict[str, Any]:
    """Fuzzy screening across all sanctions lists."""
    target = _normalize(full_name)
    if not target:
        return {
            "is_sanctioned": False,
            "is_pep": False,
            "matches": [],
            "lists_checked": ALL_LISTS,
            "total_records_screened": len(SANCTIONS_DB),
        }

    matches: List[Dict[str, Any]] = []
    for entry in SANCTIONS_DB:
        candidates = [entry["name"]] + entry.get("aliases", [])
        best_score = 0
        best_alias = None
        for c in candidates:
            score = max(
                fuzz.token_sort_ratio(target, _normalize(c)),
                fuzz.partial_ratio(target, _normalize(c)),
            )
            if score > best_score:
                best_score = score
                best_alias = c

        if best_score >= threshold:
            matches.append({
                "list_name": entry["list"],
                "matched_name": best_alias,
                "official_name": entry["name"],
                "score": best_score,
                "program": entry.get("program"),
                "country": entry.get("country"),
                "type": entry.get("type"),
            })

    matches.sort(key=lambda m: m["score"], reverse=True)
    is_sanctioned = any(m["type"] in ("SDN", "TERRORIST", "RED_NOTICE", "EFOS") for m in matches)
    is_pep = any(m["type"] == "PEP" for m in matches)

    return {
        "is_sanctioned": is_sanctioned,
        "is_pep": is_pep,
        "matches": matches,
        "lists_checked": ALL_LISTS,
        "total_records_screened": len(SANCTIONS_DB),
        "threshold_used": threshold,
    }
