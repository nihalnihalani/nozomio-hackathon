import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HyperspellClient } from "@/lib/hyperspell/client";
import { NiaClient } from "@/lib/nia/client";

const ORIGINAL_ENV = { ...process.env };

describe("live sponsor clients", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, DEMO_MODE: "live" };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("Nia live search uses the current /v2/search messages payload", async () => {
    process.env.NIA_API_KEY = "nia_test_key";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [], recent_commits: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new NiaClient().search({
      query: "stripe webhook idempotency",
      mode: "query",
      include_sources: true,
    });

    expect(result).toEqual({ snippets: [], recent_commits: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://apigcp.trynia.ai/v2/search");
    expect(JSON.parse(String(init.body))).toMatchObject({
      mode: "query",
      messages: [
        { role: "user", content: "stripe webhook idempotency" },
      ],
      search_mode: "unified",
      include_sources: true,
    });
    expect(JSON.parse(String(init.body))).not.toHaveProperty("query");
  });

  // Hyperspell live-search/add tests removed during merge of PR #11.
  // PR #11's tests/hyperspell-live-wire.test.ts has 6 fetch-mock tests
  // that cover the same wire format with the canonical PR-#11 client
  // shape. The original tests in this file asserted a different
  // implementation shape (sandbox:user X-As-User, {id,text,source,...}
  // mapping) that PR #11 doesn't produce.
});
