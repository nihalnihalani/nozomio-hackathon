# Nozomio Hackathon

## Dates
**May 9, 2026 | 8:00 AM – 8:00 PM (PDT)**

## Theme
Build the Future of AI Agents — AI agent infrastructure and development.

## Prizes
- **1st Place:** M5 MacBook Pros + Credits
- **2nd Place:** M4 Mac Minis + Credits + $500
- **3rd Place:** AirPods Pros + Credits + $300
- **Top 10:** Hinge Premium
- **+ First Class trip to Las Vegas, Stussy gear**

## Location
San Francisco, CA (EF Office) — In-Person

## Link
https://luma.com/rshibq6i

## Runtime modes

Triage runs in two modes that share the same agent loop, the same `TriageRunSnapshot` shape, and the same UI components. **Live mode** is the production default (`DEMO_MODE=live` — also the value when `DEMO_MODE` is unset): the agent calls Hyperspell, Nia, and Anthropic with real keys; the InsForge mirror route persists the audit log; missing third-party keys silently degrade per-client (Hyperspell falls through to its replay branch, the InsForge mirror logs `missing_config` and skips). **Replay mode** (`DEMO_MODE=replay` — opt-in for hermetic tests, offline dev, and zero-config first-runs) needs zero API keys: the frontend POSTs to `/api/triage`, which streams the agent's tool calls and citations back as Server-Sent Events from prerecorded fixtures, and the InsForge mirror is a silent no-op. **Convex reactive mode** activates as soon as `NEXT_PUBLIC_CONVEX_URL` is set: the same hook (`lib/hooks/useTriage.ts`) calls `useMutation(api.triage.start)` + `useQueries(api.triage.byId)` so the live trace is read off Convex's reactive tables instead of a one-shot SSE stream. The choice is made at build time and the UI doesn't fork — both modes produce the same snapshot.

## Continuous Integration

CI runs on every push to `main` and every pull request via `.github/workflows/ci.yml`.

### Primary job: `build-and-test` (must pass)

Runs on Ubuntu with the Node version pinned in `.nvmrc` (currently **24**). Does **not** require Convex auth, so it works for forks and first-time PRs.

| Step | Command | Notes |
| --- | --- | --- |
| Install | `npm ci` | Uses the npm cache. |
| Convex codegen | `npx convex codegen --typecheck disable` | **Best-effort, `continue-on-error: true`.** Needs `CONVEX_DEPLOYMENT` / login; warns and continues if absent. The strict gate lives in the secondary job. |
| Typecheck | `npm run typecheck` | Root `tsconfig.json` excludes `convex/`, so this passes regardless of codegen. |
| Invariants | `npm run check:invariants` | Runs `tests/invariants` + `scripts/verify_invariants.ts`. |
| Tests | `npm test` | `vitest run`. |
| Build | `npm run build` | `next build`. |

### Secondary job: `convex-typecheck` (strict gate when `CONVEX_DEPLOY_KEY` is set)

Runs `scripts/check-convex.sh` which executes `npx convex codegen` followed by `npx tsc --noEmit -p convex/tsconfig.json`. Behavior:

- **No secret present (forks, first-time PRs):** the job early-exits as a no-op success and never blocks a PR.
- **Secret present (project CI):** the job is **strict** — there is no `continue-on-error`. Any codegen or typecheck failure fails the job and blocks merge. This is the Codex-required Node-action gate.

To enable the strict gate: add `CONVEX_DEPLOY_KEY` under **Settings → Secrets and variables → Actions**, pointing at a Convex deployment that has Node actions enabled (see next section).

### Reproduce locally

```bash
nvm use                                # picks Node 24 from .nvmrc (required for Convex Node actions)
npm ci
npm run typecheck
npm run check:invariants
npm test
npm run build

# Strict Convex check — requires `npx convex dev` to have run once locally:
./scripts/check-convex.sh
```

The `convex/tsconfig.json` is a separate config used only by `check-convex.sh` and the secondary CI job; it does not affect the root typecheck.

## Convex Node-action deployment

`convex/triage_node.ts`, `convex/tools_node.ts`, and `convex/reinforce_node.ts` carry the `"use node"` directive and run on Convex's Node.js runtime (the rest of `convex/` runs on the V8 isolate). Convex requires explicit configuration for Node actions; without it, `npx convex codegen` fails with `DeploymentNotConfiguredForNodeActions`.

### What's already configured in this repo

- **`.nvmrc` pins Node 24.** Convex's Node runtime accepts only **Node.js 18, 20, 22, or 24** for `"use node"` actions. Newer (e.g. 25) is rejected. Always run `nvm use` from the repo root before any `npx convex` command.
- **`convex.json`** declares the Node config block:
  ```json
  {
    "functions": "convex/",
    "node": {
      "externalPackages": [],
      "nodeVersion": "24"
    }
  }
  ```
  Add npm package names to `externalPackages` only if a dependency contains native binaries that can't be bundled (e.g. `sharp`, `canvas`). The current dependencies do not need any entries.

### Bootstrapping a fresh Convex deployment

```bash
nvm use                                # honour .nvmrc → Node 24
npx convex dev                         # opens a browser; either logs in or creates an anonymous local backend
                                       # writes CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL into .env.local
# leave that running, then in another shell:
./scripts/check-convex.sh              # codegen + tsc -p convex/tsconfig.json (strict)
```

`npx convex dev` reads `convex.json` and provisions the deployment with Node-action support automatically. Running the strict check before that step will fail with `DeploymentNotConfiguredForNodeActions` because no deployment exists yet.

### CI: enabling the strict gate

1. Generate a deploy key in the Convex dashboard: **Project → Settings → Deploy Keys → Generate Production Deploy Key** (or a dev deploy key for the demo branch).
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name `CONVEX_DEPLOY_KEY`, value the key from step 1.
3. The next CI run will execute the strict `convex-typecheck` job. Failure blocks merge.

### Troubleshooting `DeploymentNotConfiguredForNodeActions`

The error message always points to the same root cause: the deployment can't run `"use node"` files. Check in this order:

1. **Node version.** Run `node --version`; if it isn't 18, 20, 22, or 24, run `nvm use` (the repo's `.nvmrc` selects 24). The error message from the Convex backend literally says *"Node.js v18, 20, 22, or 24 is not installed"*.
2. **`convex.json` exists** at the repo root with a `node` block (see above). A missing file uses defaults that *should* still allow Node actions, but explicit config avoids surprises.
3. **`npx convex dev` has been run at least once** so the deployment is provisioned. Anonymous local backends provision Node-action support on first run; cloud deployments do too.
4. **For CI:** confirm `CONVEX_DEPLOY_KEY` points at a deployment that's been initialized via `npx convex dev` against this repo (so the Node config has been pushed to the backend).
