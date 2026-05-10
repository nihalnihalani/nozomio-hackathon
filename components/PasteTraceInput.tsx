"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PasteTraceInputProps {
  onSubmit: (args: { trace: string }) => void;
  disabled?: boolean;
  /** Optional initial value for caller-provided context. */
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
      <div className="flex flex-wrap items-center justify-end gap-2">
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
