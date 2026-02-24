import { useMemo, useState } from "react";

type TailMode = "routing" | "tools" | "self-eval";
type LogSeverity = "info" | "warn" | "error";
type RunbookStatus = "healthy" | "watch" | "critical";
type RiskLevel = "low" | "medium" | "high";

interface JournalEvent {
  id: string;
  mode: TailMode;
  at: string;
  severity: LogSeverity;
  agent: string;
  summary: string;
  details: string;
}

interface RunbookAction {
  id: string;
  title: string;
  owner: string;
  eta: string;
  status: RunbookStatus;
}

interface SelfEvalRecommendation {
  id: string;
  title: string;
  confidence: number;
  expectedGain: string;
  risk: RiskLevel;
}

interface IncidentTimelineItem {
  id: string;
  startedAt: string;
  service: string;
  title: string;
  summary: string;
  impact: string;
  actions: string[];
}

const modelStats = [
  { model: "gpt-5.2-codex", provider: "openai", req: 1288, p95: 840, cost: 188.22, errorRate: 0.8 },
  { model: "claude-sonnet-4.5", provider: "anthropic", req: 963, p95: 1210, cost: 224.41, errorRate: 1.3 },
  { model: "gemini-2.0-pro", provider: "google", req: 514, p95: 998, cost: 71.6, errorRate: 0.6 },
];

const toolStats = [
  { name: "exec_command", calls: 744, success: 97.9, avgMs: 460, reason: "Stateful shell ops + deterministic retries" },
  { name: "read_mcp_resource", calls: 429, success: 99.1, avgMs: 180, reason: "Low-risk retrieval + grounded references" },
  { name: "run_playwright_script", calls: 88, success: 93.4, avgMs: 3900, reason: "UI validation + screenshot evidence" },
  { name: "make_pr", calls: 116, success: 100, avgMs: 210, reason: "Atomic PR metadata handoff" },
];

const journalEvents: JournalEvent[] = [
  { id: "j1", mode: "routing", at: "11:42:16", severity: "info", agent: "router", summary: "Escalated ticket to multi-agent mode", details: "confidence=0.94 · rationale: high fan-out dependency graph" },
  { id: "j2", mode: "tools", at: "11:42:34", severity: "warn", agent: "operator", summary: "write_stdin retry loop hit threshold", details: "session=1902 · fallback=restart sandbox shell" },
  { id: "j3", mode: "self-eval", at: "11:43:03", severity: "info", agent: "evaluator", summary: "Routing prompt patch proposed", details: "expected win: -14% tool over-calls in observability flows" },
  { id: "j4", mode: "tools", at: "11:43:21", severity: "error", agent: "builder", summary: "Playwright screenshot failed", details: "browser context crashed · auto-opened recovery action" },
  { id: "j5", mode: "routing", at: "11:44:03", severity: "warn", agent: "router", summary: "Fallback provider selected", details: "route=openai->anthropic · cause=latency spike p95 +18%" },
  { id: "j6", mode: "self-eval", at: "11:44:55", severity: "info", agent: "evaluator", summary: "Prompt rubric update queued", details: "reduces over-calling browser tools in diagnostics flows" },
];

const smartActions = [
  "Generate incident summary from the last 30 minutes",
  "Propose budget guardrails for over-spending models",
  "Autofix route drift by applying top self-eval recommendation",
  "Draft operator handoff with risks and unresolved alerts",
];

const runbookActions: RunbookAction[] = [
  { id: "r1", title: "Gateway queue saturation watch", owner: "Ops", eta: "Now", status: "watch" },
  { id: "r2", title: "Provider failover policy check", owner: "Routing", eta: "15m", status: "healthy" },
  { id: "r3", title: "Tool timeout triage", owner: "Platform", eta: "5m", status: "critical" },
];

const selfEvalRecommendations: SelfEvalRecommendation[] = [
  { id: "s1", title: "Lower browser-tool trigger sensitivity on health-only probes", confidence: 0.93, expectedGain: "-11% tool calls", risk: "low" },
  { id: "s2", title: "Prefer cached routing memory for recurring budget alerts", confidence: 0.89, expectedGain: "-180ms p95", risk: "low" },
  { id: "s3", title: "Raise escalation threshold for low-blast-radius incidents", confidence: 0.74, expectedGain: "-22% false escalations", risk: "medium" },
];

const incidentTimeline: IncidentTimelineItem[] = [
  {
    id: "inc-1",
    startedAt: "11:43",
    service: "routing",
    title: "Provider latency spike",
    summary: "p95 crossed failover threshold for 4 minutes",
    impact: "5% of requests delayed >2s",
    actions: ["Shift 30% traffic to anthropic", "Raise queue timeout from 4s to 6s", "Page on-call if p95 > 1500ms for 3m"],
  },
  {
    id: "inc-2",
    startedAt: "10:18",
    service: "tools",
    title: "Browser task instability",
    summary: "Intermittent playwright context teardown",
    impact: "Screenshot checks retried 2x on average",
    actions: ["Warm pool browser contexts", "Throttle concurrent browser tool invocations", "Enable fallback screenshot capture"],
  },
  {
    id: "inc-3",
    startedAt: "09:52",
    service: "self-eval",
    title: "Policy drift flagged",
    summary: "Suggestion confidence dipped below baseline",
    impact: "1 recommendation suppressed",
    actions: ["Re-score rubric on latest sessions", "Backtest against last 72h incidents", "Review manual overrides"],
  },
];

function SeverityBadge({ level }: { level: LogSeverity }) {
  const tone =
    level === "error"
      ? "bg-red-500/15 text-red-300 border-red-500/40"
      : level === "warn"
        ? "bg-amber-500/15 text-amber-200 border-amber-400/40"
        : "bg-emerald-500/15 text-emerald-200 border-emerald-500/40";

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{level}</span>;
}

function RunbookStatusPill({ status }: { status: RunbookStatus }) {
  const styles: Record<RunbookStatus, string> = {
    healthy: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
    watch: "bg-amber-500/15 text-amber-200 border-amber-400/40",
    critical: "bg-red-500/15 text-red-200 border-red-500/40",
  };

  return <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${styles[status]}`}>{status}</span>;
}

export default function OperatorDashboard() {
  const [tailMode, setTailMode] = useState<TailMode>("routing");
  const [selectedAction, setSelectedAction] = useState(smartActions[0]);
  const [temperature, setTemperature] = useState(0.3);
  const [autoRemediate, setAutoRemediate] = useState(false);
  const [providerFailover, setProviderFailover] = useState(true);
  const [pauseTail, setPauseTail] = useState(false);
  const [tailQuery, setTailQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<"all" | RiskLevel>("all");
  const [selectedIncident, setSelectedIncident] = useState<IncidentTimelineItem | null>(null);
  const [simPrimary, setSimPrimary] = useState("openai");
  const [simSecondary, setSimSecondary] = useState("anthropic");
  const [simTrafficShift, setSimTrafficShift] = useState(35);
  const [simLatencyThreshold, setSimLatencyThreshold] = useState(1200);

  const filteredEvents = useMemo(() => {
    const byMode = journalEvents.filter((event) => event.mode === tailMode);
    return byMode.filter((event) => {
      if (!tailQuery) {
        return true;
      }
      const search = tailQuery.toLowerCase();
      return `${event.summary} ${event.details} ${event.agent}`.toLowerCase().includes(search);
    });
  }, [tailMode, tailQuery]);

  const filteredRecommendations = useMemo(() => {
    if (selectedRisk === "all") {
      return selfEvalRecommendations;
    }
    return selfEvalRecommendations.filter((item) => item.risk === selectedRisk);
  }, [selectedRisk]);

  const totalModelSpend = modelStats.reduce((sum, item) => sum + item.cost, 0);
  const avgToolSuccess = toolStats.reduce((sum, item) => sum + item.success, 0) / toolStats.length;
  const totalRequests = modelStats.reduce((sum, item) => sum + item.req, 0);
  const budgetThreshold = 650;
  const projectedSpend = totalModelSpend * 1.38;
  const budgetUsage = Math.min((totalModelSpend / budgetThreshold) * 100, 100);

  const avgP95 = modelStats.reduce((sum, item) => sum + item.p95, 0) / modelStats.length;
  const shiftedRequests = Math.round((totalRequests * simTrafficShift) / 100);
  const failoverTrigger = avgP95 > simLatencyThreshold;

  const topModel = modelStats.toSorted((a, b) => b.cost - a.cost)[0];
  const anomalyState = projectedSpend > budgetThreshold ? "anomaly" : "stable";

  const dependencyEdges = [
    "Ingress API → Router",
    "Router → Model Provider",
    "Router → Tool Executor",
    "Self-eval → Routing Memory",
    "Routing Memory → Router",
  ];

  const handoffText = [
    `Operator handoff @ 11:45`,
    `- Incident focus: ${incidentTimeline[0]?.title ?? "N/A"}`,
    `- Budget status: ${anomalyState === "anomaly" ? "Projected overrun risk" : "Within threshold"}`,
    `- Tail mode in focus: ${tailMode}`,
    `- Recommended next step: ${selectedAction}`,
  ].join("\n");

  return (
    <div className="min-h-full rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-4 text-zinc-100 shadow-2xl sm:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Horizon command center</p>
          <h1 className="mt-1 text-2xl font-semibold">Operator Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Single place to monitor agent activity, tool reliability, routing decisions, and cost controls.</p>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">Live mode · refresh 5s · unified operator surface</div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Daily spend</p>
          <p className="mt-2 text-3xl font-semibold">${totalModelSpend.toFixed(2)}</p>
          <p className="mt-1 text-xs text-zinc-400">Budget usage {budgetUsage.toFixed(0)}% of threshold</p>
        </article>
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Tool success</p>
          <p className="mt-2 text-3xl font-semibold">{avgToolSuccess.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-zinc-400">Across {totalRequests.toLocaleString()} model requests today</p>
        </article>
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Self-eval queue</p>
          <p className="mt-2 text-3xl font-semibold">{selfEvalRecommendations.length} pending</p>
          <p className="mt-1 text-xs text-zinc-400">2 auto-applicable with guardrails</p>
        </article>
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Active incidents</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300">{incidentTimeline.length} tracked</p>
          <p className="mt-1 text-xs text-zinc-400">Top: {incidentTimeline[0]?.title}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Model provider utilization</h2>
            <span className="text-xs text-zinc-400">Latency + cost + errors</span>
          </div>
          <div className="space-y-3">
            {modelStats.map((item) => (
              <div key={item.model} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.model}</p>
                    <p className="text-xs text-zinc-400">{item.provider}</p>
                  </div>
                  <div className="text-xs text-zinc-300">{item.req} req</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-300">
                  <p>p95 {item.p95}ms</p>
                  <p>${item.cost.toFixed(2)}</p>
                  <p>{item.errorRate}% errors</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Budget guardrail forecast</h2>
          <p className="mb-2 text-xs text-zinc-400">Current run-rate projection and suggested controls before budget breach.</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500" style={{ width: `${budgetUsage}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300">
            <p>Threshold: ${budgetThreshold.toFixed(0)}</p>
            <p>Projected: ${projectedSpend.toFixed(2)}</p>
            <p>Current: ${totalModelSpend.toFixed(2)}</p>
            <p className={projectedSpend > budgetThreshold ? "text-red-300" : "text-emerald-300"}>{projectedSpend > budgetThreshold ? "Overrun risk" : "Within guardrail"}</p>
          </div>
          <button className="mt-3 w-full rounded-lg border border-cyan-500/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">Suggest budget policy adjustment</button>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Operator knobs</h2>
          <div className="space-y-4 text-sm">
            <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">Provider failover<input type="checkbox" checked={providerFailover} onChange={(e) => setProviderFailover(e.target.checked)} /></label>
            <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">Auto-remediate safe fixes<input type="checkbox" checked={autoRemediate} onChange={(e) => setAutoRemediate(e.target.checked)} /></label>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400"><span>Assistant temperature</span><span>{temperature.toFixed(1)}</span></div>
              <input className="w-full" type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
            </div>
            <button className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-zinc-950 hover:bg-cyan-400">Apply knobs to gateway</button>
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Runbook quick actions</h2>
          <div className="space-y-2">
            {runbookActions.map((runbook) => (
              <div key={runbook.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{runbook.title}</p><RunbookStatusPill status={runbook.status} /></div>
                <p className="mt-1 text-xs text-zinc-400">Owner: {runbook.owner} · ETA: {runbook.eta}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Specialized event viewers (tail)</h2>
            <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-1">
              {(["routing", "tools", "self-eval"] as TailMode[]).map((mode) => (
                <button key={mode} onClick={() => setTailMode(mode)} className={`rounded-md px-2 py-1 text-xs capitalize ${tailMode === mode ? "bg-cyan-500 text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`}>{mode}</button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" placeholder="Filter tail by agent / summary / details" value={tailQuery} onChange={(e) => setTailQuery(e.target.value)} />
            <button onClick={() => setPauseTail((prev) => !prev)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800">{pauseTail ? "Resume tail" : "Pause tail"}</button>
          </div>
          {!filteredEvents.length && <p className="text-xs text-zinc-500">No events match this filter.</p>}
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{event.summary}</p><SeverityBadge level={event.severity} /></div>
                <p className="text-xs text-zinc-400">{event.at} · {event.agent}</p>
                <p className="mt-1 text-xs text-zinc-300">{event.details}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">AI copilot smart actions</h2>
          <p className="mb-3 text-xs text-zinc-400">Use LLM assistance for summaries, suggested remediations, and one-click operator actions.</p>
          <select className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
            {smartActions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <textarea className="h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={`Execute: ${selectedAction}\n\nContext:\n- include current ${tailMode} stream\n- include top 3 spend drivers\n- include suggested risk score`} readOnly />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Preview plan</button>
            <button className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400">Run action</button>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-semibold">Tool reliability and decision provenance</h2>
          <p className="mb-3 text-xs text-zinc-400">Correlates tool outcomes with routing rationale and confidence.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th className="px-2 py-2">Tool</th><th className="px-2 py-2">Calls</th><th className="px-2 py-2">Success</th><th className="px-2 py-2">Avg duration</th><th className="px-2 py-2">Top routing reason</th></tr></thead>
              <tbody>
                {toolStats.map((tool) => (
                  <tr key={tool.name} className="border-t border-zinc-800/90"><td className="px-2 py-2 font-medium">{tool.name}</td><td className="px-2 py-2">{tool.calls}</td><td className="px-2 py-2">{tool.success}%</td><td className="px-2 py-2">{tool.avgMs}ms</td><td className="px-2 py-2 text-zinc-400">{tool.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Self-eval recommendation queue</h2>
            <select className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" value={selectedRisk} onChange={(e) => setSelectedRisk(e.target.value as "all" | RiskLevel)}>
              <option value="all">All risks</option><option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option>
            </select>
          </div>
          <div className="space-y-2">
            {filteredRecommendations.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-sm font-medium">{rec.title}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-400"><span>Confidence {(rec.confidence * 100).toFixed(0)}%</span><span>Expected gain {rec.expectedGain}</span><span className="capitalize">Risk {rec.risk}</span></div>
                <div className="mt-2 flex gap-2"><button className="rounded-md border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10">Apply</button><button className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">Inspect</button><button className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">Dismiss</button></div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Incident timeline drilldown</h2>
            <span className="text-xs text-zinc-500">Click a row for context</span>
          </div>
          <div className="space-y-2">
            {incidentTimeline.map((incident) => (
              <button key={incident.id} onClick={() => setSelectedIncident(incident)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-left hover:border-cyan-500/50">
                <p className="text-xs text-zinc-500">{incident.startedAt} · {incident.service}</p>
                <p className="text-sm font-medium">{incident.title}</p>
                <p className="text-xs text-zinc-400">{incident.summary}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Provider failover simulator</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="text-zinc-400">Primary<select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200" value={simPrimary} onChange={(e) => setSimPrimary(e.target.value)}><option>openai</option><option>anthropic</option><option>google</option></select></label>
            <label className="text-zinc-400">Secondary<select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200" value={simSecondary} onChange={(e) => setSimSecondary(e.target.value)}><option>anthropic</option><option>openai</option><option>google</option></select></label>
          </div>
          <div className="mt-3 space-y-3 text-xs text-zinc-300">
            <div>
              <div className="mb-1 flex justify-between"><span>Traffic shift</span><span>{simTrafficShift}%</span></div>
              <input className="w-full" type="range" min={0} max={100} step={5} value={simTrafficShift} onChange={(e) => setSimTrafficShift(Number(e.target.value))} />
            </div>
            <div>
              <div className="mb-1 flex justify-between"><span>Latency trigger</span><span>{simLatencyThreshold}ms</span></div>
              <input className="w-full" type="range" min={700} max={1800} step={50} value={simLatencyThreshold} onChange={(e) => setSimLatencyThreshold(Number(e.target.value))} />
            </div>
            <div className="rounded border border-zinc-700 bg-zinc-950 p-2">
              <p>Current avg p95: {avgP95.toFixed(0)}ms</p>
              <p>Shifted requests: {shiftedRequests}</p>
              <p className={failoverTrigger ? "text-amber-300" : "text-emerald-300"}>{failoverTrigger ? "Failover would trigger" : "Failover remains idle"}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Cost anomaly mini-view</h2>
          <p className="text-xs text-zinc-400">Fast glance at likely budget anomalies.</p>
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
            <p>Top model spend: {topModel.model} (${topModel.cost.toFixed(2)})</p>
            <p>Projected daily: ${projectedSpend.toFixed(2)}</p>
            <p className={anomalyState === "anomaly" ? "text-red-300" : "text-emerald-300"}>{anomalyState === "anomaly" ? "Anomaly risk elevated" : "Spend trend stable"}</p>
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Operator handoff generator</h2>
          <textarea className="h-32 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs" value={handoffText} readOnly />
          <button className="mt-3 w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800">Copy handoff draft</button>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">Routing dependency graph</h2>
          <p className="text-xs text-zinc-400">Compact view of control-plane relationships.</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-300">
            {dependencyEdges.map((edge) => (
              <li key={edge} className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1">{edge}</li>
            ))}
          </ul>
        </article>
      </section>

      {selectedIncident && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">{selectedIncident.startedAt} · {selectedIncident.service}</p>
                <h3 className="text-lg font-semibold">{selectedIncident.title}</h3>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">Close</button>
            </div>
            <p className="text-sm text-zinc-300">{selectedIncident.summary}</p>
            <p className="mt-1 text-xs text-zinc-400">Impact: {selectedIncident.impact}</p>
            <div className="mt-3 space-y-1">
              {selectedIncident.actions.map((action) => (
                <p key={action} className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-xs">• {action}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
