import React, { useState } from "react";
import { cn } from "../lib/utils";

type IssueSeverity = "error" | "warning" | "info";
type IssueCategory = "schema" | "security" | "performance" | "compatibility" | "deprecation";
type ValidatorStatus = "pass" | "fail" | "warning" | "skipped";

interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  path: string;
  message: string;
  suggestion: string;
  ruleId: string;
}

interface ValidationResult {
  id: string;
  name: string;
  description: string;
  status: ValidatorStatus;
  duration: number;
  issues: ValidationIssue[];
}

interface ConfigFile {
  id: string;
  path: string;
  kind: "agent" | "cron" | "gateway" | "tool" | "integration";
  validatedAt: string;
  results: ValidationResult[];
}

const CONFIG_FILES: ConfigFile[] = [
  {
    id: "cf-001",
    path: "workspace/luis/AGENTS.md",
    kind: "agent",
    validatedAt: "2026-02-22 02:21",
    results: [
      {
        id: "r1", name: "Schema Validation", description: "Validate required AGENTS.md fields", status: "pass",
        duration: 12, issues: []
      },
      {
        id: "r2", name: "Memory Protocol", description: "Check memory file references", status: "warning",
        duration: 8,
        issues: [
          { id: "i1", severity: "warning", category: "schema", path: "memory/YYYY-MM-DD.md", message: "Memory path references date pattern but no validation rule enforces format", suggestion: "Add a memory format validator or document expected structure", ruleId: "MEM-001" },
        ]
      },
      {
        id: "r3", name: "Security Scan", description: "Check for exposed secrets or unsafe patterns", status: "pass",
        duration: 5, issues: []
      },
      {
        id: "r4", name: "Heartbeat Config", description: "Validate heartbeat step ordering", status: "pass",
        duration: 4, issues: []
      },
    ],
  },
  {
    id: "cf-002",
    path: "workspace/_shared/cron.yaml",
    kind: "cron",
    validatedAt: "2026-02-22 02:00",
    results: [
      {
        id: "r1", name: "Cron Syntax Check", description: "Validate all cron expressions", status: "fail",
        duration: 15,
        issues: [
          { id: "i1", severity: "error", category: "schema", path: "jobs[3].schedule", message: "Invalid cron expression: '0 */25 * * *' — hour value 25 out of range 0-23", suggestion: "Use '0 */1 * * *' for hourly or specify a valid hour (0-23)", ruleId: "CRON-002" },
        ]
      },
      {
        id: "r2", name: "Agent Reference Check", description: "All referenced agents must exist", status: "warning",
        duration: 22,
        issues: [
          { id: "i2", severity: "warning", category: "compatibility", path: "jobs[7].agent", message: "Agent 'sam' is referenced but not in active roster", suggestion: "Remove job or update agent reference to an active agent", ruleId: "CRON-005" },
        ]
      },
      {
        id: "r3", name: "Overlap Detection", description: "Check for jobs that may conflict", status: "pass",
        duration: 18, issues: []
      },
    ],
  },
  {
    id: "cf-003",
    path: "openclaw.gateway.config.json",
    kind: "gateway",
    validatedAt: "2026-02-22 01:55",
    results: [
      {
        id: "r1", name: "Port Availability", description: "Check configured port is not already in use", status: "pass",
        duration: 30, issues: []
      },
      {
        id: "r2", name: "TLS Configuration", description: "Validate TLS cert and key paths", status: "fail",
        duration: 8,
        issues: [
          { id: "i1", severity: "error", category: "security", path: "tls.certPath", message: "TLS certificate file not found: /etc/openclaw/tls/cert.pem", suggestion: "Generate a self-signed cert or point to a valid certificate file", ruleId: "SEC-004" },
          { id: "i2", severity: "error", category: "security", path: "tls.keyPath", message: "TLS key file not found: /etc/openclaw/tls/key.pem", suggestion: "Ensure private key exists at the configured path", ruleId: "SEC-005" },
        ]
      },
      {
        id: "r3", name: "Rate Limit Config", description: "Validate rate limit configuration", status: "warning",
        duration: 6,
        issues: [
          { id: "i3", severity: "warning", category: "performance", path: "rateLimits.global.burst", message: "Burst limit (500) is unusually high for a gateway config — may allow traffic spikes", suggestion: "Consider reducing burst to 100-200 for more predictable behavior", ruleId: "PERF-002" },
        ]
      },
      {
        id: "r4", name: "Deprecation Check", description: "Check for deprecated config fields", status: "warning",
        duration: 4,
        issues: [
          { id: "i4", severity: "info", category: "deprecation", path: "legacyAuth.enabled", message: "legacyAuth is deprecated and will be removed in v2.0", suggestion: "Migrate to OAuth2 authentication: see docs/auth-migration.md", ruleId: "DEP-003" },
        ]
      },
    ],
  },
  {
    id: "cf-004",
    path: "workspace/_shared/tool-policy.json",
    kind: "tool",
    validatedAt: "2026-02-22 01:50",
    results: [
      {
        id: "r1", name: "Policy Schema", description: "Validate tool policy JSON schema", status: "pass",
        duration: 9, issues: []
      },
      {
        id: "r2", name: "Permission Consistency", description: "Check for conflicting allow/deny rules", status: "pass",
        duration: 14, issues: []
      },
      {
        id: "r3", name: "Required Fields", description: "All tool entries must have description and version", status: "warning",
        duration: 11,
        issues: [
          { id: "i1", severity: "warning", category: "schema", path: "tools[12].description", message: "Tool 'voice_call' is missing a description field", suggestion: "Add a description explaining the tool's purpose and capabilities", ruleId: "SCHEMA-007" },
        ]
      },
    ],
  },
];

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  error: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  info: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
};

const SEVERITY_DOT: Record<IssueSeverity, string> = {
  error: "bg-rose-400",
  warning: "bg-amber-400",
  info: "bg-sky-400",
};

const STATUS_STYLES: Record<ValidatorStatus, string> = {
  pass: "text-emerald-400",
  fail: "text-rose-400",
  warning: "text-amber-400",
  skipped: "text-zinc-500",
};

const STATUS_ICON: Record<ValidatorStatus, string> = {
  pass: "✓",
  fail: "✗",
  warning: "⚠",
  skipped: "–",
};

const KIND_STYLES: Record<ConfigFile["kind"], string> = {
  agent: "bg-indigo-500/10 text-indigo-400",
  cron: "bg-amber-500/10 text-amber-400",
  gateway: "bg-emerald-500/10 text-emerald-400",
  tool: "bg-violet-500/10 text-violet-400",
  integration: "bg-sky-500/10 text-sky-400",
};

const CATEGORY_COLORS: Record<IssueCategory, string> = {
  schema: "text-violet-400",
  security: "text-rose-400",
  performance: "text-amber-400",
  compatibility: "text-sky-400",
  deprecation: "text-zinc-400",
};

function fileStatus(file: ConfigFile): ValidatorStatus {
  const issues = file.results.flatMap((r) => r.issues);
  if (issues.some((i) => i.severity === "error")) {return "fail";}
  if (issues.some((i) => i.severity === "warning")) {return "warning";}
  return "pass";
}

export default function ConfigValidatorView() {
  const [selectedFileId, setSelectedFileId] = useState<string>("cf-001");
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set(["r2"]));

  const selectedFile = CONFIG_FILES.find((f) => f.id === selectedFileId) ?? CONFIG_FILES[0];
  const allIssues = selectedFile.results.flatMap((r) => r.issues);
  const filteredIssues = severityFilter === "all" ? allIssues : allIssues.filter((i) => i.severity === severityFilter);

  const totalErrors = CONFIG_FILES.flatMap((f) => f.results.flatMap((r) => r.issues)).filter((i) => i.severity === "error").length;
  const totalWarnings = CONFIG_FILES.flatMap((f) => f.results.flatMap((r) => r.issues)).filter((i) => i.severity === "warning").length;

  function toggleResult(id: string) {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);}
      else {next.add(id);}
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center gap-4">
        <div>
          <h1 className="text-sm font-semibold text-white">Config Validator</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{CONFIG_FILES.length} files · {totalErrors} errors · {totalWarnings} warnings</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="text-xs px-2 py-1 bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 rounded font-medium">
            {totalErrors} errors
          </span>
          <span className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 rounded font-medium">
            {totalWarnings} warnings
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File list */}
        <ul className="w-64 shrink-0 border-r border-zinc-800 overflow-y-auto divide-y divide-zinc-800/50" role="listbox" aria-label="Config files">
          {CONFIG_FILES.map((file) => {
            const status = fileStatus(file);
            const issueCount = file.results.flatMap((r) => r.issues).length;
            return (
              <li key={file.id}>
                <button
                  role="option"
                  aria-selected={file.id === selectedFileId}
                  onClick={() => setSelectedFileId(file.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                    file.id === selectedFileId && "bg-zinc-800 border-l-2 border-indigo-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-200 leading-tight break-all">{file.path.split("/").pop()}</span>
                    <span className={cn("shrink-0 font-bold", STATUS_STYLES[status])}>
                      {STATUS_ICON[status]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", KIND_STYLES[file.kind])}>
                      {file.kind}
                    </span>
                    {issueCount > 0 && (
                      <span className="text-xs text-zinc-500">{issueCount} issue{issueCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">{file.validatedAt}</div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Validation results */}
        <div className="flex-1 overflow-y-auto">
          {/* File header */}
          <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-5 py-3 flex items-center justify-between z-10">
            <div>
              <div className="text-sm font-semibold text-white">{selectedFile.path}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {selectedFile.results.length} validators · {allIssues.length} issues · {selectedFile.validatedAt}
              </div>
            </div>
            {/* Severity filter */}
            <div className="flex gap-1.5">
              {(["all", "error", "warning", "info"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    severityFilter === s ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-3">
            {selectedFile.results.map((result) => {
              const expanded = expandedResults.has(result.id);
              const visibleIssues = result.issues.filter(
                (i) => severityFilter === "all" || i.severity === severityFilter
              );
              const show = severityFilter === "all" || visibleIssues.length > 0;
              if (!show) {return null;}

              return (
                <div key={result.id} className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  {/* Result header */}
                  <button
                    onClick={() => toggleResult(result.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    aria-expanded={expanded}
                  >
                    <span className={cn("text-sm font-bold w-4", STATUS_STYLES[result.status])}>
                      {STATUS_ICON[result.status]}
                    </span>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-semibold text-zinc-200">{result.name}</div>
                      <div className="text-xs text-zinc-500">{result.description}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {result.issues.length > 0 && (
                        <span className="text-xs text-zinc-500">{result.issues.length} issue{result.issues.length !== 1 ? "s" : ""}</span>
                      )}
                      <span className="text-xs text-zinc-600">{result.duration}ms</span>
                      <span className="text-zinc-500 text-xs">{expanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Issues */}
                  {expanded && (
                    <div className="border-t border-zinc-800">
                      {visibleIssues.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                          <span>✓</span> All checks passed
                        </div>
                      ) : (
                        <div className="divide-y divide-zinc-800/50">
                          {visibleIssues.map((issue) => (
                            <div key={issue.id} className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full mt-1.5", SEVERITY_DOT[issue.severity])} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", SEVERITY_STYLES[issue.severity])}>
                                      {issue.severity}
                                    </span>
                                    <code className="text-xs text-zinc-400 font-mono">{issue.path}</code>
                                    <span className={cn("text-xs font-mono", CATEGORY_COLORS[issue.category])}>
                                      [{issue.ruleId}]
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-200 mt-1.5 leading-relaxed">{issue.message}</p>
                                  <div className="mt-1.5 flex items-start gap-1.5">
                                    <span className="text-xs text-indigo-400 shrink-0">→</span>
                                    <p className="text-xs text-zinc-400 leading-relaxed">{issue.suggestion}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
