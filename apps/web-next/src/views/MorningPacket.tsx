import React, { useState } from 'react';
import {
  Sun, GitMerge, GitPullRequest, Bot, Clock, CheckCircle,
  AlertTriangle, TrendingUp, TrendingDown, ArrowRight,
  Zap, Target, Calendar, Coffee, ChevronRight, Activity,
  XCircle, Circle, Star
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PRItem {
  number: number;
  title: string;
  status: 'merged' | 'open' | 'closed';
  author: string;
  additions: number;
  updatedAt: string;
  url: string;
}

interface AgentActivity {
  agent: string;
  emoji: string;
  model: string;
  tasksCompleted: number;
  tokensUsed: number;
  status: 'active' | 'idle' | 'error';
  lastTask: string;
  lastActive: string;
}

interface PriorityItem {
  id: string;
  title: string;
  owner: string;
  urgency: 'critical' | 'high' | 'medium';
  blockedBy?: string;
  action: string;
  requiresDavid: boolean;
}

interface StatCard {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  color: string;
  icon: React.FC<{ className?: string }>;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const OVERNIGHT_PRS: PRItem[] = [
  { number: 61, title: 'feat(horizon-ui): Horizon UI — 263-view operator dashboard', status: 'open', author: 'Luis', additions: 172992, updatedAt: '7:41 AM', url: '#' },
  { number: 68, title: 'feat(agents): non-Anthropic tool-call validation + repair layer', status: 'open', author: 'Xavier/Roman', additions: 847, updatedAt: '2:30 AM', url: '#' },
  { number: 62, title: 'test(issue-tracking): add comprehensive DAG tests', status: 'open', author: 'Tony', additions: 140, updatedAt: '1:15 AM', url: '#' },
  { number: 54, title: 'feat(workq): integrate workq extension into repo', status: 'open', author: 'Tim', additions: 2140, updatedAt: '6:07 AM', url: '#' },
  { number: 47, title: 'feat(telemetry): JSONL event sink — session lifecycle hooks', status: 'open', author: 'Xavier/Xavier', additions: 391, updatedAt: 'Yesterday', url: '#' },
  { number: 43, title: 'feat(a2a): A2A Protocol mega-branch — all 5 sub-PRs merged', status: 'open', author: 'Tim', additions: 8420, updatedAt: 'Yesterday', url: '#' },
  { number: 46, title: 'feat(utee): Phase 1 observability — 28/28 tests passing', status: 'open', author: 'Sandy', additions: 1180, updatedAt: 'Yesterday', url: '#' },
];

const AGENT_ACTIVITY: AgentActivity[] = [
  { agent: 'Tim', emoji: '🏗️', model: 'Codex 5.3', tasksCompleted: 12, tokensUsed: 284000, status: 'active', lastTask: 'dm.policy migration idempotency fix', lastActive: '8 min ago' },
  { agent: 'Luis', emoji: '🎨', model: 'Sonnet 4.6', tasksCompleted: 28, tokensUsed: 412000, status: 'active', lastTask: 'Worker PR triage + build fixes', lastActive: '5 min ago' },
  { agent: 'Xavier', emoji: '⚡', model: 'Opus 4.6', tasksCompleted: 18, tokensUsed: 521000, status: 'active', lastTask: 'Cycle #11 strategic sweep', lastActive: '12 min ago' },
  { agent: 'Sandy', emoji: '🔨', model: 'Codex 5.3', tasksCompleted: 9, tokensUsed: 198000, status: 'idle', lastTask: 'UTEE Phase 1 fixes complete', lastActive: '1h ago' },
  { agent: 'Quinn', emoji: '🔮', model: 'Flash', tasksCompleted: 6, tokensUsed: 88000, status: 'idle', lastTask: 'AgentRelationshipTopology (bs-ux-2)', lastActive: '1h 30m ago' },
  { agent: 'Piper', emoji: '🌊', model: 'Flash', tasksCompleted: 8, tokensUsed: 104000, status: 'idle', lastTask: 'EmptyState + SkillBuilder + schema-form', lastActive: '2h ago' },
  { agent: 'Roman', emoji: '⚙️', model: 'GLM-5', tasksCompleted: 5, tokensUsed: 142000, status: 'idle', lastTask: 'Tool reliability commit (71a497234)', lastActive: '4h ago' },
  { agent: 'Claire', emoji: '🔬', model: 'MiniMax M2.5', tasksCompleted: 7, tokensUsed: 167000, status: 'active', lastTask: 'A2M Phase 1 stabilization', lastActive: '15 min ago' },
];

const PRIORITIES: PriorityItem[] = [
  {
    id: 'p1',
    title: 'Brave API Key — Discovery run at 10AM today',
    owner: 'David',
    urgency: 'critical',
    blockedBy: 'Needs David to configure',
    action: 'openclaw config set brave.apiKey <KEY>',
    requiresDavid: true,
  },
  {
    id: 'p2',
    title: 'Merge PR #61 — Horizon UI (263 views, MERGEABLE)',
    owner: 'Tim or Xavier',
    urgency: 'high',
    action: 'gh pr merge 61 --repo dgarson/clawdbot --squash',
    requiresDavid: false,
  },
  {
    id: 'p3',
    title: 'Merge PR #68 — Tool Reliability (before 10AM discovery run)',
    owner: 'Tim or Xavier',
    urgency: 'high',
    action: 'gh pr review 68 --approve && gh pr merge 68',
    requiresDavid: false,
  },
  {
    id: 'p4',
    title: 'Merge PR #43 — A2A Protocol mega-branch',
    owner: 'Tim or Xavier',
    urgency: 'medium',
    action: 'Review + merge via gh pr merge 43',
    requiresDavid: false,
  },
  {
    id: 'p5',
    title: 'Merge PR #47 — Telemetry Extension',
    owner: 'Tim or Xavier',
    urgency: 'medium',
    action: 'Review + merge via gh pr merge 47',
    requiresDavid: false,
  },
  {
    id: 'p6',
    title: 'PR #44 — UI Redesign (conflicting) — close or rebase?',
    owner: 'Tim + Luis',
    urgency: 'medium',
    action: 'Decide: close in favor of #61, or rebase',
    requiresDavid: false,
  },
];

const STATS: StatCard[] = [
  { label: 'PRs Opened Overnight', value: '7', delta: '+7', deltaUp: true, color: 'text-blue-400', icon: GitPullRequest },
  { label: 'Views Shipped', value: '263', delta: 'vs goal of 20', deltaUp: true, color: 'text-emerald-400', icon: Target },
  { label: 'Active Agents', value: '4', delta: '4 idle', deltaUp: null as unknown as boolean, color: 'text-primary', icon: Bot },
  { label: 'Hours to Discovery Run', value: '~2h', delta: 'Brave key needed', deltaUp: false, color: 'text-amber-400', icon: Clock },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function PRRow({ pr }: { pr: PRItem }) {
  const statusIcon = pr.status === 'merged'
    ? <GitMerge className="w-3.5 h-3.5 text-primary" />
    : pr.status === 'open'
    ? <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
    : <XCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border)]/60 last:border-0">
      <div className="shrink-0">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--color-text-muted)]">#{pr.number}</span>
          <span className="text-sm text-[var(--color-text-primary)] truncate">{pr.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-text-muted)]">
          <span>{pr.author}</span>
          <span>·</span>
          <span className="text-emerald-600">+{pr.additions.toLocaleString()}</span>
          <span>·</span>
          <span>{pr.updatedAt}</span>
        </div>
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentActivity }) {
  const statusDot = agent.status === 'active'
    ? 'bg-emerald-400 animate-pulse'
    : agent.status === 'error'
    ? 'bg-red-400'
    : 'bg-[var(--color-surface-3)]';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border)]/60 last:border-0">
      <span className="text-lg shrink-0">{agent.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{agent.agent}</span>
          <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">{agent.model}</span>
          <div className={cn('w-1.5 h-1.5 rounded-full ml-auto', statusDot)} />
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{agent.lastTask}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium text-[var(--color-text-primary)]">{agent.tasksCompleted} tasks</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{agent.lastActive}</div>
      </div>
    </div>
  );
}

function PriorityCard({ item }: { item: PriorityItem }) {
  const urgencyConfig = {
    critical: { color: 'border-red-800/60 bg-red-900/10', badge: 'bg-red-900/40 text-red-400 border-red-800/40', icon: AlertTriangle },
    high: { color: 'border-amber-800/60 bg-amber-900/10', badge: 'bg-amber-900/40 text-amber-400 border-amber-800/40', icon: Zap },
    medium: { color: 'border-[var(--color-border)] bg-[var(--color-surface-1)]/50', badge: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]', icon: Circle },
  };
  const cfg = urgencyConfig[item.urgency];
  const Icon = cfg.icon;

  return (
    <div className={cn('p-3 rounded-xl border', cfg.color)}>
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-inherit opacity-70" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-[var(--color-text-primary)] leading-snug">{item.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.requiresDavid && (
                <span className="text-[10px] px-1.5 py-0.5 bg-violet-900/40 text-primary border border-violet-800/40 rounded font-medium">
                  David
                </span>
              )}
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', cfg.badge)}>
                {item.urgency}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">Owner: {item.owner}</span>
            {item.blockedBy && (
              <>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="text-[10px] text-red-400">⚠ {item.blockedBy}</span>
              </>
            )}
          </div>
          <code className="block mt-1.5 text-[10px] text-[var(--color-text-muted)] font-mono bg-[var(--color-surface-1)] px-2 py-1 rounded border border-[var(--color-border)] truncate">
            {item.action}
          </code>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MorningPacket() {
  const [tab, setTab] = useState<'overview' | 'prs' | 'agents' | 'priorities'>('overview');

  const now = new Date();
  const greeting = now.getHours() < 10 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const tabs: { id: typeof tab; label: string; emoji: string }[] = [
    { id: 'overview', label: 'Overview', emoji: '☀️' },
    { id: 'priorities', label: 'Priorities', emoji: '🎯' },
    { id: 'prs', label: 'Pull Requests', emoji: '🔀' },
    { id: 'agents', label: 'Agent Activity', emoji: '🤖' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-[var(--color-border)] bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950/30 px-6 py-8">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs mb-2">
            <Coffee className="w-3.5 h-3.5" />
            <span>{dateStr}</span>
            <span>·</span>
            <Calendar className="w-3 h-3" />
            <span>{now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
            {greeting}, David. <span className="text-primary">☀️</span>
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            The squad shipped overnight. Here's what happened and what needs your attention.
          </p>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {STATS.map(({ label, value, delta, deltaUp, color, icon: Icon }) => (
              <div key={label} className="bg-[var(--color-surface-1)]/70 border border-[var(--color-border)] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn('w-3.5 h-3.5', color)} />
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
                </div>
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                {delta && (
                  <p className={cn('text-[10px] mt-0.5 flex items-center gap-0.5',
                    deltaUp === true ? 'text-emerald-500' :
                    deltaUp === false ? 'text-amber-500' : 'text-[var(--color-text-muted)]'
                  )}>
                    {deltaUp === true && <TrendingUp className="w-2.5 h-2.5" />}
                    {deltaUp === false && <TrendingDown className="w-2.5 h-2.5" />}
                    {delta}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] px-6">
        <div className="flex gap-1 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6 max-w-4xl">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Top priorities summary */}
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Top Priorities Today
              </h2>
              <div className="space-y-2">
                {PRIORITIES.slice(0, 3).map((item) => (
                  <PriorityCard key={item.id} item={item} />
                ))}
                <button
                  type="button"
                  onClick={() => setTab('priorities')}
                  className="w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2 transition-colors flex items-center justify-center gap-1"
                >
                  View all {PRIORITIES.length} priorities
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Overnight PRs summary */}
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-blue-400" />
                Overnight PRs ({OVERNIGHT_PRS.length} open)
              </h2>
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-1">
                {OVERNIGHT_PRS.slice(0, 4).map((pr) => (
                  <PRRow key={pr.number} pr={pr} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTab('prs')}
                className="w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2 transition-colors flex items-center justify-center gap-1 mt-1"
              >
                View all {OVERNIGHT_PRS.length} PRs
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Agent summary */}
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Agent Activity
              </h2>
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-1">
                {AGENT_ACTIVITY.slice(0, 4).map((a) => (
                  <AgentRow key={a.agent} agent={a} />
                ))}
              </div>
            </div>

            {/* Today's schedule */}
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Today's Schedule
              </h2>
              <div className="space-y-2">
                {[
                  { time: '~10:00 AM', event: 'Discovery run Wave 1 fires', status: 'upcoming', note: '⚠ Brave API key needed first' },
                  { time: '~2:00 PM', event: 'Discovery run Wave 2', status: 'upcoming', note: '5 agents' },
                  { time: '~7:00 PM', event: 'Discovery run Wave 3', status: 'upcoming', note: '5 agents' },
                  { time: 'Anytime', event: 'PR Review: #61, #68, #43, #47', status: 'pending', note: 'Tim/Xavier can merge without David' },
                ].map(({ time, event, note }) => (
                  <div key={event} className="flex items-start gap-3 p-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl">
                    <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0 mt-0.5 w-20">{time}</span>
                    <div>
                      <p className="text-sm text-[var(--color-text-primary)]">{event}</p>
                      {note && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PRIORITIES */}
        {tab === 'priorities' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">All Priority Items</h2>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> High</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-surface-3)] inline-block" /> Medium</span>
              </div>
            </div>
            <div className="space-y-3">
              {PRIORITIES.map((item) => (
                <PriorityCard key={item.id} item={item} />
              ))}
            </div>

            <div className="mt-6 p-4 bg-violet-900/10 border border-violet-800/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-violet-300">David's action items</span>
              </div>
              <div className="space-y-1 text-sm text-[var(--color-text-primary)]">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                  <span>Configure Brave API key — <strong>before 10AM</strong> to avoid blind discovery run</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                  <span>Everything else — Tim or Xavier can handle without you per Merge Authority Matrix §12</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PULL REQUESTS */}
        {tab === 'prs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Overnight Pull Requests</h2>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{OVERNIGHT_PRS.filter(p => p.status === 'merged').length} merged</span>
                <span>{OVERNIGHT_PRS.filter(p => p.status === 'open').length} open</span>
              </div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-1">
              {OVERNIGHT_PRS.map((pr) => (
                <PRRow key={pr.number} pr={pr} />
              ))}
            </div>
            <div className="mt-4 p-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-muted)]">
              <span className="font-medium text-[var(--color-text-secondary)]">Note:</span> PRs #61, #68, #43, #47, #46 can all be merged by Tim or Xavier. David sign-off only required for security or architectural decisions. See WORK_PROTOCOL.md §12.
            </div>
          </div>
        )}

        {/* AGENTS */}
        {tab === 'agents' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Agent Activity — Overnight</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Active</span>
                <span className="flex items-center gap-1 text-[var(--color-text-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-surface-3)] inline-block" /> Idle</span>
              </div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-1 mb-4">
              {AGENT_ACTIVITY.map((a) => (
                <AgentRow key={a.agent} agent={a} />
              ))}
            </div>
            {/* Token summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Tokens Used', value: `${(AGENT_ACTIVITY.reduce((s, a) => s + a.tokensUsed, 0) / 1_000_000).toFixed(2)}M`, icon: Zap, color: 'text-primary' },
                { label: 'Total Tasks Completed', value: AGENT_ACTIVITY.reduce((s, a) => s + a.tasksCompleted, 0).toString(), icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Agents Active Now', value: AGENT_ACTIVITY.filter(a => a.status === 'active').length.toString(), icon: Activity, color: 'text-blue-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                  <Icon className={cn('w-5 h-5 mx-auto mb-2', color)} />
                  <p className={cn('text-2xl font-bold', color)}>{value}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
