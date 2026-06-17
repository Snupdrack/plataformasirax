#!/usr/bin/env bash
# Package Sirax · Synkdata into a clean zip for delivery.
set -euo pipefail

PROJECT_ROOT="/home/z/my-project"
STAGING_DIR="/home/z/my-project/scripts/_staging/sirax"
OUTPUT_ZIP="/home/z/my-project/download/sirax-src.zip"

echo "[1/6] Cleaning staging dir..."
rm -rf "$(dirname "$STAGING_DIR")"
mkdir -p "$STAGING_DIR"

echo "[2/6] Copying project files (excluding node_modules, .next, db, etc.)..."
cd "$PROJECT_ROOT"

# Copy top-level files
for f in package.json bun.lock package-lock.json next.config.ts tsconfig.json \
         tailwind.config.ts postcss.config.mjs eslint.config.mjs components.json \
         Caddyfile Dockerfile docker-compose.yml .dockerignore .gitignore \
         .env.example README.md DEPLOY.md; do
  [ -f "$f" ] && cp "$f" "$STAGING_DIR/"
done

# Copy directories (exclude build artifacts & dev-only stuff)
copy_dir() {
  local src="$1" dst="$2"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    rsync -a \
      --exclude 'node_modules' \
      --exclude '.next' \
      --exclude '.turbo' \
      --exclude '__pycache__' \
      --exclude '.pytest_cache' \
      --exclude '*.log' \
      --exclude '*.db' \
      --exclude '*.db-journal' \
      "$src/" "$dst/"
  fi
}

copy_dir src          "$STAGING_DIR/src"
copy_dir public       "$STAGING_DIR/public"
copy_dir prisma       "$STAGING_DIR/prisma"
copy_dir examples     "$STAGING_DIR/examples"

echo "[3/6] Verifying critical files exist..."
CRITICAL=(
  "README.md"
  "DEPLOY.md"
  ".env.example"
  "package.json"
  "next.config.ts"
  "tsconfig.json"
  "tailwind.config.ts"
  "prisma/schema.prisma"
  "src/app/page.tsx"
  "src/app/layout.tsx"
  "src/app/globals.css"
  "src/lib/synkdata.ts"
  "src/lib/auth.ts"
  "src/lib/db.ts"
  "Dockerfile"
  "docker-compose.yml"
  "Caddyfile"
)
for f in "${CRITICAL[@]}"; do
  if [ ! -f "$STAGING_DIR/$f" ]; then
    echo "  MISSING: $f"
    exit 1
  fi
done
echo "  All ${#CRITICAL[@]} critical files present."

echo "[4/6] Creating a top-level LICENSE..."
cat > "$STAGING_DIR/LICENSE" <<'EOF'
© 2026 Synkdata. All rights reserved.

Sirax is a proprietary product of Synkdata. Unauthorized redistribution,
sublicensing, or resale is prohibited. For licensing inquiries, contact
legal@synkdata.com.
EOF

echo "[5/6] Building the zip..."
rm -f "$OUTPUT_ZIP"
mkdir -p "$(dirname "$OUTPUT_ZIP")"
cd "$(dirname "$STAGING_DIR")"
zip -rq "$OUTPUT_ZIP" sirax/
echo "  -> $OUTPUT_ZIP"

echo "[6/6] Final package contents:"
TOTAL_FILES=$(unzip -l "$OUTPUT_ZIP" | tail -2 | head -1 | awk '{print $2}')
TOTAL_SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)
echo "Total files: $TOTAL_FILES"
echo "Total size:  $TOTAL_SIZE"
echo ""
echo "DONE: $OUTPUT_ZIP"
