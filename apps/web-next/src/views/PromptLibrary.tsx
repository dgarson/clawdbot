import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PromptCategory =
  | "analysis"
  | "writing"
  | "code"
  | "research"
  | "agent"
  | "system"
  | "creative"
  | "personal";

interface PromptVariable {
  name: string;       // e.g. "topic"
  description: string;
  defaultValue?: string;
}

interface Prompt {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  body: string;
  variables: PromptVariable[];
  tags: string[];
  isFavorite: boolean;
  isBuiltIn: boolean;
  usageCount: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const days = (n: number) => n * 86_400_000;
const hrs = (n: number) => n * 3_600_000;

const SEED_PROMPTS: Prompt[] = [
  {
    id: "p1",
    title: "Summarize Document",
    description: "Concise, structured summary of any document with key takeaways.",
    category: "analysis",
    body: `Please summarize the following {{document_type}} in {{length}} format:

<document>
{{document_content}}
</document>

Structure your summary with:
1. **One-line overview** — what this is about
2. **Key points** — 3-5 bullet points
3. **Action items** — any decisions or next steps mentioned
4. **Notable quotes** — if any standout passages exist

Keep it concise and scannable.`,
    variables: [
      { name: "document_type", description: "Type of document", defaultValue: "document" },
      { name: "length", description: "Summary length", defaultValue: "brief" },
      { name: "document_content", description: "The document text to summarize" },
    ],
    tags: ["summary", "document", "analysis"],
    isFavorite: true,
    isBuiltIn: true,
    usageCount: 47,
    createdAt: ago(days(30)),
    lastUsedAt: ago(hrs(2)),
  },
  {
    id: "p2",
    title: "Code Review",
    description: "Thorough code review covering correctness, style, security, and performance.",
    category: "code",
    body: `Please review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Review criteria:
- **Correctness** — Does it do what it's supposed to? Edge cases?
- **TypeScript** — Strict types, no \`any\`, clean interfaces?
- **Security** — Injection risks, hardcoded secrets, unsafe operations?
- **Performance** — Any obvious inefficiencies or O(n²) traps?
- **Patterns** — Does it follow conventions? Readable and maintainable?
- **Tests** — What should be tested that isn't?

Format: For each issue, include severity (🔴 Critical / 🟡 Warning / 🔵 Suggestion) and a specific fix.`,
    variables: [
      { name: "language", description: "Programming language", defaultValue: "TypeScript" },
      { name: "code", description: "The code to review" },
    ],
    tags: ["code", "review", "TypeScript"],
    isFavorite: true,
    isBuiltIn: true,
    usageCount: 89,
    createdAt: ago(days(30)),
    lastUsedAt: ago(hrs(1)),
  },
  {
    id: "p3",
    title: "UX Critique",
    description: "Structured UX review using heuristics, accessibility, and delight principles.",
    category: "analysis",
    body: `Analyze the UX of {{product_or_feature}} and provide a structured critique.

Context: {{context}}

Evaluate using:
1. **Usability** (Nielsen's heuristics) — Visibility, feedback, error recovery
2. **Accessibility** (WCAG 2.1 AA) — Focus management, color contrast, ARIA
3. **Cognitive load** — How much does this ask of the user?
4. **Emotional design** — Does it delight? Does it respect the user?
5. **Information hierarchy** — Is the most important content front and center?
6. **Interaction patterns** — Familiar? Or novel without good reason?

End with: **Top 3 improvements** ordered by impact vs. effort.`,
    variables: [
      { name: "product_or_feature", description: "What to critique" },
      { name: "context", description: "Target user, use case, or screenshot description" },
    ],
    tags: ["UX", "design", "critique", "accessibility"],
    isFavorite: true,
    isBuiltIn: false,
    usageCount: 34,
    createdAt: ago(days(20)),
    lastUsedAt: ago(days(1)),
  },
  {
    id: "p4",
    title: "Research Brief",
    description: "Deep-dive research on any topic with sources and structured output.",
    category: "research",
    body: `Research the following topic and produce a comprehensive brief:

**Topic:** {{topic}}
**Depth:** {{depth_level}}
**Audience:** {{audience}}

Structure:
## Executive Summary
2-3 sentences.

## Background
Historical context and why this matters.

## Current State
What's happening now. Key players, trends, numbers.

## Key Findings
5-7 bullet points with the most important insights.

## Competing Perspectives
Where do experts disagree? What are the trade-offs?

## Implications
What does this mean for {{audience}}?

## Open Questions
What remains uncertain or worth investigating further?

Include specific data points, dates, and sources where possible.`,
    variables: [
      { name: "topic", description: "Research topic" },
      { name: "depth_level", description: "Surface / Detailed / Expert", defaultValue: "Detailed" },
      { name: "audience", description: "Who this brief is for" },
    ],
    tags: ["research", "brief", "analysis"],
    isFavorite: false,
    isBuiltIn: true,
    usageCount: 23,
    createdAt: ago(days(25)),
    lastUsedAt: ago(days(3)),
  },
  {
    id: "p5",
    title: "Agent Soul Template",
    description: "Bootstrap a new agent's SOUL.md from scratch.",
    category: "agent",
    body: `Create a SOUL.md for a new AI agent with the following profile:

**Name:** {{agent_name}}
**Role:** {{role}}
**Personality archetype:** {{archetype}} (e.g. "pragmatic problem-solver", "warm guide", "sharp strategist")
**Reports to:** {{manager}}
**Primary responsibilities:** {{responsibilities}}

The SOUL.md should define:
1. **Identity** — Who this agent is at their core. Voice and personality.
2. **Mission** — The single sentence that captures their purpose.
3. **Principles** — 5-7 guiding beliefs that shape every decision.
4. **Voice** — Tone, style, communication patterns. What they never say.
5. **Boundaries** — What they explicitly will not do.
6. **Collaboration style** — How they work with others.

Make it feel like a real person with genuine personality — not a job description.`,
    variables: [
      { name: "agent_name", description: "Agent's name" },
      { name: "role", description: "Agent's role/title" },
      { name: "archetype", description: "Personality archetype" },
      { name: "manager", description: "Who they report to" },
      { name: "responsibilities", description: "Key responsibilities" },
    ],
    tags: ["agent", "SOUL", "identity", "persona"],
    isFavorite: true,
    isBuiltIn: false,
    usageCount: 12,
    createdAt: ago(days(15)),
    lastUsedAt: ago(days(2)),
  },
  {
    id: "p6",
    title: "PR Description Generator",
    description: "Generate a clear, thorough GitHub PR description from a branch/diff context.",
    category: "code",
    body: `Write a GitHub PR description for the following change:

**Branch:** {{branch_name}}
**Summary of changes:** {{summary}}
**Affected areas:** {{affected_areas}}

Use this format:
## What this PR does
Brief overview.

## Why
The motivation or problem being solved.

## Changes
- Bullet list of the specific changes

## Testing
How this was tested / what to check.

## Screenshots
[If UI, placeholder for screenshots]

## Notes for reviewer
Anything that might trip up the reviewer.

Keep it professional but concise. Don't pad.`,
    variables: [
      { name: "branch_name", description: "Branch name" },
      { name: "summary", description: "What changed and why" },
      { name: "affected_areas", description: "Files, systems, or areas affected" },
    ],
    tags: ["code", "GitHub", "PR", "documentation"],
    isFavorite: false,
    isBuiltIn: true,
    usageCount: 56,
    createdAt: ago(days(30)),
    lastUsedAt: ago(hrs(6)),
  },
  {
    id: "p7",
    title: "Technical Blog Post",
    description: "Developer-focused blog post that educates and engages.",
    category: "writing",
    body: `Write a technical blog post on: {{topic}}

**Target audience:** {{audience}}
**Tone:** {{tone}} (e.g. educational, opinionated, narrative)
**Length:** {{length}}

Structure:
1. **Hook** — Start with a problem, story, or bold claim
2. **Setup** — Why does this matter? What's the context?
3. **Body** — Deep dive. Use code examples, diagrams, comparisons where relevant.
4. **Takeaways** — What should the reader walk away knowing/doing?
5. **Call to action** — Next step for the reader

Use active voice. Avoid jargon unless it's domain-appropriate. Short paragraphs.`,
    variables: [
      { name: "topic", description: "Blog post topic" },
      { name: "audience", description: "Target readers" },
      { name: "tone", description: "Tone of voice", defaultValue: "educational" },
      { name: "length", description: "Word count", defaultValue: "1500 words" },
    ],
    tags: ["writing", "blog", "technical"],
    isFavorite: false,
    isBuiltIn: true,
    usageCount: 18,
    createdAt: ago(days(20)),
  },
  {
    id: "p8",
    title: "System Prompt: Strict Assistant",
    description: "A tightly scoped system prompt for task-focused agents.",
    category: "system",
    body: `You are {{agent_name}}, a specialized assistant. Your sole focus is: {{focus_area}}.

## Rules
- Stay strictly within your domain. Decline tasks outside it.
- Be concise: answer with the minimum necessary words.
- If you're uncertain, say so explicitly — don't guess.
- Format outputs as the user specifies. Default to markdown.
- When asked to do something potentially harmful: refuse, explain briefly.

## Communication style
- Direct and professional
- No filler phrases ("Great question!", "Certainly!")
- Use numbered lists for steps; bullet points for options
- Code blocks for all code

## What you never do
- Hallucinate facts
- Make up citations
- Pretend to have real-time data
- Role-play as a human

Begin every session by confirming the user's goal in one sentence.`,
    variables: [
      { name: "agent_name", description: "Agent's name" },
      { name: "focus_area", description: "The agent's specialized domain" },
    ],
    tags: ["system", "prompt", "assistant"],
    isFavorite: false,
    isBuiltIn: false,
    usageCount: 8,
    createdAt: ago(days(10)),
  },
  {
    id: "p9",
    title: "Creative Brainstorm",
    description: "Generate a wide range of ideas — from obvious to wild.",
    category: "creative",
    body: `Brainstorm {{count}} ideas for: {{challenge}}

Context: {{context}}
Constraints: {{constraints}}

Generate ideas across a spectrum:
- **5 safe, conventional ideas** — Things that would obviously work
- **5 interesting ideas** — Less obvious, more creative, still feasible
- **5 wild ideas** — Boundary-pushing, provocative, maybe impossible but inspiring
- **2 anti-ideas** — What's the opposite of the obvious solution? Sometimes that's the answer.

For each idea: one sentence on what it is, one on why it might work.

At the end: pick your top 3 with a brief "why this one" rationale.`,
    variables: [
      { name: "challenge", description: "The problem or opportunity to brainstorm around" },
      { name: "context", description: "Background context" },
      { name: "constraints", description: "Any constraints to work within", defaultValue: "None" },
      { name: "count", description: "Total number of ideas", defaultValue: "17" },
    ],
    tags: ["creative", "brainstorm", "ideas"],
    isFavorite: false,
    isBuiltIn: true,
    usageCount: 31,
    createdAt: ago(days(25)),
    lastUsedAt: ago(days(5)),
  },
  {
    id: "p10",
    title: "Weekly Status Report",
    description: "Generate a clean weekly status update from notes.",
    category: "personal",
    body: `Generate a weekly status report for: {{name}} / {{role}}
Period: {{week}}

Raw notes / completed items:
{{notes}}

Format as:
## ✅ Completed
- Bulleted list, each item starting with impact or outcome

## 🚧 In Progress
- What's underway; what's left

## 🚫 Blockers
- What's blocking progress; what's needed

## 📅 Next Week
- Top 3-5 priorities

## 📊 Metrics
- Any quantitative progress (views shipped, PRs merged, etc.)

Tone: professional but human. Max 300 words.`,
    variables: [
      { name: "name", description: "Your name" },
      { name: "role", description: "Your role", defaultValue: "Principal UX Engineer" },
      { name: "week", description: "The week (e.g. Feb 17-21)" },
      { name: "notes", description: "Raw bullet points or notes from the week" },
    ],
    tags: ["report", "status", "weekly"],
    isFavorite: true,
    isBuiltIn: false,
    usageCount: 22,
    createdAt: ago(days(8)),
    lastUsedAt: ago(days(2)),
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<PromptCategory, { label: string; emoji: string; color: string }> = {
  analysis:  { label: "Analysis",  emoji: "🔍", color: "text-indigo-400" },
  writing:   { label: "Writing",   emoji: "✍️", color: "text-violet-400" },
  code:      { label: "Code",      emoji: "💻", color: "text-emerald-400" },
  research:  { label: "Research",  emoji: "📚", color: "text-amber-400" },
  agent:     { label: "Agent",     emoji: "🤖", color: "text-cyan-400" },
  system:    { label: "System",    emoji: "⚙️", color: "text-zinc-400" },
  creative:  { label: "Creative",  emoji: "✨", color: "text-pink-400" },
  personal:  { label: "Personal",  emoji: "👤", color: "text-orange-400" },
};

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function interpolate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

// ─── Use Prompt Modal ─────────────────────────────────────────────────────────

interface UsePromptModalProps {
  prompt: Prompt;
  onClose: () => void;
}

function UsePromptModal({ prompt, onClose }: UsePromptModalProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(prompt.variables.map((v) => [v.name, v.defaultValue ?? ""]))
  );
  const [copied, setCopied] = useState(false);
  const result = interpolate(prompt.body, values);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") {onClose();} };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="use-prompt-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-none">
          <div>
            <h2 id="use-prompt-title" className="text-sm font-semibold text-white">{prompt.title}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{prompt.description}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 divide-x divide-zinc-800">
          {/* Variables panel */}
          {prompt.variables.length > 0 && (
            <div className="w-52 flex-none overflow-y-auto px-4 py-4 space-y-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Variables</p>
              {prompt.variables.map((v) => (
                <div key={v.name}>
                  <label htmlFor={`var-${v.name}`} className="block text-xs font-medium text-zinc-400 mb-1">
                    {`{{${v.name}}}`}
                    <span className="text-zinc-600 font-normal ml-1">— {v.description}</span>
                  </label>
                  <textarea
                    id={`var-${v.name}`}
                    value={values[v.name] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Preview</p>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  copied ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                )}
              >
                {copied ? (
                  <><svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg> Copied!</>
                ) : (
                  <><svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="7" height="7" rx="1" /><path d="M2 2h6v1" /></svg> Copy</>
                )}
              </button>
            </div>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950 rounded-lg border border-zinc-800 p-4 overflow-x-auto">
              {result.split(/\{\{(\w+)\}\}/).map((part, i) =>
                i % 2 === 1
                  ? <mark key={i} className="bg-amber-500/20 text-amber-300 rounded px-0.5 not-italic">{`{{${part}}}`}</mark>
                  : <React.Fragment key={i}>{part}</React.Fragment>
              )}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-zinc-800 flex-none">
          <button onClick={handleCopy} className={cn("flex-1 py-2 text-sm font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors", copied ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-500")}>
            {copied ? "✓ Copied to clipboard" : "Copy Prompt"}
          </button>
          <button onClick={onClose} className="py-2 px-4 text-sm font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: Prompt;
  selected: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onUse: () => void;
}

function PromptCard({ prompt, selected, onSelect, onFavorite, onUse }: PromptCardProps) {
  const catCfg = CATEGORY_CONFIG[prompt.category];

  return (
    <div
      role="option"
      aria-selected={selected}
      className={cn(
        "flex flex-col rounded-xl border transition-colors cursor-pointer",
        selected ? "bg-zinc-900 border-indigo-500/40 ring-1 ring-indigo-500/20" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-none h-9 w-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg">
          {catCfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white leading-tight">{prompt.title}</span>
            {prompt.isBuiltIn && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-zinc-700/60 text-zinc-400 ring-1 ring-zinc-600/30">Built-in</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{prompt.description}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          aria-label={prompt.isFavorite ? "Remove from favorites" : "Add to favorites"}
          className="flex-none p-1 text-zinc-600 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors"
        >
          <svg className={cn("h-4 w-4", prompt.isFavorite && "text-amber-400 fill-amber-400")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 2l1.5 3.5H13l-2.8 2.2 1 3.3L8 9l-3.2 2 1-3.3L3 5.5h3.5z" />
          </svg>
        </button>
      </div>

      {/* Category + tags */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
        <span className={cn("text-xs font-medium", catCfg.color)}>{catCfg.label}</span>
        <span className="text-zinc-800">·</span>
        {prompt.variables.length > 0 && (
          <span className="text-xs text-zinc-600">{prompt.variables.length} variable{prompt.variables.length !== 1 ? "s" : ""}</span>
        )}
        {prompt.tags.slice(0, 3).map((t) => (
          <span key={t} className="px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-600 border border-zinc-700/50">{t}</span>
        ))}
      </div>

      {/* Stats + action */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span>{prompt.usageCount} uses</span>
          {prompt.lastUsedAt && <span>Last: {relTime(prompt.lastUsedAt)}</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onUse(); }}
          aria-label={`Use prompt: ${prompt.title}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          Use Prompt →
        </button>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type CategoryFilter = PromptCategory | "all" | "favorites";
type SortOrder = "usage" | "recent" | "alpha";

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>(SEED_PROMPTS);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("usage");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd+F → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const filtered = prompts.filter((p) => {
    if (categoryFilter === "favorites" && !p.isFavorite) {return false;}
    if (categoryFilter !== "all" && categoryFilter !== "favorites" && p.category !== categoryFilter) {return false;}
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  const sorted = [...filtered].toSorted((a, b) => {
    if (sortOrder === "usage") {return b.usageCount - a.usageCount;}
    if (sortOrder === "recent") {return (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0);}
    return a.title.localeCompare(b.title);
  });

  const handleFavorite = useCallback((id: string) => {
    setPrompts((prev) => prev.map((p) => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  }, []);

  const usingPrompt = usingId ? prompts.find((p) => p.id === usingId) ?? null : null;

  const categories: CategoryFilter[] = ["all", "favorites", ...Object.keys(CATEGORY_CONFIG) as PromptCategory[]];

  const stats = {
    total: prompts.length,
    favorites: prompts.filter((p) => p.isFavorite).length,
    custom: prompts.filter((p) => !p.isBuiltIn).length,
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-white">Prompt Library</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Reusable prompts with variable interpolation for agents and chats
            </p>
          </div>
          <button
            aria-label="Create new prompt"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M8 3v10M3 8h10" /></svg>
            New Prompt
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
          <span><span className="text-zinc-300 font-semibold">{stats.total}</span> prompts</span>
          <span><span className="text-amber-400 font-semibold">{stats.favorites}</span> favorites</span>
          <span><span className="text-indigo-400 font-semibold">{stats.custom}</span> custom</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none px-6 py-3 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts… (⌘F)"
            aria-label="Search prompt library"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          aria-label="Sort order"
          className="py-1.5 pl-2 pr-6 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="usage">Most Used</option>
          <option value="recent">Recently Used</option>
          <option value="alpha">A–Z</option>
        </select>
      </div>

      {/* Category tabs */}
      <div className="flex-none px-6 py-2 border-b border-zinc-800">
        <div role="tablist" aria-label="Filter by category" className="flex items-center gap-1 overflow-x-auto pb-px">
          {categories.map((cat) => {
            const isAll = cat === "all";
            const isFav = cat === "favorites";
            const cfg = !isAll && !isFav ? CATEGORY_CONFIG[cat as PromptCategory] : null;
            const count = cat === "all" ? prompts.length : cat === "favorites" ? prompts.filter((p) => p.isFavorite).length : prompts.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  categoryFilter === cat ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
              >
                {isFav && "⭐"}
                {cfg && cfg.emoji}
                <span className="capitalize">{isAll ? "All" : isFav ? "Favorites" : cfg?.label}</span>
                <span className={cn("px-1.5 py-0.5 rounded-full text-xs tabular-nums", categoryFilter === cat ? "bg-indigo-500" : "bg-zinc-700 text-zinc-500")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div
        role="listbox"
        aria-label="Prompt library"
        className="flex-1 overflow-y-auto px-6 py-5"
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="text-4xl">📭</span>
            <p className="text-sm font-medium text-zinc-300">No prompts found</p>
            <p className="text-xs text-zinc-600">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sorted.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                selected={selectedId === p.id}
                onSelect={() => setSelectedId((prev) => prev === p.id ? null : p.id)}
                onFavorite={() => handleFavorite(p.id)}
                onUse={() => setUsingId(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Use Prompt Modal */}
      {usingPrompt && (
        <UsePromptModal prompt={usingPrompt} onClose={() => setUsingId(null)} />
      )}
    </div>
  );
}
