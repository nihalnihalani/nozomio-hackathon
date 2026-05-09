"use client";

import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const SAMPLE_TRACE_A = `Error: Duplicate charge processed for customer cus_abc123
  at processWebhook (webhooks/stripe.ts:84)
  at /server.js:212
  Sentry event: a3f8e9c1
  Timestamp: 2024-05-09T03:47:12Z`;

export const SAMPLE_TRACE_B = `Error: Duplicate refund event for charge ch_def456
  at processWebhook (webhooks/stripe.ts:91)
  at /server.js:212
  Sentry event: b9d2c4e0
  Timestamp: 2024-05-09T03:48:34Z`;

interface PasteTraceInputProps {
  onSubmit: (args: { trace: string }) => void;
  disabled?: boolean;
  /** Optional initial value (used by "Run on similar alert" prefill) */
  initialValue?: string;
  /** When non-null, programmatically replaces textarea contents */
  controlledValue?: string;
}

export function PasteTraceInput({
  onSubmit,
  disabled,
  initialValue = "",
  controlledValue,
}: PasteTraceInputProps) {
  const [internal, setInternal] = useState(initialValue);
  const value = controlledValue ?? internal;

  const handleChange = (next: string) => {
    if (controlledValue === undefined) setInternal(next);
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit({ trace: trimmed });
  };

  const handleSample = (sample: string) => {
    if (disabled) return;
    setInternal(sample);
    onSubmit({ trace: sample });
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste a stack trace, Sentry event, or PagerDuty alert payload..."
        className="min-h-[180px] resize-y text-[13px] leading-relaxed"
        spellCheck={false}
        aria-label="Stack trace input"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Or use a sample:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => handleSample(SAMPLE_TRACE_A)}
            className="font-mono"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Trace A
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => handleSample(SAMPLE_TRACE_B)}
            className="font-mono"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Trace B
          </Button>
        </div>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || value.trim().length === 0}
          className={cn("min-w-[120px]")}
        >
          <Sparkles className="h-4 w-4" />
          Triage
        </Button>
      </div>
    </div>
  );
}
