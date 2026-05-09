/**
 * Hyperspell live-wire format tests.
 *
 * Locks in the request shape we send to Hyperspell and the response shape
 * we parse back, per the 2026-05-09 endpoint correction (`/v1/memories/search`
 * → `/memories/query`, `/v1/memories` → `/memories/add`, drop `source_weights`,
 * read `metadata.source` round-trip). A future regression to the old paths
 * or response keys will fail these tests deterministically.
 *
 * Strategy: mock global `fetch`, force live mode by setting
 * `HYPERSPELL_API_KEY` + `DEMO_MODE=live`, capture every request, and assert
 * exact paths + body shapes + parsed memory objects.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

// Cache-busting: each call produces a unique alphanumeric query string so
// vitest's vite transform doesn't choke (decimals get parsed as loader values).
let _modCounter = 0;
const mod = () => `../lib/hyperspell/client.ts?id=t${Date.now()}_${++_modCounter}`;

interface CapturedCall {
  url: string;
  method: string | undefined;
  body: unknown;
  headers: Record<string, string>;
}

function mockFetchOk(payload: unknown): {
  fetchSpy: Mock;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(
        init.headers as Record<string, string>
      )) {
        headers[k.toLowerCase()] = v;
      }
    }
    calls.push({
      url,
      method: init?.method,
      body:
        typeof init?.body === "string" ? JSON.parse(init.body as string) : null,
      headers,
    });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchSpy);
  return { fetchSpy, calls };
}

describe("hyperspell client — live wire format", () => {
  let savedKey: string | undefined;
  let savedMode: string | undefined;
  let savedBase: string | undefined;

  beforeEach(() => {
    savedKey = process.env.HYPERSPELL_API_KEY;
    savedMode = process.env.DEMO_MODE;
    savedBase = process.env.HYPERSPELL_API_BASE;
    process.env.HYPERSPELL_API_KEY = "test-key-abc";
    process.env.DEMO_MODE = "live";
    process.env.HYPERSPELL_API_BASE = "https://api.hyperspell.com";
  });

  afterEach(() => {
    process.env.HYPERSPELL_API_KEY = savedKey;
    process.env.DEMO_MODE = savedMode;
    process.env.HYPERSPELL_API_BASE = savedBase;
    vi.unstubAllGlobals();
  });

  it("memories.search hits POST /memories/query with options.max_results and bearer auth", async () => {
    const { calls } = mockFetchOk({
      query_id: "q123",
      documents: [
        {
          source: "slack",
          resource_id: "mem_abc",
          title: "Hello world",
          metadata: { channel: "#incidents" },
          score: 0.91,
        },
      ],
      errors: null,
      answer: null,
    });

    const { getHyperspell } = await import(mod());
    const result = await getHyperspell().memories.search({
      query: "duplicate charge",
      options: { source_weights: { slack: 0.5 }, limit: 7 },
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.url).toBe("https://api.hyperspell.com/memories/query");
    expect(call.method).toBe("POST");
    expect(call.headers["authorization"]).toBe("Bearer test-key-abc");

    // The body must NOT carry the fabricated `source_weights` or top-level
    // `limit` (regression guard for the 2026-05-09 fix).
    const body = call.body as Record<string, unknown>;
    expect(body.query).toBe("duplicate charge");
    expect(body).not.toHaveProperty("source_weights");
    expect(body.options).toEqual({ max_results: 7 });
    expect(body).not.toHaveProperty("limit");

    // Response parser must read `documents[]`, not the old `results[]`.
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0]).toMatchObject({
      id: "mem_abc",
      text: "Hello world",
      source: "slack",
      score: 0.91,
    });
  });

  it("memories.search prefers metadata.source over top-level source (round-trip safety)", async () => {
    mockFetchOk({
      documents: [
        {
          // top-level source is "vault" (Hyperspell's default for direct adds)
          // — not in our SourceType enum.
          source: "vault",
          resource_id: "mem_round_trip",
          title: "Slack-equivalent memory ingested via liveAdd",
          // liveAdd writes the logical source under metadata.source
          metadata: { source: "slack", channel: "#incidents" },
          score: 0.74,
        },
      ],
      errors: null,
    });

    const { getHyperspell } = await import(mod());
    const result = await getHyperspell().memories.search({
      query: "anything",
    });

    // Logical source from metadata wins; without the round-trip fix this
    // memory would either be classified as "vault" (failing schema) or
    // dropped entirely. With the fix it comes back as "slack".
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].source).toBe("slack");
  });

  it("memories.search drops documents that lack title (cite-or-die)", async () => {
    mockFetchOk({
      documents: [
        { source: "slack", resource_id: "no_title_1", metadata: {} },
        {
          source: "slack",
          resource_id: "with_title",
          title: "real",
          metadata: {},
        },
      ],
      errors: null,
    });
    const { getHyperspell } = await import(mod());
    const r = await getHyperspell().memories.search({ query: "x" });
    expect(r.memories.map((m: { id: string }) => m.id)).toEqual([
      "with_title",
    ]);
  });

  it("memories.add hits POST /memories/add with metadata.source encoding", async () => {
    const { calls } = mockFetchOk({
      source: "vault",
      resource_id: "added_xyz",
      status: "pending",
    });

    const { getHyperspell } = await import(mod());
    const out = await getHyperspell().memories.add({
      text: "Trace A reinforced something",
      source: "triage_history",
      metadata: { reinforces: ["mem_a"] },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.hyperspell.com/memories/add");
    expect(calls[0].method).toBe("POST");

    // The body must NOT carry a top-level `source` field (regression guard).
    const body = calls[0].body as Record<string, unknown>;
    expect(body).not.toHaveProperty("source");
    expect(body.text).toBe("Trace A reinforced something");
    expect(body.metadata).toEqual({
      reinforces: ["mem_a"],
      source: "triage_history",
    });

    // Response parser must read `resource_id`, not `id`/`memory_id`.
    expect(out.id).toBe("added_xyz");
  });

  it("memories.add throws if response omits resource_id", async () => {
    mockFetchOk({ status: "pending" }); // no resource_id
    const { getHyperspell } = await import(mod());
    await expect(
      getHyperspell().memories.add({ text: "x", source: "slack" })
    ).rejects.toThrow(/missing resource_id/);
  });
});
