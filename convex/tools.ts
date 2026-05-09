/**
 * Convex V8-runtime mutations for tool calls.
 *
 * Tool actions (recallSimilarIncidents, searchCode) live in
 * convex/toolsNode.ts because their lib/* clients use node:* APIs.
 * This file holds only the mutation that the actions and the agent
 * loop call back into to log tool invocations.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Persist a tool invocation to the toolCalls table. Called by the
 * tool actions in toolsNode.ts AND by the agent loop in triageNode.ts
 * AND by the /api/triage Next.js mirror path via ConvexHttpClient.
 *
 * Public mutation; the read-side stays gated through useQuery.
 */
export const logToolCall = mutation({
  args: {
    triageRunId: v.id("triageRuns"),
    tool: v.union(
      v.literal("recallSimilarIncidents"),
      v.literal("searchCode")
    ),
    input: v.any(),
    output: v.any(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("toolCalls", {
      triageRunId: args.triageRunId,
      tool: args.tool,
      input: args.input,
      output: args.output,
      latencyMs: args.latencyMs,
      at: Date.now(),
    });
  },
});
