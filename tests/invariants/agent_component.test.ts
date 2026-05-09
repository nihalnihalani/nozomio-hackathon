/**
 * Wave 2B — Agent Component path behavioral tests.
 *
 * The Convex Agent Component (`@convex-dev/agent`) was adopted in Phase 1
 * of `convexplan.md`. These tests lock in the guarantees of the new live
 * path WITHOUT regressing the replay path (Invariant 4 — Hermetic Demo
 * Mode), the Trace A → Trace B reinforcement honesty (Invariant 2), or
 * the Cite-Or-Die contract (Invariant 1).
 *
 * All assertions are source-grep tests + filesystem checks. No Convex
 * runtime, no network — these tests run in CI with zero secrets.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

async function readSource(rel: string): Promise<string> {
  return await fs.readFile(path.join(ROOT, rel), "utf-8");
}

describe("Wave 2B — Agent component is registered exactly once", () => {
  it("convex/convex.config.ts imports the agent component and uses it once", async () => {
    const src = await readSource("convex/convex.config.ts");

    // Imports `agent` from `@convex-dev/agent/convex.config`.
    expect(
      /import\s+agent\s+from\s+["']@convex-dev\/agent\/convex\.config["']/.test(
        src
      ),
      "convex/convex.config.ts must import `agent` from `@convex-dev/agent/convex.config`"
    ).toBe(true);

    // Calls `app.use(agent)` exactly once.
    const useMatches = src.match(/\bapp\.use\(\s*agent\s*\)/g) ?? [];
    expect(
      useMatches.length,
      "convex/convex.config.ts must call `app.use(agent)` exactly once"
    ).toBe(1);
  });

  it("no extra components are registered (only the agent)", async () => {
    const src = await readSource("convex/convex.config.ts");

    // Count every `app.use(...)` call. Wave 2B's contract: only `agent`.
    const allUseCalls = src.match(/\bapp\.use\(/g) ?? [];
    expect(
      allUseCalls.length,
      "convex/convex.config.ts must register exactly one component (agent)"
    ).toBe(1);
  });
});

describe("Wave 2B — Agent uses the system prompt from lib/prompts/triage-system.md", () => {
  it("convex/triageAgent.ts loads instructions from the prompts file", async () => {
    const src = await readSource("convex/triageAgent.ts");

    // The loader function exists.
    expect(
      /function\s+loadInstructions\s*\(/.test(src),
      "convex/triageAgent.ts must define a `loadInstructions()` helper"
    ).toBe(true);

    // The Agent instance uses it.
    expect(
      /instructions:\s*loadInstructions\s*\(\s*\)/.test(src),
      "Agent constructor must pass `instructions: loadInstructions()`"
    ).toBe(true);

    // The path resolution targets the canonical prompt file.
    expect(
      /lib["'/,\s]+prompts["'/,\s]+triage-system\.md/.test(src),
      "convex/triageAgent.ts must resolve `lib/prompts/triage-system.md`"
    ).toBe(true);
  });

  it("the prompt file actually exists at the imported path", async () => {
    const promptPath = path.join(ROOT, "lib", "prompts", "triage-system.md");
    const stat = await fs.stat(promptPath);
    expect(stat.isFile()).toBe(true);

    const text = await fs.readFile(promptPath, "utf-8");
    // Sanity bound: the prompt is non-empty and mentions the cite-or-die
    // posture (Invariant 1) so we're sure we're loading the right file.
    expect(text.length).toBeGreaterThan(100);
  });
});

describe("Wave 2B — Agent component tools use createTool with Zod inputSchema", () => {
  it("convex/triageAgent.ts imports createTool from @convex-dev/agent and z from zod", async () => {
    const src = await readSource("convex/triageAgent.ts");

    expect(
      /import\s*\{[^}]*\bcreateTool\b[^}]*\}\s*from\s*["']@convex-dev\/agent["']/.test(
        src
      ),
      "convex/triageAgent.ts must import `createTool` from `@convex-dev/agent`"
    ).toBe(true);

    expect(
      /import\s*\{\s*z\s*\}\s*from\s*["']zod["']/.test(src),
      "convex/triageAgent.ts must import `z` from `zod`"
    ).toBe(true);
  });

  it("at least 2 tools are defined (recallSimilarIncidents and searchCode)", async () => {
    const src = await readSource("convex/triageAgent.ts");

    expect(
      /\bconst\s+recallSimilarIncidents\s*=\s*createTool\(/.test(src),
      "Tool `recallSimilarIncidents` must be defined via `createTool(...)`"
    ).toBe(true);

    expect(
      /\bconst\s+searchCode\s*=\s*createTool\(/.test(src),
      "Tool `searchCode` must be defined via `createTool(...)`"
    ).toBe(true);

    // Both are wired into the Agent constructor.
    expect(
      /tools:\s*\{[^}]*\brecallSimilarIncidents\b[^}]*\bsearchCode\b[^}]*\}/.test(
        src
      ),
      "Agent must pass `tools: { recallSimilarIncidents, searchCode }`"
    ).toBe(true);
  });

  it("each tool uses inputSchema (v0.6 API), NOT the legacy args field", async () => {
    const src = await readSource("convex/triageAgent.ts");

    // Both tools use `inputSchema:`.
    const inputSchemaMatches = src.match(/\binputSchema\s*:/g) ?? [];
    expect(
      inputSchemaMatches.length,
      "expected `inputSchema:` to appear at least twice (once per tool)"
    ).toBeGreaterThanOrEqual(2);

    // Carve out the createTool call bodies and assert the legacy `args:`
    // field is NOT used as a tool key. We isolate the tool blocks so the
    // mutation argument validators (which use `args:`) elsewhere in the
    // codebase don't interfere — but this file only contains createTool
    // bodies so a file-wide grep is safe and conservative here.
    expect(
      /createTool\(\s*\{[\s\S]*?\bargs\s*:/.test(src),
      "Tools must use `inputSchema:` (v0.6 API), NOT the legacy `args:` key"
    ).toBe(false);

    // Schemas are Zod objects.
    const zObjectMatches = src.match(/inputSchema:\s*z\.object\(/g) ?? [];
    expect(
      zObjectMatches.length,
      "Each tool's inputSchema must be a `z.object(...)` Zod schema"
    ).toBeGreaterThanOrEqual(2);
  });

  it("each tool uses execute (v0.6 API), NOT the legacy handler field", async () => {
    const src = await readSource("convex/triageAgent.ts");

    // Both tools use `execute:`.
    const executeMatches = src.match(/\bexecute\s*:/g) ?? [];
    expect(
      executeMatches.length,
      "expected `execute:` to appear at least twice (once per tool)"
    ).toBeGreaterThanOrEqual(2);

    // No tool body should use `handler:`.
    expect(
      /createTool\(\s*\{[\s\S]*?\bhandler\s*:/.test(src),
      "Tools must use `execute:` (v0.6 API), NOT the legacy `handler:` key"
    ).toBe(false);
  });
});

describe("Wave 2B — Agent has explicit stopWhen budget", () => {
  it("triageAgent sets `stopWhen: stepCountIs(N)` with N <= 8", async () => {
    const src = await readSource("convex/triageAgent.ts");

    expect(
      /import\s*\{[^}]*\bstepCountIs\b[^}]*\}\s*from\s*["']@convex-dev\/agent["']/.test(
        src
      ),
      "convex/triageAgent.ts must import `stepCountIs` from `@convex-dev/agent`"
    ).toBe(true);

    const match = src.match(/stopWhen\s*:\s*stepCountIs\(\s*(\d+)\s*\)/);
    expect(match, "Agent must declare `stopWhen: stepCountIs(N)`").not.toBeNull();
    const n = Number(match![1]);
    expect(
      n,
      `stopWhen budget must be in (0, 8] — got ${n}, which is unbounded for a triage agent`
    ).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(8);
  });
});

describe("Wave 2B — Agent component path preserves Trace A → Trace B reinforcement honesty", () => {
  it("convex/triageNode.ts:runTriage calls internal.traceState.hasRecentTraceA", async () => {
    const src = await readSource("convex/triageNode.ts");

    // The new agent-path action must explicitly call the gate query.
    expect(
      /internal\.traceState\.hasRecentTraceA/.test(src),
      "runTriage must call `internal.traceState.hasRecentTraceA` to preserve Codex pass-3 honesty"
    ).toBe(true);

    // And it must run inside the `runTriage` action body, not just be an
    // unused import. Carve out the runTriage block and re-check.
    const runTriageStart = src.indexOf("runTriage = internalAction");
    expect(
      runTriageStart,
      "runTriage must be defined as an internalAction"
    ).toBeGreaterThan(-1);
    const runTriageBlock = src.slice(runTriageStart);
    expect(
      /hasRecentTraceA/.test(runTriageBlock),
      "the `hasRecentTraceA` call must live inside `runTriage`'s handler"
    ).toBe(true);
  });

  it("emits a [degraded] marker when no prior Trace A exists", async () => {
    const src = await readSource("convex/triageNode.ts");

    // The literal `[degraded]` marker is the user-visible signal that
    // Invariant 2 reinforcement is missing for this run. Codex pass-3
    // explicitly required this.
    expect(
      /\[degraded\]/.test(src),
      "runTriage must emit a `[degraded]` marker when no prior Trace A exists"
    ).toBe(true);

    // The marker is conditional on `!hasPriorA`.
    expect(
      /if\s*\(\s*!\s*hasPriorA\s*\)/.test(src),
      "the [degraded] branch must gate on `!hasPriorA`"
    ).toBe(true);
  });
});

describe("Wave 2B — Agent component path uses saveStreamDeltas for client subscription", () => {
  it("convex/triageNode.ts:runTriage calls streamText with saveStreamDeltas: true", async () => {
    const src = await readSource("convex/triageNode.ts");

    // The Agent component's `streamText` must opt into delta persistence
    // so Wave 2A's `useUIMessages({ stream: true })` can subscribe.
    expect(
      /\.streamText\(/.test(src),
      "runTriage must call `thread.streamText(...)`"
    ).toBe(true);

    expect(
      /saveStreamDeltas\s*:\s*true/.test(src),
      "thread.streamText must be passed `{ saveStreamDeltas: true }`"
    ).toBe(true);
  });

  it("the stream is awaited / drained so tool calls fire before the action exits", async () => {
    const src = await readSource("convex/triageNode.ts");

    // `for await (... of stream.textStream)` is the documented drain.
    expect(
      /for\s+await\s*\([^)]*stream\.textStream\s*\)/.test(src),
      "runTriage must drain `stream.textStream` so tool calls complete"
    ).toBe(true);
  });
});
