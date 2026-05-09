# convexplan.md — Convex 2026 Feature Adoption Plan for Triage

> **Mission:** make the "Convex hot path" claim in the architecture slide load-bearing. Today Triage uses Convex as a glorified key-value store + reactive query layer; the agent loop is hand-rolled in `lib/agent/loop.ts`. Convex shipped a complete agent runtime in 2025-26 (`@convex-dev/agent`) plus delta streaming, RAG, components system v2, deployment management, and PostHog LLM analytics. This plan adopts every feature that's load-bearing for a Track-4 + Convex-track win, ranked by impact-vs-effort, with concrete diffs.

**Compiled:** 2026-05-10. Sources at the bottom — most facts are docs-grounded; social signal is light because the term "Convex" collides with a Smash Bros player and a math research paper, so `/last30days` for "convex.dev platform agent component" returned only ~8 useful X posts.

---

## TL;DR — what to adopt, in order

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

**Total effort:** ~10 person-hours for the full migration. Phases 1–4 are the prize-track unlock (`@convex-dev/agent` is the headline Convex sponsor primitive). 5–7 are production polish.

---

## What's actually new in Convex (2026)

### `@convex-dev/agent` — the Agent Component

The flagship 2025–26 primitive. It's a TypeScript library that gives you persistent agent threads + tool calling + streaming + RAG, all backed by Convex's reactive database.

**Latest version on npm:** active development (March-May 2026 commits). Repo has `MIGRATION.md` + `TYPE_FIX_SUMMARY.md` indicating recent breaking changes — likely the AI SDK v5 migration.

**Core API:**

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
const app = defineApp();
app.use(agent);
export default app;
```

```ts
// convex/triageAgent.ts
import { Agent, stepCountIs, createTool } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";

export const triageAgent = new Agent(components.agent, {
  name: "Triage",
  languageModel: openai.chat("gpt-4o-mini"),
  textEmbedding: openai.embedding("text-embedding-3-small"),
  instructions: TRIAGE_SYSTEM_PROMPT,
  tools: { recallSimilarIncidents, searchCode },
  stopWhen: stepCountIs(5),  // bound the agent loop
});
```

```ts
// convex/triage.ts (V8 mutation that kicks off a run)
export const start = mutation({
  args: { orgId: v.string(), trace: v.string() },
  handler: async (ctx, { orgId, trace }) => {
    const threadId = await createThread(ctx, components.agent, {
      userId: orgId,
      title: `Triage: ${trace.slice(0, 60)}`,
    });
    await ctx.scheduler.runAfter(0, internal.triage_node.runTriage, {
      threadId, prompt: trace,
    });
    return threadId;
  },
});

// convex/triage_node.ts (Node action that runs the agent)
"use node";
export const runTriage = internalAction({
  args: { threadId: v.string(), prompt: v.string() },
  handler: async (ctx, { threadId, prompt }) => {
    const { thread } = await triageAgent.continueThread(ctx, { threadId });
    await thread.streamText({ prompt }, { saveStreamDeltas: true });
  },
});
```

**That's the entire backend.** It replaces `convex/tools.ts`, `convex/tools_node.ts`, the manual citation/toolCall mutations, and ~80% of `lib/agent/loop.ts`.

### Delta streaming

`saveStreamDeltas: true` saves response chunks to the DB as they generate. Clients subscribe via reactive query → see token-by-token updates without a long-lived HTTP connection. Survives action time limits, page reloads, and crashes.

**Server (one query exposes both message history + live deltas):**

```ts
// convex/triage.ts
export const listMessages = query({
  args: { threadId: v.string(), paginationOpts: v.any() },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, args);
    const streams = await syncStreams(ctx, components.agent, args);
    return { ...paginated, streams };
  },
});
```

**Client (`useUIMessages` + `useSmoothText`):**

```tsx
const { results } = useUIMessages(
  api.triage.listMessages,
  { threadId },
  { stream: true }
);
const lastMessage = results.at(-1);
const [visibleText] = useSmoothText(lastMessage?.text ?? "", {
  startStreaming: lastMessage?.status === "streaming",
});
```

**Streaming options on `streamText`:**
- `chunking: "word" | "line" | regex | (s) => string[]` — delta granularity
- `throttleMs` — debounce writes
- `compressUIMessageChunks` — collapses rapid deltas
- `abortSignal` + `onAsyncAbort` — cancellation
- `optimisticallySendMessage` — instant UI echo before server confirms

### Tools with thread context

`createTool` is the recommended factory. Tools get `ctx.userId`, `ctx.threadId`, plus any custom context fields you declare via the Agent's generic.

```ts
const recallSimilarIncidents = createTool({
  description: "Search Slack #incidents + Notion postmortems + Gmail vendor outages",
  args: z.object({ signature: z.string().describe("error signature") }),
  handler: async (ctx, { signature }) => {
    // ctx.userId, ctx.threadId available here
    const memories = await hyperspell.memories.search({
      query: signature,
      options: { source_weights: SOURCE_WEIGHTS, limit: 5 },
    });
    return { memories };
  },
});
```

When `stopWhen: stepCountIs(N)` and `N > 1`, the agent automatically loops: tool result → next LLM call → next tool → ... until the LLM stops calling tools or N steps elapse. **Replaces our manual loop.**

### Built-in RAG over message history

The Agent component has hybrid text + vector search over thread messages built in. Two patterns:

1. **Prompt-based RAG** — the system auto-searches and injects context before each prompt. Good for "always need context" scenarios. Toggle via `contextOptions`.
2. **Tool-based RAG** — give the LLM a search tool, let it decide when to query. Already what we do with `recallSimilarIncidents`.

`contextOptions` flags:
- `searchOtherThreads: true` — search across the user's other threads (Trace A → Trace B reinforcement falls out for free)
- `vectorSearch: true` — hybrid vector + text
- `recentMessages: N` — sliding window of N most recent

Separate **RAG Component** (`@convex-dev/rag`) exists for namespaced external data (docs, knowledge base) — orthogonal to the agent's message-history search.

### Convex Components system

Components are "mini self-contained Convex backends." They have isolated tables + functions, register via `convex.config.ts`, and (in 1.35+) **define their own HTTP routes**. The Agent component is one of these; others include RAG, Workflow, Sharded Counter, Persistent Text Streaming, Resend (email), Rate Limiter, and Better Auth.

Cross-component imports work, but components can't access app data unless explicitly granted.

### Recent platform features (1.32–1.35)

| Version | Feature | Use for Triage |
|---|---|---|
| **1.35** | Components define `http.ts` HTTP routes | Move `/api/insforge-mirror` inside a custom mirror component |
| **1.35** | `npx convex dev --start <cmd>` | Replace our `concurrently next,convex` dev script |
| **1.35** | `npx convex deployment create/select` + `--deployment` flag | Cleaner staging/prod separation |
| **1.35** | Cache invalidation dashboard | Debug query-cache hit rates per function |
| **1.34** | `npx convex ai-files` manages `CLAUDE.md` / `AGENTS.md` | Keep our existing rules files in sync as the API evolves |
| **1.34** | `CONVEX_AGENT_MODE=anonymous` for non-interactive `convex init` | CI workflows can spin up a dev deployment without prompts |
| **1.34** | Component codegen uses `ComponentApi` types | Better typing for our Agent integration |
| **(2025)** | Async index backfills | Future schema changes don't block deploys |
| **(2025)** | AI SDK v5 native support in agent component | Folds into Phase 1 |
| **(2025)** | Node 20 + 22 actions; Node 18 deprecated | We pinned Node 24 in `.nvmrc` already |

### Better-Auth integration (community signal)

`@convex-dev/better-auth@0.11.4` shipped April 2026 — replaces Prisma-based Better Auth wiring with native Convex tables. **3 config files for email + OAuth, reactive queries on session state.** Multiple X posts (@LeVraiMD, @alihamasdev, @wiesson) discussing it. *Out of scope for Triage* — we use InsForge magic-link — but worth knowing for follow-on projects.

### PostHog LLM Analytics

`@posthog/convex` ships an OTel `BasicTracerProvider` initialized at module scope. AI SDK calls auto-emit `gen_ai` spans → PostHog converts them to `$ai_generation` events with cost/latency/model/prompt/response per call. Setup is an env var pair (`POSTHOG_API_KEY` + `POSTHOG_HOST`) and module-level provider boot.

### What the X chatter is saying (last 30 days)

| Signal | Quote / source |
|---|---|
| `convex codegen` template-based, no cloud round-trip | *"My solution: template-based generation. Scans s..."* — @NabhaniMehdi |
| Multiple `convex dev` instances finally shipped | *"Finally this is shipped, I can't wait to run multiple convex dev instances!"* — @leodev |
| `npx convex` vs `pnpm dlx convex` vs `pnpx convex` DX confusion | @nicu_tsx |
| Better-Auth integration friction with Convex 1.6 contract changes | @wiesson, @drgdfyi |

The community signal isn't load-bearing for our plan but confirms the agent component + multi-deployment flow are actively iterated.

---

## Triage today vs target state — feature by feature

### 1. Agent runtime

| | Today | Target |
|---|---|---|
| Where the loop lives | `lib/agent/loop.ts` (500+ lines, hand-rolled `streamText` + tool dispatch + stopWhen + replay branch) | `convex/triageAgent.ts` (~50 lines of `Agent` config) |
| How tools are dispatched | Manual switch in `runLive()` calling Hyperspell + Nia clients | `Agent.tools` prop + `stepCountIs(5)` |
| How tool calls persist | Manual `internal.tools.logToolCall` mutation per call | Automatic — agent component writes to its own message tables |
| Multi-step loop | Hand-rolled with `maxSteps` fallback for AI SDK v4 vs v5 | Native `stopWhen` |
| Replay path | `runReplay()` in same file, fixture-driven | Move to a separate adapter that bypasses the agent in `DEMO_MODE=replay`; only the agent component runs in `live`. We keep the no-keys demo. |

### 2. Frontend trace UI

| | Today | Target |
|---|---|---|
| Reactive subscription | `useQueries({ ...api.triage.byId, args: { id } })` returning manual `{ run, toolCalls, citations }` shape | `useUIMessages(api.triage.listMessages, { threadId }, { stream: true })` |
| Token granularity | Per-event (entire tool call lands at once) | Per-token via `useSmoothText` + `saveStreamDeltas` |
| Citation pills | `convex/triage.ts:insertCitation` mutation called from agent loop, then resolved by `_id` lookup in hook | Citations as message metadata or as tool-call results in `UIMessage` shape |
| Reshape complexity | `convexSnapshotToTriageSnapshot()` ~50 lines of glue + placeholder fallbacks | Direct UIMessage rendering; reshape function shrinks to ~10 lines |
| Mode detection | `hasConvex()` checks `NEXT_PUBLIC_CONVEX_URL` | Same — but the SSE fallback can lift more from the agent's API for parity |

### 3. Trace A → Trace B gating

| | Today | Target |
|---|---|---|
| Where state lives | `convex/traceState.ts:hasRecentTraceA` query + module-local Map fallback | Built-in via `contextOptions: { searchOtherThreads: true }` — the agent's RAG finds prior triages naturally |
| Honesty test | `tests/invariants/trace_state.test.ts` mocks the probe with `{true, false, null}` | Test changes shape; the gating becomes "did the recall return reinforced memories?" rather than "did a marker exist?" |
| Risk | Codex flagged this as production-blocking; we mitigated with the Convex query | Cleaner architecture — but we lose the explicit "[degraded]" error event Codex wanted us to surface |

**Decision:** keep the explicit gating logic. The Codex finding (Trace B without prior Trace A is degraded) is a load-bearing demo-honesty claim, and built-in RAG would silently return whatever it finds. We hybridize: agent uses RAG natively, but our `convex/triage_node.ts` runs `internal.traceState.hasRecentTraceA` and emits the `[degraded]` error event if no prior Trace A exists for the org.

### 4. Cold path (InsForge mirror)

| | Today | Target |
|---|---|---|
| Where the route lives | `app/api/insforge-mirror/route.ts` (Next.js) | Either keep as-is OR move into a custom Convex component's `http.ts` (1.35+ feature) |
| Auth | Shared `INSFORGE_MIRROR_SECRET` header | Convex internal (component-to-component) |
| Citations passed? | Yes (pass-3 fix) | Yes |

**Decision:** *defer* moving the route to a component. The current Next.js route is honest and works; component-HTTP-routes is a polish. Spend that effort elsewhere.

### 5. Observability

| | Today | Target |
|---|---|---|
| What we capture | `console.log` + `console.warn` | `@posthog/convex` OTel provider → `$ai_generation` events with cost/latency/model |
| Where to query | Convex dashboard logs (15-min retention by default) | PostHog LLM Analytics dashboard |

### 6. Schema & migrations

| | Today | Target |
|---|---|---|
| `triageRuns` | Hot-path, full result fields persisted | If we adopt agent component fully, `triageRuns` becomes `threadId` + `inputTrace` + `status` + `orgId`; the result lives in messages |
| `toolCalls` | Custom table | Replaced by agent component's internal tables |
| `citations` | Custom table | Replaced by tool-call result messages |
| `memoryEvents` | Custom table for reinforcement audit | Keep — this is our explicit Trace A marker |

**Migration strategy:** add a `threadId` field to `triageRuns`, dual-write during transition, deprecate `toolCalls` + `citations` tables only after the UI fully consumes UIMessages.

---

## Sequenced 6-phase migration

### Phase 1 — `@convex-dev/agent` adoption (4h)

**Files to create:**
- `convex/convex.config.ts` — register agent component
- `convex/triageAgent.ts` — `Agent` instance + tool definitions

**Files to modify:**
- `convex/triage.ts` — `start` mutation creates a thread instead of a triageRun row; schedules the runner action
- `convex/triage_node.ts` — `runTriage` action does `agent.streamText(ctx, { threadId }, { prompt }, { saveStreamDeltas: true })`
- `convex/schema.ts` — add `threadId: v.string()` to `triageRuns`; keep other fields for backward compat during transition
- `package.json` — `npm i @convex-dev/agent`

**Files to delete (eventually, not in this phase):**
- `lib/agent/loop.ts:runLive` (the live half — the replay half stays)
- `convex/tools.ts:logToolCall` mutation
- Most of `convex/tools_node.ts`

**Risk:**
- The 48-test suite asserts on the current schema/event shape. ~15 tests will break and need rewrites. Budget 1h of the 4h for test rewrites.
- AI SDK v5 migration is a side-effect (the agent component requires it). Run all tests after the package install before doing anything else.

**Verify:**
- `npx convex dev --once` succeeds (we already pass this)
- `npm test` — track which tests break
- `npm run build` clean

### Phase 2 — Delta streaming + `useUIMessages` (1.5h)

**Files to modify:**
- `convex/triage.ts` — add `listMessages` query that returns `listUIMessages` + `syncStreams`
- `lib/hooks/useTriage.ts:useTriageConvex()` — replace the manual `useQueries(byId)` plumbing with `useUIMessages` + `useSmoothText`
- `components/TraceUI.tsx` — render `UIMessage` shape directly; per-token text via `useSmoothText`

**Risk:** the `convexSnapshotToTriageSnapshot` helper currently maps Convex docs to `TriageRunSnapshot`. After Phase 2, the SSE path and Convex path will produce *different* shapes (UIMessage vs the old snapshot). Either:
- (a) Reshape UIMessage back into TriageRunSnapshot on the Convex side (preserves UI), OR
- (b) Reshape SSE events into UIMessage on the SSE side (unifies on agent component's shape)

(b) is the cleaner long-term move; (a) is the safer pass-1.

**Verify:**
- Token-by-token "agent thinking" trace renders in Convex mode
- SSE path still works (no Convex configured)
- 🧠 reinforcement badge still fires (the `fromTriageHistory` flag survives the reshape)

### Phase 3 — `createTool` Zod-typed tool defs (1h)

**Files to modify:**
- `convex/triageAgent.ts` — define `recallSimilarIncidents` and `searchCode` via `createTool({ description, args: z.object(...), handler })`
- The handlers call our existing `lib/hyperspell/client.ts` and `lib/nia/client.ts` — no change to those clients
- `convex/tools_node.ts` — keep only the parts that aren't replaced by the agent's tool dispatch

**Risk:** low. This is mostly mechanical translation.

**Verify:** the agent calls both tools correctly in a fresh run; tool results land as messages in the thread.

### Phase 4 — Built-in RAG with explicit gating preserved (1h)

**Files to modify:**
- `convex/triageAgent.ts` — `contextOptions: { searchOtherThreads: true, vectorSearch: true, recentMessages: 10 }`
- `convex/triage_node.ts` — keep the `hasRecentTraceA` probe call; emit `[degraded]` error event if false (preserves Codex pass-3 honesty)

**Verify:** `tests/invariants/trace_state.test.ts` still asserts the three probe-state outcomes. The semantics shift slightly (RAG finds prior thread messages naturally) but the explicit gate stays.

### Phase 5 — Component-defined HTTP route for InsForge mirror (2h, optional)

Defer unless time permits. Net win is removing the shared-secret pattern. Doesn't unlock prize-track points.

### Phase 6 — PostHog LLM Analytics (1h)

**Files to create:**
- `convex/observability.ts` — module-scope `BasicTracerProvider` + `PostHogTraceExporter`

**Files to modify:**
- `convex/triage_node.ts` — import for side effects (provider init)
- `.env.example` — add `POSTHOG_API_KEY` + `POSTHOG_HOST`
- `package.json` — `npm i @posthog/convex posthog-node @opentelemetry/api`

**Verify:** trigger a triage; observe `$ai_generation` events in PostHog dashboard.

### Phase 7 — `npx convex ai-files` (10m)

```bash
npx convex ai-files install
npx convex ai-files status
```

Add to `scripts/check-convex.sh` so CI fails if the rules drift.

### Phase 8 — already done

`.nvmrc` (Node 24), `convex.json` (Node-actions config), `npx convex deployment create/select` workflow documented in README. Pass-3 commit `58021a3` covers this.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Agent component requires AI SDK v5; we pin v4 | Phase 1 includes the SDK upgrade. Test suite catches regressions. |
| `convex/_generated/api` shape changes after agent component registers | Our committed fallback stubs use `AnyApi`; live codegen overwrites. Phase 1 verification step is `npx convex dev --once` + `npm run typecheck`. |
| Replay-mode demo path needs to bypass the agent | Add a `process.env.DEMO_MODE === "replay"` branch in `convex/triage.ts:start` that scheduler-skips `runTriage` and writes a fake "done" run from the fixture. Preserves the no-keys demo. |
| 48-test suite breaks heavily | Phase 1 budgets 1h for test rewrites. The fixture-shape tests break; the invariant assertions remain valid. |
| Trace A → Trace B explicit gating gets implicit-only via RAG | Keep `hasRecentTraceA` probe; emit `[degraded]` error event in degraded path. The Codex pass-3 honesty fix isn't dropped. |
| SSE fallback path drifts from Convex path's UIMessage shape | Phase 2 reshapes both sides to a common UIMessage-like contract; behavioral test checks parity. |
| PostHog OTel provider double-init across V8 isolate warm starts | Use `globalThis.__posthog_init__` guard. Pattern documented in PostHog Convex docs. |
| InsForge mirror migration is a tarpit | Defer Phase 5 until everything else lands. |
| Agent component breaking changes (`MIGRATION.md` exists) | Pin to a specific version in `package.json`; read the migration guide before bumping. |

---

## Concrete diff summary (target end-state)

```
+ convex/convex.config.ts              new — registers Agent component
+ convex/triageAgent.ts                new — Agent instance + Zod tools
+ convex/observability.ts              new — PostHog OTel provider
~ convex/triage.ts                     simplified — start() creates thread
~ convex/triage_node.ts                simplified — runTriage = streamText
~ convex/schema.ts                     adds threadId; deprecates toolCalls + citations
~ convex/tools.ts                      mostly deleted
~ convex/tools_node.ts                 mostly deleted
~ convex/reinforce.ts + reinforce_node.ts  unchanged
~ convex/traceState.ts                 unchanged (gating preserved)
- lib/agent/loop.ts                    runLive removed; runReplay kept for SSE path
~ lib/hooks/useTriage.ts               Convex path uses useUIMessages + useSmoothText
~ components/TraceUI.tsx               renders UIMessage shape
~ tests/invariants/*                   ~15 tests rewritten for new shape
+ .nvmrc                               already done
+ convex.json                          already done
+ docs/CONVEX_AGENT_MIGRATION.md       new — migration log
```

---

## Why this matters for prize-stack

The `ArchitectureSlide.tsx` claim was softened in pass-2 to *"Convex actions + reactive useQuery"* — honest, but it concedes the Convex track. **Convex track judges look for the Agent component specifically.** Adopting it makes the architecture claim load-bearing again AND simplifies the codebase by ~400 lines.

This is a strict upgrade for:
- **Convex track** — agent component is the headline 2026 primitive
- **Hyperspell track** — built-in RAG over thread history is a clean place to layer Hyperspell's recall semantics
- **Overall 1st** — token-by-token streaming is the demo-day "wow" moment

Skip-cost (don't migrate): we keep the manual implementation, which works but loses the Convex track and looks dated next to teams that adopted the component.

---

## What `/last30days` actually surfaced

For full transparency: the social-signal pass returned **8 X posts and 3 YouTube videos** for "convex.dev platform agent component." Most useful items:

- **`@convex-dev/better-auth@0.11.4`** auth-without-Prisma integration (per @LeVraiMD, @alihamasdev, @wiesson) — out of scope for Triage but worth knowing
- **Multi-deployment local dev** finally shipped (per @leodev)
- **Template-based codegen** without cloud (per @NabhaniMehdi) — this is what `npx convex codegen` now does
- **pnpm/pnpx convex DX** churn (per @nicu_tsx) — minor; doesn't affect us
- The 3 YouTube videos are tutorials about building AI agent platforms ON Convex but predate the agent component being load-bearing — outdated

Raw output: [`research/convex-dev-platform-agent-component-convex-dev-agent-raw.md`](./research/convex-dev-platform-agent-component-convex-dev-agent-raw.md)

---

## Sources

Docs-grounded primary research:
- [AI Agents | Convex Developer Hub](https://docs.convex.dev/agents) — overview
- [Threads | Convex Developer Hub](https://docs.convex.dev/agents/threads) — `createThread`, `continueThread`, `listThreadsByUserId`, lifecycle
- [Tools | Convex Developer Hub](https://docs.convex.dev/agents/tools) — `createTool`, Zod schemas, `stepCountIs`
- [Streaming | Convex Developer Hub](https://docs.convex.dev/agents/streaming) — `saveStreamDeltas`, `useUIMessages`, `useSmoothText`, `DeltaStreamer`
- [Messages | Convex Developer Hub](https://docs.convex.dev/agents/messages) — `MessageDoc` vs `UIMessage`, `listUIMessages`, `saveMessage`
- [RAG | Convex Developer Hub](https://docs.convex.dev/agents/rag) — built-in vector + text search; tool-based vs prompt-based RAG
- [Getting Started | Convex Developer Hub](https://docs.convex.dev/agents/getting-started) — install + first agent
- [Components | Convex Developer Hub](https://docs.convex.dev/components) — components system overview
- [`@convex-dev/agent` on npm](https://www.npmjs.com/package/@convex-dev/agent) — versions, peer deps
- [GitHub: get-convex/agent](https://github.com/get-convex/agent) — `MIGRATION.md`, `TYPE_FIX_SUMMARY.md`, examples
- [Convex 1.34 changelog](https://ship.convex.dev/changelog/convex-1-34-0) — AI context files, deployment management
- [Convex Stack: AI Agents with Built-in Memory](https://stack.convex.dev/ai-agents) — concrete code patterns
- [Convex Stack: streaming chat tutorial](https://stack.convex.dev/build-streaming-chat-app-with-persistent-text-streaming-component)
- [PostHog LLM Analytics — Convex install](https://posthog.com/docs/llm-analytics/installation/convex)
- [`@posthog/convex` on npm](https://www.npmjs.com/package/@posthog/convex)

Light social-signal corroboration:
- 8 X posts (mostly Better-Auth and CLI DX), 3 YouTube tutorials — see raw research file linked above
