/**
 * Reinforcement gating state.
 *
 * The live agent path labels follow-up runs when no recent reinforcement
 * exists for the same orgId. The original implementation keyed this to the
 * hackathon Trace A/Trace B fixture pair. Production should not know those
 * fixture names or planted memory ids, so this file treats any successful
 * memoryEvents row with reinforced memory ids as the source of truth.
 *
 * This file makes `memoryEvents` (the canonical reinforcement audit log
 * written by `convex/reinforce.ts`) the source of truth.
 */

import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour — covers a normal demo session.

function hasReinforcedSources(reinforcedMemoryIds: string[]): boolean {
  return reinforcedMemoryIds.some((id) => id.trim().length > 0);
}

export const hasRecentReinforcement = internalQuery({
  args: {
    orgId: v.string(),
    withinMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const cutoff = Date.now() - (args.withinMs ?? DEFAULT_WINDOW_MS);
    // memoryEvents has no orgId column (the join lives on triageRuns), so
    // we filter by `at` first and then join. The row volume on the hot
    // path stays small per session.
    const recent = await ctx.db
      .query("memoryEvents")
      .filter((q) => q.gte(q.field("at"), cutoff))
      .collect();
    if (recent.length === 0) return false;
    for (const ev of recent) {
      if (!hasReinforcedSources(ev.reinforcedMemoryIds)) continue;
      const run = await ctx.db.get(ev.triageRunId);
      if (run && run.orgId === args.orgId) return true;
    }
    return false;
  },
});
