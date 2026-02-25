import React, { useState } from "react";
import { cn } from "../lib/utils";

type RoutingStrategy = 'cost' | 'speed' | 'quality' | 'balanced';
type ConditionKind = 'token-budget' | 'task-complexity' | 'agent' | 'time-of-day' | 'keyword';
type ConditionOp = 'lt' | 'gt' | 'eq' | 'contains' | 'in';

interface RoutingCondition {
  kind: ConditionKind;
  op: ConditionOp;
  value: string | number;
  label: string;
}

interface RoutingRule {
  id: string;
  name: string;
  priority: number; // lower = higher priority
  enabled: boolean;
  conditions: RoutingCondition[];
  targetModel: string;
  fallbackModel?: string;
  description: string;
  hitCount: number; // total times this rule fired
  lastFiredAt?: string;
}

const SEED_RULES: RoutingRule[] = [
  {
    id: "rule-1",
    name: "Fast tasks → Gemini Flash",
    priority: 1,
    enabled: true,
    conditions: [
      { kind: "token-budget", op: "lt", value: 500, label: "Tokens < 500" },
      { kind: "task-complexity", op: "lt", value: 3, label: "Complexity < 3" },
    ],
    targetModel: "gemini-3-flash",
    description: "Optimized for high-speed, low-cost responses on trivial tasks.",
    hitCount: 4820,
    lastFiredAt: "2024-03-21T14:30:00Z",
  },
  {
    id: "rule-2",
    name: "Agent workers → MiniMax",
    priority: 2,
    enabled: true,
    conditions: [
      { kind: "agent", op: "in", value: "Piper,Quinn,Reed,Wes,Sam", label: "Agent in Squad" },
    ],
    targetModel: "minimax-m2.5",
    description: "Standard model for squad-based sub-agent operations.",
    hitCount: 12340,
    lastFiredAt: "2024-03-21T14:45:00Z",
  },
  {
    id: "rule-3",
    name: "Code review → Claude Opus",
    priority: 3,
    enabled: true,
    conditions: [
      { kind: "keyword", op: "contains", value: "review code", label: "Keyword: 'review code'" },
    ],
    targetModel: "claude-opus-4-6",
    description: "High-precision model for technical code auditing.",
    hitCount: 284,
    lastFiredAt: "2024-03-21T12:00:00Z",
  },
  {
    id: "rule-4",
    name: "Off-peak cost savings",
    priority: 4,
    enabled: true,
    conditions: [
      { kind: "time-of-day", op: "gt", value: 22, label: "After 10 PM" },
      { kind: "time-of-day", op: "lt", value: 6, label: "Before 6 AM" },
    ],
    targetModel: "gemini-3-flash",
    fallbackModel: "minimax-m2.5",
    description: "Shifts to cheaper models during low-traffic night hours.",
    hitCount: 1240,
    lastFiredAt: "2024-03-21T04:15:00Z",
  },
  {
    id: "rule-5",
    name: "Complex reasoning → Claude Sonnet",
    priority: 5,
    enabled: true,
    conditions: [
      { kind: "task-complexity", op: "gt", value: 7, label: "Complexity > 7" },
    ],
    targetModel: "claude-sonnet-4-6",
    description: "Default for heavy lifting and multi-step reasoning.",
    hitCount: 3102,
    lastFiredAt: "2024-03-21T14:55:00Z",
  },
  {
    id: "rule-6",
    name: "Luis primary",
    priority: 6,
    enabled: true,
    conditions: [
      { kind: "agent", op: "eq", value: "Luis", label: "Agent is Luis" },
    ],
    targetModel: "claude-sonnet-4-6",
    description: "Dedicated high-quality routing for Principal UX Engineer tasks.",
    hitCount: 8841,
    lastFiredAt: "2024-03-21T15:02:00Z",
  },
  {
    id: "rule-7",
    name: "Default fallback",
    priority: 99,
    enabled: true,
    conditions: [],
    targetModel: "claude-sonnet-4-6",
    description: "Global catch-all rule when no other conditions are met.",
    hitCount: 28441,
    lastFiredAt: "2024-03-21T15:10:00Z",
  },
];

const STRATEGY_PRESETS: Record<RoutingStrategy, { title: string; desc: string; icon: string }> = {
  cost: { title: "Cost Optimized", desc: "Prioritize low-cost models like Gemini Flash.", icon: "💰" },
  speed: { title: "Speed First", desc: "Minimize latency at all costs.", icon: "⚡" },
  quality: { title: "Maximum Quality", desc: "Always use the most capable models.", icon: "🎯" },
  balanced: { title: "Balanced", desc: "Auto-scale based on task complexity.", icon: "⚖️" },
};

const CONDITION_COLORS: Record<ConditionKind, string> = {
  "token-budget": "bg-sky-400/10 text-sky-400 border-sky-400/20",
  "task-complexity": "bg-primary/10 text-primary border-primary/20",
  "agent": "bg-primary/10 text-primary border-primary/20",
  "time-of-day": "bg-amber-400/10 text-amber-400 border-amber-400/20",
  "keyword": "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
};

export default function ModelRouter() {
  const [rules, setRules] = useState<RoutingRule[]>(SEED_RULES);
  const [strategy, setStrategy] = useState<RoutingStrategy>("balanced");
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Test State
  const [testAgent, setTestAgent] = useState("Quinn");
  const [testTokens, setTestTokens] = useState(450);
  const [testComplexity, setTestComplexity] = useState(2);
  const [testTime, setTestTime] = useState(14);
  const [testKeyword, setTestKeyword] = useState("");

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const moveRule = (id: string, direction: 'up' | 'down') => {
    const index = rules.findIndex(r => r.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === rules.length - 1)) {return;}

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];

    // Re-assign priorities based on new order (simplification for UI)
    const updated = newRules.map((r, i) => ({ ...r, priority: i + 1 }));
    setRules(updated);
  };

  const findMatchingRule = () => {
    const activeRules = rules.filter(r => r.enabled).toSorted((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      if (rule.conditions.length === 0) {return rule;} // Default fallback

      const matches = rule.conditions.every(cond => {
        switch (cond.kind) {
          case 'token-budget':
            return cond.op === 'lt' ? testTokens < (cond.value as number) : testTokens > (cond.value as number);
          case 'task-complexity':
            return cond.op === 'lt' ? testComplexity < (cond.value as number) : testComplexity > (cond.value as number);
          case 'agent':
            if (cond.op === 'eq') {return testAgent === cond.value;}
            if (cond.op === 'in') {return (cond.value as string).split(',').includes(testAgent);}
            return false;
          case 'time-of-day':
            return cond.op === 'lt' ? testTime < (cond.value as number) : testTime > (cond.value as number);
          case 'keyword':
            return testKeyword.toLowerCase().includes((cond.value as string).toLowerCase());
          default:
            return false;
        }
      });

      if (matches) {return rule;}
    }
    return null;
  };

  const matchingRule = findMatchingRule();

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-8 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Model Router</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">Intelligent orchestration and conditional LLM routing.</p>
        </div>

        {/* Strategy Presets */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(Object.entries(STRATEGY_PRESETS) as [RoutingStrategy, typeof STRATEGY_PRESETS['cost']][]).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setStrategy(key)}
                className={cn(
                  "p-5 rounded-xl border text-left transition-all duration-200 group",
                  strategy === key
                    ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                    : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-1)]/80"
                )}
              >
                <div className="text-2xl mb-3">{data.icon}</div>
                <h3 className={cn("font-semibold mb-1", strategy === key ? "text-primary" : "text-[var(--color-text-primary)]")}>
                  {data.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
                  {data.desc}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Rules Table */}
        <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] w-16">Ord</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Rule Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Conditions</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Target Model</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Hits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rules.map((rule, idx) => (
                  <React.Fragment key={rule.id}>
                    <tr
                      className={cn(
                        "group hover:bg-[var(--color-surface-2)]/30 transition-colors cursor-pointer",
                        !rule.enabled && "opacity-60",
                        expandedRule === rule.id && "bg-[var(--color-surface-2)]/50"
                      )}
                      onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRule(rule.id, 'up'); }}
                            className="p-1 hover:text-primary transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRule(rule.id, 'down'); }}
                            className="p-1 hover:text-primary transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--color-text-primary)]">{rule.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Priority {rule.priority}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {rule.conditions.length > 0 ? (
                            rule.conditions.map((c, ci) => (
                              <span
                                key={ci}
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                  CONDITION_COLORS[c.kind]
                                )}
                              >
                                {c.label}
                              </span>
                            ))
                          ) : (
                            <span className="text-[var(--color-text-muted)] text-xs italic">No conditions</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs px-2 py-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)]">
                            {rule.targetModel}
                          </code>
                          {rule.fallbackModel && (
                            <>
                              <span className="text-[var(--color-text-muted)] text-xs">→</span>
                              <code className="text-[10px] px-1.5 py-0.5 bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded text-[var(--color-text-muted)]">
                                {rule.fallbackModel}
                              </code>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRule(rule.id); }}
                          className={cn(
                            "relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            rule.enabled ? "bg-primary" : "bg-[var(--color-surface-3)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              rule.enabled ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-mono text-[var(--color-text-secondary)]">{rule.hitCount.toLocaleString()}</div>
                      </td>
                    </tr>
                    {expandedRule === rule.id && (
                      <tr>
                        <td colSpan={6} className="px-12 py-6 bg-[var(--color-surface-1)]/80 border-b border-[var(--color-border)]">
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)] mb-2 block">Description</label>
                              <textarea
                                className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg p-3 text-sm text-[var(--color-text-primary)] focus:border-primary outline-none h-24 resize-none"
                                defaultValue={rule.description}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)] mb-2 block">Active Conditions</label>
                              <div className="space-y-2">
                                {rule.conditions.map((c, ci) => (
                                  <div key={ci} className="flex items-center justify-between p-2 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg text-xs">
                                    <span className="text-[var(--color-text-secondary)] uppercase font-mono tracking-tight">{c.kind}</span>
                                    <span className="text-[var(--color-text-primary)]">{c.op} <span className="text-primary font-bold">{c.value}</span></span>
                                  </div>
                                ))}
                                <button className="w-full py-2 border border-dashed border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text-secondary)] transition-all">
                                  + Add Condition
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Route Test Panel */}
        <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold">Route Test</h2>
              <p className="text-[var(--color-text-muted)] text-sm">Simulate input to verify routing logic.</p>
            </div>
            {matchingRule && (
              <div className="flex items-center gap-3 px-4 py-2 bg-emerald-400/10 border border-emerald-400/20 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Match: <span className="font-bold">{matchingRule.name}</span></span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Agent</label>
              <input
                type="text"
                value={testAgent}
                onChange={(e) => setTestAgent(e.target.value)}
                className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Token Count</label>
              <input
                type="number"
                value={testTokens}
                onChange={(e) => setTestTokens(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Complexity (1-10)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={testComplexity}
                onChange={(e) => setTestComplexity(parseInt(e.target.value))}
                className="w-full h-10 accent-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Time (0-23)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={testTime}
                onChange={(e) => setTestTime(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Keyword</label>
              <input
                type="text"
                placeholder="Search prompt..."
                value={testKeyword}
                onChange={(e) => setTestKeyword(e.target.value)}
                className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          {matchingRule ? (
            <div className="mt-8 p-6 bg-[var(--color-surface-0)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Predicted Target</div>
                <div className="text-2xl font-mono text-primary">{matchingRule.targetModel}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Triggered by Priority {matchingRule.priority}</div>
                <div className="text-sm text-[var(--color-text-primary)] italic">"{matchingRule.name}"</div>
              </div>
            </div>
          ) : (
            <div className="mt-8 p-6 bg-rose-400/5 border border-rose-400/10 rounded-xl text-center">
              <span className="text-rose-400 text-sm">No rules match these parameters. System will fail open or use default.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
