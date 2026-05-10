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
   * and includes it in the `x-mirror-secret` header. When the secret is
   * unset, this route is open for local development; production deploys
   * should set the secret because live mode now reports missing InsForge
   * configuration as a failure.
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

  // Codex pass-3 finding: previously this returned 200 even when the
  // mirror returned `{ ok: false }`, so InsForge write failures were
  // invisible to the calling Convex action. Now we map the result to a
  // proper HTTP status: success / silent-degrade returns 200 (the hot
  // path keeps moving and the skip reason is in the body for
  // observability), but a real ok=false (real InsForge call failed)
  // returns 502 so the caller can log/alert. The body is preserved on
  // every path so callers can parse the result envelope.
  if (!result.ok) {
    console.warn(
      `[insforge-mirror] mirrorIncident failed: ${result.error ?? "unknown"} (org=${parsed.data.orgId} triageRunId=${parsed.data.triageRunId})`
    );
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "insforge-mirror",
    demoMode: getDemoMode(),
    hasInsForge:
      !!process.env.INSFORGE_BASE_URL &&
      !!(process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_ANON_KEY),
    secretGated: !!process.env.INSFORGE_MIRROR_SECRET,
  });
}
