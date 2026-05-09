/**
 * InsForge client — COLD PATH.
 *
 * Invariant 3 (Hot/Cold split): this module is the ONLY way the mirror
 * route speaks to the durable customer-of-record store. The mirror is
 * one-way (Convex → InsForge); a reverse mirror would leak
 * multi-tenant data and is a hard reject in code review.
 *
 * IMPORTANT: Convex actions MUST NOT import this client directly —
 * they POST to `/api/insforge-mirror` instead. The route is the single
 * place that holds the InsForge SDK + the shared mirror secret + (in
 * production) the JWT-derived actor for org-scoped RLS. The
 * `tests/invariants/hot_cold_split.test.ts` grep enforces this.
 *
 * Modes:
 *   - DEMO_MODE=live   (production default): real call when keys are
 *                       set; loud `console.warn` + skip ('missing_config')
 *                       when keys are missing — first-deploy ergonomics.
 *   - DEMO_MODE=replay (opt-in for tests / hermetic dev): silent no-op.
 */

import { getDemoMode } from "@/lib/types";

export interface MirrorIncidentInput {
  orgId: string;
  triageRunId: string;
  trace: string;
  rootCause?: string | null;
  /**
   * Citation evidence to mirror into the audit_log. Per Codex finding #5,
   * the mirror writes BOTH the incident row AND a citations-bearing audit
   * event so SREs can query the trail across years (Invariant 3 cold path).
   */
  citations?: Array<{
    source: string;
    source_id: string;
    excerpt: string;
    verified: boolean;
  }>;
  /**
   * Caller identity for the audit_log.actor field. In production this is
   * the JWT subject; for the demo we accept a plain string.
   */
  actor?: string;
}

export interface MirrorIncidentResult {
  ok: boolean;
  incidentId?: string;
  auditId?: string;
  error?: string;
  skipped?: "replay" | "missing_config";
}

export class InsForgeClient {
  async mirrorIncident(
    input: MirrorIncidentInput
  ): Promise<MirrorIncidentResult> {
    const mode = getDemoMode();
    // Replay mode is the silent no-op path — used by hermetic tests and
    // offline dev. Production runs in `live` mode (the default).
    if (mode === "replay") {
      return { ok: true, skipped: "replay" };
    }
    const baseUrl = process.env.INSFORGE_BASE_URL;
    const anonKey = process.env.INSFORGE_ANON_KEY;
    if (!baseUrl || !anonKey) {
      // Production-ready posture: outside replay, a missing config is a
      // legitimate first-deploy state (the cold path hasn't been
      // provisioned yet). We degrade silently for the request — the hot
      // path keeps moving — but log loudly so it's visible in logs.
      console.warn(
        "[insforge] mirrorIncident skipped: missing_config (INSFORGE_BASE_URL or INSFORGE_ANON_KEY unset). " +
          `Drop org=${input.orgId} triageRunId=${input.triageRunId} citations=${
            (input.citations ?? []).length
          }`
      );
      return { ok: true, skipped: "missing_config" };
    }
    const headers = {
      "content-type": "application/json",
      // Anon key for the SDK-level auth; row-level security in
      // InsForge enforces org_id isolation per Invariant 3.
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    };
    try {
      // Step 1: insert the incident row.
      const incidentRes = await fetch(`${baseUrl}/api/v1/incidents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          org_id: input.orgId,
          triage_run_id: input.triageRunId,
          trace: input.trace,
          root_cause: input.rootCause ?? null,
        }),
      });
      if (!incidentRes.ok) {
        return {
          ok: false,
          error: `insforge incidents ${incidentRes.status}: ${await incidentRes.text()}`,
        };
      }
      const incidentJson = (await incidentRes.json().catch(() => ({}))) as {
        id?: string;
        incident_id?: string;
      };
      const incidentId = incidentJson.id ?? incidentJson.incident_id;

      // Step 2: write an audit_log event scoped to the same org. Per
      // Codex finding #5, the audit-grade story requires citations to
      // be persisted alongside the incident — without that, SREs can't
      // reconstruct the evidence chain across years.
      let auditId: string | undefined;
      try {
        const auditRes = await fetch(`${baseUrl}/api/v1/audit_log`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            org_id: input.orgId,
            incident_id: incidentId ?? null,
            action: "triage.completed",
            actor: input.actor ?? "triage-agent",
            payload: {
              triage_run_id: input.triageRunId,
              root_cause_summary: input.rootCause ?? null,
              citations: input.citations ?? [],
              citation_count: (input.citations ?? []).length,
              verified_citation_count: (input.citations ?? []).filter(
                (c) => c.verified
              ).length,
            },
          }),
        });
        if (auditRes.ok) {
          const auditJson = (await auditRes.json().catch(() => ({}))) as {
            id?: string;
          };
          auditId = auditJson.id;
        } else {
          // Audit failure is logged but does NOT fail the mirror — the
          // incident row already landed. Operators can backfill from
          // Convex if needed.
          console.warn(
            `[insforge] audit_log write failed ${auditRes.status}; incident ${incidentId} succeeded`
          );
        }
      } catch (auditErr) {
        console.warn(
          `[insforge] audit_log threw: ${(auditErr as Error).message}; incident ${incidentId} succeeded`
        );
      }

      return { ok: true, incidentId, auditId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

let _client: InsForgeClient | null = null;
export function getInsForge(): InsForgeClient {
  if (!_client) _client = new InsForgeClient();
  return _client;
}
