import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = "P1" | "P2" | "P3" | "P4"
type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolving"
type EventType = "detection" | "escalation" | "mitigation" | "resolution" | "comms"
type RootCause = "infra" | "code" | "config" | "external" | "human-error"
type PostmortemStatus = "resolved" | "postmortem-pending" | "postmortem-done"
type Tab = "active" | "timeline" | "history" | "metrics"
type TrendDir = "up" | "down" | "neutral"

interface ActionItem {
  id: string
  text: string
  done: boolean
}

interface TimelineEvent {
  id: string
  incidentId: string
  timestamp: string
  type: EventType
  author: string
  description: string
}

interface ActiveIncident {
  id: string
  severity: Severity
  title: string
  services: string[]
  detectedAt: string
  squad: string
  status: IncidentStatus
  description: string
  actionItems: ActionItem[]
}

interface HistoricalIncident {
  id: string
  title: string
  severity: Severity
  start: string
  end: string
  mttr: number
  services: string[]
  rootCause: RootCause
  postmortemStatus: PostmortemStatus
  rootCauseSummary: string
}

interface WeeklyBucket {
  week: string
  count: number
}

interface MonthlyBucket {
  month: string
  p1: number
  p2: number
  p3: number
  p4: number
}

interface RootCauseMetric {
  category: string
  count: number
  trend: TrendDir
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const activeIncidents: ActiveIncident[] = [
  {
    id: "INC-2026-031",
    severity: "P1",
    title: "Payment service latency spike",
    services: ["payments-api", "checkout-service", "stripe-gateway"],
    detectedAt: "2026-02-22T04:15:00Z",
    squad: "Platform Core",
    status: "investigating",
    description:
      "Payment API p99 latency exceeded 2s threshold. Stripe gateway calls timing out intermittently. ~15% of checkout flows impacted. Revenue impact estimated at $4k/min.",
    actionItems: [
      { id: "a1", text: "Check Stripe status page for upstream issues", done: true },
      { id: "a2", text: "Review DB connection pool utilization", done: false },
      { id: "a3", text: "Scale payment-api workers to 10 replicas", done: false },
      { id: "a4", text: "Notify stakeholders via status page", done: true },
    ],
  },
  {
    id: "INC-2026-030",
    severity: "P2",
    title: "Auth token refresh failure loop",
    services: ["auth-service", "user-api", "redis-session"],
    detectedAt: "2026-02-22T03:40:00Z",
    squad: "Feature Dev",
    status: "identified",
    description:
      "Subset of users hitting infinite token refresh loops on mobile clients. Root cause identified as race condition in Redis session store SETEX/GET pattern introduced in auth-service v2.4.1.",
    actionItems: [
      { id: "b1", text: "Deploy hotfix to auth-service (PR #1892 ready)", done: false },
      { id: "b2", text: "Flush affected session keys via admin script", done: false },
      { id: "b3", text: "Roll back auth-service to v2.4.0 if hotfix delayed", done: false },
    ],
  },
  {
    id: "INC-2026-029",
    severity: "P3",
    title: "Push notification delivery delays",
    services: ["notification-worker", "sns-integration", "apns"],
    detectedAt: "2026-02-22T02:10:00Z",
    squad: "Product & UI",
    status: "monitoring",
    description:
      "Push notifications delayed 5–12 minutes for iOS users. SNS queue backlog building. Non-critical user impact. Worker concurrency already increased; queue draining at ~200 msg/min.",
    actionItems: [
      { id: "c1", text: "Increase notification-worker concurrency to 20", done: true },
      { id: "c2", text: "Monitor SNS queue depth every 5 minutes", done: false },
    ],
  },
]

const timelineEvents: TimelineEvent[] = [
  {
    id: "e1",
    incidentId: "INC-2026-031",
    timestamp: "2026-02-22T04:15:00Z",
    type: "detection",
    author: "Alertmanager",
    description:
      "PagerDuty alert fired: payment-api p99_latency_ms > 2000 for 5 consecutive minutes. Alert routed to Platform Core on-call.",
  },
  {
    id: "e2",
    incidentId: "INC-2026-031",
    timestamp: "2026-02-22T04:18:00Z",
    type: "escalation",
    author: "Marcus Chen",
    description:
      "Incident declared P1 after confirming checkout failure rate at 15%. War room opened in #incident-p1-0222. CTO notified.",
  },
  {
    id: "e3",
    incidentId: "INC-2026-031",
    timestamp: "2026-02-22T04:22:00Z",
    type: "comms",
    author: "Ava Torres",
    description:
      "Customer comms drafted and approved. Status page updated: 'We are investigating payment processing delays. Checkout may be temporarily impacted.'",
  },
  {
    id: "e4",
    incidentId: "INC-2026-031",
    timestamp: "2026-02-22T04:35:00Z",
    type: "mitigation",
    author: "Marcus Chen",
    description:
      "Scaled payment-api from 3 to 8 replicas. Increased DB connection pool from 20 to 50. P99 latency dropping: 2100ms → 1400ms.",
  },
  {
    id: "e5",
    incidentId: "INC-2026-031",
    timestamp: "2026-02-22T04:47:00Z",
    type: "comms",
    author: "Ava Torres",
    description:
      "Status page update: 'Mitigation in progress. Payment processing is recovering. Monitoring for full resolution.'",
  },
  {
    id: "e6",
    incidentId: "INC-2026-031",
    timestamp: "2026-02-22T04:55:00Z",
    type: "mitigation",
    author: "Raj Patel",
    description:
      "Stripe gateway retry config adjusted. Exponential backoff added. Dead letter queue cleared (1,240 messages replayed). Error rate below 1%.",
  },
  {
    id: "e7",
    incidentId: "INC-2026-030",
    timestamp: "2026-02-22T03:40:00Z",
    type: "detection",
    author: "Alertmanager",
    description:
      "Error rate spike on auth-service: token_refresh_error_rate > 5% for 3 minutes. Alert: mobile-auth-failures-high.",
  },
  {
    id: "e8",
    incidentId: "INC-2026-030",
    timestamp: "2026-02-22T03:45:00Z",
    type: "escalation",
    author: "Dev On-Call",
    description:
      "P2 declared. Auth team lead looped in. Impact scoped to ~800 users on auth-service v2.4.1 deployed 6h ago.",
  },
  {
    id: "e9",
    incidentId: "INC-2026-030",
    timestamp: "2026-02-22T03:52:00Z",
    type: "mitigation",
    author: "Sofia Reyes",
    description:
      "Race condition identified in Redis SETEX + GET pattern in refreshToken(). Hotfix branch created, PR #1892 open for review.",
  },
  {
    id: "e10",
    incidentId: "INC-2026-029",
    timestamp: "2026-02-22T02:10:00Z",
    type: "detection",
    author: "Alertmanager",
    description:
      "SNS queue depth exceeded 10,000 messages. notification-worker p50 processing time > 300s. Alert: sns-queue-depth-critical.",
  },
]

const historicalIncidents: HistoricalIncident[] = [
  {
    id: "INC-2026-028",
    title: "Database primary failover",
    severity: "P1",
    start: "2026-02-10T14:20:00Z",
    end: "2026-02-10T15:45:00Z",
    mttr: 85,
    services: ["postgres-primary", "api-gateway"],
    rootCause: "infra",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Primary RDS instance hit max connections due to connection leak in ORM v3.1. Automatic failover to standby completed in 47s. Root fix: connection pool limits enforced globally, ORM upgraded to v3.2.",
  },
  {
    id: "INC-2026-027",
    title: "CDN cache poisoning",
    severity: "P2",
    start: "2026-02-08T09:15:00Z",
    end: "2026-02-08T10:30:00Z",
    mttr: 75,
    services: ["cdn", "static-assets"],
    rootCause: "config",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Misconfigured cache-control headers allowed stale auth tokens to be cached at edge nodes. Config corrected, full CDN cache purge executed, Vary: Authorization header enforced.",
  },
  {
    id: "INC-2026-026",
    title: "Search indexing lag > 20min",
    severity: "P3",
    start: "2026-02-06T11:00:00Z",
    end: "2026-02-06T12:20:00Z",
    mttr: 80,
    services: ["elasticsearch", "indexer-worker"],
    rootCause: "infra",
    postmortemStatus: "resolved",
    rootCauseSummary:
      "Elasticsearch shard rebalancing starved the indexer during heavy write load. Heap increased to 16GB, shard count reduced. Indexer backpressure added.",
  },
  {
    id: "INC-2026-025",
    title: "Webhook delivery failures (TLS)",
    severity: "P2",
    start: "2026-02-04T16:30:00Z",
    end: "2026-02-04T17:45:00Z",
    mttr: 75,
    services: ["webhook-service", "outbound-http"],
    rootCause: "external",
    postmortemStatus: "postmortem-pending",
    rootCauseSummary:
      "Third-party updated their TLS cert to use SHA-384. Our CA bundle was pinned to older SHA-256. Updated CA bundle deployed. Cert-pinning policy reviewed.",
  },
  {
    id: "INC-2026-024",
    title: "Login rate limiter misconfiguration",
    severity: "P2",
    start: "2026-02-02T08:00:00Z",
    end: "2026-02-02T08:55:00Z",
    mttr: 55,
    services: ["auth-service", "rate-limiter"],
    rootCause: "human-error",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Operator deployed wrong config env (staging values to prod). Rate limit set to 1 req/min. Detected via alert within 4min. Immediate rollback. Config deploy now requires two-person approval.",
  },
  {
    id: "INC-2026-023",
    title: "API gateway timeout cascade",
    severity: "P1",
    start: "2026-01-28T22:10:00Z",
    end: "2026-01-29T00:20:00Z",
    mttr: 130,
    services: ["api-gateway", "user-service", "catalog-api"],
    rootCause: "code",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Unguarded N+1 query in catalog endpoint introduced in v4.2.0 caused timeout cascade under Black Friday traffic. Circuit breaker tripped. Endpoint patched and circuit breaker sensitivity tuned.",
  },
  {
    id: "INC-2026-022",
    title: "APNS cert expiry — mobile push down",
    severity: "P3",
    start: "2026-01-25T06:00:00Z",
    end: "2026-01-25T07:10:00Z",
    mttr: 70,
    services: ["notification-worker", "apns"],
    rootCause: "human-error",
    postmortemStatus: "resolved",
    rootCauseSummary:
      "APNS certificate expired without alerting. Certificate renewed in 65 minutes. Cert expiry monitoring added with 30-day and 7-day advance alerts.",
  },
  {
    id: "INC-2026-021",
    title: "S3 upload permission denied spike",
    severity: "P3",
    start: "2026-01-22T13:45:00Z",
    end: "2026-01-22T14:30:00Z",
    mttr: 45,
    services: ["media-service", "s3-gateway"],
    rootCause: "config",
    postmortemStatus: "resolved",
    rootCauseSummary:
      "IAM policy rotation script accidentally removed s3:PutObject from media-service role. Fixed. IAM rotation now runs in dry-run mode first with diff review.",
  },
  {
    id: "INC-2026-020",
    title: "Billing proration calculation errors",
    severity: "P1",
    start: "2026-01-18T10:00:00Z",
    end: "2026-01-18T12:15:00Z",
    mttr: 135,
    services: ["billing-service", "pricing-engine"],
    rootCause: "code",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Floating-point rounding error in proration logic for mid-cycle upgrades. Affected ~200 invoices with incorrect charges. Corrected and reprocessed with customer notifications.",
  },
  {
    id: "INC-2026-019",
    title: "Job queue consumer crash loop",
    severity: "P2",
    start: "2026-01-15T17:30:00Z",
    end: "2026-01-15T18:20:00Z",
    mttr: 50,
    services: ["job-queue", "worker-pool"],
    rootCause: "code",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Null pointer exception in message deserializer crashed consumers on malformed messages. Consumer stuck in restart loop. Added validation, dead-letter routing, and max-retry limit.",
  },
  {
    id: "INC-2026-018",
    title: "CoreDNS OOMKill — resolution failure",
    severity: "P1",
    start: "2026-01-10T03:00:00Z",
    end: "2026-01-10T03:50:00Z",
    mttr: 50,
    services: ["dns", "api-gateway", "auth-service"],
    rootCause: "infra",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "CoreDNS pod OOMKilled due to memory leak in custom metrics plugin. Cluster-wide DNS resolution failed for 47 minutes. Rolled back plugin, increased resource limits.",
  },
  {
    id: "INC-2026-017",
    title: "Feature flag service degraded",
    severity: "P3",
    start: "2026-01-08T09:20:00Z",
    end: "2026-01-08T10:00:00Z",
    mttr: 40,
    services: ["feature-flags", "config-api"],
    rootCause: "infra",
    postmortemStatus: "resolved",
    rootCauseSummary:
      "Redis cluster failover during flag service rolling restart. Flag service lacked retry logic. Added exponential backoff retries and static fallback defaults.",
  },
  {
    id: "INC-2026-016",
    title: "Analytics pipeline stall (off-hours)",
    severity: "P4",
    start: "2026-01-05T00:00:00Z",
    end: "2026-01-05T04:00:00Z",
    mttr: 240,
    services: ["clickhouse", "event-pipeline"],
    rootCause: "infra",
    postmortemStatus: "resolved",
    rootCauseSummary:
      "ClickHouse compaction job blocked event ingestion during off-peak hours. Compaction schedule adjusted to avoid peak and near-peak windows.",
  },
  {
    id: "INC-2025-189",
    title: "OAuth callback CSRF vulnerability",
    severity: "P2",
    start: "2025-12-30T14:00:00Z",
    end: "2025-12-30T14:40:00Z",
    mttr: 40,
    services: ["auth-service", "oauth-provider"],
    rootCause: "code",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "State parameter not validated in OAuth callback handler. Patched immediately. Security audit of all auth flows scheduled. Pen test conducted.",
  },
  {
    id: "INC-2025-188",
    title: "Canary deployment crashed production",
    severity: "P2",
    start: "2025-12-27T11:00:00Z",
    end: "2025-12-27T11:50:00Z",
    mttr: 50,
    services: ["api-gateway", "k8s-rollout"],
    rootCause: "human-error",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Canary deployed without readiness probes. Traffic routed to unhealthy pods. Readiness probes now mandatory in deploy pipeline; missing probes fail CI.",
  },
  {
    id: "INC-2025-187",
    title: "SendGrid IP blacklisted",
    severity: "P3",
    start: "2025-12-20T08:00:00Z",
    end: "2025-12-20T10:30:00Z",
    mttr: 150,
    services: ["email-service", "sendgrid"],
    rootCause: "external",
    postmortemStatus: "resolved",
    rootCauseSummary:
      "Sending IP blacklisted due to automated spam report surge from user-generated content. Migrated to dedicated IP with IP warming strategy. Content moderation improved.",
  },
  {
    id: "INC-2025-186",
    title: "Report generation OOM",
    severity: "P3",
    start: "2025-12-15T13:00:00Z",
    end: "2025-12-15T14:00:00Z",
    mttr: 60,
    services: ["reporting-service"],
    rootCause: "code",
    postmortemStatus: "postmortem-pending",
    rootCauseSummary:
      "Large reports loaded entire dataset into memory before streaming. Server OOMed at ~4GB. Pagination added, streaming CSV enabled, report size limits enforced.",
  },
  {
    id: "INC-2025-185",
    title: "MFA bypass race condition",
    severity: "P1",
    start: "2025-12-10T09:00:00Z",
    end: "2025-12-10T10:30:00Z",
    mttr: 90,
    services: ["auth-service", "mfa-provider"],
    rootCause: "code",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Race condition in MFA verification allowed bypass under specific timing window. Patched with atomic token consumption. Third-party security audit conducted. No evidence of exploitation.",
  },
  {
    id: "INC-2025-184",
    title: "S3 lifecycle misconfiguration — quota exceeded",
    severity: "P2",
    start: "2025-12-05T15:00:00Z",
    end: "2025-12-05T16:30:00Z",
    mttr: 90,
    services: ["media-service", "s3-gateway"],
    rootCause: "config",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "S3 lifecycle policy missing expiry rules for old versions. 2TB of stale versions accumulated. Versioning retention limits corrected. S3 cost alerts added.",
  },
  {
    id: "INC-2025-183",
    title: "Scheduler double-firing batch jobs",
    severity: "P2",
    start: "2025-12-01T06:00:00Z",
    end: "2025-12-01T07:00:00Z",
    mttr: 60,
    services: ["scheduler", "job-queue"],
    rootCause: "code",
    postmortemStatus: "postmortem-done",
    rootCauseSummary:
      "Distributed lock not acquired before job dispatch during scheduler leader election. Jobs fired 2–3x. Added idempotency keys and distributed lock via Redis SETNX.",
  },
]

const weeklyData: WeeklyBucket[] = [
  { week: "Jan 5", count: 4 },
  { week: "Jan 12", count: 2 },
  { week: "Jan 19", count: 5 },
  { week: "Jan 26", count: 3 },
  { week: "Feb 2", count: 6 },
  { week: "Feb 9", count: 4 },
  { week: "Feb 16", count: 3 },
  { week: "Feb 22", count: 2 },
]

const severityMonthly: MonthlyBucket[] = [
  { month: "Sep", p1: 2, p2: 3, p3: 4, p4: 1 },
  { month: "Oct", p1: 1, p2: 4, p3: 5, p4: 2 },
  { month: "Nov", p1: 3, p2: 2, p3: 3, p4: 0 },
  { month: "Dec", p1: 2, p2: 5, p3: 6, p4: 1 },
  { month: "Jan", p1: 1, p2: 3, p3: 4, p4: 1 },
  { month: "Feb", p1: 2, p2: 4, p3: 3, p4: 0 },
]

const rootCauseMetrics: RootCauseMetric[] = [
  { category: "Infrastructure", count: 8, trend: "up" },
  { category: "Code Bug", count: 7, trend: "down" },
  { category: "Configuration", count: 5, trend: "neutral" },
  { category: "Human Error", count: 4, trend: "down" },
  { category: "External Dependency", count: 2, trend: "neutral" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(severity: Severity): string {
  if (severity === "P1") {return "text-rose-400"}
  if (severity === "P2") {return "text-amber-400"}
  if (severity === "P3") {return "text-indigo-400"}
  return "text-[var(--color-text-secondary)]"
}

function severityBadgeCn(severity: Severity): string {
  if (severity === "P1") {return "bg-rose-400/10 border border-rose-400/30 text-rose-400"}
  if (severity === "P2") {return "bg-amber-400/10 border border-amber-400/30 text-amber-400"}
  if (severity === "P3") {return "bg-indigo-400/10 border border-indigo-400/30 text-indigo-400"}
  return "bg-[var(--color-surface-3)]/30 border border-[var(--color-surface-3)] text-[var(--color-text-secondary)]"
}

function statusColor(status: IncidentStatus): string {
  if (status === "investigating") {return "text-rose-400"}
  if (status === "identified") {return "text-amber-400"}
  if (status === "monitoring") {return "text-indigo-400"}
  return "text-emerald-400"
}

function eventBorderCn(type: EventType): string {
  if (type === "detection") {return "border-l-rose-400"}
  if (type === "escalation") {return "border-l-amber-400"}
  if (type === "mitigation") {return "border-l-indigo-400"}
  if (type === "resolution") {return "border-l-emerald-400"}
  return "border-l-zinc-500"
}

function eventBadgeCn(type: EventType): string {
  if (type === "detection") {return "bg-rose-400/10 text-rose-400"}
  if (type === "escalation") {return "bg-amber-400/10 text-amber-400"}
  if (type === "mitigation") {return "bg-indigo-400/10 text-indigo-400"}
  if (type === "resolution") {return "bg-emerald-400/10 text-emerald-400"}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
}

function postmortemBadgeCn(s: PostmortemStatus): string {
  if (s === "postmortem-pending") {return "bg-amber-400/10 text-amber-400"}
  if (s === "postmortem-done") {return "bg-emerald-400/10 text-emerald-400"}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]"
}

const rootCauseLabels: Record<RootCause, string> = {
  infra: "Infrastructure",
  code: "Code Bug",
  config: "Configuration",
  external: "External",
  "human-error": "Human Error",
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function timeOpen(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) {return `${mins}m`}
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hrs}h ${rem}m`
}

function postmortemLabel(s: PostmortemStatus): string {
  if (s === "postmortem-pending") {return "Postmortem Pending"}
  if (s === "postmortem-done") {return "Postmortem Done"}
  return "Resolved"
}

// ─── Tab: Active ─────────────────────────────────────────────────────────────

function ActiveTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>("all")

  const severityOptions: Array<"all" | Severity> = ["all", "P1", "P2", "P3", "P4"]
  const filtered = activeIncidents.filter(
    (i) => severityFilter === "all" || i.severity === severityFilter
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[var(--color-text-secondary)] text-sm">Filter:</span>
        {severityOptions.map((sv) => (
          <button
            key={sv}
            onClick={() => setSeverityFilter(sv)}
            className={cn(
              "px-3 py-1 rounded-md text-sm font-medium transition-colors",
              severityFilter === sv
                ? "bg-indigo-500 text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]"
            )}
          >
            {sv === "all" ? "All" : sv}
          </button>
        ))}
        <span className="ml-auto text-[var(--color-text-secondary)] text-sm">{filtered.length} incident{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.map((incident) => (
        <div key={incident.id} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)]">
          <button
            className="w-full text-left p-4"
            onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
          >
            <div className="flex items-start gap-3 flex-wrap">
              <span className={cn("px-2 py-0.5 rounded text-xs font-bold shrink-0", severityBadgeCn(incident.severity))}>
                {incident.severity}
              </span>
              <span className="text-[var(--color-text-primary)] font-medium flex-1">{incident.title}</span>
              <span className={cn("text-xs font-medium capitalize shrink-0", statusColor(incident.status))}>
                ● {incident.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-[var(--color-text-secondary)]">
              <span>🕒 {fmtDate(incident.detectedAt)} {fmtTime(incident.detectedAt)}</span>
              <span>⏱ Open {timeOpen(incident.detectedAt)}</span>
              <span>👥 {incident.squad}</span>
              <span>🔧 {incident.services.join(", ")}</span>
            </div>
          </button>

          {expandedId === incident.id && (
            <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-4">
              <p className="text-[var(--color-text-primary)] text-sm leading-relaxed">{incident.description}</p>

              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2 font-semibold">Action Items</div>
                <div className="space-y-1.5">
                  {incident.actionItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span className={cn("mt-0.5 shrink-0", item.done ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
                        {item.done ? "✓" : "○"}
                      </span>
                      <span className={item.done ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2 font-semibold">Status Flow</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(["investigating", "identified", "monitoring", "resolving"] as IncidentStatus[]).map((s, i) => (
                    <React.Fragment key={s}>
                      <span className={cn("text-xs capitalize px-2 py-0.5 rounded-md bg-[var(--color-surface-2)]", statusColor(s))}>
                        {s}
                      </span>
                      {i < 3 && <span className="text-[var(--color-text-muted)] text-xs">→</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
          No active {severityFilter !== "all" ? severityFilter : ""} incidents
        </div>
      )}
    </div>
  )
}

// ─── Tab: Timeline ────────────────────────────────────────────────────────────

function TimelineTab() {
  const [selectedId, setSelectedId] = useState<string>("INC-2026-031")
  const [newDesc, setNewDesc] = useState<string>("")
  const [newType, setNewType] = useState<EventType>("comms")
  const [events, setEvents] = useState<TimelineEvent[]>(timelineEvents)

  const visibleEvents = events.filter((e) => e.incidentId === selectedId)
  const eventTypes: EventType[] = ["detection", "escalation", "mitigation", "resolution", "comms"]

  function handleAdd() {
    if (!newDesc.trim()) {return}
    const ev: TimelineEvent = {
      id: `e-${Date.now()}`,
      incidentId: selectedId,
      timestamp: new Date().toISOString(),
      type: newType,
      author: "You",
      description: newDesc.trim(),
    }
    setEvents((prev) => [...prev, ev])
    setNewDesc("")
  }

  return (
    <div className="flex gap-5">
      {/* Incident selector */}
      <div className="w-52 shrink-0 space-y-2">
        <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">Incidents</div>
        {activeIncidents.map((inc) => (
          <button
            key={inc.id}
            onClick={() => setSelectedId(inc.id)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-colors",
              selectedId === inc.id
                ? "bg-indigo-500/10 border-indigo-500/40 text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs font-bold", severityColor(inc.severity))}>{inc.severity}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{inc.id.slice(-3)}</span>
            </div>
            <div className="text-xs leading-tight">{inc.title}</div>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-primary)] text-sm font-medium">
            {activeIncidents.find((i) => i.id === selectedId)?.title}
          </span>
          <span className="text-[var(--color-text-muted)] text-xs">— {visibleEvents.length} events</span>
        </div>

        <div className="space-y-3">
          {visibleEvents.map((ev) => (
            <div
              key={ev.id}
              className={cn(
                "bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] border-l-4 p-3",
                eventBorderCn(ev.type)
              )}
            >
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={cn("text-xs px-2 py-0.5 rounded font-medium capitalize", eventBadgeCn(ev.type))}>
                  {ev.type}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {fmtDate(ev.timestamp)} {fmtTime(ev.timestamp)}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">by {ev.author}</span>
              </div>
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{ev.description}</p>
            </div>
          ))}

          {visibleEvents.length === 0 && (
            <div className="text-center py-10 text-[var(--color-text-muted)] text-sm">No events for this incident yet</div>
          )}
        </div>

        {/* Add event */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 space-y-3">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Add Event</div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as EventType)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md text-sm text-[var(--color-text-primary)] px-2 py-1.5 shrink-0"
            >
              {eventTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") {handleAdd()} }}
              placeholder="Describe what happened…"
              className="flex-1 min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md text-sm text-[var(--color-text-primary)] px-3 py-1.5 placeholder:text-[var(--color-text-muted)]"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-[var(--color-text-primary)] text-sm rounded-md transition-colors shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const maxWeekly = Math.max(...weeklyData.map((w) => w.count))

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
        <div className="text-sm text-[var(--color-text-primary)] font-medium mb-4">Incidents per Week (last 8 weeks)</div>
        <div className="flex items-end gap-2" style={{ height: "120px" }}>
          {weeklyData.map((d) => (
            <div key={d.week} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-xs text-[var(--color-text-secondary)]">{d.count}</span>
              <div
                className="w-full bg-indigo-500/70 hover:bg-indigo-400/70 transition-colors rounded-t-sm"
                style={{ height: `${(d.count / maxWeekly) * 80}px` }}
              />
              <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap" style={{ fontSize: "10px" }}>{d.week}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["ID", "Title", "Sev", "Start", "End", "MTTR", "Root Cause", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historicalIncidents.map((inc) => (
                <React.Fragment key={inc.id}>
                  <tr
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                  >
                    <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs whitespace-nowrap">{inc.id}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)] whitespace-nowrap max-w-xs truncate">{inc.title}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-bold text-xs", severityColor(inc.severity))}>{inc.severity}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{fmtDate(inc.start)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{fmtDate(inc.end)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)] whitespace-nowrap">{inc.mttr}m</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{rootCauseLabels[inc.rootCause]}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded", postmortemBadgeCn(inc.postmortemStatus))}>
                        {postmortemLabel(inc.postmortemStatus)}
                      </span>
                    </td>
                  </tr>
                  {expandedId === inc.id && (
                    <tr className="bg-[var(--color-surface-2)]/20">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Root Cause Summary</div>
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-2">{inc.rootCauseSummary}</p>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Services affected: {inc.services.join(", ")}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Metrics ─────────────────────────────────────────────────────────────

function MetricsTab() {
  const maxMonthly = Math.max(...severityMonthly.map((m) => m.p1 + m.p2 + m.p3 + m.p4))
  const chartHeight = 128
  const rootTotal = rootCauseMetrics.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Avg MTTR", value: "74m", sub: "mean time to resolve", accent: "text-indigo-400" },
          { label: "Avg MTTD", value: "8m", sub: "mean time to detect", accent: "text-emerald-400" },
          { label: "P1s This Month", value: "2", sub: "February 2026", accent: "text-rose-400" },
          { label: "Avg / Week", value: "3.6", sub: "incidents per week (12w avg)", accent: "text-amber-400" },
        ].map((card) => (
          <div key={card.label} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2 font-semibold">{card.label}</div>
            <div className={cn("text-3xl font-bold", card.accent)}>{card.value}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Severity stacked bar chart */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
        <div className="text-sm text-[var(--color-text-primary)] font-medium mb-1">Incidents by Severity (last 6 months)</div>
        <div className="flex gap-4 mb-4 flex-wrap">
          {[
            { label: "P1", cn: "bg-rose-400/70" },
            { label: "P2", cn: "bg-amber-400/70" },
            { label: "P3", cn: "bg-indigo-400/70" },
            { label: "P4", cn: "bg-[var(--color-surface-3)]" },
          ].map((leg) => (
            <span key={leg.label} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <span className={cn("w-3 h-3 rounded-sm inline-block", leg.cn)} />
              {leg.label}
            </span>
          ))}
        </div>
        <div className="flex items-end gap-3" style={{ height: `${chartHeight + 32}px` }}>
          {severityMonthly.map((m) => {
            const total = m.p1 + m.p2 + m.p3 + m.p4
            const scale = (n: number) => Math.round((n / maxMonthly) * chartHeight)
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--color-text-secondary)]">{total}</span>
                <div
                  className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden"
                  style={{ height: `${chartHeight}px` }}
                >
                  {m.p4 > 0 && <div className="w-full bg-[var(--color-surface-3)] shrink-0" style={{ height: `${scale(m.p4)}px` }} />}
                  {m.p3 > 0 && <div className="w-full bg-indigo-400/70 shrink-0" style={{ height: `${scale(m.p3)}px` }} />}
                  {m.p2 > 0 && <div className="w-full bg-amber-400/70 shrink-0" style={{ height: `${scale(m.p2)}px` }} />}
                  {m.p1 > 0 && <div className="w-full bg-rose-400/70 shrink-0" style={{ height: `${scale(m.p1)}px` }} />}
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{m.month}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Root cause table */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm text-[var(--color-text-primary)] font-medium">
          Root Cause Categories
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["Category", "Count", "Share", "Trend (6mo)"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rootCauseMetrics.map((rc) => {
              const pct = Math.round((rc.count / rootTotal) * 100)
              return (
                <tr key={rc.category} className="border-b border-[var(--color-border)]">
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{rc.category}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">{rc.count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden" style={{ width: "72px" }}>
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {rc.trend === "up" && <span className="text-rose-400 font-bold">↑ rising</span>}
                    {rc.trend === "down" && <span className="text-emerald-400 font-bold">↓ falling</span>}
                    {rc.trend === "neutral" && <span className="text-[var(--color-text-muted)]">→ stable</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function IncidentTimeline() {
  const [tab, setTab] = useState<Tab>("active")

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: "active", label: "Active", badge: activeIncidents.length },
    { id: "timeline", label: "Timeline" },
    { id: "history", label: "History", badge: historicalIncidents.length },
    { id: "metrics", label: "Metrics" },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Incident Timeline</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Incident management &amp; postmortem tracker — Horizon Admin</p>
          </div>
          <div className="flex items-center gap-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[var(--color-text-secondary)]">
              {activeIncidents.length} active
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[var(--color-surface-1)] p-1 rounded-lg border border-[var(--color-border)] w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                tab === t.id
                  ? "bg-indigo-500 text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t.label}
              {t.badge !== undefined && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    tab === t.id ? "bg-indigo-400/40" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {tab === "active" && <ActiveTab />}
          {tab === "timeline" && <TimelineTab />}
          {tab === "history" && <HistoryTab />}
          {tab === "metrics" && <MetricsTab />}
        </div>
      </div>
    </div>
  )
}
