// SYNTHETIC DEMO REPO — PayPal webhook handler.
// This is a control file: same shape as stripe.ts but with the
// idempotency check correctly applied on every path. Used by the
// Triage demo to contrast against the bug in stripe.ts.

import type { Request, Response } from "express";
import { logger } from "../lib/logger";
import { idempotency } from "../lib/idempotency";
import { Charge } from "../models/charge";

type PaypalEvent = {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
  retry?: boolean;
};

async function processPaypalCharge(event: PaypalEvent): Promise<void> {
  logger.info({ event_id: event.id }, "processing paypal charge");
  // (synthetic) — would call into Charge.recordSuccess here.
  await Charge.recordSuccess({
    chargeId: String(event.resource.id ?? event.id),
    customerId: String(event.resource.payer_id ?? "unknown"),
    amountCents: Number(event.resource.amount ?? 0) * 100,
    currency: String(event.resource.currency ?? "USD"),
    stripeEventId: event.id, // we use the same column for any provider
  });
}

export async function processPaypalWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const event = req.body as PaypalEvent;
  if (!event?.id || !event?.event_type) {
    res.status(400).send("malformed event");
    return;
  }
  // PayPal also delivers events at-least-once. Same dedupe
  // pattern as stripe.ts — but applied on every branch, retry
  // included. See lib/idempotency.ts for the helper.
  const seen = await idempotency.has(event.id);
  if (seen) {
    logger.info({ event_id: event.id }, "duplicate paypal event; skipping");
    res.status(200).send("ok (duplicate)");
    return;
  }
  await idempotency.record(event.id);

  try {
    switch (event.event_type) {
      case "PAYMENT.SALE.COMPLETED":
        await processPaypalCharge(event);
        break;
      default:
        logger.debug({ event_id: event.id, type: event.event_type }, "unhandled paypal event");
    }
    res.status(200).send("ok");
  } catch (err) {
    logger.error({ err, event_id: event.id }, "paypal webhook failed");
    res.status(500).send("processing failed");
  }
}

export function registerPaypalWebhook(
  app: import("express").Express,
): void {
  app.post("/webhooks/paypal", processPaypalWebhook);
}
