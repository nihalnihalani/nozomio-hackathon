# Convex 2026 — Features & Triage Integration Plan

> Research compiled May 10, 2026 from official Convex docs, changelog, and product updates. The `/last30days` social-signal pass returned essentially no useful data — the term "Convex" collides with a Smash Bros player handle and a math research paper, so X/Reddit/YouTube were noise. The findings below come from `docs.convex.dev`, `news.convex.dev`, and the GitHub component repo.

---

## What's actually new in 2026

### Convex 1.35.x (April 2026)

- **Components define their own HTTP routes** in `http.ts` — a component can own a `/api/foo` route lifecycle. Relevant for letting the agent component own `/api/triage` internally instead of our hand-rolled Next.js route.
- **`npx convex dev --start` flag** runs your app dev command alongside the Convex dev server, replacing the `concurrently next,convex` pattern.
- **CLI deployment management:** `npx convex deployment create` + `select` + a `--deployment` flag accepting `dev`, `prod`, `dev/james`, etc. — proper dev/staging/prod separation.
- **Cache invalidation dashboard view** — debug query-cache hit rates per function.

### Convex 1.34.0 (March 2026)

- **`npx convex ai-files`** auto-manages `AGENTS.md`, `CLAUDE.md`, and guidelines/state files. The CLI keeps them in sync as schema and component APIs change. We have `CLAUDE.md` and `AGENTS.md` in the repo — they could be hooked into this.
- **`CONVEX_AGENT_MODE=anonymous`** for `npx convex init` — non-interactive setup for CI runners. Maps directly to our open Codex finding about the convex-typecheck CI gate.
- **Component codegen uses `ComponentApi` types** by default — better typing for component-based apps.

### `@convex-dev/agent` package (latest as of late 2025–early 2026)

- **AI SDK v5 native support** — the package now wraps AI SDK v5 directly. Most upgrades are backwards-compatible; some UI adjustments needed.
- **Delta streaming with `saveStreamDeltas: true`** — chunks save to the database as the LLM generates, so the client subscribes via reactive query instead of a long-lived HTTP connection. Survives Convex action time limits, page reloads, and crashes.
- **`useUIMessages`** hook — paginated message list with optional `stream: true` for delta streaming.
- **`useSmoothText`** hook — token-by-token render with adaptive smoothing.
- **`useStreamingUIMessages`** — streaming-only variant.
- **`DeltaStreamer`** class — low-level chunk saver with configurable throttling + compression.
- **Persistent threads** — every message saves to a thread, threads can be shared across users/agents, threads carry titles/summaries/userIds.
- **Built-in RAG** — hybrid vector + text search over message history; tool-based retrieval is a first-class pattern.
- **File handling** — agent saves uploads to Convex file storage automatically.
- **Agent playground** — debug UI for inspecting prompt/tool/metadata flow per thread.

### Async index backfills (Sept 2025)

- Stage indexes so backfilling doesn't block deployments. Important when we evolve the `triageRuns.similarIncidents` schema again.

### Runtime

- Actions run on Node 20 and 22. Node 18 deprecated. Confirms our `.nvmrc=24` choice.

### PostHog LLM Analytics integration

- Convex action initializes a `BasicTracerProvider` with PostHog's `PostHogTraceExporter` at module scope; AI SDK calls auto-emit `gen_ai` OTel spans.
- PostHog converts spans into `$ai_generation` events with cost/latency/model/prompt/response per call.
- Setup: set `POSTHOG_API_KEY` + `POSTHOG_HOST` as Convex env vars. Use the `@posthog/convex` npm package for events/identification/feature flags from mutations and actions.
- This replaces our `console.log` "observability" with real per-call traces SREs can query.

---

## What's already in Triage

Triage uses Convex BUT does NOT use the `@convex-dev/agent` package. We're hand-rolling:

- `convex/triage.ts` — V8 mutations/queries (`start`, `byId`, `recentRuns`, `createRun`, `setStatus`, `insertCitation`, `finalizeResult`)
- `convex/triage_node.ts` — `"use node"` actions (`run`, `runInternal`) that call our own `lib/agent/loop.ts`
- `convex/tools.ts` + `tools_node.ts` — V8 mutation `logToolCall` + Node actions for `recallSimilarIncidents` / `searchCode`
- `convex/reinforce.ts` + `reinforce_node.ts` — V8 helpers + Node action that writes the reinforcement memory event
- `convex/traceState.ts` — internal query `hasRecentTraceA`
- `convex/schema.ts` — `triageRuns` + `toolCalls` + `citations` + `memoryEvents`
- Frontend `useTriage` hook with manual reactive `useQueries` over `byId`

The `ArchitectureSlide.tsx` claim about "Convex Agent component" was already softened to "Convex actions + reactive useQuery" in the Codex pass-2 commit.

---

## Integration recommendations for Triage

Ranked by impact-vs-effort. Each one is independently shippable.

### 🟢 High impact, low effort

#### 1. Adopt `@convex-dev/agent` for managed threads + delta streaming
**What it solves:** the current `useTriageConvex` reshape produces token-level granularity through manual reactive queries. The agent component's delta streaming is purpose-built for this — `useUIMessages({ stream: true })` + `useSmoothText` give a token-by-token "agent thinking" trace for free, and the messages are auto-persisted to a thread.

**Concrete changes:**
- `npm i @convex-dev/agent`
- Register the component in `convex/convex.config.ts`
- Define a `triageAgent` in a new `convex/triageAgent.ts`:
  ```ts
  import { Agent } from "@convex-dev/agent";
  import { components } from "./_generated/api";
  import { openai } from "@ai-sdk/openai";

  export const triageAgent = new Agent(components.agent, {
    name: "Triage",
    chat: openai.chat("gpt-5"),
    instructions: await loadPrompt(),  // lib/prompts/triage-system.md
    tools: { recallSimilarIncidents, searchCode },
  });
  ```
- Replace `convex/triage_node.ts:runInternal`'s manual loop with `triageAgent.streamText(ctx, { threadId }, { prompt: trace }, { saveStreamDeltas: true })`
- Replace `useTriage` with `useUIMessages(api.triage.listMessages, { threadId }, { stream: true })`
- The `ArchitectureSlide` claim becomes truthful again

**Effort:** ~3–4 hours. Most risk is in mapping our existing `TriageResult` schema to the agent's `UIMessage` shape — keep the existing mutations for citations and finalizeResult but emit them as tool-call results.

#### 2. PostHog LLM Analytics for agent observability
**What it solves:** Codex flagged "no observability beyond console.log" as production-blocking. PostHog gives per-LLM-call cost/latency/model traces queryable in their dashboard.

**Concrete changes:**
- `npm i @posthog/convex` + `posthog-node`
- Set `POSTHOG_API_KEY` + `POSTHOG_HOST` in Convex env (`npx convex env set`)
- In `convex/triage_node.ts`, add the OTel `BasicTracerProvider` initialization at module scope per their docs
- Capture an `$ai_generation` event per agent run with `triageRunId`, `orgId`, citation count, latency

**Effort:** ~1 hour. Drop-in.

#### 3. `npx convex ai-files` for our `AGENTS.md` + `CLAUDE.md`
**What it solves:** the rules files drift from the actual Convex API as we add tables/components. The CLI auto-manages this.

**Concrete changes:**
- `npx convex ai-files install`
- Run `npx convex ai-files status` in CI (already added to `scripts/check-convex.sh`?)

**Effort:** ~10 minutes. Mostly just turning the feature on.

### 🟡 Medium impact, medium effort

#### 4. Replace `app/api/insforge-mirror/route.ts` with a component-defined HTTP route
**What it solves:** the cold-path mirror is currently a Next.js route Convex calls via `fetch`. With Convex 1.35 components defining their own HTTP routes, the InsForge mirror could live entirely inside Convex (as a component HTTP handler) — eliminates the Next.js round-trip and the shared-secret scheme.

**Concrete changes:**
- Move the mirror logic into a Convex component's `http.ts` with `httpAction` + path `/insforge-mirror`
- Convex action posts to `${CONVEX_SITE_URL}/insforge-mirror` instead of `${SITE_URL}/api/insforge-mirror`
- Drop the `INSFORGE_MIRROR_SECRET` shared-secret pattern in favor of Convex's internal auth

**Effort:** ~2 hours. Architectural win — eliminates one moving part.

#### 5. Async index backfills for the `similarIncidents` schema
**What it solves:** future schema migrations (e.g., adding a `branchId` for multi-branch triage) won't block deploy.

**Concrete changes:**
- When adding new indexes, use the staged-index pattern documented in v1.31

**Effort:** none today; remember-for-later.

#### 6. Convex Agent component's built-in RAG over message history
**What it solves:** "Trace A → Trace B" reinforcement is currently a hand-rolled `triage_history` source. The agent component's RAG primitive does hybrid vector+text search over thread message history natively — no separate `memoryEvents` table needed.

**Concrete changes:**
- Use `agent.streamText` with `contextOptions: { searchOlderMessages: true, vectorSearch: true }`
- Drop `convex/traceState.ts:hasRecentTraceA` — replaced by the agent's own context retrieval

**Effort:** ~2 hours. Simplifies the architecture but loses the explicit Trace-A-marker semantics. Trade-off: cleaner, but Codex's "honest gating" finding becomes harder to assert in tests.

### 🔴 High effort, evaluate separately

#### 7. Migrate to AI SDK v5
**What it solves:** the agent component is built on AI SDK v5; we're pinned at `ai@^4.0.0`. Most APIs are backwards-compatible but `streamText` signatures changed slightly and tool-call event shapes differ.

**Concrete changes:**
- `npm i ai@^5 @ai-sdk/openai@^5 @ai-sdk/react@^5`
- Update `lib/agent/loop.ts:runLive` to v5 signatures
- Re-run all 48 invariant tests

**Effort:** ~3 hours + risk surface. Defer until #1 lands; if we adopt the agent component, AI SDK v5 comes with it.

---

## Recommended sequencing for the Codex pass-3 follow-up branch

If you want to ship the highest-EV Convex modernization in one PR:

1. **`@convex-dev/agent` adoption** (#1 above) — replaces `lib/agent/loop.ts`'s 500+ lines with ~50 lines of agent config. Comes with AI SDK v5 (#7 free), proper streaming (#6 setup-free), and clean threading.
2. **PostHog LLM analytics** (#2) — production-grade observability.
3. **Component HTTP routes for the mirror** (#4) — eliminates the shared-secret + Next.js round-trip.
4. **`npx convex ai-files` enable** (#3) — keeps `CLAUDE.md`/`AGENTS.md` in sync as the API evolves.

Skip for now: #5 (no schema change pending), #6 (loses test rigor), #7 (folds into #1).

---

## What this means for the current PR

`feat/agent-backend` (PR #3) is honest about what's there: **manual Convex actions + reactive `useQuery`**, not the agent component. The architecture slide already says that. None of the 2026 Convex features above are blocking the demo — they're upgrade paths post-hackathon.

But: if you want the prize-winning version (Convex track judges will look for the agent component specifically), #1 is the unlock. It's a 3-hour migration that makes the "Convex" claim load-bearing again.

---

## Sources

- [AI Agents | Convex Developer Hub](https://docs.convex.dev/agents)
- [AI Agent | Convex Components](https://www.convex.dev/components/agent)
- [Convex 1.34.0 changelog](https://ship.convex.dev/changelog/convex-1-34-0)
- [Convex 1.35 changelog](https://ship.convex.dev/changelog/convex-1-35-0) (referenced)
- [Convex News — releases tag](https://news.convex.dev/tag/releases/)
- [Streaming | Convex Developer Hub](https://docs.convex.dev/agents/streaming)
- [Threads | Convex Developer Hub](https://docs.convex.dev/agents/threads)
- [Tools | Convex Developer Hub](https://docs.convex.dev/agents/tools)
- [`@convex-dev/agent` on npm](https://www.npmjs.com/package/@convex-dev/agent)
- [GitHub: get-convex/agent](https://github.com/get-convex/agent)
- [Stack: AI Agents with Built-in Memory](https://stack.convex.dev/ai-agents)
- [Stack: real-time streaming chat with persistent text streaming](https://stack.convex.dev/build-streaming-chat-app-with-persistent-text-streaming-component)
- [Convex News: Product Updates Volume 23](https://news.convex.dev/product-updates-volume-23/)
- [PostHog Convex LLM analytics docs](https://posthog.com/docs/llm-analytics/installation/convex)
- [`@posthog/convex` on npm](https://www.npmjs.com/package/@posthog/convex)
- [PostHog Convex source linking](https://posthog.com/docs/data-warehouse/sources/convex)
