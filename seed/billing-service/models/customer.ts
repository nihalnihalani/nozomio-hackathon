// SYNTHETIC DEMO REPO — read-through customer cache.
// Customer data is owned by customer-service (see ADR-001).
// We cache lookups for the duration of a request only.

import { db } from "../lib/db";

export interface CustomerSummary {
  customerId: string;
  email: string;
  defaultCurrency: string;
}

export const Customer = {
  async findById(customerId: string): Promise<CustomerSummary | null> {
    const { rows } = await db.query<CustomerSummary>(
      "select customer_id as \"customerId\", email, default_currency as \"defaultCurrency\" from customer_cache where customer_id = $1",
      [customerId],
    );
    return rows[0] ?? null;
  },
};
