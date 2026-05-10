"use client";

import {
  BrainCircuit,
  Code2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { CitationPill } from "@/components/CitationPill";
import { cn, formatDuration } from "@/lib/utils";
import type { Citation } from "@/lib/types";
import {
  useSmoothText,
  type ToolCallSnapshot,
  type TriageRunSnapshot,
} from "@/lib/hooks/useTriage";

interface TraceUIProps {
  snapshot: TriageRunSnapshot | null;
  /** Click a citation pill to open the drawer */
  onCitationClick?: (citation: Citation) => void;
  /** Set of source_ids that are new in this run vs prior — pulses them */
  newSourceIds?: Set<string>;
  /** Optional title override. */
  label?: string;
}

const TOOL_DISPLAY: Record<
  ToolCallSnapshot["tool"],
  { name: string; verb: string }
> = {
  recallSimilarIncidents: {
    name: "recallSimilarIncidents",
    verb: "Recalling similar incidents from Slack, Notion, Gmail",
  },
  searchCode: {
    name: "searchCode",
    verb: "Searching the monorepo + ADRs + runbooks",
  },
};

function ToolCallCard({
  call,
  citations,
  onCitationClick,
  newSourceIds,
}: {
  call: ToolCallSnapshot;
  citations: Citation[];
  onCitationClick?: (citation: Citation) => void;
  newSourceIds?: Set<string>;
}) {
  const meta = TOOL_DISPLAY[call.tool];
  const isRunning = call.status === "running";
  const isError = call.status === "error";

  return (
    <Card className="border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
            isRunning &&
              "border-blue-500/40 bg-blue-500/10 text-blue-300",
            !isRunning &&
              !isError &&
              "border-green-500/40 bg-green-500/10 text-green-300",
            isError && "border-red-500/40 bg-red-500/10 text-red-300"
          )}
        >
          {isRunning ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : isError ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {call.tool === "searchCode" ? (
                <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <BrainCircuit className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-mono text-xs text-foreground">
                {meta.name}
              </span>
            </div>
            {call.latencyMs !== undefined && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatDuration(call.latencyMs)}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {isRunning
              ? `${meta.verb}…`
              : isError
              ? "Tool call failed"
              : `${
                  call.resultCount ?? citations.length
                } result${(call.resultCount ?? citations.length) === 1 ? "" : "s"}`}
          </p>

          {citations.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {citations.map((c, i) => (
                <CitationPill
                  key={`${c.source_id}-${i}`}
                  citation={c}
                  onClick={onCitationClick}
                  isNew={newSourceIds?.has(c.source_id) ?? false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Phase 2 — token-by-token "agent thinking" text via `useSmoothText`.
 *
 * The Convex path's `uiMessagesToTriageSnapshot` surfaces the most-recent
 * assistant message's `.text` as `snapshot.streamingText` (and sets
 * `isStreaming` while a UIMessage is mid-stream). `useSmoothText` paces
 * the visible characters so judges see the thought form word-by-word
 * rather than landing in one chunk. SSE-path snapshots leave both fields
   * undefined -> this component renders nothing, preserving the existing
   * tool-call-card-only UX for SSE fixture playback.
 */
function AgentThinkingText({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [visibleText] = useSmoothText(text, {
    startStreaming: streaming,
  });
  if (!visibleText) return null;
  return (
    <Card className="border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
            streaming
              ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
              : "border-green-500/40 bg-green-500/10 text-green-300"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            agent
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {visibleText}
            {streaming && (
              <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-foreground align-middle" />
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Degraded-or-error banner. Surfaces `snapshot.error` for any status:
 *   - `[degraded] …` prefix → yellow banner (the run still completed; this
 *     is an honesty signal, e.g. Invariant 2 reinforcement was not active).
 *   - any other error string → red banner (run failed).
 *
   * `convex/triageNode.ts` writes `errorMessage` on a `running` (then
   * `done`) status when no recent reinforcement exists; the `done` status
   * without surfacing this would silently drop the Invariant 2 honesty signal.
 */
function ErrorOrDegradedBanner({
  error,
  status,
}: {
  error: string;
  status: TriageRunSnapshot["status"];
}) {
  const isDegraded = error.startsWith("[degraded]");
  const isError = status === "error" && !isDegraded;
  return (
    <Card
      className={cn(
        "p-4 text-sm",
        isError
          ? "border-red-500/40 bg-red-500/5 text-red-300"
          : "border-yellow-500/40 bg-yellow-500/5 text-yellow-200"
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="font-mono whitespace-pre-wrap">{error}</span>
      </div>
    </Card>
  );
}

/**
 * Streaming "agent thinking" panel. Renders each tool call as a card and
 * groups citations under the call that produced them (best-effort by index;
 * if the backend doesn't tag citations with toolCallId, all citations show
 * under the most recent matching tool — non-load-bearing).
 *
 * INTEGRATION NOTE: this component reads from a snapshot produced by
 * `useTriage()` (Convex `useUIMessages` or SSE state). It does not call
 * hooks itself at the top level — keep render pure so we can mount it
   * twice for side-by-side incident comparison. (`AgentThinkingText` is conditionally mounted
 * but conditioned only on snapshot presence, so hook ordering is stable
 * per slot.)
 */
export function TraceUI({
  snapshot,
  onCitationClick,
  newSourceIds,
  label,
}: TraceUIProps) {
  if (!snapshot) {
    return null;
  }

  // Heuristic: split citations by source-type heuristic into the most
  // appropriate tool call. recallSimilarIncidents owns slack/notion/gmail;
  // searchCode owns code. If no tool calls yet, citations float to the
  // top-level area as a safety net.
  const recallCitations = snapshot.citations.filter(
    (c) => c.source !== "code"
  );
  const codeCitations = snapshot.citations.filter((c) => c.source === "code");

  const callBucket = (call: ToolCallSnapshot): Citation[] => {
    if (call.tool === "recallSimilarIncidents") return recallCitations;
    if (call.tool === "searchCode") return codeCitations;
    return [];
  };

  const isRunning =
    snapshot.status === "running" || snapshot.status === "pending";
  const isDone = snapshot.status === "done";

  return (
    <div className="flex flex-col gap-3">
      {(label || isRunning || isDone) && (
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Agent thinking
            {label && (
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal">
                {label}
              </span>
            )}
          </h3>
          {snapshot.finishedAt && snapshot.startedAt && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatDuration(snapshot.finishedAt - snapshot.startedAt)}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {snapshot.toolCalls.length === 0 &&
          !snapshot.streamingText &&
          isRunning && (
            <Card className="border-border/60 bg-card/40 p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Ingesting trace…
              </div>
            </Card>
          )}

        {snapshot.toolCalls.map((call) => (
          <ToolCallCard
            key={call.id}
            call={call}
            citations={callBucket(call)}
            onCitationClick={onCitationClick}
            newSourceIds={newSourceIds}
          />
        ))}

        {snapshot.streamingText && (
          <AgentThinkingText
            text={snapshot.streamingText}
            streaming={snapshot.isStreaming ?? false}
          />
        )}

        {snapshot.error && (
          <ErrorOrDegradedBanner
            error={snapshot.error}
            status={snapshot.status}
          />
        )}
      </div>
    </div>
  );
}
