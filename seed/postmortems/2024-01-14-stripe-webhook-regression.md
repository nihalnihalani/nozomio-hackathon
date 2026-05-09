# Postmortem: Stripe Webhook Regression — Duplicate Charges

> **SYNTHETIC DATA — fictional company "Acme Billing." No real PII.**

- **Date:** 2024-01-14
- **Authors:** Alex Tan (on-call), Priya Shah (eng-lead)
- **Status:** Resolved
- **Severity:** SEV-2
- **Customer impact:** 14 customers double-charged; total refunded $4,237.18

## Summary

On 2024-01-14 at 22:08 UTC, our Stripe webhook handler began processing duplicate `charge.succeeded` events as separate charges, resulting in 14 customers being charged twice for the same purchase within a 47-minute window. Root cause was a regression in `webhooks/stripe.ts` introduced two days earlier in PR #1142, which removed an in-memory dedupe cache without replacing it with a persistent idempotency check. Stripe's webhook retry logic (which fires aggressively after a 5xx response) compounded the issue: every retry re-entered `processCharge` with no defense.

A partial fix was deployed at 23:54 UTC adding a Postgres-backed dedupe table on `event.id`. The bug was contained, refunds were issued, and an action item was filed to harden the retry path with an explicit idempotency-key strategy.

## Timeline (UTC)

| Time | Event |
| --- | --- |
| 22:08 | First duplicate charge reaches Stripe; customer support pings #incidents |
| 22:11 | Alex acks; opens incident; pages Priya |
| 22:14 | Priya joins, identifies Stripe webhook as the suspect surface |
| 22:32 | Sentry confirms `processWebhook` invocations doubled vs baseline |
| 22:48 | Root cause located: PR #1142 removed `seenEventIds` Set without replacement |
| 23:02 | Stop-the-bleed: rollback considered, rejected (would lose 90 min of legitimate events) |
| 23:18 | Forward-fix: add `webhook_events` Postgres table + `idempotency.has(event.id)` check |
| 23:54 | Fix deployed; clean event flow confirmed |
| 24:48 | Refunds queued for 14 affected customers |
| 01:02 | Incident closed |

## Root cause

`webhooks/stripe.ts` (around **line 84** in the new version) is the entry point for every Stripe webhook event. Prior to PR #1142, the file maintained an in-process `Set<string>` of recently-seen `event.id`s as a fast-path dedupe. PR #1142 removed it on the (correct) grounds that an in-process Set doesn't survive process restarts and isn't shared across replicas.

The PR author intended to land a Postgres-backed replacement in a follow-up, but the follow-up was never filed. The file shipped to production with **no dedupe at all**, and Stripe's retry behavior — which fires up to 8 retries with exponential backoff for any non-2xx response — turned a single 502 from our load balancer into 4–8 duplicate `processCharge` calls per affected event.

## Impact

- **Customers affected:** 14
- **Total over-charged:** $4,237.18
- **Time to detection:** 3 min (Stripe support ping → on-call ack)
- **Time to mitigation:** 1h 46min
- **Time to resolution (refunds):** 4h 40min
- **Reputation:** 3 customer support tickets; 1 chargeback initiated (later withdrawn)

## Resolution

The forward-fix added `lib/idempotency.ts` with a `has(eventId)` helper backed by a Postgres `webhook_events(event_id text primary key)` table. `webhooks/stripe.ts` was updated to call `idempotency.has()` on entry and return early if seen. Refunds were issued via a one-off Stripe Dashboard CSV upload.

## Action items

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| AI-1 | Add Postgres-backed dedupe to webhooks/stripe.ts (DONE in this fix) | Priya | DONE |
| AI-2 | **Add a retry budget on idempotency keys** so a single event.id can't be replayed indefinitely | Alex | OPEN |
| AI-3 | Audit other webhook handlers (PayPal, Plaid) for the same gap | Ben | OPEN |
| AI-4 | Write ADR for idempotency-key policy across webhook handlers | Priya | OPEN |
| AI-5 | Add alert on `webhook_events` table growth rate as an early signal | Sara | OPEN |
| AI-6 | Stripe webhook integration test that fires the same event 8x and asserts single side-effect | Alex | OPEN |

## Lessons

1. **Removing safety nets requires a forcing function.** The PR that removed the in-process Set should have either landed the Postgres replacement in the same change or been blocked by a "no dedupe in this file" lint rule.
2. **The retry path is not the same as the first-attempt path.** Even with idempotency on entry, a buggy `event.retry === true` branch could re-enter side-effecting code. We do not currently have a test for this.
3. **Dedupe alone is not a retry budget.** A pathological producer can replay the same event.id forever; the system should refuse after N attempts.

## References

- PR #1142 (the regression)
- PR #1148 (the partial fix)
- ADR-003 (retry policy — predates this incident)
- `webhooks/stripe.ts` line 84 — current location of the webhook entry point
