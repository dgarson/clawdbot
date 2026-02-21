"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, AlertCircle, Copy, Check } from "lucide-react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
}

interface FilePreviewPanelProps {
  file: FileNode | null;
  content: string;
  loading: boolean;
  error: string | null;
}

export function FilePreviewPanel({ file, content, loading, error }: FilePreviewPanelProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <div className="flex flex-col items-center gap-2 text-center">
          <FileText className="h-12 w-12 opacity-50" />
          <p className="text-sm">Select a file to preview</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    const isApiNotImplemented = error.includes("not yet implemented") || error.includes("API endpoints");

    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <AlertCircle className={cn(
            "h-10 w-10",
            isApiNotImplemented ? "text-yellow-500" : "text-destructive"
          )} />
          <div className="space-y-2">
            <p className={cn(
              "text-sm font-medium",
              isApiNotImplemented ? "text-yellow-600 dark:text-yellow-400" : "text-destructive"
            )}>
              {isApiNotImplemented ? "Preview Not Available" : "Error Loading File"}
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          {isApiNotImplemented && (
            <div className="mt-2 rounded-md bg-muted/50 border border-border p-3 text-left">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Next steps:</strong> The backend needs to implement
                worktree RPC methods in the gateway (e.g., <code className="text-xs bg-muted px-1 py-0.5 rounded">worktree.read</code>,{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">worktree.list</code>).
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono truncate">{file.name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
          title="Copy content"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderFileContent(content, fileExt)}
        </div>
      </ScrollArea>
    </div>
  );
}

function renderFileContent(content: string, fileExt: string): React.ReactNode {
  // Markdown files
  if (fileExt === "md" || fileExt === "markdown") {
    return renderMarkdown(content);
  }

  // JSON files
  if (fileExt === "json") {
    return renderJSON(content);
  }

  // JSONL files
  if (fileExt === "jsonl") {
    return renderJSONL(content);
  }

  // Code/text files
  return renderCode(content, fileExt);
}

function renderMarkdown(content: string): React.ReactNode {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();

        // Headings
        if (trimmed.startsWith("# ")) {
          return <h1 key={i} className="text-2xl font-bold mt-6 mb-4">{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith("## ")) {
          return <h2 key={i} className="text-xl font-bold mt-5 mb-3">{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith("### ")) {
          return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith("#### ")) {
          return <h4 key={i} className="text-base font-semibold mt-3 mb-2">{trimmed.slice(5)}</h4>;
        }

        // Lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return <li key={i} className="ml-4">{trimmed.slice(2)}</li>;
        }
        if (/^\d+\.\s/.test(trimmed)) {
          return <li key={i} className="ml-4">{trimmed.replace(/^\d+\.\s/, "")}</li>;
        }

        // Code blocks
        if (trimmed.startsWith("```")) {
          return <code key={i} className="block bg-muted px-2 py-1 rounded text-xs font-mono">{trimmed.slice(3)}</code>;
        }

        // Empty line
        if (trimmed === "") {
          return <br key={i} />;
        }

        // Paragraph
        return <p key={i} className="mb-2">{line}</p>;
      })}
    </div>
  );
}

function renderJSON(content: string): React.ReactNode {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap text-primary bg-muted/30 rounded-md p-4">
        {formatted}
      </pre>
    );
  } catch {
    return renderCode(content, "json");
  }
}

function renderJSONL(content: string): React.ReactNode {
  try {
    const lines = content.split("\n").filter(line => line.trim());
    const formatted = lines
      .map(line => JSON.stringify(JSON.parse(line), null, 2))
      .join("\n---\n");
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap text-primary bg-muted/30 rounded-md p-4">
        {formatted}
      </pre>
    );
  } catch {
    return renderCode(content, "jsonl");
  }
}

function renderCode(content: string, fileExt: string): React.ReactNode {
  const language = getLanguageFromExtension(fileExt);
  return (
    <pre className={cn(
      "text-xs font-mono whitespace-pre-wrap text-primary bg-muted/30 rounded-md p-4",
      `language-${language}`
    )}>
      {content}
    </pre>
  );
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    md: "markdown",
    json: "json",
    jsonl: "jsonl",
    yaml: "yaml",
    yml: "yaml",
    html: "html",
    css: "css",
    sql: "sql",
    txt: "text",
  };
  return languageMap[ext] || "text";
}
