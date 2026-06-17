# Sirax <sub>· a Synkdata product</sub>

**Identity & Risk Intelligence Platform for México & LATAM**

Sirax is a Babel Street-style identity verification, background-check, compliance and
risk-intelligence platform. It centralizes Mexican government sources
(RENAPO / CURP, SAT / RFC, IMSS, RND), international sanctions lists
(OFAC, UN, OpenSanctions), digital identity intelligence (email, phone, username),
relationship graphing, an AI investigation engine, and a risk-scoring engine
into a single, modern web interface and REST API.

> **Tagline:** *Know More. Risk Less.*

---

## Table of contents

1. [Highlights](#highlights)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Quick start (development)](#quick-start-development)
5. [Environment variables](#environment-variables)
6. [Database](#database)
7. [Modules](#modules)
8. [REST API](#rest-api)
9. [Branding & assets](#branding--assets)
10. [Scripts](#scripts)
11. [Testing](#testing)
12. [Roadmap](#roadmap)
13. [License](#license)

---

## Highlights

- **Landing page** with Babel Street-style motion design: particle hero,
  scroll-driven reveals, animated counters, dynamic gradients, marquee,
  micro-interactions.
- **Authentication** with JWT (register / login / me), bcrypt password hashing,
  role-aware users (`admin` / `analyst`).
- **Identity verification** modules:
  - **CURP** — full RENAPO-compatible algorithm with check-digit validation.
  - **RFC** — persona física & moral, homoclave verification.
- **Government intelligence** — IMSS, RENAPO, RND, SAT.
- **Compliance intelligence** — OFAC SDN, UN Sanctions, OpenSanctions,
  fuzzy matching with phonetic + Jaro-Winkler + token-based scoring.
- **Digital identity intelligence** — email, phone, username footprint.
- **Risk intelligence engine** — weighted scoring across modules,
  produces `riskLevel` (BAJO / MEDIO / ALTO / CRITICO) and
  `recommendation` (APPROVE / REVIEW / REJECT).
- **AI investigation engine** — produces a natural-language summary
  of the verification, key findings, and recommended next steps.
- **Analytics dashboard** — historical checks, risk distribution,
  approval rate, time-series charts (Recharts).
- **REST API** under `/api/*` with bearer-token auth — fully usable
  from external systems.
- **shadcn/ui** component library, **Tailwind CSS 4**, **Framer Motion**
  for animations, **Recharts** for data viz, **Prisma** ORM.

---

## Tech stack

| Layer            | Technology |
|------------------|------------|
| Framework        | Next.js 16 (App Router, standalone output) |
| Language         | TypeScript 5 |
| Runtime          | Node.js 20+ / Bun (supported) |
| UI               | React 19, Tailwind CSS 4, shadcn/ui (new-york), Radix UI primitives |
| Animations       | Framer Motion 12 |
| Charts           | Recharts 2 |
| Forms            | React Hook Form + Zod |
| Icons            | lucide-react |
| Database         | SQLite (default) / PostgreSQL (production) via Prisma 6 |
| Auth             | JWT (`jsonwebtoken`) + bcryptjs |
| Reverse proxy    | Caddy (sample config included) |

---

## Project structure

```
sirax/
├── src/
│   ├── app/
│   │   ├── api/                       # Next.js Route Handlers (REST API)
│   │   │   ├── analytics/dashboard/
│   │   │   ├── auth/{login,register,me}/
│   │   │   ├── checks/                # CRUD for verification checks
│   │   │   ├── digital/{email,phone,username}/
│   │   │   ├── government/{imss,renapo,rnd,sat}/
│   │   │   ├── identity/{curp,rfc}/
│   │   │   ├── health/                # Service health & version
│   │   │   └── sanctions/{lists,screen}/
│   │   ├── globals.css                # Tailwind 4 theme + Sirax brand utilities
│   │   ├── layout.tsx                 # Root layout + <head> metadata
│   │   └── page.tsx                   # Single-file app (landing + dashboard + flows)
│   ├── components/ui/                 # shadcn/ui components
│   ├── hooks/                         # useToast, useMobile, ...
│   └── lib/
│       ├── auth.ts                    # JWT + bcrypt helpers
│       ├── db.ts                      # Prisma singleton
│       ├── synkdata.ts                # Service modules (CURP, RFC, risk, screening, ...)
│       └── utils.ts                   # cn() helper
├── prisma/
│   └── schema.prisma                  # User + Check models
├── public/
│   ├── logo.svg
│   └── robots.txt
├── .env.example
├── Caddyfile                          # Sample reverse-proxy config
├── next.config.ts                     # output: 'standalone'
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── components.json                    # shadcn/ui config
├── README.md                          # ← this file
└── DEPLOY.md                          # Production deployment guide
```

---

## Quick start (development)

> Requirements: **Node.js 20+** (or **Bun 1.1+**), Python 3 only needed if you
> want to seed initial data — not required to run the app.

```bash
# 1. Install dependencies
bun install            # or: npm install / pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET to a long random string

# 3. Initialize the database
bun run db:generate    # generates the Prisma client
bun run db:push        # creates the SQLite file + tables

# 4. Run the dev server
bun run dev            # or: npm run dev
```

Open <http://localhost:3000>. You should see the Sirax landing page.
Click **Iniciar sesión** → **Crear cuenta**, register a user, and you'll
land on the dashboard.

> The first registered user is a regular `analyst`. Grant yourself the
> `admin` role directly in the SQLite file if you need admin features:
>
> ```bash
> bunx prisma studio
> # open the User table, set role = "admin", Save
> ```

---

## Environment variables

| Variable                    | Required | Default                 | Description |
|-----------------------------|----------|-------------------------|-------------|
| `DATABASE_URL`              | yes      | `file:./db/sirax.db`    | Prisma datasource URL. SQLite path or PostgreSQL URL. |
| `JWT_SECRET`                | yes      | —                       | Random 32+ char string. **Change in production.** |
| `JWT_EXPIRE`                | no       | `7d`                    | Token lifetime. |
| `NODE_ENV`                  | no       | `development`           | `production` for prod. |
| `PORT`                      | no       | `3000`                  | Server port (only used in standalone mode). |
| `NEXT_PUBLIC_APP_NAME`      | no       | `Sirax`                 | Public-facing product name. |
| `NEXT_PUBLIC_APP_VENDOR`    | no       | `Synkdata`              | Parent-company name shown in footer/branding. |
| `NEXT_PUBLIC_APP_URL`       | no       | `http://localhost:3000` | Canonical URL (used for OG tags, CORS, etc.). |

Generate a strong JWT secret:
```bash
openssl rand -base64 48
```

---

## Database

The default `DATABASE_URL` points to a local SQLite file under `./db/sirax.db`.
This is fine for development and small single-instance deploys.

For **production**, switch to PostgreSQL:

```env
DATABASE_URL="postgresql://sirax:<pw>@<host>:5432/sirax?schema=public"
```

Then run:
```bash
bun run db:generate
bun run db:push     # or: bunx prisma migrate deploy
```

### Schema

Two models (see `prisma/schema.prisma`):

- **User** — `id`, `email`, `passwordHash`, `fullName`, `role`, `organization`, timestamps.
- **Check** — full verification record: subject info, module toggles, per-module
  JSON results, `trustScore`, `riskScore`, `riskLevel`, `recommendation`,
  `aiReport`, `flags`, `breakdown`, `sourcesConsulted`, timestamps.

---

## Modules

| Module | Endpoint | Description |
|--------|----------|-------------|
| CURP validation | `POST /api/identity/curp` | RENAPO-style CURP parser + check-digit. |
| RFC validation | `POST /api/identity/rfc` | Persona física & moral, homoclave. |
| Government IMSS | `GET /api/government/imss?curp=...` | IMSS affiliation lookup (simulated). |
| Government RENAPO | `GET /api/government/renapo?curp=...` | CURP existence check (simulated). |
| Government RND | `GET /api/government/rnd?curp=...` | National Electoral Roll check (simulated). |
| Government SAT | `GET /api/government/sat?rfc=...` | RFC tax-payer lookup (simulated). |
| Sanctions lists | `GET /api/sanctions/lists` | Returns OFAC, UN, OpenSanctions summaries. |
| Sanctions screen | `POST /api/sanctions/screen` | Fuzzy-match a name against lists. |
| Digital email | `POST /api/digital/email` | Email intelligence (breach presence, format, domain). |
| Digital phone | `POST /api/digital/phone` | Phone intelligence (carrier, region, line type). |
| Digital username | `POST /api/digital/username` | Username footprint across platforms. |
| New check | `POST /api/checks` | Orchestrates all enabled modules and produces a final risk score + AI report. |
| List check | `GET /api/checks` | Paginated history for the authenticated user. |
| Get check | `GET /api/checks/[id]` | Full check detail. |
| Delete check | `DELETE /api/checks/[id]` | Admin only. |
| Analytics | `GET /api/analytics/dashboard` | Aggregated metrics for the dashboard. |
| Auth — register | `POST /api/auth/register` | Creates a user, returns JWT. |
| Auth — login | `POST /api/auth/login` | Returns JWT. |
| Auth — me | `GET /api/auth/me` | Current user from JWT. |
| Health | `GET /api/health` | Service metadata, no auth. |

> The government endpoints ship with **simulated** responses. Wire them to
> real APIs by editing the corresponding `route.ts` files. Each route already
> defines the request/response contract.

---

## REST API

All endpoints (except `/api/health`, `/api/auth/login`, `/api/auth/register`)
require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

### Example — run a full check

```bash
TOKEN="..."   # from /api/auth/login
curl -X POST "$API/api/checks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectName": "Juan Pérez López",
    "subjectCurp": "PELJ900101HDFRRN09",
    "subjectRfc": "PELJ900101AB1",
    "subjectEmail": "juan@example.com",
    "subjectPhone": "+525512345678",
    "includeGovernment": true,
    "includeSanctions": true,
    "includeDigital": true,
    "includeRelationship": true,
    "includeAiReport": true
  }'
```

Response includes every module's JSON, the aggregated `trustScore` /
`riskScore` / `riskLevel` / `recommendation`, plus a natural-language
`aiReport`.

---

## Branding & assets

- **Product name:** Sirax
- **Parent company:** Synkdata
- **Logo:** inline SVG, defined in `src/app/page.tsx` (`SiraxMark`, `SiraxWordmark`,
  `SiraxLogo`). The favicon is embedded as a data URI in `src/app/layout.tsx`.
- **Brand palette** (in `src/app/globals.css`):
  - `--sirax-navy: #0a192f` (primary dark)
  - `--sirax-teal: #00d1a0` (accent)
  - `--sirax-teal-bright: #2ee8b8`
  - `--sirax-teal-soft: rgba(0, 209, 160, 0.12)`
- **Tagline:** *Know More. Risk Less.*

To rename, search the repo for `Sirax` (case-sensitive) and `Synkdata`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Dev server on <http://localhost:3000> |
| `bun run build` | Production build (outputs `.next/standalone`) |
| `bun run start` | Run the standalone production server |
| `bun run lint` | ESLint |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:push` | Push schema to DB (no migration files) |
| `bun run db:migrate` | Create + apply a Prisma migration |
| `bun run db:reset` | Drop & recreate DB (destructive) |

---

## Testing

The original Python backend ships with pytest tests under `synkdata/tests/`
(CURP, RFC, screening, identity correlation, risk engine). The Next.js port
mirrors those algorithms in `src/lib/synkdata.ts` and is intended to be tested
with a future Vitest suite — currently the project ships without JS tests.

To run the Python reference tests (optional, requires Python 3.11+):
```bash
cd synkdata
pip install -r requirements.txt
pytest -v
```

---

## Roadmap

- [ ] Vitest unit tests for `src/lib/synkdata.ts` (CURP/RFC/risk engines).
- [ ] Playwright E2E for the landing → login → dashboard → new-check flow.
- [ ] Real government API integrations (RENAPO, SAT, IMSS).
- [ ] Webhook callbacks for async checks.
- [ ] Multi-tenant organizations with row-level isolation.
- [ ] SSO (Google / Microsoft / SAML).
- [ ] Audit log + data-export endpoints (GDPR-style).

---

## License

© 2026 **Synkdata**. All rights reserved.
Sirax is a proprietary product of Synkdata. Unauthorized redistribution
is prohibited. For licensing inquiries, contact `legal@synkdata.com`.
