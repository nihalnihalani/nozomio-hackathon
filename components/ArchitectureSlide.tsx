"use client";

import {
  Activity,
  Bot,
  BrainCircuit,
  Check,
  Cloud,
  Code2,
  Database,
  MessageSquare,
  Server,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface ArchitectureSlideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SponsorBoxProps {
  title: string;
  subtitle: string;
  Icon: typeof BrainCircuit;
  accent: string;
  features: string[];
  badge?: string;
  className?: string;
}

function SponsorBox({
  title,
  subtitle,
  Icon,
  accent,
  features,
  badge,
  className,
}: SponsorBoxProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card/60 p-3 shadow-sm",
        accent,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider">
            {title}
          </span>
        </div>
        {badge ? (
          <span className="rounded-full border border-current/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase opacity-80">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-semibold leading-tight text-foreground">
        {subtitle}
      </p>
      <ul className="flex flex-col gap-1 text-xs leading-snug text-muted-foreground">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-current opacity-70" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SmallSponsorProps {
  title: string;
  subtitle: string;
  Icon: typeof BrainCircuit;
  accent: string;
  features: string[];
}

function SmallSponsor({
  title,
  subtitle,
  Icon,
  accent,
  features,
}: SmallSponsorProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border bg-card/60 p-2.5",
        accent
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground">— {subtitle}</span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {features.join(" · ")}
      </p>
    </div>
  );
}

export function ArchitectureSlide({
  open,
  onOpenChange,
}: ArchitectureSlideProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid max-h-[92vh] w-[96vw] max-w-6xl translate-x-[-50%] translate-y-[-50%] gap-3 overflow-y-auto border bg-background p-5 shadow-xl duration-200 sm:rounded-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">
                Architecture
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                Seven sponsors, every feature load-bearing. Remove any one and
                something specific breaks.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* ─── Core 4 sponsors + central agent ─── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Top-left: Hyperspell */}
            <SponsorBox
              title="Hyperspell"
              subtitle="Memory of humans"
              badge="Track 4"
              Icon={MessageSquare}
              accent="border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300"
              features={[
                "Slack #incidents · Notion postmortems · Gmail vendor outages",
                "recallSimilarIncidents tool with weighted source scoring",
                "Memory reinforcement after each triage (Invariant 2)",
                "metadata.kind=triage_history → frontend pulses 🧠",
              ]}
              className="sm:col-start-1"
            />

            {/* Top-right: Nia */}
            <SponsorBox
              title="Nia"
              subtitle="Memory of code"
              badge="Host"
              Icon={Code2}
              accent="border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-300"
              features={[
                "Monorepo + ADRs + runbooks indexed",
                "searchCode tool returns file:line + excerpts",
                "Cite-or-die verifier (claimed file:line must match)",
                "STRICT_CITE_OR_DIE fail-closed in production",
              ]}
              className="sm:col-start-3"
            />

            {/* Center: Triage agent */}
            <div className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-5 text-center sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1">
              <div className="rounded-full border-2 border-primary/40 bg-background/60 p-3">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Triage agent
              </p>
              <p className="text-sm font-semibold text-foreground">
                @convex-dev/agent
              </p>
              <ul className="flex flex-col gap-0.5 text-[11px] leading-tight text-muted-foreground">
                <li>5-stage loop · stepCountIs(8)</li>
                <li>recallSimilarIncidents</li>
                <li>searchCode</li>
                <li>produceTriage (Cite-Or-Die ★)</li>
              </ul>
              <p className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                Invariant 1 · 2 · 3 · 4
              </p>
            </div>

            {/* Bottom-left: Convex */}
            <SponsorBox
              title="Convex"
              subtitle="Hot path + agent runtime"
              badge="v1.38"
              Icon={Sparkles}
              accent="border-purple-500/40 bg-purple-500/5 text-purple-700 dark:text-purple-300"
              features={[
                "@convex-dev/agent v0.6.1 — threads + createTool + RAG",
                "searchOtherThreads RAG over message history",
                "Delta streaming → useUIMessages + useSmoothText",
                "Reactive useQuery → live trace UI cards",
                "Hot tables: triageRuns · toolCalls · citations · memoryEvents",
              ]}
              className="sm:col-start-1"
            />

            {/* Bottom-right: InsForge */}
            <SponsorBox
              title="InsForge"
              subtitle="Cold path + auth"
              badge="Postgres"
              Icon={Database}
              accent="border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300"
              features={[
                "Multi-tenant Postgres with RLS by org_id",
                "Magic-link auth (prebuilt React component)",
                "Tables: organizations · incidents · audit_log",
                "Convex HTTP-route mirror — one-way at status=done",
              ]}
              className="sm:col-start-3"
            />
          </div>

          {/* ─── 5-stage loop banner ─── */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                5-stage loop
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5">
              {[
                ["1. Ingest", "Convex action validates trace · writes triageRuns"],
                ["2. Recall", "Hyperspell · weighted source search"],
                ["3. Code Search", "Nia · cite-or-die verifier"],
                ["4. Compose", "Claude Sonnet 4.5 · stream UIMessages"],
                ["5. Reinforce", "Hyperspell.add · InsForge mirror · audit"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded border border-border/60 bg-background/60 p-1.5"
                >
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Supporting stack: Anthropic + PostHog + Vercel ─── */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SmallSponsor
              title="Anthropic"
              subtitle="LLM"
              Icon={BrainCircuit}
              accent="border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
              features={[
                "Claude Sonnet 4.5 · direct API",
                "AI SDK v6 (inputSchema + tool())",
              ]}
            />
            <SmallSponsor
              title="PostHog"
              subtitle="LLM Analytics"
              Icon={Zap}
              accent="border-pink-500/40 bg-pink-500/5 text-pink-700 dark:text-pink-300"
              features={[
                "@posthog/ai OTel exporter",
                "gen_ai.* spans → $ai_generation events",
                "experimental_telemetry on both paths",
              ]}
            />
            <SmallSponsor
              title="Vercel"
              subtitle="Hosting"
              Icon={Cloud}
              accent="border-zinc-500/40 bg-zinc-500/5 text-zinc-700 dark:text-zinc-300"
              features={[
                "Next.js 15 App Router · Fluid Compute",
                "AI SDK v6 · @ai-sdk/react v3",
              ]}
            />
          </div>

          {/* ─── Invariant footer ─── */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-4">
            <div className="flex items-start gap-2">
              <Server className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  Invariant 1
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Cite-Or-Die · Zod-validated produceTriage tool
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <BrainCircuit className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  Invariant 2
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Reinforced memory — Trace B surfaces a new citation
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  Invariant 3
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Hot/Cold split · Convex hot · InsForge cold
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Activity className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  Invariant 4
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Hermetic demo · DEMO_MODE=replay lifeboat
                </p>
              </div>
            </div>
          </div>

          <p className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
            Remove Hyperspell → no reinforcement. Remove Nia → no
            cite-or-die. Remove Convex → no reactive trace. Remove InsForge →
            no audit. Remove Anthropic → no agent. Remove PostHog → no LLM
            telemetry. Each sponsor earns its place.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
