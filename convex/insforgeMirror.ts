"use node";

/**
 * Convex action that mirrors an incident to InsForge.
 *
 * Phase 5 of convexplan.md — moves the InsForge mirror behind a
 * Convex-defined HTTP endpoint (see ./http.ts). The action wraps
 * lib/insforge/client.ts so the same mirror semantics apply: replay
 * mode no-ops, missing keys silently degrade, real failures surface
 * as `{ ok: false, error }`.
 *
 * Lives in `"use node"` because lib/insforge/client.ts (transitively
 * via lib/types.ts → getDemoMode) and the underlying fetch usage are
 * Node-runtime friendly. Using node here also matches the existing
 * Next.js route which sets `runtime = "nodejs"`.
 *
 * ADDITIVE: this does not replace app/api/insforge-mirror/route.ts;
 * both endpoints can coexist while callers migrate.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import {
  getInsForge,
  type MirrorIncidentResult,
} from "../lib/insforge/client";

export const mirrorIncident = action({
  args: {
    orgId: v.string(),
    triageRunId: v.string(),
    trace: v.string(),
    rootCause: v.optional(v.union(v.string(), v.null())),
    citations: v.optional(
      v.array(
        v.object({
          source: v.string(),
          source_id: v.string(),
          excerpt: v.string(),
          verified: v.boolean(),
        })
      )
    ),
    actor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (_ctx, args): Promise<MirrorIncidentResult> => {
    return await getInsForge().mirrorIncident({
      orgId: args.orgId,
      triageRunId: args.triageRunId,
      trace: args.trace,
      rootCause: args.rootCause ?? null,
      citations: args.citations,
      actor: args.actor ?? null,
    });
  },
});
