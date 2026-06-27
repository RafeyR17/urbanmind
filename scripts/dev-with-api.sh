#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "[dev:all] Starting FastAPI simulation backend on port 8000..."
(
  cd "$ROOT/simulation"
  pip install -q -r requirements.txt
  uvicorn main:app --reload --port 8000
) &
API_PID=$!

echo "[dev:all] Waiting for ${API_URL}/health ..."
for _ in $(seq 1 30); do
  if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
    echo "[dev:all] Simulation backend is ready."
    break
  fi
  sleep 1
done

cd "$ROOT"
echo "[dev:all] Starting Next.js dev server..."
npm run dev
