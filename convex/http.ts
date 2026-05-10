/**
 * Convex HTTP routes.
 *
 * Phase 5 of convexplan.md — registers the InsForge mirror as a
 * Convex-hosted HTTP endpoint at `/insforge-mirror`. Convex serves
 * this on the deployment's `*.convex.site` host (NOT `*.convex.cloud`,
 * which is for the function API). For the `superb-wildcat-347`
 * deployment, the URL is:
 *
 *   https://superb-wildcat-347.convex.site/insforge-mirror
 *
 * Auth mirrors the existing Next.js route at app/api/insforge-mirror/
 * route.ts: a shared `INSFORGE_MIRROR_SECRET` env var gates the
 * endpoint via the `x-mirror-secret` header. When the secret is unset,
 * unauthenticated calls are accepted for local development, but live mode
 * still reports missing InsForge configuration as a mirror failure.
 *
 * Status codes:
 *   401 — missing/wrong x-mirror-secret (when secret is configured)
 *   400 — invalid JSON or schema validation failure
 *   200 — mirror succeeded, replay skipped, or hybrid skipped missing config
 *   502 — real InsForge call failed; body preserves the error envelope
 *
 * ADDITIVE: app/api/insforge-mirror/route.ts is intentionally left in
 * place. Both endpoints can run simultaneously while callers migrate.
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { z } from "zod";

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

function isAuthorized(req: Request): boolean {
  const secret = process.env.INSFORGE_MIRROR_SECRET;
  if (!secret) {
    // No secret configured -> local development. Production deployments
    // should set INSFORGE_MIRROR_SECRET because the endpoint is public.
    return true;
  }
  const provided =
    req.headers.get("x-mirror-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return provided === secret;
}

const mirrorPost = httpAction(async (ctx, req) => {
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ ok: false, error: "unauthorized" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid json" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: parsed.error.message }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const result = await ctx.runAction(api.insforgeMirror.mirrorIncident, {
    orgId: parsed.data.orgId,
    triageRunId: parsed.data.triageRunId,
    trace: parsed.data.trace,
    rootCause: parsed.data.rootCause ?? null,
    citations: parsed.data.citations,
    actor: parsed.data.actor ?? null,
  });

  // Match the Next.js route's status mapping: success and intentional skips
  // return 200 (skip reason in body), real failures return 502.
  const status = result.ok ? 200 : 502;
  if (!result.ok) {
    console.warn(
      `[convex/http insforge-mirror] mirrorIncident failed: ${result.error ?? "unknown"} (org=${parsed.data.orgId} triageRunId=${parsed.data.triageRunId})`
    );
  }
  return new Response(JSON.stringify(result), {
    status,
    headers: { "content-type": "application/json" },
  });
});

const http = httpRouter();

http.route({
  path: "/insforge-mirror",
  method: "POST",
  handler: mirrorPost,
});

export default http;
