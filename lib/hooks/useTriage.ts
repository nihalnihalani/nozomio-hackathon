"use client";

/**
 * useTriage — dual-mode hook abstracting Convex `useMutation`/`useQueries`
 * vs the `/api/triage` SSE fallback.
 *
 * Both modes expose the SAME interface so the UI doesn't branch:
 *   const { run, byId, isRunning, error, mode } = useTriage();
 *
 * - `run({ trace })`  → returns `triageRunId: string`
 * - `byId(id)`        → returns reactive `TriageRunSnapshot` (or null while loading)
 *
 * Convex path: Used when `NEXT_PUBLIC_CONVEX_URL` is set. Calls
 * `useMutation(api.triage.start)` to kick off a run, then
 * `useQueries({ ... api.triage.byId, args: { id } })` to live-stream the
 * snapshot from Convex tables (triageRuns + toolCalls + citations). The
 * raw shape is reshaped via `convexSnapshotToTriageSnapshot()` so UI
 * components consume the SAME `TriageRunSnapshot` regardless of mode.
 *
 * SSE path: POSTs `{ trace }` to `/api/triage`, consumes Server-Sent
 * Events, and accumulates a snapshot in local React state keyed by a
 * client-generated id. This is the no-keys default that lets the demo
 * work for judges who clone fresh — see Invariant 4 (Hermetic Demo Mode).
 *
 * Mode is decided at module-load time by `NEXT_PUBLIC_CONVEX_URL` (which
 * Next.js inlines at build time). The decision is therefore stable across
 * a given build, so calling `useMutation`/`useQueries` only inside the
 * Convex sub-hook does NOT violate the rules-of-hooks ordering invariant.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Citation, SourceType } from "@/lib/types";

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

// ─── Mode detection ──────────────────────────────────────────────────────────
//
// `NEXT_PUBLIC_CONVEX_URL` is inlined by Next.js at build time, so this is a
// build-time constant. That makes the hook ordering in `useTriage` stable
// across renders — we always invoke the same sub-hook for a given build.

function hasConvex(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

// In tests / non-demo orgs we may want to override this. For the demo path
// the orgId is fixed to match the API route default ("demo-org").
const DEMO_ORG_ID = "demo-org";

// ─── Convex → TriageRunSnapshot reshape ──────────────────────────────────────
//
// The Convex `byId` query returns `{ run, toolCalls, citations, memoryEvents }`
// (see convex/triage.ts). We need to flatten that into the same shape the SSE
// path produces so `TraceUI` / `ResultCards` don't fork.
//
// We isolate the (small amount of) `as any` shape-bridging here so the rest
// of the hook stays clean. Convex's typed api stub is `AnyApi`-based until
// `npx convex dev` codegens real types — meaning the result of useQueries is
// `unknown`/`any` at compile time, which we explicitly narrow below.

interface ConvexRunDoc {
  _id: string;
  orgId?: string;
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
  errorMessage?: string;
}

interface ConvexCitationDoc {
  _id: string;
  triageRunId: string;
  source: SourceType;
  sourceId: string;
  excerpt: string;
  metadata: Record<string, unknown> | null | undefined;
  verified: boolean;
}

interface ConvexToolCallDoc {
  _id: string;
  triageRunId: string;
  tool: "recallSimilarIncidents" | "searchCode";
  input: unknown;
  output: unknown;
  latencyMs: number;
  at: number;
}

interface ConvexByIdResult {
  run: ConvexRunDoc;
  toolCalls: ConvexToolCallDoc[];
  citations: ConvexCitationDoc[];
  // memoryEvents shape isn't needed for the snapshot.
  memoryEvents: unknown[];
}

function citationDocToCitation(c: ConvexCitationDoc): Citation {
  return {
    source: c.source,
    source_id: c.sourceId,
    excerpt: c.excerpt,
    metadata: (c.metadata as Record<string, unknown> | undefined) ?? undefined,
    verified: c.verified,
  };
}

function toolCallDocToSnapshot(t: ConvexToolCallDoc): ToolCallSnapshot {
  // Convex toolCalls are written AFTER the tool returns, so they're always
  // "done" by the time we observe them. The reactive query naturally picks
  // up the new row on insert — no separate "running" frame is needed.
  return {
    id: t._id,
    tool: t.tool,
    status: "done",
    input: t.input,
    output: t.output,
    resultCount: countResults(t.tool, t.output),
    latencyMs: t.latencyMs,
    at: t.at,
  };
}

function countResults(tool: ToolCallSnapshot["tool"], output: unknown): number | undefined {
  if (output == null || typeof output !== "object") return undefined;
  const o = output as Record<string, unknown>;
  if (tool === "recallSimilarIncidents" && Array.isArray(o.memories)) {
    return (o.memories as unknown[]).length;
  }
  if (tool === "searchCode" && Array.isArray(o.snippets)) {
    return (o.snippets as unknown[]).length;
  }
  return undefined;
}

/**
 * Reshape a `convex/triage.byId` reactive query result into the
 * `TriageRunSnapshot` the UI expects. ISOLATED `as any`-style narrowing
 * lives here so the rest of the codebase stays type-clean.
 */
function convexSnapshotToTriageSnapshot(
  raw: unknown
): TriageRunSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const result = raw as ConvexByIdResult;
  if (!result.run) return null;
  const run = result.run;

  // Citation lookup by Convex `_id` so rootCause/suspectedFix's citation-id
  // arrays can be hydrated to full Citation objects. The hot-path schema
  // stores the IDs (string[]); the UI wants full Citation[].
  const citationsById = new Map<string, Citation>();
  const citationsList: Citation[] = [];
  for (const c of result.citations ?? []) {
    const cit = citationDocToCitation(c);
    citationsById.set(c._id, cit);
    citationsList.push(cit);
  }

  const hydrateCitations = (ids: string[] | undefined): Citation[] => {
    if (!ids) return [];
    return ids
      .map((id) => citationsById.get(id))
      .filter((c): c is Citation => Boolean(c));
  };

  const rootCause: RootCause | undefined = run.rootCause
    ? {
        text: run.rootCause.text,
        citations: hydrateCitations(run.rootCause.citations),
      }
    : undefined;

  const suspectedFix: SuspectedFix | undefined = run.suspectedFix
    ? {
        file: run.suspectedFix.file,
        line: run.suspectedFix.line,
        diff: run.suspectedFix.diff,
        citations: hydrateCitations(run.suspectedFix.citations),
      }
    : undefined;

  // The hot-path schema stores `similarIncidents` as `string[]` (memory ids
  // referenced from a separate memory store). The full SimilarIncident
  // shape (summary, relevance, fromTriageHistory) is only available on the
  // `result` event, which the SSE path renders directly. For the Convex
  // reactive path we surface the ids with placeholder summaries so the
  // SimilarIncidentsCard renders SOMETHING; the agent's full output is also
  // persisted server-side and can be fetched via a separate query later.
  const similarIncidents: SimilarIncident[] | undefined = run.similarIncidents
    ? run.similarIncidents.map((memory_id) => ({
        memory_id,
        summary: "",
        relevance: 0,
      }))
    : undefined;

  return {
    id: run._id,
    status: run.status,
    inputTrace: run.inputTrace,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    toolCalls: (result.toolCalls ?? []).map(toolCallDocToSnapshot),
    citations: citationsList,
    timeline: run.timeline,
    rootCause,
    suspectedFix,
    similarIncidents,
    error: run.errorMessage,
  };
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

function useTriageSse(): UseTriageReturn {
  const [store, setStore] = useState<RunStore>(() => new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  // Reset isRunning when all in-flight runs settle, and garbage-collect
  // settled IDs from inFlightRef so it doesn't grow unbounded across a
  // long-lived session (Codex finding).
  useEffect(() => {
    let anyRunning = false;
    const settled: string[] = [];
    for (const id of inFlightRef.current) {
      const snap = store.get(id);
      if (snap && (snap.status === "pending" || snap.status === "running")) {
        anyRunning = true;
      } else if (snap && (snap.status === "done" || snap.status === "error")) {
        settled.push(id);
      }
    }
    for (const id of settled) inFlightRef.current.delete(id);
    if (!anyRunning && isRunning) setIsRunning(false);
  }, [store, isRunning]);

  const run = useCallback(
    async ({ trace }: { trace: string }): Promise<string> => {
      setError(null);

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
          body: JSON.stringify({ trace }),
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
    []
  );

  const byId = useCallback(
    (id: string | null): TriageRunSnapshot | null => {
      if (!id) return null;
      return store.get(id) ?? null;
    },
    [store]
  );

  return { mode: "sse", isRunning, error, run, byId };
}

// ─── Convex-mode implementation ──────────────────────────────────────────────

function useTriageConvex(): UseTriageReturn {
  // The set of runIds we want to subscribe to. Each `run()` call pushes a new
  // id; `useQueries` then reactively materializes a snapshot per id. We never
  // remove ids — the surrounding component owns at most 2 (Trace A and B),
  // and the upper bound on dev-session subscription growth is acceptable.
  const [subscribedIds, setSubscribedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Convex's typed api here is `AnyApi` until `npx convex dev` codegens
  // real types. The mutation+queries still wire correctly at runtime; the
  // type-bridge `as never` here is the single isolated "any-style" cast.
  // The runtime call uses the same FunctionReference shape codegen produces.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startMut = useMutation((api as any).triage.start);

  // Build the useQueries request map, one entry per subscribed id.
  const queryRequest = useMemo(() => {
    const req: Record<string, { query: unknown; args: { id: string } }> = {};
    for (const id of subscribedIds) {
      req[id] = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query: (api as any).triage.byId,
        args: { id },
      };
    }
    return req;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribedIds]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryResults = useQueries(queryRequest as any) as Record<string, unknown>;

  // Compute snapshots once per render and cache by id.
  const snapshotsById = useMemo(() => {
    const map = new Map<string, TriageRunSnapshot | null>();
    for (const id of subscribedIds) {
      const raw = queryResults[id];
      if (raw instanceof Error) {
        // useQueries returns Error if the query throws server-side. Surface
        // as an error snapshot rather than throwing — matches SSE behavior.
        map.set(id, {
          id,
          status: "error",
          inputTrace: "",
          startedAt: Date.now(),
          toolCalls: [],
          citations: [],
          error: raw.message,
        });
        continue;
      }
      map.set(id, convexSnapshotToTriageSnapshot(raw));
    }
    return map;
  }, [queryResults, subscribedIds]);

  // Derive isRunning from the union of subscribed snapshots.
  const isRunning = useMemo(() => {
    for (const snap of snapshotsById.values()) {
      if (!snap) continue;
      if (snap.status === "pending" || snap.status === "running") return true;
    }
    return false;
  }, [snapshotsById]);

  const run = useCallback(
    async ({ trace }: { trace: string }): Promise<string> => {
      setError(null);
      try {
        const newId = (await startMut({
          orgId: DEMO_ORG_ID,
          trace,
        })) as string;
        // Immediately subscribe so the UI sees the row materialize.
        setSubscribedIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
        return newId;
      } catch (e) {
        const message = e instanceof Error ? e.message : "convex mutation failed";
        setError(message);
        // Still return a synthetic id so the caller doesn't crash; it'll
        // show up as null in `byId` (no subscription) but `error` is set.
        throw e;
      }
    },
    [startMut]
  );

  const byId = useCallback(
    (id: string | null): TriageRunSnapshot | null => {
      if (!id) return null;
      return snapshotsById.get(id) ?? null;
    },
    [snapshotsById]
  );

  return { mode: "convex", isRunning, error, run, byId };
}

// ─── Public hook ─────────────────────────────────────────────────────────────
//
// `hasConvex()` is a build-time constant (Next.js inlines NEXT_PUBLIC_*),
// so the choice between the Convex and SSE sub-hook is stable for a given
// build. That keeps the hook ordering deterministic per React's rules even
// though we appear to "conditionally" pick a hook.

export function useTriage(): UseTriageReturn {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return hasConvex() ? useTriageConvex() : useTriageSse();
}
