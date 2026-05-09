#!/usr/bin/env bash
# scripts/check-convex.sh
# ---------------------------------------------------------------------------
# Local helper that runs Convex codegen + typecheck against `convex/`.
# Exits non-zero on failure. Used by both local devs and the optional
# `convex-typecheck` CI job.
#
# Why a separate script?
#   - The repo root tsconfig.json EXCLUDES convex/ because convex/_generated
#     is git-ignored and may not exist on a fresh clone.
#   - `npx convex codegen` requires Convex auth (CONVEX_DEPLOYMENT or an
#     interactive login). Forks and first-time PRs won't have that, so we
#     surface the failure as a warning rather than a hard block.
#
# Usage:
#   ./scripts/check-convex.sh                 # codegen + typecheck
#   SKIP_CODEGEN=1 ./scripts/check-convex.sh  # typecheck only (uses existing _generated)
# ---------------------------------------------------------------------------

set -u
# Note: NOT set -e — we want to capture and report each step independently.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CODEGEN_OK=0
TYPECHECK_OK=0
CODEGEN_SKIPPED=0

# ---- 1. Codegen -----------------------------------------------------------
if [ "${SKIP_CODEGEN:-0}" = "1" ]; then
  echo "[check-convex] SKIP_CODEGEN=1 — skipping 'npx convex codegen'."
  CODEGEN_SKIPPED=1
else
  echo "[check-convex] Running 'npx convex codegen --typecheck disable'…"
  if npx convex codegen --typecheck disable; then
    echo "[check-convex] codegen: OK"
    CODEGEN_OK=1
  else
    echo "[check-convex] codegen: FAILED (likely missing CONVEX_DEPLOYMENT / login)."
    echo "[check-convex] Falling back to whatever convex/_generated/ already contains."
  fi
fi

# ---- 2. Typecheck convex/ -------------------------------------------------
if [ ! -d "convex/_generated" ]; then
  echo "[check-convex] convex/_generated/ does not exist — cannot typecheck."
  echo "[check-convex] Run 'npx convex dev' once locally (requires auth) to bootstrap."
  exit 1
fi

echo "[check-convex] Running 'npx tsc --noEmit -p convex/tsconfig.json'…"
if npx tsc --noEmit -p convex/tsconfig.json; then
  echo "[check-convex] convex typecheck: OK"
  TYPECHECK_OK=1
else
  echo "[check-convex] convex typecheck: FAILED"
fi

# ---- 3. Summary -----------------------------------------------------------
echo ""
echo "[check-convex] Summary:"
if [ "$CODEGEN_SKIPPED" = "1" ]; then
  echo "  - codegen:   SKIPPED"
elif [ "$CODEGEN_OK" = "1" ]; then
  echo "  - codegen:   OK"
else
  echo "  - codegen:   FAILED (warning, see above)"
fi
if [ "$TYPECHECK_OK" = "1" ]; then
  echo "  - typecheck: OK"
  exit 0
else
  echo "  - typecheck: FAILED"
  exit 1
fi
