import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// Types
type ConversationStatus = "active" | "completed" | "error" | "paused";
type MessageRole = "user" | "assistant" | "system" | "tool";

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  output?: string;
  durationMs?: number;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  tokenCount?: number;
  toolCalls?: ToolCall[];
  model?: string;
}

interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  title: string;
  status: ConversationStatus;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  totalTokens: number;
  messages: Message[];
  tags: string[];
  model?: string;
}

// Mock Data
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    agentId: "piper",
    agentName: "Piper",
    agentEmoji: "✨",
    title: "Design System Interaction Patterns",
    status: "active",
    startedAt: "2026-02-22T09:00:00Z",
    messageCount: 12,
    totalTokens: 3450,
    tags: ["design-system", "interaction", "ui"],
    model: "claude-sonnet-4-6",
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "What's the standard for 'active' states on button components? I want to ensure consistency across the design system.",
        timestamp: "2026-02-22T09:00:15Z",
        tokenCount: 45,
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Great question! For buttons, we use a combination of visual feedback:\n\n1. **Scale**: `scale-95` on `active:` state\n2. **Color shift**: Darken by 10% on press\n3. **Shadow**: Inset shadow for 'pressed' feel\n4. **Duration**: 100ms transition for snappy feel\n\nThe key is ensuring the active state feels intentional—not just a color change, but physical confirmation that the tap registered.",
        timestamp: "2026-02-22T09:01:30Z",
        tokenCount: 180,
        model: "claude-sonnet-4-6",
      },
      {
        id: "msg-3",
        role: "user",
        content: "Does that apply to icon buttons too, or should they behave differently?",
        timestamp: "2026-02-22T09:02:00Z",
        tokenCount: 35,
      },
      {
        id: "msg-4",
        role: "assistant",
        content: "Icon buttons follow the same principles but with slight tweaks:\n\n- **Scale**: Same `scale-95` on active\n- **Background**: Subtle `bg-zinc-800` on hover/active (vs transparent for text buttons)\n- **Focus ring**: Still essential—use `focus-visible:ring-2 focus-visible:ring-indigo-500`\n\nThe main difference is visual weight. Icon buttons need a slightly larger hit area to meet accessibility standards (44x44px minimum).",
        timestamp: "2026-02-22T09:03:15Z",
        tokenCount: 210,
        model: "claude-sonnet-4-6",
      },
      {
        id: "msg-5",
        role: "tool",
        content: "Generated design tokens for button states in tailwind.config.js",
        timestamp: "2026-02-22T09:03:20Z",
        tokenCount: 25,
        toolCalls: [
          {
            id: "tool-1",
            name: "write",
            arguments: "tailwind.config.js",
            output: "Successfully updated buttonActiveScale, buttonTransitionDuration tokens",
            durationMs: 150,
          },
        ],
      },
      {
        id: "msg-6",
        role: "user",
        content: "Can you also add hover state guidance for navigation items? Specifically for the sidebar.",
        timestamp: "2026-02-22T09:05:00Z",
        tokenCount: 40,
      },
      {
        id: "msg-7",
        role: "assistant",
        content: "For sidebar navigation items:\n\n```tsx\n// Hover\nbg-zinc-800/50 text-zinc-200\n\n// Active (current page)\nbg-zinc-800 text-white border-l-2 border-indigo-500\n\n// Focus (keyboard nav)\nfocus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset\n```\n\nThe left border indicator is crucial—it provides persistent position awareness that doesn't disappear when you move the mouse.",
        timestamp: "2026-02-22T09:06:30Z",
        tokenCount: 165,
        model: "claude-sonnet-4-6",
      },
    ],
  },
  {
    id: "conv-2",
    agentId: "quinn",
    agentName: "Quinn",
    agentEmoji: "🧩",
    title: "State Management Architecture Review",
    status: "completed",
    startedAt: "2026-02-21T14:00:00Z",
    endedAt: "2026-02-21T16:30:00Z",
    messageCount: 24,
    totalTokens: 8200,
    tags: ["state", "architecture", "react"],
    model: "claude-opus-4-6",
    messages: [
      {
        id: "msg-8",
        role: "user",
        content: "I need to design the state architecture for the new Horizon UI. We have multiple agents that need to share state—session data, user preferences, and real-time updates. What's the best approach?",
        timestamp: "2026-02-21T14:00:05Z",
        tokenCount: 65,
      },
      {
        id: "msg-9",
        role: "assistant",
        content: "For multi-agent state sharing, I'd recommend a hierarchical store approach:\n\n1. **Root Store**: User session, auth, global preferences\n2. **Agent Stores**: Per-agent state (isolated by agentId)\n3. **UI Store**: View state, modals, navigation\n4. **Real-time Store**: WebSocket connections, live updates\n\nUse Zustand for the core—it's lightweight and works well with React's concurrency model. For real-time, consider combining with a pub/sub layer for cross-agent communication.",
        timestamp: "2026-02-21T14:02:30Z",
        tokenCount: 220,
        model: "claude-opus-4-6",
      },
      {
        id: "msg-10",
        role: "tool",
        content: "Searched best practices for Zustand with multiple agents",
        timestamp: "2026-02-21T14:02:35Z",
        tokenCount: 15,
        toolCalls: [
          {
            id: "tool-2",
            name: "web_search",
            arguments: "zustand multi-tenant state architecture patterns",
            output: "Found 12 relevant articles. Key recommendation: use slices pattern for agent isolation.",
            durationMs: 450,
          },
        ],
      },
      {
        id: "msg-11",
        role: "user",
        content: "What about loading and error states? Those always get messy in complex apps.",
        timestamp: "2026-02-21T14:05:00Z",
        tokenCount: 35,
      },
      {
        id: "msg-12",
        role: "assistant",
        content: "The cleanest pattern is **composable loaders**:\n\n```tsx\n// Each slice handles its own async state\nconst useAgentSlice = create((set) => ({\n  status: 'idle', // idle | loading | success | error\n  error: null,\n  data: null,\n  \n  fetchAgent: async (id) => {\n    set({ status: 'loading', error: null });\n    try {\n      const data = await api.getAgent(id);\n      set({ status: 'success', data });\n    } catch (e) {\n      set({ status: 'error', error: e.message });\n    }\n  },\n}));\n```\n\nThen in components:\n```tsx\nconst { status, error, data } = useAgentSlice();\n\nif (status === 'loading') return <Skeleton />;\nif (status === 'error') return <ErrorAlert>{error}</ErrorAlert>;\nreturn <AgentCard data={data} />;\n```",
        timestamp: "2026-02-21T14:08:00Z",
        tokenCount: 280,
        model: "claude-opus-4-6",
      },
    ],
  },
  {
    id: "conv-3",
    agentId: "reed",
    agentName: "Reed",
    agentEmoji: "♿",
    title: "WCAG 2.2 Focus Appearance Audit",
    status: "completed",
    startedAt: "2026-02-20T11:00:00Z",
    endedAt: "2026-02-20T12:15:00Z",
    messageCount: 18,
    totalTokens: 5600,
    tags: ["accessibility", "wcag", "a11y"],
    model: "claude-sonnet-4-6",
    messages: [
      {
        id: "msg-13",
        role: "user",
        content: "We need to audit all interactive elements for WCAG 2.2 Focus Appearance compliance. Can you help identify issues in the current codebase?",
        timestamp: "2026-02-20T11:00:10Z",
        tokenCount: 55,
      },
      {
        id: "msg-14",
        role: "assistant",
        content: "Absolutely! WCAG 2.2 Success Criterion 2.4.11 (Focus Appearance) requires:\n\n- **3:1 contrast ratio** minimum between focus indicator and background\n- **Area**: At least a 2px border around the component, or a 4px solid underline\n- **No dismissal**: Focus can't be dismissed by pressing Esc or clicking elsewhere\n\nLet me scan the codebase for common violations...",
        timestamp: "2026-02-20T11:02:00Z",
        tokenCount: 180,
        model: "claude-sonnet-4-6",
      },
      {
        id: "msg-15",
        role: "tool",
        content: "Analyzed 47 components for focus indicator compliance",
        timestamp: "2026-02-20T11:02:30Z",
        tokenCount: 20,
        toolCalls: [
          {
            id: "tool-3",
            name: "exec",
            arguments: "grep -r 'outline: none\\|outline: 0' --include='*.tsx' src/",
            output: "Found 12 instances that may need focus ring restoration",
            durationMs: 320,
          },
        ],
      },
      {
        id: "msg-16",
        role: "assistant",
        content: "Found several issues:\n\n**Critical (5 instances):**\n- `Button.tsx`: `outline: none` without replacement\n- `Dropdown.tsx`: Missing focus indicator on trigger\n- `Modal.tsx`: Focus trap but no visible indicator\n\n**Warnings (7 instances):**\n- Low contrast focus rings (zinc-600 on zinc-900)\n- Focus indicator smaller than 2px\n\n**Fix recommendation:**\n```tsx\n// Replace outline: none with:\nfocus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950\n```\n\nThis gives 4.5:1 contrast and meets the 2px minimum.",
        timestamp: "2026-02-20T11:05:00Z",
        tokenCount: 320,
        model: "claude-sonnet-4-6",
      },
    ],
  },
  {
    id: "conv-4",
    agentId: "sam",
    agentName: "Sam",
    agentEmoji: "🎬",
    title: "Animation Choreography for Modal Entry",
    status: "active",
    startedAt: "2026-02-22T08:00:00Z",
    messageCount: 8,
    totalTokens: 2100,
    tags: ["animation", "motion", "framer"],
    model: "claude-sonnet-4-6",
    messages: [
      {
        id: "msg-17",
        role: "user",
        content: "I need to choreograph a modal entry animation. The modal should scale in while the backdrop fades. What's the right timing function?",
        timestamp: "2026-02-22T08:00:15Z",
        tokenCount: 45,
      },
      {
        id: "msg-18",
        role: "assistant",
        content: "For modal entry, I recommend:\n\n**Backdrop:**\n- `opacity: 0 → 1`\n- `duration: 200ms`\n- `ease: ease-out`\n\n**Modal:**\n- `scale: 0.95 → 1`\n- `opacity: 0 → 1`\n- `duration: 250ms`\n- `ease: [0.16, 1, 0.3, 1]` (custom cubic-bezier for spring-like feel)\n- `delay: 50ms` (starts slightly after backdrop)\n\nThis creates the illusion that the modal emerges *from* the backdrop.",
        timestamp: "2026-02-22T08:02:00Z",
        tokenCount: 195,
        model: "claude-sonnet-4-6",
      },
      {
        id: "msg-19",
        role: "user",
        content: "What about reduced motion? I know we need to handle that.",
        timestamp: "2026-02-22T08:03:30Z",
        tokenCount: 30,
      },
      {
        id: "msg-20",
        role: "assistant",
        content: "Great catch! Always respect `prefers-reduced-motion`:\n\n```tsx\nconst reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n\nexport const modalVariants = {\n  hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 },\n  visible: reducedMotion \n    ? { opacity: 1, transition: { duration: 0 } }\n    : { \n        opacity: 1, \n        scale: 1,\n        transition: { \n          duration: 0.25, \n          ease: [0.16, 1, 0.3, 1] \n        } \n      },\n};\n```\n\nThis completely disables animation for users who prefer reduced motion—no fancy transitions, just instant state changes.",
        timestamp: "2026-02-22T08:05:00Z",
        tokenCount: 240,
        model: "claude-sonnet-4-6",
      },
    ],
  },
  {
    id: "conv-5",
    agentId: "xavier",
    agentName: "Xavier",
    agentEmoji: "🧠",
    title: "Multi-Agent Coordination Protocol",
    status: "error",
    startedAt: "2026-02-19T16:00:00Z",
    messageCount: 6,
    totalTokens: 1800,
    tags: ["multi-agent", "coordination", "protocol"],
    model: "claude-opus-4-6",
    messages: [
      {
        id: "msg-21",
        role: "user",
        content: "Design a protocol for spawning subagents and coordinating work across multiple agents. We need clear ownership boundaries.",
        timestamp: "2026-02-19T16:00:05Z",
        tokenCount: 50,
      },
      {
        id: "msg-22",
        role: "assistant",
        content: "Here's a hierarchical coordination model:\n\n**Primary Agent** owns the session, makes top-level decisions\n**Subagents** own specific tasks, report back to primary\n**Communication** flows through structured message passing\n\n```typescript\ninterface SubagentTask {\n  id: string;\n  description: string;\n  ownership: string[]; // file paths this agent can modify\n  deadline?: Date;\n  dependencies?: string[]; // other task IDs\n}\n```",
        timestamp: "2026-02-19T16:03:00Z",
        tokenCount: 210,
        model: "claude-opus-4-6",
      },
      {
        id: "msg-23",
        role: "system",
        content: "Error: Subagent communication channel disconnected. Session terminated due to timeout.",
        timestamp: "2026-02-19T16:15:00Z",
        tokenCount: 25,
      },
    ],
  },
  {
    id: "conv-6",
    agentId: "wes",
    agentName: "Wes",
    agentEmoji: "🎨",
    title: "Design Tokens Migration Guide",
    status: "completed",
    startedAt: "2026-02-18T10:00:00Z",
    endedAt: "2026-02-18T11:30:00Z",
    messageCount: 15,
    totalTokens: 4200,
    tags: ["design-tokens", "tokens", "migration"],
    model: "claude-sonnet-4-6",
    messages: [
      {
        id: "msg-24",
        role: "user",
        content: "We're migrating from hardcoded colors to design tokens. Can you create a migration guide for the team?",
        timestamp: "2026-02-18T10:00:10Z",
        tokenCount: 45,
      },
      {
        id: "msg-25",
        role: "assistant",
        content: "Here's the migration workflow:\n\n1. **Audit**: Find all hardcoded values (grep for hex codes)\n2. **Categorize**: Group by usage (backgrounds, borders, text, etc.)\n3. **Map**: Create token equivalents\n4. **Replace**: Update components systematically\n5. **Verify**: Check for any missed instances\n\nI'll create a script to automate the audit phase.",
        timestamp: "2026-02-18T10:02:00Z",
        tokenCount: 175,
        model: "claude-sonnet-4-6",
      },
    ],
  },
];

// Filter types
type StatusFilter = "all" | ConversationStatus;
type AgentFilter = "all" | string;

// Component
export default function AgentConversationViewer() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showToolDetails, setShowToolDetails] = useState<Set<string>>(new Set());

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return MOCK_CONVERSATIONS.filter((conv) => {
      const matchesSearch =
        searchQuery === "" ||
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.messages.some(
          (msg) =>
            msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            msg.toolCalls?.some((tc) =>
              tc.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );

      const matchesStatus = statusFilter === "all" || conv.status === statusFilter;
      const matchesAgent = agentFilter === "all" || conv.agentId === agentFilter;

      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [searchQuery, statusFilter, agentFilter]);

  const selectedConversation = useMemo(
    () => MOCK_CONVERSATIONS.find((c) => c.id === selectedId),
    [selectedId]
  );

  // Get unique agents for filter
  const agents = useMemo(() => {
    const agentMap = new Map<string, { id: string; name: string; emoji: string }>();
    MOCK_CONVERSATIONS.forEach((c) => {
      if (!agentMap.has(c.agentId)) {
        agentMap.set(c.agentId, {
          id: c.agentId,
          name: c.agentName,
          emoji: c.agentEmoji,
        });
      }
    });
    return Array.from(agentMap.values());
  }, []);

  // Toggle message expansion
  const toggleMessageExpand = useCallback((msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  // Toggle tool details
  const toggleToolDetails = useCallback((toolId: string) => {
    setShowToolDetails((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-[320px] border-r border-zinc-800 flex flex-col bg-zinc-950 z-10"
        role="complementary"
        aria-label="Conversation list"
      >
        <div className="p-4 border-b border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <span className="text-indigo-400">💬</span>
              Conversations
            </h1>
            <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">
              {filteredConversations.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search prompts & responses..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-9 py-2 text-sm text-zinc-300 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "active", "completed", "error", "paused"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      statusFilter === status
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    )}
                  >
                    {status}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Agent Filter */}
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Agent
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAgentFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  agentFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
              >
                All
              </button>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setAgentFilter(agent.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex items-center gap-1.5",
                    agentFilter === agent.id
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  <span>{agent.emoji}</span>
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <nav
          className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1"
          role="list"
          aria-label="Conversations"
        >
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all group relative focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  selectedId === conv.id
                    ? "bg-zinc-900 border-zinc-700 shadow-lg shadow-zinc-950/50"
                    : "bg-transparent border-transparent hover:bg-zinc-900/50 hover:border-zinc-800"
                )}
                role="listitem"
                aria-selected={selectedId === conv.id}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-base"
                      role="img"
                      aria-hidden="true"
                    >
                      {conv.agentEmoji}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400 truncate">
                      {conv.agentName}
                    </span>
                  </div>
                  <ConversationStatus status={conv.status} />
                </div>
                <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 group-hover:text-indigo-400 transition-colors">
                  {conv.title}
                </h3>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                      </svg>
                      {conv.messageCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                      {conv.totalTokens.toLocaleString()}
                    </span>
                  </div>
                  <span>
                    {new Date(conv.startedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {/* Tags */}
                {conv.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {conv.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {selectedId === conv.id && (
                  <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                )}
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-2xl mb-3">
                🔍
              </div>
              <p className="text-sm text-zinc-500">No conversations found</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setAgentFilter("all");
                }}
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col min-w-0 bg-zinc-950"
        role="main"
        aria-label="Conversation details"
      >
        {selectedConversation ? (
          <>
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shadow-inner">
                  {selectedConversation.agentEmoji}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">
                    {selectedConversation.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-semibold text-zinc-400 uppercase tracking-wide">
                      {selectedConversation.agentName}
                    </span>
                    <span>•</span>
                    <span>{formatDate(selectedConversation.startedAt)}</span>
                    {selectedConversation.model && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-zinc-600">
                          {selectedConversation.model}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    Total Tokens
                  </span>
                  <span className="text-xs font-mono text-zinc-300">
                    {selectedConversation.totalTokens.toLocaleString()}
                  </span>
                </div>
                <ConversationStatus
                  status={selectedConversation.status}
                  showLabel
                />
              </div>
            </header>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth"
              role="log"
              aria-label="Messages"
            >
              {selectedConversation.messages.map((msg, idx) => {
                const isExpanded = expandedMessages.has(msg.id);
                const shouldTruncate = msg.content.length > 400;
                const displayContent =
                  isExpanded || !shouldTruncate
                    ? msg.content
                    : msg.content.slice(0, 400) + "...";

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                      msg.role === "user"
                        ? "ml-auto items-end"
                        : msg.role === "system"
                        ? "mx-auto items-center w-full max-w-lg"
                        : "mr-auto items-start"
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                    role="article"
                    aria-label={`${msg.role} message`}
                  >
                    {/* Message Meta */}
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          msg.role === "user"
                            ? "text-indigo-400"
                            : msg.role === "assistant"
                            ? "text-emerald-400"
                            : msg.role === "tool"
                            ? "text-amber-400"
                            : "text-zinc-500"
                        )}
                      >
                        {msg.role === "tool" && msg.toolCalls?.[0]
                          ? msg.toolCalls[0].name
                          : msg.role}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.tokenCount && (
                        <span className="text-[10px] text-zinc-600 font-mono">
                          [{msg.tokenCount} tokens]
                        </span>
                      )}
                      {msg.model && (
                        <span className="text-[9px] text-zinc-700 font-mono bg-zinc-900 px-1 rounded">
                          {msg.model}
                        </span>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm transition-all",
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-md"
                          : msg.role === "assistant"
                          ? "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-md"
                          : msg.role === "tool"
                          ? "bg-amber-900/10 text-amber-200/90 border border-amber-800/20 rounded-tl-md"
                          : "bg-transparent text-zinc-500 italic text-xs text-center border-y border-zinc-900/50 py-3 w-full"
                      )}
                    >
                      <div>{displayContent}</div>
                      {shouldTruncate && (
                        <button
                          onClick={() => toggleMessageExpand(msg.id)}
                          className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>

                    {/* Tool Calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 space-y-2 w-full max-w-md">
                        {msg.toolCalls.map((tool) => {
                          const toolExpanded = showToolDetails.has(tool.id);
                          return (
                            <div
                              key={tool.id}
                              className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => toggleToolDetails(tool.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-amber-400 hover:bg-zinc-800/50 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                                aria-expanded={toolExpanded}
                              >
                                <span className="flex items-center gap-2">
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                  {tool.name}
                                </span>
                                <span className="flex items-center gap-2">
                                  {tool.durationMs && (
                                    <span className="text-zinc-600">
                                      {tool.durationMs}ms
                                    </span>
                                  )}
                                  <svg
                                    className={cn(
                                      "w-3 h-3 transition-transform",
                                      toolExpanded && "rotate-180"
                                    )}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </span>
                              </button>
                              {toolExpanded && (
                                <div className="px-3 py-2 border-t border-zinc-800 space-y-2">
                                  <div>
                                    <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">
                                      Arguments
                                    </span>
                                    <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-950 p-2 rounded mt-1 overflow-x-auto">
                                      {tool.arguments}
                                    </pre>
                                  </div>
                                  {tool.output && (
                                    <div>
                                      <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">
                                        Output
                                      </span>
                                      <pre className="text-[10px] font-mono text-emerald-400 bg-zinc-950 p-2 rounded mt-1 overflow-x-auto">
                                        {tool.output}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-5xl mb-6 shadow-2xl">
              💭
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Select a conversation
            </h2>
            <p className="text-zinc-500 max-w-md text-sm">
              Browse agent conversations, explore prompt/response pairs, and analyze
              tool usage patterns. Use filters to narrow down by agent or status.
            </p>
          </div>
        )}
      </main>

      {/* Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}} />
    </div>
  );
}

// Status Badge Component
function ConversationStatus({
  status,
  showLabel = false,
}: {
  status: ConversationStatus;
  showLabel?: boolean;
}) {
  const config = {
    active: {
      color: "bg-indigo-400",
      shadow: "shadow-[0_0_8px_rgba(129,140,248,0.5)]",
      label: "Active",
    },
    completed: {
      color: "bg-emerald-400",
      shadow: "",
      label: "Completed",
    },
    error: {
      color: "bg-rose-400",
      shadow: "shadow-[0_0_8px_rgba(251,113,133,0.5)]",
      label: "Error",
    },
    paused: {
      color: "bg-amber-400",
      shadow: "",
      label: "Paused",
    },
  };

  const { color, shadow, label } = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", color, shadow)} />
      {showLabel && (
        <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500">
          {label}
        </span>
      )}
    </div>
  );
}
