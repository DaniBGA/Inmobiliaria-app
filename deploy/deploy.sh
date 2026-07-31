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

echo "==> build backend (NestJS)"
npm run build --workspace=app/api

echo "==> prisma generate + migrate deploy"
(cd app/api && npx prisma generate && npx prisma migrate deploy)

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
