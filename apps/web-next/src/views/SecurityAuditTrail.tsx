import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low" | "info";
type Category = "auth" | "data-access" | "admin" | "config-change" | "api";
type Outcome = "success" | "failure";
type ActorType = "user" | "service";
type TabId = "events" | "anomalies" | "compliance" | "export";
type AnomalyType =
  | "unusual-location"
  | "off-hours-access"
  | "privilege-escalation"
  | "mass-download";
type AnomalyStatus = "investigating" | "confirmed" | "false-positive";
type ExportFormat = "JSON" | "CSV" | "SIEM";
type ComplianceStatus = "pass" | "fail";
type QuickRange = "24h" | "7d" | "30d" | "90d";

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorType: ActorType;
  action: string;
  resource: string;
  ipAddress: string;
  outcome: Outcome;
  severity: Severity;
  category: Category;
  payload: string;
}

interface Anomaly {
  id: string;
  type: AnomalyType;
  confidence: number;
  affectedUser: string;
  status: AnomalyStatus;
  detectedAt: string;
  details: string;
}

interface ComplianceControl {
  id: string;
  name: string;
  coverage: number;
  lastTested: string;
  status: ComplianceStatus;
}

interface ComplianceFramework {
  id: string;
  name: string;
  controls: ComplianceControl[];
}

interface FilterState {
  severity: Severity | "all";
  category: Category | "all";
  dateStart: string;
  dateEnd: string;
}

interface ExportState {
  format: ExportFormat;
  dateStart: string;
  dateEnd: string;
  preset: string;
  isExporting: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_EVENTS: AuditEvent[] = [
  {
    id: "evt-001",
    timestamp: "2026-02-22T06:42:11Z",
    actor: "alice@corp.io",
    actorType: "user",
    action: "LOGIN",
    resource: "/auth/session",
    ipAddress: "203.0.113.42",
    outcome: "success",
    severity: "info",
    category: "auth",
    payload: '{"method":"password","mfa":true,"session_id":"s_9xKp2"}',
  },
  {
    id: "evt-002",
    timestamp: "2026-02-22T06:45:03Z",
    actor: "bob@corp.io",
    actorType: "user",
    action: "LOGIN_FAILED",
    resource: "/auth/session",
    ipAddress: "198.51.100.77",
    outcome: "failure",
    severity: "high",
    category: "auth",
    payload: '{"method":"password","attempts":5,"reason":"invalid_credentials"}',
  },
  {
    id: "evt-003",
    timestamp: "2026-02-22T06:50:22Z",
    actor: "api-gateway",
    actorType: "service",
    action: "EXPORT_RECORDS",
    resource: "/api/v2/users/export",
    ipAddress: "10.0.1.5",
    outcome: "success",
    severity: "medium",
    category: "data-access",
    payload: '{"record_count":12450,"format":"csv","requester":"analytics-job"}',
  },
  {
    id: "evt-004",
    timestamp: "2026-02-22T07:01:55Z",
    actor: "charlie@corp.io",
    actorType: "user",
    action: "ROLE_ASSIGNED",
    resource: "/admin/roles/superadmin",
    ipAddress: "192.168.1.22",
    outcome: "success",
    severity: "critical",
    category: "admin",
    payload: '{"target_user":"dave@corp.io","role":"superadmin","granted_by":"charlie@corp.io"}',
  },
  {
    id: "evt-005",
    timestamp: "2026-02-22T07:05:33Z",
    actor: "dave@corp.io",
    actorType: "user",
    action: "CONFIG_UPDATE",
    resource: "/config/security/mfa-policy",
    ipAddress: "192.168.1.30",
    outcome: "success",
    severity: "high",
    category: "config-change",
    payload: '{"field":"mfa_required","old_value":true,"new_value":false,"reason":"test"}',
  },
  {
    id: "evt-006",
    timestamp: "2026-02-22T07:10:01Z",
    actor: "data-pipeline",
    actorType: "service",
    action: "BULK_READ",
    resource: "/api/v2/payments",
    ipAddress: "10.0.2.8",
    outcome: "success",
    severity: "medium",
    category: "data-access",
    payload: '{"records_accessed":88000,"table":"payments","pipeline_id":"pl_8xKw"}',
  },
  {
    id: "evt-007",
    timestamp: "2026-02-22T07:15:44Z",
    actor: "eve@corp.io",
    actorType: "user",
    action: "PERMISSION_DENIED",
    resource: "/admin/billing",
    ipAddress: "203.0.113.88",
    outcome: "failure",
    severity: "medium",
    category: "auth",
    payload: '{"required_role":"billing_admin","user_roles":["viewer"]}',
  },
  {
    id: "evt-008",
    timestamp: "2026-02-22T07:22:09Z",
    actor: "frank@corp.io",
    actorType: "user",
    action: "API_KEY_CREATED",
    resource: "/api/keys",
    ipAddress: "172.16.0.14",
    outcome: "success",
    severity: "medium",
    category: "api",
    payload: '{"key_id":"key_7Xm9","scopes":["read:users","write:reports"],"expires_in":"90d"}',
  },
  {
    id: "evt-009",
    timestamp: "2026-02-22T07:28:17Z",
    actor: "grace@corp.io",
    actorType: "user",
    action: "DATA_DELETE",
    resource: "/api/v2/users/usr_4422",
    ipAddress: "10.10.0.55",
    outcome: "success",
    severity: "high",
    category: "data-access",
    payload: '{"user_id":"usr_4422","deleted_by":"grace@corp.io","gdpr_request":true}',
  },
  {
    id: "evt-010",
    timestamp: "2026-02-22T07:35:50Z",
    actor: "auth-service",
    actorType: "service",
    action: "TOKEN_REVOKED",
    resource: "/auth/tokens/tkn_9x2Kp",
    ipAddress: "10.0.1.2",
    outcome: "success",
    severity: "low",
    category: "auth",
    payload: '{"token_id":"tkn_9x2Kp","reason":"logout","session_duration":"8h22m"}',
  },
  {
    id: "evt-011",
    timestamp: "2026-02-22T07:40:05Z",
    actor: "heidi@corp.io",
    actorType: "user",
    action: "WEBHOOK_CONFIGURED",
    resource: "/config/webhooks",
    ipAddress: "203.0.113.11",
    outcome: "success",
    severity: "low",
    category: "config-change",
    payload: '{"webhook_url":"https://external.example.com/hook","events":["payment.completed"]}',
  },
  {
    id: "evt-012",
    timestamp: "2026-02-22T07:44:33Z",
    actor: "ivan@corp.io",
    actorType: "user",
    action: "REPORT_EXPORTED",
    resource: "/reports/financial/q4-2025",
    ipAddress: "192.168.5.66",
    outcome: "success",
    severity: "medium",
    category: "data-access",
    payload: '{"report_id":"rpt_q4_2025","format":"xlsx","rows":9842}',
  },
  {
    id: "evt-013",
    timestamp: "2026-02-22T07:50:19Z",
    actor: "api-monitor",
    actorType: "service",
    action: "RATE_LIMIT_EXCEEDED",
    resource: "/api/v2/search",
    ipAddress: "198.51.100.33",
    outcome: "failure",
    severity: "high",
    category: "api",
    payload: '{"caller_id":"ext-app-772","limit":1000,"requests_per_min":1847}',
  },
  {
    id: "evt-014",
    timestamp: "2026-02-22T07:55:01Z",
    actor: "judy@corp.io",
    actorType: "user",
    action: "MFA_DISABLED",
    resource: "/users/judy@corp.io/mfa",
    ipAddress: "10.10.0.12",
    outcome: "success",
    severity: "critical",
    category: "auth",
    payload: '{"user":"judy@corp.io","mfa_was":"totp","override_reason":"emergency"}',
  },
  {
    id: "evt-015",
    timestamp: "2026-02-22T08:01:44Z",
    actor: "kevin@corp.io",
    actorType: "user",
    action: "FIREWALL_RULE_ADDED",
    resource: "/config/network/firewall",
    ipAddress: "192.168.1.100",
    outcome: "success",
    severity: "critical",
    category: "config-change",
    payload: '{"rule":"ALLOW 0.0.0.0/0 -> :443","added_by":"kevin@corp.io","env":"production"}',
  },
  {
    id: "evt-016",
    timestamp: "2026-02-22T08:08:22Z",
    actor: "sync-service",
    actorType: "service",
    action: "SCHEMA_MIGRATED",
    resource: "/admin/database/schema",
    ipAddress: "10.0.3.1",
    outcome: "success",
    severity: "medium",
    category: "admin",
    payload: '{"migration_id":"mig_20260222","tables_affected":7,"duration_ms":4221}',
  },
];

const INITIAL_ANOMALIES: Anomaly[] = [
  {
    id: "ano-001",
    type: "unusual-location",
    confidence: 94,
    affectedUser: "bob@corp.io",
    status: "investigating",
    detectedAt: "2026-02-22T03:12:00Z",
    details:
      "Login from Minsk, Belarus — user has never accessed from this region. VPN not detected.",
  },
  {
    id: "ano-002",
    type: "off-hours-access",
    confidence: 81,
    affectedUser: "charlie@corp.io",
    status: "confirmed",
    detectedAt: "2026-02-22T02:45:00Z",
    details:
      "Admin role assignment at 02:45 UTC — outside defined business hours (09:00–20:00 UTC).",
  },
  {
    id: "ano-003",
    type: "privilege-escalation",
    confidence: 97,
    affectedUser: "dave@corp.io",
    status: "investigating",
    detectedAt: "2026-02-22T07:06:00Z",
    details:
      "User received superadmin role then immediately disabled MFA policy. Behavioral risk score: 9.7.",
  },
  {
    id: "ano-004",
    type: "mass-download",
    confidence: 88,
    affectedUser: "api-gateway",
    status: "false-positive",
    detectedAt: "2026-02-22T06:50:00Z",
    details:
      "88,000 payment records accessed in 4 minutes. Confirmed legitimate analytics pipeline run.",
  },
  {
    id: "ano-005",
    type: "off-hours-access",
    confidence: 73,
    affectedUser: "ivan@corp.io",
    status: "investigating",
    detectedAt: "2026-02-22T01:30:00Z",
    details:
      "Financial Q4 report exported at 01:30 UTC on a Saturday. User typically active weekday mornings.",
  },
  {
    id: "ano-006",
    type: "unusual-location",
    confidence: 66,
    affectedUser: "judy@corp.io",
    status: "confirmed",
    detectedAt: "2026-02-22T07:55:00Z",
    details:
      "MFA emergency override executed from a new IP block. Possible account compromise under investigation.",
  },
];

const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    controls: [
      {
        id: "CC6.1",
        name: "Logical Access Controls",
        coverage: 96,
        lastTested: "2026-02-15",
        status: "pass",
      },
      {
        id: "CC6.2",
        name: "New Access Provisioning",
        coverage: 88,
        lastTested: "2026-02-15",
        status: "pass",
      },
      {
        id: "CC6.3",
        name: "Access Removal",
        coverage: 100,
        lastTested: "2026-02-15",
        status: "pass",
      },
      {
        id: "CC7.2",
        name: "Security Incident Management",
        coverage: 74,
        lastTested: "2026-02-10",
        status: "fail",
      },
      {
        id: "CC8.1",
        name: "Change Management",
        coverage: 91,
        lastTested: "2026-02-18",
        status: "pass",
      },
    ],
  },
  {
    id: "gdpr",
    name: "GDPR",
    controls: [
      {
        id: "Art.30",
        name: "Records of Processing Activities",
        coverage: 100,
        lastTested: "2026-02-20",
        status: "pass",
      },
      {
        id: "Art.32",
        name: "Security of Processing",
        coverage: 85,
        lastTested: "2026-02-20",
        status: "pass",
      },
      {
        id: "Art.33",
        name: "Breach Notification (72h)",
        coverage: 62,
        lastTested: "2026-02-01",
        status: "fail",
      },
      {
        id: "Art.17",
        name: "Right to Erasure (Audit)",
        coverage: 95,
        lastTested: "2026-02-18",
        status: "pass",
      },
    ],
  },
  {
    id: "hipaa",
    name: "HIPAA",
    controls: [
      {
        id: "164.312(a)",
        name: "Access Control",
        coverage: 98,
        lastTested: "2026-02-12",
        status: "pass",
      },
      {
        id: "164.312(b)",
        name: "Audit Controls",
        coverage: 100,
        lastTested: "2026-02-12",
        status: "pass",
      },
      {
        id: "164.312(c)",
        name: "Integrity Controls",
        coverage: 80,
        lastTested: "2026-02-12",
        status: "pass",
      },
      {
        id: "164.312(e)",
        name: "Transmission Security",
        coverage: 55,
        lastTested: "2026-01-28",
        status: "fail",
      },
    ],
  },
  {
    id: "iso27001",
    name: "ISO 27001",
    controls: [
      {
        id: "A.9.2",
        name: "User Access Management",
        coverage: 93,
        lastTested: "2026-02-16",
        status: "pass",
      },
      {
        id: "A.9.4",
        name: "System Access Control",
        coverage: 89,
        lastTested: "2026-02-16",
        status: "pass",
      },
      {
        id: "A.12.4",
        name: "Logging and Monitoring",
        coverage: 97,
        lastTested: "2026-02-20",
        status: "pass",
      },
      {
        id: "A.16.1",
        name: "Management of Security Incidents",
        coverage: 71,
        lastTested: "2026-02-05",
        status: "fail",
      },
      {
        id: "A.18.1",
        name: "Compliance with Legal Requirements",
        coverage: 84,
        lastTested: "2026-02-10",
        status: "pass",
      },
    ],
  },
];

const EXPORT_PRESETS: string[] = [
  "Last 24 Hours — All Events",
  "Critical + High — Last 7 Days",
  "Auth Events — Last 30 Days",
  "Admin Actions — This Month",
  "Failed Events Only — Last 48h",
];

const QUICK_RANGES: QuickRange[] = ["24h", "7d", "30d", "90d"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBorderBg(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-rose-400/10 border-rose-400/30";
    case "high":
      return "bg-amber-400/10 border-amber-400/30";
    case "medium":
      return "bg-yellow-300/10 border-yellow-300/30";
    case "low":
      return "bg-sky-400/10 border-sky-400/30";
    case "info":
      return "bg-zinc-700/40 border-zinc-600/30";
  }
}

function severityText(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "text-rose-400";
    case "high":
      return "text-amber-400";
    case "medium":
      return "text-yellow-300";
    case "low":
      return "text-sky-400";
    case "info":
      return "text-zinc-400";
  }
}

function severityDot(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-rose-400";
    case "high":
      return "bg-amber-400";
    case "medium":
      return "bg-yellow-300";
    case "low":
      return "bg-sky-400";
    case "info":
      return "bg-zinc-500";
  }
}

function anomalyTypeLabel(type: AnomalyType): string {
  switch (type) {
    case "unusual-location":
      return "Unusual Location";
    case "off-hours-access":
      return "Off-Hours Access";
    case "privilege-escalation":
      return "Privilege Escalation";
    case "mass-download":
      return "Mass Download";
  }
}

function anomalyTypeText(type: AnomalyType): string {
  switch (type) {
    case "unusual-location":
      return "text-amber-400";
    case "off-hours-access":
      return "text-sky-400";
    case "privilege-escalation":
      return "text-rose-400";
    case "mass-download":
      return "text-purple-400";
  }
}

function anomalyStatusClasses(status: AnomalyStatus): string {
  switch (status) {
    case "investigating":
      return "bg-amber-400/10 text-amber-400 border-amber-400/30";
    case "confirmed":
      return "bg-rose-400/10 text-rose-400 border-rose-400/30";
    case "false-positive":
      return "bg-emerald-400/10 text-emerald-400 border-emerald-400/30";
  }
}

function anomalyStatusLabel(status: AnomalyStatus): string {
  switch (status) {
    case "investigating":
      return "Investigating";
    case "confirmed":
      return "Confirmed";
    case "false-positive":
      return "False Positive";
  }
}

function confidenceBarBg(confidence: number): string {
  if (confidence >= 90) {return "bg-rose-400";}
  if (confidence >= 75) {return "bg-amber-400";}
  if (confidence >= 60) {return "bg-yellow-300";}
  return "bg-sky-400";
}

function confidenceText(confidence: number): string {
  if (confidence >= 90) {return "text-rose-400";}
  if (confidence >= 75) {return "text-amber-400";}
  if (confidence >= 60) {return "text-yellow-300";}
  return "text-sky-400";
}

function coverageBarBg(coverage: number): string {
  if (coverage >= 90) {return "bg-emerald-400";}
  if (coverage >= 70) {return "bg-amber-400";}
  return "bg-rose-400";
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mon = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mon} ${day}, ${hh}:${mm}:${ss} UTC`;
}

function titleCase(s: string): string {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function nextAnomalyStatus(current: AnomalyStatus): AnomalyStatus {
  switch (current) {
    case "investigating":
      return "confirmed";
    case "confirmed":
      return "false-positive";
    case "false-positive":
      return "investigating";
  }
}

function nextAnomalyStatusLabel(current: AnomalyStatus): string {
  switch (current) {
    case "investigating":
      return "Mark Confirmed";
    case "confirmed":
      return "Mark False Positive";
    case "false-positive":
      return "Reopen";
  }
}

function quickRangeDays(range: QuickRange): number {
  switch (range) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TabButtonProps {
  label: string;
  tabId: TabId;
  active: boolean;
  onClick: (id: TabId) => void;
  count?: number;
}

function TabButton({ label, tabId, active, onClick, count }: TabButtonProps) {
  return (
    <button
      onClick={() => onClick(tabId)}
      className={cn(
        "relative px-5 py-3 text-sm font-medium transition-colors duration-150 border-b-2",
        active
          ? "text-white border-indigo-500"
          : "text-zinc-400 border-transparent hover:text-zinc-200 hover:border-zinc-600"
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full",
            active
              ? "bg-indigo-500/30 text-indigo-300"
              : "bg-zinc-700 text-zinc-400"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface SeverityBadgeProps {
  severity: Severity;
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        severityBorderBg(severity)
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", severityDot(severity))} />
      <span className={severityText(severity)}>
        {severity.toUpperCase()}
      </span>
    </span>
  );
}

// ─── Events Tab ───────────────────────────────────────────────────────────────

const ALL_SEVERITIES: Array<Severity | "all"> = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

const ALL_CATEGORIES: Array<Category | "all"> = [
  "all",
  "auth",
  "data-access",
  "admin",
  "config-change",
  "api",
];

interface EventsTabProps {
  events: AuditEvent[];
  filters: FilterState;
  onFilterChange: (f: FilterState) => void;
  selectedEvent: AuditEvent | null;
  onSelectEvent: (e: AuditEvent | null) => void;
}

function EventsTab({
  events,
  filters,
  onFilterChange,
  selectedEvent,
  onSelectEvent,
}: EventsTabProps) {
  const filtered = events.filter((e) => {
    if (filters.severity !== "all" && e.severity !== filters.severity)
      {return false;}
    if (filters.category !== "all" && e.category !== filters.category)
      {return false;}
    return true;
  });

  return (
    <div className="flex gap-4">
      {/* Left: filters + list */}
      <div className={cn("flex flex-col gap-4", selectedEvent ? "w-1/2" : "w-full")}>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          {/* Severity filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Severity
            </span>
            <div className="flex flex-wrap gap-1">
              {ALL_SEVERITIES.map((s) => (
                <button
                  key={s}
                  onClick={() => onFilterChange({ ...filters, severity: s })}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filters.severity === s
                      ? "bg-indigo-500 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  )}
                >
                  {s === "all"
                    ? "All"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Category
            </span>
            <div className="flex flex-wrap gap-1">
              {ALL_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => onFilterChange({ ...filters, category: c })}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filters.category === c
                      ? "bg-indigo-500 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  )}
                >
                  {c === "all" ? "All" : titleCase(c)}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="flex gap-2 items-end ml-auto">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                From
              </span>
              <input
                type="date"
                value={filters.dateStart}
                onChange={(ev) =>
                  onFilterChange({ ...filters, dateStart: ev.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                To
              </span>
              <input
                type="date"
                value={filters.dateEnd}
                onChange={(ev) =>
                  onFilterChange({ ...filters, dateEnd: ev.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <span className="text-xs text-zinc-600 self-end pb-1">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Event list */}
        <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
          {filtered.map((event) => (
            <button
              key={event.id}
              onClick={() =>
                onSelectEvent(
                  selectedEvent?.id === event.id ? null : event
                )
              }
              className={cn(
                "w-full text-left rounded-lg border px-4 py-3 transition-all duration-150",
                selectedEvent?.id === event.id
                  ? "bg-indigo-500/10 border-indigo-500/50"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <SeverityBadge severity={event.severity} />
                <span className="text-xs text-zinc-500 font-mono shrink-0">
                  {formatTs(event.timestamp)}
                </span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-xs px-2 py-0.5 rounded border font-medium",
                    event.outcome === "success"
                      ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                      : "text-rose-400 border-rose-400/30 bg-rose-400/10"
                  )}
                >
                  {event.outcome}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 min-w-0">
                <span className="text-white text-sm font-semibold shrink-0">
                  {event.action}
                </span>
                <span className="text-zinc-500 text-xs shrink-0">on</span>
                <span className="text-indigo-300 text-xs font-mono truncate">
                  {event.resource}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                <span>
                  {event.actorType === "user" ? "👤" : "⚙️"} {event.actor}
                </span>
                <span>·</span>
                <span>{event.ipAddress}</span>
                <span>·</span>
                <span className="text-zinc-600">{titleCase(event.category)}</span>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
              No events match the current filters
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      {selectedEvent !== null && (
        <div
          className="w-1/2 bg-zinc-900 rounded-xl border border-zinc-800 p-5 flex flex-col gap-5 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 240px)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold text-base">
                {selectedEvent.action}
              </h3>
              <p className="text-zinc-600 text-xs mt-0.5 font-mono">
                {selectedEvent.id}
              </p>
            </div>
            <button
              onClick={() => onSelectEvent(null)}
              className="text-zinc-600 hover:text-zinc-300 text-xl leading-none shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <SeverityBadge severity={selectedEvent.severity} />
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                selectedEvent.outcome === "success"
                  ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                  : "text-rose-400 border-rose-400/30 bg-rose-400/10"
              )}
            >
              {selectedEvent.outcome === "success" ? "✓ Success" : "✗ Failure"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { label: "Timestamp", value: formatTs(selectedEvent.timestamp) },
                { label: "IP Address", value: selectedEvent.ipAddress },
                { label: "Actor", value: selectedEvent.actor },
                { label: "Actor Type", value: titleCase(selectedEvent.actorType) },
                { label: "Resource", value: selectedEvent.resource },
                { label: "Category", value: titleCase(selectedEvent.category) },
              ] as Array<{ label: string; value: string }>
            ).map(({ label, value }) => (
              <div key={label} className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">{label}</p>
                <p className="text-zinc-100 text-sm font-medium font-mono break-all">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-zinc-500 text-xs mb-2 font-medium uppercase tracking-wider">
              Raw Payload
            </p>
            <pre className="bg-zinc-950 rounded-lg p-4 text-xs text-emerald-300 font-mono overflow-x-auto border border-zinc-800 whitespace-pre-wrap">
              {JSON.stringify(
                JSON.parse(selectedEvent.payload) as Record<string, unknown>,
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Anomalies Tab ────────────────────────────────────────────────────────────

interface AnomaliesTabProps {
  anomalies: Anomaly[];
  onStatusChange: (id: string, status: AnomalyStatus) => void;
}

function AnomaliesTab({ anomalies, onStatusChange }: AnomaliesTabProps) {
  const summaryStatuses: AnomalyStatus[] = [
    "investigating",
    "confirmed",
    "false-positive",
  ];

  const summaryCardClasses: Record<AnomalyStatus, string> = {
    investigating: "border-amber-400/30 bg-amber-400/5",
    confirmed: "border-rose-400/30 bg-rose-400/5",
    "false-positive": "border-emerald-400/30 bg-emerald-400/5",
  };

  const summaryValueClasses: Record<AnomalyStatus, string> = {
    investigating: "text-amber-400",
    confirmed: "text-rose-400",
    "false-positive": "text-emerald-400",
  };

  const summaryLabels: Record<AnomalyStatus, string> = {
    investigating: "Investigating",
    confirmed: "Confirmed",
    "false-positive": "False Positives",
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {summaryStatuses.map((s) => {
          const count = anomalies.filter((a) => a.status === s).length;
          return (
            <div
              key={s}
              className={cn("rounded-xl border p-4", summaryCardClasses[s])}
            >
              <p className={cn("text-2xl font-bold", summaryValueClasses[s])}>
                {count}
              </p>
              <p className="text-zinc-400 text-sm mt-1">{summaryLabels[s]}</p>
            </div>
          );
        })}
      </div>

      {/* Anomaly list */}
      <div className="flex flex-col gap-3">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      anomalyTypeText(anomaly.type)
                    )}
                  >
                    {anomalyTypeLabel(anomaly.type)}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs border font-medium",
                      anomalyStatusClasses(anomaly.status)
                    )}
                  >
                    {anomalyStatusLabel(anomaly.status)}
                  </span>
                  <span className="text-zinc-700 text-xs font-mono ml-auto">
                    {anomaly.id}
                  </span>
                </div>

                <p className="text-zinc-300 text-sm mt-2 leading-relaxed">
                  {anomaly.details}
                </p>

                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span>👤 {anomaly.affectedUser}</span>
                  <span>·</span>
                  <span>Detected {formatTs(anomaly.detectedAt)}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 shrink-0">
                {/* Confidence score */}
                <div className="text-right">
                  <p className="text-xs text-zinc-500 mb-1.5">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          confidenceBarBg(anomaly.confidence)
                        )}
                        style={{ width: `${anomaly.confidence}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        confidenceText(anomaly.confidence)
                      )}
                    >
                      {anomaly.confidence}%
                    </span>
                  </div>
                </div>

                {/* Status action button */}
                <button
                  onClick={() =>
                    onStatusChange(
                      anomaly.id,
                      nextAnomalyStatus(anomaly.status)
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors whitespace-nowrap"
                >
                  {nextAnomalyStatusLabel(anomaly.status)}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Compliance Tab ───────────────────────────────────────────────────────────

interface ComplianceTabProps {
  frameworks: ComplianceFramework[];
}

function ComplianceTab({ frameworks }: ComplianceTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    frameworks[0] !== undefined ? frameworks[0].id : null
  );

  return (
    <div className="flex flex-col gap-4">
      {frameworks.map((fw) => {
        const isExpanded = expandedId === fw.id;
        const avgCoverage = Math.round(
          fw.controls.reduce((sum, c) => sum + c.coverage, 0) /
            fw.controls.length
        );
        const passCount = fw.controls.filter((c) => c.status === "pass").length;
        const failCount = fw.controls.length - passCount;

        return (
          <div
            key={fw.id}
            className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
          >
            {/* Framework header — clickable */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : fw.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="text-white font-semibold">{fw.name}</span>
                <span className="text-zinc-500 text-sm">
                  {fw.controls.length} controls
                </span>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-emerald-400 text-sm font-medium">
                  {passCount} pass
                </span>
                <span className="text-rose-400 text-sm font-medium">
                  {failCount} fail
                </span>
                {/* Avg coverage bar */}
                <div className="flex items-center gap-2">
                  <div className="w-28 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        coverageBarBg(avgCoverage)
                      )}
                      style={{ width: `${avgCoverage}%` }}
                    />
                  </div>
                  <span className="text-zinc-300 text-xs font-medium w-10 text-right tabular-nums">
                    {avgCoverage}%
                  </span>
                </div>
                <span
                  className={cn(
                    "text-zinc-400 text-xs transition-transform duration-200",
                    isExpanded ? "rotate-180" : "rotate-0"
                  )}
                >
                  ▼
                </span>
              </div>
            </button>

            {/* Controls table */}
            {isExpanded && (
              <div className="border-t border-zinc-800 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-950/50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                        Control ID
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider w-48">
                        Coverage
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                        Last Tested
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fw.controls.map((ctrl, idx) => (
                      <tr
                        key={ctrl.id}
                        className={cn(
                          "border-t border-zinc-800/50",
                          idx % 2 !== 0 ? "bg-zinc-950/20" : "bg-transparent"
                        )}
                      >
                        <td className="px-5 py-3 font-mono text-indigo-300 text-xs whitespace-nowrap">
                          {ctrl.id}
                        </td>
                        <td className="px-4 py-3 text-zinc-200 whitespace-nowrap">
                          {ctrl.name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden min-w-16">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  coverageBarBg(ctrl.coverage)
                                )}
                                style={{ width: `${ctrl.coverage}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-400 w-9 text-right tabular-nums">
                              {ctrl.coverage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs font-mono whitespace-nowrap">
                          {ctrl.lastTested}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
                              ctrl.status === "pass"
                                ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                                : "text-rose-400 border-rose-400/30 bg-rose-400/10"
                            )}
                          >
                            {ctrl.status === "pass" ? "✓ Pass" : "✗ Fail"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

interface ExportTabProps {
  state: ExportState;
  onChange: (s: ExportState) => void;
}

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  JSON: "Structured JSON with full event metadata, nested objects, and type annotations.",
  CSV: "Flat CSV suitable for Excel, Google Sheets, or data pipeline ingestion.",
  SIEM: "CEF/Syslog format compatible with Splunk, Datadog, and QRadar.",
};

function ExportTab({ state, onChange }: ExportTabProps) {
  const formats: ExportFormat[] = ["JSON", "CSV", "SIEM"];

  const handleGenerate = () => {
    const snapshot = { ...state, isExporting: true };
    onChange(snapshot);
    setTimeout(() => {
      onChange({ ...snapshot, isExporting: false });
    }, 2500);
  };

  const handleQuickRange = (range: QuickRange) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - quickRangeDays(range));
    onChange({
      ...state,
      dateStart: start.toISOString().slice(0, 10),
      dateEnd: end.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left column */}
      <div className="flex flex-col gap-5">
        {/* Format selector */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">
            Export Format
          </h3>
          <div className="flex flex-col gap-2">
            {formats.map((fmt) => (
              <button
                key={fmt}
                onClick={() => onChange({ ...state, format: fmt })}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                  state.format === fmt
                    ? "bg-indigo-500/10 border-indigo-500/50"
                    : "bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600"
                )}
              >
                {/* Radio dot */}
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                    state.format === fmt
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-zinc-600"
                  )}
                >
                  {state.format === fmt && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      state.format === fmt ? "text-white" : "text-zinc-300"
                    )}
                  >
                    {fmt}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {FORMAT_DESCRIPTIONS[fmt]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Date Range</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Start Date</p>
              <input
                type="date"
                value={state.dateStart}
                onChange={(e) =>
                  onChange({ ...state, dateStart: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">End Date</p>
              <input
                type="date"
                value={state.dateEnd}
                onChange={(e) =>
                  onChange({ ...state, dateEnd: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {QUICK_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => handleQuickRange(range)}
                className="px-3 py-1 text-xs rounded bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
              >
                Last {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-5">
        {/* Saved presets */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">
            Saved Presets
          </h3>
          <div className="flex flex-col gap-2">
            {EXPORT_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => onChange({ ...state, preset })}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors",
                  state.preset === preset
                    ? "bg-indigo-500/10 border-indigo-500/40 text-white"
                    : "bg-zinc-800/30 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600"
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    state.preset === preset ? "bg-indigo-400" : "bg-zinc-600"
                  )}
                />
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Generate */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">
            Generate Export
          </h3>
          <div className="bg-zinc-950/60 rounded-lg p-3 mb-4 text-xs text-zinc-500 border border-zinc-800/80 space-y-1">
            <p>
              Format:{" "}
              <span className="text-zinc-300 font-medium">{state.format}</span>
            </p>
            <p>
              Range:{" "}
              <span className="text-zinc-300 font-medium">
                {state.dateStart || "—"} → {state.dateEnd || "—"}
              </span>
            </p>
            {state.preset !== "" && (
              <p>
                Preset:{" "}
                <span className="text-indigo-300 font-medium">
                  {state.preset}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={state.isExporting}
            className={cn(
              "w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200",
              state.isExporting
                ? "bg-indigo-600/40 text-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            )}
          >
            {state.isExporting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" />
                Preparing export…
              </span>
            ) : (
              "Generate Export"
            )}
          </button>
          {!state.isExporting && state.preset !== "" && (
            <p className="text-center text-xs text-zinc-600 mt-3">
              Will include all matching events in {state.format} format.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SecurityAuditTrail() {
  const [activeTab, setActiveTab] = useState<TabId>("events");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    severity: "all",
    category: "all",
    dateStart: "2026-02-22",
    dateEnd: "2026-02-22",
  });
  const [anomalies, setAnomalies] = useState<Anomaly[]>(INITIAL_ANOMALIES);
  const [exportState, setExportState] = useState<ExportState>({
    format: "JSON",
    dateStart: "2026-02-15",
    dateEnd: "2026-02-22",
    preset: "",
    isExporting: false,
  });

  const handleAnomalyStatusChange = (
    id: string,
    status: AnomalyStatus
  ): void => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const investigatingCount = anomalies.filter(
    (a) => a.status === "investigating"
  ).length;

  interface TabMeta {
    id: TabId;
    label: string;
    count?: number;
  }

  const tabs: TabMeta[] = [
    { id: "events", label: "Events", count: MOCK_EVENTS.length },
    {
      id: "anomalies",
      label: "Anomalies",
      count: investigatingCount,
    },
    { id: "compliance", label: "Compliance" },
    { id: "export", label: "Export" },
  ];

  const criticalCount = MOCK_EVENTS.filter(
    (e) => e.severity === "critical"
  ).length;
  const failedCount = MOCK_EVENTS.filter(
    (e) => e.outcome === "failure"
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Security Audit Trail
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Real-time event log, anomaly detection, and compliance coverage
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">Live</span>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {(
            [
              {
                label: "Total Events",
                value: String(MOCK_EVENTS.length),
                sub: "last 24h",
                color: "text-white",
              },
              {
                label: "Critical",
                value: String(criticalCount),
                sub: "need attention",
                color: "text-rose-400",
              },
              {
                label: "Failed",
                value: String(failedCount),
                sub: "outcomes",
                color: "text-amber-400",
              },
              {
                label: "Active Anomalies",
                value: String(investigatingCount),
                sub: "investigating",
                color: "text-indigo-400",
              },
            ] as Array<{
              label: string;
              value: string;
              sub: string;
              color: string;
            }>
          ).map(({ label, value, sub, color }) => (
            <div
              key={label}
              className="bg-zinc-900 rounded-xl border border-zinc-800 px-5 py-4"
            >
              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                {label}
              </p>
              <p className={cn("text-3xl font-bold tabular-nums", color)}>
                {value}
              </p>
              <p className="text-zinc-600 text-xs mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mb-6">
          {tabs.map((t) => (
            <TabButton
              key={t.id}
              tabId={t.id}
              label={t.label}
              active={activeTab === t.id}
              onClick={setActiveTab}
              count={t.count}
            />
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "events" && (
          <EventsTab
            events={MOCK_EVENTS}
            filters={filters}
            onFilterChange={setFilters}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
          />
        )}
        {activeTab === "anomalies" && (
          <AnomaliesTab
            anomalies={anomalies}
            onStatusChange={handleAnomalyStatusChange}
          />
        )}
        {activeTab === "compliance" && (
          <ComplianceTab frameworks={COMPLIANCE_FRAMEWORKS} />
        )}
        {activeTab === "export" && (
          <ExportTab state={exportState} onChange={setExportState} />
        )}
      </div>
    </div>
  );
}
