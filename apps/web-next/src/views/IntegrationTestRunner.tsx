import React, { useState } from "react";
import { cn } from "../lib/utils";

type TabId = "suites" | "history" | "coverage" | "alerts";

type TestStatus = "passed" | "failed" | "skipped" | "running" | "pending";
type RunTrigger = "manual" | "CI" | "scheduled";
type RunStatus = "passed" | "failed" | "running" | "cancelled";
type CoverageLevel = "covered" | "partial" | "uncovered";
type AlertSeverity = "critical" | "warning" | "info";

interface IndividualTest {
  id: string;
  name: string;
  status: TestStatus;
  duration: number;
  error: string | null;
}

interface TestSuite {
  id: string;
  name: string;
  targetApi: string;
  passRate: number;
  lastRun: string;
  status: TestStatus;
  tests: IndividualTest[];
}

interface RunRecord {
  id: string;
  suite: string;
  trigger: RunTrigger;
  time: string;
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  status: RunStatus;
  details: string;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  channel: string;
  severity: AlertSeverity;
  enabled: boolean;
}

interface AlertHistoryRow {
  id: string;
  rule: string;
  integration: string;
  time: string;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
}

interface IntegrationHealth {
  id: string;
  name: string;
  score: number;
  status: "healthy" | "degraded" | "down";
  lastCheck: string;
}

const SUITES: TestSuite[] = [
  {
    id: "s1",
    name: "Slack Messaging Suite",
    targetApi: "Slack Web API v2",
    passRate: 92,
    lastRun: "2026-02-22 06:10",
    status: "passed",
    tests: [
      { id: "t1", name: "POST /chat.postMessage", status: "passed", duration: 312, error: null },
      { id: "t2", name: "GET /conversations.list", status: "passed", duration: 198, error: null },
      { id: "t3", name: "POST /reactions.add", status: "passed", duration: 145, error: null },
      { id: "t4", name: "DELETE /chat.delete", status: "failed", duration: 89, error: "403 Forbidden: missing_scope" },
      { id: "t5", name: "POST /files.upload", status: "passed", duration: 421, error: null },
    ],
  },
  {
    id: "s2",
    name: "GitHub Webhooks Suite",
    targetApi: "GitHub REST API v3",
    passRate: 85,
    lastRun: "2026-02-22 05:55",
    status: "failed",
    tests: [
      { id: "t6", name: "POST /repos/{owner}/{repo}/hooks", status: "passed", duration: 230, error: null },
      { id: "t7", name: "GET /repos/{owner}/{repo}/hooks", status: "passed", duration: 175, error: null },
      { id: "t8", name: "PATCH /repos/{owner}/{repo}/hooks/{hook_id}", status: "failed", duration: 320, error: "422 Unprocessable Entity: hook already exists" },
      { id: "t9", name: "DELETE /repos/{owner}/{repo}/hooks/{hook_id}", status: "passed", duration: 188, error: null },
      { id: "t10", name: "POST /repos/{owner}/{repo}/hooks/{hook_id}/pings", status: "skipped", duration: 0, error: null },
    ],
  },
  {
    id: "s3",
    name: "Stripe Payments Suite",
    targetApi: "Stripe API v1",
    passRate: 100,
    lastRun: "2026-02-22 06:00",
    status: "passed",
    tests: [
      { id: "t11", name: "POST /v1/charges", status: "passed", duration: 510, error: null },
      { id: "t12", name: "GET /v1/charges/{id}", status: "passed", duration: 201, error: null },
      { id: "t13", name: "POST /v1/refunds", status: "passed", duration: 390, error: null },
      { id: "t14", name: "GET /v1/customers/{id}", status: "passed", duration: 180, error: null },
      { id: "t15", name: "POST /v1/payment_intents", status: "passed", duration: 440, error: null },
    ],
  },
  {
    id: "s4",
    name: "AWS S3 Storage Suite",
    targetApi: "AWS SDK S3",
    passRate: 78,
    lastRun: "2026-02-22 05:45",
    status: "failed",
    tests: [
      { id: "t16", name: "PutObject bucket upload", status: "passed", duration: 820, error: null },
      { id: "t17", name: "GetObject bucket download", status: "passed", duration: 610, error: null },
      { id: "t18", name: "DeleteObject bucket remove", status: "failed", duration: 450, error: "AccessDenied: insufficient permissions" },
      { id: "t19", name: "ListObjectsV2 paginate", status: "failed", duration: 330, error: "Timeout after 5000ms" },
      { id: "t20", name: "HeadBucket existence check", status: "passed", duration: 120, error: null },
    ],
  },
  {
    id: "s5",
    name: "PagerDuty Incidents Suite",
    targetApi: "PagerDuty REST API v2",
    passRate: 90,
    lastRun: "2026-02-22 06:05",
    status: "passed",
    tests: [
      { id: "t21", name: "POST /incidents create", status: "passed", duration: 290, error: null },
      { id: "t22", name: "GET /incidents/{id}", status: "passed", duration: 155, error: null },
      { id: "t23", name: "PUT /incidents/{id}/acknowledge", status: "passed", duration: 210, error: null },
      { id: "t24", name: "PUT /incidents/{id}/resolve", status: "passed", duration: 195, error: null },
      { id: "t25", name: "POST /incidents/{id}/notes", status: "skipped", duration: 0, error: null },
    ],
  },
  {
    id: "s6",
    name: "Datadog Metrics Suite",
    targetApi: "Datadog API v2",
    passRate: 95,
    lastRun: "2026-02-22 06:15",
    status: "passed",
    tests: [
      { id: "t26", name: "POST /api/v2/series submit metric", status: "passed", duration: 350, error: null },
      { id: "t27", name: "GET /api/v1/query timeseries", status: "passed", duration: 480, error: null },
      { id: "t28", name: "POST /api/v1/events create event", status: "passed", duration: 220, error: null },
      { id: "t29", name: "GET /api/v1/hosts list hosts", status: "passed", duration: 310, error: null },
      { id: "t30", name: "POST /api/v1/check_run submit check", status: "failed", duration: 190, error: "400 Bad Request: invalid tags format" },
    ],
  },
  {
    id: "s7",
    name: "Slack OAuth Suite",
    targetApi: "Slack OAuth v2",
    passRate: 67,
    lastRun: "2026-02-22 05:30",
    status: "failed",
    tests: [
      { id: "t31", name: "GET /oauth/v2/authorize redirect", status: "passed", duration: 88, error: null },
      { id: "t32", name: "POST /oauth/v2/access token exchange", status: "failed", duration: 430, error: "invalid_client: client_id mismatch" },
      { id: "t33", name: "POST /auth.revoke token revoke", status: "passed", duration: 150, error: null },
      { id: "t34", name: "GET /auth.test verify token", status: "failed", duration: 200, error: "token_revoked: cannot verify revoked token" },
      { id: "t35", name: "POST /oauth/v2/exchange refresh token", status: "skipped", duration: 0, error: null },
    ],
  },
  {
    id: "s8",
    name: "GitHub Actions Suite",
    targetApi: "GitHub Actions API",
    passRate: 80,
    lastRun: "2026-02-22 06:20",
    status: "passed",
    tests: [
      { id: "t36", name: "GET /repos/{owner}/{repo}/actions/runs", status: "passed", duration: 265, error: null },
      { id: "t37", name: "POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches", status: "passed", duration: 340, error: null },
      { id: "t38", name: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", status: "passed", duration: 210, error: null },
      { id: "t39", name: "DELETE /repos/{owner}/{repo}/actions/runs/{run_id}", status: "failed", duration: 180, error: "405 Method Not Allowed" },
      { id: "t40", name: "GET /repos/{owner}/{repo}/actions/secrets", status: "passed", duration: 155, error: null },
    ],
  },
];

const RUNS: RunRecord[] = [
  { id: "r1", suite: "Stripe Payments Suite", trigger: "CI", time: "2026-02-22 06:00", duration: 1720, passed: 5, failed: 0, skipped: 0, status: "passed", details: "All payment endpoints verified successfully." },
  { id: "r2", suite: "Datadog Metrics Suite", trigger: "scheduled", time: "2026-02-22 06:15", duration: 1550, passed: 4, failed: 1, skipped: 0, status: "failed", details: "check_run endpoint returned 400 due to tag format." },
  { id: "r3", suite: "Slack Messaging Suite", trigger: "manual", time: "2026-02-22 06:10", duration: 1165, passed: 4, failed: 1, skipped: 0, status: "failed", details: "chat.delete missing scope error in production env." },
  { id: "r4", suite: "GitHub Actions Suite", trigger: "CI", time: "2026-02-22 06:20", duration: 1150, passed: 4, failed: 1, skipped: 0, status: "failed", details: "DELETE run endpoint returned 405." },
  { id: "r5", suite: "PagerDuty Incidents Suite", trigger: "scheduled", time: "2026-02-22 06:05", duration: 850, passed: 4, failed: 0, skipped: 1, status: "passed", details: "All incident lifecycle endpoints passed." },
  { id: "r6", suite: "AWS S3 Storage Suite", trigger: "CI", time: "2026-02-22 05:45", duration: 2330, passed: 3, failed: 2, skipped: 0, status: "failed", details: "DeleteObject and ListObjectsV2 failed due to permissions and timeout." },
  { id: "r7", suite: "GitHub Webhooks Suite", trigger: "manual", time: "2026-02-22 05:55", duration: 913, passed: 3, failed: 1, skipped: 1, status: "failed", details: "Hook creation conflict on existing hooks." },
  { id: "r8", suite: "Slack OAuth Suite", trigger: "CI", time: "2026-02-22 05:30", duration: 868, passed: 2, failed: 2, skipped: 1, status: "failed", details: "OAuth token exchange and verification failed." },
  { id: "r9", suite: "Stripe Payments Suite", trigger: "scheduled", time: "2026-02-21 22:00", duration: 1680, passed: 5, failed: 0, skipped: 0, status: "passed", details: "Nightly stripe check passed clean." },
  { id: "r10", suite: "Datadog Metrics Suite", trigger: "CI", time: "2026-02-21 18:45", duration: 1490, passed: 5, failed: 0, skipped: 0, status: "passed", details: "All metrics endpoints healthy." },
  { id: "r11", suite: "Slack Messaging Suite", trigger: "scheduled", time: "2026-02-21 18:00", duration: 1200, passed: 5, failed: 0, skipped: 0, status: "passed", details: "Full pass on scheduled run." },
  { id: "r12", suite: "AWS S3 Storage Suite", trigger: "manual", time: "2026-02-21 16:30", duration: 2100, passed: 4, failed: 1, skipped: 0, status: "failed", details: "DeleteObject still failing — permissions not updated." },
  { id: "r13", suite: "GitHub Webhooks Suite", trigger: "scheduled", time: "2026-02-21 14:00", duration: 890, passed: 4, failed: 0, skipped: 1, status: "passed", details: "Clean run with ping skipped." },
  { id: "r14", suite: "PagerDuty Incidents Suite", trigger: "CI", time: "2026-02-21 12:15", duration: 820, passed: 5, failed: 0, skipped: 0, status: "passed", details: "Full lifecycle passed including notes." },
  { id: "r15", suite: "Slack OAuth Suite", trigger: "manual", time: "2026-02-21 10:00", duration: 950, passed: 3, failed: 1, skipped: 1, status: "failed", details: "Token revocation flow had issues in staging." },
];

type CoverageMatrix = CoverageLevel[][];

const ENDPOINTS = [
  "POST /messages",
  "GET /events",
  "DELETE /resources",
  "PATCH /configs",
  "POST /webhooks",
  "GET /metrics",
  "POST /auth",
  "GET /status",
];

const SUITE_NAMES_SHORT = ["Slack Msg", "GH Hooks", "Stripe", "AWS S3", "PagerDuty", "DD Metrics", "Slack OAuth", "GH Actions"];

const COVERAGE_MATRIX: CoverageMatrix = [
  ["covered", "covered", "partial", "uncovered", "covered", "covered", "partial", "covered"],
  ["covered", "partial", "uncovered", "uncovered", "covered", "covered", "uncovered", "partial"],
  ["partial", "covered", "covered", "covered", "partial", "covered", "covered", "covered"],
  ["uncovered", "uncovered", "covered", "covered", "uncovered", "partial", "covered", "covered"],
  ["covered", "covered", "covered", "partial", "covered", "covered", "covered", "partial"],
  ["covered", "partial", "covered", "covered", "covered", "covered", "partial", "covered"],
  ["partial", "covered", "partial", "covered", "partial", "partial", "covered", "covered"],
  ["covered", "covered", "covered", "partial", "covered", "covered", "covered", "covered"],
];

const INTEGRATIONS: IntegrationHealth[] = [
  { id: "i1", name: "Slack", score: 88, status: "healthy", lastCheck: "2026-02-22 06:10" },
  { id: "i2", name: "GitHub", score: 72, status: "degraded", lastCheck: "2026-02-22 06:20" },
  { id: "i3", name: "Stripe", score: 100, status: "healthy", lastCheck: "2026-02-22 06:00" },
  { id: "i4", name: "AWS", score: 55, status: "degraded", lastCheck: "2026-02-22 05:45" },
  { id: "i5", name: "PagerDuty", score: 95, status: "healthy", lastCheck: "2026-02-22 06:05" },
  { id: "i6", name: "Datadog", score: 91, status: "healthy", lastCheck: "2026-02-22 06:15" },
];

const INITIAL_ALERT_RULES: AlertRule[] = [
  { id: "ar1", name: "Slack Pass Rate Drop", condition: "Pass rate < 80% on Slack suite", channel: "#alerts-slack", severity: "warning", enabled: true },
  { id: "ar2", name: "GitHub Suite Failure", condition: "Any GitHub suite fails 2x in a row", channel: "#alerts-github", severity: "critical", enabled: true },
  { id: "ar3", name: "Stripe Payment Error", condition: "Any Stripe test fails", channel: "#alerts-payments", severity: "critical", enabled: true },
  { id: "ar4", name: "AWS Timeout Alert", condition: "AWS test duration > 4000ms", channel: "#alerts-infra", severity: "warning", enabled: false },
  { id: "ar5", name: "PagerDuty Health Drop", condition: "PagerDuty score < 70", channel: "#alerts-oncall", severity: "critical", enabled: true },
  { id: "ar6", name: "Datadog Metric Gap", condition: "Datadog suite skipped > 1 test", channel: "#alerts-observability", severity: "info", enabled: true },
  { id: "ar7", name: "Auth Failure Spike", condition: "OAuth suite failure rate > 50%", channel: "#alerts-security", severity: "critical", enabled: true },
  { id: "ar8", name: "Scheduled Run Missed", condition: "Scheduled run not completed in 2h window", channel: "#alerts-ci", severity: "warning", enabled: false },
];

const ALERT_HISTORY: AlertHistoryRow[] = [
  { id: "ah1", rule: "Slack Pass Rate Drop", integration: "Slack", time: "2026-02-22 06:10", severity: "warning", message: "Slack pass rate dropped to 80% after chat.delete failure", resolved: true },
  { id: "ah2", rule: "GitHub Suite Failure", integration: "GitHub", time: "2026-02-22 06:20", severity: "critical", message: "GitHub Actions suite failed — DELETE endpoint 405", resolved: false },
  { id: "ah3", rule: "Auth Failure Spike", integration: "Slack", time: "2026-02-22 05:30", severity: "critical", message: "OAuth failure rate hit 67% — client_id mismatch", resolved: false },
  { id: "ah4", rule: "AWS Timeout Alert", integration: "AWS", time: "2026-02-22 05:45", severity: "warning", message: "ListObjectsV2 timed out after 5000ms", resolved: true },
  { id: "ah5", rule: "Datadog Metric Gap", integration: "Datadog", time: "2026-02-21 18:45", severity: "info", message: "check_run 400 error on tag format validation", resolved: true },
  { id: "ah6", rule: "Slack Pass Rate Drop", integration: "Slack", time: "2026-02-21 18:00", severity: "warning", message: "Slack OAuth pass rate recovered to 67% — still below threshold", resolved: false },
  { id: "ah7", rule: "GitHub Suite Failure", integration: "GitHub", time: "2026-02-21 14:00", severity: "critical", message: "GitHub Webhooks suite — hook conflict on PATCH", resolved: true },
  { id: "ah8", rule: "AWS Timeout Alert", integration: "AWS", time: "2026-02-21 16:30", severity: "warning", message: "DeleteObject permission denied repeatedly", resolved: false },
  { id: "ah9", rule: "Scheduled Run Missed", integration: "GitHub", time: "2026-02-21 12:15", severity: "warning", message: "Scheduled run window exceeded by 18 minutes", resolved: true },
  { id: "ah10", rule: "Stripe Payment Error", integration: "Stripe", time: "2026-02-21 10:00", severity: "critical", message: "Stripe suite triggered false positive — resolved automatically", resolved: true },
];

function statusColor(status: TestStatus | RunStatus): string {
  if (status === "passed") return "#10b981";
  if (status === "failed") return "#ef4444";
  if (status === "skipped") return "#6b7280";
  if (status === "running") return "#3b82f6";
  if (status === "pending") return "#f59e0b";
  if (status === "cancelled") return "#6b7280";
  return "#6b7280";
}

function statusBg(status: TestStatus | RunStatus): string {
  if (status === "passed") return "#d1fae5";
  if (status === "failed") return "#fee2e2";
  if (status === "skipped") return "#f3f4f6";
  if (status === "running") return "#dbeafe";
  if (status === "pending") return "#fef3c7";
  if (status === "cancelled") return "#f3f4f6";
  return "#f3f4f6";
}

function severityColor(s: AlertSeverity): string {
  if (s === "critical") return "#ef4444";
  if (s === "warning") return "#f59e0b";
  return "#3b82f6";
}

function severityBg(s: AlertSeverity): string {
  if (s === "critical") return "#fee2e2";
  if (s === "warning") return "#fef3c7";
  return "#dbeafe";
}

function coverageColor(level: CoverageLevel): string {
  if (level === "covered") return "#d1fae5";
  if (level === "partial") return "#fef3c7";
  return "#f3f4f6";
}

function coverageTextColor(level: CoverageLevel): string {
  if (level === "covered") return "#065f46";
  if (level === "partial") return "#92400e";
  return "#6b7280";
}

function healthColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

function triggerBadge(trigger: RunTrigger): React.ReactElement {
  const colors: Record<RunTrigger, { bg: string; text: string }> = {
    manual: { bg: "#ede9fe", text: "#5b21b6" },
    CI: { bg: "#dbeafe", text: "#1e40af" },
    scheduled: { bg: "#fce7f3", text: "#9d174d" },
  };
  const c = colors[trigger];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
      }}
    >
      {trigger}
    </span>
  );
}

function Badge({ status }: { status: TestStatus | RunStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: statusBg(status),
        color: statusColor(status),
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function PassRateBar({ rate }: { rate: number }) {
  const color = rate >= 90 ? "#10b981" : rate >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#e5e7eb",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${rate}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36 }}>{rate}%</span>
    </div>
  );
}

function SuitesTab() {
  const [selected, setSelected] = useState<string | null>(null);

  const suite = SUITES.find((s) => s.id === selected) || null;

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      {/* Left panel */}
      <div style={{ flex: "0 0 420px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Test Suites (8)</span>
          <button
            style={{
              padding: "6px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Run All
          </button>
        </div>
        {SUITES.map((s) => (
          <div
            key={s.id}
            onClick={() => setSelected(s.id)}
            style={{
              padding: "12px 14px",
              background: selected === s.id ? "#eff6ff" : "#fff",
              border: `1px solid ${selected === s.id ? "#93c5fd" : "#e5e7eb"}`,
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.targetApi}</div>
              </div>
              <Badge status={s.status} />
            </div>
            <PassRateBar rate={s.passRate} />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Last run: {s.lastRun}</div>
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, overflowY: "auto" }}>
        {!suite ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 14 }}>
            Select a test suite to view individual tests
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{suite.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{suite.targetApi} — {suite.tests.length} tests</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {suite.tests.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: "10px 14px",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", fontFamily: "monospace" }}>{t.name}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {t.duration > 0 && (
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{t.duration}ms</span>
                      )}
                      <Badge status={t.status} />
                    </div>
                  </div>
                  {t.error && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "6px 10px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#991b1b",
                        fontFamily: "monospace",
                      }}
                    >
                      {t.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<RunStatus | "all">("all");

  const filtered = filter === "all" ? RUNS : RUNS.filter((r) => r.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Filter:</span>
        {(["all", "passed", "failed", "running", "cancelled"] as (RunStatus | "all")[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: filter === f ? "#2563eb" : "#fff",
              color: filter === f ? "#fff" : "#374151",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{filtered.length} records</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suite</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trigger</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Time</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Duration</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Results</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <React.Fragment key={r.id}>
                <tr
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: expanded === r.id ? "#f0f9ff" : i % 2 === 0 ? "#fff" : "#fafafa",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                >
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#111827", fontWeight: 500 }}>{r.suite}</td>
                  <td style={{ padding: "10px 14px" }}>{triggerBadge(r.trigger)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{r.time}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{(r.duration / 1000).toFixed(1)}s</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
                      <span style={{ color: "#10b981", fontWeight: 600 }}>{r.passed}✓</span>
                      {r.failed > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}>{r.failed}✗</span>}
                      {r.skipped > 0 && <span style={{ color: "#6b7280", fontWeight: 600 }}>{r.skipped}—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}><Badge status={r.status} /></td>
                </tr>
                {expanded === r.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: "12px 14px 14px 28px", background: "#f0f9ff", borderBottom: "1px solid #e0f2fe" }}>
                      <div style={{ fontSize: 12, color: "#1e40af", fontStyle: "italic" }}>{r.details}</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageTab() {
  const totalCells = COVERAGE_MATRIX.length * COVERAGE_MATRIX[0].length;
  let coveredCount = 0;
  let partialCount = 0;
  let uncoveredCount = 0;
  for (const row of COVERAGE_MATRIX) {
    for (const cell of row) {
      if (cell === "covered") coveredCount++;
      else if (cell === "partial") partialCount++;
      else uncoveredCount++;
    }
  }
  const coveredPct = Math.round((coveredCount / totalCells) * 100);
  const partialPct = Math.round((partialCount / totalCells) * 100);
  const uncoveredPct = Math.round((uncoveredCount / totalCells) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Covered", value: coveredCount, pct: coveredPct, bg: "#d1fae5", text: "#065f46" },
          { label: "Partial", value: partialCount, pct: partialPct, bg: "#fef3c7", text: "#92400e" },
          { label: "Uncovered", value: uncoveredCount, pct: uncoveredPct, bg: "#f3f4f6", text: "#6b7280" },
          { label: "Total Cells", value: totalCells, pct: 100, bg: "#eff6ff", text: "#1e40af" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: card.bg,
              borderRadius: 10,
              border: `1px solid ${card.text}22`,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: card.text }}>{card.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: card.text, marginTop: 2 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: card.text, opacity: 0.7 }}>{card.pct}% of matrix</div>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, overflowX: "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14 }}>Endpoint × Suite Coverage Matrix</div>
        <table style={{ borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 600, minWidth: 140 }}>Endpoint</th>
              {SUITE_NAMES_SHORT.map((sn) => (
                <th key={sn} style={{ padding: "6px 8px", fontSize: 10, color: "#6b7280", fontWeight: 600, textAlign: "center", minWidth: 70, whiteSpace: "nowrap" }}>
                  {sn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map((ep, ri) => (
              <tr key={ep}>
                <td style={{ padding: "6px 10px", fontSize: 12, color: "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>{ep}</td>
                {COVERAGE_MATRIX[ri].map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "6px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 52,
                        height: 24,
                        borderRadius: 4,
                        background: coverageColor(cell),
                        color: coverageTextColor(cell),
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {cell === "covered" ? "✓" : cell === "partial" ? "~" : "—"}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
          {[
            { label: "Covered", bg: "#d1fae5", text: "#065f46", symbol: "✓" },
            { label: "Partial", bg: "#fef3c7", text: "#92400e", symbol: "~" },
            { label: "Uncovered", bg: "#f3f4f6", text: "#6b7280", symbol: "—" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 14, borderRadius: 3, background: l.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, color: l.text, fontWeight: 700 }}>{l.symbol}</span>
              </div>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsTab() {
  const [rules, setRules] = useState<AlertRule[]>(INITIAL_ALERT_RULES);

  function toggleRule(id: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Health score cards */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Integration Health Scores</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {INTEGRATIONS.map((intg) => {
            const color = healthColor(intg.score);
            const statusColors: Record<string, { bg: string; text: string }> = {
              healthy: { bg: "#d1fae5", text: "#065f46" },
              degraded: { bg: "#fef3c7", text: "#92400e" },
              down: { bg: "#fee2e2", text: "#991b1b" },
            };
            const sc = statusColors[intg.status];
            return (
              <div
                key={intg.id}
                style={{
                  flex: "0 0 180px",
                  padding: "14px 16px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{intg.name}</div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 10,
                      fontWeight: 600,
                      background: sc.bg,
                      color: sc.text,
                      textTransform: "capitalize",
                    }}
                  >
                    {intg.status}
                  </span>
                </div>
                {/* Score gauge */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>Health Score</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{intg.score}</span>
                  </div>
                  <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${intg.score}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>Last: {intg.lastCheck}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Alert rules */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Alert Rules</div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {rules.map((rule, i) => (
              <div
                key={rule.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: i < rules.length - 1 ? "1px solid #f3f4f6" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{rule.name}</span>
                    <span
                      style={{
                        padding: "1px 7px",
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 600,
                        background: severityBg(rule.severity),
                        color: severityColor(rule.severity),
                        textTransform: "capitalize",
                      }}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{rule.condition}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>→ {rule.channel}</div>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule.id)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: "none",
                    background: rule.enabled ? "#10b981" : "#d1d5db",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                  aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: rule.enabled ? 20 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      background: "#fff",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Alert history */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Recent Alert History</div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {ALERT_HISTORY.map((row, i) => (
              <div
                key={row.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < ALERT_HISTORY.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: row.resolved ? "#10b981" : severityColor(row.severity),
                        display: "inline-block",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{row.rule}</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 600,
                        background: severityBg(row.severity),
                        color: severityColor(row.severity),
                      }}
                    >
                      {row.severity}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: row.resolved ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {row.resolved ? "Resolved" : "Open"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", paddingLeft: 14 }}>{row.message}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", paddingLeft: 14, marginTop: 2 }}>
                  {row.integration} · {row.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationTestRunner() {
  const [activeTab, setActiveTab] = useState<TabId>("suites");

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "suites", label: "Suites", count: 8 },
    { id: "history", label: "History", count: 15 },
    { id: "coverage", label: "Coverage" },
    { id: "alerts", label: "Alerts", count: 6 },
  ];

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            🔗
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            Integration Test Runner
          </h1>
          <span
            style={{
              padding: "3px 10px",
              background: "#dbeafe",
              color: "#1e40af",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            40 tests · 8 suites · 6 integrations
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Monitor, run, and analyze integration test coverage across all connected services.
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 4,
          marginBottom: 20,
          width: "fit-content",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              background: activeTab === tab.id ? "#2563eb" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#6b7280",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  background: activeTab === tab.id ? "rgba(255,255,255,0.25)" : "#f3f4f6",
                  color: activeTab === tab.id ? "#fff" : "#6b7280",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "suites" && <SuitesTab />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "coverage" && <CoverageTab />}
        {activeTab === "alerts" && <AlertsTab />}
      </div>
    </div>
  );
}
