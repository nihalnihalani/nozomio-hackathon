"use node";
/**
 * Node-runtime Convex actions for the two agent tools.
 *
 * These are NOT the AI-SDK `tool()` definitions used inside the agent
 * loop — those live in `lib/agent/loop.ts`. These are Convex actions that
 * other Convex code (or the dashboard) can invoke directly to:
 *   1. exercise Hyperspell / Nia outside the agent loop (debug, scripts)
 *   2. log tool calls to the toolCalls table for the live trace UI
 *
 * Why "use node": both `lib/hyperspell/client.ts` and `lib/nia/client.ts`
 * import `node:fs`, `node:path`, and `node:crypto` for replay-mode fixture
 * I/O and cite-or-die hashing. Convex's V8-isolate runtime cannot resolve
 * `node:*` modules, so this directive is required for the bundler to
 * succeed.
 *
 * Invariant 1 (Cite-Or-Die): every tool call here returns the same
 * shape as the in-agent tool — citations carry `verified` flags.
 * Invariant 4 (Hermetic Demo Mode): the underlying clients silently
 * fall back to replay if keys are missing.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getHyperspell, SOURCE_WEIGHTS } from "../lib/hyperspell/client";
import { getNia } from "../lib/nia/client";

// ─── Tool: recallSimilarIncidents ─────────────────────────────────────────────

/**
 * Hyperspell memories.search wrapper.
 * Returns memories with source weighting tuned for SRE incidents.
 * Logs the call against `triageRunId` if provided.
 */
export const recallSimilarIncidents = action({
  args: {
    signature: v.string(),
    triageRunId: v.optional(v.id("triageRuns")),
  },
  handler: async (ctx, args) => {
    const start = Date.now();
    const hyperspell = getHyperspell();
    const result = await hyperspell.memories.search({
      query: args.signature,
      options: { source_weights: SOURCE_WEIGHTS, limit: 5 },
    });
    const latencyMs = Date.now() - start;
    if (args.triageRunId) {
      await ctx.runMutation(internal.tools.logToolCall, {
        triageRunId: args.triageRunId,
        tool: "recallSimilarIncidents",
        input: { signature: args.signature },
        output: result,
        latencyMs,
      });
    }
    return result;
  },
});

// ─── Tool: searchCode ─────────────────────────────────────────────────────────

/**
 * Nia /v2/search wrapper. Snippets are run through the cite-or-die
 * verifier inside `lib/nia/client.ts` before being returned (Invariant 1).
 */
export const searchCode = action({
  args: {
    query: v.string(),
    triageRunId: v.optional(v.id("triageRuns")),
  },
  handler: async (ctx, args) => {
    const start = Date.now();
    const nia = getNia();
    const result = await nia.search({
      query: args.query,
      mode: "query",
      include_sources: true,
    });
    const latencyMs = Date.now() - start;
    if (args.triageRunId) {
      await ctx.runMutation(internal.tools.logToolCall, {
        triageRunId: args.triageRunId,
        tool: "searchCode",
        input: { query: args.query },
        output: result,
        latencyMs,
      });
    }
    return result;
  },
});
