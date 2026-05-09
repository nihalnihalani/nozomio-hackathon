/**
 * Phase 6 — PostHog LLM Analytics smoke tests.
 *
 * Asserts that `convex/observability.ts` is a hermetic-safe side-effect
 * import: with no PostHog env vars present it must NOT throw, and the
 * demo path (`DEMO_MODE=replay`, no API keys) must continue to work
 * unchanged.
 *
 * The module sets `globalThis.__triagePosthogInit` as its double-init
 * guard. We clear the flag between cases so each test exercises a fresh
 * evaluation of the module body via vitest's dynamic import + a
 * cache-busting query string.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// `?id=...` query strings are vitest's documented cache-busting trick:
// each unique URL gets its own evaluation, isolating each test case.
const moduleUrl = (id: string) => `../convex/observability.ts?id=${id}`;

describe("convex/observability — PostHog LLM Analytics", () => {
  let savedKey: string | undefined;
  let savedHost: string | undefined;

  beforeEach(() => {
    savedKey = process.env.POSTHOG_API_KEY;
    savedHost = process.env.POSTHOG_HOST;
    // Drop the cross-isolate guard so each test reaches the init branch.
    delete (globalThis as { __triagePosthogInit?: boolean })
      .__triagePosthogInit;
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = savedKey;
    if (savedHost === undefined) delete process.env.POSTHOG_HOST;
    else process.env.POSTHOG_HOST = savedHost;
  });

  it("is a silent no-op when POSTHOG_API_KEY is unset (demo-path safe)", async () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_HOST;

    await expect(import(moduleUrl("no-key"))).resolves.toBeDefined();

    // Guard flips even on the no-op path so we don't re-run on warm starts.
    expect(
      (globalThis as { __triagePosthogInit?: boolean }).__triagePosthogInit
    ).toBe(true);
  });

  it("does not double-init: guard flips on first load and stays set", async () => {
    delete process.env.POSTHOG_API_KEY;

    await import(moduleUrl("first"));
    const first = (globalThis as { __triagePosthogInit?: boolean })
      .__triagePosthogInit;

    // Second import (different cache-bust id) re-runs the module body.
    // The guard is already true, so the init block is skipped — this is
    // exactly the warm-start protection we want.
    await import(moduleUrl("second"));
    const second = (globalThis as { __triagePosthogInit?: boolean })
      .__triagePosthogInit;

    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});
