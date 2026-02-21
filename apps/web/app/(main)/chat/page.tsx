"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import type { AgentsListResult, AgentIdentityResult, SessionEntry, ChatMessage } from "@/lib/gateway/types";
import {
  Send,
  Square,
  Bot,
  User,
  Loader2,
  Plus,
  MessageSquare,
  RotateCcw,
  Copy,
  Check,
  Paperclip,
  ChevronLeft,
  Settings2,
} from "lucide-react";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts?: number;
  streaming?: boolean;
};

function MessageBubble({
  message,
  agentName,
  agentEmoji,
}: {
  message: DisplayMessage;
  agentName: string;
  agentEmoji: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            <User className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-base">
            {agentEmoji}
          </div>
        )}
      </div>

      <div className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <span className="text-xs text-muted-foreground mb-1">
          {isUser ? "You" : agentName}
          {message.ts && (
            <span className="ml-2">
              {new Date(message.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </span>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border rounded-bl-md"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
            {message.streaming && (
              <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
        {!isUser && !message.streaming && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionSidebar({
  sessions,
  activeKey,
  onSelect,
  onNew,
  identities,
}: {
  sessions: SessionEntry[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onNew: () => void;
  identities: Record<string, AgentIdentityResult>;
}) {
  return (
    <div className="w-64 border-r border-border flex flex-col bg-sidebar">
      <div className="p-3 border-b border-border">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map((session) => {
            const isActive = session.key === activeKey;
            const identity = session.agentId ? identities[session.agentId] : undefined;
            return (
              <button
                key={session.key}
                onClick={() => onSelect(session.key)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{identity?.emoji ?? "💬"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-xs">
                      {session.derivedTitle ?? session.label ?? "Chat"}
                    </p>
                    {session.lastActiveAtMs && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatTimeAgo(session.lastActiveAtMs)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ChatPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const addEventListener = useGatewayStore((s) => s.addEventListener);
  const snapshot = useGatewayStore((s) => s.snapshot);

  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [streaming, setStreaming] = React.useState(false);
  const [streamContent, setStreamContent] = React.useState("");
  const [currentRunId, setCurrentRunId] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<SessionEntry[]>([]);
  const [activeSessionKey, setActiveSessionKey] = React.useState<string | null>(null);
  const [identities, setIdentities] = React.useState<Record<string, AgentIdentityResult>>({});
  const [agentName, setAgentName] = React.useState("Assistant");
  const [agentEmoji, setAgentEmoji] = React.useState("🤖");
  const [showSidebar, setShowSidebar] = React.useState(true);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // Get session key
  const sessionKey = activeSessionKey ?? snapshot?.sessionDefaults?.mainSessionKey ?? "main";

  // Load sessions & history
  React.useEffect(() => {
    if (!connected) return;
    (async () => {
      try {
        const result = await request<{ sessions: SessionEntry[] }>("sessions.list", {
          limit: 50,
          includeDerivedTitles: true,
          includeLastMessage: true,
        });
        setSessions(result.sessions ?? []);
      } catch { /* skip */ }
    })();
  }, [connected, request]);

  // Load chat history when session changes
  React.useEffect(() => {
    if (!connected || !sessionKey) return;
    (async () => {
      try {
        const history = await request<{ messages: ChatMessage[] }>("chat.history", {
          sessionKey,
          limit: 100,
        });
        const displayMessages: DisplayMessage[] = (history.messages ?? []).map((m, i) => ({
          id: `hist-${i}`,
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          ts: m.ts,
        }));
        setMessages(displayMessages);
      } catch {
        setMessages([]);
      }
    })();
  }, [connected, request, sessionKey]);

  // Subscribe to chat events
  React.useEffect(() => {
    const unsub = addEventListener("chat", (payload) => {
      const evt = payload as {
        runId: string;
        sessionKey: string;
        state: string;
        message?: { content?: string; delta?: string };
        errorMessage?: string;
      };

      if (evt.sessionKey !== sessionKey) return;

      if (evt.state === "delta") {
        const delta =
          typeof evt.message === "object" && evt.message
            ? (evt.message as Record<string, unknown>).delta ?? (evt.message as Record<string, unknown>).content ?? ""
            : "";
        setStreamContent((prev) => prev + String(delta));
        setStreaming(true);
        setCurrentRunId(evt.runId);
      } else if (evt.state === "final") {
        const content =
          typeof evt.message === "object" && evt.message
            ? String((evt.message as Record<string, unknown>).content ?? "")
            : streamContent;
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: content || streamContent,
            ts: Date.now(),
          },
        ]);
        setStreamContent("");
        setStreaming(false);
        setCurrentRunId(null);
        setSending(false);
      } else if (evt.state === "error") {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `Error: ${evt.errorMessage ?? "Unknown error"}`,
            ts: Date.now(),
          },
        ]);
        setStreamContent("");
        setStreaming(false);
        setCurrentRunId(null);
        setSending(false);
      } else if (evt.state === "aborted") {
        if (streamContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: `abort-${Date.now()}`,
              role: "assistant",
              content: streamContent + "\n\n_(aborted)_",
              ts: Date.now(),
            },
          ]);
        }
        setStreamContent("");
        setStreaming(false);
        setCurrentRunId(null);
        setSending(false);
      }
    });
    return unsub;
  }, [addEventListener, sessionKey, streamContent]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !connected || sending) return;

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setSending(true);
    setStreamContent("");

    try {
      await request("chat.send", {
        sessionKey,
        message: text,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err) {
      console.error("Failed to send:", err);
      setSending(false);
    }

    textareaRef.current?.focus();
  };

  const handleAbort = async () => {
    try {
      await request("chat.abort", { sessionKey, runId: currentRunId ?? undefined });
    } catch { /* skip */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <ComplexityGate level="standard">
        {showSidebar && (
          <SessionSidebar
            sessions={sessions}
            activeKey={activeSessionKey}
            onSelect={(key) => setActiveSessionKey(key)}
            onNew={() => {
              setActiveSessionKey(null);
              setMessages([]);
            }}
            identities={identities}
          />
        )}
      </ComplexityGate>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{agentEmoji}</span>
            <span className="font-medium text-sm">{agentName}</span>
            {connected && (
              <Badge variant="success" className="text-[10px]">Online</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ComplexityGate level="standard">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowSidebar(!showSidebar)}
                title="Toggle sessions"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </ComplexityGate>
            <ComplexityGate level="expert">
              <Button variant="ghost" size="icon-sm" title="Session settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </ComplexityGate>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">{agentEmoji}</div>
                <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Type a message below to chat with your agent. They can help with tasks,
                  answer questions, and more.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="group">
                <MessageBubble message={msg} agentName={agentName} agentEmoji={agentEmoji} />
              </div>
            ))}
            {streaming && streamContent && (
              <div className="group">
                <MessageBubble
                  message={{
                    id: "streaming",
                    role: "assistant",
                    content: streamContent,
                    streaming: true,
                  }}
                  agentName={agentName}
                  agentEmoji={agentEmoji}
                />
              </div>
            )}
            {sending && !streaming && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border bg-background p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sending ? "Waiting for response..." : "Type a message..."}
                  disabled={!connected}
                  className="min-h-[44px] max-h-[200px] resize-none pr-12"
                  rows={1}
                />
              </div>
              {sending || streaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleAbort}
                  className="shrink-0"
                  title="Stop generating"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !connected}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}
