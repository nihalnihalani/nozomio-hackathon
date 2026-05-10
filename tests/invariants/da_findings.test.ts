/**
 * Tests that lock in the 3 critical Devil's Advocate findings from Phase 4.
 * If any of these tests regress, the demo dies — that's the explicit point.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { verifyCodeSnippet } from "@/lib/nia/client";

const ROOT = path.resolve(__dirname, "..", "..");

async function loadFixture(p: string) {
  return JSON.parse(await fs.readFile(path.join(ROOT, p), "utf-8"));
}

describe("DA #1 — bogus traces are rejected (Cite-Or-Die, no fabrication)", () => {
  it("pickFixture in agent loop does NOT fall back to fixtures[0] for unmatched traces", async () => {
    const src = await fs.readFile(
      path.join(ROOT, "lib/agent/loop.ts"),
      "utf-8"
    );
    // The fix: pickFixture returns `matches[0] ?? null`, NOT
    // `matches[0] ?? fixtures[0] ?? null`. The latter was the bug.
    expect(src).not.toMatch(/matches\[0\]\s*\?\?\s*fixtures\[0\]/);
    // And the function must return null in the unmatched case.
    expect(src).toMatch(/return matches\[0\] \?\? null/);
  });

  it("agent loop emits an error event when no fixture matches", async () => {
    const src = await fs.readFile(
      path.join(ROOT, "lib/agent/loop.ts"),
      "utf-8"
    );
    expect(src).toMatch(/doesn't match any replay fixture/);
    expect(src).toMatch(/await emit\(\{ type: "status", status: "error" \}\)/);
  });
});

describe("DA #2 — every code citation passes the strict cite-or-die verifier", () => {
  // This catches the Trace B `webhooks/stripe.ts:91` and
  // `lib/idempotency.ts:12` fabrications the test suite previously missed.
  // We run the actual verifier (not a stub) against every code snippet
  // in every fixture, in STRICT mode.
  const originalEnv = process.env.STRICT_CITE_OR_DIE;
  process.env.STRICT_CITE_OR_DIE = "1";

  for (const p of [
    "data/replay/trace-a.json",
    "data/replay/trace-b.json",
    "data/replay/nia/33fb18b841fa1b6b.json",
    "data/replay/nia/a08b869370c6cac0.json",
  ]) {
    it(`every code snippet in ${p} verifies against the seed file`, async () => {
      const data = await loadFixture(p);
      const snippets: { file: string; line: number; content: string }[] = [];
      if (Array.isArray(data.snippets)) snippets.push(...data.snippets);
      if (Array.isArray(data.tool_calls)) {
        for (const tc of data.tool_calls) {
          if (tc.tool === "searchCode" && Array.isArray(tc.output?.snippets)) {
            snippets.push(...tc.output.snippets);
          }
        }
      }
      expect(snippets.length).toBeGreaterThan(0);
      for (const s of snippets) {
        const ok = await verifyCodeSnippet(s);
        expect(ok, `${p} → ${s.file}:${s.line} failed cite-or-die`).toBe(true);
      }
    });
  }

  // Restore env after suite.
  process.env.STRICT_CITE_OR_DIE = originalEnv;
});

describe("DA #3 — fromTriageHistory is actually populated (the 🧠 badge fires)", () => {
  it("Trace B's similar_incidents tags reinforced memories", async () => {
    // The agent loop's runReplay enriches similar_incidents based on whether
    // the recalled memory is a triage_history entry or has a mem_reinforce_*
    // id. Verify the wiring exists and the fixture data supports it.
    const src = await fs.readFile(
      path.join(ROOT, "lib/agent/loop.ts"),
      "utf-8"
    );
    expect(src).toMatch(/fromTriageHistory:\s*true/);
    expect(src).toMatch(/mem_reinforce_/);
    expect(src).toMatch(/triage_history/);

    // And: trace-b.json's recall must include at least one memory whose id
    // starts with `mem_reinforce_` OR whose metadata.kind === "triage_history",
    // so the enrichment has something to flip.
    const traceB = await loadFixture("data/replay/trace-b.json");
    const recall = traceB.tool_calls.find(
      (t: { tool: string }) => t.tool === "recallSimilarIncidents"
    );
    expect(recall).toBeTruthy();
    const memories: { id: string; metadata?: { kind?: string } }[] =
      recall.output.memories;
    const hasReinforced = memories.some(
      (m) =>
        m.id.startsWith("mem_reinforce_") ||
        m.metadata?.kind === "triage_history"
    );
    expect(hasReinforced).toBe(true);

    // And: at least one of those reinforced memory_ids appears in
    // similar_incidents so the UI can actually tag it.
    const reinforcedIds = memories
      .filter(
        (m) =>
          m.id.startsWith("mem_reinforce_") ||
          m.metadata?.kind === "triage_history"
      )
      .map((m) => m.id);
    const sIds: string[] = traceB.result.similar_incidents.map(
      (s: { memory_id: string }) => s.memory_id
    );
    const overlap = reinforcedIds.filter((id) => sIds.includes(id));
    expect(
      overlap.length,
      "no reinforced memory_id appears in similar_incidents"
    ).toBeGreaterThan(0);
  });
});
