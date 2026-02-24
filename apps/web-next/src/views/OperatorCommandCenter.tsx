import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  DollarSign,
  Gauge,
  Play,
  Route,
  Search,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";

type FocusMode = "overview" | "budget" | "models" | "events" | "routing" | "copilot";

type EventItem = {
  ts: string;
  type: "journal" | "routing" | "tool" | "budget" | "self-eval";
  severity: "info" | "warn" | "critical";
  message: string;
  source: string;
};

const EVENT_FEED: EventItem[] = [
  {
    ts: "09:14:08",
    type: "routing",
    severity: "warn",
    source: "router-feedback",
    message: "T1 predicted; operator feedback marked expected=T3 escalate (review queued).",
  },
  {
    ts: "09:13:41",
    type: "self-eval",
    severity: "info",
    source: "periodic-calibration",
    message: "Self-eval run completed: mismatch rate dropped from 12.3% to 9.8%.",
  },
  {
    ts: "09:12:57",
    type: "budget",
    severity: "warn",
    source: "provider-usage",
    message: "Anthropic spend velocity exceeded hourly target by +18%.",
  },
  {
    ts: "09:12:20",
    type: "tool",
    severity: "critical",
    source: "tool-journal",
    message: "web_fetch timeout spike detected in us-east gateway node-3.",
  },
  {
    ts: "09:11:52",
    type: "journal",
    severity: "info",
    source: "agent-journal",
    message: "Agent wave 34 began: 27 sessions, budget lock applied, provenance tracing enabled.",
  },
];

const SMART_ACTIONS = [
  {
    title: "Suggest routing threshold changes",
    prompt:
      "Analyze current routing mismatches, recommend tier confidence thresholds, and draft patch-ready config changes.",
  },
  {
    title: "Investigate budget anomaly",
    prompt:
      "Trace top model/provider spend deltas over 24h, isolate root causes, and suggest hard safety knobs.",
  },
  {
    title: "Generate incident summary",
    prompt:
      "Summarize critical event feed entries into operator handoff notes with concrete mitigation steps.",
  },
  {
    title: "Propose tool reliability fixes",
    prompt:
      "Group failing tools by error class and propose retries, backoff, and routing fallback policy changes.",
  },
];

function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "good" | "warn" | "critical";
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">{props.label}</span>
        <span className="text-zinc-500">{props.icon}</span>
      </div>
      <div className="text-white text-2xl font-semibold">{props.value}</div>
      {props.delta ? (
        <div
          className={cn(
            "mt-1 text-xs",
            props.tone === "good" && "text-emerald-400",
            props.tone === "warn" && "text-amber-400",
            props.tone === "critical" && "text-rose-400",
            (!props.tone || props.tone === "neutral") && "text-zinc-400",
          )}
        >
          {props.delta}
        </div>
      ) : null}
    </div>
  );
}

export default function OperatorCommandCenter() {
  const [mode, setMode] = useState<FocusMode>("overview");
  const [query, setQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState(SMART_ACTIONS[0]?.prompt ?? "");

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return EVENT_FEED;
    }
    return EVENT_FEED.filter(
      (entry) =>
        entry.message.toLowerCase().includes(q) ||
        entry.source.toLowerCase().includes(q) ||
        entry.type.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Operator Command Center</h1>
            <p className="mt-1 text-zinc-400 text-sm">
              Unified analytics, budget/model governance, event tailing, routing provenance, and AI-assisted ops actions.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {(["overview", "budget", "models", "events", "routing", "copilot"] as FocusMode[]).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs uppercase tracking-wide transition",
                  mode === item ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Activity className="h-4 w-4" />} label="Live Sessions" value="142" delta="+11 vs 1h" tone="good" />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Daily Spend" value="$438" delta="+18% over target" tone="warn" />
          <StatCard icon={<Brain className="h-4 w-4" />} label="Model Requests" value="9.7k" delta="Anthropic 46% · OpenAI 29%" />
          <StatCard icon={<Route className="h-4 w-4" />} label="Routing Mismatch" value="9.8%" delta="-2.5pt vs yesterday" tone="good" />
          <StatCard icon={<Wrench className="h-4 w-4" />} label="Tool Error Rate" value="3.1%" delta="web_fetch and browser eval elevated" tone="critical" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="space-y-4 xl:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-lg">
                  <Gauge className="h-4 w-4 text-cyan-400" />
                  Operator Knobs and Guardrails
                </h2>
                <span className="text-zinc-500 text-xs">Mode: {mode}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="rounded-lg border border-zinc-800 p-3 text-sm">
                  <div className="mb-1 text-zinc-400 text-xs">Budget throttle</div>
                  <input type="range" min={30} max={100} defaultValue={72} className="w-full" />
                  <div className="mt-1 text-zinc-300 text-xs">72% of configured max daily budget</div>
                </label>
                <label className="rounded-lg border border-zinc-800 p-3 text-sm">
                  <div className="mb-1 text-zinc-400 text-xs">Routing confidence floor</div>
                  <input type="range" min={40} max={95} defaultValue={71} className="w-full" />
                  <div className="mt-1 text-zinc-300 text-xs">Escalate when confidence &lt; 71%</div>
                </label>
                <label className="rounded-lg border border-zinc-800 p-3 text-sm">
                  <div className="mb-1 text-zinc-400 text-xs">Self-eval cadence</div>
                  <select className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm">
                    <option>Every 30 minutes</option>
                    <option>Hourly</option>
                    <option>Every 6 hours</option>
                  </select>
                </label>
                <label className="rounded-lg border border-zinc-800 p-3 text-sm">
                  <div className="mb-1 text-zinc-400 text-xs">Event tail mode</div>
                  <select className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm">
                    <option>All sources</option>
                    <option>Routing only</option>
                    <option>Tool journals</option>
                    <option>Budget anomalies</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-lg">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Specialized Event Viewer
                </h2>
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1">
                  <Search className="h-3.5 w-3.5 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter events, source, type..."
                    className="w-56 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                {filteredEvents.map((entry) => (
                  <div key={`${entry.ts}-${entry.message}`} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-500">{entry.ts}</span>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 uppercase">{entry.type}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 uppercase",
                            entry.severity === "info" && "bg-sky-900/50 text-sky-300",
                            entry.severity === "warn" && "bg-amber-900/50 text-amber-300",
                            entry.severity === "critical" && "bg-rose-900/50 text-rose-300",
                          )}
                        >
                          {entry.severity}
                        </span>
                      </div>
                      <span className="text-zinc-500">{entry.source}</span>
                    </div>
                    <p className="text-sm text-zinc-200">{entry.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-lg">
                <Sparkles className="h-4 w-4 text-violet-400" />
                AI Copilot and Smart Actions
              </h2>
              <div className="space-y-2">
                {SMART_ACTIONS.map((action) => (
                  <button
                    key={action.title}
                    onClick={() => setAiPrompt(action.prompt)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-left text-sm hover:border-violet-500/40"
                  >
                    {action.title}
                  </button>
                ))}
              </div>
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                className="mt-3 h-40 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm outline-none focus:border-violet-500"
              />
              <div className="mt-2 flex gap-2">
                <button className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500">
                  <Bot className="h-3.5 w-3.5" /> Run analysis
                </button>
                <button className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
                  <Play className="h-3.5 w-3.5" /> Dry-run action
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-lg">
                <Settings2 className="h-4 w-4 text-cyan-400" />
                Cohesive Operator Workflows
              </h2>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-400" /> Budget and anomaly triage</li>
                <li className="flex items-start gap-2"><Route className="mt-0.5 h-3.5 w-3.5 text-sky-400" /> Routing provenance and self-improvement</li>
                <li className="flex items-start gap-2"><Wrench className="mt-0.5 h-3.5 w-3.5 text-emerald-400" /> Tool failure debugging and retries</li>
                <li className="flex items-start gap-2"><Brain className="mt-0.5 h-3.5 w-3.5 text-violet-400" /> Model/provider utilization optimization</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
