/**
 * Trace B's reinforcement gating must consult shared state, not a
 * process-local Map (Codex BLOCK on lib/agent/loop.ts:168).
 *
 * The agent loop now accepts an optional `hasRecentTraceA` probe on
 * RunAgentInput. The Convex action wires that probe to
 * `internal.traceState.hasRecentTraceA` (which reads `memoryEvents`);
 * the Next.js API route wires it to a `ConvexHttpClient`. This test
 * mocks the probe directly to lock in two behaviors:
 *
 *   1. Probe returns FALSE for a fresh orgId  → Trace B is degraded
 *      (retry-budget DM + mem_reinforce_* citations stripped).
 *   2. Probe returns TRUE for the same orgId  → Trace B is full
 *      (retry-budget DM + reinforcement trail preserved).
 *
 * The orgIds chosen here are unique to this file so the in-process
 * Map fallback (lib/agent/loop.ts) cannot accidentally satisfy the
 * "no Trace A yet" precondition. The probe is the only signal.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  runAgent,
  type AgentEvent,
  type TraceStateProbe,
} from "@/lib/agent/loop";
import type { TriageResult } from "@/lib/types";

beforeAll(() => {
  // Force replay mode so the test is hermetic (no Anthropic key needed).
  process.env.DEMO_MODE = "replay";
});

const TRACE_B = "Duplicate refund event Stripe webhook";
const RETRY_BUDGET_ID = "mem_slk_dm_feb18_retry_budget";

interface RunOutcome {
  result: TriageResult | null;
  events: AgentEvent[];
}

async function runOnce(
  orgId: string,
  probe: TraceStateProbe
): Promise<RunOutcome> {
  const events: AgentEvent[] = [];
  const result = await runAgent(
    {
      trace: TRACE_B,
      orgId,
      hasRecentTraceA: probe,
    },
    (e) => {
      events.push(e);
    }
  );
  return { result, events };
}

function citedMemoryIds(r: TriageResult): string[] {
  const out = new Set<string>();
  for (const c of r.root_cause.citations) out.add(c.source_id);
  for (const c of r.suspected_fix.citations) out.add(c.source_id);
  for (const s of r.similar_incidents) out.add(s.memory_id);
  return [...out];
}

describe("Trace B gating consults the Convex memoryEvents-backed probe", () => {
  it("probe → false: Trace B is degraded (retry-budget DM stripped)", async () => {
    const calls: Array<{ orgId: string; withinMs: number }> = [];
    const probe: TraceStateProbe = async (orgId, withinMs) => {
      calls.push({ orgId, withinMs });
      return false;
    };

    // Use a fresh orgId so the local Map fallback can't have a recent
    // Trace A entry from another test in this file.
    const { result, events } = await runOnce(
      "test-trace-state-fresh-org",
      probe
    );

    // Probe was actually consulted with the right orgId.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].orgId).toBe("test-trace-state-fresh-org");
    expect(calls[0].withinMs).toBeGreaterThan(0);

    // Trace B with no prior Trace A → degraded.
    expect(result).not.toBeNull();
    const ids = citedMemoryIds(result!);
    expect(
      ids.includes(RETRY_BUDGET_ID),
      "degraded Trace B must NOT cite the retry-budget DM"
    ).toBe(false);
    // No mem_reinforce_* either.
    expect(
      ids.some((id) => id.startsWith("mem_reinforce_")),
      "degraded Trace B must NOT cite any mem_reinforce_* id"
    ).toBe(false);

    // The degrade error event surfaces the reason.
    const degradeError = events.find(
      (e) => e.type === "error" && /degraded/i.test(e.message)
    );
    expect(degradeError, "expected a [degraded] error event").toBeTruthy();
  });

  it("probe → true: Trace B is full (retry-budget DM preserved)", async () => {
    const probe: TraceStateProbe = async () => true;
    const { result } = await runOnce("test-trace-state-primed-org", probe);

    expect(result).not.toBeNull();
    const ids = citedMemoryIds(result!);
    expect(
      ids.includes(RETRY_BUDGET_ID),
      "full Trace B MUST cite the retry-budget DM (reinforcement signal)"
    ).toBe(true);
    expect(
      ids.some((id) => id.startsWith("mem_reinforce_")),
      "full Trace B MUST cite at least one mem_reinforce_* id"
    ).toBe(true);
  });

  it("probe → null: falls back to in-process Map (no recent Trace A → degraded)", async () => {
    // null = "couldn't reach Convex". Loop must fall back to the local
    // Map, which for a never-seen orgId yields false → degraded.
    const probe: TraceStateProbe = async () => null;
    const { result } = await runOnce(
      "test-trace-state-null-probe-org",
      probe
    );

    expect(result).not.toBeNull();
    const ids = citedMemoryIds(result!);
    expect(ids.includes(RETRY_BUDGET_ID)).toBe(false);
  });
});
