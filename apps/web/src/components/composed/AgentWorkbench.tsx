
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DetailPanel } from "@/components/composed/DetailPanel";
import type { WebTerminalRef } from "@/components/composed/WebTerminal";
import { WorktreeFileManager } from "@/components/integrations/WorktreeFileManager";
import { ChatThread } from "@/components/domain/chat";
import type { Message } from "@/stores/useConversationStore";
import type { Agent } from "@/stores/useAgentStore";
import type { WorktreeAdapter, WorktreeEntry } from "@/integrations/worktree";
import { toast } from "sonner";
import { Copy, FileText, MessageSquare, Loader2 } from "lucide-react";

// Lazy-load WebTerminal and all xterm dependencies
const LazyWebTerminal = React.lazy(() =>
  import("@/components/composed/WebTerminal").then((mod) => ({
    default: mod.WebTerminal,
  }))
);

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export type AgentWorkbenchProps = {
  className?: string;
  height?: number | string;

  agentId: string;
  agent?: Agent;

  conversation: {
    id: string;
    title?: string;
    messages: Message[];
    onSend?: (content: string) => Promise<void> | void;
  };

  worktree: {
    adapter: WorktreeAdapter;
    initialPath?: string;
    pinnedPaths?: Array<{ label: string; path: string }>;
  };

  terminal?: {
    welcomeMessage?: string;
    onData?: (data: string) => void;
    onResize?: (cols: number, rows: number) => void;
  };
};

export function AgentWorkbench({
  className,
  height = 720,
  agentId,
  agent,
  conversation,
  worktree,
  terminal,
}: AgentWorkbenchProps) {
  const terminalRef = React.useRef<WebTerminalRef | null>(null);
  const [messageInput, setMessageInput] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<WorktreeEntry | null>(null);
  const [filePanelOpen, setFilePanelOpen] = React.useState(false);

  const fileQuery = useQuery({
    queryKey: ["worktreeFile", agentId, selectedFile?.path ?? null] as const,
    queryFn: ({ signal }) => {
      if (!selectedFile) {return Promise.resolve(null);}
      if (!worktree.adapter.readFile) {return Promise.resolve(null);}
      return worktree.adapter.readFile(agentId, selectedFile.path, { signal });
    },
    enabled: Boolean(selectedFile) && !!worktree.adapter.readFile,
  });

  const onSend = React.useCallback(async () => {
    const text = messageInput.trim();
    if (!text) {return;}
    setMessageInput("");
    try {
      await conversation.onSend?.(text);
    } catch (e) {
      toast.error("Failed to send message");
      console.error("[AgentWorkbench] send failed:", e);
    }
  }, [conversation, messageInput]);

  const handleTerminalData = React.useCallback(
    (data: string) => {
      if (terminal?.onData) {
        terminal.onData(data);
        return;
      }
      // Local echo fallback so the terminal feels alive even before wiring a backend.
      terminalRef.current?.write(data);
    },
    [terminal]
  );

  return (
    <div
      className={cn("grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", className)}
      style={{ height }}
    >
      {/* Conversation */}
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <div className="truncate text-sm font-medium text-foreground">
                {conversation.title ?? "Session"}
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Agent: <span className="text-foreground">{agent?.name ?? agentId}</span>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {conversation.id}
          </Badge>
        </div>

        <ChatThread messages={conversation.messages} agent={agent} className="min-h-0 flex-1 px-4 py-4" />

        <Separator />

        <div className="flex items-center gap-2 px-4 py-3">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Message…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <Button onClick={() => void onSend()}>Send</Button>
        </div>
      </Card>

      {/* Right side: Worktree + Terminal */}
      <div className="grid min-h-0 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <div className="min-h-0">
          <WorktreeFileManager
            agentId={agentId}
            adapter={worktree.adapter}
            initialPath={worktree.initialPath}
            pinnedPaths={worktree.pinnedPaths}
            height="100%"
            onOpenFile={(file) => {
              setSelectedFile(file);
              setFilePanelOpen(true);
            }}
          />
        </div>

        <div className="min-h-0">
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-background rounded-lg border border-border">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-sm text-muted-foreground">Loading terminal...</div>
                </div>
              </div>
            }
          >
            <LazyWebTerminal
              ref={terminalRef}
              height="100%"
              welcomeMessage={terminal?.welcomeMessage ?? "Clawdbrain Workbench Terminal (stub)"}
              onData={handleTerminalData}
              onResize={terminal?.onResize}
            />
          </React.Suspense>
        </div>
      </div>

      {/* File details */}
      <DetailPanel
        open={filePanelOpen && !!selectedFile}
        onClose={() => setFilePanelOpen(false)}
        title={selectedFile?.name ?? "File"}
        width="lg"
      >
        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {selectedFile.kind}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono break-all">
                {selectedFile.path}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void copyToClipboard(selectedFile.path)
                    .then(() => toast.success("Path copied"))
                    .catch(() => toast.error("Failed to copy path"));
                }}
              >
                <Copy className="h-4 w-4" />
                Copy path
              </Button>
            </div>

            {!worktree.adapter.readFile ? (
              <div className="text-sm text-muted-foreground">
                Provide <code className="font-mono">worktree.adapter.readFile</code> to preview files.
              </div>
            ) : fileQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading file…</div>
            ) : fileQuery.error ? (
              <div className="text-sm text-destructive">
                {fileQuery.error instanceof Error ? fileQuery.error.message : String(fileQuery.error)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">Preview</div>
                </div>
                <ScrollArea className="h-[520px] rounded-xl border border-border bg-background">
                  <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs text-foreground">
                    {fileQuery.data?.content ?? ""}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        ) : null}
      </DetailPanel>
    </div>
  );
}

export default AgentWorkbench;
