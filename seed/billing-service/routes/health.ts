// SYNTHETIC DEMO REPO — readiness/liveness probes.
import { Router, type Request, type Response } from "express";
import { db } from "../lib/db";

export const healthRouter = Router();

healthRouter.get("/livez", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

healthRouter.get("/readyz", async (_req: Request, res: Response) => {
  try {
    await db.query("select 1");
    res.json({ ok: true, db: "up" });
  } catch (err) {
    res.status(503).json({ ok: false, db: "down" });
  }
});
