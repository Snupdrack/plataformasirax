# syntax=docker/dockerfile:1.7
# Sirax · Synkdata — Production Dockerfile
# Multi-stage build producing a minimal image running the Next.js standalone server.

# ---------- 1. Builder ----------
FROM node:20-slim AS builder
WORKDIR /app

# Install bun for faster installs (optional)
RUN npm install -g bun

# Copy lockfiles first for cache
COPY package.json bun.lock* package-lock.json* ./
COPY prisma ./prisma

# Install deps
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else npm ci; fi

# Copy the rest of the source
COPY . .

# Build (outputs .next/standalone + .next/static + public/)
RUN npm run build

# ---------- 2. Runner ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_APP_NAME="Sirax"
ENV NEXT_PUBLIC_APP_VENDOR="Synkdata"

# Non-root user
RUN useradd --system --uid 1001 nextjs
USER nextjs

# Copy standalone server
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/@prisma ./node_modules/@prisma

# SQLite db volume
RUN mkdir -p /app/db && chown nextjs:nextjs /app/db
VOLUME ["/app/db"]

EXPOSE 3000

# Healthcheck hits /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
