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
import { ConvexHttpClient } from "convex/browser";
import {
  runAgent,
  type AgentEvent,
  type TraceStateProbe,
} from "@/lib/agent/loop";
import { internal } from "@/convex/_generated/api";

export const runtime = "nodejs"; // we read seed/ files for cite-or-die

/**
 * Build a Trace-A-state probe backed by a `ConvexHttpClient`.
 *
 * Codex finding #3: the agent loop's gating decision must come from a
 * shared store (the canonical `memoryEvents` table), not a process-local
 * Map. When `NEXT_PUBLIC_CONVEX_URL` is set, the probe queries Convex
 * directly so this Next.js route and the Convex action consult the same
 * source of truth. When the env var is absent (the hermetic SSE-only
 * demo path), we return `undefined` so the loop falls back to its
 * in-process Map — preserving Invariant 4 (Hermetic Demo Mode).
 */
function buildTraceStateProbe(): TraceStateProbe | undefined {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return undefined;
  let client: ConvexHttpClient;
  try {
    client = new ConvexHttpClient(url);
  } catch {
    return undefined;
  }
  return async (orgId, withinMs) => {
    try {
      // The fallback `convex/_generated/api` stub types `internal` as
      // `AnyApi`, which makes its members untyped. The real codegen
      // overwrites this with precise types. Either way, the runtime
      // reference resolves to the `internal.traceState.hasRecentTraceA`
      // FunctionReference. Cast through `any` so the build works against
      // both the stub and the regenerated typings.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ref = (internal as any).traceState.hasRecentTraceA;
      const result = (await client.query(ref, { orgId, withinMs })) as boolean;
      return result;
    } catch {
      // Network / auth blip → tell the caller "I don't know" so it falls
      // back to the local Map rather than incorrectly reporting "no Trace A."
      return null;
    }
  };
}

const RequestSchema = z.object({
  trace: z.string().min(1),
  orgId: z.string().min(1).default("demo-org"),
  fixtureHint: z.string().optional(),
});

interface SseFrame {
  event: string;
  data: unknown;
}

function encodeFrame(frame: SseFrame): Uint8Array {
  const payload = `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
  return new TextEncoder().encode(payload);
}

// Monotonic per-route counter for tool_call IDs. Two same-tool same-millisecond
// calls would otherwise produce colliding IDs (Codex finding). The counter
// resets per server process — the IDs only need to be unique within a session.
let _toolCallSeq = 0;
function nextToolCallSeq(): number {
  return ++_toolCallSeq;
}

/**
 * Map an AgentEvent into one or more SSE frames matching the frontend's
 * useTriage hook contract.
 */
function toSseFrames(event: AgentEvent): SseFrame[] {
  switch (event.type) {
    case "status":
      return [{ event: "status", data: { status: event.status } }];
    case "tool_call": {
      // Frontend expects start+done as separate events. We collapse
      // both at the same instant since lib/agent/loop runs the tool
      // synchronously before emitting.
      // Codex finding: same-millisecond same-tool calls collide on
      // `${tool}-${at}`. Add a per-route monotonic counter so two
      // recallSimilarIncidents calls in the same ms get distinct IDs.
      const callId = `${event.tool}-${event.at}-${nextToolCallSeq()}`;
      return [
        {
          event: "tool_call_start",
          data: {
            id: callId,
            tool: event.tool,
            input: event.input,
            at: event.at,
          },
        },
        {
          event: "tool_call_done",
          data: {
            id: callId,
            output: event.output,
            latencyMs: event.latencyMs,
            resultCount: countResults(event.tool, event.output),
          },
        },
      ];
    }
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
  // Built once per request; the probe is cheap and the client holds no
  // long-lived state we'd want to reuse across requests.
  const hasRecentTraceA = buildTraceStateProbe();

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
        await runAgent(
          { trace, orgId, fixtureHint, hasRecentTraceA },
          sink
        );
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
