#!/usr/bin/env bash
# scripts/check-convex.sh
# ---------------------------------------------------------------------------
# Strict gate that runs Convex codegen + typecheck against `convex/`.
# Exits non-zero on any failure. Used by both local devs and the
# `convex-typecheck` CI job.
#
# Why a separate script?
#   - The repo root tsconfig.json EXCLUDES convex/ because convex/_generated
#     is git-ignored and may not exist on a fresh clone.
#   - `npx convex codegen` requires a deployment that supports Node actions
#     (see README §"Convex Node-action deployment"). The Convex backend
#     accepts only Node.js 18, 20, 22, or 24 for "use node" actions; the
#     repo pins Node 24 via `.nvmrc`.
#
# Usage:
#   ./scripts/check-convex.sh                 # codegen + typecheck (strict)
#   SKIP_CODEGEN=1 ./scripts/check-convex.sh  # typecheck only (uses existing _generated)
#
# Exit codes:
#   0 — codegen + typecheck OK (or codegen skipped via SKIP_CODEGEN, typecheck OK)
#   1 — any step failed
# ---------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---- 0. Node version check ------------------------------------------------
# Convex Node-runtime actions require Node 18, 20, 22, or 24. The repo pins
# 24 via `.nvmrc`. Warn loudly when the active Node is something else — the
# codegen step will emit DeploymentNotConfiguredForNodeActions otherwise.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
EXPECTED_NODE_MAJOR="24"
if [ -f "$REPO_ROOT/.nvmrc" ]; then
  EXPECTED_NODE_MAJOR="$(tr -d '[:space:]' < "$REPO_ROOT/.nvmrc")"
fi

if [ "$NODE_MAJOR" != "$EXPECTED_NODE_MAJOR" ]; then
  echo "[check-convex] WARNING: Node v$NODE_MAJOR is active, but .nvmrc pins v$EXPECTED_NODE_MAJOR."
  echo "[check-convex] Convex Node-runtime actions require Node 18, 20, 22, or 24."
  echo "[check-convex] Run 'nvm use' from the repo root before re-running this script."
fi

# ---- 1. Codegen -----------------------------------------------------------
if [ "${SKIP_CODEGEN:-0}" = "1" ]; then
  echo "[check-convex] SKIP_CODEGEN=1 — skipping 'npx convex codegen'."
else
  echo "[check-convex] Running 'npx convex codegen --typecheck disable'…"
  if ! npx convex codegen --typecheck disable; then
    echo "[check-convex] codegen: FAILED"
    echo "[check-convex] Common causes:"
    echo "  1. Wrong Node version (see warning above; need 18/20/22/24)."
    echo "  2. CONVEX_DEPLOYMENT not set / not logged in."
    echo "     Run 'npx convex dev' once to bootstrap (writes .env.local)."
    echo "  3. Local Convex backend (anonymous deployment) not running."
    echo "     If using anonymous mode, start 'npx convex dev' in another terminal."
    echo "  4. DeploymentNotConfiguredForNodeActions — see README §Convex Node-action deployment."
    exit 1
  fi
  echo "[check-convex] codegen: OK"
fi

# ---- 2. Typecheck convex/ -------------------------------------------------
if [ ! -d "convex/_generated" ]; then
  echo "[check-convex] convex/_generated/ does not exist — cannot typecheck."
  echo "[check-convex] Run 'npx convex dev' once locally (requires auth) to bootstrap."
  exit 1
fi

echo "[check-convex] Running 'npx tsc --noEmit -p convex/tsconfig.json'…"
if ! npx tsc --noEmit -p convex/tsconfig.json; then
  echo "[check-convex] convex typecheck: FAILED"
  exit 1
fi
echo "[check-convex] convex typecheck: OK"

# ---- 3. Summary -----------------------------------------------------------
echo ""
echo "[check-convex] Summary:"
if [ "${SKIP_CODEGEN:-0}" = "1" ]; then
  echo "  - codegen:   SKIPPED"
else
  echo "  - codegen:   OK"
fi
echo "  - typecheck: OK"
exit 0
