"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Live "Recent Triages" panel — subscribes to Convex via useQuery and
 * re-renders reactively as the /api/triage mirror writes new rows.
 *
 * Demonstrates Invariant 3 (hot-path Convex): paste a trace, watch the row
 * land in this panel within ~150ms with no page reload.
 *
 * Renders nothing if NEXT_PUBLIC_CONVEX_URL is unset or unreachable.
 *
 * Split into outer (env-gate) + inner (useQuery) because in CI the build
 * runs without NEXT_PUBLIC_CONVEX_URL set; `app/providers.tsx` then
 * renders no ConvexProvider, and any `useQuery` call in a child crashes
 * SSR prerender with "Could not find Convex client". Mounting the inner
 * conditionally keeps useQuery off the call stack when there's no
 * provider in the tree.
 */
export function ConvexLiveActivity({
  orgId = process.env.NEXT_PUBLIC_TRIAGE_ORG_ID?.trim(),
}: {
  orgId?: string;
}) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [reachable, setReachable] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    fetch(`${url.replace(/\/$/, "")}/version`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!cancelled) setReachable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setReachable(false);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [url]);

  if (!url || !orgId || !reachable) return null;
  return <ConvexLiveActivityInner orgId={orgId} />;
}

function ConvexLiveActivityInner({ orgId }: { orgId: string }) {
  const runs = useQuery(api.triage.recentRuns, { orgId, limit: 5 });

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
