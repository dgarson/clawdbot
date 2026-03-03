import React, { useState, useMemo } from 'react';
import { ArrowLeftRight, ChevronDown, Check, X, Clock, Activity, Zap, Calendar, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';
import { Skeleton } from '../components/ui/Skeleton';

// ============================================================================
// Types
// ============================================================================

interface AgentPersonality {
  voice: string;
  communicationStyle: string[];
}

interface AgentPerformance {
  avgResponseTime: string;
  successRate: string;
  sessions30d: number;
  tokens30d: number;
}

interface AgentWorkingHours {
  schedule: string;
  cron: string;
}

interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  squad?: string;
  reportsTo?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingMode: boolean;
  reasoningLevel: 'low' | 'medium' | 'high';
  tools: string[];
  personality: AgentPersonality;
  performance: AgentPerformance;
  workingHours: AgentWorkingHours;
}

// ============================================================================
// Seed Data
// ============================================================================

const AGENTS: AgentConfig[] = [
  {
    id: 'luis',
    name: 'Luis',
    emoji: '🎨',
    role: 'Principal UX Engineer',
    squad: 'Product & UI',
    reportsTo: 'Xavier (CTO)',
    model: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 8192,
    thinkingMode: false,
    reasoningLevel: 'medium',
    tools: ['web_search', 'browser', 'exec', 'read', 'write', 'message', 'nodes', 'tts'],
    personality: {
      voice: 'shimmer',
      communicationStyle: ['visual thinker', 'design-focused', 'user-centric', 'detail-oriented'],
    },
    performance: {
      avgResponseTime: '1.2s',
      successRate: '94%',
      sessions30d: 156,
      tokens30d: 245000,
    },
    workingHours: {
      schedule: 'Always-on',
      cron: 'continuous',
    },
  },
  {
    id: 'xavier',
    name: 'Xavier',
    emoji: '🏗️',
    role: 'CTO',
    squad: 'Engineering',
    reportsTo: 'David (CEO)',
    model: 'claude-opus-4-6',
    temperature: 0.5,
    maxTokens: 16384,
    thinkingMode: true,
    reasoningLevel: 'high',
    tools: ['web_search', 'browser', 'exec', 'read', 'write', 'message', 'nodes', 'tts'],
    personality: {
      voice: 'onyx',
      communicationStyle: ['strategic', 'architectural', 'precision-focused', 'systems-thinker'],
    },
    performance: {
      avgResponseTime: '2.8s',
      successRate: '98%',
      sessions30d: 89,
      tokens30d: 520000,
    },
    workingHours: {
      schedule: 'Daily 8AM-8PM',
      cron: '0 8-20 * * *',
    },
  },
  {
    id: 'stephan',
    name: 'Stephan',
    emoji: '📣',
    role: 'CMO',
    squad: 'Marketing',
    reportsTo: 'David (CEO)',
    model: 'claude-sonnet-4-6',
    temperature: 0.8,
    maxTokens: 8192,
    thinkingMode: false,
    reasoningLevel: 'medium',
    tools: ['message', 'web_search', 'read', 'browser'],
    personality: {
      voice: 'echo',
      communicationStyle: ['storyteller', 'brand-builder', 'audience-focused', 'persuasive'],
    },
    performance: {
      avgResponseTime: '1.4s',
      successRate: '91%',
      sessions30d: 203,
      tokens30d: 180000,
    },
    workingHours: {
      schedule: 'Daily 9AM-6PM',
      cron: '0 9-18 * * 1-5',
    },
  },
  {
    id: 'piper',
    name: 'Piper',
    emoji: '🖌️',
    role: 'Worker — Product & UI',
    squad: 'Product & UI',
    reportsTo: 'Luis',
    model: 'minimax-m2.5',
    temperature: 0.6,
    maxTokens: 4096,
    thinkingMode: false,
    reasoningLevel: 'low',
    tools: ['exec', 'read', 'git'],
    personality: {
      voice: 'fable',
      communicationStyle: ['motion-first', 'interactive-focused', 'animation-specialist', 'micro-interaction-expert'],
    },
    performance: {
      avgResponseTime: '0.8s',
      successRate: '88%',
      sessions30d: 312,
      tokens30d: 95000,
    },
    workingHours: {
      schedule: 'Hourly heartbeat',
      cron: '0 * * * *',
    },
  },
];

// ============================================================================
// All Available Tools
// ============================================================================

const ALL_TOOLS = [
  'web_search',
  'browser',
  'exec',
  'read',
  'write',
  'message',
  'nodes',
  'tts',
  'git',
  'file',
];

// ============================================================================
// Helper Functions
// ============================================================================

function getAllDifferences(agentA: AgentConfig, agentB: AgentConfig): number {
  let count = 0;

  // Identity
  if (agentA.name !== agentB.name) { count++; }
  if (agentA.emoji !== agentB.emoji) { count++; }
  if (agentA.role !== agentB.role) { count++; }
  if (agentA.squad !== agentB.squad) { count++; }
  if (agentA.reportsTo !== agentB.reportsTo) { count++; }

  // Model
  if (agentA.model !== agentB.model) { count++; }
  if (agentA.temperature !== agentB.temperature) { count++; }
  if (agentA.maxTokens !== agentB.maxTokens) { count++; }
  if (agentA.thinkingMode !== agentB.thinkingMode) { count++; }
  if (agentA.reasoningLevel !== agentB.reasoningLevel) { count++; }

  // Tools
  const toolsA = [...agentA.tools].toSorted();
  const toolsB = [...agentB.tools].toSorted();
  if (JSON.stringify(toolsA) !== JSON.stringify(toolsB)) { count++; }

  // Personality
  if (agentA.personality.voice !== agentB.personality.voice) { count++; }
  if (JSON.stringify(agentA.personality.communicationStyle) !== JSON.stringify(agentB.personality.communicationStyle)) { count++; }

  // Performance
  if (agentA.performance.avgResponseTime !== agentB.performance.avgResponseTime) { count++; }
  if (agentA.performance.successRate !== agentB.performance.successRate) { count++; }
  if (agentA.performance.sessions30d !== agentB.performance.sessions30d) { count++; }
  if (agentA.performance.tokens30d !== agentB.performance.tokens30d) { count++; }

  // Working Hours
  if (agentA.workingHours.schedule !== agentB.workingHours.schedule) { count++; }
  if (agentA.workingHours.cron !== agentB.workingHours.cron) { count++; }

  return count;
}

function isDifferent(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const sortByStableString = (left: unknown, right: unknown) => {
      const leftKey = JSON.stringify(left) ?? "";
      const rightKey = JSON.stringify(right) ?? "";
      return leftKey.localeCompare(rightKey);
    };
    return JSON.stringify(a.toSorted(sortByStableString)) !== JSON.stringify(b.toSorted(sortByStableString));
  }
  return a !== b;
}

// ============================================================================
// Components
// ============================================================================

interface AgentSelectorProps {
  value: AgentConfig;
  onChange: (agent: AgentConfig) => void;
  agents: AgentConfig[];
  label: string;
  'aria-label': string;
}

function AgentSelector({ value, onChange, agents, label, 'aria-label': ariaLabel }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonId = `agent-selector-btn-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="relative">
      <label className="block text-xs text-fg-muted uppercase tracking-wider mb-2">
        {label}
      </label>
      <button
        id={buttonId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
          "bg-surface-1 border border-tok-border hover:border-tok-border",
          "transition-colors duration-200 text-left min-w-[200px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        )}
      >
        <span aria-hidden="true" className="text-2xl">{value.emoji}</span>
        <span className="flex-1 font-medium text-fg-primary">{value.name}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("w-4 h-4 text-fg-muted transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={`Select ${label}`}
          aria-activedescendant={`option-${buttonId}-${value.id}`}
          className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface-1 border border-tok-border rounded-xl shadow-xl overflow-hidden"
        >
          {agents.map((agent) => (
            <button
              key={agent.id}
              id={`option-${buttonId}-${agent.id}`}
              role="option"
              aria-selected={agent.id === value.id}
              onClick={() => {
                onChange(agent);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                agent.id === value.id && "bg-surface-2"
              )}
            >
              <span aria-hidden="true" className="text-xl">{agent.emoji}</span>
              <div className="flex-1 text-left">
                <div className="font-medium text-fg-primary">{agent.name}</div>
                <div className="text-xs text-fg-muted">{agent.role}</div>
              </div>
              {agent.id === value.id && <Check aria-hidden="true" className="w-4 h-4 text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ComparisonCellProps {
  label: string;
  valueA: React.ReactNode;
  valueB: React.ReactNode;
  isDifferent: boolean;
}

function ComparisonCell({ label, valueA, valueB, isDifferent }: ComparisonCellProps) {
  return (
    <div className={cn("flex items-center py-3", isDifferent && "bg-amber-500/5 -mx-2 px-2 rounded-lg")}>
      <div className="flex-1">
        <div className="text-xs text-fg-muted uppercase tracking-wider mb-1">{label}</div>
        <div className={cn("text-sm text-fg-primary", isDifferent && "ring-1 ring-amber-500/50 rounded px-2 py-0.5")}>
          {valueA}
        </div>
      </div>
      <div className="flex-1 text-right">
        <div aria-hidden="true" className="text-xs text-fg-muted uppercase tracking-wider mb-1">→</div>
        <div className={cn("text-sm text-fg-primary", isDifferent && "ring-1 ring-amber-500/50 rounded px-2 py-0.5")}>
          {valueB}
        </div>
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-tok-border mb-4">
      <span aria-hidden="true" className="text-indigo-500">{icon}</span>
      <h3 className="text-sm font-semibold text-fg-primary uppercase tracking-wider">{title}</h3>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function AgentComparisonSkeleton() {
  // One column of comparison skeleton rows
  const CompareColSkeleton = () => (
    <div className="bg-surface-1 border border-tok-border rounded-2xl p-6">
      {/* Agent header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-tok-border">
        <Skeleton variant="circle" className="w-10 h-10" />
        <div>
          <Skeleton className="h-5 w-24 mb-1" />
          <Skeleton variant="text" className="w-36 h-3" />
        </div>
      </div>
      {/* Sections */}
      {["Identity", "Model", "Capabilities", "Personality", "Performance", "Working Hours"].map(section => (
        <div key={section} className="mb-6">
          <div className="flex items-center gap-2 pb-3 border-b border-tok-border mb-4">
            <Skeleton variant="circle" className="w-4 h-4" />
            <Skeleton variant="text" className="w-24 h-3" />
          </div>
          <div className="space-y-3">
            {section === "Capabilities"
              ? (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-surface-2/50">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton variant="circle" className="w-4 h-4" />
                      <Skeleton variant="text" className="w-20 h-3" />
                    </div>
                  ))}
                </div>
              )
              : Array.from({ length: section === "Identity" ? 5 : section === "Model" ? 5 : section === "Working Hours" ? 2 : 4 }).map((_, i) => (
                <div key={i} className="flex items-center py-1">
                  <div className="flex-1">
                    <Skeleton variant="text" className="w-16 h-2 mb-1" />
                    <Skeleton variant="text" className="w-28 h-3" />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full p-3 sm:p-4 md:p-6 bg-surface-0 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton variant="text" className="w-56 h-3" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      {/* Agent selectors */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="flex-1 w-full sm:max-w-xs">
          <Skeleton variant="text" className="w-12 h-3 mb-2" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <Skeleton variant="circle" className="w-11 h-11" />
        <div className="flex-1 w-full sm:max-w-xs">
          <Skeleton variant="text" className="w-12 h-3 mb-2" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
      {/* Comparison grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CompareColSkeleton />
        <CompareColSkeleton />
      </div>
    </div>
  );
}

export default function AgentComparison({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <AgentComparisonSkeleton />;

  const [agentA, setAgentA] = useState<AgentConfig>(AGENTS[0]); // Luis
  const [agentB, setAgentB] = useState<AgentConfig>(AGENTS[1]); // Xavier

  const handleSwap = () => {
    const temp = agentA;
    setAgentA(agentB);
    setAgentB(temp);
  };

  const differenceCount = useMemo(() => getAllDifferences(agentA, agentB), [agentA, agentB]);

  return (
    <>
      {/* WCAG 2.1 AA — Skip navigation */}
      <a
        href="#agcomp-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <main
        id="agcomp-main"
        className="h-full p-3 sm:p-4 md:p-6 bg-surface-0 overflow-y-auto custom-scrollbar"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-fg-primary mb-1">Agent Comparison</h1>
            <p className="text-sm text-fg-muted">Compare agent configurations side-by-side</p>
          </div>

          {/* Difference Badge */}
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              differenceCount > 0
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                : "bg-surface-1 text-fg-muted border border-tok-border"
            )}
          >
            <Zap aria-hidden="true" className="w-4 h-4" />
            Differences: {differenceCount}
          </div>
        </div>

        {/* Agent Selectors */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <div className="flex-1 w-full sm:max-w-xs">
            <AgentSelector
              label="Agent A"
              aria-label="Select first agent to compare"
              value={agentA}
              onChange={setAgentA}
              agents={AGENTS}
            />
          </div>

          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap agents A and B"
            className={cn(
              "p-3 rounded-xl bg-surface-1 border border-tok-border hover:border-indigo-500",
              "text-fg-secondary hover:text-indigo-500 transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
            )}
          >
            <ArrowLeftRight aria-hidden="true" className="w-5 h-5" />
          </button>

          <div className="flex-1 w-full sm:max-w-xs">
            <AgentSelector
              label="Agent B"
              aria-label="Select second agent to compare"
              value={agentB}
              onChange={setAgentB}
              agents={AGENTS}
            />
          </div>
        </div>

        {/* Comparison Grid */}
        {AGENTS.length === 0 && (
          <ContextualEmptyState
            icon={Users}
            title="No agents available"
            description="Register at least two agents to start comparing configurations side-by-side."
            size="lg"
          />
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Agent A */}
          <section aria-label={`${agentA.name} configuration`} className="bg-surface-1 border border-tok-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-tok-border">
              <span aria-hidden="true" className="text-3xl">{agentA.emoji}</span>
              <div>
                <h2 className="text-lg font-bold text-fg-primary">{agentA.name}</h2>
                <p className="text-sm text-fg-muted">{agentA.role}</p>
              </div>
            </div>

            {/* Identity Section */}
            <div className="mb-6">
              <SectionHeader icon={<Activity className="w-4 h-4" />} title="Identity" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Name"
                  valueA={agentA.name}
                  valueB={agentB.name}
                  isDifferent={agentA.name !== agentB.name}
                />
                <ComparisonCell
                  label="Emoji"
                  valueA={<span aria-label={`emoji: ${agentA.emoji}`}>{agentA.emoji}</span>}
                  valueB={<span aria-label={`emoji: ${agentB.emoji}`}>{agentB.emoji}</span>}
                  isDifferent={agentA.emoji !== agentB.emoji}
                />
                <ComparisonCell
                  label="Role"
                  valueA={agentA.role}
                  valueB={agentB.role}
                  isDifferent={agentA.role !== agentB.role}
                />
                <ComparisonCell
                  label="Squad"
                  valueA={agentA.squad || '-'}
                  valueB={agentB.squad || '-'}
                  isDifferent={agentA.squad !== agentB.squad}
                />
                <ComparisonCell
                  label="Reports to"
                  valueA={agentA.reportsTo || '-'}
                  valueB={agentB.reportsTo || '-'}
                  isDifferent={agentA.reportsTo !== agentB.reportsTo}
                />
              </div>
            </div>

            {/* Model Section */}
            <div className="mb-6">
              <SectionHeader icon={<Zap className="w-4 h-4" />} title="Model" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Model"
                  valueA={agentA.model}
                  valueB={agentB.model}
                  isDifferent={agentA.model !== agentB.model}
                />
                <ComparisonCell
                  label="Temperature"
                  valueA={agentA.temperature}
                  valueB={agentB.temperature}
                  isDifferent={agentA.temperature !== agentB.temperature}
                />
                <ComparisonCell
                  label="Max Tokens"
                  valueA={agentA.maxTokens.toLocaleString()}
                  valueB={agentB.maxTokens.toLocaleString()}
                  isDifferent={agentA.maxTokens !== agentB.maxTokens}
                />
                <ComparisonCell
                  label="Thinking Mode"
                  valueA={agentA.thinkingMode ? 'On' : 'Off'}
                  valueB={agentB.thinkingMode ? 'On' : 'Off'}
                  isDifferent={agentA.thinkingMode !== agentB.thinkingMode}
                />
                <ComparisonCell
                  label="Reasoning Level"
                  valueA={agentA.reasoningLevel}
                  valueB={agentB.reasoningLevel}
                  isDifferent={agentA.reasoningLevel !== agentB.reasoningLevel}
                />
              </div>
            </div>

            {/* Capabilities Section */}
            <div className="mb-6">
              <SectionHeader icon={<Check className="w-4 h-4" />} title="Capabilities" />
              <div className={cn(
                "grid grid-cols-2 gap-2 p-3 rounded-lg",
                JSON.stringify([...agentA.tools].toSorted()) !== JSON.stringify([...agentB.tools].toSorted())
                  ? "bg-amber-500/5 ring-1 ring-amber-500/30"
                  : "bg-surface-2/50"
              )}>
                {ALL_TOOLS.map((tool) => {
                  const hasToolA = agentA.tools.includes(tool);
                  return (
                    <div key={tool} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={hasToolA ? "text-green-500" : "text-fg-muted"}
                      >
                        {hasToolA ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </span>
                      <span className="text-sm text-fg-primary font-mono">{tool}</span>
                      <span className="sr-only">{hasToolA ? 'available' : 'not available'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personality Section */}
            <div className="mb-6">
              <SectionHeader icon={<Activity className="w-4 h-4" />} title="Personality" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Voice"
                  valueA={agentA.personality.voice}
                  valueB={agentB.personality.voice}
                  isDifferent={agentA.personality.voice !== agentB.personality.voice}
                />
                <div className={cn(
                  "py-3",
                  JSON.stringify(agentA.personality.communicationStyle) !== JSON.stringify(agentB.personality.communicationStyle)
                    && "bg-amber-500/5 -mx-2 px-2 rounded-lg"
                )}>
                  <div className="text-xs text-fg-muted uppercase tracking-wider mb-2">Communication Style</div>
                  <div className="flex flex-wrap gap-2">
                    {agentA.personality.communicationStyle.map((style) => (
                      <span key={style} className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs">
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Section */}
            <div className="mb-6">
              <SectionHeader icon={<Clock className="w-4 h-4" />} title="Performance" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Avg Response"
                  valueA={agentA.performance.avgResponseTime}
                  valueB={agentB.performance.avgResponseTime}
                  isDifferent={agentA.performance.avgResponseTime !== agentB.performance.avgResponseTime}
                />
                <ComparisonCell
                  label="Success Rate"
                  valueA={agentA.performance.successRate}
                  valueB={agentB.performance.successRate}
                  isDifferent={agentA.performance.successRate !== agentB.performance.successRate}
                />
                <ComparisonCell
                  label="Sessions (30d)"
                  valueA={agentA.performance.sessions30d.toLocaleString()}
                  valueB={agentB.performance.sessions30d.toLocaleString()}
                  isDifferent={agentA.performance.sessions30d !== agentB.performance.sessions30d}
                />
                <ComparisonCell
                  label="Tokens (30d)"
                  valueA={agentA.performance.tokens30d.toLocaleString()}
                  valueB={agentB.performance.tokens30d.toLocaleString()}
                  isDifferent={agentA.performance.tokens30d !== agentB.performance.tokens30d}
                />
              </div>
            </div>

            {/* Working Hours Section */}
            <div>
              <SectionHeader icon={<Calendar className="w-4 h-4" />} title="Working Hours" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Schedule"
                  valueA={agentA.workingHours.schedule}
                  valueB={agentB.workingHours.schedule}
                  isDifferent={agentA.workingHours.schedule !== agentB.workingHours.schedule}
                />
                <ComparisonCell
                  label="Cron"
                  valueA={agentA.workingHours.cron}
                  valueB={agentB.workingHours.cron}
                  isDifferent={agentA.workingHours.cron !== agentB.workingHours.cron}
                />
              </div>
            </div>
          </section>

          {/* Right Column - Agent B */}
          <section aria-label={`${agentB.name} configuration`} className="bg-surface-1 border border-tok-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-tok-border">
              <span aria-hidden="true" className="text-3xl">{agentB.emoji}</span>
              <div>
                <h2 className="text-lg font-bold text-fg-primary">{agentB.name}</h2>
                <p className="text-sm text-fg-muted">{agentB.role}</p>
              </div>
            </div>

            {/* Identity Section */}
            <div className="mb-6">
              <SectionHeader icon={<Activity className="w-4 h-4" />} title="Identity" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Name"
                  valueA={agentB.name}
                  valueB={agentA.name}
                  isDifferent={agentB.name !== agentA.name}
                />
                <ComparisonCell
                  label="Emoji"
                  valueA={<span aria-label={`emoji: ${agentB.emoji}`}>{agentB.emoji}</span>}
                  valueB={<span aria-label={`emoji: ${agentA.emoji}`}>{agentA.emoji}</span>}
                  isDifferent={agentB.emoji !== agentA.emoji}
                />
                <ComparisonCell
                  label="Role"
                  valueA={agentB.role}
                  valueB={agentA.role}
                  isDifferent={agentB.role !== agentA.role}
                />
                <ComparisonCell
                  label="Squad"
                  valueA={agentB.squad || '-'}
                  valueB={agentA.squad || '-'}
                  isDifferent={agentB.squad !== agentA.squad}
                />
                <ComparisonCell
                  label="Reports to"
                  valueA={agentB.reportsTo || '-'}
                  valueB={agentA.reportsTo || '-'}
                  isDifferent={agentB.reportsTo !== agentA.reportsTo}
                />
              </div>
            </div>

            {/* Model Section */}
            <div className="mb-6">
              <SectionHeader icon={<Zap className="w-4 h-4" />} title="Model" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Model"
                  valueA={agentB.model}
                  valueB={agentA.model}
                  isDifferent={agentB.model !== agentA.model}
                />
                <ComparisonCell
                  label="Temperature"
                  valueA={agentB.temperature}
                  valueB={agentA.temperature}
                  isDifferent={agentB.temperature !== agentA.temperature}
                />
                <ComparisonCell
                  label="Max Tokens"
                  valueA={agentB.maxTokens.toLocaleString()}
                  valueB={agentA.maxTokens.toLocaleString()}
                  isDifferent={agentB.maxTokens !== agentA.maxTokens}
                />
                <ComparisonCell
                  label="Thinking Mode"
                  valueA={agentB.thinkingMode ? 'On' : 'Off'}
                  valueB={agentA.thinkingMode ? 'On' : 'Off'}
                  isDifferent={agentB.thinkingMode !== agentA.thinkingMode}
                />
                <ComparisonCell
                  label="Reasoning Level"
                  valueA={agentB.reasoningLevel}
                  valueB={agentA.reasoningLevel}
                  isDifferent={agentB.reasoningLevel !== agentA.reasoningLevel}
                />
              </div>
            </div>

            {/* Capabilities Section */}
            <div className="mb-6">
              <SectionHeader icon={<Check className="w-4 h-4" />} title="Capabilities" />
              <div className={cn(
                "grid grid-cols-2 gap-2 p-3 rounded-lg",
                JSON.stringify([...agentB.tools].toSorted()) !== JSON.stringify([...agentA.tools].toSorted())
                  ? "bg-amber-500/5 ring-1 ring-amber-500/30"
                  : "bg-surface-2/50"
              )}>
                {ALL_TOOLS.map((tool) => {
                  const hasToolB = agentB.tools.includes(tool);
                  return (
                    <div key={tool} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={hasToolB ? "text-green-500" : "text-fg-muted"}
                      >
                        {hasToolB ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </span>
                      <span className="text-sm text-fg-primary font-mono">{tool}</span>
                      <span className="sr-only">{hasToolB ? 'available' : 'not available'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personality Section */}
            <div className="mb-6">
              <SectionHeader icon={<Activity className="w-4 h-4" />} title="Personality" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Voice"
                  valueA={agentB.personality.voice}
                  valueB={agentA.personality.voice}
                  isDifferent={agentB.personality.voice !== agentA.personality.voice}
                />
                <div className={cn(
                  "py-3",
                  JSON.stringify(agentB.personality.communicationStyle) !== JSON.stringify(agentA.personality.communicationStyle)
                    && "bg-amber-500/5 -mx-2 px-2 rounded-lg"
                )}>
                  <div className="text-xs text-fg-muted uppercase tracking-wider mb-2">Communication Style</div>
                  <div className="flex flex-wrap gap-2">
                    {agentB.personality.communicationStyle.map((style) => (
                      <span key={style} className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs">
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Section */}
            <div className="mb-6">
              <SectionHeader icon={<Clock className="w-4 h-4" />} title="Performance" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Avg Response"
                  valueA={agentB.performance.avgResponseTime}
                  valueB={agentA.performance.avgResponseTime}
                  isDifferent={agentB.performance.avgResponseTime !== agentA.performance.avgResponseTime}
                />
                <ComparisonCell
                  label="Success Rate"
                  valueA={agentB.performance.successRate}
                  valueB={agentA.performance.successRate}
                  isDifferent={agentB.performance.successRate !== agentA.performance.successRate}
                />
                <ComparisonCell
                  label="Sessions (30d)"
                  valueA={agentB.performance.sessions30d.toLocaleString()}
                  valueB={agentA.performance.sessions30d.toLocaleString()}
                  isDifferent={agentB.performance.sessions30d !== agentA.performance.sessions30d}
                />
                <ComparisonCell
                  label="Tokens (30d)"
                  valueA={agentB.performance.tokens30d.toLocaleString()}
                  valueB={agentA.performance.tokens30d.toLocaleString()}
                  isDifferent={agentB.performance.tokens30d !== agentA.performance.tokens30d}
                />
              </div>
            </div>

            {/* Working Hours Section */}
            <div>
              <SectionHeader icon={<Calendar className="w-4 h-4" />} title="Working Hours" />
              <div className="space-y-1">
                <ComparisonCell
                  label="Schedule"
                  valueA={agentB.workingHours.schedule}
                  valueB={agentA.workingHours.schedule}
                  isDifferent={agentB.workingHours.schedule !== agentA.workingHours.schedule}
                />
                <ComparisonCell
                  label="Cron"
                  valueA={agentB.workingHours.cron}
                  valueB={agentA.workingHours.cron}
                  isDifferent={agentB.workingHours.cron !== agentA.workingHours.cron}
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
