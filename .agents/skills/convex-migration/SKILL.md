---
name: convex-migration
description: Reference for the @convex-dev/agent integration (DONE — PR #8/#10/#11 merged). Threads + delta streaming + built-in RAG + PostHog observability shipped this session. Triggers for post-migration troubleshooting or understanding the live vs replay split.
---

# Convex Migration

> Reference for the @convex-dev/agent integration (DONE — PR #8/#10/#11
> merged). Triage's hand-rolled `lib/agent/loop.ts` was replaced with
> the `@convex-dev/agent` component, delta streaming + built-in RAG were
> adopted, and PostHog LLM analytics were wired in — making the "Convex
> hot path" claim in the architecture slide load-bearing.

This skill is the project-local digest of `convexplan.md` plus the
post-migration reality. Defer to `convexplan.md` for the original plan,
and to `docs/CONVEX_AGENT_MIGRATION.md` for the as-built notes.

## When to use this skill

- Post-migration troubleshooting (live mode failing, fixture loading,
  embeddings 401s)
- Understanding the live vs replay split (`DEMO_MODE=live` vs
  `DEMO_MODE=replay`) and which paths each exercises
- Reading or referencing `convexplan.md` and need the structured summary
  alongside what actually shipped
- Onboarding to the `@convex-dev/agent` integration after the fact
- Pitching the architecture story: "we use the 2026 Convex Agent
  component, not just Convex as a key-value store"

## TL;DR — the 8-phase table (all DONE)

| Phase | Feature | Status | Delivered by |
|---|---|---|---|
| **1** | **`@convex-dev/agent` component** (Agent class, threads, tool calling) | ✅ DONE | PR #8 |
| **2** | **Delta streaming** (`saveStreamDeltas` + `useUIMessages` + `useSmoothText`) | ✅ DONE | PR #8 (backend) + PR #10 (UI) |
| **3** | **`createTool` Zod-typed tools with thread context** | ✅ DONE | PR #8 |
| **4** | **Built-in tool-based RAG** over message history | ✅ DONE | PR #8 |
| **5** | **InsForge mirror as Convex component** | ✅ DONE | PR #9 |
| **6** | **`@posthog/convex` LLM analytics** | ✅ DONE | PR #8 |
| **7** | **`npx convex ai-files`** auto-managed `CLAUDE.md` / `AGENTS.md` | ✅ DONE | PR #8 |
| **8** | **Deployment management CLI** + `.nvmrc` | ✅ DONE | pass-3 commit `58021a3` |

PR #11 corrected live-mode Hyperspell endpoints after the main migration
landed. Test count went from 35 → **63 passing**.

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

## Critical caveats (actually encountered)

- **OpenAI service-account keys fail on `/v1/embeddings`.** Keys with the
  `sk-svcacct-...` prefix do not have access to the embeddings endpoint
  and 401 silently. Use a project key (`sk-proj-...`) for
  `OPENAI_API_KEY` when running `DEMO_MODE=live`. This was the single
  biggest live-mode gotcha.
- **Convex sandbox doesn't ship the `data/` folder.** Filesystem reads
  (`fs.readdir`, `fs.readFile` against `data/`) fail in deployed Convex
  actions. The fix in `lib/agent/loop.ts:loadFixtures` is **static JSON
  imports** of `trace-a.json` and `trace-b.json` so the fixtures bundle
  into the sandbox.
- **`@convex-dev/agent@0.6` API differs from convexplan.md.** When
  reading the original plan, translate as you go:
  - `args` → `inputSchema`
  - `handler` → `execute`
  - `textEmbeddingModel` → `embeddingModel`
- **Replay path must stay intact.** `DEMO_MODE=replay` (default) is
  still the demo lifeboat. The migration kept this branch — don't
  delete it when refactoring further.
- **Trace A → Trace B explicit gating still required.** Built-in RAG
  returns whatever it finds; the honesty fix requires an explicit
  `[degraded]` event when no prior Trace A exists. The hybrid is in
  place: agent uses RAG natively, but `convex/triage_node.ts` still
  runs `internal.traceState.hasRecentTraceA`.

## Lessons learned (plan vs reality)

- **AI SDK upgrade was painless.** Plan predicted ~15 broken tests from
  the `ai@^4.0.0 → ai@^6.0.177` bump. Actual: **0 broken tests.** The
  replay path doesn't exercise the breaking SDK surfaces, and the live
  path was rewritten anyway.
- **Test count went up, not down.** 35 → 63 passing. The new agent
  surface added testable seams; the invariant assertions transferred
  cleanly.
- **Live mode shipped.** End-to-end works with a project-scoped
  `OPENAI_API_KEY=sk-proj-...`. The "live mode is NO-GO for demo"
  assumption from the original plan no longer applies.
- **Phase 5 (InsForge mirror) was easier than budgeted.** Delivered as
  its own focused PR (#9) instead of being deferred.
- **API drift in `@convex-dev/agent` 0.6** caught us once per tool
  definition. Worth grepping the agent repo's `MIGRATION.md` before
  copying snippets out of older docs.

## Why this matters for prize-stack

The `ArchitectureSlide.tsx` claim was softened to *"Convex actions +
reactive useQuery"* — honest, but it concedes the Convex track. Convex
track judges look for the **agent component specifically**. Adopting
it makes the architecture claim load-bearing again AND simplifies the
codebase by ~400 lines. Strict upgrade for: Convex track, Hyperspell
track (RAG layering), and overall 1st (token-by-token streaming is the
demo-day "wow" moment).

## See also

- [`docs/CONVEX_AGENT_MIGRATION.md`](../../../docs/CONVEX_AGENT_MIGRATION.md)
  — as-built notes from the migration session (what shipped in PR
  #8/#9/#10/#11)
- [`convexplan.md`](../../../convexplan.md) — original plan with diffs,
  risk register, source citations (translate API names per the caveats
  above)
- [`README.md`](../../../README.md) — project overview, current
  architecture, demo-mode flags
- [`AGENTS.md`](../../../AGENTS.md) — agent loop conventions and
  invariants (Trace A/B, replay branches, reinforce chokepoint)
- [`lib/agent/loop.ts`](../../../lib/agent/loop.ts) — post-migration
  runner with `loadFixtures` using static JSON imports for the
  Convex sandbox
