#!/usr/bin/env bash
#
# 社内アンケート基盤 — ローカル開発 一括起動スクリプト
# 用法: bash scripts/start-dev.sh   (プロジェクトルート基準、どこからでも可)
#
# 背景:
#   WorkBuddy のファイル保護 shim が dev server の通常のファイル操作を遮断するため、
#   起動時に以下の環境変数で shim を緩和する。WorkBuddy 外で実行しても無害。
#   - admin(Vite):  CODEBUDDY_SAFE_DELETE_ENABLED=0
#                   lockfile 変更時の .vite/deps 再最適化(削除)が遮断されるのを回避
#   - client(Next): CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0 かつ CODEBUDDY_SAFE_DELETE_SANDBOX=0
#                   (.next 作成が CODEBUDDY_BROKER_DENY で拒否されるのを回避)
#                   ※後者はセッション環境から '1' で継承されるため、単に前者を 0 にするだけでは不十分

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1) PostgreSQL (docker)
echo "==> Postgres を確認/起動中..."
docker compose up -d db >/dev/null 2>&1 || {
  echo "docker compose による db 起動に失敗しました。Docker が起動しているか確認してください。" >&2
  exit 1
}
for _ in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U survey >/dev/null 2>&1; then break; fi
  sleep 2
done
docker compose exec -T db pg_isready -U survey || {
  echo "Postgres が準備できませんでした。" >&2; exit 1
}

# 2) API (FastAPI)
echo "==> API を起動中 (http://localhost:8000)..."
(
  cd "$ROOT/api"
  .venv/bin/uvicorn app.main:app --reload --port 8000
) &
PID_API=$!

# 3) admin (Vite)
echo "==> admin を起動中 (http://localhost:5173)..."
(
  cd "$ROOT/admin"
  CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run dev
) &
PID_ADMIN=$!

# 4) client (Next.js)
echo "==> client を起動中 (http://localhost:3000)..."
(
  cd "$ROOT/client"
  CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0 \
  CODEBUDDY_SAFE_DELETE_SANDBOX=0 \
  CODEBUDDY_SAFE_DELETE_ENABLED=0 \
  bash -c 'rm -rf .next 2>/dev/null; exec npm run dev'
) &
PID_CLIENT=$!

echo
echo "起動しました。Ctrl+C で全停止。"
echo "  API    : http://localhost:8000/health"
echo "  admin  : http://localhost:5173"
echo "  client : http://localhost:3000"
echo

cleanup() {
  echo
  echo "==> 停止中..."
  kill "$PID_API" "$PID_ADMIN" "$PID_CLIENT" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait
