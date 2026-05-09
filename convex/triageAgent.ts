"use node";

/**
 * Triage Agent — `@convex-dev/agent` adoption (Phases 1, 3, 4).
 *
 * Replaces `lib/agent/loop.ts:runLive` for the Convex live path. The
 * replay path (`lib/agent/loop.ts:runReplay`) stays in place and is
 * reached when `DEMO_MODE=replay` (Invariant 4 — Hermetic Demo Mode).
 *
 * Convex constraint: this file is `"use node"` because:
 *   - the system prompt is read from disk via `node:fs`
 *   - the Hyperspell + Nia clients use `node:crypto` + `node:fs`
 *
 * AI SDK version note (Phase 1 in `convexplan.md`): the project
 * previously pinned `@ai-sdk/anthropic@^1` + `ai@^4`. `@convex-dev/agent
 * @0.6.1` requires `ai@^6.0.35`; we bumped to `@ai-sdk/anthropic@^3`
 * + `ai@^6` + `@ai-sdk/react@^3`. The `lib/agent/loop.ts` live path
 * (`streamText` from `ai`) uses dynamic import + try/catch and is
 * compatible with v6 (`stepCountIs` + `tool` are still exported).
 *
 * createTool API note: in `@convex-dev/agent` v0.6.0 the keys were
 * renamed: `args` → `inputSchema`, `handler` → `execute`. We use the
 * v0.6+ names.
 */

import { Agent, createTool, stepCountIs } from "@convex-dev/agent";
import type { AgentComponent } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { components } from "./_generated/api";
import { getHyperspell, SOURCE_WEIGHTS } from "../lib/hyperspell/client";
import { getNia } from "../lib/nia/client";

// The committed `_generated/api.{d.ts,js}` fallback types `components`
// loosely (`AnyApi`). Live `npx convex dev` codegen overwrites this with
// precise per-component types, but until the user runs it locally we
// cast to the public `AgentComponent` shape so this file typechecks.
// Runtime is correct in both cases — `components.agent` is the same
// registered component reference under both type stories.
const agentComponent = components.agent as unknown as AgentComponent;

// ─── System prompt loader ─────────────────────────────────────────────────────

const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "triage-system.md"
);

function loadInstructions(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8");
  } catch {
    // Should never happen — the prompt is checked in. Fallback keeps the
    // Cite-Or-Die contract intact (Invariant 1) even if the file is
    // missing in some bundle.
    return "You are Triage, an incident-triage AI agent. Refuse to claim a root cause without a code citation. Refuse to assert a similar incident without a Hyperspell memory_id. If you cannot cite, say so explicitly.";
  }
}

// ─── Tools (Zod-typed, agent-component createTool) ────────────────────────────
//
// Both tools delegate to the existing `lib/{hyperspell,nia}/client.ts`
// clients — Invariant 4 replay branches stay in place under the hood.

const recallSimilarIncidents = createTool({
  description:
    "Search the team's Slack #incidents history, Notion postmortem database, and Gmail vendor outage threads via Hyperspell. Returns the top-5 most relevant memories with metadata (channel, author, timestamp, thread_id). Snippets are pre-verified — every memory has a Hyperspell `memory_id` for citation (Invariant 1).",
  inputSchema: z.object({
    signature: z
      .string()
      .min(1)
      .describe("Search query / error signature drawn from the stack trace"),
  }),
  execute: async (_ctx, { signature }) => {
    const hyperspell = getHyperspell();
    const res = await hyperspell.memories.search({
      query: signature,
      options: { source_weights: SOURCE_WEIGHTS, limit: 5 },
    });
    // Returning the raw Hyperspell `memories[]` lets the model cite each
    // memory by `id` (Invariant 1: Cite-Or-Die).
    return { memories: res.memories };
  },
});

const searchCode = createTool({
  description:
    "Search the production monorepo, ADRs, and runbooks via Nia. Returns code snippets with `file:line` locations and recent commits. Snippets are pre-verified — claimed file:line contains the claimed code (Invariant 1: Cite-Or-Die).",
  inputSchema: z.object({
    query: z.string().min(1).describe("Code-search query"),
  }),
  execute: async (_ctx, { query }) => {
    const nia = getNia();
    const res = await nia.search({
      query,
      mode: "query",
      include_sources: true,
    });
    return res;
  },
});

// ─── Agent ────────────────────────────────────────────────────────────────────

/**
 * Triage Agent — wired via the `agent` Convex component.
 *
 * Phase 4 — RAG over message history. `searchOtherThreads` enables the
 * Trace A → Trace B reinforcement effect natively (the agent has access
 * to prior triage threads from the same `userId` / `orgId`). We KEEP
 * the explicit `hasRecentTraceA` gate in `triageNode.ts` for honesty
 * (the Codex pass-3 finding requires the visible `[degraded]` event)
 * — RAG `searchOtherThreads` is *additive*, not a replacement.
 *
 * `stopWhen: stepCountIs(5)` mirrors the bound documented in
 * `lib/prompts/triage-system.md` ("Stop after at most 5 tool calls").
 */
export const triageAgent = new Agent(agentComponent, {
  name: "Triage",
  // Same Anthropic model as the existing `lib/agent/loop.ts` live path.
  // No model switch in this PR — keep the prompt-tuned behaviour.
  languageModel: anthropic("claude-sonnet-4-5"),
  instructions: loadInstructions(),
  tools: { recallSimilarIncidents, searchCode },
  stopWhen: stepCountIs(5),
  contextOptions: {
    // Phase 4 — built-in tool-based RAG over message history.
    // `searchOtherThreads: true` lets the agent surface relevant context
    // from prior threads belonging to the same userId (= orgId), which is
    // how Trace B naturally finds Trace A's run. The explicit
    // `traceState.hasRecentTraceA` probe in `triageNode.ts` produces the
    // user-visible `[degraded]` event when no prior Trace A exists.
    searchOtherThreads: true,
    // Sliding window of recent messages to include verbatim.
    recentMessages: 10,
    searchOptions: {
      // Text search over thread message history. We do NOT enable
      // `vectorSearch: true` here because that requires an
      // `embeddingModel` on the Agent constructor (e.g.
      // `openai.embedding("text-embedding-3-small")`). The project pins
      // Anthropic for chat — adding an embedding provider is an
      // intentional follow-up. Text search alone still surfaces prior
      // threads from the same `userId` (= orgId) when the trace tokens
      // overlap, which is sufficient for the Trace A → Trace B beat.
      limit: 10,
      textSearch: true,
    },
  },
});
