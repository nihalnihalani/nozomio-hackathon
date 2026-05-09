# billing-service (synthetic demo repo)

> **SYNTHETIC** — Fictional "Acme Billing" payments service. Built solely to power the Triage hackathon demo. Not production code, not a real product, no real customer data.

## What this is

A small Express + Postgres payments service that handles charges, refunds, and webhook events from Stripe and PayPal. It exists for one reason: to give the Triage agent a realistic-shaped codebase to search via Nia, with a planted bug at a known file:line for the demo's "find the root cause" beat.

## The planted bug

`webhooks/stripe.ts` line 84 — the retry branch returns from `processWebhook` without consulting `idempotency.has(event.id)`. The first-attempt branch dedupes correctly; the retry branch does not. Under heavy Stripe retry pressure, the same `event.id` can be processed multiple times, causing duplicate charges.

`lib/idempotency.ts` exports the `has(key)` helper that the retry path *should* be calling. `docs/ADR-007-idempotency-keys.md` argues for using idempotency keys on every Stripe webhook event. The bug is the gap between the doc and the code.

## Layout

```
billing-service/
├── app.ts                      # Express entry point
├── webhooks/
│   ├── stripe.ts               # ★ bug at line 84
│   └── paypal.ts               # control file
├── routes/
│   ├── charges.ts
│   └── refunds.ts
├── models/
│   ├── charge.ts
│   └── refund.ts
├── lib/
│   ├── db.ts
│   ├── idempotency.ts          # ★ has() exists; retry path doesn't call it
│   └── logger.ts
├── docs/
│   ├── ADR-001-architecture.md
│   ├── ADR-003-retry-policy.md
│   └── ADR-007-idempotency-keys.md   # ★ "use idempotency keys for Stripe webhooks"
├── runbooks/
│   └── INCIDENT-RESPONSE.md
└── tests/
    └── webhooks.test.ts
```

## Running it (don't)

This repo does not actually run. The code is realistic in shape but is not wired to a real database or Stripe account. It exists to be indexed by Nia and read by Triage.
