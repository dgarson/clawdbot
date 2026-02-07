"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Paperclip, Mic, Send, Square } from "lucide-react";

export interface SessionChatInputProps {
  /** Callback when message is submitted */
  onSend: (message: string) => void;
  /** Whether the agent is currently streaming a response */
  isStreaming?: boolean;
  /** Callback to abort the current stream */
  onStop?: () => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

export function SessionChatInput({
  onSend,
  isStreaming = false,
  onStop,
  disabled = false,
  placeholder = "Type a message...",
  className,
}: SessionChatInputProps) {
  const [message, setMessage] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isStreaming) {return;}
    onSend(message);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // Focus on mount
  React.useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className={cn("bg-background px-4 pb-4 pt-2", className)}>
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl" autoComplete="off">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/30 p-2 shadow-sm transition-colors focus-within:border-primary/30 focus-within:bg-muted/50">
          {/* Attachment button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Attach file"
            disabled={disabled || isStreaming}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Voice input button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Voice input"
            disabled={disabled || isStreaming}
          >
            <Mic className="h-5 w-5" />
          </Button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            id="session-chat-input"
            name="message"
            rows={1}
            autoComplete="off"
            inputMode="text"
            aria-label={placeholder}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={cn(
              "flex-1 resize-none bg-transparent py-2 text-sm text-foreground caret-foreground",
              "placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
              "scrollbar-thin"
            )}
          />

          {/* Send/Stop button */}
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={onStop}
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || disabled}
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default SessionChatInput;
