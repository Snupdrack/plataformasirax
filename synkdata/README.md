# SynkData — Identity Intelligence Platform

Plataforma de Inteligencia de Identidad para verificación, cumplimiento normativo, evaluación de riesgo e investigación en México y LATAM.

---

## Visión General

SynkData es una plataforma de Identity Intelligence que va más allá del KYC tradicional. Integra verificación de identidad gubernamental (CURP, RFC, RENAPO, SAT), screening de cumplimiento (OFAC, ONU, Interpol, SAT 69-B), inteligencia digital (email, teléfono, username, redes sociales), correlación de identidad, evaluación de riesgo con scoring dual (Trust Score + Risk Score), y un motor de investigación con IA.

### Arquitectura de Módulos

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | **Verificación de Identidad** | Validación CURP (dígito verificador + RENAPO), RFC (física/moral + SAT), OCR de documentos (INE, Pasaporte) |
| 2 | **Inteligencia Gubernamental** | Integraciones RENAPO, SAT, IMSS, RND (Registro Nacional de Detenciones) |
| 3 | **Screening de Cumplimiento** | OFAC SDN, ONU, OpenSanctions, PEP, Interpol, SAT 69-B, DOF, SCJN |
| 4 | **Inteligencia Digital** | Email (HIBP, Hunter.io, MX, disposable), Teléfono (carrier, línea, spam), Username (59+ plataformas) |
| 5 | **Huella Digital** | Descubrimiento social (LinkedIn, GitHub, X, Instagram, TikTok, Telegram, Discord) |
| 6 | **Inteligencia Relacional** | Knowledge Graph (Neo4j), detección de redes ocultas, patrones sospechosos |
| 7 | **Motor de Correlación** | Cross-referencia de señales de identidad → `identity_confidence` (0-100) |
| 8 | **Motor de Riesgo** | Trust Score (señales positivas) + Risk Score (señales negativas) → APPROVE/REVIEW/REJECT |
| 9 | **Motor de Investigación IA** | Generación automática de reportes con hallazgos y recomendaciones |
| 10 | **Analítica y Monitoreo** | Dashboard ejecutivo, distribución de riesgo, alertas, tendencias |
| 11 | **API e Integraciones** | REST API, integraciones CRM, Fintech, ERP, HR, Marketplace, Banking |

---

## Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| **Framework** | FastAPI (Python 3.12+) |
| **Base de datos** | PostgreSQL 16 (SQLAlchemy async) |
| **Cache** | Redis 7 |
| **Graph DB** | Neo4j 5 |
| **OCR** | Tesseract + Pillow |
| **Matching** | fuzzywuzzy + Levenshtein + fonética española |
| **Teléfono** | phonenumbers (Google lib) |
| **HTTP Client** | httpx (async) |
| **Autenticación** | JWT (python-jose + passlib) |
| **Migraciones** | Alembic |
| **Testing** | pytest + pytest-asyncio |
| **Contenedores** | Docker + Docker Compose |

---

## Requisitos Previos

- **Python 3.12+**
- **Docker** y **Docker Compose** (para infraestructura)
- **Tesseract OCR** (para OCR de documentos, se instala en el Docker container)
- **Poppler Utils** (para procesamiento de PDFs)

---

## Instalación Rápida

### 1. Clonar el repositorio

```bash
unzip synkdata.zip
cd synkdata
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus claves API y configuración
nano .env
```

Variables clave a configurar:

```env
# Base de datos
SYNKDATA_DATABASE_URL=postgresql+asyncpg://synkdata:synkdata@localhost:5432/synkdata
SYNKDATA_REDIS_URL=redis://localhost:6379/0
SYNKDATA_NEO4J_URI=bolt://localhost:7687
SYNKDATA_NEO4J_USER=neo4j
SYNKDATA_NEO4J_PASSWORD=synkdata_neo4j

# Seguridad
SYNKDATA_SECRET_KEY=cambia-esta-clave-secreta-en-produccion
SYNKDATA_JWT_ALGORITHM=HS256
SYNKDATA_JWT_EXPIRATION_MINUTES=60

# APIs de verificación (opcional para desarrollo)
SYNKDATA_RENAPO_API_KEY=
SYNKDATA_SAT_API_KEY=
SYNKDATA_HIBP_API_KEY=
SYNKDATA_HUNTER_API_KEY=
SYNKDATA_OFAC_API_KEY=
SYNKDATA_OPEN_SANCTIONS_API_KEY=
SYNKDATA_INTERPOL_API_KEY=
```

### 3. Levantar infraestructura con Docker

```bash
docker-compose up -d postgres redis neo4j
```

Esperar a que los servicios estén listos:

```bash
docker-compose ps
# Verificar que postgres, redis y neo4j están "healthy"
```

### 4. Instalar dependencias

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

### 5. Inicializar la base de datos

```bash
# Ejecutar migraciones
alembic upgrade head

# Inicializar extensiones PostgreSQL
psql -h localhost -U synkdata -d synkdata -f scripts/init-db.sql

# Crear el usuario administrador inicial
python scripts/create_admin.py --interactive
# (o con variables de entorno: python scripts/create_admin.py)

# (Opcional) Cargar datos de prueba
python scripts/seed_data.py

# (Opcional) Configurar Neo4j
python scripts/setup_neo4j.py
```

### 6. Ejecutar el servidor

```bash
# Desarrollo con auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# O usando Docker Compose completo
docker-compose up -d
```

La API estará disponible en:
- **API**: http://localhost:8000
- **Docs (Swagger)**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

---

## Estructura del Proyecto

```
synkdata/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry point
│   ├── config.py                  # Configuración (pydantic-settings)
│   ├── database.py                # Conexiones PostgreSQL, Redis, Neo4j
│   ├── dependencies.py            # Dependencias FastAPI (DB, auth, pagination)
│   │
│   ├── templates/                 # Plantillas Jinja2 (UI)
│   │   ├── base.html              # Layout base (Tailwind + Alpine.js)
│   │   ├── landing.html           # Landing page pública
│   │   ├── success.html           # Página de éxito tras solicitar acceso
│   │   ├── auth/
│   │   │   └── login.html         # Login clientes + admin
│   │   ├── admin/
│   │   │   └── panel.html         # Panel admin (solicitudes, usuarios, actividad)
│   │   ├── dashboard/
│   │   │   ├── index.html         # Dashboard cliente (verificaciones, scoring)
│   │   │   └── verification_detail.html
│   │   └── partials/
│   │       ├── navbar.html
│   │       └── footer.html
│   │
│   ├── static/                    # Assets estáticos (CSS, JS, imágenes)
│   │   ├── css/custom.css
│   │   ├── js/app.js              # Cliente API, toasts, Alpine components
│   │   ├── js/charts.js           # Chart.js helpers (gauges, donut, trends)
│   │   └── img/logo.svg
│   │
│   ├── models/                    # SQLAlchemy ORM models
│   │   ├── base.py                # Base model + TimestampMixin + SoftDeleteMixin
│   │   ├── user.py                # User (ADMIN/CLIENT), AccessRequest
│   │   ├── verification.py        # VerificationRequest, CurpValidation, RfcValidation
│   │   ├── screening.py           # ScreeningRequest, ScreeningMatch, WatchlistEntry
│   │   ├── digital_intelligence.py # EmailAnalysis, PhoneAnalysis, UsernameAnalysis
│   │   ├── identity.py            # IdentityCorrelation, RiskAssessment
│   │   └── analytics.py           # VerificationEvent, Alert
│   │
│   ├── schemas/                   # Pydantic request/response schemas
│   │   ├── user.py                # Login, AccessRequest, AdminCreateUser, etc.
│   │   ├── verification.py
│   │   ├── screening.py
│   │   ├── digital_intelligence.py
│   │   ├── identity.py
│   │   └── analytics.py
│   │
│   ├── routers/                   # FastAPI route handlers
│   │   ├── access.py              # Landing page + POST /access/request
│   │   ├── auth.py                # Login, me, refresh, change-password
│   │   ├── admin.py               # Panel admin (solo rol ADMIN)
│   │   ├── dashboard.py           # Dashboard cliente (autenticado)
│   │   ├── verify.py              # POST /verify
│   │   ├── curp.py                # CURP endpoints
│   │   ├── rfc.py                 # RFC endpoints
│   │   ├── screening.py           # Screening endpoints
│   │   ├── identity.py            # Identity endpoints
│   │   ├── risk.py                # Risk endpoints
│   │   └── analytics.py           # Analytics endpoints
│   │
│   ├── services/                  # Lógica de negocio
│   │   ├── auth_service.py        # Registro, login, JWT, hashing bcrypt
│   │   ├── admin_service.py       # Stats admin, actividad, export
│   │   ├── curp_validator.py
│   │   ├── rfc_validator.py
│   │   ├── compliance_screening.py
│   │   ├── fuzzy_matcher.py
│   │   ├── email_intelligence.py
│   │   ├── phone_intelligence.py
│   │   ├── username_intelligence.py
│   │   ├── social_discovery.py
│   │   ├── identity_correlation.py
│   │   ├── trust_score.py
│   │   ├── risk_engine.py
│   │   ├── knowledge_graph.py
│   │   ├── ocr_service.py
│   │   ├── ai_investigation.py
│   │   └── analytics_service.py
│   │
│   ├── integrations/              # Clientes de APIs externas
│   │   ├── ofac.py
│   │   ├── open_sanctions.py
│   │   ├── interpol.py
│   │   ├── un_sanctions.py
│   │   └── sat_client.py
│   │
│   ├── utils/                     # Utilidades y algoritmos
│   │   ├── curp_algorithm.py
│   │   ├── rfc_algorithm.py
│   │   ├── phonetic.py
│   │   └── text_normalizer.py
│   │
│   └── middleware/                 # Middleware personalizado
│       ├── auth.py                # JWT authentication
│       ├── rate_limit.py          # Rate limiting (Redis)
│       └── logging.py             # Request/response logging
│
├── tests/                         # Test suite
│   ├── conftest.py
│   ├── test_curp.py
│   ├── test_rfc.py
│   ├── test_screening.py
│   ├── test_risk_engine.py
│   └── test_identity_correlation.py
│
├── scripts/                       # Scripts de utilidad
│   ├── init-db.sql                # Extensiones PostgreSQL
│   ├── seed_data.py               # Datos de prueba
│   ├── setup_neo4j.py             # Configuración Neo4j
│   └── create_admin.py            # Crear admin inicial
│
├── alembic/                       # Migraciones de base de datos
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       ├── 0001_users_access.py   # Tablas users + access_requests
│       └── 0002_core_tables.py    # Resto de tablas
│
├── docs/
│   └── api.yaml                   # OpenAPI 3.0 specification
│
├── docker-compose.yml             # Docker Compose (Postgres, Redis, Neo4j, API)
├── Dockerfile                     # Container de la API
├── railway.json                   # Railway deployment config
├── railway.toml                   # Railway deployment alt config
├── nixpacks.toml                  # Nixpacks build config (Railway)
├── Procfile                       # Procfile (Railway/Heroku)
├── requirements.txt               # Dependencias Python
├── pyproject.toml                 # Metadata del proyecto
├── .env.example                   # Variables de entorno ejemplo
├── .gitignore
├── alembic.ini
└── README.md
```

---

## Flujo de Usuarios

### Landing Page → Solicitud de Acceso → Aprobación Admin → Dashboard

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Landing Page   │     │  Solicitud de    │     │  Panel Admin    │
│  (Pública)      │────▶│  Acceso (FORM)   │────▶│  Revisa y       │
│  /              │     │  /access/request │     │  Aprueba/Rechaza│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────┐
                                                │  Admin crea      │
                                                │  cuenta cliente  │
                                                │  (POST /admin/   │
                                                │   users)         │
                                                └────────┬─────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Dashboard      │◀────│  Login (JWT)     │◀────│  Cliente recibe │
│  Cliente        │     │  /login          │     │  credenciales   │
│  /dashboard     │     │                  │     │  por email      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Roles

| Rol | Acceso | Funciones |
|-----|--------|-----------|
| **ADMIN** | `/admin`, `/login` | Revisar solicitudes, crear usuarios, ver stats, actividad, exportar |
| **CLIENT** | `/dashboard`, `/login` | Verificar identidad, ver historial, analítica personal |

### Endpoints de UI

| Ruta | Descripción |
|------|-------------|
| `GET /` | Landing page pública |
| `GET /login` | Login (clientes y admin) |
| `GET /dashboard` | Dashboard cliente (requiere JWT CLIENT) |
| `GET /admin` | Panel admin (requiere JWT ADMIN) |
| `GET /dashboard/verification/{id}` | Detalle de verificación |

---

## API Endpoints

### Verificación de Identidad

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/verify` | Verificación completa de identidad (CURP + RFC + nombre) |
| `POST` | `/curp/validate` | Validar formato y dígito verificador de CURP |
| `POST` | `/curp/search` | Buscar CURP en RENAPO |
| `GET`  | `/curp/{curp}` | Obtener validación cacheada |
| `POST` | `/rfc/validate` | Validar formato y dígito verificador de RFC |
| `POST` | `/rfc/verify-sat` | Verificar RFC contra SAT |
| `GET`  | `/rfc/{rfc}` | Obtener validación cacheada |

### Screening de Cumplimiento

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/screening/person` | Screening completo de persona (8 fuentes) |
| `POST` | `/screening/entity` | Screening de entidad/empresa |
| `POST` | `/screening/sat-69b` | Verificación SAT Artículo 69-B |
| `POST` | `/screening/pep` | Verificación de PEP |
| `GET`  | `/screening/{request_id}` | Resultado de screening previo |

### Identidad y Riesgo

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/identity/correlate` | Correlación de señales de identidad |
| `POST` | `/identity/trust-score` | Calcular Trust Score |
| `POST` | `/identity/assess` | Evaluación completa (correlación + trust + risk) |
| `GET`  | `/identity/{id}` | Evaluación previa |
| `POST` | `/risk/assess` | Evaluación de riesgo completa |
| `POST` | `/risk/quick` | Evaluación rápida (solo screening) |
| `GET`  | `/risk/{id}` | Evaluación previa |

### Analítica

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/analytics/dashboard` | Dashboard ejecutivo |
| `GET`  | `/analytics/risk-distribution` | Distribución de riesgo |
| `GET`  | `/analytics/trends/{metric}` | Tendencias |
| `GET`  | `/analytics/alerts` | Lista de alertas |
| `PATCH`| `/analytics/alerts/{id}/read` | Marcar alerta como leída |
| `GET`  | `/analytics/regional` | Métricas regionales |
| `GET`  | `/analytics/industry` | Métricas por industria |

---

## Modelo de Scoring

### Trust Score (Señales Positivas, máx. 100)

| Señal | Puntos |
|-------|--------|
| RENAPO válido | +20 |
| RFC válido | +15 |
| SAT activo | +15 |
| Sin sanciones (screening limpio) | +20 |
| Presencia profesional | +10 |
| GitHub activo | +5 |
| LinkedIn encontrado | +5 |
| Correo verificable | +5 |
| Teléfono válido | +5 |

### Risk Score (Señales Negativas)

| Señal | Puntos | Severidad |
|-------|--------|-----------|
| RND positivo | +100 | CRITICAL |
| OFAC Match | +100 | CRITICAL |
| OpenSanctions Match | +100 | CRITICAL |
| UN Match | +90 | HIGH |
| Interpol Match | +90 | HIGH |
| SAT 69-B | +50 | HIGH |
| Identidad inconsistente | +50 | HIGH |
| Múltiples identidades | +40 | MEDIUM |
| Correo temporal | +20 | MEDIUM |
| Sin presencia digital | +15 | MEDIUM |
| Teléfono VoIP | +10 | LOW |

### Lógica de Decisión

| Risk Score | Recomendación |
|------------|---------------|
| 0 - 15 | **APPROVE** |
| 16 - 40 | **REVIEW** |
| > 40 | **REJECT** |
| Match crítico (OFAC, RND) | **REJECT automático** |

### Ejemplo de Respuesta

```json
{
  "correlation": {
    "identity_confidence": 96,
    "signals": [
      {"name": "name_consistency", "passed": true, "score": 25, "weight": 0.25},
      {"name": "curp_rfc_consistency", "passed": true, "score": 20, "weight": 0.20}
    ]
  },
  "trust_score": {
    "score": 92,
    "level": "very_high",
    "contributors": [
      {"name": "RENAPO válido", "points": 20, "max_points": 20, "passed": true},
      {"name": "RFC válido", "points": 15, "max_points": 15, "passed": true}
    ]
  },
  "risk_assessment": {
    "risk_score": 8,
    "trust_score": 92,
    "recommendation": "APPROVE",
    "risk_factors": [],
    "mitigating_factors": []
  }
}
```

---

## Testing

```bash
# Ejecutar todos los tests
pytest

# Con verbose
pytest -v

# Tests específicos
pytest tests/test_curp.py -v
pytest tests/test_rfc.py -v
pytest tests/test_screening.py -v
pytest tests/test_risk_engine.py -v
pytest tests/test_identity_correlation.py -v

# Con coverage
pytest --cov=app --cov-report=html
```

---

## Docker

### Levantar toda la plataforma

```bash
# Construir y levantar
docker-compose up -d --build

# Ver logs
docker-compose logs -f api

# Detener
docker-compose down

# Con volúmenes persistentes
docker-compose up -d
```

### Servicios incluidos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| API | 8000 | FastAPI application |
| PostgreSQL | 5432 | Base de datos principal |
| Redis | 6379 | Cache y rate limiting |
| Neo4j | 7474/7687 | Knowledge Graph |

---

## Desarrollo

### Crear una nueva migración

```bash
alembic revision --autogenerate -m "descripcion_del_cambio"
alembic upgrade head
```

### Agregar un nuevo servicio

1. Crear el servicio en `app/services/nuevo_servicio.py`
2. Agregar el modelo en `app/models/`
3. Agregar schemas en `app/schemas/`
4. Crear el router en `app/routers/`
5. Registrar el router en `app/main.py`
6. Agregar tests en `tests/`

### Convenciones

- **Código**: Type hints en todas las funciones
- **Docstrings**: Español para descripciones de usuario, inglés para docstrings técnicos
- **Async**: Todos los servicios usan async/await
- **Cache**: Redis para resultados costosos con TTL apropiado
- **Errores**: Degradación elegante — los fallos de APIs externas no deben crashear el sistema
- **Validación**: Pydantic schemas para todos los inputs/outputs

---

## Despliegue en Railway

Railway es la forma más rápida de desplegar SynkData en producción. El proyecto incluye los archivos `railway.json`, `railway.toml`, `nixpacks.toml` y `Procfile` preconfigurados.

### Paso a Paso

#### 1. Crear cuenta y proyecto en Railway

1. Ve a https://railway.app y crea una cuenta (o inicia sesión con GitHub).
2. Crea un **New Project** → **Deploy from GitHub repo** (sube el proyecto a un repo público o privado).

#### 2. Añadir servicios de base de datos

En el proyecto Railway, click **+ New** y añade:

1. **PostgreSQL** — Railway creará una instancia gestionada.
2. **Redis** — necesaria para caché y rate limiting.

> **Neo4j**: Railway no ofrece Neo4j como servicio gestionado. Puedes usar **Neo4j Aura Free** (https://neo4j.com/cloud/aura-free/) y conectar vía `bolt+s://` URL.

#### 3. Configurar variables de entorno

En el servicio web (la API), ve a **Variables** y añade:

```env
# App
SYNKDATA_ENV=production
SYNKDATA_API_PREFIX=/api/v1

# Seguridad — genera con: openssl rand -hex 32
SYNKDATA_SECRET_KEY=<tu-clave-secreta-de-32-caracteres>

# Base de datos — Railway las inyecta automáticamente con sintaxis ${{}}
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Neo4j (desde Neo4j Aura)
SYNKDATA_NEO4J_URI=bolt+s://<id>.databases.neo4j.io
SYNKDATA_NEO4J_USER=neo4j
SYNKDATA_NEO4J_PASSWORD=<tu-password>

# CORS — permite tu dominio Railway
SYNKDATA_CORS_ORIGINS=["https://synkdata-production.up.railway.app"]

# Admin inicial (se crea automáticamente en el primer deploy via Procfile release)
SYNKDATA_ADMIN_EMAIL=admin@tudominio.com
SYNKDATA_ADMIN_PASSWORD=<contraseña-segura-de-al-menos-12-caracteres>
SYNKDATA_ADMIN_NAME=Administrador SynkData

# Logging
SYNKDATA_LOG_LEVEL=INFO

# APIs externas (opcionales al inicio)
SYNKDATA_HIBP_API_KEY=
SYNKDATA_HUNTER_API_KEY=
SYNKDATA_RENAPO_API_KEY=
SYNKDATA_SAT_API_KEY=
```

> **Importante**: Railway detecta automáticamente `DATABASE_URL` y `REDIS_URL` (sin prefijo `SYNKDATA_`). El `config.py` está preparado para leer ambos formatos.

#### 4. Desplegar

Railway detectará `railway.json` y `nixpacks.toml` automáticamente y:
1. Instalará Python 3.12 + Tesseract OCR + Poppler (para OCR de documentos).
2. Instalará dependencias con `pip install -r requirements.txt`.
3. Ejecutará `alembic upgrade head` (migraciones).
4. Creará el admin inicial usando `SYNKDATA_ADMIN_EMAIL` y `SYNKDATA_ADMIN_PASSWORD`.
5. Levantará la app con `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

#### 5. Verificar el despliegue

1. Railway asignará una URL como `https://synkdata-production.up.railway.app`.
2. Visita `https://tu-app.up.railway.app/health` → debe retornar `"status": "healthy"`.
3. Visita `https://tu-app.up.railway.app/` → verás la landing page.
4. Inicia sesión en `https://tu-app.up.railway.app/login` con las credenciales de admin.

### Configurar dominio personalizado

En Railway: **Settings** → **Networking** → **Generate Domain** o añade tu dominio propio con CNAME.

### Comandos útiles de Railway CLI

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Ver logs en vivo
railway logs

# Ejecutar migraciones manualmente
railway run alembic upgrade head

# Crear admin manualmente
railway run python scripts/create_admin.py --interactive

# Abrir shell
railway shell

# Variables de entorno locales (para desarrollo)
railway run uvicorn app.main:app --reload
```

### Troubleshooting Railway

| Problema | Solución |
|----------|----------|
| `ModuleNotFoundError: No module named 'app'` | Asegúrate de que el **Root Directory** en Railway sea `/` (la raíz del repo). |
| `Could not connect to Postgres` | Verifica que `DATABASE_URL` esté configurada como `${{Postgres.DATABASE_URL}}`. |
| `alembic upgrade head` falla | Ejecuta `railway run alembic upgrade head` para ver el error. Las migraciones son idempotentes — se pueden re-ejecutar. |
| Login admin no funciona | Verifica que el **release command** del Procfile (`python scripts/create_admin.py ...`) se haya ejecutado. Revisa los logs del primer deploy. |
| 502 Bad Gateway | La app tarda en arrancar. Espera 1-2 minutos y recarga. Si persiste, revisa logs. |
| OCR no funciona | Tesseract se instala vía `nixpacks.toml`. Verifica `TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata` en Variables. |

### Costo estimado en Railway

| Recurso | Plan sugerido | Costo aprox. |
|---------|---------------|--------------|
| Web Service (API) | Hobby ($5/mo) oUsage-based | $5-20/mo |
| PostgreSQL | Hobby 1GB | $5/mo |
| Redis | Hobby 100MB | $5/mo |
| **Total** | | **~$15-30/mo** |

> Neo4j Aura Free tier incluye 200K nodos / 400K relaciones — suficiente para empezar.

---

## Integraciones Disponibles

| Integración | Tipo | Descripción |
|-------------|------|-------------|
| RENAPO | Gobierno | Validación de CURP contra registro nacional |
| SAT LFTP | Gobierno | Verificación de RFC y estado fiscal |
| SAT 69-B | Gobierno | Lista de presunción de operaciones simuladas |
| IMSS | Gobierno | Verificación de seguridad social |
| RND | Gobierno | Registro Nacional de Detenciones |
| OFAC SDN | Cumplimiento | Specially Designated Nationals (EE.UU.) |
| UN SC | Cumplimiento | Security Council Consolidated List |
| OpenSanctions | Cumplimiento | Base de datos global de sanciones y PEP |
| Interpol | Cumplimiento | Red Notices y diffusiones |
| HIBP | Digital | Have I Been Pwned (brechas de email) |
| Hunter.io | Digital | Búsqueda de emails por dominio |
| Tesseract OCR | Documentos | Reconocimiento óptico de caracteres |

---

## Licencia

Propietario — SynkData Identity Intelligence Platform

---

## Soporte

Para soporte técnico, consultas de integración o licencias, contactar al equipo de SynkData.
