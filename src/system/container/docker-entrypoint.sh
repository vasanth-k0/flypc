#!/bin/sh
set -eu

: "${FLYPC_DOMAIN:?FLYPC_DOMAIN must be set to a public DNS name.}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL must be set for Let's Encrypt.}"

export FLYPC_DOMAIN

render_http_config() {
  envsubst '${FLYPC_DOMAIN}' < /opt/flypc/nginx/http.conf.template > /etc/nginx/conf.d/flypc.conf
}

render_https_config() {
  envsubst '${FLYPC_DOMAIN}' < /opt/flypc/nginx/https.conf.template > /etc/nginx/conf.d/flypc.conf
}

certificate_path="/etc/letsencrypt/live/${FLYPC_DOMAIN}/fullchain.pem"

if [ ! -f "$certificate_path" ]; then
  render_http_config
  nginx

  if ! certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --domain "$FLYPC_DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring; then
    nginx -s quit || true
    echo "Failed to obtain a Let's Encrypt certificate for ${FLYPC_DOMAIN}." >&2
    exit 1
  fi

  nginx -s quit
fi

render_https_config
nginx -t
exec pm2-runtime start /opt/flypc/ecosystem.config.cjs
