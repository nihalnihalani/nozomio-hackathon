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
 * Convex path: Used when `NEXT_PUBLIC_CONVEX_URL` is set AND the codegen'd
 * `convex/_generated/api` module is importable. The Backend Engineer wires
 * `convex/triage.ts` exports `run` (mutation) and `byId` (query).
 *
 * SSE path: POSTs `{ trace }` to `/api/triage`, consumes Server-Sent Events,
 * and accumulates a snapshot in local React state keyed by client-side
 * generated id.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** True when the matched memory's source was `triage_history` (reinforced) */
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

// ─── Convex hook attempt (lazy-loaded; tolerant of missing codegen) ──────────
//
// We can't statically import `convex/_generated/api` because it might not
// exist yet during the frontend build before backend codegen runs. Instead,
// we read `NEXT_PUBLIC_CONVEX_URL`; if set, we *try* to use Convex. If the
// codegen is missing at runtime the hook falls back to SSE without crashing.

function hasConvex(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

// ─── SSE-mode implementation ─────────────────────────────────────────────────

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
      next.similarIncidents = event.payload
        .incidents as SimilarIncident[];
      break;
    case "error":
      next.status = "error";
      next.error = (event.payload.message as string) ?? "unknown error";
      next.finishedAt = Date.now();
      break;
    case "end":
      // Server signals stream close. If we never saw a `status: done`, mark
      // as done now so the UI doesn't get stuck in `running`. (DA #2 finding.)
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

async function consumeSseStream(
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
    // SSE frames are separated by "\n\n"
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");
      // Each frame: lines like "event: foo" "data: {...}"
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
  // Stream closed without explicit done — mark complete if still running
  setStore((s) => {
    const prev = s.get(runId);
    if (!prev || prev.status === "done" || prev.status === "error") return s;
    const next = new Map(s);
    next.set(runId, { ...prev, status: "done", finishedAt: Date.now() });
    return next;
  });
}

export function useTriage(): UseTriageReturn {
  const mode: TriageMode = hasConvex() ? "convex" : "sse";

  // SSE-mode store. We keep it even in convex-mode (cheap, unused) so hook
  // ordering is stable across mode flips during dev.
  const [store, setStore] = useState<RunStore>(() => new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  // Reset isRunning when all in-flight runs settle.
  useEffect(() => {
    let anyRunning = false;
    for (const id of inFlightRef.current) {
      const snap = store.get(id);
      if (snap && (snap.status === "pending" || snap.status === "running")) {
        anyRunning = true;
        break;
      }
    }
    if (!anyRunning && isRunning) setIsRunning(false);
  }, [store, isRunning]);

  const run = useCallback(
    async ({ trace }: { trace: string }): Promise<string> => {
      setError(null);

      // INTEGRATION HOOK (Backend Engineer):
      // When `convex/_generated/api` exists and exports `api.triage.run` +
      // `api.triage.byId`, swap this hook to call the Convex mutation here:
      //
      //   import { useMutation, useQuery } from "convex/react";
      //   import { api } from "@/convex/_generated/api";
      //   const runMut = useMutation(api.triage.run);
      //   ...
      //
      // The mode is currently determined by `NEXT_PUBLIC_CONVEX_URL`; the
      // SSE path below is the working fallback that the SSE `/api/triage`
      // route powers. Both paths produce the SAME `TriageRunSnapshot` shape.
      void mode;

      const id = makeId();
      inFlightRef.current.add(id);
      setIsRunning(true);
      setStore((s) => {
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
          setStore((s) => {
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
        // Don't await; let the stream populate state in the background.
        consumeSseStream(res, id, setStore).catch((e: unknown) => {
          const message = e instanceof Error ? e.message : "stream error";
          setError(message);
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "fetch failed";
        setError(message);
        setStore((s) => {
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
    [mode]
  );

  const byId = useCallback(
    (id: string | null): TriageRunSnapshot | null => {
      if (!id) return null;
      return store.get(id) ?? null;
    },
    [store]
  );

  return { mode, isRunning, error, run, byId };
}
