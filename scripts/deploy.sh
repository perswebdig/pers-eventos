#!/usr/bin/env bash
# Build de produção + restart do PM2 (offline-first: build e .next precisam
# estar sincronizados com o processo em execução).
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="${PM2_APP_NAME:-pers-eventos}"
PORT="${PORT:-3010}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"

echo "▶ npm run build"
npm run build

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "▶ pm2 restart $APP_NAME"
  NODE_ENV=production PORT="$PORT" pm2 restart "$APP_NAME" --update-env >/dev/null
else
  echo "▶ pm2 start $APP_NAME (primeira vez)"
  mkdir -p logs
  NODE_ENV=production PORT="$PORT" pm2 start npm --name "$APP_NAME" -- start >/dev/null
fi

echo "▶ aguardando health check em http://localhost:$PORT ..."
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  if curl -fsS -m 2 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "✓ $APP_NAME no ar em http://localhost:$PORT"
    pm2 save >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 1
done

echo "✗ health check falhou — verifique: pm2 logs $APP_NAME"
exit 1
