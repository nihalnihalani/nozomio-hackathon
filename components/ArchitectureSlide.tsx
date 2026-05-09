"use client";

import {
  BrainCircuit,
  Code2,
  Database,
  MessageSquare,
  Sparkles,
  X,
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
  role: string;
  Icon: typeof BrainCircuit;
  accent: string;
  className?: string;
}

function SponsorBox({
  title,
  subtitle,
  role,
  Icon,
  accent,
  className,
}: SponsorBoxProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card/60 p-4 shadow-sm",
        accent,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="font-mono text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="text-sm font-medium leading-tight text-foreground">
        {subtitle}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">{role}</p>
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
            "fixed left-[50%] top-[50%] z-50 grid w-[95vw] max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 sm:rounded-lg",
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
                Four sponsors, four jobs.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Diagram: 4 sponsors arranged around the central agent.
              Layout uses CSS grid:
                  [ Hyperspell ]   [ Nia ]
                  [    Triage agent (center)     ]
                  [   Convex   ]   [ InsForge ]
              Arrows are simple unicode/CSS borders — no SVG.            */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {/* Top-left: Hyperspell */}
            <SponsorBox
              title="Hyperspell"
              subtitle="Humans"
              role="Slack #incidents · Notion postmortems · Gmail vendor outages. Memory reinforced after each triage."
              Icon={MessageSquare}
              accent="border-blue-500/40 bg-blue-500/5"
              className="sm:col-start-1"
            />

            {/* Top-right: Nia */}
            <SponsorBox
              title="Nia"
              subtitle="Code"
              role="Monorepo + ADRs + runbooks. Cite-or-die verifier checks claimed file:line."
              Icon={Code2}
              accent="border-green-500/40 bg-green-500/5"
              className="sm:col-start-3"
            />

            {/* Center: Triage agent */}
            <div className="col-span-2 row-span-1 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:row-span-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Triage agent
              </p>
              <p className="text-sm font-medium">
                Convex actions + reactive useQuery
              </p>
              <p className="text-xs text-muted-foreground">
                Server-side agent loop · cite-or-die · reinforced memory
              </p>
            </div>

            {/* Bottom-left: Convex */}
            <SponsorBox
              title="Convex"
              subtitle="Hot path"
              role="triageRuns · toolCalls · citations · memoryEvents. Reactive useQuery → live trace UI."
              Icon={Sparkles}
              accent="border-purple-500/40 bg-purple-500/5"
              className="sm:col-start-1"
            />

            {/* Bottom-right: InsForge */}
            <SponsorBox
              title="InsForge"
              subtitle="Cold path"
              role="incidents · audit_log. Multi-tenant Postgres with RLS by org_id. Mirrored one-way at status=done."
              Icon={Database}
              accent="border-orange-500/40 bg-orange-500/5"
              className="sm:col-start-3"
            />
          </div>

          <p className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
            Each sponsor owns a clean lane. In live mode all four are
            load-bearing. Replay mode is a hermetic dev path — Convex and
            InsForge no-op there so the demo runs without any keys.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
