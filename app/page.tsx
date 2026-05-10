"use client";

import { useCallback, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArchitectureSlide } from "@/components/ArchitectureSlide";
import { CitationDrawer } from "@/components/CitationDrawer";
import { ConvexLiveActivity } from "@/components/ConvexLiveActivity";
import { DemoModeBadge } from "@/components/DemoModeBadge";
import { PasteTraceInput } from "@/components/PasteTraceInput";
import { TraceUI } from "@/components/TraceUI";
import { TimelineCard } from "@/components/ResultCards/TimelineCard";
import { RootCauseCard } from "@/components/ResultCards/RootCauseCard";
import { SuspectedFixCard } from "@/components/ResultCards/SuspectedFixCard";
import { SimilarIncidentsCard } from "@/components/ResultCards/SimilarIncidentsCard";
import { useTriage } from "@/lib/hooks/useTriage";
import type { Citation } from "@/lib/types";
import type { TriageRunSnapshot } from "@/lib/hooks/useTriage";
import { cn } from "@/lib/utils";

function collectAllCitations(snap: TriageRunSnapshot | null): Citation[] {
  if (!snap) return [];
  const seen = new Set<string>();
  const out: Citation[] = [];
  const push = (c: Citation) => {
    const key = `${c.source}:${c.source_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  snap.citations.forEach(push);
  snap.rootCause?.citations.forEach(push);
  snap.suspectedFix?.citations.forEach(push);
  return out;
}

function ResultCards({
  snap,
  newSourceIds,
  onCitationClick,
}: {
  snap: TriageRunSnapshot | null;
  newSourceIds?: Set<string>;
  onCitationClick: (c: Citation) => void;
}) {
  if (!snap || snap.status !== "done") return null;
  return (
    <div className="flex flex-col gap-3">
      <RootCauseCard
        rootCause={snap.rootCause}
        newSourceIds={newSourceIds}
        onCitationClick={onCitationClick}
      />
      <SuspectedFixCard
        fix={snap.suspectedFix}
        newSourceIds={newSourceIds}
        onCitationClick={onCitationClick}
      />
      <TimelineCard timeline={snap.timeline} />
      <SimilarIncidentsCard incidents={snap.similarIncidents} />
    </div>
  );
}

function TriagePanel({
  snap,
  newSourceIds,
  onCitationClick,
  label,
}: {
  snap: TriageRunSnapshot | null;
  newSourceIds?: Set<string>;
  onCitationClick: (c: Citation) => void;
  label?: string;
}) {
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <TraceUI
        snapshot={snap}
        onCitationClick={onCitationClick}
        newSourceIds={newSourceIds}
        label={label}
      />
      <ResultCards
        snap={snap}
        newSourceIds={newSourceIds}
        onCitationClick={onCitationClick}
      />
    </div>
  );
}

export default function HomePage() {
  const triage = useTriage();

  // Track up to two incident runs. They render side-by-side on wide screens,
  // stacked on mobile, so operators can compare a follow-up alert with the
  // first incident without relying on built-in sample data.
  const [runAId, setRunAId] = useState<string | null>(null);
  const [runBId, setRunBId] = useState<string | null>(null);

  const [drawerCitation, setDrawerCitation] = useState<Citation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);

  const snapA = triage.byId(runAId);
  const snapB = triage.byId(runBId);

  // Compute the set of source_ids that appear in the follow-up but not in the
  // initial run. These get the "NEW" pulse and make reinforcement visible.
  const newSourceIdsInB = useMemo<Set<string>>(() => {
    if (!snapA || !snapB) return new Set();
    const aIds = new Set(
      collectAllCitations(snapA).map((c) => c.source_id)
    );
    const bIds = collectAllCitations(snapB).map((c) => c.source_id);
    return new Set(bIds.filter((id) => !aIds.has(id)));
  }, [snapA, snapB]);

  const openDrawer = useCallback((c: Citation) => {
    setDrawerCitation(c);
    setDrawerOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async ({ trace }: { trace: string }) => {
      // Routing rules:
      //   1. No initial run yet → submit as initial incident
      //   2. Initial run is running → ignore (button disabled, but defensive)
      //   3. Initial run is done, follow-up not started → submit as follow-up.
      //      Refuse if the trace is identical so citation-diff highlighting
      //      does not report a false "new source" state.
      //   4. Both populated → reset and treat as a new initial incident
      if (!runAId) {
        setRunBId(null);
        const id = await triage.run({ trace });
        setRunAId(id);
        return;
      }
      if (snapA?.status === "running" || snapA?.status === "pending") {
        return;
      }
      if (snapA?.status === "done" && !runBId) {
        if (trace.trim() === (snapA?.inputTrace ?? "").trim()) {
          setRunBId(null);
          const id = await triage.run({ trace });
          setRunAId(id);
          return;
        }
        const id = await triage.run({ trace });
        setRunBId(id);
        return;
      }
      // Both populated → start over
      setRunBId(null);
      const id = await triage.run({ trace });
      setRunAId(id);
    },
    [runAId, runBId, snapA, triage]
  );

  const handleReset = useCallback(() => {
    setRunAId(null);
    setRunBId(null);
    setDrawerCitation(null);
    setDrawerOpen(false);
  }, []);

  const isAnyRunning =
    snapA?.status === "running" ||
    snapA?.status === "pending" ||
    snapB?.status === "running" ||
    snapB?.status === "pending";

  const hasAnyResult = !!snapA;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Triage</h1>
              <p className="text-xs text-muted-foreground">
                Incident triage in 4 seconds — every claim cited.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DemoModeBadge />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setArchOpen(true)}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Architecture
            </Button>
            {hasAnyResult && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isAnyRunning}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>
        </header>

        {/* ─── Input ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <PasteTraceInput
            onSubmit={handleSubmit}
            disabled={isAnyRunning}
          />
        </section>

        {/* ─── Output: A (and B if present) ──────────────────────────── */}
        {hasAnyResult && (
          <section
            className={cn(
              "grid gap-6",
              snapB ? "lg:grid-cols-2" : "grid-cols-1"
            )}
          >
            <div className="flex flex-col gap-4">
              <SectionHeader label="Incident 1" status={snapA?.status} />
              <TriagePanel
                snap={snapA}
                onCitationClick={openDrawer}
                label={undefined}
              />
            </div>
            {snapB && (
              <div className="flex flex-col gap-4">
                <SectionHeader
                  label="Follow-up Incident"
                  status={snapB.status}
                  highlight
                />
                <TriagePanel
                  snap={snapB}
                  newSourceIds={newSourceIdsInB}
                  onCitationClick={openDrawer}
                  label={undefined}
                />
              </div>
            )}
          </section>
        )}

        <ConvexLiveActivity />
      </div>

      <CitationDrawer
        citation={drawerCitation}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      <ArchitectureSlide open={archOpen} onOpenChange={setArchOpen} />
    </main>
  );
}

function SectionHeader({
  label,
  status,
  highlight = false,
}: {
  label: string;
  status: TriageRunSnapshot["status"] | undefined;
  highlight?: boolean;
}) {
  const statusLabel: Record<NonNullable<typeof status>, string> = {
    pending: "queued",
    running: "running",
    done: "done",
    error: "error",
  };
  const statusColor: Record<NonNullable<typeof status>, string> = {
    pending: "text-muted-foreground",
    running: "text-blue-300",
    done: "text-green-300",
    error: "text-red-300",
  };
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border pb-2",
        highlight && "border-fuchsia-500/40"
      )}
    >
      <h2
        className={cn(
          "text-sm font-semibold uppercase tracking-wider",
          highlight ? "text-fuchsia-200" : "text-foreground"
        )}
      >
        {label}
      </h2>
      {status && (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider",
            statusColor[status]
          )}
        >
          {statusLabel[status]}
        </span>
      )}
    </div>
  );
}
