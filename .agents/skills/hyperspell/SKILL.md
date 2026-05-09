---
name: hyperspell
description: Use Hyperspell — the company brain for AI agents — to ingest from Slack/Notion/Gmail/Drive/GitHub and recall multi-source memories for agent tools. Triggers on tasks involving Hyperspell SDK, memories.query/add, source weighting, or the official MCP server.
---

# Hyperspell

> Hyperspell is the company brain for AI agents — it ingests workspace data
> (Slack, Gmail, Notion, Google Drive, GitHub, and more) and exposes a
> unified `memories` API the agent can query for cross-source recall.

This skill is the project-local quickstart used by **Triage**. The Hyperspell
team's authoritative docs live at https://docs.hyperspell.com — defer to those
for anything not covered here.

## When to use this skill

- You need to add a Hyperspell tool to an agent loop (`recallSimilarIncidents`,
  source-weighted recall, multi-tenant `userId` scoping)
- You need to ingest documents/messages into Hyperspell (`memories.add`)
- You're wiring the official Hyperspell MCP server into an agent
- You're debugging auth: API key vs JWT user token vs `X-As-User`

## Setup

Install the SDK:

```bash
npm install @hyperspell/hyperspell
```

This project has it pinned at `^0.38.0` in `package.json`.

## Authentication — three modes (pick one)

| Mode | Header | Use when |
|---|---|---|
| API key + X-As-User | `Authorization: Bearer $HYPERSPELL_API_KEY` + `X-As-User: $userId` | Server-side, multi-tenant — your code acts on behalf of a user |
| JWT user token | `Authorization: Bearer $HYPERSPELL_USER_TOKEN` | Pre-scoped to a single user, no `X-As-User` needed |
| Hyperspell-issued JWT | `Authorization: Bearer <jwt>` | Generated server-side via `HYPERSPELL_JWT_SECRET`, scoped to one user |

The JWT user token in this project's `.env` (`HYPERSPELL_USER_TOKEN`) is
self-scoped to `yahya.s.alhinai@gmail.com` (`sub` claim). For the demo's
agent code, use the API key (`HYPERSPELL_API_KEY`) and pass the user id
explicitly so multi-tenant intent is obvious.

## API surface used in this project

### POST /memories/query — recall

```ts
const res = await fetch("https://api.hyperspell.com/memories/query", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.HYPERSPELL_API_KEY}`,
    "X-As-User": userId,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: "stripe webhook idempotency",
    max_results: 5,
    sources: ["slack", "notion"], // optional — omit to query all sources
    options: {
      slack: { weight: 0.5 },
      notion: { weight: 0.4 },
      google_mail: { weight: 0.1 },
    },
  }),
});
const { query_id, documents, errors } = await res.json();
```

Source weighting goes inside `options.<source>.weight`, NOT a top-level
`source_weights` field (that was a documentation guess in PLAN.md §5;
the canonical shape is per-source-options).

### POST /memories/add — ingest + reinforce

```ts
await hyperspell.memories.add({
  text: "Slack: 'add a retry budget on idempotency keys'",
  source: "slack",
  metadata: {
    channel: "DM",
    author: "oncall",
    ts: "2024-02-18T22:14:51Z",
    // The reinforcement metadata that Triage uses (Invariant 2):
    reinforces: ["mem_slk_jan14_thread_001", "mem_ntn_pm_2024_01_14"],
  },
});
```

After a triage run, write a `triage_history` source memory with the matched
memory_ids in `metadata.reinforces` — this biases the next recall toward
the just-reinforced cluster. **In this project, only `convex/reinforce-
Node.ts` writes `triage_history` memories** (Invariant 2 hard rule).

## Sources

`slack`, `notion`, `google_mail` (Gmail), `google_drive`, `box`,
`google_calendar`, `vault` (uploaded docs), `web_crawler`, `reddit`,
`github`. See `QueryOptions` schema at
https://docs.hyperspell.com/api-reference/memories/query-memories.

## Replay / hermetic mode

The Hyperspell client wrapper at `lib/hyperspell/client.ts` checks
`process.env.DEMO_MODE`:
- `replay` (default) → returns cached fixtures from `data/replay/hyperspell/`,
  no network calls
- `live` → makes real HTTP calls

Per Invariant 4 in `CLAUDE.md`, every outbound call must have a replay branch.

## Official MCP server

```bash
npx -y -p @hyperspell/hyperspell-mcp@latest mcp-server
```

with these env vars (note the names — the MCP server uses `HYPERSPELL_TOKEN`
and `HYPERSPELL_USER_ID`, NOT the API key + email vars):

```
HYPERSPELL_TOKEN=<your hs2-... API key>
HYPERSPELL_USER_ID=<email or user identifier>
```

This project's `.claude.json` registers it under the name `hyperspell` — you
can verify with `claude mcp get hyperspell`. Note: the unscoped `hyperspell-
mcp` package on npm is **deprecated**; always use the scoped
`@hyperspell/hyperspell-mcp` form.

## Common pitfalls

- **Wrong env var names for MCP.** The MCP wants `HYPERSPELL_TOKEN`, not
  `HYPERSPELL_API_KEY`. The two are the same value, just under different
  variable names — set both.
- **`NoResultsForSource: vault` errors.** Informational, not a failure.
  The default `vault` source is empty until you upload documents.
- **Source weighting shape.** It's per-source nested in `options`, not a
  flat `source_weights` map.
- **JWT expiry.** The `HYPERSPELL_USER_TOKEN` in this project's `.env`
  expires at `HYPERSPELL_USER_TOKEN_EXPIRES_AT` (~24h after issue). For
  long-lived demos, prefer the API key + X-As-User pattern.

## Where it's used in this project

- `lib/hyperspell/client.ts` — SDK wrapper with replay-mode logic
- `convex/toolsNode.ts` — `recallSimilarIncidents` Convex action
- `convex/reinforceNode.ts` — the SOLE writer of `triage_history` memories
- `data/replay/hyperspell/` — pre-baked fixture cache for hermetic demo
- `scripts/ingest.ts` — one-shot ingest of `seed/slack.json`,
  `seed/postmortems/`, `seed/gmail/` into a real Hyperspell workspace
