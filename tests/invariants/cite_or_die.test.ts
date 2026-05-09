/**
 * Invariant 1 — Cite-Or-Die.
 *
 * Every claim in a TriageResult must cite a real source. This test
 * exercises the contract on the replay fixtures (the source of truth
 * for DEMO_MODE=replay).
 *
 *   - Every memory in a recall output has source_id (id) + non-empty text
 *   - Every code snippet has file + line
 *   - Every citation in result has non-empty source_id, non-empty excerpt,
 *     and a boolean `verified` field
 *   - Specific tokens that should be cited (file paths, line numbers,
 *     and dates that appear in claims) actually appear in the citation
 *     set for that claim
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  TriageResultSchema,
  RecallOutputSchema,
  SearchCodeOutputSchema,
  type Citation,
  type TriageResult,
} from "@/lib/types";

const REPLAY_ROOT = path.join(process.cwd(), "data", "replay");

interface ToolCallA {
  tool: "recallSimilarIncidents";
  output: { memories: Array<{ id: string; text: string }> };
}
interface ToolCallB {
  tool: "searchCode";
  output: { snippets: Array<{ file: string; line: number }> };
}
interface TraceFixture {
  input_trace_pattern: string;
  tool_calls: Array<ToolCallA | ToolCallB>;
  result: TriageResult;
}

async function readFixture(name: string): Promise<TraceFixture> {
  const raw = await fs.readFile(path.join(REPLAY_ROOT, name), "utf-8");
  return JSON.parse(raw) as TraceFixture;
}

function allCitations(result: TriageResult): Citation[] {
  return [...result.root_cause.citations, ...result.suspected_fix.citations];
}

describe("Invariant 1 — Cite-Or-Die", () => {
  it.each(["trace-a.json", "trace-b.json"])(
    "%s: every recall memory has a non-empty id + text",
    async (fixture) => {
      const t = await readFixture(fixture);
      const recall = t.tool_calls.find(
        (c) => c.tool === "recallSimilarIncidents"
      );
      expect(recall).toBeDefined();
      const parsed = RecallOutputSchema.parse(recall!.output);
      for (const m of parsed.memories) {
        expect(m.id.length).toBeGreaterThan(0);
        expect(m.text.length).toBeGreaterThan(0);
      }
    }
  );

  it.each(["trace-a.json", "trace-b.json"])(
    "%s: every code snippet has file + line",
    async (fixture) => {
      const t = await readFixture(fixture);
      const code = t.tool_calls.find((c) => c.tool === "searchCode");
      expect(code).toBeDefined();
      const parsed = SearchCodeOutputSchema.parse(code!.output);
      for (const s of parsed.snippets) {
        expect(s.file.length).toBeGreaterThan(0);
        expect(Number.isInteger(s.line)).toBe(true);
        expect(s.line).toBeGreaterThan(0);
      }
    }
  );

  it.each(["trace-a.json", "trace-b.json"])(
    "%s: every citation has source_id, excerpt, verified:boolean",
    async (fixture) => {
      const t = await readFixture(fixture);
      // re-parse via the schema to lock the contract
      TriageResultSchema.parse(t.result);
      for (const c of allCitations(t.result)) {
        expect(c.source_id.length).toBeGreaterThan(0);
        expect(c.excerpt.length).toBeGreaterThan(0);
        expect(typeof c.verified).toBe("boolean");
      }
      for (const s of t.result.similar_incidents) {
        expect(s.memory_id.length).toBeGreaterThan(0);
        expect(s.summary.length).toBeGreaterThan(0);
      }
    }
  );

  it.each(["trace-a.json", "trace-b.json"])(
    "%s: claim-mentioned file paths appear among root_cause/suspected_fix citations",
    async (fixture) => {
      const t = await readFixture(fixture);
      const claimText = t.result.root_cause.text;
      // any token of the form `path/to/file.ext` mentioned in the claim
      // must show up as a `source_id` (or as the suspected_fix.file).
      const filePathRegex = /[\w./-]+\.(?:ts|md)/g;
      const mentioned = claimText.match(filePathRegex) ?? [];
      const cited = new Set<string>();
      for (const c of allCitations(t.result)) cited.add(c.source_id);
      cited.add(`${t.result.suspected_fix.file}:${t.result.suspected_fix.line}`);
      cited.add(t.result.suspected_fix.file);

      for (const file of mentioned) {
        const someCitationMatches = [...cited].some((id) =>
          id.startsWith(file)
        );
        expect(
          someCitationMatches,
          `claim mentions ${file} but no citation source_id starts with it`
        ).toBe(true);
      }
    }
  );

  it.each(["trace-a.json", "trace-b.json"])(
    "%s: claim-mentioned line numbers map to a code-source citation",
    async (fixture) => {
      const t = await readFixture(fixture);
      const claimText = t.result.root_cause.text;
      // numbers explicitly tagged "line N" or "stripe.ts:N"
      const lineRefs = [
        ...claimText.matchAll(/(?:line\s+|:)(\d{2,5})\b/gi),
      ].map((m) => Number(m[1]));
      if (lineRefs.length === 0) return; // no specific line claimed -> nothing to verify

      const codeCitations = allCitations(t.result).filter(
        (c) => c.source === "code"
      );
      for (const ln of lineRefs) {
        const found = codeCitations.some((c) => c.source_id.endsWith(`:${ln}`));
        expect(
          found,
          `claim mentions line ${ln} but no code citation has :${ln} suffix`
        ).toBe(true);
      }
    }
  );
});
