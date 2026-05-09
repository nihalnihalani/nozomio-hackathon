# Postmortem: Payment Double-Charge — Stripe Webhook Double-Fire

> **SYNTHETIC DATA — fictional company "Acme Billing." No real PII.**

- **Date:** 2023-11-02
- **Authors:** Sara Chen (on-call), Priya Shah (eng-lead)
- **Status:** Resolved
- **Severity:** SEV-3
- **Customer impact:** 3 customers double-charged; total refunded $612.40

## Summary

On 2023-11-02 between 14:22 and 14:31 UTC, three customers received duplicate charges on identical Stripe events. Investigation traced the cause to a Stripe-side network issue that caused Stripe to deliver the same webhook event twice within ~30 seconds. Our handler at the time had no dedupe — it simply trusted that Stripe wouldn't double-deliver. It does, occasionally, by design (Stripe documents at-least-once webhook delivery semantics).

Mitigation was a quick in-process `Set<string>` of recent `event.id`s, sized at 10,000 entries with FIFO eviction. This was a stopgap; it does not survive process restarts and does not share state across replicas. We knew this at the time and accepted the risk.

## Timeline (UTC)

| Time | Event |
| --- | --- |
| 14:22 | First duplicate charge succeeds |
| 14:28 | Customer support ticket arrives |
| 14:31 | Third (and final) duplicate processed |
| 14:33 | Sara acks; opens incident |
| 14:47 | Root cause hypothesized: Stripe re-delivery |
| 15:04 | Confirmed via Stripe dashboard webhook log: same event.id, two delivery attempts 28 sec apart, both 200 OK from us |
| 15:22 | In-process Set deployed |
| 15:48 | Refunds issued |
| 16:00 | Incident closed |

## Root cause

Stripe documents that webhook delivery is at-least-once: any given event.id may be delivered more than once due to network retries on Stripe's side. Our handler at the time treated each delivery as a fresh event. The mitigation was to add an in-process Set keyed on `event.id` with the last 10,000 entries.

This is **not a complete fix**. It does not handle:
- Process restarts (Set is dropped)
- Multi-replica deployments (Sets are not shared)
- Sustained replay attacks (a single event.id replayed 10,001 times would evict the original entry and re-process)

Filed AI-1 to migrate to a persistent dedupe layer.

## Impact

- **Customers affected:** 3
- **Total over-charged:** $612.40
- **Time to detection:** 6 min (customer ticket → on-call ack)
- **Time to mitigation:** 1h
- **Time to resolution:** 1h 38min

## Action items

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| AI-1 | Migrate dedupe to persistent (Postgres or Redis) | Priya | DEFERRED — completed Jan 2024 (see 2024-01-14 postmortem) |
| AI-2 | Add Stripe webhook delivery monitoring | Sara | DONE |
| AI-3 | Document Stripe at-least-once semantics in our wiki | Sara | DONE |

## Lessons

1. **At-least-once is the default for webhook delivery from any major SaaS.** Anything that processes Stripe / Twilio / GitHub webhook events without a persistent dedupe is, by definition, a latent duplicate-side-effect bug.
2. **In-process state does not survive production realities.** This was knowingly a stopgap; we should have prioritized the persistent fix sooner.
