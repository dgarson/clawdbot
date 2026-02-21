/**
 * Chat-Driven Agent Builder (/agents/new)
 *
 * A conversational interface for creating new agents. The user describes
 * what they want in natural language; the system parses the description,
 * updates a live config preview, and guides them through to creation.
 *
 * UX principles:
 * - Start with a blank canvas: just a chat input
 * - Each message updates the live config preview on the right
 * - The system asks clarifying questions progressively
 * - "Ready to create!" once name + description are filled
 * - Fallback to manual mode (links to edit page after creation)
 */

import * as React from "react";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Send,
  Sparkles,
  Tag,
  Cpu,
  FileText,
  User,
  Check,
  RotateCcw,
  ChevronRight,
  Lightbulb,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCreateAgent } from "@/hooks/mutations/useAgentMutations";

// ── Route ──────────────────────────────────────────────────────────

export const Route = createLazyFileRoute("/agents/new")({
  component: ChatAgentBuilderPage,
});

// ── Types ──────────────────────────────────────────────────────────

type AgentDraft = {
  name: string;
  role: string;
  description: string;
  model: string;
  tags: string[];
  personality: string;
};

type MessageRole = "system" | "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  updatedFields?: (keyof AgentDraft)[];
};

type SuggestedPrompt = {
  label: string;
  text: string;
};

// ── Constants ─────────────────────────────────────────────────────

const DEFAULT_DRAFT: AgentDraft = {
  name: "",
  role: "",
  description: "",
  model: "anthropic/claude-sonnet-4-20250514",
  tags: [],
  personality: "",
};

const MODEL_OPTIONS = [
  { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet (recommended)" },
  { id: "anthropic/claude-opus-4-20250514", label: "Claude Opus (powerful)" },
  { id: "anthropic/claude-haiku-3-5-20241022", label: "Claude Haiku (fast)" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (fast)" },
  { id: "google/gemini-3-flash-preview", label: "Gemini Flash (fast)" },
  { id: "xai/grok-3", label: "Grok 3" },
];

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { label: "GitHub monitor", text: "Create an agent that monitors GitHub repos for new issues and PRs, then posts daily summaries to Slack." },
  { label: "Research assistant", text: "I need a research agent that can analyze topics, synthesize information from multiple sources, and produce clear summaries." },
  { label: "Code reviewer", text: "Build a code review agent that checks PRs for bugs, style issues, and security vulnerabilities." },
  { label: "Content writer", text: "I want an agent that helps write blog posts, documentation, and marketing copy in a friendly, clear tone." },
  { label: "Task coordinator", text: "Create an agent that coordinates tasks across the team, tracks progress, and sends reminders when things are overdue." },
];

// ── NLP parser ─────────────────────────────────────────────────────

type ParsedIntent = {
  fields: Partial<AgentDraft>;
  confidence: number;
  response: string;
};

function extractName(text: string): string | null {
  // "called 'Sentinel'" or "named Sentinel" or "Create a GitHub Monitor agent"
  const patterns = [
    /(?:called|named)\s+["']?([A-Za-z][A-Za-z0-9 ]+?)["']?(?:\s|$|,|\.|that)/i,
    /^(?:create|build|make)\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9 ]+?)\s+agent/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function inferRole(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(monitor|watch|track|observe|alert|notify|detect)\b/.test(lower)) return "Monitor";
  if (/\b(research|analyze|study|investigate|explore|summarize)\b/.test(lower)) return "Researcher";
  if (/\b(code|develop|debug|engineer|build|implement|refactor)\b/.test(lower)) return "Developer";
  if (/\b(write|draft|edit|content|copy|document|blog|article)\b/.test(lower)) return "Writer";
  if (/\b(coordinate|manage|organize|plan|schedule|track tasks)\b/.test(lower)) return "Coordinator";
  if (/\b(review|audit|check|inspect|validate|test)\b/.test(lower)) return "Reviewer";
  if (/\b(support|help|assist|answer|respond|customer)\b/.test(lower)) return "Support";
  if (/\b(teach|tutor|coach|guide|explain|train)\b/.test(lower)) return "Educator";
  return "";
}

function inferTags(text: string): string[] {
  const lower = text.toLowerCase();
  const DOMAIN_KEYWORDS: [RegExp, string][] = [
    [/github|git|repo|pull request|pr\b/, "github"],
    [/slack/, "slack"],
    [/discord/, "discord"],
    [/email|gmail|inbox/, "email"],
    [/calendar|schedule|meeting/, "calendar"],
    [/twitter|x\.com|tweet/, "twitter"],
    [/linear|jira|notion|asana/, "project-management"],
    [/code|programming|development/, "code"],
    [/research|analysis/, "research"],
    [/writing|content|copy/, "writing"],
    [/security|audit|vulnerability/, "security"],
    [/data|analytics|metrics/, "analytics"],
    [/customer|support|helpdesk/, "support"],
    [/finance|cost|budget|billing/, "finance"],
    [/document|doc|knowledge base/, "documentation"],
  ];
  return DOMAIN_KEYWORDS
    .filter(([re]) => re.test(lower))
    .map(([, tag]) => tag);
}

function inferModel(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bopus\b/.test(lower)) return "anthropic/claude-opus-4-20250514";
  if (/\bhaiku\b|\bfast\b|\bquick\b|\bcheap\b/.test(lower)) return "anthropic/claude-haiku-3-5-20241022";
  if (/\bgpt-?4o mini\b/.test(lower)) return "openai/gpt-4o-mini";
  if (/\bgpt-?4\b|\bgpt4\b/.test(lower)) return "openai/gpt-4o";
  if (/\bgemini\b/.test(lower)) return "google/gemini-3-flash-preview";
  if (/\bgrok\b/.test(lower)) return "xai/grok-3";
  return null;
}

function inferPersonality(text: string): string {
  const lower = text.toLowerCase();
  const traits: string[] = [];
  if (/\b(concise|brief|terse|short)\b/.test(lower)) traits.push("concise");
  if (/\b(detailed|thorough|comprehensive|in-depth)\b/.test(lower)) traits.push("thorough");
  if (/\b(friendly|warm|casual|conversational)\b/.test(lower)) traits.push("friendly");
  if (/\b(professional|formal|serious|precise)\b/.test(lower)) traits.push("professional");
  if (/\b(creative|imaginative|inventive)\b/.test(lower)) traits.push("creative");
  if (/\b(proactive|initiative|autonomous)\b/.test(lower)) traits.push("proactive");
  return traits.join(", ");
}

function generateAgentName(role: string, tags: string[]): string {
  if (role && tags.length > 0) {
    const primaryTag = tags[0];
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return `${capitalize(primaryTag)} ${role}`;
  }
  if (role) return `${role} Agent`;
  if (tags.length > 0) {
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return `${capitalize(tags[0])} Agent`;
  }
  return "";
}

function parseUserMessage(text: string, currentDraft: AgentDraft): ParsedIntent {
  const updates: Partial<AgentDraft> = {};
  const updatedFields: (keyof AgentDraft)[] = [];

  // Name extraction
  const extractedName = extractName(text);
  if (extractedName && !currentDraft.name) {
    updates.name = extractedName;
    updatedFields.push("name");
  }

  // Role inference
  const role = inferRole(text);
  if (role && !currentDraft.role) {
    updates.role = role;
    updatedFields.push("role");
  }

  // Tag inference
  const tags = inferTags(text);
  const newTags = tags.filter((t) => !currentDraft.tags.includes(t));
  if (newTags.length > 0) {
    updates.tags = [...currentDraft.tags, ...newTags];
    updatedFields.push("tags");
  }

  // Model preference
  const model = inferModel(text);
  if (model) {
    updates.model = model;
    updatedFields.push("model");
  }

  // Personality
  const personality = inferPersonality(text);
  if (personality && !currentDraft.personality) {
    updates.personality = personality;
    updatedFields.push("personality");
  }

  // Description: take the user's message as the seed if not set
  if (!currentDraft.description && text.length > 20) {
    updates.description = text.trim();
    updatedFields.push("description");
  }

  // Auto-generate name from role + tags if not explicitly set
  const mergedRole = updates.role ?? currentDraft.role;
  const mergedTags = updates.tags ?? currentDraft.tags;
  if (!currentDraft.name && !updates.name && (mergedRole || mergedTags.length > 0)) {
    const autoName = generateAgentName(mergedRole, mergedTags);
    if (autoName) {
      updates.name = autoName;
      updatedFields.push("name");
    }
  }

  // Generate response
  const response = generateResponse(text, updates, currentDraft);

  return {
    fields: updates,
    confidence: updatedFields.length > 0 ? 0.8 : 0.3,
    response,
  };
}

function generateResponse(
  _input: string,
  updates: Partial<AgentDraft>,
  current: AgentDraft
): string {
  const parts: string[] = [];

  if (updates.name) {
    parts.push(`I'll call this agent **${updates.name}**.`);
  }

  if (updates.role) {
    parts.push(`Role set to **${updates.role}**.`);
  }

  if (updates.tags && updates.tags.length > 0) {
    const newTags = updates.tags.filter((t) => !current.tags.includes(t));
    if (newTags.length > 0) {
      parts.push(`Added tags: ${newTags.map((t) => `\`${t}\``).join(", ")}.`);
    }
  }

  if (updates.model) {
    const modelLabel = MODEL_OPTIONS.find((m) => m.id === updates.model)?.label ?? updates.model;
    parts.push(`Using **${modelLabel}**.`);
  }

  if (updates.personality) {
    parts.push(`Personality: ${updates.personality}.`);
  }

  if (parts.length === 0) {
    // Ask a clarifying question
    const questions = [
      "What should this agent do? Describe its main purpose.",
      "What kind of tasks should this agent handle?",
      "What channels or tools should this agent work with?",
      "Should this agent be proactive (act autonomously) or reactive (respond to requests)?",
    ];
    const missing = !current.name ? 0 : !current.description ? 1 : 3;
    return questions[missing] ?? questions[3];
  }

  // Follow-up question based on what's still missing
  const mergedDraft = { ...current, ...updates };
  if (!mergedDraft.description || mergedDraft.description === _input) {
    parts.push("\n\nAnything else? You can refine the description, add tools, or adjust the model.");
  } else if (!mergedDraft.tags?.length) {
    parts.push("\n\nWhich channels or tools should this agent integrate with?");
  }

  return parts.join(" ");
}

// ── Chat message component ─────────────────────────────────────────

function SimpleMarkdown({ text }: { text: string }) {
  // Basic **bold** and `code` rendering
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

type ChatBubbleProps = {
  message: ChatMessage;
};

function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground">{message.content}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm border border-border bg-card text-foreground"
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="space-y-0.5">
            {message.content.split("\n\n").map((para, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                <SimpleMarkdown text={para} />
              </p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Config preview panel ───────────────────────────────────────────

type ConfigPreviewProps = {
  draft: AgentDraft;
  recentlyUpdated: Set<keyof AgentDraft>;
  isReady: boolean;
  onCreate: () => void;
  isCreating: boolean;
  onReset: () => void;
  onUpdateDraft: (field: keyof AgentDraft, value: string | string[]) => void;
};

function ConfigPreviewPanel({
  draft,
  recentlyUpdated,
  isReady,
  onCreate,
  isCreating,
  onReset,
  onUpdateDraft,
}: ConfigPreviewProps) {
  const [editingName, setEditingName] = React.useState(false);
  const [editingDesc, setEditingDesc] = React.useState(false);
  const [tagInput, setTagInput] = React.useState("");

  const FieldHighlight = ({ field, children }: { field: keyof AgentDraft; children: React.ReactNode }) => (
    <motion.div
      animate={
        recentlyUpdated.has(field)
          ? { backgroundColor: ["hsl(var(--primary) / 0.08)", "transparent"] }
          : {}
      }
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="rounded-md"
    >
      {children}
    </motion.div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="font-semibold">Agent Preview</h2>
          <p className="text-xs text-muted-foreground">Live config as you describe it</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <Separator />

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Name */}
        <FieldHighlight field="name">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="h-3 w-3" />
              Name
            </label>
            {editingName ? (
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                value={draft.name}
                onChange={(e) => onUpdateDraft("name", e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className={cn(
                  "w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50",
                  draft.name ? "font-medium" : "text-muted-foreground italic"
                )}
              >
                {draft.name || "Not set — describe your agent"}
              </button>
            )}
          </div>
        </FieldHighlight>

        {/* Role */}
        <FieldHighlight field="role">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Bot className="h-3 w-3" />
              Role
            </label>
            <div
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                draft.role ? "" : "text-muted-foreground italic"
              )}
            >
              {draft.role || "Inferred from description"}
            </div>
          </div>
        </FieldHighlight>

        {/* Description */}
        <FieldHighlight field="description">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="h-3 w-3" />
              Description
            </label>
            {editingDesc ? (
              <Textarea
                autoFocus
                className="min-h-[80px] resize-none text-sm"
                value={draft.description}
                onChange={(e) => onUpdateDraft("description", e.target.value)}
                onBlur={() => setEditingDesc(false)}
              />
            ) : (
              <button
                onClick={() => setEditingDesc(true)}
                className={cn(
                  "w-full rounded-md px-3 py-1.5 text-left text-sm leading-relaxed transition-colors hover:bg-muted/50",
                  draft.description ? "" : "text-muted-foreground italic"
                )}
              >
                {draft.description || "Describe what this agent should do…"}
              </button>
            )}
          </div>
        </FieldHighlight>

        {/* Model */}
        <FieldHighlight field="model">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Cpu className="h-3 w-3" />
              Model
            </label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              value={draft.model}
              onChange={(e) => onUpdateDraft("model", e.target.value)}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </FieldHighlight>

        {/* Tags */}
        <FieldHighlight field="tags">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Tag className="h-3 w-3" />
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {draft.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs"
                >
                  {tag}
                  <button
                    onClick={() =>
                      onUpdateDraft(
                        "tags",
                        draft.tags.filter((t) => t !== tag)
                      )
                    }
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-1">
                <input
                  className="w-20 rounded border border-border bg-transparent px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                  placeholder="+ tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim().toLowerCase().replace(/,/g, "");
                      if (!draft.tags.includes(newTag)) {
                        onUpdateDraft("tags", [...draft.tags, newTag]);
                      }
                      setTagInput("");
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </FieldHighlight>

        {/* Personality */}
        {draft.personality && (
          <FieldHighlight field="personality">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Personality
              </label>
              <div className="text-sm capitalize">{draft.personality}</div>
            </div>
          </FieldHighlight>
        )}
      </div>

      <Separator />

      {/* Readiness + create */}
      <div className="px-5 py-4 space-y-3">
        {/* Readiness indicator */}
        <div className="space-y-2">
          {[
            { label: "Name", done: !!draft.name },
            { label: "Description", done: !!draft.description },
            { label: "Role", done: !!draft.role },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <div
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  done ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              </div>
              <span className={done ? "text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <Button
          className="w-full gap-2"
          disabled={!isReady || isCreating}
          onClick={onCreate}
          size="lg"
        >
          {isCreating ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-4 w-4" />
              </motion.div>
              Creating…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Agent
            </>
          )}
        </Button>

        {!isReady && (
          <p className="text-center text-xs text-muted-foreground">
            Describe your agent to continue
          </p>
        )}
      </div>
    </div>
  );
}

// ── Suggested prompts ──────────────────────────────────────────────

function SuggestedPrompts({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" />
        Try one of these:
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => onSelect(prompt.text)}
            className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted"
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

function ChatAgentBuilderPage() {
  const navigate = useNavigate();
  const createAgent = useCreateAgent();

  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm here to help you create a new agent. Describe what you want the agent to do — the more detail, the better. I'll build the config as you talk.",
      timestamp: Date.now(),
    },
  ]);

  const [draft, setDraft] = React.useState<AgentDraft>(DEFAULT_DRAFT);
  const [recentlyUpdated, setRecentlyUpdated] = React.useState<Set<keyof AgentDraft>>(new Set());
  const [inputText, setInputText] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(true);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const isReady = Boolean(draft.name && draft.description);

  // Auto-scroll chat
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = React.useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
    ]);
  }, []);

  const updateDraftField = React.useCallback(
    (field: keyof AgentDraft, value: string | string[]) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
      setRecentlyUpdated((prev) => new Set([...prev, field]));
      setTimeout(() => {
        setRecentlyUpdated((prev) => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
      }, 1500);
    },
    []
  );

  const handleSend = React.useCallback(async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    setInputText("");
    setShowSuggestions(false);
    setIsProcessing(true);

    // Add user message
    addMessage({ role: "user", content: text });

    // Simulate brief processing delay
    await new Promise((r) => setTimeout(r, 400));

    // Parse the message
    const intent = parseUserMessage(text, draft);

    // Apply updates
    if (Object.keys(intent.fields).length > 0) {
      setDraft((prev) => ({ ...prev, ...intent.fields }));
      const updated = Object.keys(intent.fields) as (keyof AgentDraft)[];
      setRecentlyUpdated(new Set(updated));
      setTimeout(() => setRecentlyUpdated(new Set()), 1500);
    }

    // Add assistant response
    addMessage({ role: "assistant", content: intent.response });

    setIsProcessing(false);
  }, [inputText, isProcessing, draft, addMessage]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestedPrompt = React.useCallback((text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  }, []);

  const handleReset = React.useCallback(() => {
    setDraft(DEFAULT_DRAFT);
    setMessages([
      {
        id: "reset",
        role: "assistant",
        content: "Starting over! Tell me about the agent you want to create.",
        timestamp: Date.now(),
      },
    ]);
    setShowSuggestions(true);
    setRecentlyUpdated(new Set());
  }, []);

  const handleCreate = React.useCallback(async () => {
    if (!isReady) return;

    try {
      const result = await createAgent.mutateAsync({
        name: draft.name,
        role: draft.role,
        description: draft.description,
        model: draft.model,
        tags: draft.tags,
      });

      addMessage({
        role: "assistant",
        content: `**${draft.name}** has been created! Taking you to the agent config page to finish setup.`,
      });

      await new Promise((r) => setTimeout(r, 1200));

      const agentId = (result as { id?: string })?.id ?? draft.name.toLowerCase().replace(/\s+/g, "-");
      void navigate({ to: "/agents/$agentId", params: { agentId } });
    } catch {
      addMessage({
        role: "assistant",
        content:
          "There was an error creating the agent. You can try again or go to the agents list.",
      });
    }
  }, [isReady, draft, createAgent, addMessage, navigate]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Link to="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-semibold">Create Agent</h1>
          <p className="text-xs text-muted-foreground">Describe what you want — I'll build the config</p>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <div className="flex flex-1 flex-col min-w-0 border-r border-border">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    />
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          <AnimatePresence>
            {showSuggestions && messages.length <= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="px-6 pb-4"
              >
                <SuggestedPrompts onSelect={handleSuggestedPrompt} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                placeholder="Describe the agent you want to create…"
                className="min-h-[52px] max-h-[160px] resize-none text-sm"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
              />
              <Button
                size="sm"
                className="h-[52px] w-10 shrink-0 p-0"
                onClick={() => void handleSend()}
                disabled={!inputText.trim() || isProcessing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>

        {/* Config preview panel */}
        <div className="w-[300px] shrink-0 xl:w-[340px]">
          <ConfigPreviewPanel
            draft={draft}
            recentlyUpdated={recentlyUpdated}
            isReady={isReady}
            onCreate={() => void handleCreate()}
            isCreating={createAgent.isPending}
            onReset={handleReset}
            onUpdateDraft={updateDraftField}
          />
        </div>
      </div>
    </div>
  );
}
