"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DemoMode } from "@/lib/types";
import { useEffect, useState } from "react";

/**
 * Top-right status pill that surfaces the current DEMO_MODE.
 * `replay` is the demo-stage default; `live` is the dev/prod default.
 *
 * The mode is server-side (`process.env.DEMO_MODE`); we fetch it from
 * the `GET /api/triage` healthz endpoint on mount so the badge reflects
 * the actual server config, not a stale build-time `NEXT_PUBLIC_*` var.
 * The optional `mode` prop is a fallback for tests.
 */
export function DemoModeBadge({ mode }: { mode?: DemoMode }) {
  const [serverMode, setServerMode] = useState<DemoMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/triage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { demoMode?: DemoMode } | null) => {
        if (cancelled || !j?.demoMode) return;
        setServerMode(j.demoMode);
      })
      .catch(() => {
        // Silent — fall back to prop or "replay" default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Server truth > prop > replay default.
  const m: DemoMode = serverMode ?? mode ?? "replay";

  const styles: Record<DemoMode, string> = {
    live: "bg-green-600/20 text-green-300 border-green-600/40",
    replay: "bg-amber-600/20 text-amber-200 border-amber-600/40",
    hybrid: "bg-blue-600/20 text-blue-300 border-blue-600/40",
  };

  const label: Record<DemoMode, string> = {
    live: "LIVE",
    replay: "DEMO MODE: replay",
    hybrid: "HYBRID",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 px-2 font-mono text-[10px] tracking-wider uppercase",
        styles[m]
      )}
      aria-label={`demo mode: ${m}`}
    >
      <span className="relative mr-1.5 inline-flex h-1.5 w-1.5">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            m === "live" && "animate-ping bg-green-500",
            m === "replay" && "bg-amber-500",
            m === "hybrid" && "animate-ping bg-blue-500"
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            m === "live" && "bg-green-500",
            m === "replay" && "bg-amber-500",
            m === "hybrid" && "bg-blue-500"
          )}
        />
      </span>
      {label[m]}
    </Badge>
  );
}
