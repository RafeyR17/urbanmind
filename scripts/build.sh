#!/usr/bin/env bash
# Never run `next build` while `next dev` is active — they share .next and corrupt chunks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"

if pgrep -f "${ROOT}/node_modules/.bin/next dev" >/dev/null 2>&1; then
  echo "[build] ERROR: next dev is still running. Stop it first (Ctrl+C), then run build."
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -ti:"${PORT}" >/dev/null 2>&1; then
  echo "[build] ERROR: port ${PORT} is in use. Stop the dev server before building."
  exit 1
fi

echo "[build] Clearing .next..."
rm -rf .next

node scripts/copy-cesium.js
exec npx next build "$@"
