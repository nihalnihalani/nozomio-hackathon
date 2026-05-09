# CONVEX_AGENT_MIGRATION.md

> Migration log for adopting `@convex-dev/agent` per `convexplan.md`.
> All phases code-complete and deployed to `superb-wildcat-347` Convex
> deployment. Replay-mode demo (the production demo path) is **untouched
> and unaffected**.

## What shipped

| Phase | Plan section | Status | Files |
|---|---|---|---|
| **1** | `@convex-dev/agent` adoption | ✅ Code-complete + deployed | `convex/convex.config.ts` (registers component), `convex/triageAgent.ts` (Agent + tools + runner) |
| **2 (backend)** | Delta streaming + listMessages | ✅ Code-complete + deployed | `convex/triage.ts` (`startAgent` mutation + `listAgentMessages` query) |
| **2 (UI)** | `useUIMessages` integration | ⏸ Deferred | Would touch `lib/hooks/useTriage.ts` + `components/TraceUI.tsx` — additive feature flag deferred to keep live demo bulletproof |
| **3** | `createTool` Zod tools | ✅ In `convex/triageAgent.ts` | Both `recallSimilarIncidents` and `searchCode` use `createTool` with Zod `inputSchema` (note: v0.6 renamed `args` → `inputSchema`, `handler` → `execute`) |
| **4** | Built-in RAG | ✅ Partial | `contextOptions: { recentMessages: 10, searchOptions: { textSearch: true, vectorSearch: false } }`. `vectorSearch` disabled because our service-account `OPENAI_API_KEY` lacks `/v1/embeddings` scope. Trace A → Trace B explicit gating preserved via `traceState.hasRecentTraceA` probe (Codex pass-3 honesty fix kept). |
| **5** | Convex HTTP route for InsForge mirror | ✅ Live | `convex/insforgeMirror.ts` (action) + `convex/http.ts` (HTTP router) at `https://superb-wildcat-347.convex.site/insforge-mirror`. Coexists with `app/api/insforge-mirror/route.ts` — caller migration is a follow-up. |
| **6** | PostHog observability | ✅ Defensive scaffold | `convex/observability.ts` with `globalThis.__posthog_init__` guard, dynamic imports — silent no-op when `POSTHOG_API_KEY` unset OR when OTel SDK packages aren't installed. Future-proof: activates automatically once both are present. |
| **7** | `npx convex ai-files` | ✅ Already done | Per PR #5 (`feat: cherry-pick additive pieces from pr-3`) |
| **8** | `.nvmrc` + `convex.json` + deployment management | ✅ Already done | Per PR #5 |

## Dependency upgrades that landed

| Package | Before | After | Why |
|---|---|---|---|
| `ai` | `^4.0.0` | `^6.0.177` | `@convex-dev/agent@0.6.1` peer-deps `ai@^6.0.35` |
| `convex` | `^1.18.0` | `^1.38.0` | Component system v2 + agent peer-dep `convex@^1.24.8` |
| `@ai-sdk/anthropic` | `^1.0.0` | `^3.0.76` | Forward-compat with `ai@6` |
| `@ai-sdk/react` | `^1.0.0` | `^3.0.179` | Forward-compat with `ai@6` |
| `@ai-sdk/openai` | (new) | `^3.0.63` | Phase 1 LLM provider |
| `@ai-sdk/provider-utils` | (new) | `^4.0.27` | Forward-compat |
| `@convex-dev/agent` | (new) | `^0.6.1` | Phase 1 |
| `@posthog/convex` | (new) | `^0.2.24` | Phase 6 |
| `@opentelemetry/api` | (new) | `^1.9.1` | Phase 6 (passive — only used dynamically) |
| `convex-helpers` | (new) | `^0.1.116` | Required by `@convex-dev/agent` runtime |

The plan estimated *"~15 of 35 tests will break"* from the AI SDK upgrade. Actual outcome: **35/35 still pass.** The replay path doesn't exercise the live `ai` SDK call surface directly; type compatibility held across the v4→v6 jump.

## Why the live agent path doesn't actually run yet

The `@convex-dev/agent` runtime is fully wired and deployed. Calling
`api.triage.startAgent({ orgId, trace })` correctly:
1. Creates an agent thread via `createThread`
2. Schedules `internal.triageAgent.runTriage`
3. Stores the user message with the `[degraded]` gating signal applied
4. Attempts to stream the LLM response

Step 4 fails with `AI_APICallError: Incorrect API key provided` because the
`OPENAI_API_KEY` in `.env` (a service-account `sk-svcacct-...` key) was
**revoked between the start of this session and now**. Direct `curl` against
`https://api.openai.com/v1/chat/completions` with the same key returns
HTTP 401 — confirming the key is dead, not a Convex-env issue.

This is purely an operational blocker, not a code blocker. Provisioning a
working LLM key (any provider supported by `@ai-sdk/*`) and setting it via
`npx convex env set OPENAI_API_KEY <new-key>` activates the agent path
immediately.

## Why `vectorSearch` is off

When `vectorSearch: true`, the agent computes embeddings for thread
messages on every search. Our service-account OpenAI key (the same one
that's now revoked) was rejected by `/v1/embeddings` even when chat
completions worked — service-account keys often have restricted scopes.

Once a key with embeddings access is provisioned, flip `vectorSearch:
true` in `convex/triageAgent.ts` (the `contextOptions.searchOptions`
block) and uncomment the `embeddingModel` config.

## Why the Phase 2 UI integration was deferred

The Phase 2 plan calls for swapping `useTriage.ts:useTriageConvex()` from
manual `useQueries(byId)` to `useUIMessages(api.triage.listAgentMessages,
...)`. That would change the `TriageRunSnapshot` shape consumed by
`TraceUI` and the result cards.

Doing that swap mid-demo carried real risk of breaking the wow moment
(the `fromTriageHistory: true` reinforcement badge depends on the
current snapshot shape). The backend is in place (`listAgentMessages`
query is deployed); the UI swap is a clean follow-up that can be done
behind a `NEXT_PUBLIC_USE_AGENT_UI=enabled` feature flag without
touching the existing demo path.

## Coexistence guarantee

The original demo path is intact:
- `app/api/triage/route.ts` (SSE) — unchanged, running on production URL
- `convex/triage.ts:start` (mutation) — unchanged
- `convex/triageNode.ts` (hand-rolled agent loop) — unchanged
- `lib/agent/loop.ts` (replay + live agent loop) — unchanged
- `lib/hooks/useTriage.ts` — unchanged
- `components/*` — unchanged
- `tests/` — all 35 still pass
- `data/replay/` fixtures — unchanged
- `.env.example` — only added optional `POSTHOG_API_KEY` / `POSTHOG_HOST`

The new agent paths sit alongside as net-new files:
- `convex/convex.config.ts`, `convex/triageAgent.ts`,
  `convex/insforgeMirror.ts`, `convex/http.ts`, `convex/observability.ts`
- `convex/triage.ts` gained two new exports (`startAgent`,
  `listAgentMessages`) without modifying existing exports
- `lib/insforge/client.ts` extended `MirrorIncidentInput` with optional
  `citations` and `actor` fields (already present from PR #5)

## Production deploy strategy

This branch is `feat/convex-full-migration`. After PR + merge, the
Vercel production URL `https://nozomio-hackathon-dun.vercel.app` will
serve the merged code. The replay-mode demo path is identical to what
ships today, so the live URL behavior should be unchanged.

To verify before promoting:
1. `npx vercel deploy` (preview URL, not prod)
2. Smoke-test preview URL matches production behavior (Trace A → Trace B
   wow moment, citation drawer, bogus-trace error)
3. If preview matches, `npx vercel --prod` promotes
4. If not, leave production alone — preview URL remains for follow-up

## Outstanding follow-ups

1. **Provision a working LLM key** — required for live mode in either the
   old `lib/agent/loop` path or the new `triageAgent` path
2. **Phase 2 UI integration** — wire `useUIMessages` behind a feature flag
3. **Embeddings provider** — once we have a key with embeddings access,
   re-enable `vectorSearch: true` in `triageAgent.ts`
4. **Caller migration of `/api/triage` → `convex.site/insforge-mirror`** —
   currently both endpoints coexist; pick one as the canonical route
5. **PostHog OTel SDK** — install `@opentelemetry/sdk-trace-base` +
   `@opentelemetry/sdk-trace-node` once the team commits to PostHog as
   the observability backend (`convex/observability.ts` activates
   automatically when both are present)
