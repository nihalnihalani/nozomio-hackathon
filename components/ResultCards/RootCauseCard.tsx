"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CitationPillRow } from "@/components/CitationPill";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/types";
import type { RootCause } from "@/lib/hooks/useTriage";

export function RootCauseCard({
  rootCause,
  newSourceIds,
  onCitationClick,
  className,
}: {
  rootCause: RootCause | undefined;
  newSourceIds?: Set<string>;
  onCitationClick?: (citation: Citation) => void;
  className?: string;
}) {
  if (!rootCause) return null;

  const hasNoCitations = rootCause.citations.length === 0;

  return (
    <Card
      className={cn(
        "border-border/60",
        hasNoCitations && "border-yellow-500/40 bg-yellow-500/5",
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          Root Cause
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <p className="text-lg font-medium leading-snug text-foreground">
          {rootCause.text}
        </p>
        <div className="mt-3">
          <CitationPillRow
            citations={rootCause.citations}
            newSourceIds={newSourceIds}
            onPillClick={onCitationClick}
          />
        </div>
      </CardContent>
    </Card>
  );
}
