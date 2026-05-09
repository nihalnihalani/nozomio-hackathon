// SYNTHETIC DEMO REPO — outbound retry helper. See ADR-003.
// Wraps an idempotent async fn with exponential-backoff retries.
// Eligible errors: 5xx, 408, 429, connection errors. Not 4xx.

import { logger } from "./logger";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  factor?: number;
  jitter?: number;
  shouldRetry?: (err: unknown) => boolean;
}

const defaultShouldRetry = (err: unknown): boolean => {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (status === undefined) return true; // network/connection error — retry
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 5,
    baseDelayMs = 200,
    factor = 2,
    jitter = 0.25,
    shouldRetry = defaultShouldRetry,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!shouldRetry(err) || attempt === maxAttempts - 1) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(factor, attempt);
      const jittered = delay * (1 + (Math.random() * 2 - 1) * jitter);
      logger.warn(
        { attempt: attempt + 1, delayMs: Math.round(jittered) },
        "retrying",
      );
      await new Promise((r) => setTimeout(r, jittered));
    }
  }
  throw lastErr;
}
