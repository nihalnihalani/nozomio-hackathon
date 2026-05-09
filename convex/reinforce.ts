/**
 * Hot-path V8 helpers for the reinforcement step.
 *
 * The Hyperspell write-side action lives in `convex/reinforce_node.ts`
 * (it must be in a `"use node"` file because `lib/hyperspell/client.ts`
 * uses `node:fs|path|crypto`). This V8 file owns:
 *   - the `_loadRun` query that hydrates a finished triage run + citations
 *   - the `recordEvent` mutation that writes the `memoryEvents` row
 *
 * Splitting this way keeps the database writes inside Convex's V8 isolate
 * (fast, deterministic) while allowing the Hyperspell side-effect to run
 * in Node where it can resolve its dependencies.
 *
 * Invariant 2 (Memory Reinforcement Is The Demo): `convex/reinforce_node.ts`
 * is the ONLY place that writes `triage_history` memories to Hyperspell.
 * PRs that add `triage_history` writes elsewhere are a hard reject in code
 * review.
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
