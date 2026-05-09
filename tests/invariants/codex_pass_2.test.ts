/**
 * Tests that lock in the Codex pass-2 review findings. If any of these
 * regress, we've slipped on the rigor Codex asked for.
 */
import { describe, expect, it } from "vitest";
import { verifyCodeSnippet } from "@/lib/nia/client";
import { runAgent, type AgentEvent } from "@/lib/agent/loop";

describe("Codex pass 2 — verifier false-positive rejected (line-anchored)", () => {
  // Codex's exact probe: claim line 84 with content from line 86.
  // The previous window-based verifier returned `true`. With the new
  // line-anchored verifier, this MUST return false.
  it("rejects a snippet whose content actually came from a nearby line", async () => {
    process.env.STRICT_CITE_OR_DIE = "1";
    const ok = await verifyCodeSnippet({
      file: "webhooks/stripe.ts",
      line: 84,
      // This is the actual content of line 86 in the seed (the
      // `return processCharge(event);` body), but the claim says line 84
      // (which is `if (event.retry) {`). The verifier must reject.
      content: "return processCharge(event);",
    });
    expect(ok).toBe(false);
  });

  it("accepts the honest claim (line 84 with the actual line-84 content)", async () => {
    process.env.STRICT_CITE_OR_DIE = "1";
    const ok = await verifyCodeSnippet({
      file: "webhooks/stripe.ts",
      line: 84,
      content:
        "if (event.retry) {\n  // BUG: no idempotency check on retry path (charge branch)\n  return processCharge(event);\n}",
    });
    expect(ok).toBe(true);
  });

  it("accepts a multi-line claim that omits intervening comments (Nia reflow)", async () => {
    // Codex's false-negative case: Nia returns the bug block without the
    // intervening comment line. The verifier should accept this — the
    // first-line anchor is strict but subsequent lines tolerate skips.
    process.env.STRICT_CITE_OR_DIE = "1";
    const ok = await verifyCodeSnippet({
      file: "webhooks/stripe.ts",
      line: 84,
      content: "if (event.retry) {\nreturn processCharge(event);\n}",
    });
    expect(ok).toBe(true);
  });

  it("rejects a claim for a line that doesn't exist in the file", async () => {
    process.env.STRICT_CITE_OR_DIE = "1";
    const ok = await verifyCodeSnippet({
      file: "webhooks/stripe.ts",
      line: 9999,
      content: "anything",
    });
    expect(ok).toBe(false);
  });

  it("rejects a claim whose content shares tokens but is wrong code", async () => {
    process.env.STRICT_CITE_OR_DIE = "1";
    const ok = await verifyCodeSnippet({
      file: "webhooks/stripe.ts",
      line: 84,
      content: "if (somethingElse.retry) {\nreturn fakeFunction(event);\n}",
    });
    expect(ok).toBe(false);
  });
});

describe("Codex pass 2 — bogus traces through runAgent emit error (no fabrication)", () => {
  // Codex: "Add a behavioral test that runs bogus traces through runAgent,
  // not source grep." This wires the actual agent loop and asserts the
  // observable behavior — events emitted, no result fabrication.
  it("returns an error event for a stack trace that doesn't match any fixture", async () => {
    process.env.DEMO_MODE = "replay";
    const events: AgentEvent[] = [];
    const sink = (e: AgentEvent) => {
      events.push(e);
    };
    await runAgent(
      { trace: "hello world this is not a stack trace", orgId: "test-org-1" },
      sink
    );

    const errorEvents = events.filter((e) => e.type === "error");
    const resultEvents = events.filter((e) => e.type === "result");
    const statusErrorEvents = events.filter(
      (e) => e.type === "status" && e.status === "error"
    );

    expect(errorEvents.length).toBeGreaterThan(0);
    expect(resultEvents.length).toBe(0); // No fabricated triage
    expect(statusErrorEvents.length).toBeGreaterThan(0);
  });

  it("returns full triage events for a matching stack trace (control)", async () => {
    process.env.DEMO_MODE = "replay";
    const events: AgentEvent[] = [];
    const sink = (e: AgentEvent) => {
      events.push(e);
    };
    await runAgent(
      {
        trace:
          "Error: Duplicate charge processed for customer cus_abc123\n  at processWebhook (webhooks/stripe.ts:84)",
        orgId: "test-org-2",
      },
      sink
    );

    const resultEvents = events.filter((e) => e.type === "result");
    const statusDoneEvents = events.filter(
      (e) => e.type === "status" && e.status === "done"
    );

    expect(resultEvents.length).toBe(1);
    expect(statusDoneEvents.length).toBeGreaterThan(0);
  });
});
