"""Digital Identity & Digital Footprint Intelligence.
Email, Phone, Username intelligence + social profile discovery.
Realistic mock implementations using deterministic hashing for consistent demo data.
"""
import re
import hashlib
import random
from typing import Dict, Any, Optional, List


DISPOSABLE_DOMAINS = {
    "tempmail.com", "10minutemail.com", "guerrillamail.com", "mailinator.com",
    "throwawaymail.com", "yopmail.com", "fakemailgenerator.com", "trashmail.com",
}

CORPORATE_DOMAINS = {
    "gmail.com": ("Google", "consumer"),
    "outlook.com": ("Microsoft", "consumer"),
    "hotmail.com": ("Microsoft", "consumer"),
    "yahoo.com": ("Yahoo", "consumer"),
    "icloud.com": ("Apple", "consumer"),
    "protonmail.com": ("Proton", "privacy"),
}

MX_CARRIERS = ["Telcel", "AT&T México", "Movistar", "Bait", "Virgin Mobile"]
SOCIAL_PLATFORMS = [
    "GitHub", "GitLab", "LinkedIn", "X (Twitter)", "Facebook", "Instagram",
    "Reddit", "TikTok", "Telegram", "Discord", "Medium", "Dev.to",
    "Stack Overflow", "Behance", "Dribbble",
]


def _seed(s: str) -> random.Random:
    h = int(hashlib.md5(s.encode()).hexdigest(), 16)
    return random.Random(h)


def enrich_email(email: str) -> Dict[str, Any]:
    """Email intelligence: HIBP-style breaches, disposable detection, domain analysis."""
    if not email or "@" not in email:
        return {"is_valid": False, "email": email}

    local, domain = email.lower().rsplit("@", 1)
    rng = _seed(email)

    is_disposable = domain in DISPOSABLE_DOMAINS
    is_corporate_consumer = domain in CORPORATE_DOMAINS
    is_corporate_business = not is_corporate_consumer and not is_disposable and "." in domain

    breach_count = rng.randint(0, 8) if not is_disposable else rng.randint(3, 15)
    breach_sources = []
    if breach_count > 0:
        possible = ["LinkedIn (2021)", "Adobe (2013)", "Dropbox (2012)", "Canva (2019)",
                    "Collection #1", "MyHeritage (2018)", "MyFitnessPal (2018)", "Mexico Voter DB (2016)"]
        breach_sources = rng.sample(possible, min(breach_count, len(possible)))

    has_gravatar = rng.random() > 0.6
    mx_records_valid = not is_disposable

    risk_score = 0
    if is_disposable:
        risk_score += 60
    if breach_count >= 5:
        risk_score += 30
    elif breach_count >= 2:
        risk_score += 15
    if not mx_records_valid:
        risk_score += 25
    risk_score = min(100, risk_score)

    return {
        "email": email,
        "is_valid": True,
        "domain": domain,
        "is_disposable": is_disposable,
        "is_corporate_business": is_corporate_business,
        "is_corporate_consumer": is_corporate_consumer,
        "provider": CORPORATE_DOMAINS.get(domain, ("Custom Domain", "business"))[0],
        "mx_records_valid": mx_records_valid,
        "deliverable": mx_records_valid,
        "breach_count": breach_count,
        "breach_sources": breach_sources,
        "has_gravatar": has_gravatar,
        "risk_score": risk_score,
        "risk_level": "ALTO" if risk_score >= 60 else "MEDIO" if risk_score >= 30 else "BAJO",
        "sources": ["HaveIBeenPwned", "Hunter.io", "Gravatar", "DNS MX Records"],
    }


def enrich_phone(phone: str) -> Dict[str, Any]:
    """Phone intelligence: carrier lookup, line type, spam reputation."""
    if not phone:
        return {"is_valid": False, "phone": phone}

    clean = re.sub(r"\D", "", phone)
    rng = _seed(clean)

    if not (10 <= len(clean) <= 13):
        return {"is_valid": False, "phone": phone, "message": "Longitud inválida"}

    country_code = "+52" if not clean.startswith("1") else "+1"
    is_mx = country_code == "+52"
    carrier = rng.choice(MX_CARRIERS) if is_mx else "Unknown US Carrier"
    line_types = ["MOBILE", "MOBILE", "MOBILE", "LANDLINE", "VOIP"]
    line_type = rng.choice(line_types)
    is_spam = rng.random() < 0.08

    risk_score = 0
    if is_spam:
        risk_score += 60
    if line_type == "VOIP":
        risk_score += 20
    risk_score = min(100, risk_score)

    return {
        "phone": phone,
        "is_valid": True,
        "country_code": country_code,
        "country": "México" if is_mx else "Estados Unidos",
        "carrier": carrier,
        "line_type": line_type,
        "is_spam_reported": is_spam,
        "spam_reports": rng.randint(50, 800) if is_spam else 0,
        "risk_score": risk_score,
        "risk_level": "ALTO" if risk_score >= 60 else "MEDIO" if risk_score >= 30 else "BAJO",
        "sources": ["NumVerify", "Truecaller Reputation", "ShouldIAnswer"],
    }


def discover_username(username: str) -> Dict[str, Any]:
    """Username Intelligence (Sherlock/Maigret/WhatsMyName style)."""
    if not username:
        return {"username": username, "found": False}

    rng = _seed(username.lower())
    found_count = rng.randint(2, 9)
    found_platforms = rng.sample(SOCIAL_PLATFORMS, found_count)

    profiles = []
    for p in found_platforms:
        url_map = {
            "GitHub": f"https://github.com/{username}",
            "GitLab": f"https://gitlab.com/{username}",
            "LinkedIn": f"https://linkedin.com/in/{username}",
            "X (Twitter)": f"https://x.com/{username}",
            "Reddit": f"https://reddit.com/user/{username}",
            "Instagram": f"https://instagram.com/{username}",
            "TikTok": f"https://tiktok.com/@{username}",
            "Telegram": f"https://t.me/{username}",
            "Discord": f"https://discord.com/users/{username}",
            "Medium": f"https://medium.com/@{username}",
            "Dev.to": f"https://dev.to/{username}",
            "Stack Overflow": f"https://stackoverflow.com/users/{username}",
        }
        profiles.append({
            "platform": p,
            "url": url_map.get(p, f"https://{p.lower().replace(' (twitter)', '').replace(' ', '')}.com/{username}"),
            "verified": rng.random() > 0.7,
            "last_active": f"2025-{rng.randint(1,12):02d}-{rng.randint(1,28):02d}",
        })

    return {
        "username": username,
        "found": True,
        "profile_count": len(profiles),
        "profiles": profiles,
        "tools_used": ["Sherlock", "Maigret", "WhatsMyName"],
    }


def calculate_digital_footprint(
    email_data: Optional[Dict] = None,
    username_data: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Aggregate digital presence score."""
    social_profiles = []
    developer_profiles = []
    professional_presence = False

    if username_data and username_data.get("found"):
        for p in username_data["profiles"]:
            social_profiles.append(p)
            if p["platform"] in ("GitHub", "GitLab", "Stack Overflow", "Dev.to"):
                developer_profiles.append(p)
            if p["platform"] in ("LinkedIn", "Medium"):
                professional_presence = True

    presence_score = min(100, len(social_profiles) * 9 + len(developer_profiles) * 5 + (15 if professional_presence else 0))

    return {
        "presence_score": presence_score,
        "social_profiles_count": len(social_profiles),
        "developer_profiles_count": len(developer_profiles),
        "professional_presence": professional_presence,
        "profiles": social_profiles,
        "platforms": [p["platform"] for p in social_profiles],
    }
