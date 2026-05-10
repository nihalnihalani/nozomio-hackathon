"use node";

/**
 * PostHog LLM Analytics — module-scope OTel provider.
 *
 * Imported for SIDE EFFECTS at the top of `convex/triageNode.ts`, which
 * is the entry point for the agent loop. The provider auto-instruments
 * AI SDK `streamText` / `generateText` calls (the AI SDK emits `gen_ai`
 * OpenTelemetry spans natively) and the PostHog exporter forwards them
 * to PostHog's OTLP endpoint, which converts them into `$ai_generation`
 * events with cost / latency / model / prompt / response per call.
 *
 * Why module scope: Convex V8 isolates can warm-restart, but Node.js
 * actions (this module is `"use node"`) keep the module cached across
 * invocations within the same isolate. Initializing here means the
 * provider is set on `globalThis` exactly once before the AI SDK does
 * its first call, regardless of which action triggered the wake-up.
 *
 * Why a guard: belt-and-suspenders. If hot-module-reload, dynamic
 * `import()`, or test harness double-loads this file we'd otherwise
 * register the provider twice and get duplicate exports. The
 * `globalThis.__triagePosthogInit` flag prevents that.
 *
 * Failure mode: if `POSTHOG_API_KEY` is missing this is a silent no-op.
 * Observability must never block live triage or explicit replay runs.
 *
 * ENV:
 *   POSTHOG_API_KEY — required for export. Without it, this file does
 *                     nothing and the agent runs normally.
 *   POSTHOG_HOST    — optional; defaults to https://us.i.posthog.com
 *                     (the PostHog exporter applies its own default).
 *
 * Docs: https://posthog.com/docs/llm-analytics/installation/convex
 */

declare global {
  // eslint-disable-next-line no-var
  var __triagePosthogInit: boolean | undefined;
}

if (!globalThis.__triagePosthogInit) {
  globalThis.__triagePosthogInit = true;

  if (process.env.POSTHOG_API_KEY) {
    try {
      // Imports are inside the guard so the OTel deps don't load at all
      // when PostHog isn't configured, so optional analytics do not affect
      // triage startup.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { trace } = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        BasicTracerProvider,
        SimpleSpanProcessor,
      } = require("@opentelemetry/sdk-trace-base") as typeof import("@opentelemetry/sdk-trace-base");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { resourceFromAttributes } =
        require("@opentelemetry/resources") as typeof import("@opentelemetry/resources");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PostHogTraceExporter } =
        require("@posthog/ai/otel") as typeof import("@posthog/ai/otel");

      const exporter = new PostHogTraceExporter({
        apiKey: process.env.POSTHOG_API_KEY,
        host: process.env.POSTHOG_HOST,
      });

      const provider = new BasicTracerProvider({
        resource: resourceFromAttributes({
          "service.name": "triage",
        }),
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });

      trace.setGlobalTracerProvider(provider);
    } catch (err) {
      // Never let observability break the agent. Log and move on.
      // eslint-disable-next-line no-console
      console.warn(
        "[observability] PostHog OTel provider failed to initialize:",
        (err as Error).message
      );
    }
  }
}

export {};
