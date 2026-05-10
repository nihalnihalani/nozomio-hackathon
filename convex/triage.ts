/**
 * Convex V8-runtime mutations + queries for the triage flow.
 *
 * The agent action that actually runs the loop (run, runInternal)
 * lives in convex/triageNode.ts because lib/agent/loop.ts imports
 * node:* APIs.
 *
 * Invariant 3 (Hot/Cold split): writes ONLY to Convex hot-path
 * tables here. The cold-path InsForge mirror happens in triageNode.
 *
 * Invariant 1 (Cite-Or-Die): every citation persisted here carries a
 * `verified` flag inherited from the tool that produced it.
 */

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalQuery, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import {
  createThread,
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import type { AgentComponent } from "@convex-dev/agent";

// Same loose-typing escape hatch as in `triageAgent.ts` — see comment
// there. Once `npx convex dev` runs locally, this cast is harmless.
const agentComponent = components.agent as unknown as AgentComponent;

// ─── Mutations (public — called by both the agent action and the
//     Next.js /api/triage mirror path via ConvexHttpClient) ──────────────────

export const createRun = mutation({
  args: { orgId: v.string(), inputTrace: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("triageRuns", {
      orgId: args.orgId,
      inputTrace: args.inputTrace,
      status: "pending",
      startedAt: Date.now(),
    });
  },
});

export const setStatus = mutation({
  args: {
    triageRunId: v.id("triageRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "done" || args.status === "error") {
      patch.finishedAt = Date.now();
    }
    if (args.errorMessage) patch.errorMessage = args.errorMessage;
    await ctx.db.patch(args.triageRunId, patch);
  },
});

export const insertCitation = mutation({
  args: {
    triageRunId: v.id("triageRuns"),
    source: v.union(
      v.literal("slack"),
      v.literal("notion"),
      v.literal("gmail"),
      v.literal("google_drive"),
      v.literal("code")
    ),
    sourceId: v.string(),
    excerpt: v.string(),
    metadata: v.any(),
    verified: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("citations", {
      triageRunId: args.triageRunId,
      source: args.source,
      sourceId: args.sourceId,
      excerpt: args.excerpt,
      metadata: args.metadata ?? {},
      verified: args.verified,
    });
  },
});

export const finalizeResult = mutation({
  args: {
    triageRunId: v.id("triageRuns"),
    timeline: v.array(v.object({ at: v.string(), event: v.string() })),
    rootCause: v.object({
      text: v.string(),
      citations: v.array(v.string()),
    }),
    suspectedFix: v.optional(
      v.object({
        file: v.string(),
        line: v.number(),
        diff: v.string(),
        citations: v.array(v.string()),
      })
    ),
    similarIncidents: v.array(v.string()),
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
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      timeline: args.timeline,
      rootCause: args.rootCause,
      similarIncidents: args.similarIncidents,
    };
    if (args.suspectedFix) patch.suspectedFix = args.suspectedFix;
    if (args.similarIncidentsDetailed) {
      patch.similarIncidentsDetailed = args.similarIncidentsDetailed;
    }
    await ctx.db.patch(args.triageRunId, patch);
  },
});

// ─── Public mutation: kick off a triage run from the UI ───────────────────────

/**
 * Frontend calls `useMutation(api.triage.start)` then immediately
 * `useQuery(api.triage.byId, { id })` to subscribe to the live trace.
 * Returns the new triageRunId.
 *
 * Phase 1 (`@convex-dev/agent`) — dual-path scheduler:
 *
   *   - DEMO_MODE=replay  → schedule the legacy `runInternal` action which
   *                          replays a fixture via `lib/agent/loop.ts:runReplay`.
   *                          Explicit fixture playback only (Invariant 4).
   *   - otherwise          → create an Agent component thread, persist its
 *                          threadId on the triageRun row, schedule the new
 *                          `runTriage` action that uses the Agent component.
 *
 * Both paths return the same `triageRunId`. Frontend's `useTriage` keys
 * on this id and is unchanged.
 */
export const start = mutation({
  args: { orgId: v.string(), trace: v.string() },
  handler: async (ctx, args) => {
    // Replay mode keeps the hand-rolled loop. The production default is
    // live; deterministic fixtures only run when DEMO_MODE=replay is set.
    const demoMode = process.env.DEMO_MODE ?? "live";
    const useAgent = demoMode !== "replay";

    let threadId: string | undefined;
    if (useAgent) {
      // Create the agent thread synchronously inside the mutation so the
      // scheduled action can `continueThread` against it. `userId = orgId`
      // wires Phase-4 RAG (`searchOtherThreads`) so prior triages from the
      // same org surface naturally as context.
      threadId = await createThread(ctx, agentComponent, {
        userId: args.orgId,
        title: `Triage: ${args.trace.slice(0, 60)}`,
      });
    }

    const id = await ctx.db.insert("triageRuns", {
      orgId: args.orgId,
      inputTrace: args.trace,
      status: "pending",
      startedAt: Date.now(),
      ...(threadId ? { threadId } : {}),
    });

    if (useAgent && threadId) {
      // New live path: agent component runs the loop.
      await ctx.scheduler.runAfter(0, internal.triageNode.runTriage, {
        triageRunId: id,
        orgId: args.orgId,
        trace: args.trace,
        threadId,
      });
    } else {
      // Replay path: keep the existing hand-rolled fixture-driven runner.
      await ctx.scheduler.runAfter(0, internal.triageNode.runInternal, {
        triageRunId: id,
        orgId: args.orgId,
        trace: args.trace,
      });
    }
    return id;
  },
});

// ─── Queries (consumed by the reactive UI) ────────────────────────────────────

/**
 * Hydrated triage run: the run record + its tool calls + citations.
 * Frontend uses `useQuery(api.triage.byId, { id })` for the live trace.
 */
export const byId = query({
  args: { id: v.id("triageRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) return null;
    const toolCalls = await ctx.db
      .query("toolCalls")
      .withIndex("by_run", (q) => q.eq("triageRunId", args.id))
      .order("asc")
      .collect();
    const citations = await ctx.db
      .query("citations")
      .withIndex("by_run", (q) => q.eq("triageRunId", args.id))
      .collect();
    const memoryEvents = await ctx.db
      .query("memoryEvents")
      .withIndex("by_run", (q) => q.eq("triageRunId", args.id))
      .collect();
    return { run, toolCalls, citations, memoryEvents };
  },
});

/**
 * Lightweight query: just the triageRun row by id. Used by the frontend
 * `useTriageConvex` hook to resolve `threadId` from a triageRunId before
 * subscribing to `listMessages` / `useUIMessages`. Cheaper than `byId`
 * (no related-row fetches) and stable across schema evolution.
 */
export const runById = query({
  args: { id: v.id("triageRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) return null;
    return run;
  },
});

/**
 * Phase 2 — `useUIMessages` wire.
 *
 * Returns the agent component's persisted UIMessages PLUS an optional
 * `streams` payload with live deltas (when `streamArgs` is supplied by
 * the `useUIMessages({ stream: true })` hook on the client).
 *
 * Args shape is dictated by the hook:
 *   - `threadId`: the agent thread (held on `triageRuns.threadId`).
 *   - `paginationOpts`: required by `usePaginatedQuery` underpinning.
 *   - `streamArgs`: optional — when present, syncStreams returns the
 *      delta cursors so the client materializes streaming messages
 *      from `saveStreamDeltas: true` on the server.
 *
 * Invariant 1 (Cite-Or-Die): citations from `recallSimilarIncidents`
 * land in `parts[type="tool-recallSimilarIncidents"].output.memories[]`;
 * code citations land in `parts[type="tool-searchCode"].output.snippets[]`.
 * Frontend's `uiMessagesToTriageSnapshot` maps both to `Citation` rows
 * with `verified` preserved.
 */
export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, agentComponent, args);
    const streams = await syncStreams(ctx, agentComponent, args);
    return { ...paginated, streams };
  },
});

// ─── Agent-tool support: hot-path read helpers used by produceTriage ────────
//
// `produceTriage` (in `convex/triageAgent.ts`) is an Agent tool whose
// `execute()` runs in an action context. It needs to (a) resolve tool-time
// citations into Convex ids and (b) detect `fromTriageHistory` from prior
// recall outputs. Both reads are internal-only — we never expose them on
// the public API surface.

export const _citationsByRun = internalQuery({
  args: { triageRunId: v.id("triageRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("citations")
      .withIndex("by_run", (q) => q.eq("triageRunId", args.triageRunId))
      .collect();
  },
});

export const _toolCallsByRun = internalQuery({
  args: { triageRunId: v.id("triageRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_run", (q) => q.eq("triageRunId", args.triageRunId))
      .order("asc")
      .collect();
  },
});

// ─── Agent-tool support: threadId → triageRunId resolution ──────────────────
//
// The Agent Component's `createTool` execute() runs with an action ctx but
// no direct knowledge of the triageRunId — only `ctx.threadId`. The runner
// (`triageNode.ts:runTriage`) writes the threadId onto the `triageRuns` row
// in `triage.start`, so we can join here. Used by:
//   - `produceTriage` (final structured output → triageRuns patch)
//   - `recallSimilarIncidents` / `searchCode` (mirror to toolCalls + citations
//     so the legacy `useQuery(api.triage.byId)` reactive consumers still work)
export const runIdByThreadId = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<{ id: string; orgId: string } | null> => {
    // Linear scan over recent rows. The agent path's threadId is unique
    // per run, so we can pick the most-recent matching row. Convex
    // doesn't have a `where threadId = ?` index here yet — adding one
    // is a deferred polish (avoid a schema migration mid-Wave).
    const rows = await ctx.db.query("triageRuns").order("desc").take(200);
    for (const r of rows) {
      if (r.threadId === args.threadId) {
        return { id: String(r._id), orgId: r.orgId };
      }
    }
    return null;
  },
});

/** Recent runs for the org-scoped list view. */
export const recentRuns = query({
  args: { orgId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("triageRuns")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit);
  },
});
