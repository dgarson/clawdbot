"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/composed";
import { Button } from "@/components/ui/button";
import { User, ChevronDown, ChevronUp } from "lucide-react";
import type { ChatMessage, ToolCall } from "@/lib/api/sessions";

export interface SessionChatMessageProps {
  message: ChatMessage & {
    id?: string;
    agentName?: string;
    agentStatus?: "active" | "ready";
    isStreaming?: boolean;
  };
  className?: string;
}

/**
 * Filter out tool output from message content.
 * Tool outputs should ONLY appear in the tool details section, not in the main message.
 */
function filterToolOutputFromContent(content: string): string {
  // If the content looks like raw tool output (e.g., ls output, command output),
  // return empty string so it doesn't appear in the message bubble
  const toolOutputPatterns = [
    /^total \d+\s*\ndrwxr-xr-x/m,     // ls -la output
    /^drwxr-xr-x[\s\S]*?staff/m,     // File listing with permissions
    /^-rw-r--r--[\s\S]*?staff/m,     // File listing
  ];

  // Check if the entire content is tool output
  const isOnlyToolOutput = toolOutputPatterns.some(pattern => pattern.test(content));
  if (isOnlyToolOutput) {
    return "";
  }

  // Otherwise return the content as-is
  return content;
}

export function SessionChatMessage({ message, className }: SessionChatMessageProps) {
  const isUser = message.role === "user";
  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // Filter out tool output from assistant messages
  const displayContent = isUser ? message.content : filterToolOutputFromContent(message.content);
  const taskTitle = React.useMemo(() => {
    if (!displayContent) {
      return "Tool calls";
    }
    const firstLine = displayContent
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!firstLine) {
      return "Tool calls";
    }
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
  }, [displayContent]);

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      {/* Agent avatar for assistant messages */}
      {!isUser && message.agentName && (
        <AgentAvatar
          name={message.agentName}
          size="sm"
          status={message.agentStatus}
          className="mt-1 shrink-0"
        />
      )}

      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] space-y-2",
          isUser && "order-first"
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border shadow-sm"
          )}
        >
          {/* Header */}
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span
              className={cn(
                "font-medium",
                isUser ? "text-primary-foreground/90" : "text-foreground"
              )}
            >
              {isUser ? "You" : message.agentName || "Assistant"}
            </span>
            {formattedTime && (
              <span
                className={cn(
                  isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {formattedTime}
              </span>
            )}
          </div>

          {/* Content - only show if there's actual text content (not just tool output) */}
          {displayContent && (
            <div
              className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap",
                isUser ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {displayContent}
              {message.isStreaming && (
                <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current" />
              )}
            </div>
          )}
        </div>

        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallTimeline toolCalls={message.toolCalls} taskTitle={taskTitle} />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

interface ToolCallTimelineProps {
  toolCalls: ToolCall[];
  taskTitle: string;
}

function ToolCallTimeline({ toolCalls, taskTitle }: ToolCallTimelineProps) {
  const [showAllTools, setShowAllTools] = React.useState(false);
  const [showToolOutputs, setShowToolOutputs] = React.useState(false);
  const collapsedCount = 3;
  const visibleTools = showAllTools ? toolCalls : toolCalls.slice(0, collapsedCount);
  const remainingCount = toolCalls.length - visibleTools.length;

  /**
   * Strip security wrappers from external content.
   * These wrappers are meant for LLM context only, not user display.
   */
  const stripSecurityWrappers = (content: string): string => {
    let cleaned = content;

    // Remove security wrapper boundaries
    cleaned = cleaned.replace(/<<<EXTERNAL_UNTRUSTED_CONTENT>>>/g, "");
    cleaned = cleaned.replace(/<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, "");

    // Remove security warning block (multi-line warning about untrusted content)
    const warningPattern = /SECURITY NOTICE:[\s\S]*?(?=Source:|$)/;
    cleaned = cleaned.replace(warningPattern, "");

    // Remove metadata lines that are part of the wrapper
    cleaned = cleaned.replace(/^Source: (Email|Webhook|API|Web Search|Web Fetch|External)\s*\n/gm, "");
    cleaned = cleaned.replace(/^From: .*\n/gm, "");
    cleaned = cleaned.replace(/^Subject: .*\n/gm, "");
    cleaned = cleaned.replace(/^---\s*\n/gm, "");

    return cleaned.trim();
  };

  const stripWrappersRecursively = (value: string): string => {
    try {
      const parsed = JSON.parse(value);
      const cleaned = stripWrappersFromValue(parsed);
      return JSON.stringify(cleaned, null, 2);
    } catch {
      return stripSecurityWrappers(value);
    }
  };

  const stripWrappersFromValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      return stripSecurityWrappers(value);
    }
    if (Array.isArray(value)) {
      return value.map(stripWrappersFromValue);
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = stripWrappersFromValue(val);
      }
      return result;
    }
    return value;
  };

  const getToolLine = (tool: ToolCall) => {
    return tool.input?.trim() || tool.name;
  };

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-col gap-3 border-l border-border/60 pl-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground">
              Task
            </span>
            <span className="rounded-md bg-background/80 px-2 py-0.5 text-xs text-foreground/80">
              {taskTitle}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowToolOutputs((prev) => !prev)}
            className="h-7 px-2 text-xs"
          >
            {showToolOutputs ? "Hide tool outputs" : "Show tool outputs"}
          </Button>
        </div>

        <div className="space-y-3">
          {visibleTools.map((tool) => (
            <div key={tool.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70" aria-hidden="true" />
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground">
                  {tool.name}
                </span>
                <span className="rounded-md bg-background/80 px-2 py-0.5 font-mono text-xs text-foreground/80">
                  {getToolLine(tool)}
                </span>
              </div>
              {showToolOutputs && tool.output && (
                <pre className="rounded-lg bg-background/80 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {stripWrappersRecursively(tool.output)}
                </pre>
              )}
              {tool.status === "error" && !tool.output && (
                <div className="text-xs text-destructive">Tool failed to return output.</div>
              )}
            </div>
          ))}

          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllTools(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-3 w-3" />
              Show {remainingCount} more
            </button>
          )}

          {showAllTools && toolCalls.length > collapsedCount && (
            <button
              type="button"
              onClick={() => setShowAllTools(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="h-3 w-3" />
              Show less
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionChatMessage;
