// SYNTHETIC DEMO REPO — fictional Acme Billing service.
// Planted bug at line 84 for the Triage hackathon demo. Do not deploy.
//
// Stripe webhook handler. Idempotency MUST be enforced on every path
// (see docs/ADR-007-idempotency-keys.md). Currently, the retry branch
// at line 84 does not call idempotency.has() — known gap; postmortem
// 2024-01-14 filed AI-2 for this exact follow-up which is still open.

import type { Request, Response } from "express";
import Stripe from "stripe";

import { logger } from "../lib/logger";
import { idempotency } from "../lib/idempotency";
import { Charge } from "../models/charge";
import { Refund } from "../models/refund";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-04-10",
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

type StripeEventWithRetry = Stripe.Event & {
  retry?: boolean;
  retry_count?: number;
};

/**
 * processCharge — applies a Stripe charge to the customer's account.
 * Idempotency is the caller's responsibility; this function does not
 * dedupe internally.
 */
async function processCharge(event: StripeEventWithRetry): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  logger.info(
    { event_id: event.id, charge_id: charge.id },
    "processing charge",
  );
  await Charge.recordSuccess({
    chargeId: charge.id,
    customerId: charge.customer as string,
    amountCents: charge.amount,
    currency: charge.currency,
    stripeEventId: event.id,
  });
}

/**
 * processRefund — applies a Stripe refund event.
 * Same idempotency contract as processCharge — the caller dedupes.
 */
async function processRefund(event: StripeEventWithRetry): Promise<void> {
  const refund = event.data.object as Stripe.Refund;
  logger.info(
    { event_id: event.id, refund_id: refund.id },
    "processing refund",
  );
  await Refund.recordSuccess({
    refundId: refund.id,
    chargeId: refund.charge as string,
    amountCents: refund.amount,
    stripeEventId: event.id,
  });
}

/**
 * processWebhook — Express route handler for POST /webhooks/stripe.
 * Verifies the Stripe signature, parses the event, and dispatches.
 */
export async function processWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) {
    res.status(400).send("missing stripe-signature header");
    return;
  }
  const event = parseStripeEvent(req.body, sig);
  if (!event) {
    res.status(400).send("invalid signature");
    return;
  }
  if (event.retry) {
    // BUG: no idempotency check on retry path (charge branch)
    return processCharge(event);
  }

  if (event.retry && event.type === "charge.refunded") {
    // BUG: no idempotency check on retry path (refund branch — same gap)
    return processRefund(event);
  }
  const seen = await idempotency.has(event.id);
  if (seen) {
    logger.info({ event_id: event.id }, "duplicate event; skipping");
    res.status(200).send("ok (duplicate)");
    return;
  }
  await idempotency.record(event.id);

  try {
    switch (event.type) {
      case "charge.succeeded":
        await processCharge(event);
        break;
      case "charge.refunded":
        await processRefund(event);
        break;
      case "customer.created":
      case "customer.updated":
        // no-op; we sync customer data on read
        logger.debug(
          { event_id: event.id, type: event.type },
          "customer event",
        );
        break;
      default:
        logger.debug(
          { event_id: event.id, type: event.type },
          "unhandled event type",
        );
    }
    res.status(200).send("ok");
  } catch (err) {
    logger.error(
      { err, event_id: event.id },
      "stripe webhook processing failed",
    );
    // Stripe will retry on 5xx. Idempotency is the only thing
    // protecting us from duplicate side effects on retry.
    res.status(500).send("processing failed");
  }
}

function parseStripeEvent(
  body: Buffer | string,
  sig: string,
): StripeEventWithRetry | null {
  try {
    return stripe.webhooks.constructEvent(
      body,
      sig,
      STRIPE_WEBHOOK_SECRET,
    ) as StripeEventWithRetry;
  } catch (err) {
    logger.warn({ err }, "stripe signature verification failed");
    return null;
  }
}

/**
 * registerStripeWebhook — wires the route into the Express app.
 * Called from app.ts during startup. The express.raw() body parser
 * is configured for this path in app.ts (signature verification
 * requires the raw byte stream, not a parsed JSON body).
 */
export function registerStripeWebhook(
  app: import("express").Express,
): void {
  app.post("/webhooks/stripe", processWebhook);
}
