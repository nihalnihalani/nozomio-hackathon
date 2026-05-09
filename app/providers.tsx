"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from "react";

/**
 * Always wraps the tree with a `ConvexProvider`, even when
 * `NEXT_PUBLIC_CONVEX_URL` is unset (e.g. CI builds without secrets).
 *
 * Why always: any `useQuery` hook in a child needs a provider in the
 * tree at React-tree construction time, even when the hook is invoked
 * with the `"skip"` argument. Without a provider, SSR prerender crashes
 * with "Could not find Convex client" — exactly what was breaking CI
 * after we shipped useTriage's reactive Convex path.
 *
 * The placeholder URL never actually opens a socket: every `useQuery`
 * in this app either passes "skip" until a real run id is in state
 * (`useTriage`) or short-circuits via the env-check wrapper
 * (`ConvexLiveActivity`). When `NEXT_PUBLIC_CONVEX_URL` IS set (Vercel,
 * local dev with .env), the real client is used.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    const url =
      process.env.NEXT_PUBLIC_CONVEX_URL ??
      "https://placeholder.convex.cloud";
    return new ConvexReactClient(url);
  }, []);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
