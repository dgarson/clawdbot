import React, { useMemo, useState } from "react";
import { Workflow } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { AlertFilterPillGroup } from "../components/alerts/AlertFilters";
import { AlertRuleCard } from "../components/alerts/AlertRuleCard";
import { AlertRuleGroupSection } from "../components/alerts/AlertRuleGroupSection";
import { AlertSlideoutPanel } from "../components/alerts/AlertSlideoutPanel";

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
  routing: "bg-primary/20 text-primary border-primary/30",
  escalation: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "rate-limit": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  access: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  notification: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

const CATEGORY_GROUP_DECORATION: Record<Category, { surface: string; border: string; dot: string }> = {
  routing: { surface: "bg-primary/5", border: "border-primary/25", dot: "bg-primary" },
  escalation: { surface: "bg-rose-500/5", border: "border-rose-500/25", dot: "bg-rose-400" },
  "rate-limit": { surface: "bg-amber-500/5", border: "border-amber-500/25", dot: "bg-amber-400" },
  access: { surface: "bg-emerald-500/5", border: "border-emerald-500/25", dot: "bg-emerald-400" },
  notification: { surface: "bg-sky-500/5", border: "border-sky-500/25", dot: "bg-sky-400" },
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

function priorityColor(priority: number): string {
  if (priority >= 9) {return "text-rose-400 bg-rose-500/15";}
  if (priority >= 7) {return "text-amber-400 bg-amber-500/15";}
  if (priority >= 4) {return "text-primary bg-primary/15";}
  return "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/40";
}

function evaluateCondition(cond: Condition, payload: Record<string, unknown>): boolean {
  const raw = payload[cond.field];
  const val = cond.value;
  const stringValue = typeof raw === "string" ? raw : raw == null ? "null" : JSON.stringify(raw);
  if (cond.operator === "==") {return stringValue === val;}
  if (cond.operator === "!=") {return stringValue !== val;}
  if (cond.operator === ">") {return Number(raw) > Number(val);}
  if (cond.operator === "<") {return Number(raw) < Number(val);}
  if (cond.operator === ">=") {return Number(raw) >= Number(val);}
  if (cond.operator === "<=") {return Number(raw) <= Number(val);}
  if (cond.operator === "contains") {return stringValue.includes(val);}
  if (cond.operator === "not_contains") {return !stringValue.includes(val);}
  if (cond.operator === "in") {return val.split(",").includes(stringValue);}
  if (cond.operator === "not_in") {return !val.split(",").includes(String(raw));}
  return false;
}

export default function RuleEngine() {
  const [rules, setRules] = useState<Rule[]>(SEED_RULES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [testerOpen, setTesterOpen] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "cost_per_token": 0.02\n}');
  const [testResults, setTestResults] = useState<Map<string, boolean> | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<Category, boolean>>({
    routing: true,
    escalation: true,
    "rate-limit": true,
    access: true,
    notification: true,
  });

  const selected = rules.find((rule) => rule.id === selectedId) ?? null;
  const quickView = rules.find((rule) => rule.id === quickViewId) ?? null;

  const filtered = useMemo(
    () => categoryFilter === "all" ? rules : rules.filter((rule) => rule.category === categoryFilter),
    [rules, categoryFilter]
  );

  const groupedRules = useMemo(() => {
    const groups: Record<Category, Rule[]> = {
      routing: [],
      escalation: [],
      "rate-limit": [],
      access: [],
      notification: [],
    };
    for (const rule of filtered) {
      groups[rule.category].push(rule);
    }
    return groups;
  }, [filtered]);

  const activeCount = rules.filter((rule) => rule.enabled).length;
  const totalMatches = rules.reduce((sum, rule) => sum + rule.matchHistory.reduce((a, b) => a + b, 0), 0);
  const categoryTotals = CATEGORIES.map((category) => ({ category, count: rules.filter((rule) => rule.category === category).length }));
  const topCategory = categoryTotals.toSorted((a, b) => b.count - a.count)[0]?.category ?? "routing";

  const toggleEnabled = (id: string) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    if (selectedId === id) {setSelectedId(null);}
    if (quickViewId === id) {setQuickViewId(null);}
  };

  const runTest = () => {
    if (!selected) {return;}
    try {
      const payload = JSON.parse(testPayload) as Record<string, unknown>;
      const results = new Map<string, boolean>();
      selected.conditions.forEach((condition) => {
        results.set(`${condition.field} ${condition.operator} ${condition.value}`, evaluateCondition(condition, payload));
      });
      setTestResults(results);
    } catch {
      setTestResults(null);
    }
  };

  const maxBar = selected ? Math.max(...selected.matchHistory, 1) : 1;
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Rule Engine</h1>
        <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium">
          + New Rule
        </button>
      </div>

      <div className="mb-5">
        <AlertFilterPillGroup
          label="Category"
          value={categoryFilter}
          onChange={(next) => setCategoryFilter(next as Category | "all")}
          options={[
            { value: "all", label: "All" },
            ...CATEGORIES.map((category) => ({ value: category, label: category })),
          ]}
        />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Rules", value: String(rules.length) },
          { label: "Active", value: String(activeCount) },
          { label: "Top Category", value: topCategory },
          { label: "Matches (7d)", value: totalMatches.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-4 py-3">
            <div className="text-[var(--color-text-muted)] text-xs mb-1">{stat.label}</div>
            <div className="text-lg font-semibold capitalize">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="w-[55%] space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {CATEGORIES.map((category) => {
            const categoryRules = groupedRules[category];
            if (categoryRules.length === 0) {return null;}
            const style = CATEGORY_GROUP_DECORATION[category];
            return (
              <AlertRuleGroupSection
                key={category}
                title={category}
                count={categoryRules.length}
                activeCount={categoryRules.filter((rule) => rule.enabled).length}
                expanded={expandedGroups[category]}
                onToggle={() => setExpandedGroups((prev) => ({ ...prev, [category]: !prev[category] }))}
                className={cn(style.surface, style.border)}
                dotClassName={style.dot}
              >
                {categoryRules.map((rule) => (
                  <AlertRuleCard
                    key={rule.id}
                    title={rule.name}
                    titleBadges={(
                      <>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", CATEGORY_COLORS[rule.category])}>
                          {rule.category}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded font-mono", priorityColor(rule.priority))}>
                          P{rule.priority}
                        </span>
                        {!rule.enabled ? (
                          <span className="text-[10px] px-2 py-0.5 rounded border border-tok-border text-fg-muted uppercase">disabled</span>
                        ) : null}
                      </>
                    )}
                    description={rule.description}
                    targets={rule.conditions.slice(0, 3).map((condition) => `${condition.field} ${condition.operator} ${condition.value}`)}
                    stats={[
                      { label: "Matches", value: rule.matchCount.toLocaleString() },
                      { label: "7d Peak", value: String(Math.max(...rule.matchHistory, 0)) },
                    ]}
                    className={cn(selectedId === rule.id ? "ring-1 ring-indigo-500/30 border-primary/40" : "")}
                    onClick={() => {
                      setSelectedId(rule.id);
                      setTestResults(null);
                    }}
                    headerActions={(
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleEnabled(rule.id);
                          }}
                          className={cn(
                            "rounded-md border px-2 py-1 text-[11px]",
                            rule.enabled
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              : "border-tok-border bg-surface-2 text-fg-muted"
                          )}
                        >
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setQuickViewId(rule.id);
                          }}
                          className="rounded-md border border-tok-border bg-surface-2 px-2 py-1 text-[11px] text-fg-secondary hover:text-fg-primary"
                        >
                          Quick view
                        </button>
                      </div>
                    )}
                    footerActions={
                      rule.conditions.length > 3
                        ? [<span key="more" className="text-[11px] text-fg-muted">+{rule.conditions.length - 3} more conditions</span>]
                        : undefined
                    }
                  />
                ))}
              </AlertRuleGroupSection>
            );
          })}

          {filtered.length === 0 ? (
            <ContextualEmptyState
              icon={Workflow}
              title="No rules match this filter"
              description="Adjust your filter criteria or create a new rule to automate workflows."
              size="sm"
            />
          ) : null}
        </div>

        <div className="w-[45%] max-h-[calc(100vh-280px)] overflow-y-auto">
          {selected ? (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", CATEGORY_COLORS[selected.category])}>
                    {selected.category}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">{selected.description}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Conditions</h3>
                <div className="border border-[var(--color-border)] rounded overflow-hidden">
                  <div className="grid grid-cols-3 gap-px bg-[var(--color-surface-2)] text-xs font-medium text-[var(--color-text-muted)]">
                    <div className="bg-[var(--color-surface-1)] px-3 py-2">Field</div>
                    <div className="bg-[var(--color-surface-1)] px-3 py-2">Operator</div>
                    <div className="bg-[var(--color-surface-1)] px-3 py-2">Value</div>
                  </div>
                  {selected.conditions.map((condition, index) => (
                    <div key={index} className="grid grid-cols-3 gap-px bg-[var(--color-surface-2)] text-sm">
                      <div className="bg-[var(--color-surface-1)] px-3 py-2 font-mono text-primary">{condition.field}</div>
                      <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[var(--color-text-primary)]">{OPERATOR_LABELS[condition.operator]}</div>
                      <div className="bg-[var(--color-surface-1)] px-3 py-2 font-mono text-amber-400">{condition.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Action</h3>
                <div className="flex items-center gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-3 py-2 text-sm">
                  <span className="text-[var(--color-text-muted)]">-&gt;</span>
                  <span className="text-emerald-400 font-medium">{selected.action}</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Match History (7 days)</h3>
                <div className="flex items-end gap-1.5 h-24 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-3">
                  {selected.matchHistory.map((count, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] text-[var(--color-text-muted)]">{count}</span>
                      <div className="w-full bg-primary rounded-sm min-h-[2px] transition-all" style={{ height: `${(count / maxBar) * 100}%` }} />
                      <span className="text-[10px] text-[var(--color-text-muted)]">{dayLabels[index]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className={cn("px-2 py-0.5 rounded font-mono text-xs", priorityColor(selected.priority))}>Priority {selected.priority}</span>
                <span className="text-[var(--color-text-muted)]">{selected.matchCount.toLocaleString()} total matches</span>
                <span className="text-[var(--color-text-muted)] text-xs">Last: {new Date(selected.lastMatched).toLocaleString()}</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => toggleEnabled(selected.id)}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm font-medium",
                    selected.enabled
                      ? "bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]"
                      : "bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)]"
                  )}
                >
                  {selected.enabled ? "Disable" : "Enable"}
                </button>
                <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm">Edit</button>
                <button
                  onClick={() => deleteRule(selected.id)}
                  className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded text-sm"
                >
                  Delete
                </button>
              </div>

              <div className="border-t border-[var(--color-border)] pt-4">
                <button
                  onClick={() => setTesterOpen(!testerOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <span className={cn("inline-block transition-transform text-xs", testerOpen && "rotate-90")}>
                    &gt;
                  </span>
                  Rule Tester
                </button>
                {testerOpen ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={testPayload}
                      onChange={(event) => setTestPayload(event.target.value)}
                      rows={5}
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded px-3 py-2 text-sm font-mono resize-y"
                      placeholder='{"field": "value"}'
                    />
                    <button
                      onClick={runTest}
                      className="bg-primary hover:bg-primary text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium"
                    >
                      Test Rule
                    </button>
                    {testResults ? (
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
                            <span className="font-bold">{pass ? "yes" : "no"}</span>
                            <span className="font-mono text-xs">{key}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-12 text-center">
              <div className="text-[var(--color-text-muted)] text-3xl mb-3">CFG</div>
              <div className="text-[var(--color-text-muted)] text-sm">Select a rule to view details</div>
            </div>
          )}
        </div>
      </div>

      <AlertSlideoutPanel
        open={quickView !== null}
        onClose={() => setQuickViewId(null)}
        title={quickView?.name ?? "Rule"}
        subtitle={quickView ? `${quickView.category} · priority ${quickView.priority}` : undefined}
      >
        {quickView ? (
          <div className="space-y-3 text-xs text-fg-secondary">
            <p className="text-fg-primary">{quickView.description}</p>
            <div className="rounded-lg border border-tok-border bg-surface-1 p-2">
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">Action</p>
              <p className="mt-1 text-emerald-300">{quickView.action}</p>
            </div>
            <div className="space-y-1.5">
              {quickView.conditions.map((condition, index) => (
                <div key={`${condition.field}-${index}`} className="rounded-md border border-tok-border bg-surface-1 px-2 py-1 font-mono text-[11px]">
                  {condition.field} {condition.operator} {condition.value}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </AlertSlideoutPanel>
    </div>
  );
}
