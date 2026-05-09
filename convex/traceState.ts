/**
 * Trace gating state — Codex finding #3 follow-up.
 *
 * The agent loop in `lib/agent/loop.ts` gates Trace B's reinforced
 * citations on whether a prior Trace A has run "recently" for the same
 * orgId. The original implementation kept that signal in a module-local
 * `Map<string, ...>` inside the agent loop, which is unreliable across
 * Convex actions, serverless instances, and process restarts.
 *
 * This file makes `memoryEvents` (the canonical reinforcement audit log
 * written by `convex/reinforce.ts`) the source of truth.
 *
 * ─── How we tag a memoryEvent as "from a Trace A run" ────────────────────
 *
 * Approach (c) from the Codex spec: read `reinforcedMemoryIds` directly,
 * no schema change required. Trace A and Trace B reinforce different sets
 * of ids, and the difference is observable on the row itself.
 *
 *   Trace A memoryEvent → reinforcedMemoryIds is the cold-cluster set:
 *     [mem_slk_jan14_thread_001, mem_ntn_pm_2024_01_14, mem_ntn_adr_007]
 *     None start with `mem_reinforce_`. None is the planted retry-budget DM.
 *
 *   Trace B memoryEvent → reinforcedMemoryIds includes the post-Trace-A
 *     reinforcement ids: `mem_reinforce_*` and/or `mem_slk_dm_feb18_retry_budget`.
 *
 * So a row whose `reinforcedMemoryIds` are all "fresh" (no `mem_reinforce_*`,
 * no retry-budget DM) is a Trace A run. We also confirm the row belongs
 * to the right orgId by joining to its `triageRuns` parent.
 *
 * Why approach (c) and not (b) — adding a `triggerType` field?
 *   - (b) requires a schema change + a coordinated write-side update in
 *     `convex/reinforce.ts`. The Codex spec asks us to avoid schema
 *     changes "if you absolutely need a new field". We don't.
 *   - (c) reads what's already on disk. Today's Trace A and Trace B
 *     fixtures encode the distinction in their `reinforcedMemoryIds`
 *     payloads (see `data/replay/trace-{a,b}.json`).
 *
 * Why not (a) — match the parent triageRun's `inputTrace` against a Trace A
 * pattern?
 *   - Brittle. The patterns live in fixture files, the server has no
 *     reason to know them, and any new Trace A variant would have to be
 *     enumerated here.
 *
 * ─── Caller contract ────────────────────────────────────────────────────
 *
 * Both runtime paths consult this same query:
 *
 *   1. `convex/triage.ts:runInternal` (the live Convex action) calls
 *      `ctx.runQuery(internal.traceState.hasRecentTraceA, ...)`.
 *
 *   2. `app/api/triage/route.ts` (the Next.js SSE fallback) builds a
 *      `ConvexHttpClient` from `NEXT_PUBLIC_CONVEX_URL` and calls the
 *      same query. If the env var is unset (the hermetic demo path),
 *      the agent loop falls back to its in-process Map.
 */

import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes — same as the in-process TTL.

/** Heuristic: does this memoryEvent represent a Trace A run? */
function isTraceAEvent(reinforcedMemoryIds: string[]): boolean {
  // Trace A reinforces only "raw" cluster memories. If any reinforced id
  // is itself a reinforcement marker (mem_reinforce_*) or the planted
  // retry-budget DM, this row was written after Trace B (or some later
  // post-reinforcement run), not Trace A.
  if (reinforcedMemoryIds.length === 0) return false;
  return reinforcedMemoryIds.every(
    (id) =>
      !id.startsWith("mem_reinforce_") && id !== "mem_slk_dm_feb18_retry_budget"
  );
}

export const hasRecentTraceA = internalQuery({
  args: {
    orgId: v.string(),
    withinMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const cutoff = Date.now() - (args.withinMs ?? DEFAULT_WINDOW_MS);
    // memoryEvents has no orgId column (the join lives on triageRuns), so
    // we filter by `at` first and then join. The row volume on the hot
    // path stays small per session, so this is fine for the demo.
    const recent = await ctx.db
      .query("memoryEvents")
      .filter((q) => q.gte(q.field("at"), cutoff))
      .collect();
    if (recent.length === 0) return false;
    for (const ev of recent) {
      if (!isTraceAEvent(ev.reinforcedMemoryIds)) continue;
      const run = await ctx.db.get(ev.triageRunId);
      if (run && run.orgId === args.orgId) return true;
    }
    return false;
  },
});
