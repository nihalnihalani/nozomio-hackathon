/**
 * Convex schema — HOT PATH ONLY.
 *
 * Invariant 3 (Hot/Cold split): these tables hold per-session, ephemeral
 * agent state that powers the reactive trace UI via `useQuery`.
 *
 *   ┌──────────────────────┬────────────────────────────────────────────┐
 *   │ Hot path (Convex)    │ triageRuns, toolCalls, citations,          │
 *   │                      │ memoryEvents                               │
 *   ├──────────────────────┼────────────────────────────────────────────┤
 *   │ Cold path (InsForge) │ organizations, incidents, audit_log        │
 *   └──────────────────────┴────────────────────────────────────────────┘
 *
 * DO NOT add audit-grade or multi-tenant durable tables here. Those
 * belong in InsForge (cold path), with RLS by org_id. The mirror is
 * one-way (Convex → InsForge) via app/api/insforge-mirror/route.ts.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Per-triage state machine. One row per paste-trace submission.
  triageRuns: defineTable({
    orgId: v.string(),
    inputTrace: v.string(),
    // Phase 1 — `@convex-dev/agent` migration.
    // The Agent component owns its own thread + message tables. We carry
    // a thread reference here so the existing reactive UI (`useQuery
    // api.triage.byId`) can be evolved in Wave 2A to consume `listMessages`
    // + `useUIMessages` without a hard schema cutover. Optional during
    // transition: replay-mode runs and pre-Phase-1 rows do not have one.
    threadId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    // Final structured output mirrors TriageResultSchema in lib/types.ts.
    timeline: v.optional(
      v.array(v.object({ at: v.string(), event: v.string() }))
    ),
    rootCause: v.optional(
      v.object({
        text: v.string(),
        // citation_ids referencing rows in the citations table.
        // Invariant 1 (Cite-Or-Die): non-empty for any non-trivial claim.
        citations: v.array(v.string()),
      })
    ),
    suspectedFix: v.optional(
      v.object({
        file: v.string(),
        line: v.number(),
        diff: v.string(),
        citations: v.array(v.string()),
      })
    ),
    // memoryEvent ids — pointer to the matched-prior-incidents records.
    similarIncidents: v.optional(v.array(v.string())),
    // Rich similar-incidents shape needed for the SimilarIncidentsCard
    // wow moment (summary, relevance, fromTriageHistory badge). Populated
    // by the mirror path so useQuery-driven UI doesn't lose info that
    // only existed in the SSE result event.
    similarIncidentsDetailed: v.optional(
      v.array(
        v.object({
          memory_id: v.string(),
          summary: v.string(),
          relevance: v.number(),
          fromTriageHistory: v.optional(v.boolean()),
        })
      )
    ),
    // Bubble agent errors up to the UI, never swallow them.
    errorMessage: v.optional(v.string()),
  }).index("by_org", ["orgId"]),

  // Stream of every tool invocation, surfaced live in the trace UI.
  toolCalls: defineTable({
    triageRunId: v.id("triageRuns"),
    tool: v.union(
      v.literal("recallSimilarIncidents"),
      v.literal("searchCode")
    ),
    input: v.any(),
    output: v.any(),
    latencyMs: v.number(),
    at: v.number(),
  }).index("by_run", ["triageRunId"]),

  // Every citation surfaced by any tool, with verified flag.
  // Invariant 1 (Cite-Or-Die): `verified=false` rows ARE allowed but the
  // UI surfaces them with a [verification failed] badge — we never
  // silently drop a citation that the agent claimed.
  citations: defineTable({
    triageRunId: v.id("triageRuns"),
    source: v.union(
      v.literal("slack"),
      v.literal("notion"),
      v.literal("gmail"),
      v.literal("google_drive"),
      v.literal("code")
    ),
    // Hyperspell memory_id for slack/notion/gmail, "file:line" for code.
    sourceId: v.string(),
    excerpt: v.string(),
    metadata: v.any(),
    verified: v.boolean(),
  }).index("by_run", ["triageRunId"]),

  // Reinforcement events — Invariant 2.
  // ONLY `convex/reinforce.ts` writes rows here, and it MUST simultaneously
  // call hyperspell.memories.add({ source: 'triage_history', metadata: { reinforces } }).
  memoryEvents: defineTable({
    triageRunId: v.id("triageRuns"),
    reinforcedMemoryIds: v.array(v.string()),
    // Did the upstream Hyperspell write succeed? false in replay mode.
    hyperspellWriteback: v.boolean(),
    at: v.number(),
  }).index("by_run", ["triageRunId"]),
});
