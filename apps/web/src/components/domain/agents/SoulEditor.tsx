"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Save,
  RotateCcw,
  Eye,
  Edit3,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAgentFile, useAgentFileSave } from "@/hooks/queries/useAgentFiles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SoulEditorProps {
  agentId: string;
}

type ViewMode = "edit" | "preview" | "split";

// ---------------------------------------------------------------------------
// Simple Markdown Preview
// ---------------------------------------------------------------------------

function MarkdownPreview({ content }: { content: string }) {
  // Basic markdown-to-HTML for preview. In production, use a proper markdown
  // renderer (rehype/remark). This covers the common cases for SOUL.md files.
  const html = React.useMemo(() => {
    let result = content
      // Headers
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      // Code blocks
      .replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
        return `<pre><code>${code}</code></pre>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Horizontal rule
      .replace(/^---$/gm, "<hr />")
      // Lists
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      // Paragraphs (consecutive non-empty lines)
      .replace(/\n\n/g, "</p><p>")
      // Line breaks
      .replace(/\n/g, "<br />");

    return `<p>${result}</p>`;
  }, [content]);

  return (
    <div
      className="prose prose-sm prose-invert max-w-none
        prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
        prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-6
        prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-5
        prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4
        prose-p:text-muted-foreground prose-p:leading-relaxed
        prose-strong:text-foreground
        prose-em:text-muted-foreground
        prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
        prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-4
        prose-li:text-muted-foreground prose-li:marker:text-primary/50
        prose-hr:border-border
      "
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SoulEditor({ agentId }: SoulEditorProps) {
  const { file, content, isLoading, error: loadError, refetch } = useAgentFile(agentId, "SOUL.md");
  const { save, isSaving, error: saveError, reset: resetSave } = useAgentFileSave();

  const [localContent, setLocalContent] = React.useState<string>("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("split");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Sync remote content → local state
  React.useEffect(() => {
    if (content != null && !hasUnsavedChanges) {
      setLocalContent(content);
    }
  }, [content, hasUnsavedChanges]);

  // Track unsaved changes
  const handleContentChange = (value: string) => {
    setLocalContent(value);
    setHasUnsavedChanges(value !== (content ?? ""));
    setSaveSuccess(false);
    resetSave();
  };

  // Save
  const handleSave = async () => {
    try {
      await save(agentId, "SOUL.md", localContent);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      // Clear success indicator after 3s
      setTimeout(() => setSaveSuccess(false), 3000);
      // Refresh the file data
      void refetch();
    } catch {
      // Error is captured in saveError
    }
  };

  // Revert
  const handleRevert = () => {
    setLocalContent(content ?? "");
    setHasUnsavedChanges(false);
    setSaveSuccess(false);
    resetSave();
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && !isSaving) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasUnsavedChanges, isSaving, localContent]);

  const isEmpty = !content && file?.missing !== false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Soul
              {hasUnsavedChanges && (
                <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500/30">
                  Unsaved changes
                </Badge>
              )}
              {saveSuccess && (
                <Badge variant="outline" className="ml-2 text-emerald-500 border-emerald-500/30">
                  <CheckCircle2 className="size-3 mr-1" />
                  Saved
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Define who this agent is — personality, voice, values, and communication style.
              This is the most important file for shaping agent behavior.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggles */}
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("edit")}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === "edit"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit only</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("split")}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === "split"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Split view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === "preview"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Preview only</TooltipContent>
              </Tooltip>
            </div>

            {/* Actions */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Revert
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
              <kbd className="ml-1 hidden rounded border border-border/50 px-1 py-0.5 text-[10px] font-normal text-muted-foreground sm:inline-block">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading SOUL.md…</span>
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="size-4 inline mr-2" />
            Failed to load file: {String(loadError)}
          </div>
        ) : (
          <div className={`flex gap-4 ${viewMode === "split" ? "flex-row" : "flex-col"}`}>
            {/* Editor */}
            {(viewMode === "edit" || viewMode === "split") && (
              <div className={viewMode === "split" ? "flex-1" : "w-full"}>
                <textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={
                    isEmpty
                      ? `# SOUL.md — Agent Name\n\nDescribe who this agent is...\n\n## Core Identity\n\nWhat defines this agent's personality?\n\n## Communication Style\n\nHow does this agent talk?\n\n## What Drives You\n\nWhat motivates this agent?`
                      : "Enter SOUL.md content..."
                  }
                  className="w-full min-h-[500px] rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed text-foreground outline-none resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Preview */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div
                className={`${viewMode === "split" ? "flex-1" : "w-full"} rounded-lg border border-border bg-muted/10 p-6 overflow-y-auto max-h-[600px]`}
              >
                {localContent.trim() ? (
                  <MarkdownPreview content={localContent} />
                ) : (
                  <div className="text-center py-12">
                    <Sparkles className="size-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Start writing to see a preview here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="size-4 inline mr-2" />
            Failed to save: {String(saveError)}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
