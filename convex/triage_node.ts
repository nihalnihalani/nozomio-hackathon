"use node";
/**
 * Node-runtime Convex actions for the triage agent loop.
 *
 * Why "use node": this module imports `lib/agent/loop.ts`, which uses
 * `node:fs` (replay fixture I/O), `node:path`, and `node:crypto` (cite-or-die
 * verifier). Convex's default V8-isolate runtime cannot resolve `node:*`
 * modules, so the bundler hard-fails with "unresolved node:fs" unless this
 * file opts into the Node.js runtime via the `"use node"` directive.
 *
 * Convention: Convex requires that "use node" files contain ONLY actions
 * (no mutations, no queries). The hot-path mutations + queries live in
 * `convex/triage.ts`; this file calls them via `ctx.runMutation` /
 * `ctx.runAction` so the V8 isolate keeps owning the database writes.
 *
 * Invariant 3 (Hot/Cold split): the InsForge mirror happens here via
 * `fetch('/api/insforge-mirror')` — never by importing the InsForge SDK
 * client into Convex. The file-grep test in
 * `tests/invariants/hot_cold_split.test.ts` enforces that no file under
 * `convex/` imports `@/lib/insforge`.
 *
 * Invariant 1 (Cite-Or-Die): every citation streamed into the V8 mutation
 * carries the `verified` flag the tool produced.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { runAgent, type AgentEvent } from "../lib/agent/loop";

/**
 * Synchronous public action — runs the agent loop end-to-end and
 * returns when status is `done` or `error`. Useful for tests, scripts,
 * and the REST `/api/triage` route fallback. The frontend uses
 * `api.triage.start` + `useQuery`, NOT this, because it wants the live
 * trace.
 */
export const run = action({
  args: { orgId: v.string(), trace: v.string() },
  handler: async (ctx, args): Promise<{ triageRunId: Id<"triageRuns"> }> => {
    const triageRunId = (await ctx.runMutation(internal.triage.createRun, {
      orgId: args.orgId,
      inputTrace: args.trace,
    })) as Id<"triageRuns">;
    await ctx.runAction(internal.triage_node.runInternal, {
      triageRunId,
      orgId: args.orgId,
      trace: args.trace,
    });
    return { triageRunId };
  },
});

/**
 * Internal action invoked by `api.triage.start` via the scheduler. Runs
 * the agent loop from `lib/agent/loop.ts` and persists every event into
 * Convex tables via the V8 mutations in `convex/triage.ts`. Once done,
 * mirrors to InsForge (cold path) per Invariant 3.
 */
export const runInternal = internalAction({
  args: {
    triageRunId: v.id("triageRuns"),
    orgId: v.string(),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    // Track the citation_id mappings so the final result's
    // `citations: string[]` arrays reference real Convex ids.
    // Codex pass-3 follow-up: dedupe key is `${source}:${source_id}`, NOT
    // just source_id — otherwise a Slack memory_id that happens to look
    // like a `file:line` would collide with a code citation and one would
    // be laundered into the other.
    const citationKey = (c: { source: string; source_id: string }) =>
      `${c.source}:${c.source_id}`;
    const citationIdBySourceId = new Map<string, string>();
    // Collect every citation (deduped by source_id) for the InsForge
    // mirror payload. Codex BLOCK: `audit_log.payload.citations` was
    // always `[]` because we passed nothing through. Now we capture them
    // here as they stream and forward the array to the mirror route.
    const citationsForMirror: Array<{
      source: string;
      source_id: string;
      excerpt: string;
      verified: boolean;
    }> = [];

    const sink = async (event: AgentEvent) => {
      if (event.type === "status") {
        await ctx.runMutation(internal.triage.setStatus, {
          triageRunId: args.triageRunId,
          status: event.status,
        });
      } else if (event.type === "tool_call") {
        await ctx.runMutation(internal.tools.logToolCall, {
          triageRunId: args.triageRunId,
          tool: event.tool,
          input: event.input,
          output: event.output,
          latencyMs: event.latencyMs,
        });
      } else if (event.type === "citation") {
        // Dedupe by ${source}:${source_id} within this run (see citationKey
        // comment above for the rationale).
        const key = citationKey({
          source: event.citation.source,
          source_id: event.citation.source_id,
        });
        if (!citationIdBySourceId.has(key)) {
          const id = (await ctx.runMutation(internal.triage.insertCitation, {
            triageRunId: args.triageRunId,
            source: event.citation.source,
            sourceId: event.citation.source_id,
            excerpt: event.citation.excerpt,
            metadata: event.citation.metadata ?? {},
            verified: event.citation.verified,
          })) as Id<"citations">;
          citationIdBySourceId.set(key, id);
          // Mirror payload uses the wire shape (no Convex Id, no metadata)
          // since the audit_log row is org-scoped and self-contained.
          citationsForMirror.push({
            source: event.citation.source,
            source_id: event.citation.source_id,
            excerpt: event.citation.excerpt,
            verified: event.citation.verified,
          });
        }
      } else if (event.type === "result") {
        // Persist the final structured output. Map citations from the
        // result's source_id format back to Convex citation ids.
        const mapCitations = (
          cs: { source: string; source_id: string }[]
        ): string[] =>
          cs
            .map((c) =>
              citationIdBySourceId.get(citationKey(c))
            )
            .filter((id): id is string => Boolean(id));

        await ctx.runMutation(internal.triage.finalizeResult, {
          triageRunId: args.triageRunId,
          timeline: event.result.timeline,
          rootCause: {
            text: event.result.root_cause.text,
            citations: mapCitations(event.result.root_cause.citations),
          },
          suspectedFix: {
            file: event.result.suspected_fix.file,
            line: event.result.suspected_fix.line,
            diff: event.result.suspected_fix.diff,
            citations: mapCitations(event.result.suspected_fix.citations),
          },
          // Codex pass-3 BLOCK: forward the FULL SimilarIncident shape so
          // the Convex reactive UI can render the 🧠 reinforcement badge.
          // Previously this collapsed to `string[]` of memory ids and the
          // Convex hydration produced blank placeholder rows.
          similarIncidents: event.result.similar_incidents.map((s) => ({
            memory_id: s.memory_id,
            summary: s.summary,
            relevance: s.relevance,
            ...(s.fromTriageHistory !== undefined
              ? { fromTriageHistory: s.fromTriageHistory }
              : {}),
          })),
        });
      } else if (event.type === "error") {
        await ctx.runMutation(internal.triage.setStatus, {
          triageRunId: args.triageRunId,
          status: "error",
          errorMessage: event.message,
        });
      }
    };

    let result;
    try {
      result = await runAgent(
        {
          trace: args.trace,
          orgId: args.orgId,
          // Codex finding #3: probe the canonical `memoryEvents` log so
          // Trace B's gating decision is reliable across actions, instances,
          // and restarts (replaces the module-local Map in lib/agent/loop.ts).
          // Returning a boolean (or null on failure) lets the loop fall back
          // to its in-process Map when Convex isn't reachable.
          hasRecentTraceA: async (orgId, withinMs) => {
            try {
              return (await ctx.runQuery(
                internal.traceState.hasRecentTraceA,
                { orgId, withinMs }
              )) as boolean;
            } catch {
              return null;
            }
          },
        },
        sink
      );
    } catch (err) {
      await sink({ type: "error", message: (err as Error).message });
      return;
    }

    // Invariant 3: mirror to InsForge cold path via the route — NOT by
    // importing the SDK client directly. The route enforces the shared
    // mirror secret and is the single boundary where org-scoped RLS
    // headers get applied. Codex BLOCK: previously this called
    // `getInsForge().mirrorIncident({ ...no citations })` and the
    // audit_log payload was always `citations: []`.
    if (result) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
        "http://localhost:3000";
      const mirrorUrl = `${siteUrl}/api/insforge-mirror`;
      const mirrorSecret = process.env.INSFORGE_MIRROR_SECRET;
      try {
        const res = await fetch(mirrorUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(mirrorSecret ? { "x-mirror-secret": mirrorSecret } : {}),
          },
          body: JSON.stringify({
            orgId: args.orgId,
            triageRunId: args.triageRunId,
            trace: args.trace,
            rootCause: result.root_cause.text,
            citations: citationsForMirror,
            actor: `org:${args.orgId}`,
          }),
        });
        // Codex pass-3 finding: previously we only checked `res.ok` (the
        // HTTP status). The mirror route now returns the full result
        // envelope and uses 502 for genuine InsForge failures vs 200 for
        // success and silent-degrade. Parse the body either way so the
        // skip reason / error / id is observable in Convex logs.
        const mirrorBody = (await res.json().catch(() => null)) as
          | {
              ok: boolean;
              skipped?: string;
              incidentId?: string;
              auditId?: string;
              error?: string;
            }
          | null;
        if (!res.ok) {
          console.warn(
            `[triage] insforge mirror non-200: status=${res.status} body=${JSON.stringify(mirrorBody)}`
          );
        } else if (mirrorBody && mirrorBody.ok === false) {
          // Should not occur — the route returns 502 in this case — but
          // defend against future drift.
          console.warn(
            `[triage] insforge mirror returned 200 with ok=false: ${mirrorBody.error}`
          );
        } else if (mirrorBody?.skipped) {
          // Visibility for production-mode missing-config skips.
          console.warn(
            `[triage] insforge mirror skipped=${mirrorBody.skipped} (org=${args.orgId})`
          );
        }
      } catch (err) {
        // Mirror failures are non-fatal — the hot path keeps moving and
        // operators can backfill from Convex if needed.
        console.warn(
          `[triage] insforge mirror fetch threw: ${(err as Error).message}`
        );
      }

      // Invariant 2: reinforce matched memories so Trace B's recall is
      // biased toward them. Reinforcement lives in convex/reinforce_node.ts
      // — the only place that writes `triage_history` memories.
      try {
        await ctx.runAction(api.reinforce_node.reinforce, {
          triageRunId: args.triageRunId,
        });
      } catch (err) {
        console.warn("[triage] reinforcement step failed (non-fatal):", err);
      }
    }
  },
});
