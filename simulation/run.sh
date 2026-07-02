#!/bin/bash
# start fastapi sim backend on :8000 — run from simulation/ dir
set -euo pipefail
cd "$(dirname "$0")"

VENV_DIR=".venv"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

pip install -r requirements.txt  # quiet enough on repeat runs
uvicorn main:app --reload --port 8000
