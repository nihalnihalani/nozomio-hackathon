---
name: convex-migration
description: Roadmap for migrating Triage to @convex-dev/agent component (threads + delta streaming + built-in RAG + PostHog observability). Triggers when adopting Convex's 2026 agent primitives or evaluating the Convex track win.
---

# Convex Migration

> Plan to replace Triage's hand-rolled `lib/agent/loop.ts` with the
> `@convex-dev/agent` component, adopt delta streaming + built-in RAG,
> and wire PostHog LLM analytics — making the "Convex hot path" claim in
> the architecture slide load-bearing instead of decorative.

This skill is the project-local digest of `convexplan.md`. Defer to that
file for full diffs, source citations, and risk-register details.

## When to use this skill

- Reading or referencing `convexplan.md` and need the structured summary
- Planning the actual migration (what order, what files, what breaks)
- Deciding what to defer post-hackathon vs ship for the demo
- Evaluating whether the Convex track is winnable given current state
  (`DEMO_MODE=replay`, AI SDK v4, 48-test suite passing)
- Pitching the architecture story: "we use the 2026 Convex Agent
  component, not just Convex as a key-value store"

## TL;DR — the 6-phase table (verbatim from convexplan.md)

| Phase | Feature | Effort | Triage today | After |
|---|---|---|---|---|
| **1** | **`@convex-dev/agent` component** (Agent class, threads, tool calling) | 4h | hand-rolled `lib/agent/loop.ts` (500+ lines) | ~50 lines of agent config + tools |
| **2** | **Delta streaming** (`saveStreamDeltas` + `useUIMessages` + `useSmoothText`) | 1.5h | manual reactive `useQueries`, per-event granularity | token-by-token "agent thinking" via DB-backed deltas |
| **3** | **`createTool` Zod-typed tools with thread context** | 1h | hand-rolled `recallSimilarIncidents` / `searchCode` actions | Zod-validated tool defs that pass thread metadata + userId |
| **4** | **Built-in tool-based RAG** over message history | 1h | external `traceState.hasRecentTraceA` query + module-local Map | Agent's own message-history search + `searchOtherThreads` |
| **5** | **Component HTTP routes** (1.35+) for the InsForge mirror | 2h | `app/api/insforge-mirror/route.ts` + shared secret | mirror lives inside a Convex component's `http.ts` |
| **6** | **`@posthog/convex` LLM analytics** | 1h | `console.log` "observability" | per-call cost/latency/model traces in PostHog |
| **7** | **`npx convex ai-files`** auto-managed `CLAUDE.md` / `AGENTS.md` | 10m | manual edits, drifting from API | CLI keeps them in sync |
| **8** | **Deployment management CLI** + `.nvmrc` already done | 0 | done in pass-3 | done |

**Total effort:** ~10 person-hours. Phases 1–4 are the prize-track unlock;
5–7 are production polish.

## Files each phase touches

### Phase 1 — `@convex-dev/agent` adoption (4h)

- **Create:** `convex/convex.config.ts`, `convex/triageAgent.ts`
- **Modify:** `convex/triage.ts`, `convex/triage_node.ts`, `convex/schema.ts`, `package.json`
- **Delete (eventually, not in this phase):** `lib/agent/loop.ts:runLive` (live half), `convex/tools.ts:logToolCall`, most of `convex/tools_node.ts`

### Phase 2 — Delta streaming + `useUIMessages` (1.5h)

- **Modify:** `convex/triage.ts` (add `listMessages` query), `lib/hooks/useTriage.ts`, `components/TraceUI.tsx`

### Phase 3 — `createTool` Zod-typed tool defs (1h)

- **Modify:** `convex/triageAgent.ts` (define tools via `createTool`), `convex/tools_node.ts` (keep only what isn't replaced). `lib/hyperspell/client.ts` and `lib/nia/client.ts` unchanged.

### Phase 4 — Built-in RAG with explicit gating preserved (1h)

- **Modify:** `convex/triageAgent.ts` (add `contextOptions`), `convex/triage_node.ts` (keep `hasRecentTraceA` probe + emit `[degraded]` event)

### Phase 5 — Component-defined HTTP route for InsForge mirror (2h, optional)

- Defer unless time permits. Net win is removing the shared-secret pattern; doesn't unlock prize-track points.

### Phase 6 — PostHog LLM Analytics (1h)

- **Create:** `convex/observability.ts`
- **Modify:** `convex/triage_node.ts` (side-effect import), `.env.example` (`POSTHOG_API_KEY` + `POSTHOG_HOST`), `package.json`

### Phase 7 — `npx convex ai-files` (10m)

- Run `npx convex ai-files install` + `status`. Add to `scripts/check-convex.sh`.

### Phase 8 — already done

- `.nvmrc` (Node 24), `convex.json` (Node-actions config), deployment CLI workflow in README. Pass-3 commit `58021a3`.

## Critical caveats

- **AI SDK v5 upgrade required.** `@convex-dev/agent` requires AI SDK v5;
  Triage currently pins v4 in `package.json`. Phase 1 forces a side-effect
  upgrade. The agent component repo has `MIGRATION.md` and
  `TYPE_FIX_SUMMARY.md` indicating recent breaking changes — read both
  before bumping the package.
- **~15 of 48 tests will break.** The fixture-shape and event-shape
  assertions are tightly coupled to the current schema (`triageRuns`,
  `toolCalls`, `citations` tables). Phase 1 budgets 1h for test
  rewrites; the invariant assertions themselves remain valid.
- **Breaks the working demo if rushed.** Replay mode (`DEMO_MODE=replay`)
  must keep working — add a `process.env.DEMO_MODE === "replay"` branch
  in `convex/triage.ts:start` that scheduler-skips `runTriage` and writes
  a fake "done" run from the fixture. Without that branch, the no-keys
  demo dies.
- **Only valuable if `DEMO_MODE=live` is also activated.** The agent
  component, delta streaming, and tool-based RAG are all hot-path
  features. Per the separate go/no-go investigation, `DEMO_MODE=live`
  is currently **NO-GO** for the demo (sponsor keys not provisioned,
  hermetic replay is the safe path). Migration without flipping live
  mode = ~10 person-hours for zero demo-day visible difference.
- **Trace A → Trace B explicit gating must survive.** Built-in RAG would
  silently return whatever it finds; the Codex pass-3 honesty fix
  requires an explicit `[degraded]` error event when no prior Trace A
  exists. Phase 4 hybridizes: agent uses RAG natively, but
  `convex/triage_node.ts` still runs `internal.traceState.hasRecentTraceA`.

## Decision matrix

| Situation | Recommendation |
|---|---|
| Demo is tomorrow, replay-only | **Don't migrate.** Cite convexplan as "post-hackathon roadmap." |
| Live mode flips to GO and there's >12h | Phases 1–4 only. Skip 5–7. |
| Live mode flips to GO and there's >24h | Phases 1–6. Skip 5 (insforge mirror move). |
| Post-hackathon polish | All 8 phases in order. Phase 5 last. |

## Why this matters for prize-stack

The `ArchitectureSlide.tsx` claim was softened to *"Convex actions +
reactive useQuery"* — honest, but it concedes the Convex track. Convex
track judges look for the **agent component specifically**. Adopting
it makes the architecture claim load-bearing again AND simplifies the
codebase by ~400 lines. Strict upgrade for: Convex track, Hyperspell
track (RAG layering), and overall 1st (token-by-token streaming is the
demo-day "wow" moment).

## See also

- [`convexplan.md`](../../../convexplan.md) — full plan with diffs, risk
  register, source citations
- [`README.md`](../../../README.md) — project overview, current
  architecture, demo-mode flags
- [`AGENTS.md`](../../../AGENTS.md) — agent loop conventions and
  invariants (Trace A/B, replay branches, reinforce chokepoint)
- [`convex/triageNode.ts`](../../../convex/triageNode.ts) — current
  hand-rolled runner that Phase 1 replaces
- [`lib/agent/loop.ts`](../../../lib/agent/loop.ts) — the 500-line
  `runLive` + `runReplay` that Phase 1 collapses to ~50 lines of agent
  config (replay half stays, live half is deleted)
