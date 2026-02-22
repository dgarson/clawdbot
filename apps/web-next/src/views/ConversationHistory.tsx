import React, { useState, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";

type MessageRole = "user" | "assistant" | "system" | "tool";
type SessionStatus = "active" | "completed" | "error" | "timeout";

interface HistoryMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  tokenCount?: number;
  toolName?: string;
  durationMs?: number;
}

interface HistorySession {
  id: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  title: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  totalTokens: number;
  messages: HistoryMessage[];
  tags: string[];
}

const SEED_SESSIONS: HistorySession[] = [
  {
    id: "s1",
    agentId: "luis",
    agentName: "Luis",
    agentEmoji: "🎨",
    title: "Horizon UI Design Discussion",
    status: "completed",
    startedAt: "2026-02-21T10:00:00Z",
    endedAt: "2026-02-21T10:45:00Z",
    messageCount: 6,
    totalTokens: 1240,
    tags: ["ui", "design", "horizon"],
    messages: [
      { id: "m1", role: "user", content: "Let's review the new Horizon layout. We need a cleaner master-detail view.", timestamp: "10:00:05", tokenCount: 45 },
      { id: "m2", role: "assistant", content: "I've drafted a layout using a 280px sidebar. This should provide enough room for session lists while keeping the focus on the conversation.", timestamp: "10:01:20", tokenCount: 120 },
      { id: "m3", role: "tool", toolName: "generate_mockup", content: "Rendering layout-v1.png with 280px sidebar...", timestamp: "10:01:25", tokenCount: 30 },
      { id: "m4", role: "user", content: "Can we ensure the focus rings are consistent across all inputs?", timestamp: "10:05:00", tokenCount: 40 },
      { id: "m5", role: "assistant", content: "Absolutely. I'll update the tailwind config to use indigo-500 for focus-visible:ring-2 across all interactive elements.", timestamp: "10:06:15", tokenCount: 95 },
      { id: "m6", role: "system", content: "Session marked as completed by user.", timestamp: "10:45:00", tokenCount: 10 }
    ]
  },
  {
    id: "s2",
    agentId: "luis",
    agentName: "Luis",
    agentEmoji: "🎨",
    title: "Dark Theme Architecture",
    status: "active",
    startedAt: "2026-02-22T00:30:00Z",
    messageCount: 4,
    totalTokens: 850,
    tags: ["theme", "architecture"],
    messages: [
      { id: "m7", role: "user", content: "What's the best way to handle the zinc-950 background transition?", timestamp: "00:30:05", tokenCount: 35 },
      { id: "m8", role: "assistant", content: "Using CSS variables for the palette is the most flexible approach. We can map zinc-950 to --bg-page.", timestamp: "00:32:00", tokenCount: 110 },
      { id: "m9", role: "user", content: "Should we use a secondary background for cards?", timestamp: "00:35:00", tokenCount: 25 },
      { id: "m10", role: "assistant", content: "Yes, zinc-900 provides a subtle contrast for surface elements like session cards and tool outputs.", timestamp: "00:36:10", tokenCount: 90 }
    ]
  },
  {
    id: "s3",
    agentId: "xavier",
    agentName: "Xavier",
    agentEmoji: "🚀",
    title: "Sprint Planning Q1 2026",
    status: "completed",
    startedAt: "2026-02-15T09:00:00Z",
    endedAt: "2026-02-15T11:30:00Z",
    messageCount: 8,
    totalTokens: 2100,
    tags: ["management", "planning"],
    messages: [
      { id: "m11", role: "user", content: "Let's outline the core objectives for Q1.", timestamp: "09:00:10", tokenCount: 40 },
      { id: "m12", role: "assistant", content: "Our main focus is the OpenClaw 2.0 release. Key milestones: multi-agent coordination, subagent spawning, and the Horizon UI launch.", timestamp: "09:05:00", tokenCount: 150 },
      { id: "m13", role: "tool", toolName: "fetch_roadmap", content: "Retrieved Q1 roadmap document (ID: rd-2026-q1)", timestamp: "09:05:15", tokenCount: 45 },
      { id: "m14", role: "user", content: "Who is leading the subagent work?", timestamp: "09:15:00", tokenCount: 20 },
      { id: "m15", role: "assistant", content: "Quinn and Tim are handling the state management and architectural implications.", timestamp: "09:16:30", tokenCount: 80 },
      { id: "m16", role: "user", content: "Perfect. Let's schedule a deep dive next week.", timestamp: "09:20:00", tokenCount: 30 },
      { id: "m17", role: "assistant", content: "Agreed. I'll coordinate with their calendars.", timestamp: "09:21:00", tokenCount: 40 },
      { id: "m18", role: "system", content: "Session archived after 2 hours of inactivity.", timestamp: "11:30:00", tokenCount: 15 }
    ]
  },
  {
    id: "s4",
    agentId: "xavier",
    agentName: "Xavier",
    agentEmoji: "🚀",
    title: "Product Vision Alignment",
    status: "error",
    startedAt: "2026-02-20T14:00:00Z",
    messageCount: 5,
    totalTokens: 1400,
    tags: ["vision", "alignment"],
    messages: [
      { id: "m19", role: "user", content: "How do we differentiate from competitors this year?", timestamp: "14:00:05", tokenCount: 35 },
      { id: "m20", role: "assistant", content: "Our edge is local-first, privacy-focused execution with high-autonomy agents. Most competitors rely on centralized clouds.", timestamp: "14:02:00", tokenCount: 130 },
      { id: "m21", role: "user", content: "Explain the 'High-Autonomy' part in detail.", timestamp: "14:10:00", tokenCount: 30 },
      { id: "m22", role: "assistant", content: "It's about the ability to spawn subagents and manage complex tool chains without constant human intervention...", timestamp: "14:12:00", tokenCount: 160 },
      { id: "m23", role: "system", content: "Fatal Error: LLM provider connection reset during long-form generation.", timestamp: "14:15:00", tokenCount: 50 }
    ]
  },
  {
    id: "s5",
    agentId: "stephan",
    agentName: "Stephan",
    agentEmoji: "✍️",
    title: "Brand Voice Guide v2",
    status: "completed",
    startedAt: "2026-02-18T11:00:00Z",
    endedAt: "2026-02-18T12:00:00Z",
    messageCount: 5,
    totalTokens: 1800,
    tags: ["copy", "brand"],
    messages: [
      { id: "m24", role: "user", content: "I want the brand voice to be 'authoritative but approachable'. Can you provide some examples?", timestamp: "11:00:10", tokenCount: 50 },
      { id: "m25", role: "assistant", content: "Instead of 'Error detected', we say 'Something went wrong, but we're on it.' Instead of 'Data saved', we say 'Got it. Your work is secure.'", timestamp: "11:05:00", tokenCount: 180 },
      { id: "m26", role: "user", content: "Good. Now apply that to our privacy policy summary.", timestamp: "11:15:00", tokenCount: 30 },
      { id: "m27", role: "assistant", content: "Privacy Policy Summary: We believe your data belongs to you. Period. We don't peek, we don't sell, and we don't track you across the web. Just powerful tools, running locally, respecting your space.", timestamp: "11:20:00", tokenCount: 220 },
      { id: "m28", role: "system", content: "Document exported to PDF. Session closed.", timestamp: "12:00:00", tokenCount: 20 }
    ]
  },
  {
    id: "s6",
    agentId: "stephan",
    agentName: "Stephan",
    agentEmoji: "✍️",
    title: "Marketing Landing Copy",
    status: "timeout",
    startedAt: "2026-02-19T16:00:00Z",
    messageCount: 4,
    totalTokens: 1100,
    tags: ["marketing", "copy"],
    messages: [
      { id: "m29", role: "user", content: "Write a headline for the 'subagents' feature.", timestamp: "16:00:05", tokenCount: 30 },
      { id: "m30", role: "assistant", content: "Option A: Scale your productivity with a team of AI experts.\nOption B: Don't just prompt. Delegate.\nOption C: Your personal agent, now with its own staff.", timestamp: "16:02:00", tokenCount: 110 },
      { id: "m31", role: "user", content: "I like Option B. Let's expand on the 'Delegate' theme for the sub-headline.", timestamp: "16:10:00", tokenCount: 35 },
      { id: "m32", role: "system", content: "Session timeout due to inactivity (no user input for 60 minutes).", timestamp: "17:10:00", tokenCount: 15 }
    ]
  },
  {
    id: "s7",
    agentId: "tim",
    agentName: "Tim",
    agentEmoji: "🏗️",
    title: "Megabranch PR Review Protocol",
    status: "completed",
    startedAt: "2026-02-21T15:00:00Z",
    endedAt: "2026-02-21T16:30:00Z",
    messageCount: 7,
    totalTokens: 2500,
    tags: ["engineering", "protocol"],
    messages: [
      { id: "m33", role: "user", content: "How should we handle PRs into megabranches to avoid merge hell?", timestamp: "15:00:05", tokenCount: 45 },
      { id: "m34", role: "assistant", content: "We need strict rebase policies. Every task branch must be rebased onto the megabranch before PR creation. No exceptions.", timestamp: "15:05:00", tokenCount: 140 },
      { id: "m35", role: "tool", toolName: "git_check_hooks", content: "Verification of pre-commit hooks: OK. Server-side check active.", timestamp: "15:06:00", tokenCount: 55 },
      { id: "m36", role: "user", content: "What if multiple agents touch the same config file?", timestamp: "15:20:00", tokenCount: 30 },
      { id: "m37", role: "assistant", content: "That's why we colocate state. If two agents are touching the same file, the task boundaries might be wrong. We should split the config.", timestamp: "15:25:00", tokenCount: 110 },
      { id: "m38", role: "user", content: "Understood. Documenting this in TOOLS.md.", timestamp: "15:40:00", tokenCount: 20 },
      { id: "m39", role: "assistant", content: "Excellent. I'll watch for the updates.", timestamp: "15:42:00", tokenCount: 30 }
    ]
  },
  {
    id: "s8",
    agentId: "piper",
    agentName: "Piper",
    agentEmoji: "✨",
    title: "Design System Component Patterns",
    status: "active",
    startedAt: "2026-02-22T01:00:00Z",
    messageCount: 4,
    totalTokens: 920,
    tags: ["design-system", "interaction"],
    messages: [
      { id: "m40", role: "user", content: "What's the standard for 'active' states on navigation items?", timestamp: "01:00:05", tokenCount: 40 },
      { id: "m41", role: "assistant", content: "We use a 2px left border in indigo-500 and a subtle zinc-800 background. It provides high visual clarity without being distracting.", timestamp: "01:02:00", tokenCount: 115 },
      { id: "m42", role: "user", content: "Does that apply to the master-detail sidebar too?", timestamp: "01:10:00", tokenCount: 30 },
      { id: "m43", role: "assistant", content: "Yes, specifically for the session items. I'll provide a code snippet for the Tailwind classes.", timestamp: "01:12:00", tokenCount: 85 }
    ]
  }
];

export default function ConversationHistory() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SessionStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "messages" | "tokens">("recent");

  const filteredSessions = useMemo(() => {
    return SEED_SESSIONS
      .filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             s.agentName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === "all" || s.status === filter;
        return matchesSearch && matchesFilter;
      })
      .toSorted((a, b) => {
        if (sortBy === "recent") {return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();}
        if (sortBy === "messages") {return b.messageCount - a.messageCount;}
        if (sortBy === "tokens") {return b.totalTokens - a.totalTokens;}
        return 0;
      });
  }, [searchQuery, filter, sortBy]);

  const selectedSession = useMemo(() => 
    SEED_SESSIONS.find(s => s.id === selectedId), [selectedId]);

  const handleExport = useCallback(() => {
    if (!selectedSession) {return;}
    const json = JSON.stringify(selectedSession, null, 2);
    navigator.clipboard.writeText(json);
    alert("Session data copied to clipboard!");
  }, [selectedSession]);

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className="w-[280px] border-r border-zinc-800 flex flex-col bg-zinc-950 z-10"
        role="complementary"
        aria-label="Conversation list"
      >
        <div className="p-4 border-b border-zinc-800 space-y-4">
          <h1 className="text-lg font-semibold tracking-tight">History</h1>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search history..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["all", "active", "completed", "error"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  filter === f 
                    ? "bg-indigo-600 text-white" 
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
             <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Sort By</span>
             <select 
              className="bg-transparent text-[11px] text-zinc-400 font-medium hover:text-zinc-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort sessions"
             >
               <option value="recent">Recent</option>
               <option value="messages">Messages</option>
               <option value="tokens">Tokens</option>
             </select>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredSessions.map(session => (
            <button
              key={session.id}
              onClick={() => setSelectedId(session.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all group relative focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                selectedId === session.id
                  ? "bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700"
                  : "bg-transparent border-transparent hover:bg-zinc-900/50"
              )}
              aria-selected={selectedId === session.id}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base" role="img" aria-hidden="true">{session.agentEmoji}</span>
                  <span className="text-xs font-semibold text-zinc-300 truncate">{session.agentName}</span>
                </div>
                <StatusDot status={session.status} />
              </div>
              <h3 className="text-sm font-medium text-white mb-2 line-clamp-1 group-hover:text-indigo-400 transition-colors">
                {session.title}
              </h3>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                <div className="flex gap-2">
                  <span>{session.messageCount} msgs</span>
                  <span>{Math.round(session.totalTokens / 100) / 10}k tokens</span>
                </div>
                <span>{new Date(session.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
              {selectedId === session.id && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Detail Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950" role="main">
        {selectedSession ? (
          <>
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shadow-inner">
                  {selectedSession.agentEmoji}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">{selectedSession.title}</h2>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-semibold text-zinc-400 uppercase tracking-wide">{selectedSession.agentName}</span>
                    <span>•</span>
                    <span>Started {new Date(selectedSession.startedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total Usage</span>
                  <span className="text-xs font-mono text-zinc-300">{selectedSession.totalTokens.toLocaleString()} tokens</span>
                </div>
                <button
                  onClick={handleExport}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-xs font-semibold border border-zinc-700 transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                  aria-label="Export session as JSON"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export JSON
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar scroll-smooth">
              {selectedSession.messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.role === "user" ? "ml-auto items-end" : 
                    msg.role === "system" ? "mx-auto items-center w-full max-w-lg" : 
                    "mr-auto items-start"
                  )}
                >
                  {/* Meta */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    {msg.role === "tool" && (
                      <span className="bg-amber-900/30 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter border border-amber-800/50">
                        {msg.toolName}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">{msg.timestamp}</span>
                    {msg.tokenCount && (
                      <span className="text-[10px] text-zinc-600 font-mono">[{msg.tokenCount} tkn]</span>
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm transition-all",
                      msg.role === "user" 
                        ? "bg-indigo-600 text-white rounded-tr-none" 
                        : msg.role === "assistant" 
                        ? "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none"
                        : msg.role === "tool"
                        ? "bg-amber-900/10 text-amber-200/90 border border-amber-800/20 rounded-tl-none italic"
                        : "bg-transparent text-zinc-500 italic text-xs text-center border-y border-zinc-900/50 py-2 w-full"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-4xl mb-6 shadow-2xl">
              📂
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Select a conversation</h2>
            <p className="text-zinc-500 max-w-xs text-sm">
              Review past agent interactions, monitor token usage, and replay session logs from your history.
            </p>
          </div>
        )}
      </main>

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
      `}} />
    </div>
  );
}

function StatusDot({ status }: { status: SessionStatus }) {
  const colors = {
    active: "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]",
    completed: "bg-emerald-400",
    error: "bg-rose-400",
    timeout: "bg-amber-400"
  };
  
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full", colors[status])} />
      <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500">{status}</span>
    </div>
  );
}
