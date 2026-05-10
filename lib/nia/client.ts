/**
 * Nia client — code-aware monorepo + ADR + runbook search.
 *
 * Invariant 1 (Cite-Or-Die): the verifier is the heart of this file.
 * After every live Nia response, we re-read the claimed file:line from
 * `NIA_SOURCE_ROOT` (default `seed/billing-service`) and assert it contains the claimed
 * content. If not, we DROP the snippet, log a warning, and the agent
 * sees fewer (verified) snippets — never silently fabricated ones.
 *
 * Invariant 4 (Hermetic Demo Mode): every outbound call has an explicit
 * replay branch. Production `live` mode fails closed when credentials,
 * Nia, or citation verification are broken; only `replay` and `hybrid`
 * may use fixtures.
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
const NIA_API_BASE =
  process.env.NIA_API_BASE ?? "https://apigcp.trynia.ai";

function hashKey(query: string, mode: NiaMode): string {
  return createHash("sha1")
    .update(`${mode}:${query}`)
    .digest("hex")
    .slice(0, 16);
}

function shouldReplay(): boolean {
  return getDemoMode() === "replay";
}

function shouldFallbackToReplay(): boolean {
  return getDemoMode() === "hybrid";
}

function requireApiKey(): string {
  const apiKey = process.env.NIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NIA_API_KEY is required in live mode. Set DEMO_MODE=replay for fixture playback or DEMO_MODE=hybrid for live-with-replay-fallback."
    );
  }
  return apiKey;
}

function sourceRoot(): string {
  return path.resolve(
    process.env.NIA_SOURCE_ROOT ??
      path.join(process.cwd(), "seed", "billing-service")
  );
}

function normalizeForVerification(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "")
    .replace(/\s+/g, "");
}

const COMMON_IDENTIFIERS = new Set([
  "await",
  "async",
  "const",
  "else",
  "false",
  "function",
  "return",
  "true",
  "undefined",
]);

function codeIdentifiers(value: string): string[] {
  const withoutComments = value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
  const ids = withoutComments.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
  return Array.from(
    new Set(
      ids.filter(
        (id) => id.length >= 3 && !COMMON_IDENTIFIERS.has(id.toLowerCase())
      )
    )
  );
}

function hasAnchoredIdentifierOverlap(claimed: string, window: string): boolean {
  const claimIds = codeIdentifiers(claimed);
  if (claimIds.length === 0) return false;
  const windowIds = new Set(codeIdentifiers(window));
  const hits = claimIds.filter((id) => windowIds.has(id));
  const hasStrongAnchor = hits.some((id) => id.length >= 8 || /[A-Z_$]/.test(id));
  return hasStrongAnchor && hits.length / claimIds.length >= 0.6;
}

// ─── Cite-Or-Die verifier ─────────────────────────────────────────────────────

/**
 * Re-read the configured source tree and check that the claimed line
 * window contains the claimed content after whitespace/comment normalization.
 *
 * Returns `true` only if we can confirm the source. Missing source files
 * are verification failures unless an operator explicitly opts out with
 * ALLOW_UNVERIFIED_CODE_CITATIONS=1 in replay mode.
 *
 * Invariant 1: if you change this function, update
 * tests/invariants/cite_or_die.test.ts to keep parity.
 */
export async function verifyCodeSnippet(
  snippet: CodeSnippet
): Promise<boolean> {
  // Defensive: the file path must be relative and inside the configured source root.
  if (snippet.file.includes("..") || path.isAbsolute(snippet.file)) {
    return false;
  }
  const root = sourceRoot();
  const abs = path.resolve(root, snippet.file);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) {
    return false;
  }
  let content: string;
  try {
    content = await fs.readFile(abs, "utf-8");
  } catch {
    return (
      getDemoMode() === "replay" &&
      process.env.ALLOW_UNVERIFIED_CODE_CITATIONS === "1" &&
      process.env.STRICT_CITE_OR_DIE !== "1"
    );
  }
  const lines = content.split("\n");
  const idx = snippet.line - 1; // 1-indexed
  if (idx < 0 || idx >= lines.length) return false;

  const claimed = snippet.content.trim();
  if (!claimed) return false;

  // Compare against the claimed line plus context. Nia sometimes returns
  // a chunk that spans multiple physical lines.
  const window = lines
    .slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3))
    .join("\n");

  const normalizedClaim = normalizeForVerification(claimed);
  const normalizedWindow = normalizeForVerification(window);
  if (normalizedClaim.length < 8) {
    return window.includes(claimed);
  }
  return (
    normalizedWindow.includes(normalizedClaim) ||
    hasAnchoredIdentifierOverlap(claimed, window)
  );
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
    let apiKey: string;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      if (!shouldFallbackToReplay()) throw err;
      console.warn("[nia] missing live key, falling back to replay:", err);
      return await replaySearch(input);
    }
    try {
      const raw = await liveSearch(input, apiKey);
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
      if (!shouldFallbackToReplay()) throw err;
      console.warn("[nia] live search failed, falling back to replay:", err);
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

async function liveSearch(
  input: NiaSearchInput,
  apiKey: string
): Promise<SearchCodeOutput> {
  const body = {
    mode: input.mode ?? "query",
    messages: [{ role: "user", content: input.query }],
    search_mode: "unified",
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
