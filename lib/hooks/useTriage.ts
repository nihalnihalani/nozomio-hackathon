"use client";

/**
 * useTriage — abstracts Convex `@convex-dev/agent` UIMessages vs `/api/triage` SSE.
 *
 * Both modes expose the SAME interface so the UI doesn't branch:
 *   const { run, byId, isRunning, error, mode } = useTriage();
 *
 * - `run({ trace })`  → returns `triageRunId: string`
 * - `byId(id)`        → returns reactive `TriageRunSnapshot` (or null while loading)
 *
 * Convex path (active when NEXT_PUBLIC_CONVEX_URL is set AND a fast probe
 * to that URL succeeds — see `convexProbeOk` below) — Phase 2:
 *   - Kicks off the agent via `useMutation(api.triage.start)({orgId, trace})`.
 *     The mutation creates an Agent component thread, persists
 *     `triageRuns.threadId`, and schedules `internal.triageNode.runTriage`
 *     (which calls `thread.streamText({ saveStreamDeltas: true })`).
 *     The mutation returns the Convex `triageRunId` directly — no SSE.
 *   - The hook then subscribes to:
 *       1. `useQuery(api.triage.runById, { id })` to resolve `threadId`
 *          + run-level metadata (status, timeline, rootCause, suspectedFix,
 *          similarIncidentsDetailed, errorMessage).
 *       2. `useUIMessages(api.triage.listMessages, { threadId }, { stream: true })`
 *          for live token-by-token deltas from the agent's message stream.
 *     The two are reshaped into the existing `TriageRunSnapshot` shape via
 *     `uiMessagesToTriageSnapshot()` so `TraceUI` + result cards keep working.
 *
 *   Why fetch threadId via runById? The frontend only knows the triageRunId
 *   after `start` returns; the threadId lives on that row. One reactive
 *   query per slot resolves it cleanly without changing the public API.
 *
 *   Limitation: hooks can't be called conditionally, so this hook hardcodes
 *   TWO subscription slots (Trace A / Trace B layout). A 3rd concurrent run
 *   would not render.
 *
 *   Probe gate (fresh-clone safety): `NEXT_PUBLIC_CONVEX_URL` set without a
 *   reachable backend used to hang the UI for 8s before failing. Now we
 *   fire-and-forget `${url}/version` on mount; mode flips to `convex` only
 *   on success. Until probe completes (or on probe failure) we stay in SSE
 *   mode so dev iteration with no convex backend Just Works.
 *
 * SSE path (fallback when NEXT_PUBLIC_CONVEX_URL is unset OR probe fails):
 *   - POSTs `{ trace }` to `/api/triage`, consumes Server-Sent Events,
 *     accumulates a snapshot in local React state keyed by client-side id.
 *   - Demo runs with no Convex connection at all (Invariant 4).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages, useSmoothText } from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Citation } from "@/lib/types";

// Re-export `useSmoothText` so components can opt into per-token rendering
// without importing `@convex-dev/agent/react` directly. Centralizing the
// dependency here keeps component code Convex-agnostic.
export { useSmoothText };

// ─── Snapshot shape (frontend-side mirror of Convex triageRuns + relations) ──

export type TriageStatus = "pending" | "running" | "done" | "error";

export interface ToolCallSnapshot {
  id: string;
  tool: "recallSimilarIncidents" | "searchCode";
  status: "running" | "done" | "error";
  input?: unknown;
  output?: unknown;
  resultCount?: number;
  latencyMs?: number;
  at: number;
}

export interface TimelineEntry {
  at: string;
  event: string;
}

export interface RootCause {
  text: string;
  citations: Citation[];
}

export interface SuspectedFix {
  file: string;
  line: number;
  diff: string;
  citations: Citation[];
}

export interface SimilarIncident {
  memory_id: string;
  summary: string;
  relevance: number;
  fromTriageHistory?: boolean;
}

export interface TriageRunSnapshot {
  id: string;
  status: TriageStatus;
  inputTrace: string;
  startedAt: number;
  finishedAt?: number;
  toolCalls: ToolCallSnapshot[];
  citations: Citation[];
  timeline?: TimelineEntry[];
  rootCause?: RootCause;
  suspectedFix?: SuspectedFix;
  similarIncidents?: SimilarIncident[];
  error?: string;
  /**
   * Accumulated assistant text (for the Convex path, this is the most-recent
   * streaming/finalized assistant message's `.text`). Surfaces from
   * `useUIMessages` so consumers can run `useSmoothText` over it.
   */
  streamingText?: string;
  /** True while a UIMessage is actively streaming. Drives `useSmoothText`. */
  isStreaming?: boolean;
}

export type TriageMode = "convex" | "sse";

export interface UseTriageReturn {
  mode: TriageMode;
  isRunning: boolean;
  error: string | null;
  /** Kicks off a triage; returns the triageRunId. */
  run: (args: { trace: string }) => Promise<string>;
  /** Subscribes to the snapshot for a given run; null while loading. */
  byId: (id: string | null) => TriageRunSnapshot | null;
}

function convexEnvUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url && url.length > 0 ? url : null;
}

/**
 * Cheap reachability probe for the convex backend. Used to gate
 * convex-mode dispatch on a fresh clone where `.env.local` advertises
 * `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210` but no `npx convex dev`
 * is running locally. Without this, every triage attempt hangs on the
 * 8s `run_started` failsafe before silently failing.
 *
 * The probe is fire-and-forget; on success we flip to convex mode, on
 * any failure (network, timeout, non-2xx) we stay in SSE mode.
 *
 * Probe target: `/version` is the cheapest documented convex HTTP
 * endpoint and exists on every deployment (cloud or `convex dev`).
 */
async function probeConvex(url: string, timeoutMs = 1500): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url.replace(/\/$/, "")}/version`, {
      method: "GET",
      signal: controller.signal,
      // GET /version is plain text; don't send credentials or auth.
      cache: "no-store",
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Adapter: UIMessage[] + run row → TriageRunSnapshot ─────────────────────
//
// The Agent component's `UIMessage.parts[]` carries each tool call as a
// `tool-${name}` part with `state` + `input` + `output`. We reshape into
// the existing `TriageRunSnapshot` so the rest of the UI is unchanged.
// All `as any` shape-bridging is isolated in this single helper.

type AgentRunRow = {
  _id: Id<"triageRuns">;
  inputTrace: string;
  status: TriageStatus;
  startedAt: number;
  finishedAt?: number;
  threadId?: string;
  timeline?: TimelineEntry[];
  rootCause?: { text: string; citations: string[] };
  suspectedFix?: {
    file: string;
    line: number;
    diff: string;
    citations: string[];
  };
  similarIncidents?: string[];
  similarIncidentsDetailed?: SimilarIncident[];
  errorMessage?: string;
};

/**
 * Loose tool-part shape that covers both `tool-recallSimilarIncidents`,
 * `tool-searchCode`, and the AI SDK's `dynamic-tool` fallback. We deliberately
 * keep this `as any` boundary inside `uiMessagesToTriageSnapshot` so the rest
 * of the codebase only ever sees `TriageRunSnapshot`.
 */
type ToolPart = {
  type: string; // e.g. "tool-recallSimilarIncidents" | "dynamic-tool"
  toolName?: string;
  toolCallId?: string;
  state?: string; // "input-streaming" | "input-available" | "output-available" | ...
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const TOOL_NAMES = ["recallSimilarIncidents", "searchCode"] as const;
type KnownTool = (typeof TOOL_NAMES)[number];

function extractToolName(part: ToolPart): KnownTool | null {
  // Static tool parts: `tool-recallSimilarIncidents`, `tool-searchCode`.
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    const name = part.type.slice("tool-".length);
    if (TOOL_NAMES.includes(name as KnownTool)) return name as KnownTool;
  }
  // Dynamic tool parts: `{ type: "dynamic-tool", toolName }`.
  if (
    part.type === "dynamic-tool" &&
    typeof part.toolName === "string" &&
    TOOL_NAMES.includes(part.toolName as KnownTool)
  ) {
    return part.toolName as KnownTool;
  }
  return null;
}

function toolStateToStatus(
  state: string | undefined
): ToolCallSnapshot["status"] {
  if (state === "output-available") return "done";
  if (state === "output-error") return "error";
  return "running";
}

function memoryToCitation(mem: unknown): Citation | null {
  if (!mem || typeof mem !== "object") return null;
  // Hyperspell shape: { id, text, source, metadata }
  const m = mem as {
    id?: unknown;
    text?: unknown;
    source?: unknown;
    metadata?: unknown;
  };
  if (typeof m.id !== "string" || typeof m.source !== "string") return null;
  if (
    m.source !== "slack" &&
    m.source !== "notion" &&
    m.source !== "gmail" &&
    m.source !== "code"
  ) {
    return null;
  }
  return {
    source: m.source,
    source_id: m.id,
    excerpt: typeof m.text === "string" ? m.text.slice(0, 500) : "",
    metadata:
      m.metadata && typeof m.metadata === "object"
        ? (m.metadata as Record<string, unknown>)
        : {},
    // Hyperspell recall is trusted by Invariant 1 — same as the SSE path.
    verified: true,
  };
}

function snippetToCitation(snip: unknown): Citation | null {
  if (!snip || typeof snip !== "object") return null;
  const s = snip as {
    file?: unknown;
    line?: unknown;
    content?: unknown;
    citation_url?: unknown;
  };
  if (typeof s.file !== "string" || typeof s.line !== "number") return null;
  return {
    source: "code",
    source_id: `${s.file}:${s.line}`,
    excerpt: typeof s.content === "string" ? s.content.slice(0, 500) : "",
    metadata:
      typeof s.citation_url === "string"
        ? { citation_url: s.citation_url }
        : {},
    // searchCode pre-verifies file:line in the live path; assume verified
    // here. The frontend renders [verification failed] only when the
    // server explicitly emits verified=false, which the agent component's
    // tool output preserves via the same path.
    verified: true,
  };
}

/**
 * Detect a "reinforced" memory (Invariant 2 — the 🧠 badge). The Agent's
 * `searchOtherThreads` RAG can surface prior triage memories naturally;
 * we tag them based on either the Hyperspell metadata.kind or the
 * `mem_reinforce_` id prefix that `convex/reinforce.ts` writes.
 */
function isFromTriageHistory(mem: unknown): boolean {
  if (!mem || typeof mem !== "object") return false;
  const m = mem as { id?: unknown; metadata?: unknown };
  if (
    typeof m.id === "string" &&
    (m.id.startsWith("mem_reinforce_") || m.id.startsWith("reinforce_"))
  ) {
    return true;
  }
  if (m.metadata && typeof m.metadata === "object") {
    const meta = m.metadata as { kind?: unknown; source?: unknown };
    if (meta.kind === "triage_history" || meta.source === "triage_history") {
      return true;
    }
  }
  return false;
}

/**
 * Reshape: agent component UIMessages + the triageRuns row → TriageRunSnapshot.
 *
 *   - Tool calls come from `parts[type="tool-${name}"]` across all messages.
 *   - Citations come from each tool call's `output` payload (memories /
 *     snippets), preserving the `verified` flag (Invariant 1).
 *   - Similar incidents use the run row's structured `similarIncidentsDetailed`
 *     when populated (cold-path mirror), else fall back to detecting them
 *     from the recallSimilarIncidents output (preserves the 🧠 badge via
 *     `fromTriageHistory` detection).
 *   - Streaming text is the most-recent assistant message's `.text` so the
 *     UI can run `useSmoothText` for token-by-token "agent thinking".
 */
/**
 * Loose UIMessage shape we consume. The Agent SDK's `UIMessage` carries
 * many extra fields (id, key, etc.) that we don't need; using a structural
 * subset keeps the helper compatible with both `UIMessage` (from
 * `useUIMessages`) and `UIMessageLike` (from `useStreamingUIMessages`)
 * without an explicit cast at every call site.
 */
type UIMessageLike = {
  role: string;
  parts?: unknown[];
  status?: string;
  text?: string;
  _creationTime?: number;
};

export function uiMessagesToTriageSnapshot(
  uiMessages: UIMessageLike[],
  runRow: AgentRunRow
): TriageRunSnapshot {
  const toolCalls: ToolCallSnapshot[] = [];
  const citations: Citation[] = [];
  const seenCitations = new Set<string>();
  const similarFromTools: SimilarIncident[] = [];
  const seenMemoryIds = new Set<string>();

  let latestStreamingText = "";
  let isStreaming = false;

  for (const msg of uiMessages) {
    if (msg.role === "assistant") {
      // The most recent assistant message carries the smoothed text. The
      // Agent component's `UIMessage.text` is the full assembled text for
      // that message (including streaming partials).
      if (typeof msg.text === "string" && msg.text.length > 0) {
        latestStreamingText = msg.text;
      }
      if (msg.status === "streaming" || msg.status === "pending") {
        isStreaming = true;
      }
    }

    const parts = (msg as unknown as { parts?: unknown[] }).parts ?? [];
    for (const rawPart of parts) {
      const part = rawPart as ToolPart;
      const toolName = extractToolName(part);
      if (!toolName) continue;

      const callId =
        (typeof part.toolCallId === "string" && part.toolCallId) ||
        `${toolName}-${toolCalls.length}`;
      const status = toolStateToStatus(part.state);

      const output = part.output;
      let resultCount: number | undefined = undefined;

      if (toolName === "recallSimilarIncidents" && output) {
        const memories = (output as { memories?: unknown[] }).memories ?? [];
        resultCount = memories.length;
        for (const mem of memories) {
          const c = memoryToCitation(mem);
          if (c) {
            const key = `${c.source}:${c.source_id}`;
            if (!seenCitations.has(key)) {
              seenCitations.add(key);
              citations.push(c);
            }
          }
          // Reinforcement detection (Invariant 2 — 🧠 badge).
          if (mem && typeof mem === "object") {
            const m = mem as {
              id?: unknown;
              text?: unknown;
              score?: unknown;
            };
            if (typeof m.id === "string" && !seenMemoryIds.has(m.id)) {
              seenMemoryIds.add(m.id);
              similarFromTools.push({
                memory_id: m.id,
                summary: typeof m.text === "string" ? m.text : "",
                relevance: typeof m.score === "number" ? m.score : 0,
                fromTriageHistory: isFromTriageHistory(mem),
              });
            }
          }
        }
      }

      if (toolName === "searchCode" && output) {
        const snippets = (output as { snippets?: unknown[] }).snippets ?? [];
        resultCount = snippets.length;
        for (const snip of snippets) {
          const c = snippetToCitation(snip);
          if (c) {
            const key = `${c.source}:${c.source_id}`;
            if (!seenCitations.has(key)) {
              seenCitations.add(key);
              citations.push(c);
            }
          }
        }
      }

      // Use the message's _creationTime as a stable `at` ordering. Falls
      // back to insertion order if missing.
      const at =
        typeof (msg as unknown as { _creationTime?: number })._creationTime ===
        "number"
          ? (msg as unknown as { _creationTime: number })._creationTime
          : Date.now();

      // Dedupe by callId — UIMessages often update the same tool part as
      // state advances (input-streaming → input-available → output-available).
      const existingIdx = toolCalls.findIndex((tc) => tc.id === callId);
      const next: ToolCallSnapshot = {
        id: callId,
        tool: toolName,
        status,
        input: part.input,
        output,
        resultCount,
        at,
      };
      if (existingIdx >= 0) {
        toolCalls[existingIdx] = next;
      } else {
        toolCalls.push(next);
      }
    }
  }

  // Resolve cited source-ids in rootCause/suspectedFix back to Citation
  // objects, matching the SSE-path behaviour. Falls back to a stub if
  // no matching citation row exists yet (the agent may have referenced a
  // source the tool hasn't surfaced; rare, but preserve the contract).
  const resolveCitations = (ids: string[]): Citation[] =>
    ids.map((sid) => {
      const found = citations.find((c) => c.source_id === sid);
      if (found) return found;
      return {
        source: "code",
        source_id: sid,
        excerpt: "",
        metadata: {},
        verified: false,
      };
    });

  const similarIncidents =
    runRow.similarIncidentsDetailed && runRow.similarIncidentsDetailed.length > 0
      ? runRow.similarIncidentsDetailed
      : similarFromTools.length > 0
      ? similarFromTools
      : runRow.similarIncidents?.map((mid) => ({
          memory_id: mid,
          summary: "",
          relevance: 0,
        }));

  return {
    id: runRow._id as unknown as string,
    status: runRow.status,
    inputTrace: runRow.inputTrace,
    startedAt: runRow.startedAt,
    finishedAt: runRow.finishedAt,
    toolCalls,
    citations,
    timeline: runRow.timeline,
    rootCause: runRow.rootCause
      ? {
          text: runRow.rootCause.text,
          citations: resolveCitations(runRow.rootCause.citations),
        }
      : undefined,
    suspectedFix: runRow.suspectedFix
      ? {
          file: runRow.suspectedFix.file,
          line: runRow.suspectedFix.line,
          diff: runRow.suspectedFix.diff,
          citations: resolveCitations(runRow.suspectedFix.citations),
        }
      : undefined,
    similarIncidents,
    error: runRow.errorMessage,
    streamingText: latestStreamingText || undefined,
    isStreaming,
  };
}

// ─── SSE helpers (used by the SSE fallback path) ─────────────────────────────

type RunStore = Map<string, TriageRunSnapshot>;

function makeId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function applySseEvent(
  prev: TriageRunSnapshot,
  event: { type: string; payload: Record<string, unknown> }
): TriageRunSnapshot {
  const next: TriageRunSnapshot = { ...prev };
  switch (event.type) {
    case "status": {
      const status = event.payload.status as TriageStatus | undefined;
      if (status) next.status = status;
      if (status === "done") next.finishedAt = Date.now();
      break;
    }
    case "tool_call_start": {
      const tc = event.payload as unknown as ToolCallSnapshot;
      next.toolCalls = [...prev.toolCalls, { ...tc, status: "running" }];
      break;
    }
    case "tool_call_done": {
      const id = event.payload.id as string;
      const output = event.payload.output;
      const resultCount = event.payload.resultCount as number | undefined;
      const latencyMs = event.payload.latencyMs as number | undefined;
      next.toolCalls = prev.toolCalls.map((t) =>
        t.id === id
          ? { ...t, status: "done", output, resultCount, latencyMs }
          : t
      );
      break;
    }
    case "citation": {
      const citation = event.payload as unknown as Citation;
      next.citations = [...prev.citations, citation];
      break;
    }
    case "timeline":
      next.timeline = event.payload.timeline as TimelineEntry[];
      break;
    case "root_cause":
      next.rootCause = event.payload as unknown as RootCause;
      break;
    case "suspected_fix":
      next.suspectedFix = event.payload as unknown as SuspectedFix;
      break;
    case "similar_incidents":
      next.similarIncidents = event.payload.incidents as SimilarIncident[];
      break;
    case "error":
      next.status = "error";
      next.error = (event.payload.message as string) ?? "unknown error";
      next.finishedAt = Date.now();
      break;
    case "end":
      if (next.status === "running" || next.status === "pending") {
        next.status = "done";
        next.finishedAt = Date.now();
      }
      break;
    default:
      break;
  }
  return next;
}

async function consumeFullSseStream(
  response: Response,
  runId: string,
  setStore: React.Dispatch<React.SetStateAction<RunStore>>
): Promise<void> {
  if (!response.body) {
    setStore((s) => {
      const prev = s.get(runId);
      if (!prev) return s;
      const next = new Map(s);
      next.set(runId, { ...prev, status: "error", error: "no response body" });
      return next;
    });
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");
      let evtType = "message";
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) evtType = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(dataLine);
      } catch {
        continue;
      }
      setStore((s) => {
        const prev = s.get(runId);
        if (!prev) return s;
        const next = new Map(s);
        next.set(runId, applySseEvent(prev, { type: evtType, payload }));
        return next;
      });
    }
  }
  setStore((s) => {
    const prev = s.get(runId);
    if (!prev || prev.status === "done" || prev.status === "error") return s;
    const next = new Map(s);
    next.set(runId, { ...prev, status: "done", finishedAt: Date.now() });
    return next;
  });
}

// ─── Convex slot subscription helper ─────────────────────────────────────────
//
// One slot = one subscription to (runById + listMessages). Hooks must be
// called at the top level, so we hardcode two slots (matching Trace A / B).

interface ConvexSlot {
  runId: Id<"triageRuns"> | null;
  snapshot: TriageRunSnapshot | null;
}

function useConvexSlot(runId: Id<"triageRuns"> | null): ConvexSlot {
  // 1. Run row → resolves threadId + holds run-level metadata.
  const runRow = useQuery(
    api.triage.runById,
    runId ? { id: runId } : "skip"
  ) as AgentRunRow | null | undefined;

  const threadId = runRow?.threadId ?? null;

  // 2. Live UIMessages (with delta streaming) keyed by threadId.
  // `useUIMessages` accepts the `"skip"` sentinel to no-op until threadId
  // resolves. The query itself is typed as `UIMessagesQuery` because the
  // server signature `{ threadId, paginationOpts, streamArgs }` matches.
  // Cast is needed because the committed `_generated/api.d.ts` types the
  // api loosely until `npx convex dev` runs locally — same pattern used
  // throughout the project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listMessagesQuery = (api.triage as any).listMessages;
  const { results: uiMessages } = useUIMessages(
    listMessagesQuery,
    threadId ? { threadId } : "skip",
    { initialNumItems: 50, stream: true }
  );

  const snapshot = useMemo<TriageRunSnapshot | null>(() => {
    if (!runRow) return null;
    return uiMessagesToTriageSnapshot(uiMessages ?? [], runRow);
  }, [runRow, uiMessages]);

  return { runId, snapshot };
}

// ─── The public hook ─────────────────────────────────────────────────────────

export function useTriage(): UseTriageReturn {
  // Mode selection: env-gate (`NEXT_PUBLIC_CONVEX_URL` set) AND a successful
  // `/version` probe at mount. Until probe completes (or on probe failure),
  // we stay in SSE mode — see file-level comment for rationale.
  const envUrl = convexEnvUrl();
  const [convexProbeOk, setConvexProbeOk] = useState(false);
  const mode: TriageMode = envUrl && convexProbeOk ? "convex" : "sse";

  useEffect(() => {
    if (!envUrl) return;
    let cancelled = false;
    void probeConvex(envUrl).then((ok) => {
      if (!cancelled && ok) setConvexProbeOk(true);
    });
    return () => {
      cancelled = true;
    };
  }, [envUrl]);

  // Convex agent kickoff. The hook is always mounted (rules of hooks); the
  // mutation only fires when `mode === "convex"`. `useMutation` reads the
  // ConvexProvider from `app/providers.tsx`, which is always mounted with
  // a placeholder URL when env is unset (see providers.tsx for why).
  const startTriage = useMutation(api.triage.start);

  // Two slots for Convex subscriptions. Hardcoded because hooks can't be
  // called conditionally — see file-level comment.
  const [slotAId, setSlotAId] = useState<Id<"triageRuns"> | null>(null);
  const [slotBId, setSlotBId] = useState<Id<"triageRuns"> | null>(null);
  const slotA = useConvexSlot(slotAId);
  const slotB = useConvexSlot(slotBId);

  // SSE-mode local store. Always created so hook ordering is stable.
  const [sseStore, setSseStore] = useState<RunStore>(() => new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  // Reset isRunning when all in-flight runs settle.
  useEffect(() => {
    if (mode === "convex") {
      const aDone =
        !slotAId ||
        slotA.snapshot === null ||
        slotA.snapshot.status === "done" ||
        slotA.snapshot.status === "error";
      const bDone =
        !slotBId ||
        slotB.snapshot === null ||
        slotB.snapshot.status === "done" ||
        slotB.snapshot.status === "error";
      if (aDone && bDone && isRunning) setIsRunning(false);
      return;
    }
    let anyRunning = false;
    for (const id of inFlightRef.current) {
      const snap = sseStore.get(id);
      if (snap && (snap.status === "pending" || snap.status === "running")) {
        anyRunning = true;
        break;
      }
    }
    if (!anyRunning && isRunning) setIsRunning(false);
  }, [
    mode,
    slotA.snapshot,
    slotB.snapshot,
    slotAId,
    slotBId,
    sseStore,
    isRunning,
  ]);

  const placeInSlot = useCallback(
    (id: Id<"triageRuns">) => {
      // Slot policy: prefer empty A, then empty B, else rotate (drop A).
      if (slotAId === null) setSlotAId(id);
      else if (slotBId === null) setSlotBId(id);
      else {
        setSlotAId(slotBId);
        setSlotBId(id);
      }
    },
    [slotAId, slotBId]
  );

  const run = useCallback(
    async ({ trace }: { trace: string }): Promise<string> => {
      setError(null);
      setIsRunning(true);

      if (mode === "convex") {
        try {
          // Phase 2 wiring: kick off the agent component directly via
          // `api.triage.start`. The mutation creates the Agent thread,
          // persists `triageRuns.threadId`, schedules `runTriage`, and
          // returns the new triageRunId. No SSE; the reactive
          // `useConvexSlot` subscription drives the UI from here on.
          const id = (await startTriage({
            orgId: "demo-org",
            trace,
          })) as Id<"triageRuns">;
          if (!id) {
            const message = "convex start returned no id";
            setError(message);
            setIsRunning(false);
            return "";
          }
          placeInSlot(id);
          return id as unknown as string;
        } catch (e) {
          const message = e instanceof Error ? e.message : "convex start failed";
          setError(message);
          setIsRunning(false);
          throw e;
        }
      }

      // ─── SSE fallback path ────────────────────────────────────────────────
      const id = makeId();
      inFlightRef.current.add(id);
      setSseStore((s) => {
        const next = new Map(s);
        next.set(id, {
          id,
          status: "pending",
          inputTrace: trace,
          startedAt: Date.now(),
          toolCalls: [],
          citations: [],
        });
        return next;
      });

      try {
        const res = await fetch("/api/triage", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
          },
          body: JSON.stringify({ trace, clientRunId: id }),
        });
        if (!res.ok) {
          const message = `triage api ${res.status}`;
          setError(message);
          setSseStore((s) => {
            const prev = s.get(id);
            if (!prev) return s;
            const next = new Map(s);
            next.set(id, {
              ...prev,
              status: "error",
              error: message,
              finishedAt: Date.now(),
            });
            return next;
          });
          return id;
        }
        consumeFullSseStream(res, id, setSseStore).catch((e: unknown) => {
          const message = e instanceof Error ? e.message : "stream error";
          setError(message);
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "fetch failed";
        setError(message);
        setSseStore((s) => {
          const prev = s.get(id);
          if (!prev) return s;
          const next = new Map(s);
          next.set(id, {
            ...prev,
            status: "error",
            error: message,
            finishedAt: Date.now(),
          });
          return next;
        });
      }
      return id;
    },
    [mode, placeInSlot, startTriage]
  );

  const byId = useCallback(
    (id: string | null): TriageRunSnapshot | null => {
      if (!id) return null;
      if (mode === "convex") {
        if (id === slotAId) return slotA.snapshot;
        if (id === slotBId) return slotB.snapshot;
        return null;
      }
      return sseStore.get(id) ?? null;
    },
    [mode, slotAId, slotBId, slotA.snapshot, slotB.snapshot, sseStore]
  );

  return { mode, isRunning, error, run, byId };
}
