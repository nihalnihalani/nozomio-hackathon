/**
 * POST /api/triage — Next.js fallback route.
 *
 * Used when Convex isn't configured (NEXT_PUBLIC_CONVEX_URL absent) or
 * for replay-only deployments where we want a thin REST surface
 * (Sentry/PagerDuty webhooks, external tooling, simple curl demos).
 *
 * Streams the agent loop's events as Server-Sent Events. The frontend's
 * primary path is still useMutation(api.triage.start) + useQuery — this
 * route is the lifeboat per Invariant 4 (Hermetic Demo Mode).
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
import { runAgent, type AgentEvent } from "@/lib/agent/loop";

export const runtime = "nodejs"; // we read seed/ files for cite-or-die

const RequestSchema = z.object({
  trace: z.string().min(1),
  orgId: z.string().min(1).default("demo-org"),
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
function toSseFrames(event: AgentEvent): SseFrame[] {
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
            id: `${event.tool}-${event.at}`,
            tool: event.tool,
            input: event.input,
            at: event.at,
          },
        },
        {
          event: "tool_call_done",
          data: {
            id: `${event.tool}-${event.at}`,
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

  const { trace, orgId, fixtureHint } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (frame: SseFrame) => {
        try {
          controller.enqueue(encodeFrame(frame));
        } catch {
          // Stream closed by client — swallow.
        }
      };
      const sink = (event: AgentEvent) => {
        for (const f of toSseFrames(event)) enqueue(f);
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
    demoMode: process.env.DEMO_MODE ?? "replay",
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    hasHyperspell: Boolean(process.env.HYPERSPELL_API_KEY),
    hasNia: Boolean(process.env.NIA_API_KEY),
    hasInsForge: Boolean(
      process.env.INSFORGE_BASE_URL && process.env.INSFORGE_ANON_KEY
    ),
  });
}
