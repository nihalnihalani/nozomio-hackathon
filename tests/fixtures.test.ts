/**
 * Replay-fixture round-trip sanity (Hard Rule #2).
 *
 * Every replay fixture in data/replay/ must parse cleanly through the
 * Zod schemas in lib/types.ts. If any fixture drifts from the contract,
 * this test fails LOUDLY before the agent loop or invariant tests do.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  RecallOutputSchema,
  SearchCodeOutputSchema,
  TriageResultSchema,
} from "@/lib/types";

const REPLAY_ROOT = path.join(process.cwd(), "data", "replay");

// ─── Compound trace fixture schema (matches the Backend Engineer's loop) ─────

const TraceFixtureSchema = z.object({
  input_trace_pattern: z.string().min(1),
  tool_calls: z
    .array(
      z.discriminatedUnion("tool", [
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
    )
    .min(1),
  result: TriageResultSchema,
});

async function readJson<T>(rel: string): Promise<T> {
  const raw = await fs.readFile(path.join(REPLAY_ROOT, rel), "utf-8");
  return JSON.parse(raw) as T;
}

describe("replay fixtures: round-trip through Zod", () => {
  it("data/replay/trace-a.json parses against TraceFixtureSchema", async () => {
    const raw = await readJson<unknown>("trace-a.json");
    const parsed = TraceFixtureSchema.parse(raw);
    expect(parsed.tool_calls.length).toBe(2);
    expect(parsed.tool_calls[0].tool).toBe("recallSimilarIncidents");
    expect(parsed.tool_calls[1].tool).toBe("searchCode");
    expect(parsed.result.root_cause.citations.length).toBeGreaterThan(0);
  });

  it("data/replay/trace-b.json parses against TraceFixtureSchema", async () => {
    const raw = await readJson<unknown>("trace-b.json");
    const parsed = TraceFixtureSchema.parse(raw);
    expect(parsed.tool_calls.length).toBe(2);
    expect(parsed.result.root_cause.citations.length).toBeGreaterThan(0);
    expect(parsed.result.similar_incidents.length).toBeGreaterThan(0);
  });

  it("Trace B has STRICTLY faster tool latencies than Trace A (the 'agent gets faster' falsifiable claim)", async () => {
    const a = TraceFixtureSchema.parse(await readJson<unknown>("trace-a.json"));
    const b = TraceFixtureSchema.parse(await readJson<unknown>("trace-b.json"));
    const totalA = a.tool_calls.reduce((s, c) => s + c.delay_ms, 0);
    const totalB = b.tool_calls.reduce((s, c) => s + c.delay_ms, 0);
    expect(totalB).toBeLessThan(totalA);
  });

  it("hyperspell per-query fixtures parse against RecallOutputSchema", async () => {
    const dir = path.join(REPLAY_ROOT, "hyperspell");
    const files = (await fs.readdir(dir)).filter(
      (f) =>
        f.endsWith(".json") &&
        f !== "index.json" &&
        // Exclude generated artifacts (logs, markers) — they're not fixtures.
        !f.startsWith("_") &&
        !f.startsWith(".")
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8"));
      // Fixture files include `_query` / `_note` doc keys; the loader
      // ignores them. Pick out only the schema-relevant slice.
      const parsed = RecallOutputSchema.parse({ memories: raw.memories });
      expect(parsed.memories.length).toBeGreaterThan(0);
    }
  });

  it("nia per-query fixtures parse against SearchCodeOutputSchema", async () => {
    const dir = path.join(REPLAY_ROOT, "nia");
    const files = (await fs.readdir(dir)).filter(
      (f) =>
        f.endsWith(".json") &&
        f !== "index.json" &&
        !f.startsWith("_") &&
        !f.startsWith(".")
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8"));
      const parsed = SearchCodeOutputSchema.parse({
        snippets: raw.snippets,
        recent_commits: raw.recent_commits,
      });
      expect(parsed.snippets.length).toBeGreaterThan(0);
    }
  });
});
