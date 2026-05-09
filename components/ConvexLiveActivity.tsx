"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Live "Recent Triages" panel — subscribes to Convex via useQuery and
 * re-renders reactively as the /api/triage mirror writes new rows.
 *
 * Demonstrates Invariant 3 (hot-path Convex) for judges: paste a trace,
 * watch the row land in this panel within ~150ms with no page reload.
 *
 * Renders nothing if NEXT_PUBLIC_CONVEX_URL is unset (replay-only deploys).
 */
export function ConvexLiveActivity({ orgId = "demo-org" }: { orgId?: string }) {
  const enabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  // useQuery still must be called unconditionally to satisfy hook rules,
  // but the no-op ConvexProvider in app/providers.tsx makes the hook
  // return undefined when disabled — handled below.
  const runs = useQuery(
    api.triage.recentRuns,
    enabled ? { orgId, limit: 5 } : "skip"
  );

  if (!enabled) return null;

  return (
    <section className="border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Convex live activity
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          useQuery(api.triage.recentRuns)
        </span>
      </div>

      {runs === undefined ? (
        <p className="text-xs text-muted-foreground">connecting…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          no runs yet — paste a trace to mirror one to Convex
        </p>
      ) : (
        <ul className="space-y-1">
          {runs.map((r) => (
            <li
              key={r._id}
              className="flex items-center justify-between gap-3 rounded border border-border bg-card px-2 py-1 font-mono text-[11px]"
            >
              <span
                className={
                  r.status === "done"
                    ? "text-green-300"
                    : r.status === "error"
                      ? "text-red-300"
                      : r.status === "running"
                        ? "text-blue-300"
                        : "text-muted-foreground"
                }
              >
                {r.status}
              </span>
              <span className="flex-1 truncate text-foreground/80">
                {r.inputTrace.split("\n")[0].slice(0, 80)}
              </span>
              <span className="text-muted-foreground">
                {r.finishedAt
                  ? `${r.finishedAt - r.startedAt}ms`
                  : `${Date.now() - r.startedAt}ms`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
