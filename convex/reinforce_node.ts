"use node";
/**
 * Reinforcement step — Invariant 2 (Memory Reinforcement Is The Demo).
 *
 * THIS FILE IS THE ONLY PLACE THAT WRITES `triage_history` MEMORIES TO
 * HYPERSPELL. PRs that add `triage_history` writes elsewhere are a hard
 * reject in Codex review.
 *
 * Why "use node": `lib/hyperspell/client.ts` imports `node:fs`,
 * `node:path`, and `node:crypto` (replay-mode fixture I/O + hashing).
 * Convex's V8 isolate cannot resolve `node:*` modules, so the action
 * MUST opt into the Node.js runtime via the `"use node"` directive.
 *
 * Convex requires that "use node" files contain ONLY actions. The V8
 * helpers (`_loadRun` query, `recordEvent` mutation) live in
 * `convex/reinforce.ts`; this file calls them via `ctx.runQuery` /
 * `ctx.runMutation`.
 *
 * Flow:
 *   1. Read the citations attached to a finished triageRun
 *      (via `internal.reinforce._loadRun`)
 *   2. Collect the Hyperspell memory_ids that were matched (slack/notion/gmail)
 *   3. memories.add({ source: 'triage_history', metadata: { reinforces: [...] }})
 *   4. Persist a memoryEvents row pointing at the reinforced ids
 *      (via `internal.reinforce.recordEvent`)
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
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getHyperspell } from "../lib/hyperspell/client";

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
    // Fetch the run + its citations through the V8 internal query so we
    // don't duplicate that join here.
    const hydrated = await ctx.runQuery(internal.reinforce._loadRun, {
      triageRunId: args.triageRunId,
    });
    if (!hydrated || !hydrated.run) {
      throw new Error(`reinforce: triageRun ${args.triageRunId} not found`);
    }

    // Collect reinforce-able memory ids: every Hyperspell-sourced citation
    // (slack/notion/gmail). Code citations are not Hyperspell memories,
    // so they're excluded from the reinforcement metadata.
    //
    // Codex BLOCK fix: explicit narrowing to `string[]`. The earlier code
    // wrapped the result in `Array.from(new Set(...))` which TypeScript
    // widened to `unknown[]` — the cite-shape was lost through the Set
    // because the citations array (which crosses the V8 query boundary)
    // is loosely typed by Convex's per-function typegen. We type the row
    // shape we care about explicitly, narrow with a type guard, then
    // dedupe via Set<string> so the return type stays `string[]`.
    interface CitationRow {
      source: string;
      sourceId: string;
    }
    const isHyperspellSource = (
      c: CitationRow
    ): c is CitationRow & { source: "slack" | "notion" | "gmail" } =>
      c.source === "slack" || c.source === "notion" || c.source === "gmail";

    const reinforcedMemoryIds: string[] = Array.from(
      new Set<string>(
        (hydrated.citations as CitationRow[])
          .filter(isHyperspellSource)
          .map((c) => c.sourceId)
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
