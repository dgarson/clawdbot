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
  "task-complexity": "bg-violet-400/10 text-violet-400 border-violet-400/20",
  "agent": "bg-indigo-400/10 text-indigo-400 border-indigo-400/20",
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
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === rules.length - 1)) return;

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];

    // Re-assign priorities based on new order (simplification for UI)
    const updated = newRules.map((r, i) => ({ ...r, priority: i + 1 }));
    setRules(updated);
  };

  const findMatchingRule = () => {
    const activeRules = rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      if (rule.conditions.length === 0) return rule; // Default fallback

      const matches = rule.conditions.every(cond => {
        switch (cond.kind) {
          case 'token-budget':
            return cond.op === 'lt' ? testTokens < (cond.value as number) : testTokens > (cond.value as number);
          case 'task-complexity':
            return cond.op === 'lt' ? testComplexity < (cond.value as number) : testComplexity > (cond.value as number);
          case 'agent':
            if (cond.op === 'eq') return testAgent === cond.value;
            if (cond.op === 'in') return (cond.value as string).split(',').includes(testAgent);
            return false;
          case 'time-of-day':
            return cond.op === 'lt' ? testTime < (cond.value as number) : testTime > (cond.value as number);
          case 'keyword':
            return testKeyword.toLowerCase().includes((cond.value as string).toLowerCase());
          default:
            return false;
        }
      });

      if (matches) return rule;
    }
    return null;
  };

  const matchingRule = findMatchingRule();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Model Router</h1>
          <p className="text-zinc-400 mt-2">Intelligent orchestration and conditional LLM routing.</p>
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
                    ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80"
                )}
              >
                <div className="text-2xl mb-3">{data.icon}</div>
                <h3 className={cn("font-semibold mb-1", strategy === key ? "text-indigo-400" : "text-zinc-200")}>
                  {data.title}
                </h3>
                <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {data.desc}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Rules Table */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 w-16">Ord</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Rule Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Conditions</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Target Model</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Hits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rules.map((rule, idx) => (
                  <React.Fragment key={rule.id}>
                    <tr
                      className={cn(
                        "group hover:bg-zinc-800/30 transition-colors cursor-pointer",
                        !rule.enabled && "opacity-60",
                        expandedRule === rule.id && "bg-zinc-800/50"
                      )}
                      onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRule(rule.id, 'up'); }}
                            className="p-1 hover:text-indigo-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRule(rule.id, 'down'); }}
                            className="p-1 hover:text-indigo-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-zinc-200">{rule.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Priority {rule.priority}</div>
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
                            <span className="text-zinc-600 text-xs italic">No conditions</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
                            {rule.targetModel}
                          </code>
                          {rule.fallbackModel && (
                            <>
                              <span className="text-zinc-600 text-xs">→</span>
                              <code className="text-[10px] px-1.5 py-0.5 bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-500">
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
                            rule.enabled ? "bg-indigo-600" : "bg-zinc-700"
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
                        <div className="text-sm font-mono text-zinc-400">{rule.hitCount.toLocaleString()}</div>
                      </td>
                    </tr>
                    {expandedRule === rule.id && (
                      <tr>
                        <td colSpan={6} className="px-12 py-6 bg-zinc-900/80 border-b border-zinc-800">
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Description</label>
                              <textarea
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 focus:border-indigo-500 outline-none h-24 resize-none"
                                defaultValue={rule.description}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Active Conditions</label>
                              <div className="space-y-2">
                                {rule.conditions.map((c, ci) => (
                                  <div key={ci} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                                    <span className="text-zinc-400 uppercase font-mono tracking-tight">{c.kind}</span>
                                    <span className="text-zinc-200">{c.op} <span className="text-indigo-400 font-bold">{c.value}</span></span>
                                  </div>
                                ))}
                                <button className="w-full py-2 border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-all">
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
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold">Route Test</h2>
              <p className="text-zinc-500 text-sm">Simulate input to verify routing logic.</p>
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
              <label className="text-xs font-bold uppercase text-zinc-500">Agent</label>
              <input
                type="text"
                value={testAgent}
                onChange={(e) => setTestAgent(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Token Count</label>
              <input
                type="number"
                value={testTokens}
                onChange={(e) => setTestTokens(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Complexity (1-10)</label>
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
              <label className="text-xs font-bold uppercase text-zinc-500">Time (0-23)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={testTime}
                onChange={(e) => setTestTime(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Keyword</label>
              <input
                type="text"
                placeholder="Search prompt..."
                value={testKeyword}
                onChange={(e) => setTestKeyword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {matchingRule ? (
            <div className="mt-8 p-6 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase text-zinc-500">Predicted Target</div>
                <div className="text-2xl font-mono text-indigo-400">{matchingRule.targetModel}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-1">Triggered by Priority {matchingRule.priority}</div>
                <div className="text-sm text-zinc-300 italic">"{matchingRule.name}"</div>
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
