"use node";

/**
 * Reinforcement action — Invariant 2 (Memory Reinforcement Is The Demo).
 *
 * Convex constraint: this action lives in a `"use node"` file because
 * lib/hyperspell/client.ts imports node:* APIs (fs for replay-mode logs).
 * Internal query + mutation companions live in convex/reinforce.ts.
 *
 * THIS FILE IS THE ONLY PLACE THAT WRITES `triage_history` MEMORIES TO
 * HYPERSPELL. PRs that add `triage_history` writes elsewhere are a hard
 * reject in Codex review.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getHyperspell } from "../lib/hyperspell/client";

export const reinforce = action({
  args: { triageRunId: v.id("triageRuns") },
  handler: async (
    ctx,
    args
  ): Promise<{
    reinforcedMemoryIds: string[];
    memoryEventId: Id<"memoryEvents">;
    hyperspellWriteback: boolean;
  }> => {
    const hydrated = await ctx.runQuery(internal.reinforce._loadRun, {
      triageRunId: args.triageRunId,
    });
    if (!hydrated || !hydrated.run) {
      throw new Error(`reinforce: triageRun ${args.triageRunId} not found`);
    }

    const reinforcedMemoryIds = Array.from(
      new Set(
        hydrated.citations
          .filter(
            (c: { source: string; sourceId: string }) =>
              c.source === "slack" ||
              c.source === "notion" ||
              c.source === "gmail"
          )
          .map((c: { sourceId: string }) => c.sourceId)
      )
    );

    let hyperspellWriteback = false;
    try {
      const hyperspell = getHyperspell();
      await hyperspell.memories.add({
        text: `User triaged incident: ${hydrated.run.inputTrace.slice(0, 200)}`,
        source: "triage_history",
        metadata: {
          reinforces: reinforcedMemoryIds,
          triage_run_id: String(args.triageRunId),
          root_cause: hydrated.run.rootCause?.text,
          at: Date.now(),
        },
      });
      hyperspellWriteback = true;
    } catch (err) {
      console.warn("[reinforce] hyperspell add failed:", err);
    }

    const memoryEventId = (await ctx.runMutation(
      internal.reinforce.recordEvent,
      {
        triageRunId: args.triageRunId,
        reinforcedMemoryIds,
        hyperspellWriteback,
      }
    )) as Id<"memoryEvents">;

    return { reinforcedMemoryIds, memoryEventId, hyperspellWriteback };
  },
});
