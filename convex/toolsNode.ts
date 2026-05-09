"use node";

/**
 * Convex Node-runtime tool actions.
 *
 * Hyperspell + Nia clients in lib/* import node:* APIs (fs for the
 * replay-mode fixture cache and cite-or-die seed reads), so the actions
 * that call them must run in Node. The `logToolCall` mutation companion
 * lives in convex/tools.ts (V8 runtime).
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getHyperspell, SOURCE_WEIGHTS } from "../lib/hyperspell/client";
import { getNia } from "../lib/nia/client";

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

/**
 * Nia /v2/search wrapper. Snippets are run through the cite-or-die
 * verifier inside lib/nia/client.ts before being returned (Invariant 1).
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
