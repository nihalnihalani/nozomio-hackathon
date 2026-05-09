# ADR-001: Service Architecture

> **SYNTHETIC DEMO REPO — fictional Acme Billing.**

- **Status:** Accepted
- **Date:** 2023-07-04
- **Author:** Priya Shah

## Context

Acme is splitting the monolith. The first piece carved out is **billing** — every code path that touches money. Goals:

1. A single audit-grade source of truth for charges and refunds.
2. Clear ownership boundary — one team owns this service end-to-end.
3. Defense-in-depth around payment provider integrations.

## Decision

`billing-service` is an Express + Postgres service deployed as a Kubernetes Deployment with 4 replicas behind an internal ALB. It owns:

- The `charges` and `refunds` Postgres tables (own schema, own credentials)
- All Stripe and PayPal webhook handlers
- The client-facing `/charges` and `/refunds` REST endpoints

It does NOT own:

- Customer data (lives in `customer-service`)
- Analytics rollups (lives in `analytics-pipeline`)
- Subscription lifecycle (lives in `subscriptions-service`)

## Component map

```
                  ┌─────────────────────┐
   client ──────► │   billing-service   │ ◄─── Stripe webhooks
                  │  - /charges         │
                  │  - /refunds         │ ◄─── PayPal webhooks
                  │  - /webhooks/stripe │
                  │  - /webhooks/paypal │
                  └────────┬────────────┘
                           │
                           ▼
                   ┌────────────────┐
                   │   Postgres     │
                   │  charges       │
                   │  refunds       │
                   │  webhook_events│
                   └────────────────┘
```

## Consequences

- We pay the cost of distributed consistency at the service boundary (e.g. customer existence is checked via `customer-service` API, not a foreign key).
- Webhook receivers and client-facing routes share the same process. This is fine at our scale; if it ever isn't, splitting them is a one-day refactor.
