// SYNTHETIC DEMO REPO — charge model.
import { db } from "../lib/db";

export interface ChargeRecord {
  chargeId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  stripeEventId: string;
}

export const Charge = {
  async recordSuccess(c: ChargeRecord): Promise<void> {
    await db.query(
      `insert into charges
        (charge_id, customer_id, amount_cents, currency, stripe_event_id, status)
       values ($1, $2, $3, $4, $5, 'succeeded')
       on conflict (charge_id) do nothing`,
      [c.chargeId, c.customerId, c.amountCents, c.currency, c.stripeEventId],
    );
  },

  async findById(chargeId: string) {
    const { rows } = await db.query(
      "select * from charges where charge_id = $1",
      [chargeId],
    );
    return rows[0] ?? null;
  },
};
