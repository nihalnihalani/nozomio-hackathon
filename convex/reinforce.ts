/**
 * Reinforcement helpers — Invariant 2 (Memory Reinforcement Is The Demo).
 *
 * V8-runtime internal query + mutation. The public `reinforce` action
 * lives in convex/reinforceNode.ts because lib/hyperspell/client.ts
 * uses node:* APIs.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ─── Internal query: hydrate a run with its citations ─────────────────────────

export const _loadRun = internalQuery({
  args: { triageRunId: v.id("triageRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.triageRunId);
    if (!run) return null;
    const citations = await ctx.db
      .query("citations")
      .withIndex("by_run", (q) => q.eq("triageRunId", args.triageRunId))
      .collect();
    return { run, citations };
  },
});

// ─── Internal mutation: write the memoryEvents row ────────────────────────────

export const recordEvent = internalMutation({
  args: {
    triageRunId: v.id("triageRuns"),
    reinforcedMemoryIds: v.array(v.string()),
    hyperspellWriteback: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("memoryEvents", {
      triageRunId: args.triageRunId,
      reinforcedMemoryIds: args.reinforcedMemoryIds,
      hyperspellWriteback: args.hyperspellWriteback,
      at: Date.now(),
    });
  },
});
