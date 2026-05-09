/**
 * Agent loop — shared between the Convex action (live) and the Next.js
 * API route fallback (replay). Owns:
 *   - tool definitions (recallSimilarIncidents, searchCode)
 *   - system prompt loading from lib/prompts/triage-system.md
 *   - structured-output validation against TriageResultSchema
 *   - replay-mode fixture playback with delay_ms pacing
 *
 * Invariant 1 (Cite-Or-Die): the system prompt enforces "refuse without
 * citation," and tools surface verification status in their output.
 * Invariant 4 (Hermetic Demo Mode): the entire loop runs without any
 * external keys when DEMO_MODE=replay (the default).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  type Citation,
  type Memory,
  type RecallOutput,
  type SearchCodeOutput,
  type TriageResult,
  TriageResultSchema,
  getDemoMode,
} from "@/lib/types";
import { getHyperspell, SOURCE_WEIGHTS } from "@/lib/hyperspell/client";
import { getNia } from "@/lib/nia/client";

// ─── Event stream protocol ────────────────────────────────────────────────────

/** Events the agent loop emits as it runs. The Convex action persists
 *  them as toolCalls / citations rows; the API route serializes them
 *  as SSE frames. Single source of truth for both consumers. */
export type AgentEvent =
  | { type: "status"; status: "pending" | "running" | "done" | "error" }
  | {
      type: "tool_call";
      tool: "recallSimilarIncidents" | "searchCode";
      input: unknown;
      output: unknown;
      latencyMs: number;
      at: number;
    }
  | { type: "citation"; citation: Citation }
  | { type: "result"; result: TriageResult }
  | { type: "error"; message: string };

export type EventSink = (event: AgentEvent) => void | Promise<void>;

export interface RunAgentInput {
  trace: string;
  orgId: string;
  /** Optional tag — used by tests / scripts to pin a specific fixture. */
  fixtureHint?: string;
}

// ─── Replay fixture ───────────────────────────────────────────────────────────

const ReplayToolCallSchema = z.object({
  tool: z.enum(["recallSimilarIncidents", "searchCode"]),
  input: z.unknown(),
  output: z.unknown(),
  delay_ms: z.number().nonnegative().default(800),
});

const ReplayFixtureSchema = z.object({
  input_trace_pattern: z.string(),
  tool_calls: z.array(ReplayToolCallSchema),
  result: TriageResultSchema,
});
type ReplayFixture = z.infer<typeof ReplayFixtureSchema>;

const REPLAY_DIR = path.join(process.cwd(), "data", "replay");
const PROMPT_FILE = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "triage-system.md"
);

async function loadPrompt(): Promise<string> {
  try {
    return await fs.readFile(PROMPT_FILE, "utf-8");
  } catch {
    // Should never happen — prompt is checked in. Fallback: minimal.
    return "You are Triage, an incident-triage agent. Cite every claim.";
  }
}

async function loadFixtures(): Promise<ReplayFixture[]> {
  const out: ReplayFixture[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(REPLAY_DIR);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("_")) continue;
    // Skip subdirectory fixtures (data/replay/hyperspell, data/replay/nia)
    const full = path.join(REPLAY_DIR, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      const raw = await fs.readFile(full, "utf-8");
      const parsed = ReplayFixtureSchema.safeParse(JSON.parse(raw));
      if (parsed.success) out.push(parsed.data);
    } catch {
      // Ignore malformed fixtures — they'll surface as a missing match.
    }
  }
  return out;
}

function pickFixture(
  fixtures: ReplayFixture[],
  trace: string,
  hint?: string
): ReplayFixture | null {
  if (hint) {
    const byHint = fixtures.find((f) =>
      f.input_trace_pattern.toLowerCase().includes(hint.toLowerCase())
    );
    if (byHint) return byHint;
  }
  const lower = trace.toLowerCase();
  // Prefer the most-specific (longest-pattern) match.
  // Invariant 1 (Cite-Or-Die): if NOTHING matches, return null and let the
  // caller emit an error. We do NOT silently fall back to fixtures[0] —
  // that would surface Trace A's full triage in response to bogus input,
  // which is the textbook fabricated-citation failure mode the invariant
  // exists to prevent.
  const matches = fixtures
    .filter((f) => lower.includes(f.input_trace_pattern.toLowerCase()))
    .sort(
      (a, b) => b.input_trace_pattern.length - a.input_trace_pattern.length
    );
  return matches[0] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Citation extraction ──────────────────────────────────────────────────────

/**
 * Walk a TriageResult and yield every citation; used so the Convex
 * action can persist them into the citations table for the live UI.
 */
export function* extractCitations(result: TriageResult): Iterable<Citation> {
  for (const c of result.root_cause.citations) yield c;
  for (const c of result.suspected_fix.citations) yield c;
}

// ─── Session reinforcement state (Codex finding #3) ──────────────────────────
//
// Per-org marker that Trace A has been run "recently." Trace B's reinforced
// citations (the retry-budget DM + the triage_history trail) are gated on
// this — without a prior Trace A run, those citations are stripped from the
// response so the demo doesn't claim memory was reinforced when it wasn't.
//
// Module-level state is acceptable here because the Next.js dev/prod server
// is a single Node process. In a multi-instance deploy this would need to
// move to a shared store (Redis, Convex memoryEvents); flagged as Layer-2.
const TRACE_A_RUN_STATE = new Map<
  string,
  { traceASignature: string; at: number }
>();
const TRACE_A_RUN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isTraceAFixture(fixture: ReplayFixture): boolean {
  // Trace A is the one whose recall output does NOT contain any reinforced
  // memory_ids (mem_reinforce_* or metadata.kind === triage_history).
  // Trace B is the one that DOES.
  for (const tc of fixture.tool_calls) {
    if (tc.tool !== "recallSimilarIncidents") continue;
    const out = tc.output as { memories?: Memory[] };
    for (const m of out.memories ?? []) {
      const isReinforced =
        m.id.startsWith("mem_reinforce_") ||
        (m.metadata as { kind?: string } | undefined)?.kind ===
          "triage_history";
      if (isReinforced) return false;
    }
  }
  return true;
}

function recordTraceARun(orgId: string, signature: string) {
  TRACE_A_RUN_STATE.set(orgId, { traceASignature: signature, at: Date.now() });
}

function hasTraceARunRecently(orgId: string): boolean {
  const entry = TRACE_A_RUN_STATE.get(orgId);
  if (!entry) return false;
  return Date.now() - entry.at < TRACE_A_RUN_TTL_MS;
}

/**
 * Strip the reinforced citations + memory_ids from a Trace B result so the
 * agent doesn't claim memory was reinforced when no prior Trace A ran.
 * The user still gets a triage — just without the retry-budget DM and the
 * triage_history trail.
 */
function stripReinforcedCitations(result: TriageResult): TriageResult {
  const isReinforcedId = (id: string) =>
    id.startsWith("mem_reinforce_") ||
    id === "mem_slk_dm_feb18_retry_budget";
  // Patterns we filter out of timeline event TEXT — the fixture's narrative
  // mentions the reinforced memory IDs by name, which would still claim
  // memory was reinforced even if we strip citations.
  const reinforcedTextPatterns = [
    /mem_reinforce_/,
    /mem_slk_dm_feb18/,
    /Reinforced memory/i,
    /Reinforcement-surfaced/i,
  ];
  const isReinforcedTimelineEvent = (eventText: string) =>
    reinforcedTextPatterns.some((re) => re.test(eventText));
  return {
    ...result,
    timeline: result.timeline.filter(
      (e) => !isReinforcedTimelineEvent(e.event)
    ),
    root_cause: {
      ...result.root_cause,
      citations: result.root_cause.citations.filter(
        (c) => !isReinforcedId(c.source_id)
      ),
    },
    suspected_fix: {
      ...result.suspected_fix,
      citations: result.suspected_fix.citations.filter(
        (c) => !isReinforcedId(c.source_id)
      ),
    },
    similar_incidents: result.similar_incidents.filter(
      (s) => !isReinforcedId(s.memory_id)
    ),
  };
}

// ─── Replay runner ────────────────────────────────────────────────────────────

async function runReplay(
  input: RunAgentInput,
  emit: EventSink
): Promise<TriageResult | null> {
  const fixtures = await loadFixtures();
  const fixture = pickFixture(fixtures, input.trace, input.fixtureHint);
  if (!fixture) {
    // Invariant 1 (Cite-Or-Die): no match → no fabricated citations. Surface
    // a useful, judge-friendly error and stop. The frontend renders this as
    // a status:error card.
    await emit({
      type: "error",
      message:
        "This stack trace doesn't match any known fixture. Try the Trace A or Trace B sample buttons, or run the project in live mode with real Hyperspell + Nia keys.",
    });
    await emit({ type: "status", status: "error" });
    return null;
  }

  // Codex finding #3: Trace B's reinforced citations are gated on a prior
  // Trace A run for the same orgId within TRACE_A_RUN_TTL_MS. If no such
  // run is recorded, we serve a degraded Trace B (without the retry-budget
  // DM + reinforcement trail) and surface a status event explaining why.
  // This makes the dependency between the two traces honest rather than
  // theatrical: the wow moment ONLY fires after Trace A has actually run.
  const isTraceA = isTraceAFixture(fixture);
  const traceAValid = hasTraceARunRecently(input.orgId);
  const degradeReinforcement = !isTraceA && !traceAValid;

  await emit({ type: "status", status: "running" });

  for (const tc of fixture.tool_calls) {
    if (tc.delay_ms > 0) await sleep(tc.delay_ms);
    const at = Date.now();
    // If we're in degrade mode, also strip reinforced memories from the
    // tool_call output so the live trace UI doesn't show citations the
    // final result will then drop. Honesty top-to-bottom.
    let outputForEmit = tc.output;
    if (degradeReinforcement && tc.tool === "recallSimilarIncidents") {
      const out = tc.output as { memories?: Memory[] };
      outputForEmit = {
        memories: (out.memories ?? []).filter((m) => {
          const isReinforced =
            m.id.startsWith("mem_reinforce_") ||
            (m.metadata as { kind?: string } | undefined)?.kind ===
              "triage_history" ||
            m.id === "mem_slk_dm_feb18_retry_budget";
          return !isReinforced;
        }),
      };
    }
    await emit({
      type: "tool_call",
      tool: tc.tool,
      input: tc.input,
      output: outputForEmit,
      latencyMs: tc.delay_ms,
      at,
    });
    // Surface citations from each tool's output as we stream.
    for (const c of extractToolCitations(tc.tool, outputForEmit)) {
      await emit({ type: "citation", citation: c });
    }
  }

  // Invariant 2 (Memory Reinforcement): tag similar_incidents whose source
  // memory was either reinforced by a prior triage (id starts with
  // `mem_reinforce_`) OR was added as a `triage_history` entry. The frontend
  // renders these with a 🧠 badge so judges can see "this incident was
  // surfaced because the agent already triaged this kind of thing."
  const recalledMemoriesById = new Map<string, Memory>();
  for (const tc of fixture.tool_calls) {
    if (tc.tool !== "recallSimilarIncidents") continue;
    const out = tc.output as { memories?: Memory[] };
    for (const m of out.memories ?? []) recalledMemoriesById.set(m.id, m);
  }
  let enrichedResult: TriageResult = {
    ...fixture.result,
    similar_incidents: fixture.result.similar_incidents.map((si) => {
      const mem = recalledMemoriesById.get(si.memory_id);
      const isHistory =
        si.memory_id.startsWith("mem_reinforce_") ||
        (mem?.metadata as { kind?: string } | undefined)?.kind ===
          "triage_history";
      return isHistory ? { ...si, fromTriageHistory: true } : si;
    }) as TriageResult["similar_incidents"],
  };

  // Apply the Codex #3 degrade if we determined no prior Trace A.
  if (degradeReinforcement) {
    enrichedResult = stripReinforcedCitations(enrichedResult);
    await emit({
      type: "error",
      message:
        "[degraded] Trace B's reinforced citations are gated on a prior Trace A run. Run Trace A first to see the memory-reinforcement effect.",
    });
  }

  // Record the Trace A run so a subsequent Trace B can surface the
  // reinforced memory honestly.
  if (isTraceA) {
    recordTraceARun(input.orgId, fixture.input_trace_pattern);
  }

  await emit({ type: "result", result: enrichedResult });
  await emit({ type: "status", status: "done" });
  return enrichedResult;
}

/**
 * Map a tool's raw output back into the citation envelope.
 * Invariant 1: every citation surfaced here carries `verified`.
 */
function extractToolCitations(
  tool: "recallSimilarIncidents" | "searchCode",
  output: unknown
): Citation[] {
  if (tool === "recallSimilarIncidents") {
    const parsed = z
      .object({ memories: z.array(z.unknown()) })
      .safeParse(output);
    if (!parsed.success) return [];
    const out: Citation[] = [];
    for (const raw of parsed.data.memories) {
      const m = raw as Memory;
      if (!m.id || !m.text || !m.source) continue;
      out.push({
        source: m.source,
        source_id: m.id,
        excerpt: m.text.slice(0, 500),
        metadata: m.metadata ?? {},
        // Invariant 1: Hyperspell recall is trusted (we don't re-verify).
        verified: true,
      });
    }
    return out;
  }
  // searchCode
  const parsed = z
    .object({
      snippets: z.array(
        z.object({
          file: z.string(),
          line: z.number(),
          content: z.string(),
        })
      ),
    })
    .safeParse(output);
  if (!parsed.success) return [];
  return parsed.data.snippets.map((s) => ({
    source: "code" as const,
    source_id: `${s.file}:${s.line}`,
    excerpt: s.content.slice(0, 500),
    metadata: {},
    // Invariant 1: searchCode tool ran the verifier upstream — only
    // verified snippets reach this code path.
    verified: true,
  }));
}

// ─── Live runner ──────────────────────────────────────────────────────────────

/**
 * Live agent loop using Vercel AI SDK. Targets `streamText` + `tool` +
 * `stepCountIs(5)` (AI SDK 5/6 surface). If the runtime AI SDK is
 * older, the import will throw and we'll fall back to replay below.
 */
// Loose types for the dynamic AI SDK import — the build must work even
// if the installed `ai` version (4.x vs 5.x vs 6.x) differs from what
// the runtime expects. The try/catch + replay fallback is the contract.
type AiToolFactory = (def: {
  description?: string;
  parameters: unknown;
  execute: (args: unknown) => unknown | Promise<unknown>;
}) => unknown;
type AiStreamText = (config: Record<string, unknown>) => Promise<{
  textStream: AsyncIterable<string>;
}>;
type AiAnthropic = (modelId: string) => unknown;

async function runLive(
  input: RunAgentInput,
  emit: EventSink
): Promise<TriageResult | null> {
  let streamText: AiStreamText;
  let tool: AiToolFactory;
  let stepCountIs: ((n: number) => unknown) | undefined;
  let anthropic: AiAnthropic;
  try {
    const aiMod = (await import("ai")) as Record<string, unknown>;
    streamText = aiMod.streamText as AiStreamText;
    tool = aiMod.tool as AiToolFactory;
    // stepCountIs is AI SDK 5+; we fall through to maxSteps otherwise.
    stepCountIs = aiMod.stepCountIs as ((n: number) => unknown) | undefined;
    const anthMod = (await import("@ai-sdk/anthropic")) as Record<
      string,
      unknown
    >;
    anthropic = anthMod.anthropic as AiAnthropic;
  } catch (err) {
    await emit({
      type: "error",
      message: `Live mode unavailable: ${(err as Error).message}. Falling back to replay.`,
    });
    return await runReplay(input, emit);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return await runReplay(input, emit);
  }

  const system = await loadPrompt();
  const hyperspell = getHyperspell();
  const nia = getNia();

  await emit({ type: "status", status: "running" });

  const tools = {
    recallSimilarIncidents: tool({
      description:
        "Search the team's Slack #incidents history, Notion postmortem database, and Gmail vendor outage threads via Hyperspell. Returns the top-5 most relevant memories with metadata.",
      parameters: z.object({
        signature: z
          .string()
          .min(1)
          .describe("Search query / error signature"),
      }),
      execute: async (rawArgs: unknown) => {
        const { signature } = rawArgs as { signature: string };
        const start = Date.now();
        const res = await hyperspell.memories.search({
          query: signature,
          options: { source_weights: SOURCE_WEIGHTS, limit: 5 },
        });
        const latencyMs = Date.now() - start;
        const output: RecallOutput = { memories: res.memories };
        await emit({
          type: "tool_call",
          tool: "recallSimilarIncidents",
          input: { signature },
          output,
          latencyMs,
          at: Date.now(),
        });
        for (const c of extractToolCitations(
          "recallSimilarIncidents",
          output
        )) {
          await emit({ type: "citation", citation: c });
        }
        return output;
      },
    }),
    searchCode: tool({
      description:
        "Search the production monorepo, ADRs, and runbooks via Nia. Returns code snippets with file:line locations and recent commits. Snippets are pre-verified — claimed file:line contains claimed code.",
      parameters: z.object({
        query: z.string().min(1).describe("Code-search query"),
      }),
      execute: async (rawArgs: unknown) => {
        const { query } = rawArgs as { query: string };
        const start = Date.now();
        const res = await nia.search({
          query,
          mode: "query",
          include_sources: true,
        });
        const latencyMs = Date.now() - start;
        const output: SearchCodeOutput = res;
        await emit({
          type: "tool_call",
          tool: "searchCode",
          input: { query },
          output,
          latencyMs,
          at: Date.now(),
        });
        for (const c of extractToolCitations("searchCode", output)) {
          await emit({ type: "citation", citation: c });
        }
        return output;
      },
    }),
  };

  const prompt = `Stack trace to triage:\n\n${input.trace}\n\nReturn the final triage as a JSON object matching the TriageResult schema.`;

  let collected = "";
  try {
    const config: Record<string, unknown> = {
      model: anthropic("claude-sonnet-4-5"),
      system,
      prompt,
      tools,
      maxSteps: 5,
    };
    // AI SDK 5+: prefer stopWhen: stepCountIs(5).
    if (typeof stepCountIs === "function") {
      config.stopWhen = stepCountIs(5);
    }
    const stream = await streamText(config);
    for await (const chunk of stream.textStream) {
      collected += chunk;
    }
  } catch (err) {
    await emit({
      type: "error",
      message: `Live model error: ${(err as Error).message}. Falling back to replay.`,
    });
    return await runReplay(input, emit);
  }

  // Extract the JSON blob from the model's text output.
  const jsonMatch = collected.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    await emit({
      type: "error",
      message: "Model returned no JSON; falling back to replay.",
    });
    return await runReplay(input, emit);
  }
  let parsed: TriageResult;
  try {
    parsed = TriageResultSchema.parse(JSON.parse(jsonMatch[0]));
  } catch (err) {
    await emit({
      type: "error",
      message: `Result schema validation failed: ${(err as Error).message}`,
    });
    return await runReplay(input, emit);
  }

  await emit({ type: "result", result: parsed });
  await emit({ type: "status", status: "done" });
  return parsed;
}

// ─── Hybrid mode (Codex finding #6) ───────────────────────────────────────────

/**
 * Hybrid mode: race live mode against a HYBRID_LIVE_BUDGET_MS timer.
 * If live completes within budget, flush its events to the real sink and
 * return its result. If the timer wins, drop the buffered live events
 * (we can't cancel streamText cleanly mid-flight) and fall back to replay.
 *
 * This is genuine timeout behavior, not a synonym for `live`. The previous
 * implementation routed `hybrid` directly to `runLive`, which Codex flagged
 * as deceptive. Now hybrid actually enforces a budget.
 */
async function runHybrid(
  input: RunAgentInput,
  emit: EventSink
): Promise<TriageResult | null> {
  const budgetMs = Math.max(
    1000,
    parseInt(process.env.HYBRID_LIVE_BUDGET_MS ?? "8000", 10)
  );
  // No key → no live possible → straight to replay (no theater)
  if (!process.env.ANTHROPIC_API_KEY) {
    return await runReplay(input, emit);
  }
  // Buffer live events; only flush if live wins the race.
  const buffered: AgentEvent[] = [];
  const bufferingSink: EventSink = (e) => {
    buffered.push(e);
  };

  let liveDone = false;
  const livePromise: Promise<TriageResult | null> = runLive(
    input,
    bufferingSink
  )
    .then((r) => {
      liveDone = true;
      return r;
    })
    .catch(() => {
      liveDone = true;
      return null;
    });
  const timerPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), budgetMs)
  );

  const winner = await Promise.race([livePromise, timerPromise]);
  if (winner !== "timeout" && liveDone) {
    // Live won: flush buffered events to real sink
    for (const e of buffered) await emit(e);
    return winner as TriageResult | null;
  }
  // Timeout: discard buffered events, fall through to replay.
  // (The backgrounded live promise will still resolve eventually but its
  // events go to the buffer, not the real sink — silent drop.)
  await emit({
    type: "error",
    message: `Live mode exceeded ${budgetMs}ms budget — falling back to replay.`,
  });
  return await runReplay(input, emit);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Run the agent. Selects live / replay / hybrid based on getDemoMode().
 * Always emits at least one `status` event followed by a terminal
 * `result` or `error`. Idempotent w.r.t. side effects in replay mode.
 */
export async function runAgent(
  input: RunAgentInput,
  emit: EventSink
): Promise<TriageResult | null> {
  const mode = getDemoMode();
  await emit({ type: "status", status: "pending" });
  try {
    if (mode === "replay") {
      return await runReplay(input, emit);
    }
    if (mode === "hybrid") {
      return await runHybrid(input, emit);
    }
    // mode === "live"
    return await runLive(input, emit);
  } catch (err) {
    await emit({ type: "error", message: (err as Error).message });
    await emit({ type: "status", status: "error" });
    return null;
  }
}
