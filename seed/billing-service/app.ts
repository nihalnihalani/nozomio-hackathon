// SYNTHETIC DEMO REPO — Acme Billing service entry point.
// Boots the Express app, wires routes and webhook handlers,
// and hands control to the cluster.

import express from "express";
import { logger } from "./lib/logger";
import { registerStripeWebhook } from "./webhooks/stripe";
import { registerPaypalWebhook } from "./webhooks/paypal";
import { chargesRouter } from "./routes/charges";
import { refundsRouter } from "./routes/refunds";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Stripe webhook signature verification requires the raw body bytes,
// not a parsed JSON body. The path-specific raw parser must come
// before the generic JSON parser.
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "billing-service", version: "1.42.3" });
});

app.use("/charges", chargesRouter);
app.use("/refunds", refundsRouter);

registerStripeWebhook(app);
registerPaypalWebhook(app);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "billing-service listening");
});
