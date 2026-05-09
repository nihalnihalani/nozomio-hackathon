/**
 * Invariant 4 — Hermetic Demo Mode.
 *
 * Every outbound call (Hyperspell, Nia, InsForge) must have a
 * `DEMO_MODE=replay` branch. The pattern is established in
 * lib/hyperspell/client.ts and lib/nia/client.ts; this test enforces
 * the pattern by file-grep.
 *
 * The agent loop (lib/agent/loop.ts — Backend Engineer's lane) must
 * also have a replay branch that consumes data/replay/trace-*.json.
 * That file may not exist yet; if absent, the test logs and defers
 * (becomes binding once the file is authored).
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

async function readMaybe(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(ROOT, rel), "utf-8");
  } catch {
    return null;
  }
}

describe("Invariant 4 — Hermetic Demo Mode", () => {
  it("lib/hyperspell/client.ts: live env-var read AND a replay branch", async () => {
    const src = await readMaybe("lib/hyperspell/client.ts");
    expect(src, "lib/hyperspell/client.ts must exist").not.toBeNull();
    const text = src!;
    expect(
      text.includes("HYPERSPELL_API_KEY"),
      "lib/hyperspell/client.ts must reference process.env.HYPERSPELL_API_KEY"
    ).toBe(true);
    expect(
      text.includes("getDemoMode") || /shouldReplay\s*\(/.test(text),
      "lib/hyperspell/client.ts must consult getDemoMode() (or equivalent shouldReplay())"
    ).toBe(true);
    expect(
      /replay/i.test(text),
      "lib/hyperspell/client.ts must have a replay-branch indicator"
    ).toBe(true);
  });

  it("lib/nia/client.ts: live env-var read AND a replay branch", async () => {
    const src = await readMaybe("lib/nia/client.ts");
    expect(src, "lib/nia/client.ts must exist").not.toBeNull();
    const text = src!;
    expect(
      text.includes("NIA_API_KEY"),
      "lib/nia/client.ts must reference process.env.NIA_API_KEY"
    ).toBe(true);
    expect(
      text.includes("getDemoMode") || /shouldReplay\s*\(/.test(text),
      "lib/nia/client.ts must consult getDemoMode() (or equivalent shouldReplay())"
    ).toBe(true);
    expect(
      /replaySearch|replay/i.test(text),
      "lib/nia/client.ts must have a replay-branch indicator"
    ).toBe(true);
  });

  it("lib/insforge/client.ts (if present): live env-var read AND a replay branch", async () => {
    const src = await readMaybe("lib/insforge/client.ts");
    if (src === null) {
      console.warn(
        "[replay_mode] lib/insforge/client.ts not present yet; this test becomes binding once Person 2 authors it."
      );
      return;
    }
    expect(
      /INSFORGE_(BASE_URL|ANON_KEY|SERVICE_ROLE_KEY)/.test(src),
      "lib/insforge/client.ts must reference an INSFORGE_* env var"
    ).toBe(true);
    expect(
      src.includes("getDemoMode") || /shouldReplay\s*\(/.test(src),
      "lib/insforge/client.ts must consult getDemoMode() (or equivalent shouldReplay())"
    ).toBe(true);
    expect(
      /replay/i.test(src),
      "lib/insforge/client.ts must have a replay-branch indicator"
    ).toBe(true);
  });

  it("lib/agent/loop.ts (if present): both live and replay code paths", async () => {
    const src = await readMaybe("lib/agent/loop.ts");
    if (src === null) {
      console.warn(
        "[replay_mode] lib/agent/loop.ts not present yet; this test becomes binding once the Backend Engineer authors it."
      );
      return;
    }
    // Look for a branch keyed off DEMO_MODE / getDemoMode / mode === 'replay'.
    const replayBranch =
      /mode\s*===?\s*['"]replay['"]/.test(src) ||
      /getDemoMode\s*\(/.test(src) ||
      /DEMO_MODE/.test(src);
    expect(
      replayBranch,
      "lib/agent/loop.ts must branch on DEMO_MODE / getDemoMode() / mode === 'replay'"
    ).toBe(true);
    // And evidence of a live path (calls into the SDK clients).
    const livePath =
      /getHyperspell\s*\(/.test(src) ||
      /getNia\s*\(/.test(src) ||
      /HYPERSPELL_API_KEY/.test(src) ||
      /NIA_API_KEY/.test(src);
    expect(
      livePath,
      "lib/agent/loop.ts must also have a live path (calls into Hyperspell/Nia clients)"
    ).toBe(true);
  });

  it("data/replay/trace-a.json and data/replay/trace-b.json exist on disk", async () => {
    const a = await readMaybe("data/replay/trace-a.json");
    const b = await readMaybe("data/replay/trace-b.json");
    expect(a, "data/replay/trace-a.json must exist for hermetic demo").not.toBeNull();
    expect(b, "data/replay/trace-b.json must exist for hermetic demo").not.toBeNull();
  });
});
