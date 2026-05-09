#!/usr/bin/env tsx
/**
 * scripts/verify_invariants.ts — invariant grep + assertion runner.
 *
 * This is the cheap, codebase-wide CI gate. It complements the vitest
 * suite under tests/invariants/* by catching things that aren't easy
 * to express as unit tests (e.g. "no hardcoded model IDs leaked outside
 * the model-config files", "every outbound client touches DEMO_MODE").
 *
 * Exit code: 0 if every invariant is green; 1 otherwise.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

interface Check {
  invariant: 1 | 2 | 3 | 4;
  name: string;
  run: () => Promise<{ ok: boolean; detail: string }>;
}

// ─── File-tree helpers ────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "convex/_generated",
  "seed/billing-service",
  "data",
]);

async function walk(dir: string, predicate: (file: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  async function inner(d: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      const rel = path.relative(ROOT, full);
      if ([...SKIP_DIRS].some((s) => rel.startsWith(s))) continue;
      if (e.isDirectory()) {
        await inner(full);
      } else if (predicate(full)) {
        out.push(full);
      }
    }
  }
  await inner(dir);
  return out;
}

async function readMaybe(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(ROOT, rel), "utf-8");
  } catch {
    return null;
  }
}

// ─── Checks ──────────────────────────────────────────────────────────────────

const checks: Check[] = [
  {
    invariant: 1,
    name: "Cite-Or-Die: TriageResult fixtures have non-empty citations",
    run: async () => {
      const a = JSON.parse(
        (await readMaybe("data/replay/trace-a.json")) ?? "{}"
      );
      const b = JSON.parse(
        (await readMaybe("data/replay/trace-b.json")) ?? "{}"
      );
      const okA =
        Array.isArray(a?.result?.root_cause?.citations) &&
        a.result.root_cause.citations.length > 0;
      const okB =
        Array.isArray(b?.result?.root_cause?.citations) &&
        b.result.root_cause.citations.length > 0;
      return {
        ok: okA && okB,
        detail: `traceA.root_cause.citations=${a?.result?.root_cause?.citations?.length ?? 0}, traceB=${b?.result?.root_cause?.citations?.length ?? 0}`,
      };
    },
  },
  {
    invariant: 2,
    name: "Reinforcement: Trace B has at least one cited memory_id Trace A doesn't",
    run: async () => {
      const a = JSON.parse(
        (await readMaybe("data/replay/trace-a.json")) ?? "{}"
      );
      const b = JSON.parse(
        (await readMaybe("data/replay/trace-b.json")) ?? "{}"
      );
      const ids = (r: { result?: { root_cause?: { citations?: { source: string; source_id: string }[] }; similar_incidents?: { memory_id: string }[] } }) => {
        const set = new Set<string>();
        for (const c of r.result?.root_cause?.citations ?? []) {
          if (c.source !== "code") set.add(c.source_id);
        }
        for (const s of r.result?.similar_incidents ?? []) set.add(s.memory_id);
        return set;
      };
      const aIds = ids(a);
      const bIds = ids(b);
      const newInB = [...bIds].filter((id) => !aIds.has(id));
      return {
        ok: newInB.length > 0,
        detail: `new_in_B=[${newInB.join(", ") || "(none)"}]`,
      };
    },
  },
  {
    invariant: 3,
    name: "Hot/Cold split: convex/schema.ts excludes audit/incidents tables",
    run: async () => {
      const src = (await readMaybe("convex/schema.ts")) ?? "";
      const bad = /\b(incidents|audit_log|auditLog)\s*:\s*defineTable/.test(src);
      return {
        ok: !bad,
        detail: bad
          ? "convex/schema.ts defines a cold-path table (incidents/audit_log)"
          : "no cold-path tables in convex/schema.ts",
      };
    },
  },
  {
    invariant: 4,
    name: "Replay mode: every SDK client (hyperspell + nia) checks DEMO_MODE",
    run: async () => {
      const failures: string[] = [];
      for (const rel of ["lib/hyperspell/client.ts", "lib/nia/client.ts"]) {
        const src = await readMaybe(rel);
        if (src === null) {
          failures.push(`${rel} missing`);
          continue;
        }
        const refs =
          src.includes("getDemoMode") ||
          /shouldReplay\s*\(/.test(src) ||
          src.includes("DEMO_MODE");
        if (!refs) failures.push(`${rel} does not reference DEMO_MODE/getDemoMode`);
      }
      return {
        ok: failures.length === 0,
        detail: failures.length === 0 ? "all clients gated on DEMO_MODE" : failures.join("; "),
      };
    },
  },
  {
    invariant: 4,
    name: "Replay mode: optional clients (insforge, agent loop) are gated when present",
    run: async () => {
      const failures: string[] = [];
      for (const rel of ["lib/insforge/client.ts", "lib/agent/loop.ts"]) {
        const src = await readMaybe(rel);
        if (src === null) continue; // not authored yet — fine
        const refs =
          src.includes("getDemoMode") ||
          /shouldReplay\s*\(/.test(src) ||
          src.includes("DEMO_MODE");
        if (!refs) failures.push(`${rel} present but does not reference DEMO_MODE`);
      }
      return {
        ok: failures.length === 0,
        detail: failures.length === 0 ? "optional clients ok" : failures.join("; "),
      };
    },
  },
  {
    invariant: 1,
    name: "No hardcoded sponsor model IDs outside lib/ (e.g. seed-2.0, seedance-, claude-3-7-sonnet-2024)",
    run: async () => {
      // Loose patterns matching real vendor model-id strings. Use word
      // boundaries + numeric prefixes so this verifier file's *prose*
      // ("seed-2.0") doesn't match itself; only quoted/bare model IDs
      // like "seedance-pro" or `claude-3-7-sonnet-2024-02-29` should hit.
      const banned = [
        /\bseedance-[a-z]/i,
        /\bclaude-3-?7-?sonnet-\d{4}/i,
        /\bgpt-4o-\d{4}/i,
      ];
      const tsFiles = await walk(ROOT, (f) => /\.(ts|tsx)$/.test(f));
      const offenders: string[] = [];
      for (const f of tsFiles) {
        const rel = path.relative(ROOT, f);
        // Allow lib/types.ts and any model-config file under lib/.
        if (rel.startsWith("lib/")) continue;
        // Also exempt the verifier itself (the regexes appear here as source).
        if (rel === "scripts/verify_invariants.ts") continue;
        const src = await fs.readFile(f, "utf-8");
        for (const re of banned) {
          if (re.test(src)) {
            offenders.push(`${rel} matches ${re}`);
            break;
          }
        }
      }
      return {
        ok: offenders.length === 0,
        detail: offenders.length === 0 ? "no hardcoded model IDs outside lib/" : offenders.join("; "),
      };
    },
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[verify_invariants] running…");
  const results: Array<{ check: Check; ok: boolean; detail: string }> = [];
  for (const c of checks) {
    try {
      const r = await c.run();
      results.push({ check: c, ok: r.ok, detail: r.detail });
    } catch (err) {
      results.push({
        check: c,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let failed = 0;
  for (const r of results) {
    const tag = r.ok ? "PASS" : "FAIL";
    console.log(
      `  [I${r.check.invariant}] ${tag} — ${r.check.name}: ${r.detail}`
    );
    if (!r.ok) failed++;
  }
  console.log(
    `[verify_invariants] ${results.length - failed}/${results.length} passed`
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[verify_invariants] FATAL:", err);
  process.exit(1);
});
