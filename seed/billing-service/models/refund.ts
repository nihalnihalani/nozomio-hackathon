// SYNTHETIC DEMO REPO — refund model.
import { db } from "../lib/db";

export interface RefundRecord {
  refundId: string;
  chargeId: string;
  amountCents: number;
  stripeEventId: string;
}

export const Refund = {
  async recordSuccess(r: RefundRecord): Promise<void> {
    await db.query(
      `insert into refunds
        (refund_id, charge_id, amount_cents, stripe_event_id, status)
       values ($1, $2, $3, $4, 'succeeded')
       on conflict (refund_id) do nothing`,
      [r.refundId, r.chargeId, r.amountCents, r.stripeEventId],
    );
  },

  async listByCharge(chargeId: string) {
    const { rows } = await db.query(
      "select * from refunds where charge_id = $1 order by created_at desc",
      [chargeId],
    );
    return rows;
  },
};
