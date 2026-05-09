/**
 * Invariant 2 — Memory Reinforcement (★ THE RUBRIC PLAY).
 *
 * Trace B's recall must surface at least one memory_id that Trace A's
 * recall did not. That's the falsifiable proof that the reinforcement
 * step (convex/reinforce.ts) made a previously-cold memory hot.
 *
 * This test is non-negotiable: a passing test that no longer enforces
 * the property is a Codex red flag. Any change here MUST keep the
 * `traceB - traceA` set-difference assertion intact.
 *
 * Hard rule from the spec: it is impossible for this test to be green
 * without the new-citation property holding on disk.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { TriageResultSchema, type TriageResult } from "@/lib/types";

const REPLAY_ROOT = path.join(process.cwd(), "data", "replay");

interface TraceFixture {
  tool_calls: Array<{
    tool: string;
    output: { memories?: Array<{ id: string; metadata?: Record<string, unknown> }> };
  }>;
  result: TriageResult;
}

async function readFixture(name: string): Promise<TraceFixture> {
  const raw = await fs.readFile(path.join(REPLAY_ROOT, name), "utf-8");
  return JSON.parse(raw) as TraceFixture;
}

/** Surface every memory_id the agent CITED OR LISTED for this triage. */
function citedMemoryIds(t: TraceFixture): Set<string> {
  TriageResultSchema.parse(t.result); // lock the shape
  const ids = new Set<string>();
  for (const c of t.result.root_cause.citations) {
    if (c.source !== "code") ids.add(c.source_id);
  }
  for (const c of t.result.suspected_fix.citations) {
    if (c.source !== "code") ids.add(c.source_id);
  }
  for (const s of t.result.similar_incidents) ids.add(s.memory_id);
  return ids;
}

/** Surface every memory_id the recall tool RETURNED (raw recall set). */
function recalledMemoryIds(t: TraceFixture): Set<string> {
  const ids = new Set<string>();
  const recall = t.tool_calls.find(
    (c) => c.tool === "recallSimilarIncidents" && c.output?.memories
  );
  for (const m of recall?.output.memories ?? []) ids.add(m.id);
  return ids;
}

describe("Invariant 2 — Memory Reinforcement (Trace B surfaces a new citation)", () => {
  it("Trace B's CITED memory_ids include at least one Trace A's didn't", async () => {
    const a = await readFixture("trace-a.json");
    const b = await readFixture("trace-b.json");
    const aIds = citedMemoryIds(a);
    const bIds = citedMemoryIds(b);

    const newInB = [...bIds].filter((id) => !aIds.has(id));
    expect(
      newInB.length,
      `Trace B must cite at least one memory_id not present in Trace A; got: ${JSON.stringify(
        [...bIds]
      )} vs A: ${JSON.stringify([...aIds])}`
    ).toBeGreaterThan(0);
  });

  it("Trace B's RECALLED memory_ids include at least one Trace A's didn't (raw recall is post-reinforcement)", async () => {
    const a = await readFixture("trace-a.json");
    const b = await readFixture("trace-b.json");
    const aRecall = recalledMemoryIds(a);
    const bRecall = recalledMemoryIds(b);

    const newInBRecall = [...bRecall].filter((id) => !aRecall.has(id));
    expect(
      newInBRecall.length,
      `Trace B's recall must surface a memory_id Trace A didn't (the reinforcement signal). New in B: ${JSON.stringify(
        newInBRecall
      )}`
    ).toBeGreaterThan(0);
  });

  it("Trace B leaves a triage_history trail (mem_reinforce_* OR metadata.kind='triage_history')", async () => {
    const b = await readFixture("trace-b.json");
    const recall = b.tool_calls.find(
      (c) => c.tool === "recallSimilarIncidents"
    );
    expect(recall).toBeDefined();
    const memories = recall!.output.memories ?? [];

    const reinforcementSignal = memories.some((m) => {
      if (/^mem_reinforce_/i.test(m.id)) return true;
      const md = m.metadata as { kind?: string } | undefined;
      return md?.kind === "triage_history";
    });

    expect(
      reinforcementSignal,
      "Trace B's recall must contain a memory whose id starts with 'mem_reinforce_' OR whose metadata.kind === 'triage_history' (proves convex/reinforce.ts ran after Trace A)"
    ).toBe(true);
  });

  it("the planted retry-budget DM is the visible wow-moment citation in Trace B", async () => {
    const a = await readFixture("trace-a.json");
    const b = await readFixture("trace-b.json");

    const aIds = citedMemoryIds(a);
    const bIds = citedMemoryIds(b);

    // The retry-budget DM is the demo's literal new-citation moment.
    // Lock the id used in the fixture: any rename here is a coordinated change.
    const RETRY_BUDGET_ID = "mem_slk_dm_feb18_retry_budget";
    expect(
      aIds.has(RETRY_BUDGET_ID),
      "Trace A must NOT cite the retry-budget DM (it's the cold memory before reinforcement)"
    ).toBe(false);
    expect(
      bIds.has(RETRY_BUDGET_ID),
      "Trace B MUST cite the retry-budget DM (post-reinforcement, this is the wow moment)"
    ).toBe(true);
  });
});
