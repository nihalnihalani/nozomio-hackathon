# Runbook: Debug a Stripe Webhook Issue

> **SYNTHETIC DEMO REPO — fictional Acme Billing.**

Use this runbook when Stripe-side webhook events appear to be lost, duplicated, or processed incorrectly.

## 0. Confirm Stripe is healthy

- https://status.stripe.com — any active incidents?
- Stripe Dashboard → Webhooks → your endpoint → Recent deliveries. Is Stripe successfully reaching you (200 vs 4xx/5xx)?

## 1. If duplicates are reaching us

Stripe re-delivers events on:
- Any non-2xx response from us (full retry chain, up to 8 attempts)
- Network errors on Stripe's side (rare but real)
- Manual replay from Stripe Dashboard

Our defense is `idempotency.has(event.id)` in `webhooks/stripe.ts`. If duplicates are causing duplicate side effects, we are skipping the dedupe somewhere. Walk every code path in `webhooks/stripe.ts`:

1. First-attempt path (line ~91 onward): does it call `idempotency.has()`? Yes ✓
2. **Retry path (line 84): does it call `idempotency.has()`? Currently NO — known bug.** This is AI-2 from postmortem 2024-01-14.

## 2. If events are missing entirely

- Check Stripe Dashboard for delivery attempts. If Stripe says "200 OK," we received it.
- Check the `webhook_events` table for the missing `event_id`. If present, we processed it but the side-effect failed. Look in Sentry for that event_id.
- If absent from `webhook_events`, we either rejected it (signature failure → 400) or never got it.

## 3. If signature verification is failing

- `STRIPE_WEBHOOK_SECRET` env var matches what Stripe's dashboard shows for this endpoint.
- The body parser is `express.raw()`, NOT `express.json()` for the `/webhooks/stripe` path.
- `app.ts` orders the raw parser BEFORE the JSON parser. Verify.

## 4. Replay tooling

Stripe Dashboard → Events → click an event → "Resend" → choose endpoint. Useful for verifying a fix without waiting for production traffic.

## See also

- `docs/ADR-007-idempotency-keys.md`
- `seed/postmortems/2023-11-02-payment-double-charge.md`
- `seed/postmortems/2024-01-14-stripe-webhook-regression.md`
