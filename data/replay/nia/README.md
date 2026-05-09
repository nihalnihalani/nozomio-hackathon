# Nia replay fixtures

Powers `DEMO_MODE=replay` for `lib/nia/client.ts`'s `search()`.

## Hash function (matches `lib/nia/client.ts:hashKey`)

```ts
import { createHash } from "node:crypto";

function hashKey(query: string, mode: NiaMode): string {
  return createHash("sha1").update(`${mode}:${query}`).digest("hex").slice(0, 16);
}
```

Mode defaults to `"query"`. Each `<hash>.json` matches the `SearchCodeOutputSchema` shape in `lib/types.ts`: `{ snippets: CodeSnippet[], recent_commits: CodeCommit[] }`. Top-level `_query` and `_note` keys are documentation only and ignored by the loader.

## Verifier note (Invariant 1, Cite-Or-Die)

In live mode `lib/nia/client.ts` re-reads `seed/billing-service/{file}` and asserts the claimed line contains the claimed content. **In replay mode the verifier does not run** — the fixture's snippet is trusted as-is. The fixtures here are hand-curated to mirror what the seed repo contains; they are the source of truth for the demo path.

When the seed-repo is empty (early development), `verifyCodeSnippet()` is permissive (returns `true` unless `STRICT_CITE_OR_DIE=1`). The invariant test (`tests/invariants/cite_or_die.test.ts`) asserts shape — every snippet has `file` + `line`, every citation has `source_id` + `excerpt` + `verified` boolean — not byte-for-byte content match.

## Prebaked queries

| Query | Hash | Purpose |
| --- | --- | --- |
| `processWebhook stripe.ts retry idempotency` | `33fb18b841fa1b6b` | Trace A — buggy line 84 + ADR-007 + idempotency.ts helper |
| `processWebhook stripe.ts refund retry` | `a08b869370c6cac0` | Trace B — buggy line 91 (refund branch, same root-cause class) |
| `billing service database connection` | `9c1aa0ed4cbf383d` | Control — unrelated; signal-vs-noise sanity |
