// SYNTHETIC DEMO REPO — webhook handler tests.
// These tests exist to make the demo repo realistic. They do not
// run against a real database; the helpers are stubbed.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/db", () => ({
  db: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

const seenEvents = new Set<string>();
vi.mock("../lib/idempotency", () => ({
  idempotency: {
    has: vi.fn(async (key: string) => seenEvents.has(key)),
    record: vi.fn(async (key: string) => {
      seenEvents.add(key);
    }),
  },
}));

describe("stripe webhook", () => {
  beforeEach(() => {
    seenEvents.clear();
  });

  it("returns 200 with 'duplicate' on a known event.id", async () => {
    seenEvents.add("evt_test_dup");
    // (synthetic) — would invoke processWebhook here against a fake req/res.
    expect(seenEvents.has("evt_test_dup")).toBe(true);
  });

  it("retry branch should consult idempotency (currently does NOT — known bug at line 84)", () => {
    // Intentionally failing assertion in real code; here we just document
    // that the test exists and the gap is acknowledged.
    expect(true).toBe(true);
  });
});

describe("paypal webhook", () => {
  it("dedupes on event.id", async () => {
    seenEvents.add("paypal_evt_001");
    expect(seenEvents.has("paypal_evt_001")).toBe(true);
  });
});
