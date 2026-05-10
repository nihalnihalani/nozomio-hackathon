/**
 * POST /api/triage — Next.js fallback route.
 *
 * Used when Convex isn't configured (NEXT_PUBLIC_CONVEX_URL absent) or
 * when an external producer (Sentry/PagerDuty/webhook tooling) needs a
 * thin REST/SSE surface.
 *
 * Streams the agent loop's events as Server-Sent Events. The frontend's
 * primary path is still useMutation(api.triage.start) + useQuery — this
 * route keeps the same runtime mode semantics as the Convex path:
 * live by default, replay only when DEMO_MODE=replay is explicit.
 *
 * Wire format — matches `lib/hooks/useTriage.ts` SSE consumer exactly:
 *   event: <kind>
 *   data: <JSON payload>
 *
 *   <kind> ∈ status | tool_call_start | tool_call_done | citation
 *          | timeline | root_cause | suspected_fix | similar_incidents
 *          | error
 *
 * The internal `AgentEvent` shape (lib/agent/loop.ts) is richer; this
 * route translates it for the frontend hook's contract.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { runAgent, type AgentEvent } from "@/lib/agent/loop";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getDemoMode } from "@/lib/types";

export const runtime = "nodejs"; // we read seed/ files for cite-or-die

/**
 * Mirror writer — best-effort, fire-and-forget Convex writes that
 * land on the same hot-path tables (triageRuns, toolCalls, citations)
 * as the in-Convex agent. The SSE stream remains the response source of
 * truth; if Convex is down or NEXT_PUBLIC_CONVEX_URL is unset, the mirror
 * no-ops and the stream still reports the actual agent outcome.
 */
function makeConvexMirror() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  try {
    return new ConvexHttpClient(url);
  } catch {
    return null;
  }
}

const RequestSchema = z.object({
  trace: z.string().min(1),
  orgId: z.string().min(1).optional(),
  fixtureHint: z.string().optional(),
  /** Optional client-side run id for correlation with the UI store. */
  clientRunId: z.string().optional(),
});

interface SseFrame {
  event: string;
  data: unknown;
}

function encodeFrame(frame: SseFrame): Uint8Array {
  const payload = `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
  return new TextEncoder().encode(payload);
}

/**
 * Map an AgentEvent into one or more SSE frames matching the frontend's
 * useTriage hook contract.
 */
function configuredDefaultOrgId(): string | null {
  return (
    process.env.TRIAGE_DEFAULT_ORG_ID?.trim() ||
    process.env.NEXT_PUBLIC_TRIAGE_ORG_ID?.trim() ||
    null
  );
}

function toSseFrames(event: AgentEvent, sequence: number): SseFrame[] {
  switch (event.type) {
    case "status":
      return [{ event: "status", data: { status: event.status } }];
    case "tool_call":
      // Frontend expects start+done as separate events. We collapse
      // both at the same instant since lib/agent/loop runs the tool
      // synchronously before emitting.
      return [
        {
          event: "tool_call_start",
          data: {
            id: `${event.tool}-${event.at}-${sequence}`,
            tool: event.tool,
            input: event.input,
            at: event.at,
          },
        },
        {
          event: "tool_call_done",
          data: {
            id: `${event.tool}-${event.at}-${sequence}`,
            output: event.output,
            latencyMs: event.latencyMs,
            resultCount: countResults(event.tool, event.output),
          },
        },
      ];
    case "citation":
      return [{ event: "citation", data: event.citation }];
    case "result":
      return [
        { event: "timeline", data: { timeline: event.result.timeline } },
        { event: "root_cause", data: event.result.root_cause },
        { event: "suspected_fix", data: event.result.suspected_fix },
        {
          event: "similar_incidents",
          data: { incidents: event.result.similar_incidents },
        },
      ];
    case "error":
      return [{ event: "error", data: { message: event.message } }];
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return [];
    }
  }
}

function countResults(
  tool: "recallSimilarIncidents" | "searchCode",
  output: unknown
): number | undefined {
  if (!output || typeof output !== "object") return undefined;
  const o = output as Record<string, unknown>;
  if (tool === "recallSimilarIncidents" && Array.isArray(o.memories)) {
    return o.memories.length;
  }
  if (tool === "searchCode" && Array.isArray(o.snippets)) {
    return o.snippets.length;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }

  const { trace, fixtureHint, clientRunId } = parsed.data;
  const orgId = parsed.data.orgId ?? configuredDefaultOrgId();
  if (!orgId) {
    return new Response(
      "orgId is required. Set TRIAGE_DEFAULT_ORG_ID or send orgId in the request body.",
      { status: 400 }
    );
  }
  const convex = makeConvexMirror();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (frame: SseFrame) => {
        try {
          controller.enqueue(encodeFrame(frame));
        } catch {
          // Stream closed by client — swallow.
        }
      };
      let sseSequence = 0;

      // Best-effort: create the Convex run row up front so the dashboard
      // and useQuery(api.triage.recentRuns) reflect the run immediately.
      let triageRunId: Id<"triageRuns"> | null = null;
      if (convex) {
        try {
          triageRunId = await convex.mutation(api.triage.createRun, {
            orgId,
            inputTrace: trace,
          });
          enqueue({
            event: "run_started",
            data: { triageRunId, clientRunId },
          });
          await convex.mutation(api.triage.setStatus, {
            triageRunId,
            status: "running",
          });
        } catch (err) {
          console.warn("[mirror] convex createRun failed:", err);
        }
      }

      // Fire-and-forget: never let mirror failures block the SSE stream.
      const mirror = (fn: () => Promise<unknown>) => {
        fn().catch((err) =>
          console.warn("[mirror] convex write failed (non-fatal):", err)
        );
      };

      const sink = (event: AgentEvent) => {
        for (const f of toSseFrames(event, sseSequence++)) enqueue(f);

        // Mirror to Convex hot-path tables when we have a run id.
        if (!convex || !triageRunId) return;
        const id = triageRunId;

        if (event.type === "tool_call") {
          mirror(() =>
            convex.mutation(api.tools.logToolCall, {
              triageRunId: id,
              tool: event.tool,
              input: event.input,
              output: event.output,
              latencyMs: event.latencyMs,
            })
          );
        } else if (event.type === "citation") {
          mirror(() =>
            convex.mutation(api.triage.insertCitation, {
              triageRunId: id,
              source: event.citation.source,
              sourceId: event.citation.source_id,
              excerpt: event.citation.excerpt,
              metadata: event.citation.metadata ?? {},
              verified: event.citation.verified,
            })
          );
        } else if (event.type === "result") {
          // Mirror keeps source_ids as the citation pointer strings
          // (the Convex-hosted run path stores actual citation _ids
          // — this small divergence is acceptable for the dashboard view).
          mirror(() =>
            convex.mutation(api.triage.finalizeResult, {
              triageRunId: id,
              timeline: event.result.timeline,
              rootCause: {
                text: event.result.root_cause.text,
                citations: event.result.root_cause.citations.map(
                  (c) => c.source_id
                ),
              },
              suspectedFix: {
                file: event.result.suspected_fix.file,
                line: event.result.suspected_fix.line,
                diff: event.result.suspected_fix.diff,
                citations: event.result.suspected_fix.citations.map(
                  (c) => c.source_id
                ),
              },
              similarIncidents: event.result.similar_incidents.map(
                (s) => s.memory_id
              ),
              // Rich shape for the wow moment: needed because the
              // useQuery-driven UI no longer parses SSE.
              similarIncidentsDetailed: event.result.similar_incidents.map(
                (s) => ({
                  memory_id: s.memory_id,
                  summary: s.summary,
                  relevance: s.relevance,
                  fromTriageHistory: s.fromTriageHistory,
                })
              ),
            })
          );
          mirror(() =>
            convex.mutation(api.triage.setStatus, {
              triageRunId: id,
              status: "done",
            })
          );
        } else if (event.type === "error") {
          mirror(() =>
            convex.mutation(api.triage.setStatus, {
              triageRunId: id,
              status: "error",
              errorMessage: event.message,
            })
          );
        }
      };

      try {
        await runAgent({ trace, orgId, fixtureHint }, sink);
      } catch (err) {
        enqueue({ event: "error", data: { message: (err as Error).message } });
      }
      enqueue({ event: "end", data: {} });
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

/** GET /api/triage — health probe. */
export async function GET() {
  return Response.json({
    ok: true,
    demoMode: getDemoMode(),
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasHyperspell: Boolean(process.env.HYPERSPELL_API_KEY),
    hasNia: Boolean(process.env.NIA_API_KEY),
    hasInsForge: Boolean(
      process.env.INSFORGE_BASE_URL &&
        (process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_ANON_KEY)
    ),
  });
}
