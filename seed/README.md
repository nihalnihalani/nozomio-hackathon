# `seed/` — Synthetic Demo Data

> **Synthetic data — fictional company "Acme Billing" — no real PII or production data.**
> Every name, channel, email, customer ID, charge ID, and Sentry event in this directory is fabricated for the Triage demo. Do not infer anything about real Acme-named entities. This data exists solely to drive the 90-second demo flow described in `PLAN.md` §6.

## What lives here

| Path | Contents | Powers |
| --- | --- | --- |
| `slack.json` | 30 Slack messages across 4 months (`#incidents`, `#eng`, one DM thread). One DM is the planted "key memory" for Trace B's reinforcement beat. | Hyperspell `recallSimilarIncidents` |
| `postmortems/` | 3 Notion-style postmortems (2 related to the bug, 1 distractor) | Hyperspell `recallSimilarIncidents` |
| `gmail/vendor-outages.json` | 4 vendor-outage email threads (Stripe status, AWS, Datadog) | Hyperspell `recallSimilarIncidents` |
| `billing-service/` | A small Express/Node service (~30 files) with a planted bug at `webhooks/stripe.ts:84` — the retry path skips the idempotency check. | Nia `searchCode` (indexed via separate Git repo push) |
| `git-log.txt` | ~50 commits over 4 months, including the partial-fix and reverted retry-budget commits | Nia commit-history search |

## The narrative arc (one paragraph)

Acme Billing shipped a Stripe webhook handler in early January 2024. On 2024-01-14 a regression caused duplicate charges; Priya (eng-lead) and Alex (on-call) rolled out a partial fix that night. Three weeks later, in a private DM, Alex told Priya **"we should add a retry budget on idempotency keys, this'll bite us again."** Priya filed a WIP commit but reverted it. The team moved on — a billing-service latency incident, a design review, hires, code reviews, lunch chatter. Today (2024-05-09 03:47), Stripe is reporting duplicate charges again. The on-call has paged. The retry-budget DM is still findable in Slack history; nobody has read it for three months.

## The planted bug

`seed/billing-service/webhooks/stripe.ts` line 84:

```ts
if (event.retry) {
  // BUG: no idempotency check on retry path
  return processCharge(event);
}
const seen = await idempotency.has(event.id);
if (seen) return;
processCharge(event);
```

`lib/idempotency.ts` exports `has(key)` — but the retry branch above never calls it. `docs/ADR-007-idempotency-keys.md` argues that the system MUST use idempotency keys for every Stripe webhook. The bug is the gap between the doc and the code.

## How this gets ingested

- `scripts/ingest.ts` (owned by Person 3) reads every file in this directory and calls `hyperspell.memories.add()` once per Slack message, postmortem, and Gmail thread (~37 calls total).
- `seed/billing-service/` is pushed to its own GitHub repo and indexed by Nia separately — Nia indexes code, not Slack.
- `seed/git-log.txt` is informational (used to seed the Nia `commits` view if available); it is not ingested into Hyperspell.

## Hard rules for this directory

1. **No real PII.** All emails are `@acme.io`. Customer IDs (`cus_*`), charge IDs (`ch_*`), Sentry IDs are all fabricated.
2. **The retry-budget DM is the key memory.** It is the *only* place in this directory where the phrase "retry budget" appears in a Slack/Notion/Gmail context. That uniqueness is what drives the Trace B new-citation moment.
3. **The bug is at exactly `webhooks/stripe.ts:84`.** The agent system prompt and the test fixtures expect this exact location.
4. **All citations point inside `seed/`.** Never fabricate citation URLs that point outside this tree.

## Names used

| Name | Role | Email |
| --- | --- | --- |
| Alex | on-call engineer | `alex@acme.io` |
| Priya | eng-lead | `priya@acme.io` |
| Ben | engineer | `ben@acme.io` |
| Sara | engineer | `sara@acme.io` |

Channel names: `#incidents`, `#eng`, `DM:oncall-eng-lead` (the DM thread between Alex and Priya).
