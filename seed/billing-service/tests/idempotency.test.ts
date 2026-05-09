// SYNTHETIC DEMO REPO — idempotency helper tests.
import { describe, it, expect, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("../lib/db", () => ({
  db: { query: queryMock },
}));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { idempotency } = await import("../lib/idempotency");

describe("idempotency.has", () => {
  it("returns true when the event_id row exists", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    expect(await idempotency.has("evt_001")).toBe(true);
  });

  it("returns false when no row exists", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    expect(await idempotency.has("evt_002")).toBe(false);
  });
});

describe("idempotency.record", () => {
  it("inserts on conflict do nothing", async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await idempotency.record("evt_003");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("on conflict do nothing"),
      ["evt_003"],
    );
  });
});
