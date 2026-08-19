#!/bin/sh
set -eu

echo "[rhost] Starting RHost console (brand owner: ${FLYPC_BRAND_OWNER:-flypc})"

mkdir -p "${RHOST_DATA_ROOT}/caddy" "${RHOST_DATA_ROOT}/homes" "${APP_STORAGE_ROOT}"

if [ ! -f "${APP_METADATA_ROOT}/apps.json" ]; then
  echo "[rhost] ERROR: dist volume missing. Mount ./dist to /flypc/dist and run npm run build first."
  exit 1
fi

if [ ! -f "/flypc/dist/be/index.js" ]; then
  echo "[rhost] ERROR: /flypc/dist/be/index.js not found. Run npm run build before starting the container."
  exit 1
fi

cd /flypc/dist/be
exec node /flypc/dist/be/index.js
