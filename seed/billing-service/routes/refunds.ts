// SYNTHETIC DEMO REPO — REST routes for refunds.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { Refund } from "../models/refund";
import { idempotency } from "../lib/idempotency";

export const refundsRouter = Router();

const CreateRefundSchema = z.object({
  chargeId: z.string().min(1),
  amountCents: z.number().int().positive(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
});

refundsRouter.post("/", async (req: Request, res: Response) => {
  const idempKey = req.header("X-Idempotency-Key");
  if (!idempKey) {
    res.status(400).json({ error: "missing X-Idempotency-Key header" });
    return;
  }
  if (await idempotency.has(idempKey)) {
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  const parsed = CreateRefundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  await idempotency.record(idempKey);

  const fakeRefundId = `re_${Math.random().toString(36).slice(2, 12)}`;
  await Refund.recordSuccess({
    refundId: fakeRefundId,
    chargeId: parsed.data.chargeId,
    amountCents: parsed.data.amountCents,
    stripeEventId: idempKey,
  });

  logger.info({ refund_id: fakeRefundId }, "refund created");
  res.status(201).json({ refundId: fakeRefundId });
});

refundsRouter.get("/by-charge/:chargeId", async (req: Request, res: Response) => {
  const refunds = await Refund.listByCharge(req.params.chargeId);
  res.json({ refunds });
});
