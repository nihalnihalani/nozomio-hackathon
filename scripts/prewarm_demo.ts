#!/usr/bin/env tsx
/**
 * scripts/prewarm_demo.ts — verify the replay cache is demo-ready.
 *
 * Loads Trace A + Trace B compound fixtures, parses them against the
 * Zod schemas in lib/types.ts, and prints a summary. In live mode, also
 * pings Hyperspell + Nia healthz-equivalents.
 *
 * Run before stage call (per CLAUDE.md §Demo Day "Pre-warm replay cache by H4:00"):
 *   npm run prewarm
 *   DEMO_MODE=replay npm run prewarm
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  RecallOutputSchema,
  SearchCodeOutputSchema,
  TriageResultSchema,
  getDemoMode,
} from "@/lib/types";

const ROOT = process.cwd();
const REPLAY_ROOT = path.join(ROOT, "data", "replay");

const TraceFixtureSchema = z.object({
  input_trace_pattern: z.string().min(1),
  tool_calls: z.array(
    z.union([
      z.object({
        tool: z.literal("recallSimilarIncidents"),
        input: z.object({ signature: z.string().min(1) }),
        output: RecallOutputSchema,
        delay_ms: z.number().int().nonnegative(),
      }),
      z.object({
        tool: z.literal("searchCode"),
        input: z.object({ query: z.string().min(1) }),
        output: SearchCodeOutputSchema,
        delay_ms: z.number().int().nonnegative(),
      }),
    ])
  ),
  result: TriageResultSchema,
});

interface FixtureSummary {
  name: string;
  tool_calls: number;
  total_delay_ms: number;
  citations: number;
  similar_incidents: number;
  unique_memory_ids: string[];
}

async function loadFixture(rel: string): Promise<FixtureSummary> {
  const raw = await fs.readFile(path.join(REPLAY_ROOT, rel), "utf-8");
  const parsed = TraceFixtureSchema.parse(JSON.parse(raw));
  const total_delay_ms = parsed.tool_calls.reduce(
    (s, c) => s + c.delay_ms,
    0
  );
  const ids = new Set<string>();
  for (const c of parsed.result.root_cause.citations) {
    if (c.source !== "code") ids.add(c.source_id);
  }
  for (const s of parsed.result.similar_incidents) ids.add(s.memory_id);
  return {
    name: rel,
    tool_calls: parsed.tool_calls.length,
    total_delay_ms,
    citations:
      parsed.result.root_cause.citations.length +
      parsed.result.suspected_fix.citations.length,
    similar_incidents: parsed.result.similar_incidents.length,
    unique_memory_ids: [...ids],
  };
}

async function pingLive(): Promise<{ hyperspell: boolean; nia: boolean }> {
  const hsKey = process.env.HYPERSPELL_API_KEY;
  const niaKey = process.env.NIA_API_KEY;
  let hyperspell = false;
  let nia = false;
  if (hsKey) {
    try {
      const res = await fetch(
        `${process.env.HYPERSPELL_API_BASE ?? "https://api.hyperspell.com"}/v1/healthz`,
        { headers: { authorization: `Bearer ${hsKey}` } }
      );
      hyperspell = res.ok;
    } catch {
      hyperspell = false;
    }
  }
  if (niaKey) {
    try {
      const res = await fetch(
        `${process.env.NIA_API_BASE ?? "https://apigcp.trynia.ai"}/healthz`,
        { headers: { authorization: `Bearer ${niaKey}` } }
      );
      nia = res.ok;
    } catch {
      nia = false;
    }
  }
  return { hyperspell, nia };
}

async function main(): Promise<void> {
  const mode = getDemoMode();
  console.log(`[prewarm] mode=${mode}`);

  const a = await loadFixture("trace-a.json");
  const b = await loadFixture("trace-b.json");

  const newInB = b.unique_memory_ids.filter(
    (id) => !a.unique_memory_ids.includes(id)
  );

  console.log("┌─ Trace A ─────────────────────────────────────────");
  console.log(`│ tool_calls=${a.tool_calls}  total_delay_ms=${a.total_delay_ms}`);
  console.log(`│ citations=${a.citations}  similar_incidents=${a.similar_incidents}`);
  console.log(`│ memory_ids=[${a.unique_memory_ids.join(", ")}]`);
  console.log("├─ Trace B ─────────────────────────────────────────");
  console.log(`│ tool_calls=${b.tool_calls}  total_delay_ms=${b.total_delay_ms} (must be < A)`);
  console.log(`│ citations=${b.citations}  similar_incidents=${b.similar_incidents}`);
  console.log(`│ memory_ids=[${b.unique_memory_ids.join(", ")}]`);
  console.log("├─ Reinforcement (Invariant 2) ─────────────────────");
  console.log(`│ NEW in B vs A: [${newInB.join(", ") || "(none — INVARIANT 2 VIOLATED)"}]`);
  console.log("└──────────────────────────────────────────────────");

  if (b.total_delay_ms >= a.total_delay_ms) {
    console.error("[prewarm] FAIL: Trace B is not faster than Trace A");
    process.exit(1);
  }
  if (newInB.length === 0) {
    console.error("[prewarm] FAIL: Trace B does not surface a new memory_id");
    process.exit(1);
  }

  if (mode !== "replay") {
    const probes = await pingLive();
    console.log(
      `[prewarm] live probes: hyperspell=${probes.hyperspell ? "ok" : "skip/fail"} nia=${probes.nia ? "ok" : "skip/fail"}`
    );
  }

  console.log("[prewarm] OK — replay cache is demo-ready");
}

main().catch((err) => {
  console.error("[prewarm] FATAL:", err);
  process.exit(1);
});
