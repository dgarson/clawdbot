import React, { useState } from 'react';
import { cn } from '../lib/utils';
import {
  Search, Check, AlertTriangle, X, Lightbulb, RefreshCw,
  ChevronDown, ChevronUp, Wand2, Bot, FileText, Settings
} from 'lucide-react';
import { MOCK_AGENTS } from '../mock-data';

type ReviewSeverity = 'good' | 'suggestion' | 'warning' | 'issue';

interface ReviewItem {
  id: string;
  severity: ReviewSeverity;
  title: string;
  description: string;
  file?: string;
  fixable?: boolean;
  fixed?: boolean;
}

interface ReviewResult {
  agentId: string;
  score: number;
  items: ReviewItem[];
  summary: string;
}

const SEVERITY_CONFIG: Record<ReviewSeverity, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  good: { icon: Check, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Strength' },
  suggestion: { icon: Lightbulb, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Suggestion' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Warning' },
  issue: { icon: X, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Issue' },
};

function generateMockReview(agentId: string): ReviewResult {
  const agent = MOCK_AGENTS.find(a => a.id === agentId);
  return {
    agentId,
    score: 78,
    summary: `${agent?.name ?? 'Agent'} has a solid foundation with clear identity. A few improvements would significantly enhance reliability and user experience.`,
    items: [
      {
        id: 'r1',
        severity: 'good',
        title: 'Clear personality definition in SOUL.md',
        description: 'The agent has well-defined communication style, values, and personality traits that will produce consistent behavior.',
        file: 'SOUL.md',
      },
      {
        id: 'r2',
        severity: 'good',
        title: 'Appropriate model selection',
        description: `claude-sonnet-4-6 is a good balance of capability and cost for this agent's use case.`,
      },
      {
        id: 'r3',
        severity: 'suggestion',
        title: 'Add MEMORY.md for session continuity',
        description: 'Without MEMORY.md, this agent starts fresh every session. Adding it enables persistent context across conversations.',
        file: 'MEMORY.md',
        fixable: true,
      },
      {
        id: 'r4',
        severity: 'suggestion',
        title: 'Consider restricting tool access',
        description: 'The agent has access to exec which can run arbitrary commands. If not needed, removing it reduces risk surface.',
        fixable: true,
      },
      {
        id: 'r5',
        severity: 'warning',
        title: 'SOUL.md missing error handling guidance',
        description: 'The agent has no instructions for how to handle errors or unexpected situations. This can lead to inconsistent failure modes.',
        file: 'SOUL.md',
        fixable: true,
      },
      {
        id: 'r6',
        severity: 'warning',
        title: 'No rate limit instructions',
        description: 'Without guidance on rate limiting, the agent may make too many API calls in rapid succession for data-intensive tasks.',
        fixable: false,
      },
      {
        id: 'r7',
        severity: 'issue',
        title: 'AGENTS.md references nonexistent skill',
        description: `AGENTS.md references skill "calendar-pro" which is not installed. This will cause errors when the agent tries to use it.`,
        file: 'AGENTS.md',
        fixable: true,
      },
    ],
  };
}

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 48;
  const strokeDash = (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r="48" fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="56" cy="56" r="48" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--color-text-primary)]">{score}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">/ 100</span>
      </div>
    </div>
  );
}

function ReviewItemCard({ item, onFix }: { item: ReviewItem; onFix: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[item.severity];
  const Icon = config.icon;

  if (item.fixed) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-green-500/5 border border-green-500/20 rounded-xl opacity-60">
        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
        <span className="text-sm text-[var(--color-text-secondary)] line-through">{item.title}</span>
        <span className="ml-auto text-xs text-green-400">Fixed ✓</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border', config.bg, config.border)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', config.color)} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
              {config.label}
            </span>
            {item.file && (
              <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">{item.file}</span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{item.title}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <p className="text-sm text-[var(--color-text-primary)] mb-3 leading-relaxed">{item.description}</p>
          {item.fixable && (
            <button
              type="button"
              onClick={() => onFix(item.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-sm rounded-lg border border-violet-500/30 transition-all"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto-fix this issue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentConfigReview() {
  const [selectedAgentId, setSelectedAgentId] = useState(MOCK_AGENTS[0].id);
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<ReviewSeverity | 'all'>('all');

  const selectedAgent = MOCK_AGENTS.find(a => a.id === selectedAgentId);

  async function handleReview() {
    setReviewing(true);
    setReviewResult(null);
    // Simulate AI review delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    const result = generateMockReview(selectedAgentId);
    setReviewResult(result);
    setItems(result.items);
    setReviewing(false);
  }

  function handleFix(id: string) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, fixed: true } : item));
  }

  const filteredItems = filterSeverity === 'all'
    ? items
    : items.filter(i => i.severity === filterSeverity);

  const counts = items.reduce((acc, item) => {
    if (!item.fixed) {acc[item.severity] = (acc[item.severity] ?? 0) + 1;}
    return acc;
  }, {} as Record<ReviewSeverity, number>);

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
            <Search className="w-6 h-6 text-violet-400" />
            Config Review
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            AI-powered analysis of your agent's configuration
          </p>
        </div>

        {/* Agent selector + run button */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-2">Select Agent to Review</p>
            <div className="flex flex-wrap gap-2">
              {MOCK_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => { setSelectedAgentId(agent.id); setReviewResult(null); }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all',
                    selectedAgentId === agent.id
                      ? 'bg-violet-600/15 text-violet-300 border border-violet-500/50'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]'
                  )}
                >
                  <span>{agent.emoji}</span>
                  <span className="font-medium">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleReview}
            disabled={reviewing}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all flex-shrink-0',
              reviewing
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] shadow-lg shadow-violet-900/30'
            )}
          >
            {reviewing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Run Review</>
            )}
          </button>
        </div>

        {/* Reviewing state */}
        {reviewing && (
          <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border)] p-8 text-center mb-6">
            <RefreshCw className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Analyzing {selectedAgent?.name}'s configuration...</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Checking SOUL.md, AGENTS.md, tool access, model selection, and more.</p>
            <div className="mt-4 flex justify-center gap-2">
              {['Checking files', 'Analyzing personality', 'Reviewing tools', 'Scoring'].map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  <span className="text-xs text-[var(--color-text-muted)]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {reviewResult && !reviewing && (
          <div className="space-y-6">
            {/* Score + summary */}
            <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border)] p-6">
              <div className="flex items-center gap-6">
                <ScoreGauge score={reviewResult.score} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{selectedAgent?.emoji}</span>
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedAgent?.name}</h2>
                    <span className={cn(
                      'text-sm px-2.5 py-0.5 rounded-full font-medium',
                      reviewResult.score >= 80 ? 'bg-green-500/15 text-green-400' :
                      reviewResult.score >= 60 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    )}>
                      {reviewResult.score >= 80 ? 'Excellent' : reviewResult.score >= 60 ? 'Good' : 'Needs Work'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-4">{reviewResult.summary}</p>
                  {/* Issue summary pills */}
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(counts) as [ReviewSeverity, number][]).map(([severity, count]) => {
                      const config = SEVERITY_CONFIG[severity];
                      const Icon = config.icon;
                      return (
                        <div key={severity} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.color)}>
                          <Icon className="w-3 h-3" />
                          {count} {config.label}{count !== 1 ? 's' : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter + item list */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Review Items</h3>
                <div className="flex gap-1 ml-auto">
                  {(['all', 'good', 'suggestion', 'warning', 'issue'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilterSeverity(f)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs capitalize transition-all',
                        filterSeverity === f ? 'bg-violet-600 text-[var(--color-text-primary)]' : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <ReviewItemCard key={item.id} item={item} onFix={handleFix} />
                ))}
              </div>
            </div>

            {/* Re-run button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleReview}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] rounded-xl text-sm border border-[var(--color-border)] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Re-run Review
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!reviewResult && !reviewing && (
          <div className="bg-[var(--color-surface-1)]/50 rounded-2xl border border-[var(--color-border)] border-dashed p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">AI Config Review</h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-6">
              Select an agent above and click "Run Review" to get AI-powered feedback on their configuration, 
              personality, tool access, and potential issues.
            </p>
            <div className="flex justify-center gap-8 text-sm">
              {['Strengths', 'Suggestions', 'Warnings', 'Issues'].map((type, i) => {
                const icons = [Check, Lightbulb, AlertTriangle, X];
                const colors = ['text-green-400', 'text-blue-400', 'text-amber-400', 'text-red-400'];
                const Icon = icons[i];
                return (
                  <div key={type} className="flex flex-col items-center gap-1">
                    <Icon className={cn('w-5 h-5', colors[i])} />
                    <span className="text-[var(--color-text-muted)] text-xs">{type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
