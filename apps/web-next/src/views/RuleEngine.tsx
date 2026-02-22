import React, { useState } from "react";
import { cn } from "../lib/utils";

type Category = "routing" | "escalation" | "rate-limit" | "access" | "notification";
type Operator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "not_contains" | "in" | "not_in";

interface Condition {
  field: string;
  operator: Operator;
  value: string;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  category: Category;
  priority: number;
  enabled: boolean;
  conditions: Condition[];
  action: string;
  matchCount: number;
  lastMatched: string;
  matchHistory: number[];
}

const CATEGORIES: Category[] = ["routing", "escalation", "rate-limit", "access", "notification"];

const CATEGORY_COLORS: Record<Category, string> = {
  routing: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  escalation: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "rate-limit": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  access: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  notification: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

const OPERATOR_LABELS: Record<Operator, string> = {
  "==": "equals", "!=": "not equals", ">": "greater than", "<": "less than",
  ">=": "at least", "<=": "at most", contains: "contains",
  not_contains: "not contains", in: "in", not_in: "not in",
};

const SEED_RULES: Rule[] = [
  { id: "r1", name: "Route High Cost", description: "Routes expensive token requests to the budget-friendly model to control spend.", category: "routing", priority: 8, enabled: true, conditions: [{ field: "cost_per_token", operator: ">", value: "0.01" }], action: "route to budget model", matchCount: 1842, lastMatched: "2026-02-22T01:12:00Z", matchHistory: [240, 310, 275, 198, 260, 320, 239] },
  { id: "r2", name: "Escalate Critical", description: "Pages the on-call engineer when critical errors persist after multiple retries.", category: "escalation", priority: 10, enabled: true, conditions: [{ field: "error_severity", operator: "==", value: "critical" }, { field: "retry_count", operator: ">", value: "3" }], action: "page on-call", matchCount: 47, lastMatched: "2026-02-21T22:45:00Z", matchHistory: [5, 8, 3, 12, 7, 6, 6] },
  { id: "r3", name: "Rate Limit Burst", description: "Throttles clients exceeding 100 requests per minute to protect service stability.", category: "rate-limit", priority: 9, enabled: true, conditions: [{ field: "requests_per_min", operator: ">", value: "100" }], action: "throttle", matchCount: 3291, lastMatched: "2026-02-22T02:30:00Z", matchHistory: [420, 510, 480, 390, 475, 520, 496] },
  { id: "r4", name: "Block Unauthorized", description: "Rejects any request missing a valid authentication token.", category: "access", priority: 10, enabled: true, conditions: [{ field: "auth_token", operator: "==", value: "null" }], action: "reject", matchCount: 892, lastMatched: "2026-02-22T02:10:00Z", matchHistory: [110, 135, 128, 140, 125, 130, 124] },
  { id: "r5", name: "Notify on Success", description: "Sends a summary notification when long-running tasks complete successfully.", category: "notification", priority: 5, enabled: true, conditions: [{ field: "task_status", operator: "==", value: "completed" }, { field: "task_duration", operator: ">", value: "300" }], action: "send summary", matchCount: 614, lastMatched: "2026-02-22T00:55:00Z", matchHistory: [78, 95, 82, 90, 88, 92, 89] },
  { id: "r6", name: "Route EU Traffic", description: "Ensures EU-originating requests are handled by EU-region endpoints for GDPR compliance.", category: "routing", priority: 7, enabled: true, conditions: [{ field: "region", operator: "in", value: "eu-west-1,eu-central-1" }, { field: "data_class", operator: "==", value: "personal" }], action: "route to EU endpoint", matchCount: 2105, lastMatched: "2026-02-22T02:25:00Z", matchHistory: [280, 305, 290, 310, 295, 315, 310] },
  { id: "r7", name: "Escalate Latency Spike", description: "Alerts the platform team when p99 latency exceeds 5 seconds.", category: "escalation", priority: 8, enabled: false, conditions: [{ field: "p99_latency_ms", operator: ">", value: "5000" }], action: "alert platform team", matchCount: 23, lastMatched: "2026-02-19T14:20:00Z", matchHistory: [0, 2, 8, 5, 4, 3, 1] },
  { id: "r8", name: "Block Deprecated API", description: "Rejects calls to deprecated v1 API endpoints, forcing migration to v2.", category: "access", priority: 6, enabled: true, conditions: [{ field: "api_version", operator: "==", value: "v1" }, { field: "endpoint", operator: "contains", value: "/legacy" }], action: "reject with 410", matchCount: 156, lastMatched: "2026-02-21T18:00:00Z", matchHistory: [30, 25, 22, 20, 24, 18, 17] },
  { id: "r9", name: "Rate Limit New Accounts", description: "Applies stricter rate limits to accounts created within the last 24 hours.", category: "rate-limit", priority: 7, enabled: true, conditions: [{ field: "account_age_hours", operator: "<", value: "24" }, { field: "requests_per_min", operator: ">", value: "30" }], action: "throttle to 30 rpm", matchCount: 437, lastMatched: "2026-02-22T01:50:00Z", matchHistory: [55, 68, 60, 72, 58, 65, 59] },
  { id: "r10", name: "Notify Quota Warning", description: "Warns account owners when their usage reaches 80% of their allocated quota.", category: "notification", priority: 4, enabled: true, conditions: [{ field: "quota_usage_pct", operator: ">=", value: "80" }, { field: "notification_sent", operator: "==", value: "false" }], action: "send quota warning email", matchCount: 289, lastMatched: "2026-02-21T20:30:00Z", matchHistory: [35, 42, 38, 45, 40, 48, 41] },
];

function priorityColor(p: number): string {
  if (p >= 9) {return "text-rose-400 bg-rose-500/15";}
  if (p >= 7) {return "text-amber-400 bg-amber-500/15";}
  if (p >= 4) {return "text-indigo-400 bg-indigo-500/15";}
  return "text-zinc-400 bg-zinc-700/40";
}

function evaluateCondition(cond: Condition, payload: Record<string, unknown>): boolean {
  const raw = payload[cond.field];
  const val = cond.value;
  const stringValue = typeof raw === "string" ? raw : raw == null ? "null" : JSON.stringify(raw);
  if (cond.operator === "==" ) {return stringValue === val;}
  if (cond.operator === "!=" ) {return stringValue !== val;}
  if (cond.operator === ">"  ) {return Number(raw) > Number(val);}
  if (cond.operator === "<"  ) {return Number(raw) < Number(val);}
  if (cond.operator === ">=" ) {return Number(raw) >= Number(val);}
  if (cond.operator === "<=" ) {return Number(raw) <= Number(val);}
  if (cond.operator === "contains") {return stringValue.includes(val);}
  if (cond.operator === "not_contains") {return !stringValue.includes(val);}
  if (cond.operator === "in") {return val.split(",").includes(stringValue);}
  if (cond.operator === "not_in") {return !val.split(",").includes(String(raw));}
  return false;
}

export default function RuleEngine() {
  const [rules, setRules] = useState<Rule[]>(SEED_RULES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);
  const [testerOpen, setTesterOpen] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "cost_per_token": 0.02\n}');
  const [testResults, setTestResults] = useState<Map<string, boolean> | null>(null);

  const filtered = categoryFilter ? rules.filter((r) => r.category === categoryFilter) : rules;
  const selected = rules.find((r) => r.id === selectedId) ?? null;

  const activeCount = rules.filter((r) => r.enabled).length;
  const totalMatches = rules.reduce((s, r) => s + r.matchHistory.reduce((a, b) => a + b, 0), 0);
  const categoryTotals = CATEGORIES.map((c) => ({ c, n: rules.filter((r) => r.category === c).length }));
  const topCategory = categoryTotals.toSorted((a, b) => b.n - a.n)[0]?.c ?? "routing";

  const toggleEnabled = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) {setSelectedId(null);}
  };

  const runTest = () => {
    if (!selected) {return;}
    try {
      const payload = JSON.parse(testPayload) as Record<string, unknown>;
      const results = new Map<string, boolean>();
      selected.conditions.forEach((c) => {
        results.set(`${c.field} ${c.operator} ${c.value}`, evaluateCondition(c, payload));
      });
      setTestResults(results);
    } catch {
      setTestResults(null);
    }
  };

  const maxBar = selected ? Math.max(...selected.matchHistory, 1) : 1;
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Rule Engine</h1>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm font-medium">
          + New Rule
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            categoryFilter === null
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize",
              categoryFilter === cat
                ? CATEGORY_COLORS[cat]
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Rules", value: String(rules.length) },
          { label: "Active", value: String(activeCount) },
          { label: "Top Category", value: topCategory },
          { label: "Matches (7d)", value: totalMatches.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
            <div className="text-zinc-500 text-xs mb-1">{s.label}</div>
            <div className="text-lg font-semibold capitalize">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-4">
        {/* Rule list — left 55% */}
        <div className="w-[55%] space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filtered.map((rule) => (
            <button
              key={rule.id}
              onClick={() => { setSelectedId(rule.id); setTestResults(null); }}
              className={cn(
                "w-full text-left bg-zinc-900 border rounded-lg px-4 py-3 transition-colors",
                selectedId === rule.id
                  ? "border-indigo-500 ring-1 ring-indigo-500/30"
                  : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{rule.name}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", CATEGORY_COLORS[rule.category])}>
                    {rule.category}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded font-mono", priorityColor(rule.priority))}>
                    P{rule.priority}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {rule.conditions.slice(0, 2).map((c, i) => (
                  <span key={i} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                    {c.field} {c.operator} {c.value}
                  </span>
                ))}
                {rule.conditions.length > 2 && (
                  <span className="text-xs text-zinc-500">+{rule.conditions.length - 2} more</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">→ {rule.action}</span>
                  <span className="text-xs text-zinc-500">{rule.matchCount.toLocaleString()} matches</span>
                </div>
                <div
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={(e) => { e.stopPropagation(); toggleEnabled(rule.id); }}
                  className={cn(
                    "w-8 h-4 rounded-full relative cursor-pointer transition-colors",
                    rule.enabled ? "bg-emerald-500" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    rule.enabled ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-zinc-500 text-sm text-center py-12">No rules match this filter.</div>
          )}
        </div>

        {/* Detail panel — right 45% */}
        <div className="w-[45%] max-h-[calc(100vh-280px)] overflow-y-auto">
          {selected ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
              {/* Name + description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", CATEGORY_COLORS[selected.category])}>
                    {selected.category}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{selected.description}</p>
              </div>

              {/* Conditions table */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Conditions</h3>
                <div className="border border-zinc-800 rounded overflow-hidden">
                  <div className="grid grid-cols-3 gap-px bg-zinc-800 text-xs font-medium text-zinc-500">
                    <div className="bg-zinc-900 px-3 py-2">Field</div>
                    <div className="bg-zinc-900 px-3 py-2">Operator</div>
                    <div className="bg-zinc-900 px-3 py-2">Value</div>
                  </div>
                  {selected.conditions.map((c, i) => (
                    <div key={i} className="grid grid-cols-3 gap-px bg-zinc-800 text-sm">
                      <div className="bg-zinc-900 px-3 py-2 font-mono text-indigo-400">{c.field}</div>
                      <div className="bg-zinc-900 px-3 py-2 text-zinc-300">{OPERATOR_LABELS[c.operator]}</div>
                      <div className="bg-zinc-900 px-3 py-2 font-mono text-amber-400">{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Action</h3>
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
                  <span className="text-zinc-500">→</span>
                  <span className="text-emerald-400 font-medium">{selected.action}</span>
                </div>
              </div>

              {/* Match history bar chart */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Match History (7 days)
                </h3>
                <div className="flex items-end gap-1.5 h-24 bg-zinc-800 border border-zinc-700 rounded p-3">
                  {selected.matchHistory.map((count, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] text-zinc-500">{count}</span>
                      <div
                        className="w-full bg-indigo-500 rounded-sm min-h-[2px] transition-all"
                        style={{ height: `${(count / maxBar) * 100}%` }}
                      />
                      <span className="text-[10px] text-zinc-600">{dayLabels[i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority + meta */}
              <div className="flex items-center gap-4 text-sm">
                <span className={cn("px-2 py-0.5 rounded font-mono text-xs", priorityColor(selected.priority))}>
                  Priority {selected.priority}
                </span>
                <span className="text-zinc-500">{selected.matchCount.toLocaleString()} total matches</span>
                <span className="text-zinc-600 text-xs">Last: {new Date(selected.lastMatched).toLocaleString()}</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => toggleEnabled(selected.id)}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm font-medium",
                    selected.enabled
                      ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  )}
                >
                  {selected.enabled ? "Disable" : "Enable"}
                </button>
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm">
                  Edit
                </button>
                <button
                  onClick={() => deleteRule(selected.id)}
                  className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded text-sm"
                >
                  Delete
                </button>
              </div>

              {/* Rule Tester — collapsible */}
              <div className="border-t border-zinc-800 pt-4">
                <button
                  onClick={() => setTesterOpen(!testerOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  <span className={cn("inline-block transition-transform text-xs", testerOpen && "rotate-90")}>
                    ▶
                  </span>
                  Rule Tester
                </button>
                {testerOpen && (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      rows={5}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm font-mono resize-y"
                      placeholder='{"field": "value"}'
                    />
                    <button
                      onClick={runTest}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm font-medium"
                    >
                      Test Rule
                    </button>
                    {testResults && (
                      <div className="space-y-1.5">
                        {Array.from(testResults.entries()).map(([key, pass]) => (
                          <div
                            key={key}
                            className={cn(
                              "flex items-center gap-2 text-sm px-3 py-1.5 rounded border",
                              pass
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            )}
                          >
                            <span className="font-bold">{pass ? "✓" : "✗"}</span>
                            <span className="font-mono text-xs">{key}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <div className="text-zinc-600 text-3xl mb-3">⚙</div>
              <div className="text-zinc-500 text-sm">Select a rule to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
