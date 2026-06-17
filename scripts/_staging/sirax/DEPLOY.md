# Sirax — Production Deployment Guide

> **Sirax** · a **Synkdata** product
> Identity & Risk Intelligence Platform

This guide covers four production-ready deployment options for Sirax:

1. [**Option A — Vercel**](#option-a--vercel-recommended) (easiest, recommended)
2. [**Option B — Docker**](#option-b--docker-self-hosted) (self-hosted)
3. [**Option C — Node.js standalone + Caddy**](#option-c--nodejs-standalone--caddy)
4. [**Option D — VPS bare-metal**](#option-d--vps-bare-metal-systemd)

Pick the one that matches your hosting strategy. All options assume you have
already cloned the repo, set up `.env`, and verified it works locally.

---

## Pre-flight checklist (all options)

- [ ] **Node.js 20+** or **Bun 1.1+** installed locally for building.
- [ ] A production **`JWT_SECRET`** — generate with `openssl rand -base64 48`.
- [ ] A production **`DATABASE_URL`** (SQLite file path, or a real PostgreSQL instance).
- [ ] A registered **domain** with DNS pointing to your host (for HTTPS).
- [ ] An SMTP relay or email API key (optional — only if you wire email features).
- [ ] All secrets in environment variables — **never** commit `.env`.

---

## Option A — Vercel (recommended)

Vercel is the simplest path: zero-config Next.js detection, automatic
HTTPS, edge CDN, preview deploys per branch.

### Steps

1. **Push the repo to GitHub/GitLab/Bitbucket.**
2. **Import the project** in the Vercel dashboard → *Add New → Project*.
3. **Configure build settings** (Vercel auto-detects, but verify):
   - Framework preset: **Next.js**
   - Build command: `next build`
   - Output directory: `.next` (leave default)
   - Install command: `bun install` (or `npm install`)
4. **Set environment variables** (Project → Settings → Environment Variables):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `file:./db/sirax.db` (or Postgres URL) |
   | `JWT_SECRET` | (your 48+ char secret) |
   | `JWT_EXPIRE` | `7d` |
   | `NEXT_PUBLIC_APP_NAME` | `Sirax` |
   | `NEXT_PUBLIC_APP_VENDOR` | `Synkdata` |
   | `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` |

5. **Deploy.** Vercel runs `next build` and serves it globally.
6. **Run database migration** once. Use Vercel's terminal or a one-off script:

   ```bash
   npx prisma db push
   ```
   (For Postgres, prefer `npx prisma migrate deploy`.)

### Notes

- Vercel's filesystem is **ephemeral** — SQLite files don't persist across
  invocations. Use **Vercel Postgres** or any external PostgreSQL for
  production. Update `DATABASE_URL` accordingly.
- For long-running tasks (webhook callbacks, large AI reports), use
  Vercel's **Cron Jobs** or move heavy work to a background worker.

---

## Option B — Docker (self-hosted)

A multi-stage Dockerfile is included. It builds the standalone Next.js
output and runs it on a minimal Node image.

### Build & run locally

```bash
# Build the image
docker build -t sirax:latest .

# Run it (SQLite)
docker run -d \
  --name sirax \
  -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e NEXT_PUBLIC_APP_URL="https://sirax.example.com" \
  -v sirax-db:/app/db \
  --restart unless-stopped \
  sirax:latest
```

### With docker-compose (recommended for prod)

A `docker-compose.yml` is provided:

```bash
docker compose up -d --build
```

This brings up:
- `sirax` — the Next.js app on port 3000
- `postgres` — PostgreSQL 16 (persistent volume)
- `caddy` — auto-HTTPS reverse proxy on ports 80/443

Update `docker-compose.yml` to set:
- `JWT_SECRET`
- Your domain in `Caddyfile`
- `POSTGRES_PASSWORD`

### Pushing to a registry

```bash
docker tag sirax:latest ghcr.io/<your-org>/sirax:1.0.0
docker push ghcr.io/<your-org>/sirax:1.0.0
```

Then pull on your server and `docker compose up -d`.

---

## Option C — Node.js standalone + Caddy

Next.js 16 supports `output: 'standalone'` (already enabled in
`next.config.ts`). This produces a self-contained `.next/standalone/`
folder you can deploy without `node_modules`.

### Build

```bash
bun install
bun run build
# produces:
#   .next/standalone/    ← Node server + minimal deps
#   .next/static/        ← JS/CSS chunks (must be copied alongside)
#   public/              ← static assets
```

### Deploy

```bash
# 1. Copy to server
rsync -avz --exclude node_modules --exclude .git \
  .next/standalone/  user@server:/opt/sirax/
rsync -avz .next/static/ user@server:/opt/sirax/.next/static/
rsync -avz public/       user@server:/opt/sirax/public/

# 2. On the server
cd /opt/sirax
export NODE_ENV=production
export PORT=3000
export JWT_SECRET="..."
export DATABASE_URL="..."
node server.js
```

### Caddy reverse proxy (auto HTTPS)

```caddyfile
sirax.example.com {
    reverse_proxy localhost:3000
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
    }
}
```

```bash
sudo caddy run --config /etc/caddy/Caddyfile
```

---

## Option D — VPS bare-metal (systemd)

For a single VPS without Docker.

### Steps

```bash
# 1. Install Node 20 LTS + bun + Caddy
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | bash
sudo apt install -y caddy

# 2. Create a dedicated user
sudo useradd --system --create-home --shell /bin/bash sirax

# 3. Clone the repo as that user
sudo -u sirax -i
git clone https://github.com/synkdata/sirax.git /home/sirax/app
cd /home/sirax/app
cp .env.example .env
nano .env   # set JWT_SECRET, DATABASE_URL, etc.

bun install
bun run db:generate
bun run db:push
bun run build

# 4. Exit back to root, install the systemd unit
exit
sudo tee /etc/systemd/system/sirax.service >/dev/null <<'UNIT'
[Unit]
Description=Sirax · Synkdata Identity Intelligence
After=network.target

[Service]
Type=simple
User=sirax
WorkingDirectory=/home/sirax/app
EnvironmentFile=/home/sirax/app/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /home/sirax/app/.next/standalone/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now sirax
sudo systemctl status sirax

# 5. Configure Caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
sirax.example.com {
    reverse_proxy localhost:3000
    encode gzip zstd
}
CADDY
sudo systemctl reload caddy
```

---

## Database migrations in production

**SQLite** — no migration files needed:
```bash
bunx prisma db push
```

**PostgreSQL** — use migration files for auditability:
```bash
# 1. Generate a migration locally (dev)
bunx prisma migrate dev --name init

# 2. Apply in production
DATABASE_URL="$PROD_DB" bunx prisma migrate deploy
```

Always back up the production DB before applying migrations.

---

## Environment-variable cheat sheet

| Var | Example | Required? |
|-----|---------|-----------|
| `DATABASE_URL` | `file:./db/sirax.db` or `postgresql://...` | yes |
| `JWT_SECRET` | (48+ random chars) | **yes** |
| `JWT_EXPIRE` | `7d` | no |
| `NODE_ENV` | `production` | yes |
| `PORT` | `3000` | no |
| `NEXT_PUBLIC_APP_NAME` | `Sirax` | no |
| `NEXT_PUBLIC_APP_VENDOR` | `Synkdata` | no |
| `NEXT_PUBLIC_APP_URL` | `https://sirax.example.com` | yes (prod) |

> Variables prefixed with `NEXT_PUBLIC_` are inlined into the client bundle
> at build time — rebuild the app when you change them.

---

## Health check & smoke test

After deploying:

```bash
# 1. Health endpoint
curl https://sirax.example.com/api/health
# Expect: { "service":"Sirax · Identity & Risk Intelligence Platform",
#            "vendor":"Synkdata", "status":"operational", ... }

# 2. Register a user
curl -X POST https://sirax.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@synkdata.com","password":"...","fullName":"Admin"}'

# 3. Login & run a check (use the returned token)
TOKEN=...
curl -X POST https://sirax.example.com/api/checks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subjectName":"Test","subjectCurp":"PELJ900101HDFRRN09"}'
```

---

## Hardening checklist (production)

- [ ] `JWT_SECRET` is ≥ 48 chars and never committed.
- [ ] `NODE_ENV=production` (disables stack traces in errors).
- [ ] HTTPS enforced by Caddy/Vercel/Cloudflare — redirect HTTP → HTTPS.
- [ ] Database backups running nightly (`pg_dump` for Postgres, file copy for SQLite).
- [ ] Rate limiting enabled (add `@upstash/ratelimit` if not using Vercel's built-in).
- [ ] CSP headers set (use `next.config.ts` `headers()` or Caddy).
- [ ] `robots.txt` allows crawling of the landing page but **blocks** `/api/*`.
- [ ] Log shipping to a central collector (Loki, CloudWatch, Datadog).
- [ ] Uptime monitoring (UptimeRobot, BetterStack) hitting `/api/health`.
- [ ] Run `bun audit` / `npm audit` periodically; pin major versions.
- [ ] Set up a staging environment with the same config as prod.

---

## Rollback

### Vercel
- Use the **Instant Rollback** button in the Vercel dashboard.

### Docker
```bash
docker pull ghcr.io/synkdata/sirax:1.0.0   # previous good version
docker compose down
docker compose up -d
```

### Bare-metal
```bash
sudo systemctl stop sirax
cd /home/sirax
git checkout v1.0.0     # previous tag
bun install
bun run build
sudo systemctl start sirax
```

For database rollbacks, restore from the nightly backup — Prisma migrations
are forward-only.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank page after deploy | `NEXT_PUBLIC_APP_URL` mismatch — rebuild. |
| 401 on every API call | `JWT_SECRET` differs between deploy and build env. |
| `PrismaClientInitializationError` | `DATABASE_URL` wrong, or SQLite path not writable. |
| Slow first request | Cold start — warm up with `/api/health` ping. |
| `Module not found` in standalone | Run `bun run build` again; the build script copies static + public. |
| Migration drift | `bunx prisma migrate status` → `bunx prisma migrate resolve` if needed. |

---

## Support

- **Product:** Sirax
- **Vendor:** Synkdata
- **Docs:** this file + `README.md`
- **Contact:** `ops@synkdata.com`

© 2026 Synkdata. All rights reserved.
