#!/usr/bin/env bash
# Run on the VPS after git pull. Do not put secrets in this file.
set -euo pipefail

ROOT=/opt/survey
API_ENV="$ROOT/api/.env"

if [[ ! -f "$API_ENV" ]]; then
  echo "missing $API_ENV — copy from api/.env.example and fill production values" >&2
  exit 1
fi

cd "$ROOT"
git fetch origin
git checkout main
git reset --hard origin/main

cd "$ROOT/api"
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
systemctl restart survey-api

cd "$ROOT/admin"
npm install
VITE_BASE=/survey/ npm run build
mkdir -p /var/www/sites/survey
rsync -a --delete dist/ /var/www/sites/survey/

cd "$ROOT/client"
npm install
export NODE_OPTIONS=--max-old-space-size=768
export NEXT_BASE_PATH=/survey-fill
export NEXT_PUBLIC_API_BASE=/survey/api/v1
npm run build
systemctl restart survey-client

systemctl is-active survey-api survey-client nginx
curl -sS -o /dev/null -w 'api:%{http_code}\n' http://127.0.0.1:8000/health
echo "deploy ok"
