/**
 * Hyperspell client — multi-source memory layer (Slack / Notion / Gmail).
 *
 * Invariant 4 (Hermetic Demo Mode): every outbound call has an explicit
 * replay branch. Production `live` mode fails closed when credentials or
 * live calls are broken; only `replay` and `hybrid` may use fixtures.
 *
 * Replay layout:
 *   data/replay/hyperspell/{sha1(query)}.json     // for memories.search
 *   data/replay/hyperspell/_writes.log            // for memories.add (append-only)
 *
 * Invariant 2 (Reinforcement): every `triage_history` write MUST come
 * from `convex/reinforce.ts`. Other call-sites that write `triage_history`
 * memories are a hard reject in code review.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  type Memory,
  MemorySchema,
  type SourceType,
  getDemoMode,
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddMemoryInput {
  text: string;
  source: SourceType | "triage_history";
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  /**
   * Per-source weighting hint. **Replay-mode only** post-2026-05-09 fix: the
   * live Hyperspell `/memories/query` endpoint does not accept a
   * `source_weights` parameter, so this value is silently ignored on the
   * wire. It is still mixed into `hashKey()` for replay-fixture lookup
   * determinism, so callers may pass it without breaking replay.
   */
  source_weights?: Partial<Record<SourceType | "triage_history", number>>;
  limit?: number;
}

export interface SearchInput {
  query: string;
  options?: SearchOptions;
}

export interface SearchResult {
  memories: Memory[];
}

const DEFAULT_SOURCE_WEIGHTS: NonNullable<SearchOptions["source_weights"]> = {
  slack: 0.5,
  notion: 0.4,
  gmail: 0.1,
  google_drive: 0.1,
};

const REPLAY_ROOT = path.join(process.cwd(), "data", "replay", "hyperspell");
const HYPERSPELL_API_BASE =
  process.env.HYPERSPELL_API_BASE ?? "https://api.hyperspell.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashKey(query: string, options?: SearchOptions): string {
  const stable = JSON.stringify({
    q: query,
    w: options?.source_weights ?? DEFAULT_SOURCE_WEIGHTS,
    l: options?.limit ?? 5,
  });
  return createHash("sha1").update(stable).digest("hex").slice(0, 16);
}

function replayId(input: AddMemoryInput): string {
  return `mem_replay_${createHash("sha1")
    .update(input.text)
    .digest("hex")
    .slice(0, 8)}`;
}

function shouldReplay(): boolean {
  return getDemoMode() === "replay";
}

function shouldFallbackToReplay(): boolean {
  return getDemoMode() === "hybrid";
}

function requireApiKey(): string {
  const apiKey = process.env.HYPERSPELL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HYPERSPELL_API_KEY is required in live mode. Set DEMO_MODE=replay for fixture playback or DEMO_MODE=hybrid for live-with-replay-fallback."
    );
  }
  return apiKey;
}

const ReplaySearchPayloadSchema = z.object({
  memories: z.array(MemorySchema),
});

// ─── Client ───────────────────────────────────────────────────────────────────

export class HyperspellClient {
  readonly memories = {
    add: async (input: AddMemoryInput): Promise<{ id: string }> => {
      // Invariant 2: this method is only invoked from convex/reinforce.ts
      // (for `source: 'triage_history'`) and from scripts/ingest.ts (for
      // pre-loading slack/notion/gmail seed data). The frontend NEVER
      // calls this — Codex flags any other call site.
      if (shouldReplay()) {
        await appendReplayWrite(input);
        // Deterministic synthetic id so reinforcement tests can assert on it.
        return { id: replayId(input) };
      }
      let apiKey: string;
      try {
        apiKey = requireApiKey();
      } catch (err) {
        if (!shouldFallbackToReplay()) throw err;
        await appendReplayWrite(input);
        return { id: replayId(input) };
      }
      return await liveAdd(input, apiKey);
    },

    search: async (input: SearchInput): Promise<SearchResult> => {
      if (shouldReplay()) {
        return await replaySearch(input);
      }
      let apiKey: string;
      try {
        apiKey = requireApiKey();
      } catch (err) {
        if (!shouldFallbackToReplay()) throw err;
        console.warn("[hyperspell] missing live key, falling back to replay:", err);
        return await replaySearch(input);
      }
      try {
        return await liveSearch(input, apiKey);
      } catch (err) {
        if (!shouldFallbackToReplay()) throw err;
        console.warn("[hyperspell] live search failed, falling back to replay:", err);
        return await replaySearch(input);
      }
    },
  };
}

// ─── Replay branches ──────────────────────────────────────────────────────────

async function replaySearch(input: SearchInput): Promise<SearchResult> {
  const key = hashKey(input.query, input.options);
  const file = path.join(REPLAY_ROOT, `${key}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = ReplaySearchPayloadSchema.parse(JSON.parse(raw));
    return { memories: parsed.memories };
  } catch {
    // No fixture yet — return empty rather than throwing. Invariant 4:
    // empty is honest; fabricating memories would violate Invariant 1.
    return { memories: [] };
  }
}

async function appendReplayWrite(input: AddMemoryInput): Promise<void> {
  try {
    await fs.mkdir(REPLAY_ROOT, { recursive: true });
    const log = path.join(REPLAY_ROOT, "_writes.log");
    const line = `${JSON.stringify({ at: Date.now(), ...input })}\n`;
    await fs.appendFile(log, line, "utf-8");
  } catch {
    // Replay-mode writes are best-effort — never fail the agent loop.
  }
}

// ─── Live branches ────────────────────────────────────────────────────────────

// Live response shape per docs.hyperspell.com/api-reference/memories/query-memories.
// `documents` array carries metadata only — text content is NOT returned by the
// query endpoint (would require a follow-up `Get Memory` call to hydrate).
// We surface `title` as the excerpt fallback when no text is available; the
// demo path is replay so this only matters for live-mode introspection.
interface LiveSearchResponseRaw {
  query_id?: string | null;
  documents?: Array<{
    source?: string;
    resource_id?: string;
    title?: string | null;
    metadata?: Record<string, unknown>;
    score?: number | null;
    folder_id?: string | null;
    parent_folder_id?: string | null;
  }>;
  answer?: string | null;
  errors?: unknown;
}

async function liveSearch(
  input: SearchInput,
  apiKey: string
): Promise<SearchResult> {
  // Real endpoint: POST /memories/query (no /v1 prefix; no `source_weights`,
  // no top-level `limit` — use options.max_results). Per-source weighting
  // is not exposed via this surface; we keep the in-memory weighting on the
  // replay-fixture hash only.
  const body: Record<string, unknown> = {
    query: input.query,
    options: {
      max_results: input.options?.limit ?? 5,
    },
  };
  const res = await fetch(`${HYPERSPELL_API_BASE}/memories/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`hyperspell query ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as LiveSearchResponseRaw;
  // Surface partial-failure errors from the API. Hyperspell can return a
  // 200 response with `errors: [{error, message}]` (e.g., NoResultsForSource
  // when querying an unconnected provider). We log so the demo team can
  // debug "why are documents empty" without rerunning under DEBUG=*.
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    console.warn("[hyperspell] query returned partial errors:", json.errors);
  }
  const memories: Memory[] = (json.documents ?? []).flatMap((d) => {
    const id = d.resource_id;
    // Round-trip safety: `liveAdd` writes our logical source (slack/notion/
    // gmail/triage_history) into `metadata.source` because the public API has
    // no top-level `source` parameter on add. The query endpoint returns a
    // top-level `source` (Hyperspell's connector identity, e.g. "vault" for
    // direct adds, "slack" for OAuth-connected Slack). Prefer metadata.source
    // when present so memories ingested via this client come back classified
    // the way the agent expects; fall back to top-level for connector data.
    const metaSource =
      typeof d.metadata?.source === "string"
        ? (d.metadata.source as SourceType)
        : undefined;
    const sourceRaw = d.source === "google_mail" ? "gmail" : d.source;
    const source = metaSource ?? (sourceRaw as SourceType | undefined);
    // The query endpoint does not return text; surface `title` as the
    // excerpt fallback. If neither is present, drop the result rather
    // than fabricate (Invariant 1 — Cite-or-Die).
    const text = d.title ?? "";
    if (!id || !source || !text) return [];
    const safe = MemorySchema.safeParse({
      id,
      text,
      source,
      metadata: d.metadata,
      score: d.score ?? undefined,
    });
    return safe.success ? [safe.data] : [];
  });
  return { memories };
}

// Live response shape per docs.hyperspell.com/api-reference/memories/add-a-memory.
interface LiveAddResponseRaw {
  source?: string;
  resource_id?: string;
  status?: string;
}

async function liveAdd(
  input: AddMemoryInput,
  apiKey: string
): Promise<{ id: string }> {
  // Real endpoint: POST /memories/add. Body fields: text, resource_id?,
  // title?, date?, metadata?. There is no top-level `source` field — we
  // encode it in `metadata.source` so callers (reinforce, ingest) can
  // still distinguish slack/notion/gmail/triage_history downstream.
  const body = {
    text: input.text,
    metadata: {
      ...(input.metadata ?? {}),
      source: input.source,
    },
  };
  const res = await fetch(`${HYPERSPELL_API_BASE}/memories/add`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`hyperspell add ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as LiveAddResponseRaw;
  const id = json.resource_id;
  if (!id) throw new Error("hyperspell add: response missing resource_id");
  return { id };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: HyperspellClient | null = null;
export function getHyperspell(): HyperspellClient {
  if (!_client) _client = new HyperspellClient();
  return _client;
}

export const SOURCE_WEIGHTS = DEFAULT_SOURCE_WEIGHTS;
