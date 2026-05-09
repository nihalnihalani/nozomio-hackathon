/**
 * Convex V8-runtime mutations for tool calls.
 *
 * Tool actions (recallSimilarIncidents, searchCode) live in
 * convex/toolsNode.ts because their lib/* clients use node:* APIs.
 * This file holds only the mutation that the actions and the agent
 * loop call back into to log tool invocations.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Persist a tool invocation to the toolCalls table. Called by the
 * tool actions in toolsNode.ts AND by the agent loop in triageNode.ts.
 *
 * Internal-only (not exposed to the frontend) because the frontend
 * never directly writes to toolCalls — that would let the UI fake
 * agent reasoning. `useQuery(api.triage.byId)` is the read-side.
 */
export const logToolCall = internalMutation({
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
