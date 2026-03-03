import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  AlertTriangle,
  Activity,
  DollarSign,
  Zap,
  Code,
  FileText,
  BarChart3,
  TrendingUp,
  Shield,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface OperatorAICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (viewId: string) => void;
}

type MessageRole = "user" | "assistant";

interface ActionButton {
  label: string;
  icon?: React.ReactNode;
  variant: "primary" | "secondary" | "warning" | "success";
  viewId?: string;
}

interface MetricCard {
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | "flat";
  status?: "ok" | "warning" | "critical";
}

interface WarningCallout {
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
}

interface MessageContent {
  text: string;
  codeBlocks?: { language: string; code: string }[];
  actions?: ActionButton[];
  metrics?: MetricCard[];
  warnings?: WarningCallout[];
}

interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent;
  timestamp: Date;
}

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_CHIPS = [
  { label: "Active Sessions", value: "12", icon: Activity, color: "text-emerald-400 bg-emerald-400/10" },
  { label: "Errors", value: "3", icon: AlertTriangle, color: "text-amber-400 bg-amber-400/10" },
  { label: "Budget", value: "78%", icon: DollarSign, color: "text-sky-400 bg-sky-400/10" },
];

const SUGGESTED_ACTIONS = [
  { label: "Explain latest error", icon: AlertTriangle },
  { label: "Why did cost spike?", icon: TrendingUp },
  { label: "Suggest model optimization", icon: Zap },
  { label: "Draft incident report", icon: FileText },
  { label: "Analyze agent performance", icon: BarChart3 },
  { label: "Recommend budget adjustment", icon: DollarSign },
];

const ACTION_VARIANT_STYLES: Record<ActionButton["variant"], string> = {
  primary: "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border-indigo-500/20",
  secondary: "bg-gray-500/15 text-gray-300 hover:bg-gray-500/25 border-gray-500/20",
  warning: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/20",
  success: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20",
};

const METRIC_STATUS_STYLES: Record<NonNullable<MetricCard["status"]>, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  critical: "border-rose-500/30 bg-rose-500/5",
};

const METRIC_TREND_ICONS: Record<NonNullable<MetricCard["trend"]>, { icon: string; color: string }> = {
  up: { icon: "\u2191", color: "text-rose-400" },
  down: { icon: "\u2193", color: "text-emerald-400" },
  flat: { icon: "\u2192", color: "text-gray-400" },
};

const WARNING_SEVERITY_STYLES: Record<WarningCallout["severity"], { bg: string; border: string; icon: string }> = {
  info: { bg: "bg-sky-500/10", border: "border-sky-500/30", icon: "text-sky-400" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "text-amber-400" },
  error: { bg: "bg-rose-500/10", border: "border-rose-500/30", icon: "text-rose-400" },
};

// ============================================================================
// Pre-seeded Conversation
// ============================================================================

const SEEDED_MESSAGES: Message[] = [
  {
    id: "seed-1",
    role: "user",
    content: {
      text: "Why is Quinn's session erroring?",
    },
    timestamp: new Date(Date.now() - 300_000),
  },
  {
    id: "seed-2",
    role: "assistant",
    content: {
      text: "Quinn's latest session (sess_q8f2k) is failing due to a **rate limit hit on the OpenAI provider**. The session attempted 14 parallel tool calls within a 60-second window, which exceeded the configured RPM (requests per minute) limit of 10 for the `gpt-4o` endpoint.\n\nThe error trace shows:\n```\nHTTP 429 Too Many Requests\nx-ratelimit-remaining: 0\nx-ratelimit-reset: 1708819200\n```\n\nThis has been occurring intermittently over the last 45 minutes. Two options to resolve immediately:",
      codeBlocks: [
        {
          language: "json",
          code: `{\n  "error": "rate_limit_exceeded",\n  "provider": "openai",\n  "model": "gpt-4o",\n  "retry_after_ms": 12000,\n  "session": "sess_q8f2k"\n}`,
        },
      ],
      actions: [
        { label: "View Rate Limits", icon: <ExternalLink className="w-3.5 h-3.5" />, variant: "primary", viewId: "rate-limits" },
        { label: "Switch to Fallback Model", icon: <Zap className="w-3.5 h-3.5" />, variant: "warning", viewId: "model-config" },
      ],
      warnings: [
        {
          title: "Provider Rate Limit",
          message: "OpenAI gpt-4o endpoint is at 100% rate limit utilization. Retry backoff is active.",
          severity: "error",
        },
      ],
    },
    timestamp: new Date(Date.now() - 280_000),
  },
  {
    id: "seed-3",
    role: "user",
    content: {
      text: "What's our budget status?",
    },
    timestamp: new Date(Date.now() - 180_000),
  },
  {
    id: "seed-4",
    role: "assistant",
    content: {
      text: "Here is your current budget overview for **February 2026**. You are tracking slightly above plan due to increased inference costs from the parallel agent workloads this week.",
      metrics: [
        { label: "Month Spend", value: "$9,340", subtext: "of $12,000 budget", trend: "up", status: "warning" },
        { label: "Daily Burn Rate", value: "$389", subtext: "$50/day above target", trend: "up", status: "warning" },
        { label: "Projected Overage", value: "+$1,140", subtext: "by Feb 28", trend: "up", status: "critical" },
        { label: "Cost Efficiency", value: "87%", subtext: "vs 92% last month", trend: "down", status: "ok" },
      ],
      actions: [
        { label: "Set Alert Threshold", icon: <Shield className="w-3.5 h-3.5" />, variant: "primary", viewId: "budget-alerts" },
        { label: "View Full Breakdown", icon: <BarChart3 className="w-3.5 h-3.5" />, variant: "secondary", viewId: "budget-tracker" },
      ],
      warnings: [
        {
          title: "Budget Warning",
          message: "At the current burn rate, you will exceed the February budget by approximately $1,140.",
          severity: "warning",
        },
      ],
    },
    timestamp: new Date(Date.now() - 160_000),
  },
];

// ============================================================================
// Simulated Response Generator
// ============================================================================

function generateMockResponse(userMessage: string): MessageContent {
  const msg = userMessage.toLowerCase();

  if (msg.includes("error") || msg.includes("fail") || msg.includes("issue") || msg.includes("bug")) {
    return {
      text: "I found **3 active errors** across your agent fleet in the last hour. The most critical is a recurring `TimeoutError` in Reed's document processing pipeline. The error occurs when PDF extraction exceeds the 30-second timeout threshold.\n\nThe root cause appears to be oversized documents (>50 pages) being processed without chunking. I recommend enabling the document splitting middleware.",
      codeBlocks: [
        {
          language: "text",
          code: "TimeoutError: Operation exceeded 30000ms\n  at PDFExtractor.process (extractors/pdf.ts:142)\n  at Pipeline.run (pipeline/core.ts:89)\n  Session: sess_r3d9x | Agent: Reed",
        },
      ],
      actions: [
        { label: "View Error Logs", variant: "primary", viewId: "logs" },
        { label: "Apply Fix", variant: "success", viewId: "agent-config" },
      ],
      warnings: [
        {
          title: "Recurring Error",
          message: "This error has occurred 7 times in the past hour. Auto-retry is currently exhausting the retry budget.",
          severity: "error",
        },
      ],
    };
  }

  if (msg.includes("cost") || msg.includes("budget") || msg.includes("spend") || msg.includes("money") || msg.includes("price")) {
    return {
      text: "I have analyzed your cost trends. Here is a summary of the key cost drivers this week compared to last week:",
      metrics: [
        { label: "Weekly Spend", value: "$2,847", subtext: "+12% vs last week", trend: "up", status: "warning" },
        { label: "Top Model Cost", value: "$1,420", subtext: "claude-opus-4-6", trend: "up", status: "ok" },
        { label: "Avg Cost/Session", value: "$0.84", subtext: "-3% vs last week", trend: "down", status: "ok" },
      ],
      actions: [
        { label: "View Cost Breakdown", variant: "primary", viewId: "cost-optimizer" },
        { label: "Adjust Budgets", variant: "secondary", viewId: "budget-tracker" },
      ],
    };
  }

  if (msg.includes("performance") || msg.includes("latency") || msg.includes("speed") || msg.includes("slow")) {
    return {
      text: "Here is your agent performance snapshot. Overall fleet health is **good**, but there are a few optimization opportunities:\n\n1. **Luis** has the highest throughput but P95 latency increased by 200ms today\n2. **Quinn** is experiencing retries due to rate limits (see earlier discussion)\n3. **Piper** has excellent efficiency with the lowest cost per token",
      metrics: [
        { label: "Fleet Avg Latency", value: "1.8s", subtext: "P50 response time", trend: "flat", status: "ok" },
        { label: "Success Rate", value: "98.7%", subtext: "across all agents", trend: "up", status: "ok" },
        { label: "Throughput", value: "342 req/min", subtext: "peak in last hour", trend: "up", status: "ok" },
      ],
      actions: [
        { label: "Agent Performance Dashboard", variant: "primary", viewId: "agent-insights" },
        { label: "View Latency Traces", variant: "secondary", viewId: "agent-tracer" },
      ],
    };
  }

  if (msg.includes("model") || msg.includes("optimize") || msg.includes("switch") || msg.includes("recommend")) {
    return {
      text: "Based on your usage patterns over the last 7 days, here are my model optimization recommendations:\n\n**1. Downgrade low-complexity tasks**: 38% of Piper's requests are simple classification tasks. Switching from `claude-sonnet-4-6` to `claude-haiku-4-6` could save ~$420/month with <2% quality impact.\n\n**2. Enable prompt caching**: Luis's sessions share significant system prompt overlap. Enabling caching would reduce token costs by ~15%.\n\n**3. Batch non-urgent requests**: Quinn's overnight indexing jobs don't need real-time responses. Batching could reduce costs by 40%.",
      actions: [
        { label: "Apply Recommendations", variant: "success", viewId: "model-config" },
        { label: "Run Cost Simulation", variant: "primary", viewId: "cost-optimizer" },
        { label: "Dismiss", variant: "secondary" },
      ],
    };
  }

  if (msg.includes("incident") || msg.includes("report") || msg.includes("outage") || msg.includes("down")) {
    return {
      text: "I have drafted an incident report based on the current system state:\n\n---\n**Incident Report: Rate Limit Degradation**\n\n**Status**: Investigating\n**Impact**: Moderate \u2014 Quinn's sessions experiencing failures\n**Start Time**: 14:23 UTC\n**Duration**: ~45 minutes (ongoing)\n\n**Summary**: The OpenAI gpt-4o provider endpoint is rate-limiting requests from Quinn's agent due to burst traffic exceeding the configured RPM limit. Automatic fallback to the secondary provider was not triggered because the failover policy is set to `manual`.\n\n**Next Steps**: Switch to fallback model or increase RPM allocation.\n\n---",
      actions: [
        { label: "Copy to Clipboard", variant: "primary" },
        { label: "Open Incident Manager", variant: "secondary", viewId: "incidents" },
        { label: "Escalate to On-Call", variant: "warning" },
      ],
      warnings: [
        {
          title: "Active Incident",
          message: "This incident is still ongoing. The report will auto-update when the status changes.",
          severity: "info",
        },
      ],
    };
  }

  if (msg.includes("agent") || msg.includes("session") || msg.includes("status")) {
    return {
      text: "Here is the current agent fleet status:\n\n- **Luis** (Active) \u2014 Working on UI component generation, 3 active sessions\n- **Xavier** (Idle) \u2014 Last active 4 hours ago, completed code review batch\n- **Quinn** (Error) \u2014 Rate limited on OpenAI provider, 2 failed sessions\n- **Piper** (Idle) \u2014 Last active 1 hour ago, product spec analysis complete\n- **Reed** (Active) \u2014 Processing document pipeline, 1 active session with timeout warnings",
      metrics: [
        { label: "Active Agents", value: "2/5", subtext: "Luis, Reed", trend: "flat", status: "ok" },
        { label: "Active Sessions", value: "6", subtext: "across fleet", trend: "down", status: "ok" },
        { label: "Error Agents", value: "1", subtext: "Quinn", trend: "up", status: "critical" },
      ],
      actions: [
        { label: "View Agent Dashboard", variant: "primary", viewId: "agent-dashboard" },
        { label: "Restart Quinn", variant: "warning", viewId: "agent-config" },
      ],
    };
  }

  // Default generic response
  return {
    text: "I have analyzed your request. Based on the current system state, here is what I found:\n\nYour agent fleet is operating within normal parameters with a few exceptions noted in the error log. Overall utilization is at 73% of capacity, and costs are tracking 8% above the weekly target.\n\nWould you like me to dig deeper into any specific area? I can analyze errors, costs, performance, or generate reports.",
    actions: [
      { label: "Show Detailed Analysis", variant: "primary" },
      { label: "Generate Report", variant: "secondary", viewId: "reports" },
    ],
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center">
        <Bot className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function InlineCodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-700/50">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 border-b border-gray-700/50">
        <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">{language}</span>
        <Code className="w-3 h-3 text-gray-600" />
      </div>
      <pre className="px-3 py-2.5 bg-gray-950/60 text-[12px] leading-relaxed font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

function InlineMetricCard({ metric }: { metric: MetricCard }) {
  const statusStyle = metric.status ? METRIC_STATUS_STYLES[metric.status] : "border-gray-700/50 bg-gray-800/30";
  const trendInfo = metric.trend ? METRIC_TREND_ICONS[metric.trend] : null;

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", statusStyle)}>
      <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">{metric.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-gray-100">{metric.value}</span>
        {trendInfo && (
          <span className={cn("text-xs font-medium", trendInfo.color)}>
            {trendInfo.icon}
          </span>
        )}
      </div>
      {metric.subtext && (
        <div className="text-[11px] text-gray-500 mt-0.5">{metric.subtext}</div>
      )}
    </div>
  );
}

function InlineWarning({ warning }: { warning: WarningCallout }) {
  const styles = WARNING_SEVERITY_STYLES[warning.severity];

  return (
    <div className={cn("rounded-lg border px-3 py-2.5 my-2 flex items-start gap-2.5", styles.bg, styles.border)}>
      <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", styles.icon)} />
      <div>
        <div className="text-xs font-semibold text-gray-200">{warning.title}</div>
        <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{warning.message}</div>
      </div>
    </div>
  );
}

function InlineActionButton({
  action,
  onClick,
}: {
  action: ActionButton;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
        ACTION_VARIANT_STYLES[action.variant]
      )}
    >
      {action.icon}
      {action.label}
      <ChevronRight className="w-3 h-3 opacity-50" />
    </button>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: Message;
  onAction: (viewId: string) => void;
}) {
  const isUser = message.role === "user";
  const { content } = message;

  if (isUser) {
    return (
      <div className="flex justify-end px-4">
        <div className="flex items-start gap-3 max-w-[85%] flex-row-reverse">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-300" />
          </div>
          <div className="bg-indigo-600/20 border border-indigo-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5">
            <p className="text-sm text-gray-100 leading-relaxed">{content.text}</p>
            <div className="text-[10px] text-indigo-400/50 mt-1.5 text-right">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-3 px-4 max-w-full">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center">
        <Bot className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
          {/* Text content with basic markdown-like rendering */}
          <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
            {content.text.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((segment, i) => {
              if (segment.startsWith("**") && segment.endsWith("**")) {
                return (
                  <strong key={i} className="font-semibold text-gray-100">
                    {segment.slice(2, -2)}
                  </strong>
                );
              }
              if (segment.startsWith("`") && segment.endsWith("`")) {
                return (
                  <code
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-gray-900/80 text-indigo-300 text-xs font-mono"
                  >
                    {segment.slice(1, -1)}
                  </code>
                );
              }
              return <span key={i}>{segment}</span>;
            })}
          </div>

          {/* Code blocks */}
          {content.codeBlocks?.map((block, i) => (
            <InlineCodeBlock key={i} language={block.language} code={block.code} />
          ))}

          {/* Warnings */}
          {content.warnings?.map((warning, i) => (
            <InlineWarning key={i} warning={warning} />
          ))}

          {/* Metric cards grid */}
          {content.metrics && content.metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {content.metrics.map((metric, i) => (
                <InlineMetricCard key={i} metric={metric} />
              ))}
            </div>
          )}

          {/* Action buttons */}
          {content.actions && content.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/30">
              {content.actions.map((action, i) => (
                <InlineActionButton
                  key={i}
                  action={action}
                  onClick={() => action.viewId && onAction(action.viewId)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-[10px] text-gray-600 pl-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function OperatorAICopilot({ isOpen, onClose, onNavigate }: OperatorAICopilotProps) {
  const [messages, setMessages] = useState<Message[]>(SEEDED_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: { text: trimmed },
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsTyping(true);

      // Simulate AI response delay
      const delay = 1000 + Math.random() * 1000;
      setTimeout(() => {
        const responseContent = generateMockResponse(trimmed);
        const aiMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
      }, delay);
    },
    [isTyping]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(inputValue);
      }
    },
    [inputValue, handleSend]
  );

  const handleSuggestedAction = useCallback(
    (label: string) => {
      handleSend(label);
    },
    [handleSend]
  );

  const handleMessageAction = useCallback(
    (viewId: string) => {
      onNavigate?.(viewId);
    },
    [onNavigate]
  );

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sliding panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50 transition-transform duration-300 ease-out",
          "w-full sm:w-[440px] md:w-[480px]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Gradient border effect */}
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-indigo-500/40 via-purple-500/20 to-transparent" />

        <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800/80 shadow-2xl shadow-black/40">
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 border-b border-gray-800/80">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-100">AI Copilot</h2>
                  <p className="text-[11px] text-gray-500">Operator assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400">Online</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Context chips */}
            <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
              {CONTEXT_CHIPS.map((chip) => (
                <div
                  key={chip.label}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-700/50 flex-shrink-0",
                    chip.color
                  )}
                >
                  <chip.icon className="w-3 h-3" />
                  <span className="text-[11px] font-medium">{chip.value}</span>
                  <span className="text-[10px] opacity-60">{chip.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Chat Messages ──────────────────────────────────────────────── */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto py-4 space-y-4 scroll-smooth"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(107,114,128,0.3) transparent",
            }}
          >
            {/* Welcome message */}
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-200 mb-1">AI Copilot Ready</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Ask me anything about your agent fleet, costs, errors, or performance.
                  I can also draft reports and suggest optimizations.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAction={handleMessageAction}
              />
            ))}

            {isTyping && <TypingIndicator />}

            <div ref={chatEndRef} />
          </div>

          {/* ── Suggested Actions ──────────────────────────────────────────── */}
          <div className="flex-shrink-0 border-t border-gray-800/50">
            <div className="px-4 pt-3 pb-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-2">
                Suggested
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSuggestedAction(action.label)}
                    disabled={isTyping}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
                      "bg-gray-800/60 border border-gray-700/50 text-gray-400",
                      "hover:bg-gray-700/60 hover:text-gray-200 hover:border-gray-600/60",
                      "transition-all duration-150",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    <action.icon className="w-3 h-3" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Input Area ──────────────────────────────────────────────── */}
            <div className="px-4 pb-4 pt-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border transition-colors",
                  "bg-gray-800/40 border-gray-700/50",
                  "focus-within:border-indigo-500/40 focus-within:bg-gray-800/60"
                )}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask the AI Copilot..."
                  disabled={isTyping}
                  className={cn(
                    "flex-1 bg-transparent px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600",
                    "outline-none disabled:opacity-50"
                  )}
                />
                <button
                  onClick={() => handleSend(inputValue)}
                  disabled={!inputValue.trim() || isTyping}
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mr-1 transition-all",
                    inputValue.trim() && !isTyping
                      ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20"
                      : "bg-gray-700/40 text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-1 mt-2">
                <Sparkles className="w-3 h-3 text-gray-700" />
                <span className="text-[10px] text-gray-700">
                  AI responses are simulated for demonstration purposes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
