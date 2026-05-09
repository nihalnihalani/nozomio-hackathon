/**
 * Hyperspell client — multi-source memory layer (Slack / Notion / Gmail).
 *
 * Invariant 4 (Hermetic Demo Mode): every outbound call has a replay
 * branch. If HYPERSPELL_API_KEY is missing, `live` mode silently falls
 * back to `replay`, never throws — the demo must run with no keys.
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

/** True when we cannot or should not make a real Hyperspell call. */
function shouldReplay(): boolean {
  const mode = getDemoMode();
  if (mode === "replay") return true;
  // Live/hybrid still require a key. No key ⇒ silently downgrade to replay.
  return !process.env.HYPERSPELL_API_KEY;
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
        const id = `mem_replay_${createHash("sha1")
          .update(input.text)
          .digest("hex")
          .slice(0, 8)}`;
        return { id };
      }
      return await liveAdd(input);
    },

    search: async (input: SearchInput): Promise<SearchResult> => {
      if (shouldReplay()) {
        return await replaySearch(input);
      }
      try {
        return await liveSearch(input);
      } catch (err) {
        // Invariant 4: never let a live failure bubble up on the demo path.
        // Fall back to replay so the trace UI still renders something.
        console.warn("[hyperspell] live search failed, falling back:", err);
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

interface LiveSearchResponseRaw {
  documents?: Array<{
    source?: string;
    resource_id?: string;
    title?: string | null;
    metadata?: Record<string, unknown>;
    memories?: string[];
    score?: number;
  }>;
  results?: Array<{
    id?: string;
    memory_id?: string;
    text?: string;
    content?: string;
    source?: string;
    metadata?: Record<string, unknown>;
    score?: number;
  }>;
}

function hyperspellHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.HYPERSPELL_API_KEY!}`,
  };
  const asUser = process.env.HYPERSPELL_AS_USER ??
    (process.env.HYPERSPELL_ACCOUNT_EMAIL
      ? `sandbox:${process.env.HYPERSPELL_ACCOUNT_EMAIL}`
      : undefined);
  if (asUser) headers["X-As-User"] = asUser;
  return headers;
}

function normalizeSource(source: string | undefined): SourceType | undefined {
  if (source === "google_mail") return "gmail";
  if (source === "slack" || source === "notion" || source === "gmail") {
    return source;
  }
  return undefined;
}

async function liveSearch(input: SearchInput): Promise<SearchResult> {
  const body = {
    query: input.query,
    answer: false,
    effort: "minimal",
    max_results: input.options?.limit ?? 5,
  };
  const res = await fetch(`${HYPERSPELL_API_BASE}/memories/query`, {
    method: "POST",
    headers: hyperspellHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`hyperspell search ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as LiveSearchResponseRaw;
  const documentMemories: Memory[] = (json.documents ?? []).flatMap((r) => {
    const source = normalizeSource(r.source);
    const id = r.resource_id;
    const text = r.memories?.[0] ?? r.title ?? undefined;
    if (!id || !text || !source) return [];
    const safe = MemorySchema.safeParse({
      id,
      text,
      source,
      metadata: r.metadata,
      score: r.score,
    });
    return safe.success ? [safe.data] : [];
  });
  const legacyMemories: Memory[] = (json.results ?? []).flatMap((r) => {
    const id = r.id ?? r.memory_id;
    const text = r.text ?? r.content;
    const source = normalizeSource(r.source);
    if (!id || !text || !source) return [];
    const safe = MemorySchema.safeParse({
      id,
      text,
      source,
      metadata: r.metadata,
      score: r.score,
    });
    return safe.success ? [safe.data] : [];
  });
  return { memories: documentMemories.length > 0 ? documentMemories : legacyMemories };
}

async function liveAdd(input: AddMemoryInput): Promise<{ id: string }> {
  const metadata = {
    ...(input.metadata ?? {}),
    source: input.source,
  };
  const res = await fetch(`${HYPERSPELL_API_BASE}/memories/add`, {
    method: "POST",
    headers: hyperspellHeaders(),
    body: JSON.stringify({ text: input.text, metadata }),
  });
  if (!res.ok) {
    throw new Error(`hyperspell add ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { id?: string; memory_id?: string; resource_id?: string };
  const id = json.id ?? json.memory_id ?? json.resource_id;
  if (!id) throw new Error("hyperspell add: response missing id");
  return { id };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: HyperspellClient | null = null;
export function getHyperspell(): HyperspellClient {
  if (!_client) _client = new HyperspellClient();
  return _client;
}

export const SOURCE_WEIGHTS = DEFAULT_SOURCE_WEIGHTS;
