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
   * Production honesty: if no prior reinforcement event exists for this org
   * within the window, mark the run with a `[degraded]` notice via
   * `errorMessage` so the UI can surface that memory reinforcement is not
   * active yet. The agent still runs.
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
    // ─── Pre-flight: LLM key required for live agent path ──────────────
    // The agent uses openai.chat("gpt-4o") in convex/triageAgent.ts
    // (was Anthropic in PR #10; we migrated to OpenAI when we verified
    // the sk-proj-... key worked for both chat + embeddings). Accept
    // either provider key — the actual model selection happens in
    // triageAgent.ts. Replay path falls back gracefully; agent path
    // surfaces a clear error so the user sees the actual problem.
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      await ctx.runMutation(api.triage.setStatus, {
        triageRunId: args.triageRunId,
        status: "error",
        errorMessage:
          "No LLM key set on the Convex deployment. The agent live path needs OPENAI_API_KEY or ANTHROPIC_API_KEY (matching the model in convex/triageAgent.ts). Set via `npx convex env set OPENAI_API_KEY ...` or run with `DEMO_MODE=replay` for the hermetic demo path.",
      });
      return;
    }

    // ─── Status: running ──────────────────────────────────────────────────
    await ctx.runMutation(api.triage.setStatus, {
      triageRunId: args.triageRunId,
      status: "running",
    });

    // ─── Reinforcement context check ────────────────────────────────────
    // Built-in RAG (`searchOtherThreads: true` in `triageAgent.ts`) gives
    // the agent additional context, but the explicit `[degraded]` flag
    // makes missing reinforcement visible.
    const hasRecentReinforcement = await ctx.runQuery(
      internal.traceState.hasRecentReinforcement,
      { orgId: args.orgId, withinMs: 5 * 60 * 1000 }
    );
    if (!hasRecentReinforcement) {
      // Persist the marker without failing the run. The status stays
      // `running` and will flip to `done` after the agent completes. The UI
      // surfaces this `errorMessage` as a yellow banner.
      await ctx.runMutation(api.triage.setStatus, {
        triageRunId: args.triageRunId,
        status: "running",
        errorMessage:
          "[degraded] No recent reinforced incident found for this org. Memory reinforcement is not active yet, so recall results may be less specific.",
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
      //
      // Note: structured-output persistence is owned by the `produceTriage`
      // tool (`convex/triageAgent.ts`) — it writes to triageRuns via
      // `api.triage.finalizeResult` from inside its `execute()`. We don't
      // text-parse the stream here; tool-call validation through Zod
      // `inputSchema` is the Cite-Or-Die enforcement point.
      // Round-2 DA finding (M1): `experimental_telemetry` is an AI SDK
      // option (lives on the first arg, alongside `prompt` — the agent
      // SDK splits args this way; `saveStreamDeltas` lives on the second
      // arg). Passing it makes PostHog OTel `gen_ai.*` spans emit on the
      // agent path; without it PostHog sees agent-mode runs as black
      // holes. Replay/SSE path passes the same flag in `runLive`.
      const stream = await thread.streamText(
        {
          prompt: args.trace,
          experimental_telemetry: {
            isEnabled: true,
            functionId: "triage-agent",
          },
        },
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

    // ─── Verify produceTriage actually ran ────────────────────────────────
    // The agent's contract (system prompt + tool schema) is to terminate
    // by calling `produceTriage`, which writes the structured fields to
    // the triageRuns row. If those fields are still empty, the agent
    // bailed without producing a final triage — surface that as an error
    // rather than silently advancing to `done` (Invariant 1: prefer
    // honest failure to silent fabrication).
    const finalRun = await ctx.runQuery(api.triage.runById, {
      id: args.triageRunId,
    });
    // produceTriage is the contract: rootCause is mandatory (Cite-Or-Die),
    // suspectedFix is optional — when searchCode returns no code citations,
    // a triage with only Hyperspell-cited root cause + similar incidents
    // is still a valid triage. Fabricating a fix without code evidence
    // would violate Invariant 1.
    const producedTriage = Boolean(finalRun?.rootCause);

    if (!producedTriage) {
      await ctx.runMutation(api.triage.setStatus, {
        triageRunId: args.triageRunId,
        status: "error",
        errorMessage:
          "Agent finished without calling produceTriage. No structured triage was produced — refusing to mark this run as done.",
      });
      return;
    }

    // ─── Status: done ─────────────────────────────────────────────────────
    await ctx.runMutation(api.triage.setStatus, {
      triageRunId: args.triageRunId,
      status: "done",
    });

    // ─── Cold-path mirror (Invariant 3) ──────────────────────────────────
    // The mirror now carries the real root-cause text produced by the
    // agent's `produceTriage` step (vs the placeholder we used before
    // structured persistence landed). The InsForge mirror is the durable
    // audit-grade record of the incident.
    try {
      const insforge = getInsForge();
      await insforge.mirrorIncident({
        orgId: args.orgId,
        triageRunId: args.triageRunId,
        trace: args.trace,
        rootCause: finalRun?.rootCause?.text ?? "(no root cause produced)",
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
