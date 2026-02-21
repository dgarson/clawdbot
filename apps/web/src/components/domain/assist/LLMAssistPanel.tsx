"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  FileText,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ScrollArea and Separator available for future use

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMAssistPanelProps {
  /** Agent ID for context */
  agentId: string;
  /** Current context — what tab/section the user is viewing */
  context: AssistContext;
  /** Callback when the assistant suggests changes to a file */
  onApplyChanges?: (fileName: string, newContent: string) => void;
  /** Callback when the assistant suggests config changes */
  onApplyConfig?: (patch: Record<string, unknown>) => void;
  /** Whether the panel is open */
  open: boolean;
  /** Close callback */
  onClose: () => void;
}

export interface AssistContext {
  /** Which config section is currently active */
  section: string;
  /** Current file being edited, if any */
  currentFile?: { name: string; content: string };
  /** Current config state */
  configSnapshot?: Record<string, unknown>;
  /** Agent name for personalization */
  agentName?: string;
}

interface AssistMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** Suggested changes the assistant wants to apply */
  suggestions?: AssistSuggestion[];
}

interface AssistSuggestion {
  id: string;
  type: "file_change" | "config_change";
  label: string;
  fileName?: string;
  newContent?: string;
  configPatch?: Record<string, unknown>;
  applied?: boolean;
}

// ---------------------------------------------------------------------------
// Contextual prompts based on section
// ---------------------------------------------------------------------------

const SECTION_PROMPTS: Record<string, string[]> = {
  soul: [
    "Make this agent more formal",
    "Add humor to the personality",
    "Generate a SOUL.md for a research assistant",
    "Make responses more concise",
  ],
  instructions: [
    "Add safety guidelines",
    "Include code review capabilities",
    "Set up session management rules",
    "Add error handling behavior",
  ],
  model: [
    "Which model is best for coding?",
    "Should I use a higher temperature?",
    "Set up fallback models",
    "Optimize for speed vs quality",
  ],
  tools: [
    "Which tools are safe for beginners?",
    "Enable web research capabilities",
    "Set up secure exec permissions",
    "What's the minimal tool set?",
  ],
  overview: [
    "Help me improve this agent",
    "What files am I missing?",
    "Review my configuration",
    "Suggest a better model",
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LLMAssistPanel({
  agentId: _agentId,
  context,
  onApplyChanges,
  onApplyConfig,
  open,
  onClose,
}: LLMAssistPanelProps) {
  const [messages, setMessages] = React.useState<AssistMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [isThinking, setIsThinking] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const quickPrompts = SECTION_PROMPTS[context.section] ?? SECTION_PROMPTS.overview!;

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSend = async (text?: string) => {
    const message = text ?? inputValue.trim();
    if (!message) {return;}

    setInputValue("");

    // Add user message
    const userMsg: AssistMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    // Simulate LLM response (will be replaced with actual LLM call)
    try {
      const response = await simulateAssistResponse(message, context);
      setMessages((prev) => [...prev, response]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: "I'm having trouble processing that request. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleApplySuggestion = (msgId: string, suggestionId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.suggestions) {return msg;}
        return {
          ...msg,
          suggestions: msg.suggestions.map((s) => {
            if (s.id !== suggestionId) {return s;}
            // Apply the change
            if (s.type === "file_change" && s.fileName && s.newContent && onApplyChanges) {
              onApplyChanges(s.fileName, s.newContent);
            }
            if (s.type === "config_change" && s.configPatch && onApplyConfig) {
              onApplyConfig(s.configPatch);
            }
            return { ...s, applied: true };
          }),
        };
      }),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex-shrink-0 border-l border-border bg-card overflow-hidden"
        >
          <div className="flex flex-col h-full w-[380px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">AI Assistant</h3>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {context.section} configuration
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-4 space-y-4">
                  {/* Welcome state */}
                  <div className="text-center pt-4 pb-2">
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-primary/10 mb-3">
                      <Sparkles className="size-6 text-primary" />
                    </div>
                    <h4 className="text-sm font-medium">How can I help?</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ask me anything about configuring{" "}
                      {context.agentName ? (
                        <strong>{context.agentName}</strong>
                      ) : (
                        "this agent"
                      )}
                    </p>
                  </div>

                  {/* Quick prompts */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium px-1">Suggestions</p>
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => void handleSend(prompt)}
                        className="w-full text-left rounded-lg border border-border bg-muted/30 p-3 text-sm hover:bg-muted/60 hover:border-primary/30 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onApplySuggestion={(sId) => handleApplySuggestion(msg.id, sId)}
                    />
                  ))}

                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 className="size-4 animate-spin" />
                      <span>Thinking…</span>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask the AI assistant..."
                  disabled={isThinking}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                />
                <Button
                  size="sm"
                  onClick={() => void handleSend()}
                  disabled={!inputValue.trim() || isThinking}
                  className="px-3"
                >
                  {isThinking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  onApplySuggestion,
}: {
  message: AssistMessage;
  onApplySuggestion: (suggestionId: string) => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="max-w-[95%] rounded-xl rounded-bl-md bg-muted/50 border border-border px-3 py-2 text-sm text-foreground">
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Copy button */}
        <div className="flex justify-end mt-1">
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="space-y-2 pl-2">
          {message.suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors ${
                suggestion.applied
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-primary/20 bg-primary/5 hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{suggestion.label}</span>
              </div>
              {suggestion.applied ? (
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                  <Check className="size-2.5 mr-0.5" />
                  Applied
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onApplySuggestion(suggestion.id)}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  Apply
                  <ArrowRight className="size-2.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Simulated LLM Response (placeholder until real LLM integration)
// ---------------------------------------------------------------------------

async function simulateAssistResponse(
  userMessage: string,
  context: AssistContext,
): Promise<AssistMessage> {
  // Simulate thinking time
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));

  const msg = userMessage.toLowerCase();

  // Simple keyword-based responses for the prototype
  if (msg.includes("formal") || msg.includes("professional")) {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content:
        "I'd suggest updating the communication style in the SOUL.md to emphasize professional language, structured responses, and measured tone. Here's what I'd change:",
      timestamp: Date.now(),
      suggestions: [
        {
          id: `sug-${Date.now()}`,
          type: "file_change",
          label: "Update SOUL.md communication style",
          fileName: "SOUL.md",
          newContent: context.currentFile?.content
            ? context.currentFile.content.replace(
                /## Communication Style[\s\S]*?(?=##|$)/,
                "## Communication Style\n\n- Professional and measured in tone\n- Clear, structured responses with logical flow\n- Avoids casual language and slang\n- Uses precise terminology\n- Provides evidence-based recommendations\n\n",
              )
            : "",
        },
      ],
    };
  }

  if (msg.includes("creative") || msg.includes("humor")) {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content:
        "I can make the agent's personality more creative and add some humor! I'd update the voice section to be warmer and more expressive. Also consider increasing the temperature to 0.8 for more varied responses.",
      timestamp: Date.now(),
      suggestions: [
        {
          id: `sug-${Date.now()}-1`,
          type: "file_change",
          label: "Add creative personality traits",
          fileName: "SOUL.md",
        },
        {
          id: `sug-${Date.now()}-2`,
          type: "config_change",
          label: "Increase creativity (temperature → 0.8)",
          configPatch: { temperature: 0.8 },
        },
      ],
    };
  }

  if (msg.includes("missing") || msg.includes("improve") || msg.includes("review")) {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: `Here's what I'd recommend for ${context.agentName ?? "this agent"}:\n\n• **SOUL.md** — ${context.currentFile?.name === "SOUL.md" ? "Looks good! Consider adding a 'What Frustrates You' section to set boundaries." : "Make sure it defines personality, communication style, and values."}\n\n• **AGENTS.md** — Define session behavior, capabilities, and working style.\n\n• **TOOLS.md** — Add environment-specific notes if the agent needs special tool configuration.\n\n• Consider setting a specific model instead of using the system default for more consistent behavior.`,
      timestamp: Date.now(),
    };
  }

  if (msg.includes("model") || msg.includes("best")) {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content:
        "For most tasks, **Claude Sonnet 4** or **Claude 3.5 Sonnet** provides the best balance of quality and speed. For complex reasoning or creative tasks, **Claude Opus 4** is the gold standard but costs more. For simple/fast tasks, **Claude Haiku** is great.\n\nI'd recommend setting Sonnet as primary with Haiku as a fallback.",
      timestamp: Date.now(),
    };
  }

  if (msg.includes("safe") || msg.includes("beginner") || msg.includes("minimal")) {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content:
        'For a safe starter configuration, I\'d recommend the **Minimal** tool profile:\n\n• ✅ read, write, edit — file access\n• ✅ web_search, web_fetch — research\n• ❌ exec — no system commands\n• ❌ browser — no browser automation\n\nThis gives the agent useful capabilities without any high-risk tools. You can always add more later.',
      timestamp: Date.now(),
      suggestions: [
        {
          id: `sug-${Date.now()}`,
          type: "config_change",
          label: 'Apply "Minimal" tool profile',
          configPatch: { toolProfile: "minimal" },
        },
      ],
    };
  }

  // Default response
  return {
    id: `msg-${Date.now()}`,
    role: "assistant",
    content: `I can help with that! For ${context.section} configuration, I'd suggest reviewing the current settings and making sure they align with what you want this agent to do.\n\nCould you tell me more about what specific changes you'd like to make?`,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { type AssistMessage, type AssistSuggestion };
