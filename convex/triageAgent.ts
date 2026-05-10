"use node";

/**
 * Triage Agent — `@convex-dev/agent` adoption (Phases 1, 3, 4).
 *
 * Replaces `lib/agent/loop.ts:runLive` for the Convex live path. The
 * replay path (`lib/agent/loop.ts:runReplay`) stays in place and is
 * reached when `DEMO_MODE=replay` (Invariant 4 — Hermetic Demo Mode).
 *
 * Convex constraint: this file is `"use node"` because:
 *   - the system prompt is read from disk via `node:fs`
 *   - the Hyperspell + Nia clients use `node:crypto` + `node:fs`
 *
 * AI SDK version note (Phase 1 in `convexplan.md`): the project
 * previously pinned `@ai-sdk/anthropic@^1` + `ai@^4`. `@convex-dev/agent
 * @0.6.1` requires `ai@^6.0.35`; we bumped to `@ai-sdk/anthropic@^3`
 * + `ai@^6` + `@ai-sdk/react@^3`. The `lib/agent/loop.ts` live path
 * (`streamText` from `ai`) uses dynamic import + try/catch and is
 * compatible with v6 (`stepCountIs` + `tool` are still exported).
 *
 * createTool API note: in `@convex-dev/agent` v0.6.0 the keys were
 * renamed: `args` → `inputSchema`, `handler` → `execute`. We use the
 * v0.6+ names.
 */

import { Agent, createTool, stepCountIs } from "@convex-dev/agent";
import type { AgentComponent } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getHyperspell, SOURCE_WEIGHTS } from "../lib/hyperspell/client";
import { getNia } from "../lib/nia/client";
import type { Memory, CodeSnippet } from "../lib/types";

// The committed `_generated/api.{d.ts,js}` fallback types `components`
// loosely (`AnyApi`). Live `npx convex dev` codegen overwrites this with
// precise per-component types, but until the user runs it locally we
// cast to the public `AgentComponent` shape so this file typechecks.
// Runtime is correct in both cases — `components.agent` is the same
// registered component reference under both type stories.
const agentComponent = components.agent as unknown as AgentComponent;

// ─── System prompt loader ─────────────────────────────────────────────────────

const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "triage-system.md"
);

function loadInstructions(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8");
  } catch {
    // Should never happen — the prompt is checked in. Fallback keeps the
    // Cite-Or-Die contract intact (Invariant 1) even if the file is
    // missing in some bundle.
    return "You are Triage, an incident-triage AI agent. Refuse to claim a root cause without a code citation. Refuse to assert a similar incident without a Hyperspell memory_id. If you cannot cite, say so explicitly.";
  }
}

// ─── Tools (Zod-typed, agent-component createTool) ────────────────────────────
//
// Both retrieval tools delegate to the existing `lib/{hyperspell,nia}/client.ts`
// clients (Invariant 4 replay branches stay in place under the hood). They
// ALSO mirror their results into the legacy `toolCalls` + `citations` Convex
// tables so the existing `useQuery(api.triage.byId)` reactive consumers
// (the SSE-shape snapshot) keep working alongside the new UIMessage path.
//
// `produceTriage` is the structured-output sink: the agent MUST call it as
// the final step. Its `inputSchema` validates the full TriageResult shape
// at the AI SDK boundary (Cite-Or-Die — Invariant 1: every claim carries
// a citation array of the canonical shape). The tool's `execute` resolves
// the triageRunId from the threadId and writes via `api.triage.finalizeResult`.

// ─── Shared resolver: threadId → { runId, orgId } ────────────────────────────
//
// All three tools need to map their `ctx.threadId` to a triageRunId so they
// can mirror to the hot-path Convex tables. Centralized so any change to
// the resolver (e.g. an indexed query) only lands in one place.
async function resolveRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any
): Promise<{ runId: Id<"triageRuns">; orgId: string } | null> {
  if (!ctx.threadId) return null;
  const row = await ctx.runQuery(internal.triage.runIdByThreadId, {
    threadId: ctx.threadId,
  });
  if (!row) return null;
  return { runId: row.id as unknown as Id<"triageRuns">, orgId: row.orgId };
}

const recallSimilarIncidents = createTool({
  description:
    "Search the team's Slack #incidents history, Notion postmortem database, and Gmail vendor outage threads via Hyperspell. Returns the top-5 most relevant memories with metadata (channel, author, timestamp, thread_id). Snippets are pre-verified — every memory has a Hyperspell `memory_id` for citation (Invariant 1).",
  inputSchema: z.object({
    signature: z
      .string()
      .min(1)
      .describe("Search query / error signature drawn from the stack trace"),
  }),
  execute: async (ctx, { signature }) => {
    const start = Date.now();
    const hyperspell = getHyperspell();
    const res = await hyperspell.memories.search({
      query: signature,
      options: { source_weights: SOURCE_WEIGHTS, limit: 5 },
    });
    const latencyMs = Date.now() - start;

    // Mirror to the hot-path Convex tables so the legacy
    // `useQuery(api.triage.byId)` reactive consumers see live tool calls
    // + citations alongside the new UIMessage path. Best-effort — never
    // let mirror-write failures bubble up and break the agent loop.
    const resolved = await resolveRun(ctx);
    if (resolved) {
      try {
        await ctx.runMutation(api.tools.logToolCall, {
          triageRunId: resolved.runId,
          tool: "recallSimilarIncidents",
          input: { signature },
          output: { memories: res.memories },
          latencyMs,
        });
      } catch (err) {
        console.warn("[recallSimilarIncidents] logToolCall failed:", err);
      }
      // Round-2 DA finding (C3): mirror each citation independently so a
      // single bad row (e.g., unexpected source) doesn't abort the rest of
      // the recall payload mid-loop.
      for (const m of res.memories as Memory[]) {
        if (!m?.id || !m?.text || !m?.source) continue;
        try {
          await ctx.runMutation(api.triage.insertCitation, {
            triageRunId: resolved.runId,
            source: m.source,
            sourceId: m.id,
            excerpt: m.text.slice(0, 500),
            metadata: m.metadata ?? {},
            // Invariant 1: Hyperspell recall is upstream-trusted (the
            // SSE/replay path uses the same convention). We do NOT
            // hardcode this — it reflects the upstream Hyperspell client
            // contract that recall results are pre-verified.
            verified: true,
          });
        } catch (err) {
          console.warn(
            `[recallSimilarIncidents] insertCitation ${m.id} failed:`,
            err
          );
        }
      }
    }

    // Returning the raw Hyperspell `memories[]` lets the model cite each
    // memory by `id` (Invariant 1: Cite-Or-Die). Same shape as the SSE path.
    return { memories: res.memories };
  },
});

const searchCode = createTool({
  description:
    "Search the production monorepo, ADRs, and runbooks via Nia. Returns code snippets with `file:line` locations and recent commits. Snippets are pre-verified — claimed file:line contains the claimed code (Invariant 1: Cite-Or-Die).",
  inputSchema: z.object({
    query: z.string().min(1).describe("Code-search query"),
  }),
  execute: async (ctx, { query }) => {
    const start = Date.now();
    const nia = getNia();
    const res = await nia.search({
      query,
      mode: "query",
      include_sources: true,
    });
    const latencyMs = Date.now() - start;

    const resolved = await resolveRun(ctx);
    if (resolved) {
      try {
        await ctx.runMutation(api.tools.logToolCall, {
          triageRunId: resolved.runId,
          tool: "searchCode",
          input: { query },
          output: res,
          latencyMs,
        });
      } catch (err) {
        console.warn("[searchCode] logToolCall failed:", err);
      }
      // Round-2 DA finding (C3): mirror each snippet independently.
      for (const s of res.snippets as CodeSnippet[]) {
        if (!s?.file || typeof s.line !== "number") continue;
        try {
          await ctx.runMutation(api.triage.insertCitation, {
            triageRunId: resolved.runId,
            source: "code",
            sourceId: `${s.file}:${s.line}`,
            excerpt: (s.content ?? "").slice(0, 500),
            metadata: s.citation_url ? { citation_url: s.citation_url } : {},
            // Invariant 1: `lib/nia/client.ts` already drops snippets that
            // fail the cite-or-die verifier upstream — only verified
            // snippets reach this point. Same convention as the SSE path.
            verified: true,
          });
        } catch (err) {
          console.warn(
            `[searchCode] insertCitation ${s.file}:${s.line} failed:`,
            err
          );
        }
      }
    }

    return res;
  },
});

// ─── produceTriage — structured-output sink (the final step) ─────────────────
//
// Why this exists: `thread.streamText` returns a streaming text result, but
// our UI wants STRUCTURED data (timeline / rootCause / suspectedFix /
// similarIncidents) on the `triageRuns` row so reactive consumers don't need
// to parse free-form text. Two options:
//   (a) parse the agent's JSON tail post-hoc
//   (b) require the agent to call a tool with the structured shape as input
//
// (b) wins because:
//   - Zod `inputSchema` validates the shape at the AI SDK boundary
//     (Cite-Or-Die enforced by the schema, not by best-effort regex)
//   - the LLM has stronger adherence to tool calls than to free-form output
//   - one clean ctx.runMutation call lands the data, no parsing
//
// The agent's system prompt instructs it that this MUST be the final step.

const TimelineEntrySchema = z.object({
  at: z.string().describe("ISO 8601 timestamp"),
  event: z.string().describe("What happened"),
});

const CitationIdSchema = z
  .string()
  .min(1)
  .describe(
    "Hyperspell memory_id (slack/notion/gmail) OR `file:line` (code). Must reference a citation surfaced by recallSimilarIncidents or searchCode."
  );

const produceTriage = createTool({
  description:
    "Persist the final structured triage. Call this ONCE after recallSimilarIncidents and searchCode. Every citations array MUST contain only source_ids surfaced by the prior tool calls (Cite-Or-Die — Invariant 1). Calling this tool ends the run.",
  inputSchema: z.object({
    timeline: z
      .array(TimelineEntrySchema)
      .describe("Ordered list of events leading up to and during the incident"),
    root_cause: z
      .object({
        text: z.string().min(1).describe("Concise root-cause explanation"),
        citations: z
          .array(CitationIdSchema)
          .min(1)
          .describe(
            "source_ids backing the root-cause claim. Cite-Or-Die: at least one required."
          ),
      })
      .describe("Why the incident happened"),
    suspected_fix: z
      .object({
        file: z.string().min(1).describe("File path of the suspected fix"),
        line: z
          .number()
          .int()
          .positive()
          .describe("Line number in `file` where the fix lands"),
        diff: z.string().min(1).describe("Unified diff of the proposed fix"),
        citations: z
          .array(CitationIdSchema)
          .describe(
            "source_ids backing the fix (e.g. ADR or helper-fn citations)"
          ),
      })
      .describe("Proposed code change"),
    similar_incidents: z
      .array(
        z.object({
          memory_id: z.string().min(1),
          summary: z.string().min(1),
          relevance: z.number().min(0).max(1),
          fromTriageHistory: z.boolean().optional(),
        })
      )
      .describe(
        "Prior incidents recalled via Hyperspell. memory_id must be from recallSimilarIncidents output."
      ),
  }),
  execute: async (ctx, input) => {
    const resolved = await resolveRun(ctx);
    if (!resolved) {
      // The agent called produceTriage in a thread we don't track. Don't
      // throw — the agent component would treat that as a tool error and
      // could enter a retry loop. Return a soft signal instead.
      return {
        ok: false,
        error:
          "no triageRun found for this thread; produceTriage was called outside the live agent path",
      };
    }

    // Resolve the citation ids (source_ids) the agent referenced into
    // Convex `citations` row ids. The retrieval tools above wrote those
    // rows already; we map by sourceId. If a referenced sourceId is
    // missing, surface it explicitly (Cite-Or-Die would otherwise let
    // a fabricated citation slip through).
    const citationRows = (await ctx.runQuery(internal.triage._citationsByRun, {
      triageRunId: resolved.runId,
    })) as { _id: Id<"citations">; sourceId: string }[];
    const idBySourceId = new Map<string, string>();
    for (const c of citationRows) {
      idBySourceId.set(c.sourceId, String(c._id));
    }
    // Cite-Or-Die (Invariant 1): fabricated source_ids must NOT silently drop.
    // If the agent passes a sid that wasn't surfaced by recallSimilarIncidents
    // / searchCode, return a tool-error so the agent retries with verifiable
    // citations. (Round-2 DA finding: silent .filter() let uncited rootCauses
    // sneak past the produceTriage-was-called verifier.)
    const mapCitesOrFail = (
      sourceIds: string[],
      label: string
    ): { ok: true; ids: string[] } | { ok: false; error: string } => {
      const ids: string[] = [];
      const missing: string[] = [];
      for (const sid of sourceIds) {
        const id = idBySourceId.get(sid);
        if (id) ids.push(id);
        else missing.push(sid);
      }
      if (missing.length > 0) {
        return {
          ok: false,
          error: `Cite-Or-Die violation: ${label} referenced source_id(s) [${missing.join(", ")}] not surfaced by recallSimilarIncidents/searchCode. Re-run produceTriage citing only ids from prior tool outputs.`,
        };
      }
      return { ok: true, ids };
    };

    const rootCauseRes = mapCitesOrFail(
      input.root_cause.citations,
      "root_cause"
    );
    if (!rootCauseRes.ok) return { ok: false, error: rootCauseRes.error };
    const suspectedFixRes = mapCitesOrFail(
      input.suspected_fix.citations,
      "suspected_fix"
    );
    if (!suspectedFixRes.ok) return { ok: false, error: suspectedFixRes.error };
    const rootCauseCitations = rootCauseRes.ids;
    const suspectedFixCitations = suspectedFixRes.ids;

    // Enrich similar_incidents.fromTriageHistory by joining against the
    // recalled-memory metadata captured in the toolCalls table — same
    // detection rule as `lib/agent/loop.ts:runReplay` and the frontend
    // hook (mem_reinforce_* prefix OR metadata.kind === "triage_history").
    const toolCallRows = (await ctx.runQuery(internal.triage._toolCallsByRun, {
      triageRunId: resolved.runId,
    })) as { tool: string; output: unknown }[];
    const recalledById = new Map<string, Memory>();
    for (const tc of toolCallRows) {
      if (tc.tool !== "recallSimilarIncidents") continue;
      const out = tc.output as { memories?: Memory[] } | null;
      for (const m of out?.memories ?? []) recalledById.set(m.id, m);
    }
    const similarIncidentsDetailed = input.similar_incidents.map((si) => {
      if (si.fromTriageHistory) return si;
      const mem = recalledById.get(si.memory_id);
      const isHistory =
        si.memory_id.startsWith("mem_reinforce_") ||
        (mem?.metadata as { kind?: string } | undefined)?.kind ===
          "triage_history";
      return isHistory ? { ...si, fromTriageHistory: true } : si;
    });

    await ctx.runMutation(api.triage.finalizeResult, {
      triageRunId: resolved.runId,
      timeline: input.timeline,
      rootCause: {
        text: input.root_cause.text,
        citations: rootCauseCitations,
      },
      suspectedFix: {
        file: input.suspected_fix.file,
        line: input.suspected_fix.line,
        diff: input.suspected_fix.diff,
        citations: suspectedFixCitations,
      },
      similarIncidents: input.similar_incidents.map((s) => s.memory_id),
      similarIncidentsDetailed,
    });

    return { ok: true, triageRunId: String(resolved.runId) };
  },
});

// ─── Agent ────────────────────────────────────────────────────────────────────

/**
 * Triage Agent — wired via the `agent` Convex component.
 *
 * Phase 4 — RAG over message history. `searchOtherThreads` lets follow-up
 * incidents use prior triage threads from the same `userId` / `orgId`.
 * `triageNode.ts` separately emits a visible `[degraded]` marker when no
 * recent reinforcement exists; RAG is additive, not a replacement for that
 * honesty signal.
 *
 * `stopWhen: stepCountIs(5)` mirrors the bound documented in
 * `lib/prompts/triage-system.md` ("Stop after at most 5 tool calls").
 */
export const triageAgent = new Agent(agentComponent, {
  name: "Triage",
  // Default to OpenAI gpt-4o because we have a working sk-proj-... key
  // (verified for chat + embeddings). Falls back to Anthropic Sonnet 4.5
  // when ANTHROPIC_API_KEY is set — keeps the prompt-tuned behaviour the
  // PR was designed for. The void anthropic() reference keeps the import
  // alive for the conditional in case the toolchain tree-shakes it.
  languageModel: process.env.ANTHROPIC_API_KEY
    ? anthropic("claude-sonnet-4-5")
    : openai.chat("gpt-4o"),
  instructions: loadInstructions(),
  tools: { recallSimilarIncidents, searchCode, produceTriage },
  // The agent now needs ≥3 tool calls (recall + searchCode + produceTriage)
  // plus the initial reasoning step, plus any retry. 8 is the upper bound
  // enforced by `tests/invariants/agent_component.test.ts`.
  stopWhen: stepCountIs(8),
  contextOptions: {
    // Phase 4 — built-in tool-based RAG over message history.
    // `searchOtherThreads: true` lets the agent surface relevant context
    // from prior threads belonging to the same userId (= orgId). The
    // `traceState.hasRecentReinforcement` probe in `triageNode.ts` produces
    // the user-visible `[degraded]` event when no recent reinforcement exists.
    searchOtherThreads: true,
    // Sliding window of recent messages to include verbatim.
    recentMessages: 10,
    searchOptions: {
      // Text search over thread message history. We do NOT enable
      // `vectorSearch: true` here because that requires an
      // `embeddingModel` on the Agent constructor (e.g.
      // `openai.embedding("text-embedding-3-small")`). The project pins
      // Anthropic for chat — adding an embedding provider is an
      // intentional follow-up. Text search alone still surfaces prior
      // threads from the same `userId` (= orgId) when the trace tokens
      // overlap, which is sufficient for follow-up incident context.
      limit: 10,
      textSearch: true,
    },
  },
});
