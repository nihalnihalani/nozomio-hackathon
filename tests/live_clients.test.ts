import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HyperspellClient } from "@/lib/hyperspell/client";
import { NiaClient } from "@/lib/nia/client";
import { InsForgeClient } from "@/lib/insforge/client";
import { getDemoMode } from "@/lib/types";

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

  it("runtime mode defaults to live when DEMO_MODE is unset", () => {
    delete process.env.DEMO_MODE;
    expect(getDemoMode()).toBe("live");
  });

  it("Hyperspell live search fails closed when the API key is missing", async () => {
    delete process.env.HYPERSPELL_API_KEY;
    await expect(
      new HyperspellClient().memories.search({ query: "duplicate charge" })
    ).rejects.toThrow(/HYPERSPELL_API_KEY is required/);
  });

  it("Nia live search fails closed when the API key is missing", async () => {
    delete process.env.NIA_API_KEY;
    await expect(
      new NiaClient().search({ query: "stripe webhook idempotency" })
    ).rejects.toThrow(/NIA_API_KEY is required/);
  });

  it("InsForge live mirror reports missing configuration as a failure", async () => {
    delete process.env.INSFORGE_BASE_URL;
    delete process.env.INSFORGE_ANON_KEY;
    delete process.env.INSFORGE_SERVICE_ROLE_KEY;

    await expect(
      new InsForgeClient().mirrorIncident({
        orgId: "org_prod",
        triageRunId: "run_1",
        trace: "Error: duplicate charge",
        rootCause: "duplicate webhook event",
      })
    ).resolves.toMatchObject({ ok: false });
  });

  // Hyperspell live-search/add tests removed during merge of PR #11.
  // PR #11's tests/hyperspell-live-wire.test.ts has 6 fetch-mock tests
  // that cover the same wire format with the canonical PR-#11 client
  // shape. The original tests in this file asserted a different
  // implementation shape (sandbox:user X-As-User, {id,text,source,...}
  // mapping) that PR #11 doesn't produce.
});
