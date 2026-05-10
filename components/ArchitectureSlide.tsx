"use client";

import {
  Bot,
  Code2,
  Database,
  MessageSquare,
  Sparkles,
  Triangle,
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
  tool: string;
  details: string[];
  failureMode: string;
  Icon: typeof MessageSquare;
  accent: string;
  className?: string;
}

function SponsorBox({
  title,
  subtitle,
  tool,
  details,
  failureMode,
  Icon,
  accent,
  className,
}: SponsorBoxProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border bg-card/60 p-4 shadow-sm",
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
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {subtitle}
        </span>
      </div>

      <p className="font-mono text-xs leading-tight text-foreground">{tool}</p>

      <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        {details.map((d) => (
          <li key={d} className="before:mr-1.5 before:text-muted-foreground/50 before:content-['—']">
            {d}
          </li>
        ))}
      </ul>

      <p className="mt-auto border-t border-border/40 pt-2 text-[11px] italic leading-snug text-muted-foreground/80">
        Without it: {failureMode}
      </p>
    </div>
  );
}

interface InfraChipProps {
  label: string;
  detail: string;
  Icon: typeof Triangle;
}

function InfraChip({ label, detail, Icon }: InfraChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{detail}</span>
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
            "fixed left-[50%] top-[50%] z-50 grid max-h-[92vh] w-[95vw] max-w-5xl translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-6 shadow-xl duration-200 sm:rounded-lg",
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
                Four sponsors. Each one is load-bearing — not sponsor bingo.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Diagram: 4 sponsor boxes around the central agent.
              Layout (sm and up):
                  [ Hyperspell ]   [ Triage agent ]   [ Nia ]
                  [   Convex   ]   [ Triage agent ]   [ InsForge ]
              The center spans 2 rows and contains the 5-stage loop.        */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:grid-rows-2">
            {/* Top-left: Hyperspell */}
            <SponsorBox
              title="Hyperspell"
              subtitle="Humans · memory"
              tool="recallSimilarIncidents() + memories.add()"
              details={[
                "Slack #incidents · Notion postmortems · Gmail vendor outages",
                "source_weights { slack: 0.5, notion: 0.4, gmail: 0.1 }",
                "Reinforcement after Stage 5 → Trace B surfaces a NEW citation",
              ]}
              failureMode="zero cross-source memory; no learning between incidents"
              Icon={MessageSquare}
              accent="border-blue-500/40 bg-blue-500/5"
              className="sm:col-start-1 sm:row-start-1"
            />

            {/* Top-right: Nia */}
            <SponsorBox
              title="Nia"
              subtitle="Code · grounding"
              tool="searchCode() · /v2/search"
              details={[
                "Monorepo + ADRs + runbooks indexed once at boot",
                "Cite-or-die verifier — claimed file:line must contain the code",
                "Failed verifies → returned as [verification failed], never silently dropped",
              ]}
              failureMode="root cause has no code anchor; suspected fix is a guess"
              Icon={Code2}
              accent="border-green-500/40 bg-green-500/5"
              className="sm:col-start-3 sm:row-start-1"
            />

            {/* Center: Triage agent + 5-stage loop. Spans both rows. */}
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-center",
                "sm:col-start-2 sm:row-span-2 sm:row-start-1"
              )}
            >
              <Sparkles className="h-7 w-7 text-primary" />
              <div className="space-y-0.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Triage agent
                </p>
                <p className="text-sm font-semibold leading-tight">
                  Convex Node action
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  convex/triage_node.ts
                </p>
              </div>

              <div className="w-full space-y-1.5 text-left">
                <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  5-stage loop
                </p>
                <ol className="space-y-0.5 font-mono text-[11px] leading-snug text-foreground">
                  <li><span className="text-muted-foreground">1.</span> Ingest <span className="text-muted-foreground">— validate trace</span></li>
                  <li><span className="text-muted-foreground">2.</span> Recall <span className="text-muted-foreground">→ Hyperspell</span></li>
                  <li><span className="text-muted-foreground">3.</span> Search <span className="text-muted-foreground">→ Nia</span></li>
                  <li><span className="text-muted-foreground">4.</span> Compose <span className="text-muted-foreground">→ Claude</span></li>
                  <li><span className="text-muted-foreground">5.</span> Persist + Reinforce</li>
                </ol>
              </div>

              <p className="border-t border-primary/20 pt-2 text-[10px] leading-snug text-muted-foreground">
                Cite-or-die enforced ·{" "}
                <span className="font-mono">stepCountIs(5)</span> bound
              </p>
            </div>

            {/* Bottom-left: Convex */}
            <SponsorBox
              title="Convex"
              subtitle="Hot path · runtime"
              tool="triageRuns · toolCalls · citations · memoryEvents"
              details={[
                "Reactive useQuery → live agent-thinking trace UI",
                "Per-session ephemeral state; never holds audit data",
                "Agent loop runs as Node-runtime action, not edge",
              ]}
              failureMode="trace UI goes static; no live tool-call streaming"
              Icon={Zap}
              accent="border-purple-500/40 bg-purple-500/5"
              className="sm:col-start-1 sm:row-start-2"
            />

            {/* Bottom-right: InsForge */}
            <SponsorBox
              title="InsForge"
              subtitle="Cold path · audit"
              tool="incidents · audit_log (Postgres + RLS)"
              details={[
                "Multi-tenant isolation by org_id from auth.jwt()",
                "Magic-link auth — prebuilt React component",
                "One-way mirror at status=done via /api/insforge-mirror",
              ]}
              failureMode="no durable record; no SRE-team queryable history"
              Icon={Database}
              accent="border-orange-500/40 bg-orange-500/5"
              className="sm:col-start-3 sm:row-start-2"
            />
          </div>

          {/* Supporting infra strip — load-bearing but not in the demo's 4-box framing */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Supporting infra
            </span>
            <InfraChip
              Icon={Bot}
              label="Anthropic"
              detail="Claude Sonnet · direct API (not via Gateway)"
            />
            <InfraChip
              Icon={Triangle}
              label="Vercel"
              detail="Next.js 15 App Router · preview deploys per push"
            />
          </div>

          <p className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
            Removing any one breaks something specific. That's the difference between depth and bingo.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
