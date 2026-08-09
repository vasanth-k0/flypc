FROM debian:bookworm-slim AS ttyd-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        git \
        libjson-c-dev \
        libwebsockets-dev \
        pkg-config \
    && git clone --depth 1 https://github.com/tsl0922/ttyd.git /opt/ttyd \
    && cmake -S /opt/ttyd -B /opt/ttyd/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /opt/ttyd/build --parallel

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        certbot \
        gettext-base \
        nginx \
        nodejs \
        npm \
        python3-certbot-nginx \
        libjson-c5 \
        libwebsockets17 \
    && npm install --global pm2 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY src/system/container/nginx/ /opt/flypc/nginx/
COPY src/system/container/docker-entrypoint.sh /usr/local/bin/flypc-entrypoint
COPY src/system/container/ecosystem.config.cjs /opt/flypc/ecosystem.config.cjs
COPY src/system/container/certbot-renew.sh /opt/flypc/certbot-renew.sh
COPY src/system/console/server/package.json /opt/flypc/src/system/console/server/package.json
RUN cd /opt/flypc/src/system/console/server && npm install --omit=dev

COPY dist/be/ /opt/flypc/dist/be/
COPY dist/fe/ /opt/flypc/dist/fe/
COPY --from=ttyd-builder /opt/ttyd/build/ttyd /usr/bin/ttyd

RUN chmod +x /usr/local/bin/flypc-entrypoint /opt/flypc/certbot-renew.sh \
    && mkdir -p /var/www/certbot \
    && rm -rf /usr/share/nginx/html \
    && ln -s /opt/flypc/dist/fe /usr/share/nginx/html

EXPOSE 80 443

ENTRYPOINT ["/usr/local/bin/flypc-entrypoint"]
