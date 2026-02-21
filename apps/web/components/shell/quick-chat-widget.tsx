"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  Maximize2,
} from "lucide-react";
import Link from "next/link";

type QuickMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export function QuickChatWidget({
  agentId,
  agentName,
  agentEmoji = "🤖",
  maxMessages = 4,
}: {
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
  maxMessages?: number;
}) {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const addEventListener = useGatewayStore((s) => s.addEventListener);

  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<QuickMessage[]>([]);
  const [sending, setSending] = React.useState(false);
  const [streaming, setStreaming] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Listen for streaming responses
  React.useEffect(() => {
    if (!connected) return;

    const unsubDelta = addEventListener("chat.delta", (payload: unknown) => {
      const data = payload as { content?: string };
      if (data.content) {
        setStreaming((prev) => prev + data.content);
      }
    });

    const unsubFinal = addEventListener("chat.final", (payload: unknown) => {
      const data = payload as { content?: string };
      const content = streaming || (data.content as string) || "";
      if (content) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant" as const, content, timestamp: Date.now() },
        ].slice(-maxMessages * 2));
      }
      setStreaming("");
      setSending(false);
    });

    const unsubError = addEventListener("chat.error", () => {
      setStreaming("");
      setSending(false);
    });

    return () => {
      unsubDelta();
      unsubFinal();
      unsubError();
    };
  }, [connected, addEventListener, streaming, maxMessages]);

  const handleSend = async () => {
    if (!input.trim() || !connected || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);
    setStreaming("");

    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: userMessage, timestamp: Date.now() },
    ].slice(-maxMessages * 2));

    try {
      await request("chat.send", {
        message: userMessage,
        agentId,
      });
    } catch {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Quick Chat
            {agentName && (
              <span className="text-muted-foreground font-normal">
                with {agentEmoji} {agentName}
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link href={agentId ? `/chat?agent=${agentId}` : "/chat"}>
              <Maximize2 className="h-3 w-3 mr-1" />
              Full Chat
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="h-48 overflow-y-auto space-y-2 rounded-lg bg-muted/30 p-3"
        >
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Send a message to start chatting</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <span className="text-sm mt-1 shrink-0">{agentEmoji}</span>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <User className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}

          {/* Streaming response */}
          {streaming && (
            <div className="flex gap-2">
              <span className="text-sm mt-1 shrink-0">{agentEmoji}</span>
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-xs bg-muted">
                {streaming}
                <span className="inline-block w-1.5 h-3 bg-primary/50 animate-pulse ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={connected ? "Type a message..." : "Connect to gateway first"}
            disabled={!connected || sending}
            className="text-xs h-9"
          />
          <Button
            size="sm"
            onClick={() => void handleSend()}
            disabled={!input.trim() || !connected || sending}
            className="h-9 px-3"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
