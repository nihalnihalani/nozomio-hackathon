"use client";

import { AlertTriangle, Code2, Mail, MessageSquare, FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Citation, SourceType } from "@/lib/types";

interface CitationDrawerProps {
  citation: Citation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SOURCE_LABEL: Record<SourceType, string> = {
  slack: "Slack",
  notion: "Notion",
  gmail: "Gmail",
  google_drive: "Google Drive",
  code: "Code",
};

function SourceIcon({ source, className }: { source: SourceType; className?: string }) {
  switch (source) {
    case "slack":
      return <MessageSquare className={className} />;
    case "notion":
      return <FileText className={className} />;
    case "gmail":
      return <Mail className={className} />;
    case "google_drive":
      return <FileText className={className} />;
    case "code":
      return <Code2 className={className} />;
  }
}

export function CitationDrawer({ citation, open, onOpenChange }: CitationDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 p-0"
      >
        {citation ? (
          <>
            <SheetHeader className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md",
                    citation.source === "slack" && "bg-blue-500/15 text-blue-300",
                    citation.source === "notion" && "bg-zinc-500/20 text-zinc-300",
                    citation.source === "gmail" && "bg-red-500/15 text-red-300",
                    citation.source === "google_drive" && "bg-emerald-500/15 text-emerald-300",
                    citation.source === "code" && "bg-green-500/15 text-green-300"
                  )}
                >
                  <SourceIcon source={citation.source} className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left">
                  <SheetTitle className="text-base">
                    {SOURCE_LABEL[citation.source]} citation
                  </SheetTitle>
                  <SheetDescription className="font-mono text-xs">
                    {citation.source_id}
                  </SheetDescription>
                </div>
                {!citation.verified && (
                  <Badge
                    variant="outline"
                    className="border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                  >
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    unverified
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Excerpt
              </h3>
              <pre
                className={cn(
                  "whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed",
                  citation.source === "code"
                    ? "font-mono"
                    : "font-sans"
                )}
              >
                {citation.excerpt}
              </pre>

              {citation.metadata && Object.keys(citation.metadata).length > 0 && (
                <>
                  <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Metadata
                  </h3>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                      <tbody>
                        {Object.entries(citation.metadata).map(([key, value]) => (
                          <tr
                            key={key}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="bg-muted/30 px-3 py-2 font-mono font-medium text-muted-foreground">
                              {key}
                            </td>
                            <td className="break-all px-3 py-2 font-mono">
                              {typeof value === "string"
                                ? value
                                : JSON.stringify(value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!citation.verified && (
                <div className="mt-6 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Cite-or-die verifier could not confirm this source contains
                    the claimed content. Treat as a lead, not evidence.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
