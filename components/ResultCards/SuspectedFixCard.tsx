"use client";

import { Code2 } from "lucide-react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CitationPillRow } from "@/components/CitationPill";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/types";
import type { SuspectedFix } from "@/lib/hooks/useTriage";

interface SuspectedFixCardProps {
  fix: SuspectedFix | undefined;
  newSourceIds?: Set<string>;
  onCitationClick?: (citation: Citation) => void;
  className?: string;
}

/**
 * Splits a unified diff into oldText / newText for `react-diff-viewer-continued`.
 * Handles a single hunk reasonably; for multi-hunk diffs, concatenates lines.
 * If the input doesn't look like a diff, falls back to showing it as the
 * "new" side only.
 */
function splitUnifiedDiff(diff: string): { oldText: string; newText: string } {
  const lines = diff.split("\n");
  const oldLines: string[] = [];
  const newLines: string[] = [];
  let inHunk = false;
  for (const line of lines) {
    // Skip diff headers
    if (
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("diff ") ||
      line.startsWith("index ")
    ) {
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk && oldLines.length === 0 && newLines.length === 0) {
      // No hunk header at all — treat the whole input as a soft diff
      if (line.startsWith("-")) oldLines.push(line.slice(1));
      else if (line.startsWith("+")) newLines.push(line.slice(1));
      else {
        oldLines.push(line);
        newLines.push(line);
      }
      continue;
    }
    if (line.startsWith("-")) oldLines.push(line.slice(1));
    else if (line.startsWith("+")) newLines.push(line.slice(1));
    else if (line.startsWith(" ")) {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    } else {
      oldLines.push(line);
      newLines.push(line);
    }
  }
  return { oldText: oldLines.join("\n"), newText: newLines.join("\n") };
}

export function SuspectedFixCard({
  fix,
  newSourceIds,
  onCitationClick,
  className,
}: SuspectedFixCardProps) {
  if (!fix) return null;

  const { oldText, newText } = splitUnifiedDiff(fix.diff);

  return (
    <Card className={cn("overflow-hidden border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Code2 className="h-3.5 w-3.5" />
          Suspected Fix
        </CardTitle>
        <p className="font-mono text-xs text-muted-foreground">
          {fix.file}:{fix.line}
        </p>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="overflow-hidden rounded-md border border-border bg-[#0d1117] text-xs">
          <ReactDiffViewer
            oldValue={oldText}
            newValue={newText}
            splitView={false}
            useDarkTheme
            compareMethod={DiffMethod.LINES}
            hideLineNumbers={false}
            styles={{
              variables: {
                dark: {
                  diffViewerBackground: "#0d1117",
                  diffViewerColor: "#e6edf3",
                  addedBackground: "rgba(46, 160, 67, 0.15)",
                  addedColor: "#aff5b4",
                  removedBackground: "rgba(248, 81, 73, 0.15)",
                  removedColor: "#ffdcd7",
                  wordAddedBackground: "rgba(46, 160, 67, 0.4)",
                  wordRemovedBackground: "rgba(248, 81, 73, 0.4)",
                  addedGutterBackground: "rgba(46, 160, 67, 0.2)",
                  removedGutterBackground: "rgba(248, 81, 73, 0.2)",
                  gutterBackground: "#0d1117",
                  gutterBackgroundDark: "#0d1117",
                  highlightBackground: "#161b22",
                  highlightGutterBackground: "#161b22",
                  codeFoldGutterBackground: "#161b22",
                  codeFoldBackground: "#161b22",
                  emptyLineBackground: "#0d1117",
                  gutterColor: "#6e7681",
                  addedGutterColor: "#aff5b4",
                  removedGutterColor: "#ffdcd7",
                  codeFoldContentColor: "#6e7681",
                  diffViewerTitleBackground: "#161b22",
                  diffViewerTitleColor: "#e6edf3",
                  diffViewerTitleBorderColor: "#30363d",
                },
              },
              line: {
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "12px",
              },
            }}
          />
        </div>
        <div className="mt-3">
          <CitationPillRow
            citations={fix.citations}
            newSourceIds={newSourceIds}
            onPillClick={onCitationClick}
          />
        </div>
      </CardContent>
    </Card>
  );
}
