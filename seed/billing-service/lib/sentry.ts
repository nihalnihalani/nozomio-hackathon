// SYNTHETIC DEMO REPO — Sentry init shim. Stub: real init lives
// in the platform layer; we just expose a thin tag helper.

export const sentry = {
  tag(key: string, value: string): void {
    // (synthetic) — would call Sentry.setTag here
    if (process.env.SENTRY_DEBUG) {
      console.debug(`[sentry-tag] ${key}=${value}`);
    }
  },
  captureException(err: unknown): void {
    if (process.env.SENTRY_DEBUG) {
      console.error("[sentry-capture]", err);
    }
  },
};
