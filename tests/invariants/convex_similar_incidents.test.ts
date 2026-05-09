/**
 * Codex pass-3 BLOCK lock-in — Convex mode preserves the visible
 * memory-reinforcement proof (the 🧠 badge on Trace B's reinforced memory).
 *
 * Why this test exists:
 *   The Convex `triageRuns.similarIncidents` field used to be `string[]`
 *   (memory ids only). `lib/hooks/useTriage.ts:convexSnapshotToTriageSnapshot`
 *   then hydrated those ids into placeholder `SimilarIncident` rows with
 *   blank `summary`, `relevance: 0`, and no `fromTriageHistory`. The
 *   `SimilarIncidentsCard` component renders the 🧠 badge ONLY when
 *   `incident.fromTriageHistory === true` — so in Convex mode the wow-moment
 *   proof disappeared, even though the SSE path showed it correctly.
 *
 *   This test mocks the Convex `byId` query result with the new full-shape
 *   `similarIncidents` and asserts that the hook hydration produces:
 *     - non-empty summary
 *     - non-zero relevance
 *     - at least one entry with `fromTriageHistory: true`
 *
 *   If this test starts failing, someone collapsed the schema back to
 *   `string[]` or re-introduced the placeholder-row hydration. Either way,
 *   Trace B's reinforcement badge is invisible again — Track 4 rubric block.
 */
import { describe, expect, it } from "vitest";
import { convexSnapshotToTriageSnapshot } from "@/lib/hooks/useTriage";

describe("Codex pass-3 — Convex similarIncidents preserves the 🧠 reinforcement proof", () => {
  it("hydrates the full SimilarIncident shape (summary, relevance, fromTriageHistory)", () => {
    // Shape mirrors what `convex/triage.byId` returns after the
    // `finalizeResult` mutation persists the full SimilarIncident shape.
    const fakeConvexByIdResult = {
      run: {
        _id: "triage_run_test_id" as unknown as string,
        orgId: "demo-org",
        inputTrace: "stripe webhook duplicate charge",
        status: "done" as const,
        startedAt: 1_700_000_000_000,
        finishedAt: 1_700_000_001_000,
        timeline: [{ at: "t0", event: "started" }],
        rootCause: { text: "duplicate charge", citations: [] },
        suspectedFix: {
          file: "webhooks/stripe.ts",
          line: 84,
          diff: "+ idempotency",
          citations: [],
        },
        similarIncidents: [
          {
            memory_id: "mem_slk_dm_feb18_retry_budget",
            summary:
              "Feb 18 DM about retry budget exhaustion → matches webhook retry path.",
            relevance: 0.92,
            fromTriageHistory: true,
          },
          {
            memory_id: "mem_notion_runbook_idempotency",
            summary: "Idempotency runbook covering the charge branch.",
            relevance: 0.71,
            // no fromTriageHistory — should remain undefined
          },
        ],
      },
      toolCalls: [],
      citations: [],
      memoryEvents: [],
    };

    const snapshot = convexSnapshotToTriageSnapshot(fakeConvexByIdResult);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.similarIncidents).toBeDefined();
    expect(snapshot!.similarIncidents).toHaveLength(2);

    const [first, second] = snapshot!.similarIncidents!;

    // Non-placeholder summary (the bug was: summary === "")
    expect(first.summary).not.toBe("");
    expect(first.summary.length).toBeGreaterThan(0);
    expect(second.summary).not.toBe("");

    // Non-zero relevance (the bug was: relevance === 0)
    expect(first.relevance).toBeGreaterThan(0);
    expect(second.relevance).toBeGreaterThan(0);
    expect(first.relevance).toBe(0.92);

    // At least one entry carries `fromTriageHistory: true` — this is the
    // exact bit SimilarIncidentsCard checks for the 🧠 badge.
    const hasReinforced = snapshot!.similarIncidents!.some(
      (s) => s.fromTriageHistory === true
    );
    expect(
      hasReinforced,
      "At least one similar incident must carry fromTriageHistory: true so SimilarIncidentsCard renders the 🧠 badge in Convex mode (the visible reinforcement proof)."
    ).toBe(true);

    // memory_id round-trips
    expect(first.memory_id).toBe("mem_slk_dm_feb18_retry_budget");
    expect(second.memory_id).toBe("mem_notion_runbook_idempotency");
  });

  it("returns undefined similarIncidents when the run has none yet", () => {
    const fakeConvexByIdResult = {
      run: {
        _id: "triage_run_pending" as unknown as string,
        orgId: "demo-org",
        inputTrace: "stripe webhook duplicate charge",
        status: "running" as const,
        startedAt: 1_700_000_000_000,
        // similarIncidents intentionally absent
      },
      toolCalls: [],
      citations: [],
      memoryEvents: [],
    };
    const snapshot = convexSnapshotToTriageSnapshot(fakeConvexByIdResult);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.similarIncidents).toBeUndefined();
  });
});
