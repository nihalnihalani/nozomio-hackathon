/**
 * Reinforcement step — Invariant 2 (Memory Reinforcement Is The Demo).
 *
 * THIS FILE IS THE ONLY PLACE THAT WRITES `triage_history` MEMORIES TO
 * HYPERSPELL. PRs that add `triage_history` writes elsewhere are a hard
 * reject in Codex review.
 *
 * Flow:
 *   1. Read the citations attached to a finished triageRun
 *   2. Collect the Hyperspell memory_ids that were matched (slack/notion/gmail)
 *   3. memories.add({ source: 'triage_history', metadata: { reinforces: [...] }})
 *   4. Persist a memoryEvents row pointing at the reinforced ids
 *
 * The two-pagers-90s-apart demo beat works because Trace B's
 * recallSimilarIncidents() weights the just-reinforced memory higher.
 *
 * Invariant 4 (Hermetic Demo Mode): in replay, the Hyperspell client
 * appends to a writes log instead of hitting the API; we still write
 * the memoryEvents row so the test (`tests/invariants/reinforcement.test.ts`)
 * can assert the reinforcement happened.
 */

import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getHyperspell } from "../lib/hyperspell/client";

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

// ─── Public action: reinforce(triageRunId) ────────────────────────────────────

/**
 * Reinforce the memories matched by a finished triage run.
 * Idempotent in spirit (re-running just appends another event); the
 * production-grade dedupe would key on `triageRunId` but that's not
 * required for the demo path.
 */
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
    // Fetch the run + its citations through the public byId query so
    // we don't duplicate that join here.
    const hydrated = await ctx.runQuery(internal.reinforce._loadRun, {
      triageRunId: args.triageRunId,
    });
    if (!hydrated || !hydrated.run) {
      throw new Error(`reinforce: triageRun ${args.triageRunId} not found`);
    }

    // Collect reinforce-able memory ids: every Hyperspell-sourced citation
    // (slack/notion/gmail). Code citations are not Hyperspell memories,
    // so they're excluded from the reinforcement metadata.
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
      // Invariant 2: this is THE write-side. The summary text is
      // intentionally generic — the metadata.reinforces array is what
      // Hyperspell uses to bump source-weighting on the next recall.
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
      // Invariant 4: log and continue. The memoryEvent row still gets
      // written so the test asserting the reinforcement step ran can
      // succeed even when the upstream API is unreachable.
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
