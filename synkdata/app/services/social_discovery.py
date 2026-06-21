"""
Servicio de descubrimiento social y profesional para SynkData.

Proporciona descubrimiento integral de perfiles sociales y profesionales
incluyendo:
- Búsqueda en LinkedIn (perfiles profesionales)
- Búsqueda en GitHub (perfiles de desarrollador)
- Cálculo de puntuación profesional
- Cálculo de huella digital
- Agregación de resultados de múltiples fuentes

Características:
- Ejecución paralela de búsquedas en múltiples fuentes
- Caché en Redis para resultados repetidos
- Degradación graceful: si una fuente falla, se retorna resultado parcial
- Puntuación profesional basada en múltiples factores
- Integración con servicios de username y email intelligence
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings
from app.database import get_redis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Modelos de datos internos (dataclasses)
# ---------------------------------------------------------------------------
@dataclass
class LinkedInProfile:
    """
    Perfil de LinkedIn de una persona.

    Attributes:
        name: Nombre completo.
        headline: Título/encabezado profesional.
        company: Empresa actual.
        location: Ubicación geográfica.
        connections: Número de conexiones.
        profile_url: URL del perfil.
    """

    name: str = ""
    headline: str = ""
    company: str = ""
    location: str = ""
    connections: int = 0
    profile_url: str = ""


@dataclass
class GitHubProfile:
    """
    Perfil de GitHub de un usuario.

    Attributes:
        username: Nombre de usuario en GitHub.
        name: Nombre completo.
        bio: Biografía del perfil.
        repos: Número de repositorios públicos.
        followers: Número de seguidores.
        contributions: Contribuciones en el último año.
        languages: Lenguajes de programación principales.
        profile_url: URL del perfil.
    """

    username: str = ""
    name: str = ""
    bio: str = ""
    repos: int = 0
    followers: int = 0
    contributions: int = 0
    languages: List[str] = field(default_factory=list)
    profile_url: str = ""


@dataclass
class ProfessionalScore:
    """
    Puntuación profesional calculada a partir de perfiles encontrados.

    Attributes:
        score: Puntuación global (0-100).
        factors: Factores que contribuyen a la puntuación.
    """

    score: float = 0.0
    factors: Dict[str, float] = field(default_factory=dict)


@dataclass
class SocialDiscoveryResult:
    """
    Resultado completo del descubrimiento social y profesional.

    Attributes:
        profiles_found: Número total de perfiles encontrados.
        social_profiles: Lista de perfiles sociales.
        professional_score: Puntuación profesional.
        digital_footprint_score: Puntuación de huella digital.
        presence_score: Puntuación de presencia digital.
        linkedin_profiles: Perfiles de LinkedIn.
        github_profile: Perfil de GitHub.
        sources_summary: Resumen explícito de fuentes consultadas y estado de vinculación.
    """

    profiles_found: int = 0
    social_profiles: List[Dict[str, Any]] = field(default_factory=list)
    professional_score: ProfessionalScore = field(default_factory=ProfessionalScore)
    digital_footprint_score: float = 0.0
    presence_score: float = 0.0
    linkedin_profiles: List[LinkedInProfile] = field(default_factory=list)
    github_profile: Optional[GitHubProfile] = None
    # Nuevo: resumen explícito de fuentes para el reporte final
    sources_summary: List[Dict[str, Any]] = field(default_factory=list)



# ---------------------------------------------------------------------------
# Helper: inferir plataforma de origen a partir de la URL del resultado
# ---------------------------------------------------------------------------
_PLATFORM_PATTERNS: list[tuple[str, str]] = [
    ("instagram.com", "Instagram"),
    ("facebook.com", "Facebook"),
    ("x.com", "X (Twitter)"),
    ("twitter.com", "X (Twitter)"),
    ("linkedin.com", "LinkedIn"),
    ("tiktok.com", "TikTok"),
    ("youtube.com", "YouTube"),
    ("github.com", "GitHub"),
    ("reddit.com", "Reddit"),
    ("buholegal.com", "Buho Legal"),
    ("poderjudicial.gob.mx", "Poder Judicial MX"),
    ("anunciosjudiciales.gob.mx", "Anuncios Judiciales MX"),
    ("siger.economia.gob.mx", "SIGER Economía MX"),
    ("listaspam.com", "ListaSpam"),
    ("quienhabla.com", "QuienHabla"),
    ("teledigo.com", "TeleDigo"),
    ("responderono.com", "ResponderONo"),
    ("complaintsboard.com", "ComplaintsBoard"),
    ("apestan.com", "Apestan"),
    ("gob.mx", "Gobierno MX"),
]


def _infer_platform_from_url(url: str) -> str:
    """Devuelve el nombre de la plataforma social/fuente dada una URL."""
    url_lower = (url or "").lower()
    for pattern, name in _PLATFORM_PATTERNS:
        if pattern in url_lower:
            return name
    # Intentar extraer dominio raíz como fallback
    try:
        from urllib.parse import urlparse
        host = urlparse(url_lower).netloc
        if host.startswith("www."):
            host = host[4:]
        return host or "Web"
    except Exception:
        return "Web"


# Plataformas conocidas que siempre se consultan (aunque no retornen resultados)
_ALWAYS_CHECKED_PLATFORMS = [
    "Instagram", "Facebook", "X (Twitter)", "LinkedIn",
    "TikTok", "YouTube", "GitHub",
]


def _build_sources_summary(result: "SocialDiscoveryResult") -> List[Dict[str, Any]]:
    """
    Construye un resumen explícito de fuentes consultadas con estado de vinculación.

    Para cada plataforma importante indica:
    - platform: nombre de la plataforma
    - linked: True si se encontró presencia, False si no
    - status_label: "VINCULADO" | "NO VINCULADO"
    - url: URL del perfil encontrado (si aplica)
    - snippet: descripción o extracto (si aplica)
    - category: categoría de la fuente (social, legal, fraud, etc.)

    Returns:
        List[Dict]: Lista ordenada de fuentes con su estado.
    """
    # Indexar los perfiles encontrados por plataforma
    found_by_platform: Dict[str, List[Dict[str, Any]]] = {}
    for profile in result.social_profiles:
        platform = profile.get("platform", "Web")
        found_by_platform.setdefault(platform, []).append(profile)

    # Añadir LinkedIn de los perfiles estructurados
    for li in result.linkedin_profiles:
        if li.profile_url and not li.profile_url.startswith("https://www.linkedin.com/pub/dir"):
            found_by_platform.setdefault("LinkedIn", []).append({
                "platform": "LinkedIn",
                "url": li.profile_url,
                "name": li.name,
                "snippet": f"{li.headline} — {li.company}".strip(" —"),
                "category": "professional",
                "linked": True,
            })

    # Añadir GitHub del perfil estructurado
    if result.github_profile and result.github_profile.username:
        found_by_platform.setdefault("GitHub", []).append({
            "platform": "GitHub",
            "url": result.github_profile.profile_url,
            "name": result.github_profile.username,
            "snippet": result.github_profile.bio or "",
            "category": "developer",
            "linked": True,
        })

    summary: List[Dict[str, Any]] = []

    # 1. Plataformas siempre consultadas
    for platform in _ALWAYS_CHECKED_PLATFORMS:
        profiles = found_by_platform.get(platform, [])
        if profiles:
            for p in profiles:
                summary.append({
                    "platform": platform,
                    "linked": True,
                    "status_label": "VINCULADO",
                    "url": p.get("url", ""),
                    "snippet": p.get("snippet", ""),
                    "category": p.get("category", "social"),
                })
        else:
            summary.append({
                "platform": platform,
                "linked": False,
                "status_label": "NO VINCULADO",
                "url": "",
                "snippet": "",
                "category": "social",
            })

    # 2. Fuentes adicionales (dorks: legal, fraud, leak, corporate, spam_report)
    extra_platforms = set(found_by_platform.keys()) - set(_ALWAYS_CHECKED_PLATFORMS)
    for platform in sorted(extra_platforms):
        for p in found_by_platform[platform]:
            summary.append({
                "platform": platform,
                "linked": True,
                "status_label": "ENCONTRADO",
                "url": p.get("url", ""),
                "snippet": p.get("snippet", ""),
                "category": p.get("category", "general"),
            })

    return summary


class SocialDiscoveryService:
    """
    Servicio de descubrimiento social y profesional.

    Orquesta la búsqueda y agregación de información de una persona
    en múltiples redes sociales y plataformas profesionales, calculando
    puntuaciones de profesionalismo y huella digital.

    Características:
    - Búsqueda paralela en LinkedIn y GitHub
    - Cálculo de puntuación profesional multi-factor
    - Cálculo de huella digital
    - Caché en Redis con TTL configurable
    - Degradación graceful ante fallos de APIs
    """

    def __init__(self) -> None:
        """Inicializa el servicio con configuración del proyecto."""
        self._settings = get_settings()
        self._cache_ttl = self._settings.REDIS_CACHE_TTL
        self._http_timeout = 15.0

    # ── Método principal ─────────────────────────────────────────────────
    async def discover(
        self,
        name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        username: Optional[str] = None,
    ) -> SocialDiscoveryResult:
        """
        Ejecuta el descubrimiento social y profesional de una persona.

        Busca información en múltiples fuentes basándose en el nombre,
        correo electrónico, teléfono y/o nombre de usuario proporcionados.

        Args:
            name: Nombre completo de la persona.
            email: Correo electrónico (opcional).
            phone: Número telefónico (opcional).
            username: Nombre de usuario (opcional).

        Returns:
            SocialDiscoveryResult: Resultado del descubrimiento social.
        """
        result = SocialDiscoveryResult()

        # ── Verificar caché global ───────────────────────────────────────
        cache_key_parts = [f"name:{name}"]
        if email:
            cache_key_parts.append(f"email:{email}")
        if username:
            cache_key_parts.append(f"username:{username}")
        cache_key = f"digital:social:discover:{':'.join(cache_key_parts)}"

        try:
            redis = get_redis()
            cached = await redis.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return self._deserialize_result(cached_data)
        except Exception:
            logger.debug("Caché no disponible para descubrimiento social de %s", name)

        # ── Preparar tareas de búsqueda ──────────────────────────────────
        tasks = []

        # Búsqueda en LinkedIn por nombre
        tasks.append(self.search_linkedin(name))

        # Búsqueda en GitHub por username
        if username:
            tasks.append(self.search_github(username))

        # ── Dorks de SerpApi ─────────────────────────────────────────────
        if self._settings.SERPAPI_API_KEY:
            # 1. Localización de Antecedentes Legales y Boletines Judiciales
            tasks.append(self.search_google_dorks(f'"{name}" filetype:pdf site:gob.mx', "legal"))
            tasks.append(self.search_google_dorks(f'"{name}" (intext:"demandado" | intext:"actor" | intext:"juicio" | intext:"sentencia")', "legal"))
            tasks.append(self.search_google_dorks(f'site:buholegal.com | site:poderjudicial.gob.mx "{name}"', "legal"))

            # 2. Dorks para Identificación de Fraude y Listas de Riesgo
            tasks.append(self.search_google_dorks(f'"{name}" (intext:"fraude" | intext:"estafa" | intext:"scam" | intext:"queja" | intext:"blacklist")', "fraud"))
            if email:
                tasks.append(self.search_google_dorks(f'intext:"{email}" (intext:"leak" | intext:"dump" | intext:"password" | intext:"database")', "leak"))

            # 3. Verificación de Estructura Corporativa
            tasks.append(self.search_google_dorks(f'site:anunciosjudiciales.gob.mx | site:siger.economia.gob.mx "{name}"', "corporate"))
            tasks.append(self.search_google_dorks(f'"{name}" "S.A. de C.V." | "S. de R.L." filetype:pdf', "corporate"))

            # 4. Exposición de Datos Expuestos (Leakage)
            tasks.append(self.search_google_dorks(f'filetype:xls | filetype:xlsx | filetype:csv "{name}" (intext:"KYC" | intext:"usuarios" | intext:"fraude")', "leak"))

            # 5. Dorks para Redes Sociales
            if email:
                tasks.append(self.search_google_dorks(f'site:facebook.com | site:instagram.com | site:x.com | site:linkedin.com "{email}"', "social_leak"))
            if phone:
                tasks.append(self.search_google_dorks(f'site:facebook.com | site:instagram.com | site:x.com | site:linkedin.com "{phone}"', "social_leak"))
            if username:
                tasks.append(self.search_google_dorks(f'site:instagram.com | site:tiktok.com | site:x.com "{username}"', "social"))

            # 6. Dorks de Redes Sociales + Alertas de Fraude
            if phone:
                tasks.append(self.search_google_dorks(f'site:facebook.com "{phone}" (intext:"fraude" | intext:"estafa" | intext:"robo" | intext:"falso" | intext:"alerta")', "fraud"))
            if email:
                tasks.append(self.search_google_dorks(f'site:x.com "{email}" (intext:"hilo" | intext:"fraude" | intext:"scam" | intext:"cuidado")', "fraud"))

            # 7. Bases de Datos de Spam y Reportes Telefónicos
            if phone:
                tasks.append(self.search_google_dorks(f'site:listaspam.com | site:quienhabla.com | site:teledigo.com | site:responderono.com "{phone}"', "spam_report"))
                tasks.append(self.search_google_dorks(f'intext:"{phone}" (site:reddit.com | site:apestan.com | site:complaintsboard.com) "fraude"', "fraud"))

        # ── Ejecutar búsquedas en paralelo ───────────────────────────────
        search_results = await asyncio.gather(*tasks, return_exceptions=True)

        # ── Procesar resultados ──────────────────────────────────────────
        # IMPORTANTE: GitHubProfile NO es list, pero LinkedInProfile-list y
        # SerpApi-list SÍ son ambas `list`.  Hay que distinguirlas ANTES del
        # `isinstance(list)` genérico, de lo contrario el primer `if` absorbe
        # los dorks de SerpApi (que también son lista de dicts) y el `elif`
        # que los procesaba correctamente nunca se ejecuta.
        for search_result in search_results:
            if isinstance(search_result, Exception):
                logger.debug("Tarea de búsqueda falló: %s", search_result)
                continue

            if isinstance(search_result, GitHubProfile):
                result.github_profile = search_result
                continue

            if isinstance(search_result, list):
                for item in search_result:
                    if isinstance(item, LinkedInProfile):
                        # Lista proveniente de search_linkedin()
                        result.linkedin_profiles.append(item)
                    elif isinstance(item, dict) and item.get("source") == "Google (via SerpApi)":
                        # Lista proveniente de search_google_dorks()
                        # Determinar plataforma de origen a partir de la URL
                        link = item.get("link", "")
                        source_platform = _infer_platform_from_url(link)
                        category = item.get("category", "general")
                        result.social_profiles.append({
                            "platform": source_platform,
                            "source": "Google (via SerpApi)",
                            "name": item.get("title"),
                            "url": link,
                            "snippet": item.get("snippet"),
                            "category": category,
                            # Campo explícito para el reporte: estado de vinculación
                            "linked": True,  # Encontrado = vinculado
                        })
                continue

            logger.debug("Resultado de búsqueda con tipo inesperado: %s", type(search_result))

        # ── Agregar perfiles de GitHub a social_profiles ─────────────────
        if result.github_profile:
            result.social_profiles.append({
                "platform": "GitHub",
                "username": result.github_profile.username,
                "name": result.github_profile.name,
                "bio": result.github_profile.bio,
                "url": result.github_profile.profile_url,
                "repos": result.github_profile.repos,
                "followers": result.github_profile.followers,
                "languages": result.github_profile.languages,
                "category": "developer",
            })

        # ── Agregar perfiles de LinkedIn a social_profiles ───────────────
        for li_profile in result.linkedin_profiles:
            result.social_profiles.append({
                "platform": "LinkedIn",
                "name": li_profile.name,
                "headline": li_profile.headline,
                "company": li_profile.company,
                "location": li_profile.location,
                "connections": li_profile.connections,
                "url": li_profile.profile_url,
                "category": "professional",
            })

        # ── Calcular número total de perfiles ────────────────────────────
        result.profiles_found = len(result.social_profiles)

        # ── Construir resumen explícito de fuentes ───────────────────────
        # Agrupa por plataforma y marca si está vinculada (encontrada) o no.
        # Formato del reporte: "Instagram → VINCULADO", "X → NO VINCULADO", etc.
        result.sources_summary = _build_sources_summary(result)

        # ── Calcular puntuación profesional ──────────────────────────────
        result.professional_score = await self.calculate_professional_score(
            result.social_profiles,
        )

        # ── Calcular huella digital ──────────────────────────────────────
        result.digital_footprint_score = self._calculate_digital_footprint(result)

        # ── Calcular puntuación de presencia ─────────────────────────────
        result.presence_score = self._calculate_presence_score(result)

        # ── Cachear resultado ────────────────────────────────────────────
        try:
            redis = get_redis()
            await redis.setex(
                cache_key,
                self._cache_ttl,
                json.dumps(self._serialize_result(result)),
            )
        except Exception:
            logger.debug("No se pudo cachear resultado de descubrimiento social para %s", name)

        return result

    # ── Búsqueda en LinkedIn ─────────────────────────────────────────────
    async def search_linkedin(
        self,
        name: str,
        company: Optional[str] = None,
    ) -> List[LinkedInProfile]:
        """
        Busca perfiles de LinkedIn por nombre y opcionalmente por empresa.

        Utiliza la API de LinkedIn (o un servicio proxy) para buscar
        perfiles profesionales. En ausencia de API key, retorna una
        lista vacía con degradación graceful.

        Args:
            name: Nombre completo de la persona a buscar.
            company: Nombre de la empresa para filtrar (opcional).

        Returns:
            List[LinkedInProfile]: Lista de perfiles de LinkedIn encontrados.
        """
        cache_key = f"digital:social:linkedin:{name}:{company or ''}"

        # ── Verificar caché ──────────────────────────────────────────────
        try:
            redis = get_redis()
            cached = await redis.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return [
                    LinkedInProfile(**p) for p in cached_data
                ]
        except Exception:
            logger.debug("Caché no disponible para LinkedIn de %s", name)

        profiles: List[LinkedInProfile] = []

        # ── Nota: La API oficial de LinkedIn requiere OAuth 2.0 y aprobación ─
        # En producción se puede usar:
        # - LinkedIn People Search API (requiere Partnership)
        # - Proxycurl API (https://nubela.co/proxycurl/)
        # - SerpAPI (Google search de perfiles LinkedIn)
        # - PhantomBuster
        #
        # Aquí implementamos la estructura con un fallback a búsqueda web.

        try:
            # ── Intentar con Proxycurl / SerpAPI si está configurado ─────
            linkedin_api_key = getattr(
                self._settings, "LINKEDIN_API_KEY", "",
            )
            linkedin_api_url = getattr(
                self._settings, "LINKEDIN_API_URL", "https://nubela.co/proxycurl/api/v2",
            )

            if linkedin_api_key:
                async with httpx.AsyncClient(
                    timeout=self._http_timeout,
                    headers={"Authorization": f"Bearer {linkedin_api_key}"},
                ) as client:
                    # ── Búsqueda de persona en LinkedIn ────────────────────
                    search_params: Dict[str, Any] = {
                        "first_name": name.split()[0] if name else "",
                        "last_name": name.split()[-1] if len(name.split()) > 1 else "",
                    }
                    if company:
                        search_params["company"] = company

                    response = await client.get(
                        f"{linkedin_api_url}/linkedin/profile",
                        params=search_params,
                    )

                    if response.status_code == 200:
                        data = response.json()
                        profile_data = data.get("profile", data)

                        li_profile = LinkedInProfile(
                            name=profile_data.get("full_name", ""),
                            headline=profile_data.get("headline", ""),
                            company=profile_data.get("current_company", {}).get("name", ""),
                            location=profile_data.get("location", ""),
                            connections=profile_data.get("connections", 0),
                            profile_url=profile_data.get("profile_url", ""),
                        )
                        profiles.append(li_profile)

            else:
                # ── Fallback: Construir URL de búsqueda ──────────────────
                # Sin API key, generamos URLs de búsqueda pero no ejecutamos
                logger.debug(
                    "LinkedIn API key no configurada. "
                    "Se recomienda configurar SYNKDATA_LINKEDIN_API_KEY "
                    "para habilitar la búsqueda en LinkedIn."
                )

                # Construir URL de búsqueda pública como referencia
                search_query = name.replace(" ", "+")
                if company:
                    search_query += f"+{company}"
                profile_url = (
                    f"https://www.linkedin.com/pub/dir?"
                    f"firstName={name.split()[0] if name else ''}"
                    f"&lastName={name.split()[-1] if len(name.split()) > 1 else ''}"
                )

                # Crear perfil placeholder con la URL de búsqueda
                profiles.append(LinkedInProfile(
                    name=name,
                    profile_url=profile_url,
                ))

        except httpx.TimeoutException:
            logger.warning("Timeout al buscar en LinkedIn para %s", name)
        except httpx.ConnectError:
            logger.warning("Error de conexión a LinkedIn para %s", name)
        except Exception as exc:
            logger.error("Error inesperado al buscar en LinkedIn: %s", exc)

        # ── Cachear resultado ────────────────────────────────────────────
        if profiles:
            try:
                redis = get_redis()
                await redis.setex(
                    cache_key,
                    self._cache_ttl * 2,
                    json.dumps([
                        {
                            "name": p.name,
                            "headline": p.headline,
                            "company": p.company,
                            "location": p.location,
                            "connections": p.connections,
                            "profile_url": p.profile_url,
                        }
                        for p in profiles
                    ]),
                )
            except Exception:
                logger.debug("No se pudo cachear resultado de LinkedIn para %s", name)

        return profiles

    # ── Búsqueda en Google (SerpApi) ────────────────────────────────────
    async def search_google_dorks(
        self,
        query: str,
        category: str = "general",
    ) -> List[Dict[str, Any]]:
        """
        Realiza una búsqueda avanzada en Google usando SerpApi.

        Args:
            query: La consulta de búsqueda (Dork) completa.
            category: Categoría de la búsqueda para clasificación.

        Returns:
            List[Dict[str, Any]]: Lista de resultados encontrados.
        """
        if not self._settings.SERPAPI_API_KEY:
            logger.debug("SerpApi API key no configurada.")
            return []

        cache_key = f"digital:social:serpapi:{hash(query)}"
        try:
            redis = get_redis()
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        results = []
        try:
            async with httpx.AsyncClient(timeout=self._http_timeout) as client:
                response = await client.get(
                    self._settings.SERPAPI_API_URL,
                    params={
                        "q": query,
                        "api_key": self._settings.SERPAPI_API_KEY,
                        "engine": "google",
                        "num": 10,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    organic_results = data.get("organic_results", [])
                    for res in organic_results:
                        results.append({
                            "title": res.get("title"),
                            "link": res.get("link"),
                            "snippet": res.get("snippet"),
                            "source": "Google (via SerpApi)",
                            "category": category,
                        })

                    # Cachear
                    if results:
                        try:
                            redis = get_redis()
                            await redis.setex(cache_key, self._cache_ttl, json.dumps(results))
                        except Exception:
                            pass
        except Exception as exc:
            logger.error("Error en SerpApi search para query '%s': %s", query, exc)

        return results

    # ── Búsqueda en GitHub ───────────────────────────────────────────────
    async def search_github(self, username: str) -> GitHubProfile:
        """
        Busca el perfil de GitHub de un usuario.

        Utiliza la API pública de GitHub para obtener información
        detallada del perfil, incluyendo repositorios, seguidores
        y lenguajes de programación.

        Args:
            username: Nombre de usuario en GitHub.

        Returns:
            GitHubProfile: Perfil de GitHub encontrado.
        """
        cache_key = f"digital:social:github:{username}"

        # ── Verificar caché ──────────────────────────────────────────────
        try:
            redis = get_redis()
            cached = await redis.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return GitHubProfile(**cached_data)
        except Exception:
            logger.debug("Caché no disponible para GitHub de %s", username)

        profile = GitHubProfile(
            username=username,
            profile_url=f"https://github.com/{username}",
        )

        try:
            async with httpx.AsyncClient(
                timeout=self._http_timeout,
                headers={
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "SynkData-Intelligence-Platform",
                },
            ) as client:
                # ── Obtener perfil del usuario ────────────────────────────
                response = await client.get(
                    f"https://api.github.com/users/{username}",
                )

                if response.status_code == 200:
                    data = response.json()
                    profile.name = data.get("name", "") or ""
                    profile.bio = data.get("bio", "") or ""
                    profile.repos = data.get("public_repos", 0)
                    profile.followers = data.get("followers", 0)

                    # ── Obtener lenguajes de los repositorios ─────────────
                    languages = await self._fetch_github_languages(
                        username, client,
                    )
                    profile.languages = languages

                    # ── Estimar contribuciones ─────────────────────────────
                    # La API de GitHub no expone contribuciones directamente,
                    # pero podemos estimarlas por los eventos recientes
                    profile.contributions = await self._estimate_github_contributions(
                        username, client,
                    )

                elif response.status_code == 404:
                    logger.debug("Usuario %s no encontrado en GitHub", username)
                    profile.username = ""  # Marcar como no encontrado
                elif response.status_code == 403:
                    logger.warning("Rate limit de GitHub API alcanzado para %s", username)
                else:
                    logger.debug(
                        "Respuesta inesperada de GitHub API: %d para %s",
                        response.status_code, username,
                    )

        except httpx.TimeoutException:
            logger.warning("Timeout al consultar GitHub API para %s", username)
        except httpx.ConnectError:
            logger.warning("Error de conexión a GitHub API para %s", username)
        except Exception as exc:
            logger.error("Error inesperado al consultar GitHub API: %s", exc)

        # ── Cachear resultado ────────────────────────────────────────────
        if profile.username:  # Solo cachear si se encontró
            try:
                redis = get_redis()
                await redis.setex(
                    cache_key,
                    self._cache_ttl * 6,  # TTL largo (perfil estable)
                    json.dumps({
                        "username": profile.username,
                        "name": profile.name,
                        "bio": profile.bio,
                        "repos": profile.repos,
                        "followers": profile.followers,
                        "contributions": profile.contributions,
                        "languages": profile.languages,
                        "profile_url": profile.profile_url,
                    }),
                )
            except Exception:
                logger.debug("No se pudo cachear resultado de GitHub para %s", username)

        return profile

    # ── Cálculo de puntuación profesional ────────────────────────────────
    async def calculate_professional_score(
        self,
        profiles: List[Dict[str, Any]],
    ) -> ProfessionalScore:
        """
        Calcula la puntuación profesional basada en los perfiles encontrados.

        Evalúa múltiples factores para determinar el nivel de
        profesionalismo de la presencia digital de una persona:
        - Presencia en LinkedIn
        - Actividad en GitHub
        - Dominios profesionales (correo corporativo)
        - Consistencia social
        - Completitud del perfil

        Args:
            profiles: Lista de perfiles encontrados.

        Returns:
            ProfessionalScore: Puntuación profesional con desglose de factores.
        """
        score = ProfessionalScore()
        total_score = 0.0

        # ── Factor 1: Presencia en LinkedIn (máx 25 puntos) ──────────────
        linkedin_profiles = [
            p for p in profiles if p.get("platform") == "LinkedIn"
        ]
        if linkedin_profiles:
            li_factor = 15.0
            # Bonus por headline y empresa
            for lp in linkedin_profiles:
                if lp.get("headline"):
                    li_factor += 3.0
                if lp.get("company"):
                    li_factor += 4.0
                if lp.get("connections", 0) > 100:
                    li_factor += 3.0
            total_score += min(li_factor, 25.0)
            score.factors["linkedin_presence"] = min(li_factor, 25.0)
        else:
            score.factors["linkedin_presence"] = 0.0

        # ── Factor 2: Actividad en GitHub (máx 25 puntos) ────────────────
        github_profiles = [
            p for p in profiles if p.get("platform") == "GitHub"
        ]
        if github_profiles:
            gh_factor = 10.0
            gp = github_profiles[0]
            if gp.get("repos", 0) > 5:
                gh_factor += 5.0
            if gp.get("repos", 0) > 20:
                gh_factor += 3.0
            if gp.get("followers", 0) > 10:
                gh_factor += 4.0
            if gp.get("followers", 0) > 100:
                gh_factor += 3.0
            if gp.get("languages"):
                gh_factor += 2.0  # Diversidad de lenguajes
            total_score += min(gh_factor, 25.0)
            score.factors["github_activity"] = min(gh_factor, 25.0)
        else:
            score.factors["github_activity"] = 0.0

        # ── Factor 3: Dominios profesionales (máx 20 puntos) ─────────────
        professional_platforms = {"LinkedIn", "GitHub", "Stack Overflow", "Dev.to"}
        professional_count = sum(
            1 for p in profiles
            if p.get("platform") in professional_platforms
        )
        prof_factor = min(professional_count * 7.0, 20.0)
        total_score += prof_factor
        score.factors["professional_domains"] = prof_factor

        # ── Factor 4: Consistencia social (máx 15 puntos) ────────────────
        total_profiles = len(profiles)
        if total_profiles >= 3:
            consistency_factor = 10.0
            if total_profiles >= 5:
                consistency_factor += 5.0
            total_score += consistency_factor
            score.factors["social_consistency"] = consistency_factor
        else:
            score.factors["social_consistency"] = total_profiles * 3.0

        # ── Factor 5: Completitud del perfil (máx 15 puntos) ─────────────
        completeness_score = 0.0
        for p in profiles:
            fields_filled = sum(
                1 for key in ["name", "bio", "company", "location", "headline"]
                if p.get(key)
            )
            completeness_score += fields_filled / 5.0 * 3.0
        completeness_score = min(completeness_score, 15.0)
        total_score += completeness_score
        score.factors["profile_completeness"] = completeness_score

        # ── Puntuación final ─────────────────────────────────────────────
        score.score = round(min(total_score, 100.0), 2)

        return score

    # ── Métodos auxiliares privados ──────────────────────────────────────
    async def _fetch_github_languages(
        self,
        username: str,
        client: httpx.AsyncClient,
    ) -> List[str]:
        """
        Obtiene los lenguajes de programación principales de un usuario de GitHub.

        Consulta la API de GitHub para listar los repositorios y extraer
        los lenguajes más utilizados.

        Args:
            username: Nombre de usuario en GitHub.
            client: Cliente HTTP reutilizado.

        Returns:
            List[str]: Lista de lenguajes principales.
        """
        languages: List[str] = []
        language_counts: Dict[str, int] = {}

        try:
            response = await client.get(
                f"https://api.github.com/users/{username}/repos",
                params={"per_page": 100, "sort": "updated"},
            )

            if response.status_code == 200:
                repos = response.json()
                for repo in repos:
                    lang = repo.get("language")
                    if lang:
                        language_counts[lang] = language_counts.get(lang, 0) + 1

                # Ordenar por frecuencia y tomar los top 5
                sorted_languages = sorted(
                    language_counts.keys(),
                    key=lambda l: language_counts[l],
                    reverse=True,
                )
                languages = sorted_languages[:5]

        except Exception as exc:
            logger.debug(
                "Error al obtener lenguajes de GitHub para %s: %s",
                username, exc,
            )

        return languages

    async def _estimate_github_contributions(
        self,
        username: str,
        client: httpx.AsyncClient,
    ) -> int:
        """
        Estima las contribuciones anuales de un usuario de GitHub.

        Usa la API de eventos para contar actividad reciente como
        aproximación de las contribuciones.

        Args:
            username: Nombre de usuario en GitHub.
            client: Cliente HTTP reutilizado.

        Returns:
            int: Número estimado de contribuciones.
        """
        contribution_estimate = 0

        try:
            response = await client.get(
                f"https://api.github.com/users/{username}/events/public",
                params={"per_page": 100},
            )

            if response.status_code == 200:
                events = response.json()
                # Contar eventos de PushEvent y PullRequestEvent como contribuciones
                push_events = sum(
                    1 for e in events
                    if e.get("type") in ("PushEvent", "PullRequestEvent")
                )
                # Extrapolación anual: si tenemos 100 eventos recientes,
                # estimamos que representa ~2 semanas de actividad
                if len(events) > 0:
                    # Estimación conservadora: multiplicamos por 26 (52 semanas / 2)
                    contribution_estimate = push_events * 26
                else:
                    contribution_estimate = 0

        except Exception as exc:
            logger.debug(
                "Error al estimar contribuciones de GitHub para %s: %s",
                username, exc,
            )

        return contribution_estimate

    def _calculate_digital_footprint(self, result: SocialDiscoveryResult) -> float:
        """
        Calcula la puntuación de huella digital (0-100).

        Evalúa la extensión y profundidad de la presencia digital
        de la persona basándose en los perfiles encontrados.

        Args:
            result: Resultado del descubrimiento social.

        Returns:
            float: Puntuación de huella digital (0 a 100).
        """
        score = 0.0

        # ── Cantidad de perfiles sociales (máx 25 puntos) ────────────────
        social_count = len(result.social_profiles)
        score += min(social_count * 5.0, 25.0)

        # ── Perfiles de desarrollador (máx 25 puntos) ────────────────────
        developer_profiles = [
            p for p in result.social_profiles
            if p.get("category") == "developer"
        ]
        if developer_profiles:
            score += 15.0
            # Bonus por actividad en GitHub
            for dp in developer_profiles:
                if dp.get("repos", 0) > 0:
                    score += 5.0
                if dp.get("followers", 0) > 0:
                    score += 5.0
        score = min(score, 50.0)  # Cap temporal

        # ── Presencia comercial (máx 25 puntos) ──────────────────────────
        commercial_platforms = {"LinkedIn", "Crunchbase", "AngelList"}
        commercial_count = sum(
            1 for p in result.social_profiles
            if p.get("platform") in commercial_platforms
        )
        score += min(commercial_count * 10.0, 25.0)

        return round(min(score, 100.0), 2)

    @staticmethod
    def _calculate_presence_score(result: SocialDiscoveryResult) -> float:
        """
        Calcula la puntuación de presencia digital (0-100).

        Args:
            result: Resultado del descubrimiento social.

        Returns:
            float: Puntuación de presencia (0 a 100).
        """
        score = 0.0

        # ── Perfiles totales (máx 30 puntos) ─────────────────────────────
        score += min(result.profiles_found * 6.0, 30.0)

        # ── Presencia en LinkedIn (máx 30 puntos) ────────────────────────
        if result.linkedin_profiles:
            score += 20.0
            if any(lp.headline for lp in result.linkedin_profiles):
                score += 5.0
            if any(lp.company for lp in result.linkedin_profiles):
                score += 5.0

        # ── Presencia en GitHub (máx 25 puntos) ──────────────────────────
        if result.github_profile and result.github_profile.username:
            score += 15.0
            if result.github_profile.repos > 0:
                score += 5.0
            if result.github_profile.followers > 10:
                score += 5.0

        # ── Diversidad (máx 15 puntos) ───────────────────────────────────
        categories = set()
        for p in result.social_profiles:
            cat = p.get("category", "")
            if cat:
                categories.add(cat)
        score += min(len(categories) * 5.0, 15.0)

        return round(min(score, 100.0), 2)

    # ── Serialización / deserialización para caché ───────────────────────
    @staticmethod
    def _serialize_result(result: SocialDiscoveryResult) -> Dict[str, Any]:
        """
        Serializa el resultado para almacenamiento en caché Redis.

        Args:
            result: Resultado a serializar.

        Returns:
            Dict[str, Any]: Datos serializables a JSON.
        """
        return {
            "profiles_found": result.profiles_found,
            "social_profiles": result.social_profiles,
            "professional_score": {
                "score": result.professional_score.score,
                "factors": result.professional_score.factors,
            },
            "digital_footprint_score": result.digital_footprint_score,
            "presence_score": result.presence_score,
            "sources_summary": result.sources_summary,
            "linkedin_profiles": [
                {
                    "name": p.name,
                    "headline": p.headline,
                    "company": p.company,
                    "location": p.location,
                    "connections": p.connections,
                    "profile_url": p.profile_url,
                }
                for p in result.linkedin_profiles
            ],
            "github_profile": {
                "username": result.github_profile.username,
                "name": result.github_profile.name,
                "bio": result.github_profile.bio,
                "repos": result.github_profile.repos,
                "followers": result.github_profile.followers,
                "contributions": result.github_profile.contributions,
                "languages": result.github_profile.languages,
                "profile_url": result.github_profile.profile_url,
            } if result.github_profile else None,
        }

    @staticmethod
    def _deserialize_result(data: Dict[str, Any]) -> SocialDiscoveryResult:
        """
        Deserializa un resultado desde caché Redis.

        Args:
            data: Datos serializados.

        Returns:
            SocialDiscoveryResult: Resultado reconstruido.
        """
        result = SocialDiscoveryResult(
            profiles_found=data.get("profiles_found", 0),
            social_profiles=data.get("social_profiles", []),
            digital_footprint_score=data.get("digital_footprint_score", 0.0),
            presence_score=data.get("presence_score", 0.0),
            sources_summary=data.get("sources_summary", []),
        )

        # ── Reconstruir puntuación profesional ────────────────────────────
        prof_data = data.get("professional_score", {})
        result.professional_score = ProfessionalScore(
            score=prof_data.get("score", 0.0),
            factors=prof_data.get("factors", {}),
        )

        # ── Reconstruir perfiles de LinkedIn ──────────────────────────────
        result.linkedin_profiles = [
            LinkedInProfile(**p)
            for p in data.get("linkedin_profiles", [])
        ]

        # ── Reconstruir perfil de GitHub ─────────────────────────────────
        gh_data = data.get("github_profile")
        if gh_data:
            result.github_profile = GitHubProfile(**gh_data)

        return result
