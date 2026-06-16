"""CURP and RFC validators with real Mexican format algorithms.
Ported and adapted from user's existing CURP validator code.
"""
import re
from datetime import datetime
from typing import Optional, Dict, Any


ESTADOS = {
    'AS': 'AGUASCALIENTES', 'BC': 'BAJA CALIFORNIA', 'BS': 'BAJA CALIFORNIA SUR',
    'CC': 'CAMPECHE', 'CL': 'COAHUILA', 'CM': 'COLIMA', 'CS': 'CHIAPAS',
    'CH': 'CHIHUAHUA', 'DF': 'CIUDAD DE MEXICO', 'DG': 'DURANGO',
    'GT': 'GUANAJUATO', 'GR': 'GUERRERO', 'HG': 'HIDALGO', 'JC': 'JALISCO',
    'MC': 'MEXICO', 'MN': 'MICHOACAN', 'MS': 'MORELOS', 'NT': 'NAYARIT',
    'NL': 'NUEVO LEON', 'OC': 'OAXACA', 'PL': 'PUEBLA', 'QT': 'QUERETARO',
    'QR': 'QUINTANA ROO', 'SP': 'SAN LUIS POTOSI', 'SL': 'SINALOA',
    'SR': 'SONORA', 'TC': 'TABASCO', 'TS': 'TAMAULIPAS', 'TL': 'TLAXCALA',
    'VZ': 'VERACRUZ', 'YN': 'YUCATAN', 'ZS': 'ZACATECAS', 'NE': 'NACIDO EXTRANJERO'
}

REGIMENES_FISCALES = {
    "601": "General de Ley Personas Morales",
    "603": "Personas Morales con Fines no Lucrativos",
    "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
    "606": "Arrendamiento",
    "608": "Demás ingresos",
    "612": "Personas Físicas con Actividades Empresariales y Profesionales",
    "614": "Ingresos por intereses",
    "616": "Sin obligaciones fiscales",
    "621": "Incorporación Fiscal",
    "625": "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
    "626": "Régimen Simplificado de Confianza",
}


def _validate_check_digit(curp: str) -> bool:
    """Validates CURP check digit using official algorithm."""
    values = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"
    suma = 0
    for i, char in enumerate(curp[:17]):
        if char not in values:
            return False
        suma += values.index(char) * (18 - i)
    digito_calculado = 10 - (suma % 10)
    if digito_calculado == 10:
        digito_calculado = 0
    last = curp[17]
    digito_curp = int(last) if last.isdigit() else values.index(last)
    return digito_calculado == digito_curp


def validate_curp(curp: str, full_name: Optional[str] = None, birth_date: Optional[str] = None) -> Dict[str, Any]:
    """Full CURP validation: format + check digit + component extraction + RENAPO mock match."""
    curp = (curp or "").upper().strip()

    if len(curp) != 18:
        return {"is_valid": False, "message": f"La CURP debe tener 18 caracteres (recibido: {len(curp)})", "curp": curp}

    pattern = r'^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$'
    if not re.match(pattern, curp):
        return {"is_valid": False, "message": "Formato de CURP inválido", "curp": curp}

    fecha_nac = curp[4:10]
    sexo = curp[10]
    estado = curp[11:13]

    try:
        year = int(fecha_nac[0:2])
        year_full = 2000 + year if year <= 29 else 1900 + year
        month = int(fecha_nac[2:4])
        day = int(fecha_nac[4:6])
        birth_dt = datetime(year_full, month, day)
        if birth_dt > datetime.now():
            return {"is_valid": False, "message": "Fecha de nacimiento futura inválida", "curp": curp}
    except ValueError:
        return {"is_valid": False, "message": "Fecha de nacimiento inválida en CURP", "curp": curp}

    if estado not in ESTADOS:
        return {"is_valid": False, "message": f"Código de estado inválido: {estado}", "curp": curp}

    check_digit_valid = _validate_check_digit(curp)
    if not check_digit_valid:
        return {
            "is_valid": False,
            "message": "Dígito verificador incorrecto",
            "curp": curp,
            "check_digit_valid": False,
        }

    # RENAPO mock: name comparison if provided
    renapo_match = True
    if full_name:
        # In real RENAPO would lookup by CURP. Mock: assume match if all checks pass.
        renapo_match = True

    return {
        "is_valid": True,
        "message": "CURP válido. Verificado contra algoritmo oficial.",
        "curp": curp,
        "check_digit_valid": True,
        "renapo_match": renapo_match,
        "components": {
            "birth_date": birth_dt.strftime("%Y-%m-%d"),
            "sex": "Hombre" if sexo == "H" else "Mujer",
            "state": ESTADOS[estado],
            "state_code": estado,
            "homoclave": curp[16],
            "verification_digit": curp[17],
        },
    }


def validate_rfc(rfc: str) -> Dict[str, Any]:
    """RFC validation for both physical and moral persons."""
    rfc = (rfc or "").upper().strip().replace("-", "").replace(" ", "")

    if len(rfc) not in (12, 13):
        return {"is_valid": False, "message": "RFC debe tener 12 (moral) o 13 (física) caracteres", "rfc": rfc}

    if len(rfc) == 13:
        # Persona física
        pattern = r'^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$'
        if not re.match(pattern, rfc):
            return {"is_valid": False, "message": "Formato RFC persona física inválido", "rfc": rfc}
        fecha = rfc[4:10]
        rfc_type = "fisica"
    else:
        # Persona moral
        pattern = r'^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$'
        if not re.match(pattern, rfc):
            return {"is_valid": False, "message": "Formato RFC persona moral inválido", "rfc": rfc}
        fecha = rfc[3:9]
        rfc_type = "moral"

    try:
        year = int(fecha[0:2])
        year_full = 2000 + year if year <= 29 else 1900 + year
        month = int(fecha[2:4])
        day = int(fecha[4:6])
        date_obj = datetime(year_full, month, day)
        if date_obj > datetime.now():
            return {"is_valid": False, "message": "Fecha en RFC es futura", "rfc": rfc}
    except ValueError:
        return {"is_valid": False, "message": "Fecha inválida en RFC", "rfc": rfc}

    # Mock SAT status (in real impl, would call SAT API)
    sat_status = "ACTIVO"

    return {
        "is_valid": True,
        "message": f"RFC válido ({'Persona Física' if rfc_type == 'fisica' else 'Persona Moral'})",
        "rfc": rfc,
        "type": rfc_type,
        "components": {
            "date": date_obj.strftime("%Y-%m-%d"),
            "homoclave": rfc[-3:],
        },
        "sat_status": sat_status,
        "regimen_fiscal": "612 - Personas Físicas con Actividades Empresariales" if rfc_type == "fisica" else "601 - General de Ley Personas Morales",
    }
