/**
 * InsForge client — COLD PATH.
 *
 * Invariant 3 (Hot/Cold split): this module is the ONLY way Convex
 * speaks to the durable customer-of-record store. The mirror is
 * one-way (Convex → InsForge); a reverse mirror would leak
 * multi-tenant data and is a hard reject in code review.
 *
 * Invariant 4 (Hermetic Demo Mode): in replay or no-keys, mirror
 * becomes a no-op so the demo never fails because InsForge isn't
 * provisioned. The Convex action fires-and-forgets this regardless.
 */

import { getDemoMode } from "@/lib/types";

export interface MirrorIncidentInput {
  orgId: string;
  triageRunId: string;
  trace: string;
  rootCause?: string | null;
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
    if (getDemoMode() === "replay") {
      return { ok: true, skipped: "replay" };
    }
    const baseUrl = process.env.INSFORGE_BASE_URL;
    const anonKey = process.env.INSFORGE_ANON_KEY;
    if (!baseUrl || !anonKey) {
      // Invariant 4: silently degrade rather than throw on the demo path.
      return { ok: true, skipped: "missing_config" };
    }
    try {
      const res = await fetch(`${baseUrl}/api/v1/incidents`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Anon key for the SDK-level auth; row-level security in
          // InsForge enforces org_id isolation per Invariant 3.
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          org_id: input.orgId,
          triage_run_id: input.triageRunId,
          trace: input.trace,
          root_cause: input.rootCause ?? null,
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
