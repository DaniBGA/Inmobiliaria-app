#!/usr/bin/env bash
# Script de deploy/actualización — correr en el VPS, parado en la raíz del
# repo (/var/www/sgm), como el usuario dueño del repo (no root).
#
# Primer deploy: seguir DEPLOY.md paso a paso (este script asume que Postgres,
# Caddy, PM2, .env de la API y deploy/.env.deploy ya existen).
# Deploys siguientes: alcanza con `bash deploy/deploy.sh`.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f deploy/.env.deploy ]; then
  echo "Falta deploy/.env.deploy — copiá deploy/env.deploy.example y completalo." >&2
  exit 1
fi
# shellcheck disable=SC1091
source deploy/.env.deploy
: "${VITE_API_URL:?falta VITE_API_URL en deploy/.env.deploy}"
export VITE_API_URL

echo "==> verificar versión de Node"
# Mínimos parcheados del security release de Node.js del 2026-10-21
# (CVE-2026-111497, RCE en el decoder Brotli que usa `fetch()`, + 9 CVEs
# más). Cualquier versión anterior de esas líneas es vulnerable, y las
# líneas sin soporte (20 o menos, impares) directamente no reciben parche.
# Con el próximo security release de Node hay que subir estos mínimos.
node -e '
  const [maj, min, pat] = process.versions.node.split(".").map(Number);
  const minimos = { 22: [23, 4], 24: [22, 1], 26: [12, 1] };
  const m = minimos[maj];
  const ok = m && (min > m[0] || (min === m[0] && pat >= m[1]));
  if (!ok) {
    console.error(`Node ${process.version} es vulnerable o no tiene soporte — actualizá a v22.23.4+, v24.22.1+ o v26.12.1+ antes de deployar (ver docs/DEPLOY.md, "Actualizar Node.js").`);
    process.exit(1);
  }
'

echo "==> git pull"
# Por si un `npm install` de un deploy anterior tocó el lockfile (pasa
# seguido al instalar en Linux algo desarrollado en Windows/Mac — npm
# reescribe detalles de paquetes específicos de plataforma) — sin esto,
# ese cambio local bloquea el pull. No hay nada propio que perder acá, lo
# vuelve a generar `npm ci` a continuación.
git checkout -- package-lock.json 2>/dev/null || true
git pull origin main

echo "==> npm ci (workspaces)"
# `npm ci` en vez de `npm install`: instala exactamente lo que dice el
# lockfile sin reescribirlo — evita que vuelva a quedar con cambios locales
# como el de arriba en el próximo deploy.
npm ci

echo "==> prisma generate + migrate deploy"
# Tiene que ir ANTES del build: `nest build` necesita los tipos que genera
# `prisma generate` (enums, Prisma.*Select, etc.) — con `npm ci` ya no queda
# ningún cliente generado de una corrida anterior que lo disimule.
(cd app/api && npx prisma generate && npx prisma migrate deploy)

echo "==> build backend (NestJS)"
npm run build --workspace=app/api

echo "==> build admin (VITE_API_URL=$VITE_API_URL)"
npm run build --workspace=admin

echo "==> build landing (VITE_API_URL=$VITE_API_URL)"
npm run build --workspace=app

echo "==> reiniciar backend (PM2)"
if pm2 describe sgm-api > /dev/null 2>&1; then
  pm2 restart sgm-api
else
  pm2 start deploy/ecosystem.config.js
  pm2 save
fi

echo "==> recargar Caddy"
sudo systemctl reload caddy

echo "==> listo."
