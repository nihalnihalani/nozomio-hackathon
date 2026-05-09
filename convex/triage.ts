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
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Mutations (internal — used by the action's event sink) ───────────────────

export const createRun = internalMutation({
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

export const setStatus = internalMutation({
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

export const insertCitation = internalMutation({
  args: {
    triageRunId: v.id("triageRuns"),
    source: v.union(
      v.literal("slack"),
      v.literal("notion"),
      v.literal("gmail"),
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

export const finalizeResult = internalMutation({
  args: {
    triageRunId: v.id("triageRuns"),
    timeline: v.array(v.object({ at: v.string(), event: v.string() })),
    rootCause: v.object({
      text: v.string(),
      citations: v.array(v.string()),
    }),
    suspectedFix: v.object({
      file: v.string(),
      line: v.number(),
      diff: v.string(),
      citations: v.array(v.string()),
    }),
    similarIncidents: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.triageRunId, {
      timeline: args.timeline,
      rootCause: args.rootCause,
      suspectedFix: args.suspectedFix,
      similarIncidents: args.similarIncidents,
    });
  },
});

// ─── Public mutation: kick off a triage run from the UI ───────────────────────

/**
 * Frontend calls `useMutation(api.triage.start)` then immediately
 * `useQuery(api.triage.byId, { id })` to subscribe to the live trace.
 * Returns the new triageRunId.
 */
export const start = mutation({
  args: { orgId: v.string(), trace: v.string() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("triageRuns", {
      orgId: args.orgId,
      inputTrace: args.trace,
      status: "pending",
      startedAt: Date.now(),
    });
    // Schedule the Node-runtime agent action; UI subscribes via useQuery.
    await ctx.scheduler.runAfter(0, internal.triageNode.runInternal, {
      triageRunId: id,
      orgId: args.orgId,
      trace: args.trace,
    });
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
