import React, { useState } from "react";
import { cn } from "../lib/utils";

type ReportType = "agent-performance" | "cost-summary" | "incident-report" | "compliance-audit" | "sprint-summary" | "custom";
type ReportFormat = "pdf" | "csv" | "json" | "html" | "markdown";
type ReportSchedule = "once" | "hourly" | "daily" | "weekly" | "monthly";
type ReportStatus = "ready" | "generating" | "error";
type DateRange = "today" | "yesterday" | "last7" | "last30" | "last90" | "custom";

interface ReportTemplate {
  id: ReportType;
  name: string;
  emoji: string;
  description: string;
  defaultSections: string[];
  estimatedRows: number;
}

interface GeneratedReport {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  dateRange: string;
  generatedAt: string;
  sizeKb: number;
  status: ReportStatus;
  rowCount: number;
}

interface ReportSection {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: "agent-performance",
    name: "Agent Performance",
    emoji: "🤖",
    description: "Token usage, session counts, task completion rates, and latency by agent",
    defaultSections: ["overview", "by-agent", "trends", "anomalies"],
    estimatedRows: 450,
  },
  {
    id: "cost-summary",
    name: "Cost Summary",
    emoji: "💰",
    description: "Spend breakdown by model, agent, and time period with forecast",
    defaultSections: ["overview", "by-model", "by-agent", "forecast"],
    estimatedRows: 280,
  },
  {
    id: "incident-report",
    name: "Incident Report",
    emoji: "🔥",
    description: "System incidents, root causes, MTTR, and resolution timelines",
    defaultSections: ["summary", "timeline", "impact", "resolution", "action-items"],
    estimatedRows: 85,
  },
  {
    id: "compliance-audit",
    name: "Compliance Audit",
    emoji: "🛡️",
    description: "Policy adherence, access control violations, and data handling compliance",
    defaultSections: ["overview", "violations", "policy-matrix", "recommendations"],
    estimatedRows: 340,
  },
  {
    id: "sprint-summary",
    name: "Sprint Summary",
    emoji: "🚀",
    description: "Views built, PRs merged, velocity metrics, and team contributions",
    defaultSections: ["overview", "deliverables", "velocity", "by-agent"],
    estimatedRows: 120,
  },
  {
    id: "custom",
    name: "Custom Report",
    emoji: "⚙️",
    description: "Build a fully custom report by selecting sections and filters manually",
    defaultSections: [],
    estimatedRows: 0,
  },
];

const ALL_SECTIONS: ReportSection[] = [
  { id: "overview",      label: "Executive Overview",      enabled: true,  description: "High-level summary with key metrics KPIs" },
  { id: "by-agent",      label: "Breakdown by Agent",      enabled: true,  description: "Per-agent metrics table and sparklines" },
  { id: "by-model",      label: "Breakdown by Model",      enabled: false, description: "Usage and cost by LLM model" },
  { id: "by-squad",      label: "Breakdown by Squad",      enabled: false, description: "Aggregated metrics grouped by squad" },
  { id: "trends",        label: "Trends & Sparklines",     enabled: true,  description: "8-week trend charts for key metrics" },
  { id: "anomalies",     label: "Anomaly Detection",       enabled: false, description: "Unusual patterns flagged by threshold rules" },
  { id: "timeline",      label: "Event Timeline",          enabled: false, description: "Chronological event log for the period" },
  { id: "violations",    label: "Policy Violations",       enabled: false, description: "List of detected policy violations with severity" },
  { id: "forecast",      label: "Cost Forecast",           enabled: false, description: "Projected spend for the next 30/60/90 days" },
  { id: "action-items",  label: "Action Items",            enabled: false, description: "Recommended actions and owners" },
  { id: "raw-data",      label: "Raw Data Appendix",       enabled: false, description: "Full dataset as a tabular appendix" },
];

const HISTORY: GeneratedReport[] = [
  { id: "r1", name: "Agent Performance — Jan 2026",   type: "agent-performance", format: "pdf",      dateRange: "Jan 1–31, 2026",   generatedAt: "2026-02-01 09:00", sizeKb: 284, status: "ready",     rowCount: 452 },
  { id: "r2", name: "Cost Summary — Feb Week 1",      type: "cost-summary",      format: "csv",      dateRange: "Feb 1–7, 2026",    generatedAt: "2026-02-08 08:30", sizeKb: 48,  status: "ready",     rowCount: 288 },
  { id: "r3", name: "Sprint Summary — Horizon Sprint",type: "sprint-summary",    format: "markdown", dateRange: "Feb 15–22, 2026",  generatedAt: "2026-02-22 07:00", sizeKb: 16,  status: "ready",     rowCount: 124 },
  { id: "r4", name: "Compliance Audit — Q4 2025",     type: "compliance-audit",  format: "pdf",      dateRange: "Oct–Dec 2025",     generatedAt: "2026-01-05 10:00", sizeKb: 512, status: "ready",     rowCount: 341 },
  { id: "r5", name: "Incident Report — Model Outage", type: "incident-report",   format: "html",     dateRange: "Feb 18, 2026",     generatedAt: "2026-02-18 14:20", sizeKb: 22,  status: "ready",     rowCount: 87  },
];

const PREVIEW_ROWS: Record<ReportType, string[][]> = {
  "agent-performance": [
    ["Agent", "Sessions", "Tasks", "Tokens (M)", "P95 Latency", "Success Rate"],
    ["Luis",    "42",  "156",  "2.4",  "1.2s",  "99.1%"],
    ["Xavier",  "38",  "142",  "3.1",  "0.8s",  "98.7%"],
    ["Piper",   "31",  "98",   "1.8",  "1.5s",  "97.2%"],
    ["Quinn",   "28",  "87",   "1.6",  "1.4s",  "96.8%"],
    ["Reed",    "25",  "74",   "1.2",  "1.6s",  "95.1%"],
  ],
  "cost-summary": [
    ["Model", "Requests", "Input Tokens", "Output Tokens", "Cost"],
    ["Claude Sonnet 4.6", "28,450", "42.1M", "8.4M", "$284.20"],
    ["MiniMax M2.5",      "12,840", "18.3M", "2.1M",  "$36.80"],
    ["Gemini Flash",       "4,210",  "6.2M", "0.9M",  "$12.40"],
    ["GPT-4o",             "1,820",  "2.8M", "0.4M",  "$28.90"],
  ],
  "incident-report": [
    ["Incident", "Severity", "Start", "Duration", "MTTR", "Status"],
    ["Model API Timeout",    "P2", "Feb 18 11:42", "24m", "28m", "Resolved"],
    ["Gateway Restart",      "P3", "Feb 20 03:15",  "4m",  "6m", "Resolved"],
    ["High Token Usage",     "P4", "Feb 21 09:00", "2h",  "N/A", "Monitoring"],
  ],
  "compliance-audit": [
    ["Policy", "Category", "Status", "Last Checked", "Violations"],
    ["Data Retention (90d)",   "Data",     "✓ Pass",  "Today",    "0"],
    ["PII Redaction",          "Privacy",  "✓ Pass",  "Today",    "0"],
    ["API Key Rotation",       "Security", "⚠ Warn",  "Yesterday", "2"],
    ["Access Review (90d)",    "Access",   "✓ Pass",  "Feb 1",    "0"],
  ],
  "sprint-summary": [
    ["Metric",        "Value"],
    ["Views Built",   "98+"],
    ["PRs Merged",    "24"],
    ["Commits",       "47"],
    ["Token Usage",   "~45M"],
    ["Build Success", "100%"],
  ],
  "custom": [
    ["Configure sections to see preview"],
  ],
};

const formatColor = (f: ReportFormat) => {
  if (f === "pdf")      {return "text-rose-400 bg-rose-400/10";}
  if (f === "csv")      {return "text-emerald-400 bg-emerald-400/10";}
  if (f === "json")     {return "text-amber-400 bg-amber-400/10";}
  if (f === "html")     {return "text-blue-400 bg-blue-400/10";}
  if (f === "markdown") {return "text-purple-400 bg-purple-400/10";}
  return "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10";
};

export default function ReportGenerator() {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportType>("agent-performance");
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("pdf");
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>("last30");
  const [selectedSchedule, setSelectedSchedule] = useState<ReportSchedule>("once");
  const [reportName, setReportName] = useState<string>("");
  const [sections, setSections] = useState<ReportSection[]>(ALL_SECTIONS);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [history, setHistory] = useState<GeneratedReport[]>(HISTORY);
  const [activeTab, setActiveTab] = useState<"builder" | "history">("builder");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [includeAgents, setIncludeAgents] = useState<string[]>(["all"]);

  const template = TEMPLATES.find(t => t.id === selectedTemplate)!;
  const previewData = PREVIEW_ROWS[selectedTemplate] ?? [];
  const selectedHistoryItem = history.find(r => r.id === selectedHistoryId);

  const enabledSections = sections.filter(s => s.enabled).length;

  function applyTemplate(type: ReportType) {
    setSelectedTemplate(type);
    const tmpl = TEMPLATES.find(t => t.id === type)!;
    setSections(ALL_SECTIONS.map(s => ({
      ...s,
      enabled: tmpl.defaultSections.includes(s.id),
    })));
    setReportName("");
  }

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function generateReport() {
    setIsGenerating(true);
    const name = reportName.trim() || `${template.name} — ${dateRangeLabel(selectedDateRange)}`;
    setTimeout(() => {
      const newReport: GeneratedReport = {
        id: `r${Date.now()}`,
        name,
        type: selectedTemplate,
        format: selectedFormat,
        dateRange: dateRangeLabel(selectedDateRange),
        generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
        sizeKb: Math.round(Math.random() * 300 + 20),
        status: "ready",
        rowCount: template.estimatedRows + Math.round(Math.random() * 50 - 25),
      };
      setHistory(prev => [newReport, ...prev]);
      setIsGenerating(false);
      setActiveTab("history");
      setSelectedHistoryId(newReport.id);
    }, 1800);
  }

  function dateRangeLabel(r: DateRange): string {
    const labels: Record<DateRange, string> = {
      today: "Today",
      yesterday: "Yesterday",
      last7: "Last 7 days",
      last30: "Last 30 days",
      last90: "Last 90 days",
      custom: "Custom range",
    };
    return labels[r];
  }

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] overflow-hidden">
      {/* Left panel: builder / history tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
          {(["builder", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === tab
                  ? "border-primary text-indigo-300"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab === "builder" ? "⚙️ Report Builder" : `📋 History (${history.length})`}
            </button>
          ))}
        </div>

        {activeTab === "builder" ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Report name */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Report Name</label>
              <input
                type="text"
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder={`${template.name} — ${dateRangeLabel(selectedDateRange)}`}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm px-3 py-2 rounded placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary"
              />
            </div>

            {/* Template selector */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Template</label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => applyTemplate(tmpl.id)}
                    className={cn(
                      "text-left p-3 rounded border transition-colors",
                      selectedTemplate === tmpl.id
                        ? "bg-primary/10 border-primary text-[var(--color-text-primary)]"
                        : "bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    <div className="text-lg mb-1">{tmpl.emoji}</div>
                    <div className="text-xs font-semibold">{tmpl.name}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{tmpl.description.slice(0, 60)}…</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Date Range</label>
                <div className="flex flex-wrap gap-2">
                  {(["today", "yesterday", "last7", "last30", "last90"] as DateRange[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedDateRange(r)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded border transition-colors",
                        selectedDateRange === r
                          ? "bg-primary/20 border-primary text-indigo-300"
                          : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      {dateRangeLabel(r)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Schedule</label>
                <div className="flex flex-wrap gap-2">
                  {(["once", "daily", "weekly", "monthly"] as ReportSchedule[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedSchedule(s)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded border transition-colors capitalize",
                        selectedSchedule === s
                          ? "bg-primary/20 border-primary text-indigo-300"
                          : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Output Format</label>
              <div className="flex gap-2">
                {(["pdf", "csv", "json", "html", "markdown"] as ReportFormat[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setSelectedFormat(f)}
                    className={cn(
                      "text-xs px-4 py-2 rounded border transition-colors uppercase font-mono font-semibold",
                      selectedFormat === f
                        ? cn(formatColor(f), "border-current")
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    .{f}
                  </button>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Sections ({enabledSections} selected)
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setSections(prev => prev.map(s => ({ ...s, enabled: true })))} className="text-[10px] text-primary hover:text-indigo-300">All</button>
                  <button onClick={() => setSections(prev => prev.map(s => ({ ...s, enabled: false })))} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">None</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {sections.map(sec => (
                  <div
                    key={sec.id}
                    onClick={() => toggleSection(sec.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors",
                      sec.enabled
                        ? "bg-[var(--color-surface-2)] border-[var(--color-border)]"
                        : "bg-[var(--color-surface-1)]/50 border-[var(--color-border)] opacity-60"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                      sec.enabled ? "bg-primary border-primary text-[var(--color-text-primary)] text-[10px]" : "border-[var(--color-surface-3)]"
                    )}>
                      {sec.enabled && "✓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[var(--color-text-primary)]">{sec.label}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{sec.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={generateReport}
                disabled={isGenerating || enabledSections === 0}
                className="flex items-center gap-2 bg-primary hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-text-primary)] px-6 py-2.5 rounded font-medium text-sm transition-colors"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                    Generating…
                  </>
                ) : (
                  <>📊 Generate Report</>
                )}
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                Est. {template.estimatedRows} rows · {selectedFormat.toUpperCase()} · {dateRangeLabel(selectedDateRange)}
              </span>
            </div>
          </div>
        ) : (
          /* History tab */
          <div className="flex-1 flex overflow-hidden">
            <div className="w-72 flex-shrink-0 border-r border-[var(--color-border)] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-6 text-center text-[var(--color-text-muted)] text-sm">No reports generated yet</div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {history.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedHistoryId(r.id)}
                      className={cn(
                        "w-full text-left p-4 transition-colors hover:bg-[var(--color-surface-1)]",
                        selectedHistoryId === r.id && "bg-primary/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{TEMPLATES.find(t => t.id === r.type)?.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{r.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded", formatColor(r.format))}>
                              .{r.format}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">{r.sizeKb}kB</span>
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{r.generatedAt}</div>
                        </div>
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                          r.status === "ready" ? "bg-emerald-400" : r.status === "error" ? "bg-rose-400" : "bg-amber-400 animate-pulse"
                        )} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Report detail */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedHistoryItem ? (
                <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">
                  <div className="text-center">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="text-sm">Select a report to view details</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{selectedHistoryItem.name}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn("text-xs font-mono px-2 py-0.5 rounded font-semibold", formatColor(selectedHistoryItem.format))}>
                          .{selectedHistoryItem.format}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">{selectedHistoryItem.dateRange}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{selectedHistoryItem.rowCount.toLocaleString()} rows</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{selectedHistoryItem.sizeKb}kB</span>
                      </div>
                    </div>
                    <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm px-4 py-2 rounded transition-colors">
                      ⬇ Download
                    </button>
                  </div>

                  {/* Preview table */}
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Data Preview</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {(PREVIEW_ROWS[selectedHistoryItem.type] ?? []).map((row, ri) => (
                            <tr key={ri} className={ri === 0 ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-semibold" : "border-t border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]"}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-left">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2">Showing first {(PREVIEW_ROWS[selectedHistoryItem.type]?.length ?? 1) - 1} rows of {selectedHistoryItem.rowCount.toLocaleString()}</p>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Generated", value: selectedHistoryItem.generatedAt },
                      { label: "Template", value: TEMPLATES.find(t => t.id === selectedHistoryItem.type)?.name ?? "Unknown" },
                      { label: "Row Count", value: selectedHistoryItem.rowCount.toLocaleString() },
                      { label: "File Size", value: `${selectedHistoryItem.sizeKb} kB` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] p-3">
                        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{label}</div>
                        <div className="text-sm text-[var(--color-text-primary)] font-medium mt-1">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: live preview (builder tab only) */}
      {activeTab === "builder" && (
        <div className="w-80 flex-shrink-0 border-l border-[var(--color-border)] flex flex-col bg-[var(--color-surface-1)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">Preview</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{template.name} · {dateRangeLabel(selectedDateRange)}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Simulated report header */}
            <div className="bg-[var(--color-surface-0)] rounded border border-[var(--color-border)] p-4 mb-3">
              <div className="text-base font-bold text-[var(--color-text-primary)] mb-0.5">{template.emoji} {reportName || template.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{dateRangeLabel(selectedDateRange)} · Generated {new Date().toLocaleDateString()}</div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] grid grid-cols-3 gap-2">
                {[
                  { label: "Sections",  value: enabledSections },
                  { label: "Est. Rows", value: template.estimatedRows },
                  { label: "Format",    value: `.${selectedFormat}` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-sm font-bold text-[var(--color-text-primary)]">{value}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section list */}
            <div className="space-y-1 mb-4">
              {sections.filter(s => s.enabled).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)] font-mono w-4 text-right">{i + 1}.</span>
                  {s.label}
                </div>
              ))}
              {enabledSections === 0 && <p className="text-xs text-[var(--color-text-muted)]">No sections selected</p>}
            </div>

            {/* Preview table */}
            {previewData.length > 0 && (
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Data Sample</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border-collapse">
                    <tbody>
                      {previewData.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className={ri === 0 ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-semibold" : "border-t border-[var(--color-border)]/50 text-[var(--color-text-muted)]"}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-1.5 py-1 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Schedule summary */}
          {selectedSchedule !== "once" && (
            <div className="p-4 border-t border-[var(--color-border)] bg-amber-400/5">
              <div className="text-xs text-amber-400 font-medium">
                🔁 Scheduled: {selectedSchedule.charAt(0).toUpperCase() + selectedSchedule.slice(1)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                Will auto-generate and deliver via email
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
