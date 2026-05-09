# Hyperspell replay fixtures

Powers `DEMO_MODE=replay` for `lib/hyperspell/client.ts`'s `memories.search()`.

## Hash function (matches `lib/hyperspell/client.ts:hashKey`)

```ts
import { createHash } from "node:crypto";

function hashKey(query: string, options?: SearchOptions): string {
  const stable = JSON.stringify({
    q: query,
    w: options?.source_weights ?? { slack: 0.5, notion: 0.4, gmail: 0.1 },
    l: options?.limit ?? 5,
  });
  return createHash("sha1").update(stable).digest("hex").slice(0, 16);
}
```

Each `<hash>.json` file's `memories[]` array is the exact payload `replaySearch()` returns — same shape as `RecallOutput.memories` in `lib/types.ts`. The top-level `_query` and `_note` keys are documentation only; the loader (and the `ReplaySearchPayloadSchema` in the client) ignore unknown keys.

## Prebaked queries (default weights, limit 5)

| Query | Hash | Purpose |
| --- | --- | --- |
| `Duplicate charge processed Stripe webhook` | `0785f3ee2647c7ea` | Trace A recall — 3 memories. Retry-budget DM is intentionally absent. |
| `Duplicate refund event Stripe webhook` | `f8cc5280f1715d98` | Trace B recall — 5 memories, **including** the retry-budget DM (the wow moment) and the `mem_reinforce_*` triage_history trail. |
| `idempotency keys retry budget` | `d9fb4bf52b2c385a` | Direct hit on the planted DM — used by the reinforcement test. |
| `billing service latency` | `acde251ec4b596fc` | Control — unrelated incident; signal-vs-noise sanity. |

## The Trace-B-has-new-citation property (Invariant 2)

Trace B's response contains two memory_ids that Trace A's does not:

- `mem_slk_dm_feb18_retry_budget` — the **planted retry-budget DM**, the demo's wow citation
- `mem_reinforce_traceA_idempotency_cluster` — the **triage_history trail** showing the agent reinforced this cluster after Trace A

Both have `metadata.kind: "triage_history"` (where applicable) or `_planted_for_demo: true`. The `Memory` Zod schema in `lib/types.ts` only allows `source ∈ {slack, notion, gmail, code}`, so the triage_history reinforcement memory is encoded as `source: "slack"` with `metadata.kind: "triage_history"`. The reinforcement test (`tests/invariants/reinforcement.test.ts`) accepts either signal: the `mem_reinforce_*` id prefix OR `metadata.kind === "triage_history"`.

## Replay writes

`memories.add()` in replay mode appends to `_writes.log` (one JSON object per line). This is gitignored at the repo root via `data/replay/hyperspell/_writes.log`. The reinforcement test does not depend on it; the prewarm script may inspect it for an "ingest happened" sanity check.

## Adding a new fixture

1. Compute the hash (see `scripts/prewarm_demo.ts` or the function above).
2. Drop `<hash>.json` here with shape `{ memories: Memory[] }` (extra top-level keys are fine).
3. Add an entry under `queries` in `index.json` for human-readable lookup.
4. Round-trip through the schema with `npm test -- tests/fixtures.test.ts`.
