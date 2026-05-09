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

Triage runs in two modes that share the same agent loop, the same `TriageRunSnapshot` shape, and the same UI components. **Replay mode** (the default for fresh clones) needs zero API keys: the frontend POSTs to `/api/triage`, which streams the agent's tool calls and citations back as Server-Sent Events from prerecorded fixtures — judges can clone the repo and hit "play" without provisioning anything. **Convex reactive mode** activates as soon as `NEXT_PUBLIC_CONVEX_URL` is set: the same hook (`lib/hooks/useTriage.ts`) calls `useMutation(api.triage.start)` + `useQueries(api.triage.byId)` so the live trace is read off Convex's reactive tables instead of a one-shot SSE stream. The choice is made at build time and the UI doesn't fork — both modes produce the same snapshot.

## Continuous Integration

CI runs on every push to `main` and every pull request via `.github/workflows/ci.yml`.

### Primary job: `build-and-test` (must pass)

Runs on Ubuntu with Node 22. Does **not** require Convex auth, so it works for forks and first-time PRs.

| Step | Command | Notes |
| --- | --- | --- |
| Install | `npm ci` | Uses the npm cache. |
| Convex codegen | `npx convex codegen --typecheck disable` | **Best-effort, `continue-on-error: true`.** Needs `CONVEX_DEPLOYMENT` / login; warns and continues if absent. |
| Typecheck | `npm run typecheck` | Root `tsconfig.json` excludes `convex/`, so this passes regardless of codegen. |
| Invariants | `npm run check:invariants` | Runs `tests/invariants` + `scripts/verify_invariants.ts`. |
| Tests | `npm test` | `vitest run`. |
| Build | `npm run build` | `next build`. |

### Secondary job: `convex-typecheck` (optional, non-blocking)

Runs `scripts/check-convex.sh` which executes `npx convex codegen` followed by `npx tsc --noEmit -p convex/tsconfig.json`. Gated on the `CONVEX_DEPLOY_KEY` repo secret. The job is `continue-on-error: true` and skips itself when the secret is absent — it never blocks a PR.

To enable: add `CONVEX_DEPLOY_KEY` under **Settings → Secrets and variables → Actions**.

### Reproduce locally

```bash
npm ci
npm run typecheck
npm run check:invariants
npm test
npm run build

# Optional — requires `npx convex dev` to have run once locally:
./scripts/check-convex.sh
```

The `convex/tsconfig.json` is a separate config used only by `check-convex.sh` and the optional CI job; it does not affect the root typecheck.
