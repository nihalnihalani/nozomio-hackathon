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
 * external keys only when DEMO_MODE=replay is explicitly selected. Live
 * production mode fails closed; hybrid mode may fall back to replay.
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

// Static JSON imports — bundled at build time so the fixtures are
// available in BOTH the Next.js runtime AND the Convex sandbox (which
// only bundles the convex/ folder + transitively imported modules,
// NOT the on-disk data/replay/ directory).
//
// Without this, the Convex action's runReplay path fails with
// "doesn't match any known fixture" — fs.readdir(REPLAY_DIR) returns
// an empty array in Convex's sandbox. PR #10 surfaced this regression
// because the new useTriage routes ALL runs through Convex actions.
import traceAFixture from "../../data/replay/trace-a.json";
import traceBFixture from "../../data/replay/trace-b.json";

const BUNDLED_FIXTURES: unknown[] = [traceAFixture, traceBFixture];

async function loadFixtures(): Promise<ReplayFixture[]> {
  const out: ReplayFixture[] = [];

  // Source 1: bundled JSON imports — works in Next.js + Convex sandbox.
  for (const raw of BUNDLED_FIXTURES) {
    const parsed = ReplayFixtureSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  if (out.length > 0) return out;

  // Source 2 (legacy fallback): fs.readdir on data/replay/. Reachable
  // only if every bundled import failed validation.
  let entries: string[];
  try {
    entries = await fs.readdir(REPLAY_DIR);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("_")) continue;
    const full = path.join(REPLAY_DIR, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      const raw = await fs.readFile(full, "utf-8");
      const parsed = ReplayFixtureSchema.safeParse(JSON.parse(raw));
      if (parsed.success) out.push(parsed.data);
    } catch {
      // Ignore malformed fixtures.
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
        "This stack trace doesn't match any replay fixture. Run in live mode with real Hyperspell + Nia keys, or provide an input that exists in data/replay/.",
    });
    await emit({ type: "status", status: "error" });
    return null;
  }

  await emit({ type: "status", status: "running" });

  for (const tc of fixture.tool_calls) {
    if (tc.delay_ms > 0) await sleep(tc.delay_ms);
    const at = Date.now();
    await emit({
      type: "tool_call",
      tool: tc.tool,
      input: tc.input,
      output: tc.output,
      latencyMs: tc.delay_ms,
      at,
    });
    // Surface citations from each tool's output as we stream.
    for (const c of extractToolCitations(tc.tool, tc.output)) {
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
  const enrichedResult: TriageResult = {
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
 * older, the import will throw. Live mode reports the failure; hybrid mode
 * falls back to replay.
 */
// Loose types for the dynamic AI SDK import — the build must work even
// if the installed `ai` version (4.x vs 5.x vs 6.x) differs from what
// the runtime expects. Production live mode reports runtime mismatches
// instead of substituting replay data.
//
// AI SDK v6 contract: `tool({ description, inputSchema, execute })`. The
// v4-era `parameters:` key was renamed to `inputSchema:` in v5/v6 (see
// node_modules/ai/dist/index.d.ts → re-export of `tool` from
// `@ai-sdk/provider-utils` whose `Tool<INPUT, OUTPUT>` type uses
// `inputSchema: FlexibleSchema<INPUT>`). Passing `parameters` silently
// fails to wire the Zod schema, the LLM never sees the tool's input
// shape, and tool calls degrade to dynamic-only or no-op. Verified:
// node_modules/ai/package.json reports version "6.0.177".
type AiToolFactory = (def: {
  description?: string;
  inputSchema: unknown;
  execute: (args: unknown) => unknown | Promise<unknown>;
}) => unknown;
type AiStreamText = (config: Record<string, unknown>) => Promise<{
  textStream: AsyncIterable<string>;
}>;
type AiModelFactory = (modelId: string) => unknown;
type AiOpenAIProvider = AiModelFactory & {
  chat?: (modelId: string) => unknown;
};

async function runLive(
  input: RunAgentInput,
  emit: EventSink,
  options: { allowReplayFallback: boolean }
): Promise<TriageResult | null> {
  let streamText: AiStreamText;
  let tool: AiToolFactory;
  let stepCountIs: ((n: number) => unknown) | undefined;
  let anthropic: AiModelFactory | undefined;
  let openai: AiOpenAIProvider | undefined;
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
    anthropic = anthMod.anthropic as AiModelFactory | undefined;
    const openaiMod = (await import("@ai-sdk/openai")) as Record<
      string,
      unknown
    >;
    openai = openaiMod.openai as AiOpenAIProvider | undefined;
  } catch (err) {
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      `Live mode unavailable: ${(err as Error).message}`
    );
  }

  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  if (!hasAnthropic && !hasOpenAI) {
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      "OPENAI_API_KEY or ANTHROPIC_API_KEY is required in live mode"
    );
  }
  if (hasAnthropic && !anthropic) {
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      "@ai-sdk/anthropic did not export an anthropic provider"
    );
  }
  if (!hasAnthropic && (!openai || typeof openai !== "function")) {
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      "@ai-sdk/openai did not export an openai provider"
    );
  }
  const languageModel = hasAnthropic
    ? anthropic!("claude-sonnet-4-5")
    : openai!.chat
      ? openai!.chat("gpt-4o")
      : openai!("gpt-4o");

  const system = await loadPrompt();
  const hyperspell = getHyperspell();
  const nia = getNia();

  await emit({ type: "status", status: "running" });

  const tools = {
    recallSimilarIncidents: tool({
      description:
        "Search the team's Slack #incidents history, Notion postmortem database, and Gmail vendor outage threads via Hyperspell. Returns the top-5 most relevant memories with metadata.",
      // AI SDK v6: `inputSchema` (was `parameters:` in v4). See AiToolFactory.
      inputSchema: z.object({
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
      // AI SDK v6: `inputSchema` (was `parameters:` in v4). See AiToolFactory.
      inputSchema: z.object({
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
      model: languageModel,
      system,
      prompt,
      tools,
      maxSteps: 5,
      // PostHog OTel wire — `convex/observability.ts` registers a global
      // `BasicTracerProvider` + `PostHogTraceExporter` at module scope when
      // `POSTHOG_API_KEY` is set. The AI SDK only emits `gen_ai.*` spans
      // when telemetry is explicitly enabled per-call (default off). With
      // `isEnabled: true`, every streamText call lands in PostHog as
      // `$ai_generation` events with cost/latency/model/prompt/response.
      // No-op when PostHog isn't configured (the registered provider is a
      // dev-friendly default tracer).
      experimental_telemetry: { isEnabled: true, functionId: "triage" },
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
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      `Live model error: ${(err as Error).message}`
    );
  }

  // Extract the JSON blob from the model's text output.
  const jsonMatch = collected.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      "Model returned no JSON"
    );
  }
  let parsed: TriageResult;
  try {
    parsed = TriageResultSchema.parse(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return await failOrReplay(
      input,
      emit,
      options.allowReplayFallback,
      `Result schema validation failed: ${(err as Error).message}`
    );
  }

  await emit({ type: "result", result: parsed });
  await emit({ type: "status", status: "done" });
  return parsed;
}

async function failOrReplay(
  input: RunAgentInput,
  emit: EventSink,
  allowReplayFallback: boolean,
  message: string
): Promise<TriageResult | null> {
  if (allowReplayFallback) {
    await emit({
      type: "error",
      message: `${message}. Falling back to replay because DEMO_MODE=hybrid.`,
    });
    return await runReplay(input, emit);
  }
  await emit({ type: "error", message });
  await emit({ type: "status", status: "error" });
  return null;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Run the agent. Selects live vs replay based on getDemoMode().
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
    return await runLive(input, emit, {
      allowReplayFallback: mode === "hybrid",
    });
  } catch (err) {
    await emit({ type: "error", message: (err as Error).message });
    await emit({ type: "status", status: "error" });
    return null;
  }
}
