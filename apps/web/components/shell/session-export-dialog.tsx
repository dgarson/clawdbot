"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  Code,
  FileJson,
  Copy,
  Check,
  Loader2,
  X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
type ExportFormat = "markdown" | "json" | "text";

type ExportMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  ts?: number;
  agentId?: string;
};

// ─── Format Config ───────────────────────────────────────
const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  extension: string;
  mimeType: string;
}[] = [
  {
    id: "markdown",
    label: "Markdown",
    description: "Rich formatting with headers and code blocks",
    icon: FileText,
    extension: "md",
    mimeType: "text/markdown",
  },
  {
    id: "json",
    label: "JSON",
    description: "Structured data — good for programmatic use",
    icon: FileJson,
    extension: "json",
    mimeType: "application/json",
  },
  {
    id: "text",
    label: "Plain Text",
    description: "Simple readable format",
    icon: Code,
    extension: "txt",
    mimeType: "text/plain",
  },
];

// ─── Formatters ──────────────────────────────────────────
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function toMarkdown(
  messages: ExportMessage[],
  meta: { sessionKey: string; agentId?: string; exportedAt: string }
): string {
  const lines: string[] = [
    `# Session Transcript`,
    ``,
    `- **Session:** \`${meta.sessionKey}\``,
    meta.agentId ? `- **Agent:** ${meta.agentId}` : "",
    `- **Messages:** ${messages.length}`,
    `- **Exported:** ${meta.exportedAt}`,
    ``,
    `---`,
    ``,
  ].filter(Boolean);

  for (const msg of messages) {
    const time = msg.ts ? `*${formatDate(msg.ts)}*` : "";
    const roleLabel = msg.role === "assistant" ? "🤖 Assistant" : msg.role === "user" ? "👤 User" : "⚙️ System";

    lines.push(`### ${roleLabel} ${time}`);
    lines.push(``);
    lines.push(msg.content);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join("\n");
}

function toPlainText(
  messages: ExportMessage[],
  meta: { sessionKey: string; agentId?: string; exportedAt: string }
): string {
  const lines: string[] = [
    `Session Transcript`,
    `Session: ${meta.sessionKey}`,
    meta.agentId ? `Agent: ${meta.agentId}` : "",
    `Messages: ${messages.length}`,
    `Exported: ${meta.exportedAt}`,
    "=".repeat(60),
    ``,
  ].filter(Boolean);

  for (const msg of messages) {
    const time = msg.ts ? `[${formatDate(msg.ts)}]` : "";
    const role = msg.role.toUpperCase();

    lines.push(`${role} ${time}`);
    lines.push(msg.content);
    lines.push("-".repeat(40));
    lines.push(``);
  }

  return lines.join("\n");
}

function toJSON(
  messages: ExportMessage[],
  meta: { sessionKey: string; agentId?: string; exportedAt: string }
): string {
  return JSON.stringify(
    {
      meta: {
        sessionKey: meta.sessionKey,
        agentId: meta.agentId,
        messageCount: messages.length,
        exportedAt: meta.exportedAt,
        format: "openclaw-transcript-v1",
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.ts ? new Date(m.ts).toISOString() : undefined,
      })),
    },
    null,
    2
  );
}

// ─── Download Helper ─────────────────────────────────────
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main Component ──────────────────────────────────────
export function SessionExportDialog({
  open,
  onOpenChange,
  sessionKey,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionKey: string;
  agentId?: string;
}) {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);

  const [format, setFormat] = React.useState<ExportFormat>("markdown");
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ExportMessage[]>([]);

  // Load messages when dialog opens
  React.useEffect(() => {
    if (!open || !connected) {return;}

    setLoading(true);
    setError(null);
    setPreview(null);

    request<{ messages: ExportMessage[] }>("sessions.history", {
      sessionKey,
      limit: 1000,
    })
      .then((result) => {
        const msgs = result.messages ?? [];
        setMessages(msgs);
        generatePreview(msgs, format);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load session");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, connected, sessionKey, request]);

  const generatePreview = (msgs: ExportMessage[], fmt: ExportFormat) => {
    const meta = {
      sessionKey,
      agentId,
      exportedAt: new Date().toISOString(),
    };

    switch (fmt) {
      case "markdown":
        setPreview(toMarkdown(msgs, meta));
        break;
      case "json":
        setPreview(toJSON(msgs, meta));
        break;
      case "text":
        setPreview(toPlainText(msgs, meta));
        break;
    }
  };

  const handleFormatChange = (fmt: ExportFormat) => {
    setFormat(fmt);
    if (messages.length) {
      generatePreview(messages, fmt);
    }
  };

  const handleDownload = () => {
    if (!preview) {return;}
    const formatConfig = FORMAT_OPTIONS.find((f) => f.id === format)!;
    const filename = `${sessionKey.replace(/[^a-z0-9-]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.${formatConfig.extension}`;
    downloadFile(preview, filename, formatConfig.mimeType);
  };

  const handleCopy = async () => {
    if (!preview) {return;}
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 bg-background rounded-2xl border border-border shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Export Transcript</h2>
              <p className="text-xs text-muted-foreground">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
                {agentId && ` • ${agentId}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Selection */}
        <div className="px-6 py-4 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Export format</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMAT_OPTIONS.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleFormatChange(id)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                  format === id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${format === id ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            {preview && (
              <span className="text-[10px] text-muted-foreground">
                {(preview.length / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          {loading ? (
            <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="h-48 bg-destructive/10 rounded-lg flex items-center justify-center text-sm text-destructive">
              {error}
            </div>
          ) : (
            <pre className="h-48 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
              {preview
                ? preview.length > 3000
                  ? preview.slice(0, 3000) + "\n\n... (truncated preview)"
                  : preview
                : "No messages to export"}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!preview}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!preview}
            >
              <Download className="h-3 w-3 mr-1" />
              Download .{FORMAT_OPTIONS.find((f) => f.id === format)?.extension}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
