/**
 * Convex hot-path mutation for tool-call logging (V8 isolate).
 *
 * The actual Hyperspell / Nia tool actions live in `convex/tools_node.ts`
 * because they import clients that pull in `node:fs|path|crypto`. This
 * V8 file owns only the database write side, so reactive
 * `useQuery(api.triage.byId)` keeps streaming `toolCalls` updates through
 * the fast path.
 *
 * Invariant 1 (Cite-Or-Die): every tool call logged here originated from
 * a Hyperspell/Nia call whose results carry a `verified` flag.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// ─── Internal logging mutation ────────────────────────────────────────────────

/**
 * Persist a tool invocation to the toolCalls table. Called by the
 * tool actions in `convex/tools_node.ts` AND by the agent loop in
 * `convex/triage_node.ts`.
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
