// SYNTHETIC DEMO REPO — REST routes for client-initiated charges.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { Charge } from "../models/charge";
import { idempotency } from "../lib/idempotency";

export const chargesRouter = Router();

const CreateChargeSchema = z.object({
  customerId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
});

chargesRouter.post("/", async (req: Request, res: Response) => {
  // Client-initiated charges use the X-Idempotency-Key header pattern.
  // (Webhook events use event.id as the key — see webhooks/stripe.ts.)
  const idempKey = req.header("X-Idempotency-Key");
  if (!idempKey) {
    res.status(400).json({ error: "missing X-Idempotency-Key header" });
    return;
  }
  if (await idempotency.has(idempKey)) {
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  const parsed = CreateChargeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  await idempotency.record(idempKey);

  // (synthetic) — would call Stripe SDK here. We pretend it succeeded.
  const fakeChargeId = `ch_${Math.random().toString(36).slice(2, 12)}`;
  await Charge.recordSuccess({
    chargeId: fakeChargeId,
    customerId: parsed.data.customerId,
    amountCents: parsed.data.amountCents,
    currency: parsed.data.currency,
    stripeEventId: idempKey,
  });

  logger.info({ charge_id: fakeChargeId }, "charge created");
  res.status(201).json({ chargeId: fakeChargeId });
});

chargesRouter.get("/:chargeId", async (req: Request, res: Response) => {
  const charge = await Charge.findById(req.params.chargeId);
  if (!charge) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(charge);
});
