"use client";

/**
 * useTriage — abstracts Convex `useMutation/useQuery` vs `/api/triage` SSE.
 *
 * Both modes expose the SAME interface so the UI doesn't branch:
 *   const { run, byId, isRunning, error, mode } = useTriage();
 *
 * - `run({ trace })`  → returns `triageRunId: string`
 * - `byId(id)`        → returns reactive `TriageRunSnapshot` (or null while loading)
 *
 * Convex path (active when NEXT_PUBLIC_CONVEX_URL is set):
 *   - Kicks off the agent via POST /api/triage (the agent runtime stays
 *     in Next.js because lib/agent/loop reads seed/ + data/replay/ from
 *     disk, neither of which is bundled into Convex's sandbox).
 *   - Reads ONLY the `run_started` SSE event to capture the Convex runId.
 *   - All subsequent UI state comes from `useQuery(api.triage.byId)` —
 *     populated by the mirror writes in app/api/triage/route.ts.
 *
 *   Limitation: `useQuery` must be called at the top level (rules of
 *   hooks), so this hook hardcodes TWO subscription slots — matching the
 *   current UI's slot A / slot B layout. A 3rd concurrent run would not
 *   render. Re-architect with per-component subscriptions when needed.
 *
 * SSE path (fallback when NEXT_PUBLIC_CONVEX_URL is unset):
 *   - POSTs `{ trace }` to `/api/triage`, consumes Server-Sent Events,
 *     accumulates a snapshot in local React state keyed by client-side id.
 *   - Demo runs with no Convex connection at all (Invariant 4).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Citation } from "@/lib/types";

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

function hasConvex(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

// ─── Adapter: Convex byId result → TriageRunSnapshot ─────────────────────────

type ConvexCitationRow = {
  _id: Id<"citations">;
  source: "slack" | "notion" | "gmail" | "code";
  sourceId: string;
  excerpt: string;
  metadata?: unknown;
  verified: boolean;
};

type ConvexToolCallRow = {
  _id: Id<"toolCalls">;
  tool: "recallSimilarIncidents" | "searchCode";
  input: unknown;
  output: unknown;
  latencyMs: number;
  at: number;
};

type ConvexByIdResult = {
  run: {
    _id: Id<"triageRuns">;
    inputTrace: string;
    status: TriageStatus;
    startedAt: number;
    finishedAt?: number;
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
  toolCalls: ConvexToolCallRow[];
  citations: ConvexCitationRow[];
  memoryEvents: unknown[];
};

function rowToCitation(c: ConvexCitationRow): Citation {
  return {
    source: c.source,
    source_id: c.sourceId,
    excerpt: c.excerpt,
    metadata: (c.metadata ?? {}) as Record<string, unknown>,
    verified: c.verified,
  };
}

/** Resolve a list of source_id strings back to Citation objects via the
 *  citations relation, falling back to a synthetic stub if missing. */
function resolveCitations(
  ids: string[],
  citations: ConvexCitationRow[]
): Citation[] {
  return ids.map((sid) => {
    const found = citations.find((c) => c.sourceId === sid);
    if (found) return rowToCitation(found);
    return {
      source: "code",
      source_id: sid,
      excerpt: "",
      metadata: {},
      verified: false,
    };
  });
}

function convexToSnapshot(data: ConvexByIdResult): TriageRunSnapshot {
  const r = data.run;
  return {
    id: r._id as unknown as string,
    status: r.status,
    inputTrace: r.inputTrace,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    toolCalls: data.toolCalls.map((tc) => ({
      id: `${tc.tool}-${tc.at}`,
      tool: tc.tool,
      status: "done" as const,
      input: tc.input,
      output: tc.output,
      latencyMs: tc.latencyMs,
      at: tc.at,
    })),
    citations: data.citations.map(rowToCitation),
    timeline: r.timeline,
    rootCause: r.rootCause
      ? {
          text: r.rootCause.text,
          citations: resolveCitations(r.rootCause.citations, data.citations),
        }
      : undefined,
    suspectedFix: r.suspectedFix
      ? {
          file: r.suspectedFix.file,
          line: r.suspectedFix.line,
          diff: r.suspectedFix.diff,
          citations: resolveCitations(
            r.suspectedFix.citations,
            data.citations
          ),
        }
      : undefined,
    similarIncidents:
      r.similarIncidentsDetailed ??
      r.similarIncidents?.map((mid) => ({
        memory_id: mid,
        summary: "",
        relevance: 0,
      })),
    error: r.errorMessage,
  };
}

// ─── SSE helpers (used by both paths) ────────────────────────────────────────

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

/**
 * Read the SSE stream just long enough to extract the `run_started`
 * event, then return the convex runId. Subsequent SSE frames are
 * ignored — Convex `useQuery` becomes the source of truth from there.
 *
 * Reads continue in the background until the stream ends so the server
 * can finish writing without ECONNRESET.
 */
async function readConvexRunIdFromSse(
  response: Response
): Promise<Id<"triageRuns"> | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let foundId: Id<"triageRuns"> | null = null;
  let resolved = false;

  // Drain in the background until done.
  const drain = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
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
        if (evtType === "run_started" && dataLine && !resolved) {
          try {
            const payload = JSON.parse(dataLine) as { triageRunId: string };
            foundId = payload.triageRunId as unknown as Id<"triageRuns">;
            resolved = true;
          } catch {
            /* malformed; keep draining */
          }
        }
      }
    }
  })();

  // Race: either we find run_started, or the stream completes (which
  // means the agent ran without mirror writes — Convex absent / down).
  await Promise.race([
    new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        if (resolved) {
          clearInterval(tick);
          resolve();
        }
      }, 20);
      // Failsafe: never wait more than 8s for the run_started handshake.
      setTimeout(() => {
        clearInterval(tick);
        resolve();
      }, 8000);
    }),
    drain,
  ]);

  // Don't await the full drain — let it finish in the background.
  void drain;
  return foundId;
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

// ─── The public hook ─────────────────────────────────────────────────────────

export function useTriage(): UseTriageReturn {
  const mode: TriageMode = hasConvex() ? "convex" : "sse";

  // Two slots for Convex `useQuery` subscriptions. Hardcoded because
  // hooks can't be called conditionally — see file-level comment.
  const [slotAId, setSlotAId] = useState<Id<"triageRuns"> | null>(null);
  const [slotBId, setSlotBId] = useState<Id<"triageRuns"> | null>(null);
  const snapA = useQuery(
    api.triage.byId,
    slotAId ? { id: slotAId } : "skip"
  );
  const snapB = useQuery(
    api.triage.byId,
    slotBId ? { id: slotBId } : "skip"
  );

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
        snapA === undefined ||
        snapA === null ||
        snapA.run.status === "done" ||
        snapA.run.status === "error";
      const bDone =
        !slotBId ||
        snapB === undefined ||
        snapB === null ||
        snapB.run.status === "done" ||
        snapB.run.status === "error";
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
  }, [mode, snapA, snapB, slotAId, slotBId, sseStore, isRunning]);

  // Adapter helpers, memoized to keep referential stability for components.
  const snapAResolved = useMemo<TriageRunSnapshot | null>(
    () => (snapA ? convexToSnapshot(snapA as ConvexByIdResult) : null),
    [snapA]
  );
  const snapBResolved = useMemo<TriageRunSnapshot | null>(
    () => (snapB ? convexToSnapshot(snapB as ConvexByIdResult) : null),
    [snapB]
  );

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
          const res = await fetch("/api/triage", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "text/event-stream",
            },
            body: JSON.stringify({ trace }),
          });
          if (!res.ok) {
            const message = `triage api ${res.status}`;
            setError(message);
            setIsRunning(false);
            return "";
          }
          const convexId = await readConvexRunIdFromSse(res);
          if (!convexId) {
            const message =
              "convex run_started not received — falling back may be needed";
            setError(message);
            setIsRunning(false);
            return "";
          }
          placeInSlot(convexId);
          return convexId as unknown as string;
        } catch (e) {
          const message = e instanceof Error ? e.message : "fetch failed";
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
    [mode, placeInSlot]
  );

  const byId = useCallback(
    (id: string | null): TriageRunSnapshot | null => {
      if (!id) return null;
      if (mode === "convex") {
        if (id === slotAId) return snapAResolved;
        if (id === slotBId) return snapBResolved;
        return null;
      }
      return sseStore.get(id) ?? null;
    },
    [mode, slotAId, slotBId, snapAResolved, snapBResolved, sseStore]
  );

  return { mode, isRunning, error, run, byId };
}
