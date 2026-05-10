"use client";

import { AlertTriangle, Code2, Mail, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Citation, SourceType } from "@/lib/types";

interface CitationPillProps {
  citation: Citation;
  onClick?: (citation: Citation) => void;
  /** Render with a brief "NEW" pulse for newly surfaced citations. */
  isNew?: boolean;
  className?: string;
}

const SOURCE_STYLES: Record<SourceType, string> = {
  slack:
    "bg-blue-500/10 border-blue-500/40 text-blue-300 hover:bg-blue-500/20",
  notion:
    "bg-zinc-500/10 border-zinc-500/40 text-zinc-300 hover:bg-zinc-500/20",
  gmail: "bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20",
  google_drive:
    "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20",
  code:
    "bg-green-500/10 border-green-500/40 text-green-300 hover:bg-green-500/20",
};

function SourceIcon({ source }: { source: SourceType }) {
  const cls = "h-3 w-3 shrink-0";
  switch (source) {
    case "slack":
      return <MessageSquare className={cls} />;
    case "notion":
      return <FileText className={cls} />;
    case "gmail":
      return <Mail className={cls} />;
    case "google_drive":
      return <FileText className={cls} />;
    case "code":
      return <Code2 className={cls} />;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function CitationPill({
  citation,
  onClick,
  isNew = false,
  className,
}: CitationPillProps) {
  const display = truncate(citation.source_id, 24);
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      title={
        citation.verified
          ? citation.source_id
          : `${citation.source_id} (unverified)`
      }
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        SOURCE_STYLES[citation.source],
        !citation.verified &&
          "ring-1 ring-yellow-500/60 ring-offset-1 ring-offset-background",
        isNew && "animate-pulse ring-2 ring-fuchsia-500/70",
        className
      )}
      aria-label={`Open ${citation.source} citation: ${citation.source_id}`}
    >
      <SourceIcon source={citation.source} />
      <span className="font-mono">{display}</span>
      {!citation.verified && (
        <AlertTriangle
          className="h-3 w-3 text-yellow-400"
          aria-label="unverified"
        />
      )}
      {isNew && (
        <span className="ml-0.5 rounded bg-fuchsia-500/30 px-1 text-[9px] font-bold uppercase tracking-wider text-fuchsia-200">
          new
        </span>
      )}
    </button>
  );
}

/**
 * Renders a row of citation pills. If the array is empty, surfaces an
 * `[uncited claim]` warning per Invariant 1 — uncited claims must be visually
 * distinct, never silently rendered as "verified".
 */
export function CitationPillRow({
  citations,
  newSourceIds,
  onPillClick,
  className,
}: {
  citations: Citation[];
  /** Set of source_ids that are new in this run (vs prior); pulses them */
  newSourceIds?: Set<string>;
  onPillClick?: (citation: Citation) => void;
  className?: string;
}) {
  if (citations.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-yellow-500/40 bg-yellow-500/5 px-2 py-0.5 text-xs text-yellow-300",
          className
        )}
        role="alert"
      >
        <AlertTriangle className="h-3 w-3" />
        <span className="font-mono">[uncited claim]</span>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {citations.map((c, i) => (
        <CitationPill
          key={`${c.source}-${c.source_id}-${i}`}
          citation={c}
          onClick={onPillClick}
          isNew={newSourceIds?.has(c.source_id) ?? false}
        />
      ))}
    </div>
  );
}
