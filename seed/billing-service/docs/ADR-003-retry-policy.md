# ADR-003: Retry Policy for Outbound Calls

> **SYNTHETIC DEMO REPO — fictional Acme Billing.**

- **Status:** Accepted
- **Date:** 2023-09-12
- **Author:** Priya Shah

## Context

Outbound calls to payment providers (Stripe, PayPal) and downstream services (the customer-data API, the analytics ingest pipeline) occasionally fail with transient errors. Without a retry policy each transient failure becomes a customer-visible failure.

## Decision

We retry idempotent outbound calls with exponential backoff. The policy:

- **Maximum retries:** 5
- **Base delay:** 200ms
- **Backoff factor:** 2x (200ms, 400ms, 800ms, 1.6s, 3.2s)
- **Max total wait:** ~6.2s per call
- **Jitter:** ±25% on each delay
- **Eligible errors:** 5xx, 408 (timeout), 429 (rate-limited), connection errors. **Not** 4xx (those indicate a programming or data error and shouldn't be retried).
- **Idempotency:** retries MUST use the same idempotency key as the original request — otherwise we duplicate side effects.

## Inbound retries (i.e. someone calling US)

This ADR only governs **outbound** retries. Inbound retries (Stripe retrying us; PayPal retrying us) are governed by ADR-007 and the providers' own retry semantics. The relevant property on the inbound side is **idempotency on event.id**, not retry counts.

## Consequences

- Implemented as a thin wrapper in `lib/retry.ts` (not yet refactored — currently inlined per-call).
- Slow tail latency: any call that exhausts retries waits ~6.2s before failing.
- We never retry 401 / 403 — those indicate a credentials problem and retrying just spams the provider.

## Related

- ADR-007 — Idempotency keys (inbound side)
- Postmortem 2023-11-02 (Stripe re-delivery; not caused by our retries)
