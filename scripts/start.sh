#!/bin/sh
# Sirax · Railway start script
# Corre migraciones de Prisma y luego levanta el servidor Next.js

set -e

echo "🔷 Sirax · Synkdata"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Ejecutar migraciones pendientes (seguro en producción, no borra datos)
echo "▶ Aplicando migraciones de base de datos..."
node_modules/.bin/prisma migrate deploy
echo "✓ Base de datos lista"

# Arrancar servidor Next.js standalone
echo "▶ Iniciando servidor en puerto ${PORT:-3000}..."
exec node server.js
