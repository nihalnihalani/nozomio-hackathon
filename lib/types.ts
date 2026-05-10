/**
 * Core types shared between agent runtime, frontend, and tests.
 * Source of truth for the cite-or-die contract (Invariant 1).
 */

import { z } from "zod";

// ─── Sources ──────────────────────────────────────────────────────────────────

export const SourceTypeSchema = z.enum(["slack", "notion", "gmail", "google_drive", "code"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

// ─── Citation ─────────────────────────────────────────────────────────────────

export const CitationSchema = z.object({
  source: SourceTypeSchema,
  /** Hyperspell memory_id for slack/notion/gmail; "file:line" for code */
  source_id: z.string(),
  /** ≤500 chars; what the source actually says */
  excerpt: z.string(),
  /** Optional metadata: channel, author, ts for slack; thread_id, etc */
  metadata: z.record(z.unknown()).optional(),
  /**
   * Cite-or-die: did the verifier confirm the source actually contains
   * the claimed content? Always true for Hyperspell (we trust the recall);
   * for code, the searchCode tool re-reads file:line and asserts.
   */
  verified: z.boolean(),
});
export type Citation = z.infer<typeof CitationSchema>;

// ─── Memory (Hyperspell) ──────────────────────────────────────────────────────

export const MemorySchema = z.object({
  id: z.string(),
  text: z.string(),
  source: SourceTypeSchema,
  metadata: z.record(z.unknown()).optional(),
  score: z.number().optional(),
});
export type Memory = z.infer<typeof MemorySchema>;

// ─── Code snippet (Nia) ───────────────────────────────────────────────────────

export const CodeSnippetSchema = z.object({
  file: z.string(),
  line: z.number(),
  content: z.string(),
  citation_url: z.string().optional(),
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const CodeCommitSchema = z.object({
  sha: z.string(),
  author: z.string(),
  date: z.string(),
  message: z.string(),
});
export type CodeCommit = z.infer<typeof CodeCommitSchema>;

// ─── Tool I/O ─────────────────────────────────────────────────────────────────

export const RecallInputSchema = z.object({
  signature: z.string().min(1).describe("Search query / error signature"),
});
export type RecallInput = z.infer<typeof RecallInputSchema>;

export const RecallOutputSchema = z.object({
  memories: z.array(MemorySchema),
  error: z.string().optional(),
});
export type RecallOutput = z.infer<typeof RecallOutputSchema>;

export const SearchCodeInputSchema = z.object({
  query: z.string().min(1).describe("Code-search query"),
});
export type SearchCodeInput = z.infer<typeof SearchCodeInputSchema>;

export const SearchCodeOutputSchema = z.object({
  snippets: z.array(CodeSnippetSchema),
  recent_commits: z.array(CodeCommitSchema),
  error: z.string().optional(),
});
export type SearchCodeOutput = z.infer<typeof SearchCodeOutputSchema>;

// ─── Triage result (final structured output) ─────────────────────────────────

export const TimelineEventSchema = z.object({
  at: z.string(),
  event: z.string(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// Citations in the parsed-from-LLM TriageResult come back as bare
// source_id strings OR full Citation objects (the agent prompt asks for
// strings; older fixtures may have objects). `TriageResultRawSchema`
// accepts either; `runLive` then hydrates strings into Citation objects
// using the seen-citations map populated by tool calls. Downstream code
// (UI, mirror, tests) consumes the strict `TriageResultSchema` shape
// where citations are always Citation objects.
const CitationOrIdSchema = z.union([z.string(), CitationSchema]);

export const TriageResultRawSchema = z.object({
  timeline: z.array(TimelineEventSchema),
  root_cause: z.object({
    text: z.string(),
    citations: z.array(CitationOrIdSchema),
  }),
  suspected_fix: z.optional(
    z.object({
      file: z.string(),
      line: z.number(),
      diff: z.string(),
      citations: z.array(CitationOrIdSchema),
    })
  ),
  similar_incidents: z.array(
    z.object({
      memory_id: z.string(),
      summary: z.string(),
      relevance: z.number(),
      fromTriageHistory: z.boolean().optional(),
    })
  ),
});
export type TriageResultRaw = z.infer<typeof TriageResultRawSchema>;

export const TriageResultSchema = z.object({
  timeline: z.array(TimelineEventSchema),
  root_cause: z.object({
    text: z.string(),
    citations: z.array(CitationSchema),
  }),
  suspected_fix: z.optional(z.object({
    file: z.string(),
    line: z.number(),
    diff: z.string(),
    citations: z.array(CitationSchema),
  })),
  similar_incidents: z.array(
    z.object({
      memory_id: z.string(),
      summary: z.string(),
      relevance: z.number(),
      /**
       * True if this incident's memory came from a prior triage's reinforcement
       * step (Invariant 2). The frontend renders a 🧠 badge for these.
       * Set by `lib/agent/loop.ts` based on memory metadata.
       */
      fromTriageHistory: z.boolean().optional(),
    })
  ),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

// ─── Runtime mode ─────────────────────────────────────────────────────────────

export const DemoModeSchema = z.enum(["live", "replay", "hybrid"]);
export type DemoMode = z.infer<typeof DemoModeSchema>;

export function getDemoMode(): DemoMode {
  const raw = process.env.DEMO_MODE ?? "live";
  const parsed = DemoModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "live";
}

export function allowsReplayFallback(): boolean {
  return getDemoMode() === "hybrid";
}
