/**
 * InsForge client — COLD PATH.
 *
 * Invariant 3 (Hot/Cold split): this module is the ONLY way Convex
 * speaks to the durable customer-of-record store. The mirror is
 * one-way (Convex → InsForge); a reverse mirror would leak
 * multi-tenant data and is a hard reject in code review.
 *
 * Invariant 4 (Hermetic Demo Mode): replay mode is an explicit no-op.
 * Production live mode fails closed when InsForge is not configured so
 * cold-path write failures are visible instead of silently disappearing.
 */

import { getDemoMode } from "@/lib/types";

export interface MirrorIncidentInput {
  orgId: string;
  triageRunId: string;
  trace: string;
  rootCause?: string | null;
  // Codex pass-3: citations land in audit_log.payload.citations alongside
  // the incident row. Optional here; the mirror route is the caller that
  // populates it. The on-the-wire body field is `citations` in the JSON
  // POST below.
  citations?: unknown[];
  // Optional actor identifier for audit_log.actor (per-org user/agent id).
  actor?: string | null;
}

export interface MirrorIncidentResult {
  ok: boolean;
  incidentId?: string;
  error?: string;
  skipped?: "replay" | "missing_config";
}

export class InsForgeClient {
  async mirrorIncident(
    input: MirrorIncidentInput
  ): Promise<MirrorIncidentResult> {
    const mode = getDemoMode();
    if (mode === "replay") {
      return { ok: true, skipped: "replay" };
    }
    const baseUrl = process.env.INSFORGE_BASE_URL;
    const apiKey =
      process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_ANON_KEY;
    if (!baseUrl || !apiKey) {
      if (mode === "hybrid") {
        return { ok: true, skipped: "missing_config" };
      }
      return {
        ok: false,
        error:
          "INSFORGE_BASE_URL and INSFORGE_SERVICE_ROLE_KEY or INSFORGE_ANON_KEY are required in live mode.",
      };
    }
    try {
      const res = await fetch(`${baseUrl}/api/v1/incidents`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: apiKey,
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          org_id: input.orgId,
          triage_run_id: input.triageRunId,
          trace: input.trace,
          root_cause: input.rootCause ?? null,
          citations: input.citations ?? [],
          actor: input.actor ?? null,
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `insforge ${res.status}: ${await res.text()}`,
        };
      }
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        incident_id?: string;
      };
      return { ok: true, incidentId: json.id ?? json.incident_id };
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
