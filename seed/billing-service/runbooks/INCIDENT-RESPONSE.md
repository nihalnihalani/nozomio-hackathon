# Runbook: Billing-Service Incident Response

> **SYNTHETIC DEMO REPO — fictional Acme Billing.** On-call playbook for production incidents involving the billing-service.

## Pager triage (first 5 minutes)

1. **Acknowledge the page** in PagerDuty or `#incidents`.
2. **Identify the surface.** What's broken — Stripe webhooks, PayPal webhooks, REST endpoints, DB?
3. **Check `#incidents` for context.** Is anyone else already on this?
4. **Check the Datadog dashboard** at `acme/dashboards/billing-overview`. Look at:
   - p50/p95/p99 latency for `/webhooks/stripe`, `/webhooks/paypal`, `/charges`, `/refunds`
   - Error rate (Sentry feed)
   - Stripe webhook event volume vs baseline
   - DB connection pool utilization
5. **Open an incident** in the `#incidents` channel with the Sentry event ID and a one-line summary.

## Decision tree by symptom

### Symptom: duplicate charges / duplicate refunds

**Most likely cause:** webhook handler not enforcing idempotency on every code path.

1. Check Stripe Dashboard → Webhooks → Recent deliveries. Any event delivered more than once with our endpoint returning 200 to multiple deliveries?
2. If yes, the handler is missing a dedupe check. Refer to `docs/ADR-007-idempotency-keys.md`.
3. Look at `webhooks/stripe.ts`. Confirm both the first-attempt and the retry branches call `idempotency.has(event.id)`.
4. **Known gap:** the retry branch at `webhooks/stripe.ts:84` does NOT call `idempotency.has()`. This is tracked as AI-2 in postmortem 2024-01-14. If that gap is the cause, the immediate mitigation is a hotfix that adds the missing check.
5. **Customer impact mitigation:** pull a list of customer IDs with duplicate `charge_id` values; queue refunds via the Stripe Dashboard CSV upload tool.

### Symptom: 5xx rate spike on /webhooks/stripe

1. Is Stripe itself having an incident? Check status.stripe.com.
2. Check our DB. If `webhook_events` insert is timing out, `processWebhook` is failing on `idempotency.record()`. See ADR-007.
3. Check Sentry for the underlying exception class.

### Symptom: REST endpoint p95 latency > SLO

1. DB connection pool saturated? Check Datadog `pg.pool.busy_connections`.
2. If yes, check whether the analytics workload is co-tenanted (see postmortem 2024-03-07). If yes, fail over reads to replica.
3. If no, check for slow query log in `pg_stat_statements`.

### Symptom: complete service down

1. K8s health: `kubectl get pods -n billing -l app=billing-service`.
2. If no pods Ready, check the deployment events.
3. If it's a deploy that broke things: roll back via the standard deploy tool. Do NOT debug forward during an outage.

## Escalation

- **SEV-1 (active money loss, customer-facing outage):** page eng-lead immediately, post in `#incidents-customer-facing`, notify Trust & Safety.
- **SEV-2 (degraded service, customer impact):** post in `#incidents`, page eng-lead within 10 min if no progress.
- **SEV-3 (degraded internal metrics, no customer impact):** post in `#incidents`, handle async.

## Post-incident

Within 24 hours:

1. Open a postmortem doc using the template at `docs/POSTMORTEM-TEMPLATE.md`.
2. Schedule a postmortem review meeting within a week.
3. File action items as Linear tickets, owners assigned, due dates set.

Postmortems live in Notion. Recent ones referenced from this codebase:
- `2024-01-14-stripe-webhook-regression` — relevant to most Stripe webhook incidents
- `2023-11-02-payment-double-charge` — relevant to any duplicate-side-effect bug
- `2024-03-07-billing-service-latency` — relevant to DB-saturation symptoms
