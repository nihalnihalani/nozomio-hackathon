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

  it("Hyperspell live search uses /memories/query and maps resources to memories", async () => {
    process.env.HYPERSPELL_API_KEY = "hs_test_key";
    process.env.HYPERSPELL_ACCOUNT_EMAIL = "yahya@example.com";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          query_id: "query_123",
          errors: [],
          documents: [
            {
              source: "slack",
              resource_id: "mem_slack_1",
              title: "Incident thread",
              memories: ["Stripe webhook retry discussion"],
              metadata: { channel: "incidents" },
              score: 0.91,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new HyperspellClient().memories.search({
      query: "stripe webhook idempotency",
      options: { limit: 1 },
    });

    expect(result.memories).toEqual([
      {
        id: "mem_slack_1",
        text: "Stripe webhook retry discussion",
        source: "slack",
        metadata: { channel: "incidents" },
        score: 0.91,
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.hyperspell.com/memories/query");
    expect((init.headers as Record<string, string>)["X-As-User"]).toBe(
      "sandbox:yahya@example.com"
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      query: "stripe webhook idempotency",
      max_results: 1,
      answer: false,
      effort: "minimal",
    });
  });

  it("Hyperspell live add uses /memories/add and returns resource_id", async () => {
    process.env.HYPERSPELL_API_KEY = "hs_test_key";
    process.env.HYPERSPELL_ACCOUNT_EMAIL = "yahya@example.com";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          source: "vault",
          resource_id: "mem_added_1",
          status: "pending",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new HyperspellClient().memories.add({
      text: "new triage memory",
      source: "triage_history",
      metadata: { orgId: "demo-org" },
    });

    expect(result).toEqual({ id: "mem_added_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.hyperspell.com/memories/add");
    expect((init.headers as Record<string, string>)["X-As-User"]).toBe(
      "sandbox:yahya@example.com"
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      text: "new triage memory",
      metadata: { orgId: "demo-org", source: "triage_history" },
    });
  });
});
