"use client";

import { BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SimilarIncident } from "@/lib/hooks/useTriage";

function relevanceVariant(score: number): "default" | "secondary" | "outline" {
  if (score >= 0.8) return "default";
  if (score >= 0.5) return "secondary";
  return "outline";
}

export function SimilarIncidentsCard({
  incidents,
  className,
}: {
  incidents: SimilarIncident[] | undefined;
  className?: string;
}) {
  if (!incidents || incidents.length === 0) return null;

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <BrainCircuit className="h-3.5 w-3.5" />
          Similar Incidents
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <ul className="flex flex-col gap-2">
          {incidents.map((incident) => (
            <li
              key={incident.memory_id}
              className={cn(
                "flex items-start gap-3 rounded-md border border-border/60 bg-card/40 p-3",
                incident.fromTriageHistory &&
                  "border-fuchsia-500/40 bg-fuchsia-500/5"
              )}
            >
              {incident.fromTriageHistory && (
                <span
                  className="text-base leading-none"
                  role="img"
                  aria-label="Reinforced memory"
                  title="Memory reinforced from a prior triage"
                >
                  🧠
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{incident.summary}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                  {incident.memory_id}
                </p>
              </div>
              <Badge
                variant={relevanceVariant(incident.relevance)}
                className="shrink-0 font-mono"
              >
                {(incident.relevance * 100).toFixed(0)}%
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
