/**
 * InsForge mirror route — the cold-path boundary.
 *
 * Convex actions POST here after a triage completes. This route writes
 * BOTH the incident row AND a citations-bearing audit_log event into
 * InsForge with org-scoped auth. Per Codex finding #5, the audit-grade
 * story requires citations to live alongside incidents so SREs can
 * reconstruct the evidence chain across years.
 *
 * Invariant 3 (Hot/Cold split): this is the ONE-WAY mirror. Reverse
 * mirror (InsForge → Convex) does not exist and would be rejected in
 * code review.
 *
 * Auth: a shared internal-mirror secret (`INSFORGE_MIRROR_SECRET` env)
 * gates this route from the public internet. Convex sets the same env
 * and includes it in the `x-mirror-secret` header. In replay mode or
 * when the secret is unset (dev), the route accepts unauthenticated
 * calls but only mirrors when DEMO_MODE !== replay AND InsForge keys
 * are present.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInsForge } from "@/lib/insforge/client";
import { getDemoMode } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  orgId: z.string().min(1),
  triageRunId: z.string().min(1),
  trace: z.string().min(1),
  rootCause: z.string().optional().nullable(),
  citations: z
    .array(
      z.object({
        source: z.string(),
        source_id: z.string(),
        excerpt: z.string(),
        verified: z.boolean(),
      })
    )
    .optional(),
  actor: z.string().optional(),
});

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INSFORGE_MIRROR_SECRET;
  if (!secret) {
    // No secret configured → dev/replay mode → accept (the InsForge client
    // will short-circuit if InsForge keys are missing, so no data leaks).
    return true;
  }
  const provided =
    req.headers.get("x-mirror-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return provided === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.message },
      { status: 400 }
    );
  }

  const result = await getInsForge().mirrorIncident({
    orgId: parsed.data.orgId,
    triageRunId: parsed.data.triageRunId,
    trace: parsed.data.trace,
    rootCause: parsed.data.rootCause ?? null,
    citations: parsed.data.citations,
    actor: parsed.data.actor,
  });

  // Always 200 with the result envelope — failures are non-fatal for
  // the calling Convex action (the hot path keeps moving).
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "insforge-mirror",
    demoMode: getDemoMode(),
    hasInsForge:
      !!process.env.INSFORGE_BASE_URL && !!process.env.INSFORGE_ANON_KEY,
    secretGated: !!process.env.INSFORGE_MIRROR_SECRET,
  });
}
