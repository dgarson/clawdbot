import React, { useState } from "react"
import { cn } from "../lib/utils"

// --- Type Definitions ---

type SessionStatus = "active" | "idle" | "done"

interface ProjectFile {
  name: string
  sizeTokens: number
  preview: string
}

interface ToolCall {
  name: string
  resultTokens: number
  preview: string
}

interface InjectedItem {
  label: string
  sizeTokens: number
  preview: string
}

interface ContextSegments {
  systemPrompt: { sizeTokens: number; preview: string }
  projectFiles: ProjectFile[]
  conversationHistory: { messageCount: number; sizeTokens: number; preview: string }
  toolResults: ToolCall[]
  injectedContext: InjectedItem[]
}

interface Session {
  id: string
  agentName: string
  model: string
  tokenCount: number
  maxTokens: number
  status: SessionStatus
  segments: ContextSegments
}

// --- Mock Data ---

function mkSession(id: string, name: string, model: string, tokens: number, status: SessionStatus, seg: ContextSegments): Session {
  return { id, agentName: name, model, tokenCount: tokens, maxTokens: 200000, status, segments: seg }
}

const MOCK_SESSIONS: Session[] = [
  mkSession("sess-001", "Luis", "claude-sonnet-4-6", 142300, "active", {
    systemPrompt: { sizeTokens: 4200, preview: "You are Luis, Principal UX Engineer. You lead the Product & UI Squad which owns the user interface, design system..." },
    projectFiles: [
      { name: "AGENTS.md", sizeTokens: 3800, preview: "# AGENTS.md — Luis (Principal UX Engineer)\n\n## Role\n**Principal UX Engineer** — bridge between design..." },
      { name: "TOOLS.md", sizeTokens: 5100, preview: "# TOOLS.md — Luis, Principal UX Engineer\n\n## Who You Are\n**Luis** — Principal UX Engineer..." },
      { name: "CONTEXT.md", sizeTokens: 2400, preview: "# CONTEXT.md — Current product context and priorities.\n\n## Active Workstreams..." },
      { name: "UX_ROADMAP.md", sizeTokens: 1800, preview: "# UX Roadmap — 4-6 Week Forward View\n\n## Week 1-2: Foundation\n- Design system tokens finalized..." },
    ],
    conversationHistory: { messageCount: 47, sizeTokens: 98200, preview: "[user]: Build the ContextBrowser view.\n[assistant]: Creating the component now..." },
    toolResults: [
      { name: "read(AGENTS.md)", resultTokens: 3800, preview: "# AGENTS.md — Luis (Principal UX Engineer)..." },
      { name: "exec(pnpm check)", resultTokens: 420, preview: "$ pnpm check\n> clawdbot@0.1.0 check\n> tsc --noEmit && eslint..." },
      { name: "write(ContextBrowser.tsx)", resultTokens: 180, preview: "File written: ContextBrowser.tsx (487 lines)" },
    ],
    injectedContext: [
      { label: "Current Date", sizeTokens: 45, preview: "Today's date is 2026-02-22." },
      { label: "Memory (today)", sizeTokens: 1200, preview: "## 2026-02-22\n- Started Horizon UI view buildout..." },
      { label: "Runtime Config", sizeTokens: 380, preview: "agent=luis | host=David's MacBook Pro | repo=/Users/openclaw..." },
    ],
  }),
  mkSession("sess-002", "Piper", "MiniMax-M2.5", 38400, "active", {
    systemPrompt: { sizeTokens: 3100, preview: "You are Piper, a worker agent on the Product & UI Squad..." },
    projectFiles: [{ name: "AGENTS.md", sizeTokens: 3800, preview: "# AGENTS.md — Luis (Principal UX Engineer)..." }],
    conversationHistory: { messageCount: 12, sizeTokens: 24500, preview: "[system]: You are Piper...\n[user]: Build ContextBrowser.tsx..." },
    toolResults: [{ name: "write(ContextBrowser.tsx)", resultTokens: 200, preview: "File written successfully." }],
    injectedContext: [
      { label: "Current Date", sizeTokens: 45, preview: "Today's date is 2026-02-22." },
      { label: "Subagent Context", sizeTokens: 600, preview: "You are a subagent spawned by the main agent..." },
    ],
  }),
  mkSession("sess-003", "Xavier", "claude-opus-4-6", 189500, "idle", {
    systemPrompt: { sizeTokens: 5800, preview: "You are Xavier, the CTO. You oversee all engineering and product direction..." },
    projectFiles: [
      { name: "SOUL.md", sizeTokens: 2200, preview: "# Soul — Organization identity, values, mission..." },
      { name: "CONTEXT.md", sizeTokens: 2400, preview: "# CONTEXT.md — Current product context..." },
      { name: "BACKLOG.md", sizeTokens: 4100, preview: "# BACKLOG.md — Prioritized work items\n\n## P0 — Critical..." },
    ],
    conversationHistory: { messageCount: 134, sizeTokens: 156800, preview: "[user]: Review the architecture for the new dashboard...\n[assistant]: Looking at current state..." },
    toolResults: [
      { name: "exec(git log)", resultTokens: 1200, preview: "commit abc123 — feat: add dashboard layout..." },
      { name: "read(BACKLOG.md)", resultTokens: 4100, preview: "# BACKLOG.md — Prioritized work items..." },
      { name: "sessions_list()", resultTokens: 800, preview: "Active sessions: luis, piper, quinn, tim..." },
    ],
    injectedContext: [
      { label: "Current Date", sizeTokens: 45, preview: "Today's date is 2026-02-22." },
      { label: "Memory (today)", sizeTokens: 2800, preview: "## 2026-02-22\n- Reviewed Horizon UI progress..." },
      { label: "Runtime Config", sizeTokens: 420, preview: "agent=xavier | model=claude-opus-4-6..." },
    ],
  }),
  mkSession("sess-004", "Tim", "claude-sonnet-4-6", 67200, "done", {
    systemPrompt: { sizeTokens: 4600, preview: "You are Tim, VP of Architecture. You oversee all engineering architecture decisions..." },
    projectFiles: [{ name: "TOOLS.md", sizeTokens: 4800, preview: "# TOOLS.md — Tim, VP Architecture..." }],
    conversationHistory: { messageCount: 28, sizeTokens: 41200, preview: "[user]: Review the PR from Luis's squad...\n[assistant]: Reviewing PR #247..." },
    toolResults: [{ name: "gh pr review", resultTokens: 350, preview: "PR #247 reviewed — approved with comments." }],
    injectedContext: [{ label: "Current Date", sizeTokens: 45, preview: "Today's date is 2026-02-22." }],
  }),
  mkSession("sess-005", "Quinn", "MiniMax-M2.5", 8100, "idle", {
    systemPrompt: { sizeTokens: 2900, preview: "You are Quinn, a worker on the Product & UI Squad. User flows and interaction design..." },
    projectFiles: [],
    conversationHistory: { messageCount: 4, sizeTokens: 3200, preview: "[system]: You are Quinn...\n[user]: Stand by for task assignment." },
    toolResults: [],
    injectedContext: [{ label: "Current Date", sizeTokens: 45, preview: "Today's date is 2026-02-22." }],
  }),
]

// --- Helper Functions ---

function formatTokens(count: number): string {
  if (count >= 1000) {return `${(count / 1000).toFixed(1)}k`}
  return String(count)
}

function getUsagePercent(used: number, max: number): number {
  return Math.round((used / max) * 100)
}

function getUsageColor(percent: number): string {
  if (percent >= 95) {return "bg-red-500"}
  if (percent >= 80) {return "bg-orange-500"}
  if (percent >= 50) {return "bg-yellow-500"}
  return "bg-green-500"
}

function getUsageTextColor(percent: number): string {
  if (percent >= 95) {return "text-red-400"}
  if (percent >= 80) {return "text-orange-400"}
  if (percent >= 50) {return "text-yellow-400"}
  return "text-green-400"
}

function getStatusDot(status: SessionStatus): string {
  if (status === "active") {return "bg-green-400"}
  if (status === "idle") {return "bg-yellow-400"}
  return "bg-[var(--color-surface-3)]"
}

function getStatusLabel(status: SessionStatus): string {
  if (status === "active") {return "Active"}
  if (status === "idle") {return "Idle"}
  return "Done"
}

// --- Component ---

export default function ContextBrowser() {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({})
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")

  const selected = sessions.find((s) => s.id === selectedId) ?? null

  function toggleSegment(key: string) {
    setExpandedSegments((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleFile(key: string) {
    setExpandedFiles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleTrimContext() {
    if (!selected) {return}
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== selected.id) {return s}
        const removedTokens = Math.round(s.segments.conversationHistory.sizeTokens * 0.3)
        const removedMessages = Math.round(s.segments.conversationHistory.messageCount * 0.3)
        return {
          ...s,
          tokenCount: s.tokenCount - removedTokens,
          segments: {
            ...s.segments,
            conversationHistory: {
              ...s.segments.conversationHistory,
              messageCount: s.segments.conversationHistory.messageCount - removedMessages,
              sizeTokens: s.segments.conversationHistory.sizeTokens - removedTokens,
            },
          },
        }
      })
    )
  }

  function matchesSearch(text: string): boolean {
    if (!searchQuery.trim()) {return true}
    return text.toLowerCase().includes(searchQuery.toLowerCase())
  }

  function computeTotalSegmentTokens(seg: ContextSegments): number {
    const files = seg.projectFiles.reduce((a, f) => a + f.sizeTokens, 0)
    const tools = seg.toolResults.reduce((a, t) => a + t.resultTokens, 0)
    const injected = seg.injectedContext.reduce((a, i) => a + i.sizeTokens, 0)
    return seg.systemPrompt.sizeTokens + files + seg.conversationHistory.sizeTokens + tools + injected
  }

  // --- Render helpers ---

  function renderTokenBar(session: Session) {
    const percent = getUsagePercent(session.tokenCount, session.maxTokens)
    const color = getUsageColor(percent)
    const textColor = getUsageTextColor(percent)

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Context Window Usage</span>
          <span className={cn("text-sm font-mono font-semibold", textColor)}>
            {formatTokens(session.tokenCount)} / {formatTokens(session.maxTokens)} tokens ({percent}%)
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", color)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  function renderSegmentHeader(label: string, tokens: number, segKey: string, extra?: string) {
    const isOpen = expandedSegments[segKey] ?? false
    const visible = matchesSearch(label)
    if (!visible) {return null}

    return (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg mb-3 overflow-hidden">
        <button
          onClick={() => toggleSegment(segKey)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-surface-2)]/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center text-xs font-bold bg-[var(--color-surface-2)] text-[var(--color-text-primary)] transition-transform",
              isOpen && "rotate-90"
            )}>
              ▶
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
            {extra && <span className="text-xs text-[var(--color-text-muted)]">{extra}</span>}
          </div>
          <span className="text-xs font-mono text-[var(--color-text-muted)]">{formatTokens(tokens)} tokens</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-3 border-t border-[var(--color-border)]">
            {segKey === "projectFiles" && selected ? renderSubItems(
              selected.segments.projectFiles.map((f) => ({ key: `file-${f.name}`, label: f.name, tokens: f.sizeTokens, preview: f.preview })),
              "No project files loaded."
            ) : null}
            {segKey === "toolResults" && selected ? renderSubItems(
              selected.segments.toolResults.map((t, i) => ({ key: `tool-${i}-${t.name}`, label: t.name, tokens: t.resultTokens, preview: t.preview, accent: true })),
              "No tool results in context."
            ) : null}
            {segKey === "injectedContext" && selected ? renderSubItems(
              selected.segments.injectedContext.map((c) => ({ key: `inj-${c.label}`, label: c.label, tokens: c.sizeTokens, preview: c.preview })),
              "No injected context."
            ) : null}
            {segKey === "systemPrompt" && selected ? (
              <div className="mt-3 p-3 bg-[var(--color-surface-0)] rounded text-xs font-mono text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                {selected.segments.systemPrompt.preview.slice(0, 200)}
                {selected.segments.systemPrompt.preview.length > 200 && (
                  <span className="text-[var(--color-text-muted)]">…</span>
                )}
              </div>
            ) : null}
            {segKey === "conversationHistory" && selected ? (
              <div className="mt-3 p-3 bg-[var(--color-surface-0)] rounded text-xs font-mono text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                {selected.segments.conversationHistory.preview.slice(0, 200)}
                {selected.segments.conversationHistory.preview.length > 200 && (
                  <span className="text-[var(--color-text-muted)]">…</span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  function renderSubItems(items: Array<{ key: string; label: string; tokens: number; preview: string; accent?: boolean }>, emptyMsg: string) {
    const filtered = items.filter((i) => matchesSearch(i.label))
    if (filtered.length === 0) {return <p className="mt-3 text-xs text-[var(--color-text-muted)] italic">{emptyMsg}</p>}
    return (
      <div className="mt-3 space-y-2">
        {filtered.map((item) => {
          const isOpen = expandedFiles[item.key] ?? false
          return (
            <div key={item.key} className="bg-[var(--color-surface-0)] rounded border border-[var(--color-border)]/60">
              <button onClick={() => toggleFile(item.key)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-surface-2)]/30 transition-colors">
                <span className={cn("text-xs font-mono", item.accent ? "text-primary" : "text-[var(--color-text-primary)]")}>{item.label}</span>
                <span className="text-xs font-mono text-[var(--color-text-muted)]">{formatTokens(item.tokens)}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2 border-t border-[var(--color-border)]/40">
                  <div className="mt-2 p-2 bg-[var(--color-surface-1)] rounded text-xs font-mono text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                    {item.preview.slice(0, 200)}{item.preview.length > 200 && <span className="text-[var(--color-text-muted)]">…</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // --- Segment breakdown bar ---

  function renderBreakdownBar(session: Session) {
    const seg = session.segments
    const total = session.tokenCount || 1
    const parts: Array<{ label: string; tokens: number; color: string }> = [
      { label: "System", tokens: seg.systemPrompt.sizeTokens, color: "bg-primary" },
      { label: "Files", tokens: seg.projectFiles.reduce((a, f) => a + f.sizeTokens, 0), color: "bg-cyan-500" },
      { label: "History", tokens: seg.conversationHistory.sizeTokens, color: "bg-primary" },
      { label: "Tools", tokens: seg.toolResults.reduce((a, t) => a + t.resultTokens, 0), color: "bg-amber-500" },
      { label: "Injected", tokens: seg.injectedContext.reduce((a, i) => a + i.sizeTokens, 0), color: "bg-emerald-500" },
    ]

    return (
      <div className="mb-6">
        <div className="text-xs text-[var(--color-text-muted)] mb-2">Context Breakdown</div>
        <div className="h-4 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden flex">
          {parts.map((p) => {
            const w = Math.max((p.tokens / total) * 100, 0)
            if (w < 0.5) {return null}
            return (
              <div
                key={p.label}
                className={cn("h-full transition-all duration-300", p.color)}
                style={{ width: `${w}%` }}
                title={`${p.label}: ${formatTokens(p.tokens)}`}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {parts.map((p) => (
            <div key={p.label} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-sm", p.color)} />
              <span className="text-xs text-[var(--color-text-muted)]">{p.label}</span>
              <span className="text-xs font-mono text-[var(--color-text-muted)]">{formatTokens(p.tokens)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Main Render ---

  const filteredSessions = sessions.filter((s) =>
    !searchQuery.trim() || s.agentName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] flex">
      {/* Left Panel — Session List */}
      <div className="w-72 flex-shrink-0 border-r border-[var(--color-border)] flex flex-col">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">Context Browser</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Inspect agent context windows</p>
        </div>
        <div className="p-3">
          <input
            type="text"
            placeholder="Search sessions or context..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.map((session) => {
            const percent = getUsagePercent(session.tokenCount, session.maxTokens)
            const isSelected = selectedId === session.id
            return (
              <button
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/50 transition-colors",
                  isSelected ? "bg-primary/10 border-l-2 border-l-indigo-500" : "hover:bg-[var(--color-surface-1)]/80"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-sm font-medium", isSelected ? "text-primary" : "text-[var(--color-text-primary)]")}>
                    {session.agentName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", getStatusDot(session.status))} />
                    <span className="text-xs text-[var(--color-text-muted)]">{getStatusLabel(session.status)}</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-mono mb-2">{session.model}</div>
                <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", getUsageColor(percent))}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-mono mt-1">
                  {formatTokens(session.tokenCount)} / {formatTokens(session.maxTokens)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 rounded bg-primary/20 border border-primary/40" />
              </div>
              <p className="text-[var(--color-text-muted)] text-sm">Select a session to inspect its context window</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{selected.agentName}</h2>
                <span className="text-xs font-mono text-[var(--color-text-muted)]">{selected.model} · {selected.id}</span>
              </div>
              <button
                onClick={handleTrimContext}
                className="px-4 py-2 bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors"
              >
                Trim Context
              </button>
            </div>

            {/* Token usage bar */}
            {renderTokenBar(selected)}

            {/* Breakdown visualization */}
            {renderBreakdownBar(selected)}

            {/* Segments */}
            <div className="space-y-0">
              {renderSegmentHeader(
                "System Prompt",
                selected.segments.systemPrompt.sizeTokens,
                "systemPrompt"
              )}
              {renderSegmentHeader(
                "Project Files",
                selected.segments.projectFiles.reduce((a, f) => a + f.sizeTokens, 0),
                "projectFiles",
                `${selected.segments.projectFiles.length} files`
              )}
              {renderSegmentHeader(
                "Conversation History",
                selected.segments.conversationHistory.sizeTokens,
                "conversationHistory",
                `${selected.segments.conversationHistory.messageCount} messages`
              )}
              {renderSegmentHeader(
                "Tool Results",
                selected.segments.toolResults.reduce((a, t) => a + t.resultTokens, 0),
                "toolResults",
                `${selected.segments.toolResults.length} calls`
              )}
              {renderSegmentHeader(
                "Injected Context",
                selected.segments.injectedContext.reduce((a, i) => a + i.sizeTokens, 0),
                "injectedContext",
                `${selected.segments.injectedContext.length} items`
              )}
            </div>

            {/* Summary footer */}
            <div className="mt-6 p-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Tracked segment total: {formatTokens(computeTotalSegmentTokens(selected.segments))} tokens</span>
                <span>Overhead / padding: {formatTokens(Math.max(0, selected.tokenCount - computeTotalSegmentTokens(selected.segments)))} tokens</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
