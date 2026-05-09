# ADR-007: Idempotency Keys for Stripe Webhooks

> **SYNTHETIC DEMO REPO — fictional Acme Billing.** Architecture decision record for how the demo repo argues idempotency policy. The text is realistic in shape; the company is not real.

- **Status:** Accepted
- **Date:** 2024-04-15
- **Author:** Ben Park
- **Reviewers:** Priya Shah, Sara Chen
- **Supersedes:** Inline implementation in `webhooks/stripe.ts` (no prior ADR)
- **Related:** ADR-003 (Retry Policy), Postmortems 2023-11-02 and 2024-01-14

## Context

We have been bitten twice by duplicate side effects on Stripe webhook events:

1. **2023-11-02** — Stripe re-delivered the same `event.id` 28 seconds apart due to network retry on their side; we processed both and double-charged 3 customers.
2. **2024-01-14** — A regression PR removed the in-process dedupe Set; under aggressive Stripe retry pressure, 14 customers were double-charged.

Both incidents have the same shape: **a single Stripe event was processed more than once because our handler did not enforce idempotency**.

Stripe's webhook delivery guarantee is **at-least-once**, not exactly-once. This is documented (https://stripe.com/docs/webhooks#best-practices) and is non-negotiable from our side. The only correct response is to make every handler idempotent.

## Decision

**Every Stripe webhook handler MUST consult a persistent idempotency check on `event.id` before performing any side effect, on every code path including retry paths.**

Concretely:

1. The first thing a webhook handler does (after signature verification) is call `idempotency.has(event.id)`. If `true`, return 200 immediately without side effects.
2. After committing all side effects for an event, the handler calls `idempotency.record(event.id)` so subsequent deliveries are recognized as duplicates.
3. **The retry path is the same path.** A handler that has a separate code branch for `event.retry === true` MUST still consult `idempotency.has()` on that branch. There is no scenario in which "this is a retry" justifies skipping the dedupe check — quite the opposite.
4. Idempotency state is stored in a Postgres table `webhook_events(event_id text primary key, recorded_at timestamptz default now())`. In-process Sets are explicitly prohibited (they don't survive process restarts and don't share state across replicas).

## Consequences

- Every Stripe webhook handler now has a uniform dedupe shape. The helper lives in `lib/idempotency.ts`.
- The `webhook_events` table grows unboundedly until pruned. We accept this; pruning is a separate ticket (AI-3 in postmortem 2024-01-14).
- The `idempotency.has()` call adds one DB round-trip per webhook event. p99 latency at our current event volume is acceptable (<5ms).

## Open follow-ups

- **Retry budget** — `idempotency.has()` answers "have we seen this event before?" but does not bound how many times the same `event.id` can be replayed before we refuse. A sustained retry storm against the same event would re-trigger the dedupe check millions of times. AI-2 in postmortem 2024-01-14 calls for an explicit retry budget — currently OPEN.
- **PayPal & Plaid handlers** — same pattern should apply. AI-3 in postmortem 2024-01-14 — currently OPEN.
- **Cross-handler audit** — verify no handler bypasses the helper. The current `webhooks/stripe.ts` retry branch DOES bypass it (line 84) — known gap.

## Rejected alternatives

- **In-process Set** — was the 2023-11-02 mitigation; failed under multi-replica deploys.
- **Redis-backed dedupe** — adds an operational dependency for a query that Postgres handles fine at our volume. Revisit at >100 events/sec sustained.
- **Stripe-side idempotency keys** — Stripe's idempotency key feature is for client-initiated requests, not webhook event delivery. Different mechanism, doesn't apply here.
