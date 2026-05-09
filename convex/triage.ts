/**
 * Convex agent action — entry point for the paste-trace flow.
 *
 * Invariant 3 (Hot/Cold split): this action writes ONLY to Convex hot-path
 * tables (triageRuns, toolCalls, citations). The cold-path mirror to
 * InsForge happens at the end via the InsForge client; never the reverse.
 *
 * Invariant 1 (Cite-Or-Die): every citation persisted here carries a
 * `verified` flag inherited from the tool that produced it.
 */

import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { runAgent, type AgentEvent } from "../lib/agent/loop";
import { getInsForge } from "../lib/insforge/client";

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
    // Schedule the agent action to run immediately. We don't await it
    // — the UI subscribes via useQuery and renders streamed updates.
    await ctx.scheduler.runAfter(0, internal.triage.runInternal, {
      triageRunId: id,
      orgId: args.orgId,
      trace: args.trace,
    });
    return id;
  },
});

/**
 * Synchronous public action — runs the agent loop end-to-end and
 * returns when status is `done` or `error`. Useful for tests, scripts,
 * and the REST `/api/triage` route fallback. The frontend uses `start`
 * + `useQuery`, NOT this, because it wants the live trace.
 */
export const run = action({
  args: { orgId: v.string(), trace: v.string() },
  handler: async (ctx, args): Promise<{ triageRunId: Id<"triageRuns"> }> => {
    const triageRunId = (await ctx.runMutation(internal.triage.createRun, {
      orgId: args.orgId,
      inputTrace: args.trace,
    })) as Id<"triageRuns">;
    await ctx.runAction(internal.triage.runInternal, {
      triageRunId,
      orgId: args.orgId,
      trace: args.trace,
    });
    return { triageRunId };
  },
});

// ─── Internal action: the actual agent loop ───────────────────────────────────

/**
 * Internal action invoked by `start` via the scheduler. Runs the agent
 * loop from lib/agent/loop.ts and persists every event into Convex
 * tables. Once done, mirrors to InsForge (cold path) per Invariant 3.
 */
export const runInternal = internalAction({
  args: {
    triageRunId: v.id("triageRuns"),
    orgId: v.string(),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    // Track the citation_id mappings so the final result's
    // `citations: string[]` arrays reference real Convex ids.
    const citationIdBySourceId = new Map<string, string>();

    const sink = async (event: AgentEvent) => {
      if (event.type === "status") {
        await ctx.runMutation(internal.triage.setStatus, {
          triageRunId: args.triageRunId,
          status: event.status,
        });
      } else if (event.type === "tool_call") {
        await ctx.runMutation(internal.tools.logToolCall, {
          triageRunId: args.triageRunId,
          tool: event.tool,
          input: event.input,
          output: event.output,
          latencyMs: event.latencyMs,
        });
      } else if (event.type === "citation") {
        // Dedupe by source_id within this run.
        if (!citationIdBySourceId.has(event.citation.source_id)) {
          const id = (await ctx.runMutation(internal.triage.insertCitation, {
            triageRunId: args.triageRunId,
            source: event.citation.source,
            sourceId: event.citation.source_id,
            excerpt: event.citation.excerpt,
            metadata: event.citation.metadata ?? {},
            verified: event.citation.verified,
          })) as Id<"citations">;
          citationIdBySourceId.set(event.citation.source_id, id);
        }
      } else if (event.type === "result") {
        // Persist the final structured output. Map citations from the
        // result's source_id format back to Convex citation ids.
        const mapCitations = (cs: { source_id: string }[]): string[] =>
          cs
            .map((c) => citationIdBySourceId.get(c.source_id))
            .filter((id): id is string => Boolean(id));

        await ctx.runMutation(internal.triage.finalizeResult, {
          triageRunId: args.triageRunId,
          timeline: event.result.timeline,
          rootCause: {
            text: event.result.root_cause.text,
            citations: mapCitations(event.result.root_cause.citations),
          },
          suspectedFix: {
            file: event.result.suspected_fix.file,
            line: event.result.suspected_fix.line,
            diff: event.result.suspected_fix.diff,
            citations: mapCitations(event.result.suspected_fix.citations),
          },
          similarIncidents: event.result.similar_incidents.map(
            (s) => s.memory_id
          ),
        });
      } else if (event.type === "error") {
        await ctx.runMutation(internal.triage.setStatus, {
          triageRunId: args.triageRunId,
          status: "error",
          errorMessage: event.message,
        });
      }
    };

    let result;
    try {
      result = await runAgent(
        { trace: args.trace, orgId: args.orgId },
        sink
      );
    } catch (err) {
      await sink({ type: "error", message: (err as Error).message });
      return;
    }

    // Invariant 3: mirror to InsForge cold path. Fire-and-forget; replay
    // mode no-ops, so the demo path always succeeds. We DO NOT await
    // a failure here — the Convex run's `done` status is the source of
    // truth for the UI.
    if (result) {
      const insforge = getInsForge();
      await insforge.mirrorIncident({
        orgId: args.orgId,
        triageRunId: args.triageRunId,
        trace: args.trace,
        rootCause: result.root_cause.text,
      });

      // Invariant 2: reinforce matched memories so Trace B's recall is
      // biased toward them. Reinforcement lives in convex/reinforce.ts —
      // the only place that writes `triage_history` memories.
      try {
        await ctx.runAction(api.reinforce.reinforce, {
          triageRunId: args.triageRunId,
        });
      } catch (err) {
        console.warn("[triage] reinforcement step failed (non-fatal):", err);
      }
    }
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
