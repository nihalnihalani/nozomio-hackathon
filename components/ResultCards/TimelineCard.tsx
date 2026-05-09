"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimelineEntry } from "@/lib/hooks/useTriage";

export function TimelineCard({
  timeline,
  className,
}: {
  timeline: TimelineEntry[] | undefined;
  className?: string;
}) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <ol className="relative ml-1 border-l border-border/60 pl-5">
          {timeline.map((entry, i) => (
            <li key={i} className="mb-3 last:mb-0">
              <span className="absolute -left-1.5 mt-1 inline-block h-3 w-3 rounded-full border border-border bg-background" />
              <time className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {entry.at}
              </time>
              <p className="mt-0.5 text-sm leading-relaxed">{entry.event}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
