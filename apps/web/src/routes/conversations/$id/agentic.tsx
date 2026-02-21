
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DetailPanel } from "@/components/composed/DetailPanel";
import {
  UltraCompactCommandPalette,
  type CommandCategory,
  type PaletteCommand,
} from "@/components/composed/UltraCompactCommandPalette";
import { AgenticWorkflowView } from "@/components/domain/agentic-workflow";
import type {
  AgenticChatMessage,
  ModelOption,
  Question,
  SessionOption,
  ToolCall,
  WorkflowStatus,
} from "@/components/domain/agentic-workflow";
import { Switch } from "@/components/ui/switch";
import {
  Bot,
  Command as CommandIcon,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shield,
  Square,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/conversations/$id/agentic")({
  component: AgenticConversationPage,
});

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AgenticConversationPage() {
  const { id } = Route.useParams();

  const models: ModelOption[] = [
    { id: "claude-opus-4-5", name: "Claude Opus 4.5", description: "Most capable" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Balanced" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Fast" },
  ];

  const sessions: SessionOption[] = [
    { id: "session-1", name: "Agentic demo" },
    { id: "session-2", name: "Scratch" },
  ];

  const [selectedModelId, setSelectedModelId] = React.useState(models[1]!.id);
  const [selectedSessionId, setSelectedSessionId] = React.useState(sessions[0]!.id);
  const [status, setStatus] = React.useState<WorkflowStatus>("idle");
  const [autoApprove, setAutoApprove] = React.useState(false);

  const [messages, setMessages] = React.useState<AgenticChatMessage[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = React.useState<ToolCall[]>([]);
  const [pendingQuestions, setPendingQuestions] = React.useState<Question[]>([]);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [permissionOpen, setPermissionOpen] = React.useState(false);
  const [recentCommandIds, setRecentCommandIds] = React.useState<string[]>([
    "perm-auto",
    "workflow-reset",
  ]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    return () => {
      for (const m of messages) {
        for (const a of m.attachments ?? []) {
          if (a.previewUrl) {URL.revokeObjectURL(a.previewUrl);}
        }
      }
    };
  }, [messages]);

  const categories: Record<string, CommandCategory> = {
    tools: { name: "Tools", icon: Search },
    workflow: { name: "Workflow", icon: Play },
    permissions: { name: "Permissions", icon: Shield },
    view: { name: "View", icon: CommandIcon },
  };

  const commands: PaletteCommand[] = [
    { id: "tool-search", label: "Search tools", description: "Demo command", category: "tools", icon: Search, shortcut: "T" },
    { id: "workflow-start", label: "Start workflow", description: "Set status to thinking", category: "workflow", icon: Play, shortcut: "R" },
    { id: "workflow-pause", label: status === "paused" ? "Resume workflow" : "Pause workflow", description: "Toggle paused state", category: "workflow", icon: status === "paused" ? Play : Pause, shortcut: "P" },
    { id: "workflow-stop", label: "Stop workflow", description: "Stop current execution", category: "workflow", icon: Square, danger: true },
    { id: "workflow-reset", label: "Reset", description: "Clear everything", category: "workflow", icon: RotateCcw },
    { id: "perm-auto", label: "Toggle auto-approve", description: autoApprove ? "Currently ON" : "Currently OFF", category: "permissions", icon: Zap, shortcut: "A", active: autoApprove },
    { id: "perm-panel", label: "Open permissions panel", description: "Demo panel", category: "permissions", icon: Shield, shortcut: "S" },
    { id: "view-open-palette", label: "Open command palette", description: "Show commands", category: "view", icon: CommandIcon, shortcut: "K" },
  ];

  const bumpRecent = (cmdId: string) => {
    setRecentCommandIds((prev) => [cmdId, ...prev.filter((id) => id !== cmdId)].slice(0, 10));
  };

  const approveTool = (toolCallId: string, modifiedArgs?: Record<string, unknown>) => {
    setPendingToolCalls((prev) =>
      prev.map((tc) =>
        tc.toolCallId === toolCallId
          ? { ...tc, args: modifiedArgs ?? tc.args, status: "executing" }
          : tc
      )
    );
    setStatus("executing");

    window.setTimeout(() => {
      setPendingToolCalls((prev) =>
        prev.map((tc) =>
          tc.toolCallId === toolCallId
            ? { ...tc, status: "complete", result: { ok: true, toolCallId } }
            : tc
        )
      );
      setMessages((prev) => [
        ...prev,
        { id: uid("assistant"), role: "assistant", content: `Tool executed: ${toolCallId}`, timestamp: new Date().toLocaleTimeString() },
      ]);
      setStatus("complete");
    }, 1000);
  };

  const rejectTool = (toolCallId: string) => {
    setPendingToolCalls((prev) => prev.map((tc) => (tc.toolCallId === toolCallId ? { ...tc, status: "rejected" } : tc)));
    setMessages((prev) => [
      ...prev,
      { id: uid("assistant"), role: "assistant", content: "Okay — tool request rejected.", timestamp: new Date().toLocaleTimeString() },
    ]);
    setStatus("idle");
  };

  const answerQuestion = (questionId: string, answer: unknown) => {
    setPendingQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, status: "answered", answer } : q)));
    setStatus("thinking");
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: uid("assistant"),
          role: "assistant",
          content: `Proceeding with: ${Array.isArray(answer) ? answer.join(", ") : String(answer)}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setStatus("complete");
    }, 800);
  };

  const onSend = ({ content, attachments }: { content: string; attachments: AgenticChatMessage["attachments"] }) => {
    const userMsg: AgenticChatMessage = {
      id: uid("user"),
      role: "user",
      content,
      attachments,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStatus("thinking");

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: uid("assistant"), role: "assistant", content: "Working on it…", timestamp: new Date().toLocaleTimeString() },
      ]);

      const tc: ToolCall = {
        toolCallId: uid("tool"),
        toolName: "web_search",
        args: { query: content, maxResults: 5 },
        status: autoApprove ? "executing" : "pending",
        risk: "low",
      };
      setPendingToolCalls((prev) => [...prev, tc]);
      setStatus(autoApprove ? "executing" : "waiting_approval");
      if (autoApprove) {window.setTimeout(() => approveTool(tc.toolCallId), 500);}

      const q: Question = {
        id: uid("q"),
        text: "Which output style do you want?",
        type: "choice",
        status: "pending",
        multiple: false,
        options: [
          { id: "summary", label: "Quick summary", description: "Just the essentials" },
          { id: "actionable", label: "Actionable steps", description: "Concrete next steps" },
          { id: "detailed", label: "Detailed analysis", description: "Include caveats" },
        ],
      };
      setPendingQuestions((prev) => [...prev, q]);
      if (!autoApprove) {setStatus("waiting_input");}
    }, 700);
  };

  const onExecuteCommand = (cmd: PaletteCommand) => {
    bumpRecent(cmd.id);
    switch (cmd.id) {
      case "perm-auto":
        setAutoApprove((v) => !v);
        return;
      case "perm-panel":
        setPermissionOpen(true);
        return;
      case "view-open-palette":
        setPaletteOpen(true);
        return;
      case "workflow-reset":
        setMessages([]);
        setPendingToolCalls([]);
        setPendingQuestions([]);
        setStatus("idle");
        return;
      case "workflow-pause":
        setStatus((s) => (s === "paused" ? "idle" : "paused"));
        return;
      case "workflow-stop":
        setStatus("idle");
        setPendingToolCalls((prev) =>
          prev.map((t) => (t.status === "executing" ? { ...t, status: "error", error: "Stopped" } : t))
        );
        return;
      case "workflow-start":
        setStatus("thinking");
        return;
      default:
        return;
    }
  };

  return (
    <>
      <AgenticWorkflowView
        title={`Agentic View • ${id}`}
        models={models}
        sessions={sessions}
        selectedModelId={selectedModelId}
        selectedSessionId={selectedSessionId}
        onSelectModelId={setSelectedModelId}
        onSelectSessionId={setSelectedSessionId}
        status={status}
        autoApprove={autoApprove}
        onAutoApproveChange={setAutoApprove}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenPermissions={() => setPermissionOpen(true)}
        messages={messages}
        pendingToolCalls={pendingToolCalls}
        pendingQuestions={pendingQuestions}
        toolMeta={{
          web_search: { title: "Web Search", description: "Search the internet for current info", icon: Search },
        }}
        thinkingText="Processing…"
        composerDisabled={status === "paused"}
        onSend={onSend}
        onApproveTool={approveTool}
        onRejectTool={rejectTool}
        onAnswerQuestion={answerQuestion}
      />

      <UltraCompactCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        categories={categories}
        commands={commands}
        recentCommandIds={recentCommandIds}
        onExecute={onExecuteCommand}
      />

      <DetailPanel open={permissionOpen} onClose={() => setPermissionOpen(false)} title="Permissions" width="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                <Bot className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">Auto-approve</div>
                <div className="text-xs text-muted-foreground">Auto-approve low-risk tools for the demo.</div>
              </div>
              <div className="ml-auto">
                <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            This panel is intentionally minimal — it exists to make it easy to wire up real tool risk policies.
          </p>
        </div>
      </DetailPanel>
    </>
  );
}
