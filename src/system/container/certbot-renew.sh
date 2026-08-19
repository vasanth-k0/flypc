#!/bin/sh
set -eu

while true; do
  certbot renew --quiet --deploy-hook 'nginx -s reload'
  sleep 12h
done
