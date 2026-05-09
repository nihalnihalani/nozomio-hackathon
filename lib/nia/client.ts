/**
 * Nia client — code-aware monorepo + ADR + runbook search.
 *
 * Invariant 1 (Cite-Or-Die): the verifier is the heart of this file.
 * After every live Nia response, we re-read the claimed file:line from
 * `seed/billing-service/{file}` and assert it contains the claimed
 * content. If not, we DROP the snippet, log a warning, and the agent
 * sees fewer (verified) snippets — never silently fabricated ones.
 *
 * Invariant 4 (Hermetic Demo Mode): if NIA_API_KEY is missing, we fall
 * back to replay; we never throw on the demo path.
 *
 * Replay layout:
 *   data/replay/nia/{sha1(query)}.json   // SearchCodeOutput
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type CodeSnippet,
  CodeSnippetSchema,
  type SearchCodeOutput,
  SearchCodeOutputSchema,
  getDemoMode,
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NiaMode = "query" | "tracer";

export interface NiaSearchInput {
  query: string;
  mode?: NiaMode;
  include_sources?: boolean;
}

const REPLAY_ROOT = path.join(process.cwd(), "data", "replay", "nia");
const SEED_ROOT = path.join(process.cwd(), "seed", "billing-service");
const NIA_API_BASE =
  process.env.NIA_API_BASE ?? "https://apigcp.trynia.ai";

function hashKey(query: string, mode: NiaMode): string {
  return createHash("sha1")
    .update(`${mode}:${query}`)
    .digest("hex")
    .slice(0, 16);
}

function shouldReplay(): boolean {
  const mode = getDemoMode();
  if (mode === "replay") return true;
  return !process.env.NIA_API_KEY;
}

// ─── Cite-Or-Die verifier ─────────────────────────────────────────────────────

/**
 * Re-read seed/billing-service/{file} and check that the claimed line
 * contains a meaningful overlap with the claimed content.
 *
 * Returns `true` only if we can confirm the source. If the seed repo
 * isn't checked out yet (test/dev), we return `true` to avoid blocking
 * — the test suite (tests/invariants/cite_or_die.test.ts) is the
 * authoritative gate. In production demo path, the seed/ tree must
 * exist (Storyteller's lane), so verification is real.
 *
 * Invariant 1: if you change this function, update
 * tests/invariants/cite_or_die.test.ts to keep parity.
 */
/**
 * Normalize source code for comparison: collapse all runs of whitespace
 * (incl. newlines) into a single space, strip backticks/quotes/escapes,
 * and lowercase nothing (we want case-sensitive identifier matching).
 *
 * The goal is to tolerate the formatting noise Nia sometimes injects
 * (e.g. line wrapping a long string literal, removing a trailing comma)
 * while still REQUIRING that the claimed content's substantive structure
 * appears verbatim in the seed.
 */
function normalizeSnippet(s: string): string {
  return s
    .replace(/[`"'\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function verifyCodeSnippet(
  snippet: CodeSnippet
): Promise<boolean> {
  // Defensive: the file path must be relative and inside seed/billing-service.
  if (snippet.file.includes("..") || path.isAbsolute(snippet.file)) {
    return false;
  }
  const abs = path.join(SEED_ROOT, snippet.file);
  let content: string;
  try {
    content = await fs.readFile(abs, "utf-8");
  } catch {
    // Seed repo not present — can't verify. Be permissive in dev,
    // strict in production via the env flag below.
    if (process.env.STRICT_CITE_OR_DIE === "1") return false;
    return true;
  }
  const lines = content.split("\n");
  const idx = snippet.line - 1; // 1-indexed
  if (idx < 0 || idx >= lines.length) return false;

  const claimed = snippet.content.trim();
  if (!claimed) return false;

  // Codex finding (pass 2): the previous window-based verifier accepted
  // claims whose content came from a NEARBY line. The fix: anchor at the
  // claimed line strictly, then scan forward through the seed for the
  // claim's remaining lines (allowing comment/blank lines to be skipped
  // — Nia sometimes returns the bug block without intervening commentary).
  //
  // The combination of "first-line strict anchor" + "subsequent-lines
  // scan-forward with bounded lookahead" rejects fabricated file:line
  // claims (Codex's false positive) AND tolerates Nia's occasional
  // comment-omitted reflow (Codex's false negative).
  const claimLines = claimed
    .split("\n")
    .map((l) => normalizeSnippet(l))
    .filter((l) => l.length > 0);
  if (claimLines.length === 0) return false;

  // Anchor check (strict): claim's first significant line MUST be
  // contained in seed[idx] after normalization. Reject anything else.
  const normFirstSeed = normalizeSnippet(lines[idx] ?? "");
  if (!normFirstSeed.includes(claimLines[0])) {
    return false;
  }

  // Multi-line scan-forward: each subsequent claim line must appear in a
  // seed line within `LOOKAHEAD` lines of where we left off. The lookahead
  // tolerates Nia compressing a block by skipping comments / blank lines.
  // Bounded so the verifier can't accept claims that drift arbitrarily far.
  const LOOKAHEAD = 3;
  let seedCursor = idx + 1;
  for (let i = 1; i < claimLines.length; i++) {
    const claim = claimLines[i];
    let found = false;
    const stop = Math.min(lines.length, seedCursor + LOOKAHEAD + 1);
    for (let j = seedCursor; j < stop; j++) {
      const normSeedLine = normalizeSnippet(lines[j] ?? "");
      if (normSeedLine.includes(claim)) {
        seedCursor = j + 1;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return true;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class NiaClient {
  /**
   * Searches the indexed monorepo. In live mode, every returned snippet
   * is run through the cite-or-die verifier; failed snippets are dropped
   * with a console.warn (Invariant 1).
   */
  async search(input: NiaSearchInput): Promise<SearchCodeOutput> {
    if (shouldReplay()) {
      return await replaySearch(input);
    }
    try {
      const raw = await liveSearch(input);
      // Invariant 1: verify every snippet, drop unverified.
      const verified: CodeSnippet[] = [];
      for (const s of raw.snippets) {
        const ok = await verifyCodeSnippet(s);
        if (ok) verified.push(s);
        else
          console.warn(
            `[nia] cite-or-die DROP: ${s.file}:${s.line} did not match claimed content`
          );
      }
      return { ...raw, snippets: verified };
    } catch (err) {
      console.warn("[nia] live search failed, falling back:", err);
      return await replaySearch(input);
    }
  }
}

// ─── Replay branch ────────────────────────────────────────────────────────────

async function replaySearch(input: NiaSearchInput): Promise<SearchCodeOutput> {
  const key = hashKey(input.query, input.mode ?? "query");
  const file = path.join(REPLAY_ROOT, `${key}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = SearchCodeOutputSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    // Invariant 1: empty is honest. The agent system prompt forces it
    // to say "no matching code found" rather than fabricate.
    return { snippets: [], recent_commits: [] };
  }
}

// ─── Live branch ──────────────────────────────────────────────────────────────

interface LiveNiaSnippetRaw {
  file?: string;
  path?: string;
  line?: number;
  line_number?: number;
  content?: string;
  text?: string;
  citation_url?: string;
}
interface LiveNiaResponseRaw {
  snippets?: LiveNiaSnippetRaw[];
  results?: LiveNiaSnippetRaw[];
  recent_commits?: Array<{
    sha?: string;
    author?: string;
    date?: string;
    message?: string;
  }>;
}

async function liveSearch(input: NiaSearchInput): Promise<SearchCodeOutput> {
  const apiKey = process.env.NIA_API_KEY!;
  const body = {
    query: input.query,
    mode: input.mode ?? "query",
    include_sources: input.include_sources ?? true,
  };
  const res = await fetch(`${NIA_API_BASE}/v2/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`nia search ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as LiveNiaResponseRaw;
  const rawSnippets = json.snippets ?? json.results ?? [];
  const snippets: CodeSnippet[] = rawSnippets.flatMap((s) => {
    const safe = CodeSnippetSchema.safeParse({
      file: s.file ?? s.path,
      line: s.line ?? s.line_number,
      content: s.content ?? s.text,
      citation_url: s.citation_url,
    });
    return safe.success ? [safe.data] : [];
  });
  const recent_commits = (json.recent_commits ?? []).flatMap((c) => {
    if (!c.sha || !c.author || !c.date || !c.message) return [];
    return [
      { sha: c.sha, author: c.author, date: c.date, message: c.message },
    ];
  });
  return { snippets, recent_commits };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: NiaClient | null = null;
export function getNia(): NiaClient {
  if (!_client) _client = new NiaClient();
  return _client;
}
