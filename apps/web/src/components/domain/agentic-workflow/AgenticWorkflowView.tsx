"use client";
import { cn } from "@/lib/utils";
import { Bot, Command as CommandIcon, Shield, Sparkles, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { ToolApprovalCard, type ToolMeta } from "./ToolApprovalCard";
import { QuestionCard } from "./QuestionCard";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { MessageComposer } from "./MessageComposer";
import type { AgenticChatMessage, ModelOption, Question, SessionOption, ToolCall, WorkflowStatus } from "./types";

export interface AgenticWorkflowViewProps {
  title?: string;
  className?: string;

  models: ModelOption[];
  sessions: SessionOption[];
  selectedModelId: string;
  selectedSessionId: string;
  onSelectModelId: (id: string) => void;
  onSelectSessionId: (id: string) => void;

  status: WorkflowStatus;
  statusLabel?: string;

  autoApprove: boolean;
  onAutoApproveChange: (enabled: boolean) => void;

  onOpenCommandPalette?: () => void;
  onOpenPermissions?: () => void;

  messages: AgenticChatMessage[];
  pendingToolCalls: ToolCall[];
  pendingQuestions: Question[];

  toolMeta?: Record<string, ToolMeta>;

  thinkingText?: string;

  composerDisabled?: boolean;
  onSend: (message: { content: string; attachments: AgenticChatMessage["attachments"] }) => void;
  onApproveTool?: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  onRejectTool?: (toolCallId: string) => void;
  onAnswerQuestion?: (questionId: string, answer: unknown) => void;
}

export function AgenticWorkflowView({
  title = "Agentic Workflow",
  className,
  models,
  sessions,
  selectedModelId,
  selectedSessionId,
  onSelectModelId,
  onSelectSessionId,
  status,
  statusLabel,
  autoApprove,
  onAutoApproveChange,
  onOpenCommandPalette,
  onOpenPermissions,
  messages,
  pendingToolCalls,
  pendingQuestions,
  toolMeta,
  thinkingText,
  composerDisabled,
  onSend,
  onApproveTool,
  onRejectTool,
  onAnswerQuestion,
}: AgenticWorkflowViewProps) {
  return (
    <div className={cn("flex h-screen flex-col bg-background text-foreground", className)}>
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Bot className="size-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">{title}</span>

          <div className="hidden md:flex items-center gap-2">
            <div className="h-5 w-px bg-border" />
            <Select value={selectedModelId} onValueChange={onSelectModelId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSessionId} onValueChange={onSelectSessionId}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WorkflowStatusBadge status={status} label={statusLabel} />

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-2 py-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Auto</span>
            <Switch checked={autoApprove} onCheckedChange={onAutoApproveChange} size="sm" />
          </div>

          <Button variant="ghost" size="icon" onClick={onOpenPermissions} aria-label="Permissions">
            <Shield className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={onOpenCommandPalette}
          >
            <CommandIcon className="size-4" />
            <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
          {messages.length === 0 && pendingToolCalls.length === 0 && pendingQuestions.length === 0 ? (
            <div className="flex h-[55vh] flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                <Sparkles className="size-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-semibold">Start a workflow</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Send a message to begin. The agent can ask questions and request tool approvals.
              </p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}
                >
                  <Avatar className="size-9">
                    <AvatarFallback className={cn(m.role === "assistant" ? "bg-gradient-to-br from-primary to-accent text-primary-foreground" : "bg-secondary")}>
                      {m.role === "assistant" ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <Card
                    className={cn(
                      "selectable-text max-w-[85%] p-4",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card"
                    )}
                  >
                    {m.attachments && m.attachments.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {m.attachments.map((att) =>
                          att.kind === "image" && att.previewUrl ? (
                            <img
                              key={att.id}
                              src={att.previewUrl}
                              alt={att.name}
                              className="h-20 rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <div
                              key={att.id}
                              className={cn(
                                "rounded-lg border px-3 py-2 text-xs",
                                m.role === "user"
                                  ? "border-primary-foreground/30 bg-primary-foreground/10"
                                  : "border-border bg-muted/30"
                              )}
                            >
                              {att.name}
                            </div>
                          )
                        )}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                    {m.timestamp ? (
                      <div
                        className={cn(
                          "mt-2 text-[10px]",
                          m.role === "user"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {m.timestamp}
                      </div>
                    ) : null}
                  </Card>
                </div>
              ))}

              {pendingToolCalls.map((tc) => (
                <ToolApprovalCard
                  key={tc.toolCallId}
                  toolCall={tc}
                  meta={toolMeta?.[tc.toolName]}
                  onApprove={onApproveTool}
                  onReject={onRejectTool}
                />
              ))}

              {pendingQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onSubmit={(id, answer) => onAnswerQuestion?.(id, answer)}
                />
              ))}

              {status === "thinking" ? <ThinkingIndicator thought={thinkingText} /> : null}
            </>
          )}
        </div>
      </ScrollArea>

      <MessageComposer
        disabled={composerDisabled}
        placeholder="Message…"
        onSend={({ content, attachments }) => onSend({ content, attachments })}
      />
    </div>
  );
}
