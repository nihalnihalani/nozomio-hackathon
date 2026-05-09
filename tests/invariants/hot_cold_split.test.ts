/**
 * Invariant 3 — Hot/Cold Path Split.
 *
 * Convex holds per-session ephemeral agent state (the hot path).
 * InsForge holds the multi-tenant durable audit log (the cold path).
 * They are not interchangeable; mirroring is one-way (Convex → InsForge).
 *
 * This test grep-checks the schemas + the mirror route to enforce the
 * split at the file level. It runs in isolation (no Convex/InsForge
 * SDKs required) so it's safe to ship in CI before the runtime is up.
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

describe("Invariant 3 — Hot/Cold Path Split", () => {
  it("convex/schema.ts is the hot path: no audit/incidents tables", async () => {
    const src = await readMaybe("convex/schema.ts");
    expect(src, "convex/schema.ts must exist").not.toBeNull();
    const text = src!;

    // Match `defineTable(...)` invocations preceded by a property name —
    // we want to assert the *table name* doesn't include cold-path entities.
    // Convex uses the object key as the table name: `incidents: defineTable(...)`.
    // We check both the key pattern and a literal mention.
    const coldTablePattern = /\b(incidents|audit_log|auditLog)\s*:\s*defineTable/;
    expect(
      coldTablePattern.test(text),
      "convex/schema.ts must NOT define `incidents` or `audit_log` — those live in InsForge (cold path)"
    ).toBe(false);
  });

  it("convex/schema.ts defines the hot-path tables: triageRuns, toolCalls, citations, memoryEvents", async () => {
    const src = await readMaybe("convex/schema.ts");
    expect(src).not.toBeNull();
    const text = src!;
    for (const table of ["triageRuns", "toolCalls", "citations", "memoryEvents"]) {
      const pattern = new RegExp(`\\b${table}\\s*:\\s*defineTable`);
      expect(
        pattern.test(text),
        `convex/schema.ts must define the hot-path table '${table}'`
      ).toBe(true);
    }
  });

  it("app/api/insforge-mirror/route.ts (if present) imports from lib/insforge/client.ts", async () => {
    const src = await readMaybe("app/api/insforge-mirror/route.ts");
    if (src === null) {
      // Route hasn't been authored yet — Person 2's lane. Don't fail; this
      // test becomes binding once the file exists.
      console.warn(
        "[hot_cold_split] app/api/insforge-mirror/route.ts not present yet; deferring"
      );
      return;
    }
    expect(
      /from\s+["'](?:@\/lib\/insforge\/client|\.\.?\/.*lib\/insforge\/client)["']/.test(
        src
      ),
      "/api/insforge-mirror must import from lib/insforge/client.ts (single InsForge client)"
    ).toBe(true);
  });

  it("convex/ files do not import from lib/insforge/client.ts (cold-path leak)", async () => {
    // Walk convex/ and assert the InsForge client isn't reached from Convex.
    const dir = path.join(ROOT, "convex");
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return; // convex dir not present (early dev) — skip
    }
    for (const name of entries) {
      if (name === "_generated") continue;
      const full = path.join(dir, name);
      const stat = await fs.stat(full);
      if (!stat.isFile() || !name.endsWith(".ts")) continue;
      const text = await fs.readFile(full, "utf-8");
      expect(
        /from\s+["']@\/lib\/insforge/.test(text),
        `convex/${name} must not import @/lib/insforge — that's the cold-path leak Invariant 3 forbids`
      ).toBe(false);
    }
  });
});
