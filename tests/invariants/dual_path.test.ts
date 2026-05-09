/**
 * Wave 2B — Dual-path scheduler tests.
 *
 * The post-Phase-1 architecture has two distinct execution paths:
 *   - DEMO_MODE=replay  → legacy `runInternal` → `lib/agent/loop.ts:runReplay`
 *                          (Invariant 4 — Hermetic Demo Mode)
 *   - DEMO_MODE=live    → `runTriage` (the `@convex-dev/agent` path)
 *
 * These tests lock in that BOTH paths exist, are routed correctly, and
 * the no-keys replay lifeboat is preserved. Source-grep only — no Convex
 * runtime, no network.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

async function readSource(rel: string): Promise<string> {
  return await fs.readFile(path.join(ROOT, rel), "utf-8");
}

describe("Wave 2B — Dual-path scheduler in convex/triage.ts:start", () => {
  it("DEMO_MODE=replay routes to the legacy runInternal action", async () => {
    const src = await readSource("convex/triage.ts");

    // The branch checks `DEMO_MODE === "replay"` (or the negation).
    expect(
      /demoMode\s*(?:===|!==)\s*["']replay["']/.test(src),
      "convex/triage.ts:start must branch on `DEMO_MODE === 'replay'`"
    ).toBe(true);

    // The replay branch schedules the legacy `runInternal`.
    expect(
      /internal\.triageNode\.runInternal/.test(src),
      "the replay branch must schedule `internal.triageNode.runInternal`"
    ).toBe(true);

    // Carve out the `else` (replay) branch and re-check the schedule
    // happens there. We anchor on the `useAgent` flag the file uses.
    const startIdx = src.indexOf("export const start");
    expect(startIdx, "convex/triage.ts must export a `start` mutation").toBeGreaterThan(-1);
    const startBlock = src.slice(startIdx);
    // The replay branch lives in the `else` of the `useAgent` check.
    expect(
      /else\s*\{[\s\S]*?internal\.triageNode\.runInternal[\s\S]*?\}/.test(
        startBlock
      ),
      "the `else` branch (replay) must schedule `runInternal`"
    ).toBe(true);
  });

  it("DEMO_MODE=live routes to runTriage with createThread + threadId", async () => {
    const src = await readSource("convex/triage.ts");

    // `createThread` is imported from the agent component.
    expect(
      /import\s*\{[^}]*\bcreateThread\b[^}]*\}\s*from\s*["']@convex-dev\/agent["']/.test(
        src
      ),
      "convex/triage.ts must import `createThread` from `@convex-dev/agent`"
    ).toBe(true);

    // The live branch creates a thread.
    expect(
      /createThread\s*\(\s*ctx\s*,/.test(src),
      "the live branch must call `createThread(ctx, ...)`"
    ).toBe(true);

    // The live branch schedules `runTriage` with the `threadId`.
    expect(
      /internal\.triageNode\.runTriage/.test(src),
      "the live branch must schedule `internal.triageNode.runTriage`"
    ).toBe(true);

    // Verify the threadId is actually passed to the scheduled action.
    const runAfterMatch = src.match(
      /scheduler\.runAfter\([^,]+,\s*internal\.triageNode\.runTriage,\s*\{[\s\S]*?threadId[\s\S]*?\}\s*\)/
    );
    expect(
      runAfterMatch,
      "scheduler.runAfter(..., runTriage, { ..., threadId, ... }) must include threadId"
    ).not.toBeNull();
  });

  it("the live and replay branches are mutually exclusive (one if/else)", async () => {
    const src = await readSource("convex/triage.ts");

    // Both schedule calls exist; they must be guarded so only one fires.
    // The simplest assertion: both `runTriage` and `runInternal` mentions
    // appear, and they're separated by an `else` branch.
    const liveIdx = src.indexOf("internal.triageNode.runTriage");
    const replayIdx = src.indexOf("internal.triageNode.runInternal");
    expect(liveIdx).toBeGreaterThan(-1);
    expect(replayIdx).toBeGreaterThan(-1);

    // The text BETWEEN the two scheduler calls must contain `else` so the
    // dispatcher is exclusive.
    const between = src.slice(
      Math.min(liveIdx, replayIdx),
      Math.max(liveIdx, replayIdx)
    );
    expect(
      /\belse\b/.test(between),
      "the live and replay branches must be separated by an `else`"
    ).toBe(true);
  });
});

describe("Wave 2B — lib/agent/loop.ts:runReplay is the demo lifeboat", () => {
  it("runReplay function still exists in lib/agent/loop.ts", async () => {
    const src = await readSource("lib/agent/loop.ts");

    // Defined either as `async function runReplay` or `const runReplay = ...`.
    const declared =
      /\basync\s+function\s+runReplay\b/.test(src) ||
      /\bconst\s+runReplay\s*=/.test(src) ||
      /\bfunction\s+runReplay\b/.test(src);
    expect(
      declared,
      "lib/agent/loop.ts must still define `runReplay` — the no-keys demo path"
    ).toBe(true);
  });

  it("runReplay is reachable from runAgent (the public entry point)", async () => {
    const src = await readSource("lib/agent/loop.ts");

    // `runAgent` dispatches into `runReplay`.
    expect(
      /runReplay\(/.test(src),
      "runReplay must be called from runAgent (or runLive's fallback)"
    ).toBe(true);

    // `runAgent` is exported.
    expect(
      /export\s+async\s+function\s+runAgent\b/.test(src),
      "lib/agent/loop.ts must export `runAgent`"
    ).toBe(true);
  });

  it("runReplay reads from data/replay/ (the fixture root)", async () => {
    const src = await readSource("lib/agent/loop.ts");

    // The REPLAY_DIR constant points at data/replay.
    expect(
      /["']data["'][^"']*[,)]\s*["']replay["']/.test(src) ||
        /data\/replay/.test(src),
      "lib/agent/loop.ts must read fixtures from `data/replay/`"
    ).toBe(true);

    // Sanity: the directory exists and has at least one fixture.
    const dir = path.join(ROOT, "data", "replay");
    const entries = await fs.readdir(dir);
    const fixtures = entries.filter(
      (e) => e.endsWith(".json") && !e.startsWith("_")
    );
    expect(
      fixtures.length,
      "data/replay/ must contain at least one fixture JSON"
    ).toBeGreaterThan(0);
  });
});
