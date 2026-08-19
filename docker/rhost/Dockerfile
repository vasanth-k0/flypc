FROM node:22-alpine

RUN apk add --no-cache bash docker-cli tini python3 make g++

WORKDIR /flypc

COPY src/system/console/server/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY docker/rhost/entrypoint.sh /usr/local/bin/rhost-entrypoint.sh
RUN chmod +x /usr/local/bin/rhost-entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000 \
    FLYPC_BRAND_OWNER=flypc \
    RHOST_DATA_ROOT=/flypc/data \
    FLYPC_FE_DIST=/flypc/dist/fe \
    APP_METADATA_ROOT=/flypc/dist/be/app \
    APP_STORAGE_ROOT=/flypc/dist/storage/internal \
    TENANT_HOME_ROOT=/flypc/data/homes \
    FLYPC_ROOT=/flypc/source \
    CADDYFILE_PATH=/flypc/data/caddy/Caddyfile \
    RHOST_UPSTREAM=rhost:3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/rhost-entrypoint.sh"]
