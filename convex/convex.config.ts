/**
 * Convex Components registry.
 *
 * Phase 1 of `convexplan.md`: register `@convex-dev/agent` so the live
 * triage path can use the Agent class (threads, tool calling, RAG over
 * message history, delta streaming). The replay path continues to use
 * `lib/agent/loop.ts:runReplay` (Invariant 4 — Hermetic Demo Mode).
 *
 * After editing, run `npx convex dev --once --typecheck=disable` so the
 * generated `_generated/api.{d.ts,js}` files surface `components.agent`.
 */

import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(agent);

export default app;
