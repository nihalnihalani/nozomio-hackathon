// SYNTHETIC DEMO REPO — Stripe SDK client wrapper.
import Stripe from "stripe";

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-04-10",
  maxNetworkRetries: 0, // we handle retries via lib/retry.ts (ADR-003)
  timeout: 8_000,
});
