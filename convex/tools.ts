import { action } from "./_generated/server";
import { v } from "convex/values";

const HYPERSPELL_URL = "https://api.hyperspell.com/memories/query";

export const recallSimilarIncidents = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
    sources: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const token = process.env.HYPERSPELL_USER_TOKEN;
    if (!token) throw new Error("HYPERSPELL_USER_TOKEN not set in Convex env");

    const body: Record<string, unknown> = {
      query: args.query,
      max_results: args.maxResults ?? 5,
    };
    if (args.sources && args.sources.length > 0) {
      body.sources = args.sources;
    }

    const startedAt = Date.now();
    const res = await fetch(HYPERSPELL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - startedAt;

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      throw new Error(`Hyperspell ${res.status} (${latencyMs}ms): ${text}`);
    }

    return { latencyMs, data: parsed };
  },
});
