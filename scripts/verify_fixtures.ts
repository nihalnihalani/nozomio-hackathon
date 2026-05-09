/**
 * Diagnostic — runs the cite-or-die verifier in STRICT mode against every
 * code citation in the replay fixtures. Used during dev to confirm that
 * fixture line numbers + content match what the seed file actually contains.
 *
 * Run with:
 *   STRICT_CITE_OR_DIE=1 npx tsx scripts/verify_fixtures.ts
 */
import { verifyCodeSnippet } from "../lib/nia/client";
import * as fs from "fs/promises";

let failures = 0;

async function checkFixture(p: string) {
  const data = JSON.parse(await fs.readFile(p, "utf-8"));
  console.log(`\n=== ${p} ===`);
  if (data.snippets) {
    for (const s of data.snippets) {
      const ok = await verifyCodeSnippet(s);
      console.log(`  ${ok ? "PASS" : "FAIL"} ${s.file}:${s.line}`);
      if (!ok) failures++;
    }
  }
  if (data.tool_calls) {
    for (const tc of data.tool_calls) {
      if (tc.tool === "searchCode" && tc.output?.snippets) {
        for (const s of tc.output.snippets) {
          const ok = await verifyCodeSnippet(s);
          console.log(`  ${ok ? "PASS" : "FAIL"} ${s.file}:${s.line}`);
          if (!ok) failures++;
        }
      }
    }
  }
}

async function main() {
  // Always run in STRICT mode — this script is the fixture-validity gate.
  process.env.STRICT_CITE_OR_DIE = "1";
  await checkFixture("data/replay/trace-a.json");
  await checkFixture("data/replay/trace-b.json");
  await checkFixture("data/replay/nia/33fb18b841fa1b6b.json");
  await checkFixture("data/replay/nia/a08b869370c6cac0.json");
  if (failures > 0) {
    console.error(`\n[verify_fixtures] FAIL — ${failures} citation(s) failed strict cite-or-die.`);
    process.exit(1);
  }
  console.log("\n[verify_fixtures] PASS — all citations verified against seed.");
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
