"use node";

/**
 * Convex Node-runtime actions for the triage flow.
 *
 * Convex constraint: files with `"use node"` can only contain actions.
 * Mutations + queries live in convex/triage.ts (V8 runtime).
 *
 * The agent loop (lib/agent/loop.ts) and InsForge client (lib/insforge/client.ts)
 * import node:* APIs (path/fs for cite-or-die seed reads + replay storage),
 * so the actions that call them must run in Node.
 */

// Side-effect import: initializes PostHog LLM Analytics OTel provider at
// module scope BEFORE the agent loop's AI SDK calls run. No-op when
// POSTHOG_API_KEY is unset, so the demo path keeps working keyless.
import "./observability";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { runAgent, type AgentEvent } from "../lib/agent/loop";
import { getInsForge } from "../lib/insforge/client";
import { triageAgent } from "./triageAgent";

/**
 * Synchronous public action — runs the agent loop end-to-end and
 * returns when status is `done` or `error`. Useful for tests, scripts,
 * and the REST `/api/triage` route fallback. The frontend uses
 * `api.triage.start` + `useQuery(api.triage.byId)`, NOT this, because
 * it wants the live trace.
 */
export const run = action({
  args: { orgId: v.string(), trace: v.string() },
  handler: async (ctx, args): Promise<{ triageRunId: Id<"triageRuns"> }> => {
    const triageRunId = (await ctx.runMutation(api.triage.createRun, {
      orgId: args.orgId,
      inputTrace: args.trace,
    })) as Id<"triageRuns">;
    await ctx.runAction(internal.triageNode.runInternal, {
      triageRunId,
      orgId: args.orgId,
      trace: args.trace,
    });
    return { triageRunId };
  },
});

/**
 * Internal action invoked by `api.triage.start` via the scheduler.
 * Runs the agent loop from lib/agent/loop.ts and persists every event
 * into Convex tables. Once done, mirrors to InsForge (cold path) per
 * Invariant 3.
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
        await ctx.runMutation(api.triage.setStatus, {
          triageRunId: args.triageRunId,
          status: event.status,
        });
      } else if (event.type === "tool_call") {
        await ctx.runMutation(api.tools.logToolCall, {
          triageRunId: args.triageRunId,
          tool: event.tool,
          input: event.input,
          output: event.output,
          latencyMs: event.latencyMs,
        });
      } else if (event.type === "citation") {
        if (!citationIdBySourceId.has(event.citation.source_id)) {
          const id = (await ctx.runMutation(api.triage.insertCitation, {
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
        const mapCitations = (cs: { source_id: string }[]): string[] =>
          cs
            .map((c) => citationIdBySourceId.get(c.source_id))
            .filter((id): id is string => Boolean(id));

        await ctx.runMutation(api.triage.finalizeResult, {
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
        await ctx.runMutation(api.triage.setStatus, {
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

    if (result) {
      const insforge = getInsForge();
      await insforge.mirrorIncident({
        orgId: args.orgId,
        triageRunId: args.triageRunId,
        trace: args.trace,
        rootCause: result.root_cause.text,
      });

      try {
        await ctx.runAction(api.reinforceNode.reinforce, {
          triageRunId: args.triageRunId,
        });
      } catch (err) {
        console.warn("[triage] reinforcement step failed (non-fatal):", err);
      }
    }
  },
});

/**
 * Phase-1 LIVE-path runner. Replaces `runInternal` for `DEMO_MODE !=
 * "replay"` runs. Uses `@convex-dev/agent` for thread + tool calling +
 * RAG (`searchOtherThreads`). The replay path keeps `runInternal` above.
 *
 * Codex pass-3 honesty: explicit Trace-A gating stays. If no prior Trace
 * A ran for this org within the window, we mark the run with a
 * `[degraded]` notice via `errorMessage` so the UI can surface it. The
 * agent still runs — `[degraded]` does not block the recall, it labels
 * the result as missing the reinforcement signal (Invariant 2).
 *
 * Invariant 3 (Hot/Cold split): InsForge mirror runs at the END via the
 * Next.js HTTP route — we do NOT import `lib/insforge` for the mirror
 * path here. The existing `getInsForge()` client uses HTTP fetch, so it
 * already respects the cold-path boundary; reusing it stays compliant.
 *
 * TODO: PostHog wiring for Phase 6 (`@posthog/convex` LLM Analytics) lands
 * here — module-scope OTel provider in `convex/observability.ts` already
 * exists; verify the agent component's AI SDK calls emit `gen_ai` spans.
 */
export const runTriage = internalAction({
  args: {
    triageRunId: v.id("triageRuns"),
    orgId: v.string(),
    trace: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // ─── Status: running ──────────────────────────────────────────────────
    await ctx.runMutation(api.triage.setStatus, {
      triageRunId: args.triageRunId,
      status: "running",
    });

    // ─── Codex pass-3 gate: explicit Trace A presence check ─────────────
    // Built-in RAG (`searchOtherThreads: true` in `triageAgent.ts`) gives
    // the agent additional context, but the explicit `[degraded]` flag is
    // load-bearing for Invariant 2 demo honesty.
    const hasPriorA = await ctx.runQuery(
      internal.traceState.hasRecentTraceA,
      { orgId: args.orgId, withinMs: 5 * 60 * 1000 }
    );
    if (!hasPriorA) {
      // Persist the marker without failing the run. The status stays
      // `running` and will flip to `done` after the agent completes.
      // Wave 2A's UI will surface this `errorMessage` as a yellow banner.
      await ctx.runMutation(api.triage.setStatus, {
        triageRunId: args.triageRunId,
        status: "running",
        errorMessage:
          "[degraded] No prior Trace A run found in the last 5 minutes for this org — Invariant 2 reinforcement signal is not active. Recall results may not surface the reinforced retry-budget DM.",
      });
    }

    // ─── Agent run ────────────────────────────────────────────────────────
    try {
      const { thread } = await triageAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId: args.orgId,
      });
      // `saveStreamDeltas: true` persists token chunks for Wave 2A's
      // `useUIMessages({ stream: true })` to subscribe to. Iteration
      // ensures the stream completes before the action exits (the agent
      // component's tool dispatcher needs to drain).
      const stream = await thread.streamText(
        { prompt: args.trace },
        { saveStreamDeltas: true }
      );
      // Drain the text stream so all tool calls fire before we proceed.
      for await (const _chunk of stream.textStream) {
        // intentionally empty — deltas are persisted by the component
      }
    } catch (err) {
      await ctx.runMutation(api.triage.setStatus, {
        triageRunId: args.triageRunId,
        status: "error",
        errorMessage: `Agent run failed: ${(err as Error).message}`,
      });
      return;
    }

    // ─── Status: done ─────────────────────────────────────────────────────
    await ctx.runMutation(api.triage.setStatus, {
      triageRunId: args.triageRunId,
      status: "done",
    });

    // ─── Cold-path mirror (Invariant 3) ──────────────────────────────────
    // We mirror the run + a placeholder root cause; Wave 2A populates the
    // structured rootCause/suspectedFix from the agent's UIMessages once
    // the frontend swap lands. Until then, the mirror still records the
    // incident for the audit log (the durable cold-path requirement).
    try {
      const insforge = getInsForge();
      await insforge.mirrorIncident({
        orgId: args.orgId,
        triageRunId: args.triageRunId,
        trace: args.trace,
        rootCause: "(see agent thread for structured triage)",
      });
    } catch (err) {
      console.warn("[triage] InsForge mirror failed (non-fatal):", err);
    }

    // ─── Reinforcement (Invariant 2) ─────────────────────────────────────
    try {
      await ctx.runAction(api.reinforceNode.reinforce, {
        triageRunId: args.triageRunId,
      });
    } catch (err) {
      console.warn("[triage] reinforcement step failed (non-fatal):", err);
    }
  },
});
