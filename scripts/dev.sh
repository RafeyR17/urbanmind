#!/usr/bin/env bash
# Reliable dev startup: stale .next caches (especially on external drives)
# cause 404s for /_next/static/* and "Cannot find module './NNN.js'".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"

echo "[dev] Stopping any stale Next.js dev server on port ${PORT}..."
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:"${PORT}" 2>/dev/null || true)
  if [[ -n "${PIDS}" ]]; then
    kill ${PIDS} 2>/dev/null || true
  fi
fi
pkill -f "${ROOT}/node_modules/.bin/next dev" 2>/dev/null || true
sleep 1

echo "[dev] Clearing .next build cache..."
rm -rf .next

echo "[dev] Starting Next.js on http://localhost:${PORT}"
exec npx next dev -p "${PORT}" "$@"
