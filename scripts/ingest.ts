#!/usr/bin/env tsx
/**
 * scripts/ingest.ts — pre-load Hyperspell with the seed/* corpora.
 *
 * Reads:
 *   seed/slack.json                          (Slack message stream)
 *   seed/postmortems/*.md                    (Notion-style postmortems)
 *   seed/gmail/*.json                        (Gmail vendor-outage threads)
 *
 * Writes:
 *   - DEMO_MODE=replay (or no API key): appends to
 *     data/replay/hyperspell/_ingest-log.json + writes a marker file
 *     and exits 0. Idempotent.
 *   - DEMO_MODE=live: calls hyperspell.memories.add() per record;
 *     marker file prevents re-ingest.
 *
 * Run:
 *   npm run ingest        # picks up DEMO_MODE from env
 *   DEMO_MODE=replay npm run ingest
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { getHyperspell } from "@/lib/hyperspell/client";
import { getDemoMode } from "@/lib/types";

const ROOT = process.cwd();
const SEED_ROOT = path.join(ROOT, "seed");
const REPLAY_ROOT = path.join(ROOT, "data", "replay", "hyperspell");
const MARKER = path.join(REPLAY_ROOT, ".ingest-complete");
const LOG = path.join(REPLAY_ROOT, "_ingest-log.json");

interface SlackMessage {
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_id?: string;
}
interface GmailThread {
  thread_id: string;
  subject: string;
  from: string;
  body: string;
  ts: string;
}

interface IngestRecord {
  text: string;
  source: "slack" | "notion" | "gmail";
  metadata: Record<string, unknown>;
}

async function readJsonMaybe<T>(rel: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, rel), "utf-8")) as T;
  } catch {
    return null;
  }
}

async function loadSlack(): Promise<IngestRecord[]> {
  // Tolerate either a top-level array or `{ messages: [...] }` (the
  // Data Engineer's actual shape includes a top-level `_comment` doc key).
  const raw = await readJsonMaybe<SlackMessage[] | { messages?: SlackMessage[] }>(
    "seed/slack.json"
  );
  if (!raw) return [];
  const list: SlackMessage[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.messages)
      ? raw.messages
      : [];
  return list.map((m) => ({
    text: m.text,
    source: "slack" as const,
    metadata: {
      channel: m.channel,
      author: m.user,
      ts: m.ts,
      thread_id: m.thread_id,
    },
  }));
}

async function loadPostmortems(): Promise<IngestRecord[]> {
  const dir = path.join(SEED_ROOT, "postmortems");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const records: IngestRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const text = await fs.readFile(path.join(dir, name), "utf-8");
    records.push({
      text,
      source: "notion",
      metadata: {
        doc_id: name.replace(/\.md$/, ""),
        kind: "postmortem",
      },
    });
  }
  return records;
}

async function loadGmail(): Promise<IngestRecord[]> {
  const dir = path.join(SEED_ROOT, "gmail");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const records: IngestRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, name), "utf-8");
    const threads = JSON.parse(raw) as GmailThread[] | GmailThread;
    const list = Array.isArray(threads) ? threads : [threads];
    for (const t of list) {
      records.push({
        text: `${t.subject}\n\n${t.body}`,
        source: "gmail",
        metadata: {
          thread_id: t.thread_id,
          from: t.from,
          ts: t.ts,
          subject: t.subject,
        },
      });
    }
  }
  return records;
}

async function main(): Promise<void> {
  const mode = getDemoMode();
  await fs.mkdir(REPLAY_ROOT, { recursive: true });

  // Idempotency: skip if marker present (unless --force).
  const force = process.argv.includes("--force");
  if (!force) {
    try {
      await fs.stat(MARKER);
      console.log(
        `[ingest] marker present at ${path.relative(ROOT, MARKER)} — skipping (use --force to re-run)`
      );
      return;
    } catch {
      // no marker → proceed
    }
  }

  const records = [
    ...(await loadSlack()),
    ...(await loadPostmortems()),
    ...(await loadGmail()),
  ];

  console.log(
    `[ingest] mode=${mode} records=${records.length} (slack/notion/gmail combined)`
  );

  if (records.length === 0) {
    console.warn(
      "[ingest] no seed records found. Make sure seed/slack.json, seed/postmortems/*.md, seed/gmail/*.json exist."
    );
  }

  const hs = getHyperspell();
  const log: Array<{ source: string; ts: string; ok: boolean; id?: string; error?: string }> = [];
  for (const r of records) {
    try {
      const { id } = await hs.memories.add(r);
      log.push({ source: r.source, ts: String(r.metadata.ts ?? ""), ok: true, id });
    } catch (err) {
      log.push({
        source: r.source,
        ts: String(r.metadata.ts ?? ""),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Persist the per-run log (always — useful in both replay and live).
  await fs.writeFile(LOG, JSON.stringify({ at: new Date().toISOString(), mode, log }, null, 2));
  await fs.writeFile(MARKER, new Date().toISOString());

  const ok = log.filter((l) => l.ok).length;
  console.log(
    `[ingest] done — ok=${ok}/${log.length} log=${path.relative(ROOT, LOG)} marker=${path.relative(ROOT, MARKER)}`
  );
}

main().catch((err) => {
  console.error("[ingest] FATAL:", err);
  process.exit(1);
});
