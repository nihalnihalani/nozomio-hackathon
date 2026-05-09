// SYNTHETIC DEMO REPO — idempotency helper.
//
// Backed by a Postgres table `webhook_events(event_id text primary key,
// recorded_at timestamptz default now())`. Any caller that processes
// a webhook event MUST consult `has()` before performing side effects
// and `record()` after committing them. See ADR-007.
//
// NOTE: the retry path in webhooks/stripe.ts:84 does NOT call has(),
// which is the bug the Triage demo surfaces. Postmortem 2024-01-14
// filed AI-2 for this exact follow-up — still open.

import { db } from "./db";
import { logger } from "./logger";

export interface IdempotencyHelper {
  has(key: string): Promise<boolean>;
  record(key: string): Promise<void>;
}

export const idempotency: IdempotencyHelper = {
  async has(key: string): Promise<boolean> {
    const { rows } = await db.query(
      "select 1 from webhook_events where event_id = $1 limit 1",
      [key],
    );
    return rows.length > 0;
  },

  async record(key: string): Promise<void> {
    try {
      await db.query(
        "insert into webhook_events (event_id) values ($1) on conflict do nothing",
        [key],
      );
    } catch (err) {
      // Recording failure should not fail the webhook handler;
      // the next call to has() will simply return false and the
      // event may be re-processed. This is the lesser evil.
      logger.warn({ err, key }, "idempotency.record failed (non-fatal)");
    }
  },
};
