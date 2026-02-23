import React, { useState } from "react";
import { cn } from "../lib/utils";

// ============================================================
// TYPES
// ============================================================

type Environment = "dev" | "staging" | "prod";
type Severity = "critical" | "warning" | "info";
type DriftStatus = "drifted" | "resolved" | "ignored";
type Tab = "overview" | "details" | "history" | "policies";
type Category =
  | "database"
  | "api"
  | "auth"
  | "cache"
  | "feature-flags"
  | "networking"
  | "logging"
  | "secrets";
type SortKey = "severity" | "recent" | "key";
type HistoryAction = "changed" | "resolved" | "added" | "removed" | "ignored";
type PolicySection = "policies" | "ignore-rules";

interface EnvValues {
  dev: string | null;
  staging: string | null;
  prod: string | null;
}

interface DriftEntry {
  id: string;
  key: string;
  category: Category;
  severity: Severity;
  status: DriftStatus;
  values: EnvValues;
  detectedAt: string;
  lastChangedBy: string;
  description: string;
  expectedValue: string;
}

interface HistoryEvent {
  id: string;
  timestamp: string;
  actor: string;
  environment: Environment;
  configKey: string;
  oldValue: string;
  newValue: string;
  severity: Severity;
  action: HistoryAction;
  comment: string;
}

interface Policy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: Category | "all";
  severity: Severity;
  environments: Environment[];
  threshold: number;
  ignorePatterns: string[];
  lastTriggered: string | null;
  triggerCount: number;
}

interface IgnoreRule {
  id: string;
  pattern: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  matchCount: number;
  enabled: boolean;
}

// ============================================================
// DUMMY DATA
// ============================================================

const DRIFT_DATA: DriftEntry[] = [
  {
    id: "d001",
    key: "DATABASE_CONNECTION_POOL_SIZE",
    category: "database",
    severity: "critical",
    status: "drifted",
    values: { dev: "10", staging: "25", prod: "100" },
    detectedAt: "2026-02-22T04:15:00Z",
    lastChangedBy: "sarah.chen@company.com",
    description:
      "Connection pool size differs significantly across environments, risking prod performance degradation during load.",
    expectedValue: "100",
  },
  {
    id: "d002",
    key: "REDIS_CLUSTER_ENABLED",
    category: "cache",
    severity: "critical",
    status: "drifted",
    values: { dev: "false", staging: "false", prod: "true" },
    detectedAt: "2026-02-21T18:45:00Z",
    lastChangedBy: "ops-bot@company.com",
    description:
      "Redis clustering is disabled in dev/staging but enabled in prod — cluster-related bugs will only surface in production.",
    expectedValue: "true",
  },
  {
    id: "d003",
    key: "JWT_EXPIRY_SECONDS",
    category: "auth",
    severity: "critical",
    status: "drifted",
    values: { dev: "86400", staging: "3600", prod: "900" },
    detectedAt: "2026-02-22T01:30:00Z",
    lastChangedBy: "alex.rodriguez@company.com",
    description:
      "JWT expiry times vary wildly — dev sessions last 24h while prod expires in 15 min, masking auth timeout bugs during development.",
    expectedValue: "900",
  },
  {
    id: "d004",
    key: "API_RATE_LIMIT_RPM",
    category: "api",
    severity: "warning",
    status: "drifted",
    values: { dev: "10000", staging: "5000", prod: "1000" },
    detectedAt: "2026-02-21T22:10:00Z",
    lastChangedBy: "platform-team@company.com",
    description:
      "Rate limiting thresholds don't match — services tested under lenient limits may fail under production restrictions.",
    expectedValue: "1000",
  },
  {
    id: "d005",
    key: "FEATURE_FLAG_DARK_MODE",
    category: "feature-flags",
    severity: "info",
    status: "drifted",
    values: { dev: "true", staging: "true", prod: "false" },
    detectedAt: "2026-02-20T14:00:00Z",
    lastChangedBy: "product-team@company.com",
    description: "Dark mode feature flag not yet enabled in production — pending UX sign-off.",
    expectedValue: "false",
  },
  {
    id: "d006",
    key: "LOG_LEVEL",
    category: "logging",
    severity: "warning",
    status: "drifted",
    values: { dev: "debug", staging: "info", prod: "warn" },
    detectedAt: "2026-02-19T09:00:00Z",
    lastChangedBy: "dev-ops@company.com",
    description:
      "Log verbosity levels differ — debug logs in dev may mask performance issues not visible in prod.",
    expectedValue: "warn",
  },
  {
    id: "d007",
    key: "SMTP_TLS_ENABLED",
    category: "networking",
    severity: "critical",
    status: "drifted",
    values: { dev: "false", staging: "true", prod: "true" },
    detectedAt: "2026-02-22T03:45:00Z",
    lastChangedBy: "security-team@company.com",
    description:
      "TLS disabled in dev — email security behavior untested against production configuration.",
    expectedValue: "true",
  },
  {
    id: "d008",
    key: "S3_BUCKET_VERSIONING",
    category: "api",
    severity: "warning",
    status: "drifted",
    values: { dev: "false", staging: "false", prod: "true" },
    detectedAt: "2026-02-21T11:20:00Z",
    lastChangedBy: "infra-bot@company.com",
    description:
      "S3 versioning enabled only in prod — data recovery scenarios cannot be tested in lower environments.",
    expectedValue: "true",
  },
  {
    id: "d009",
    key: "MAX_UPLOAD_SIZE_MB",
    category: "api",
    severity: "info",
    status: "resolved",
    values: { dev: "50", staging: "50", prod: "50" },
    detectedAt: "2026-02-18T10:30:00Z",
    lastChangedBy: "backend-team@company.com",
    description: "Upload size limits now standardized across all environments.",
    expectedValue: "50",
  },
  {
    id: "d010",
    key: "CORS_ALLOWED_ORIGINS",
    category: "networking",
    severity: "warning",
    status: "drifted",
    values: { dev: "*", staging: "https://staging.example.com", prod: "https://example.com" },
    detectedAt: "2026-02-20T16:30:00Z",
    lastChangedBy: "security-team@company.com",
    description:
      "Wildcard CORS in dev doesn't reflect production restrictions — CORS bugs will only surface in production.",
    expectedValue: "https://example.com",
  },
  {
    id: "d011",
    key: "DB_QUERY_TIMEOUT_MS",
    category: "database",
    severity: "warning",
    status: "drifted",
    values: { dev: "30000", staging: "10000", prod: "5000" },
    detectedAt: "2026-02-21T07:15:00Z",
    lastChangedBy: "dba-team@company.com",
    description:
      "Query timeouts are much looser in dev — slow queries won't be caught during development.",
    expectedValue: "5000",
  },
  {
    id: "d012",
    key: "FEATURE_FLAG_AI_SEARCH",
    category: "feature-flags",
    severity: "info",
    status: "drifted",
    values: { dev: "true", staging: "false", prod: "false" },
    detectedAt: "2026-02-22T00:00:00Z",
    lastChangedBy: "ai-team@company.com",
    description: "AI search feature in active dev — not ready for staging or production rollout.",
    expectedValue: "false",
  },
  {
    id: "d013",
    key: "SECRET_ROTATION_INTERVAL_DAYS",
    category: "secrets",
    severity: "critical",
    status: "drifted",
    values: { dev: "365", staging: "90", prod: "30" },
    detectedAt: "2026-02-21T14:00:00Z",
    lastChangedBy: "security-bot@company.com",
    description:
      "Secret rotation intervals differ greatly — dev secrets outlast prod rotation policy by 12x.",
    expectedValue: "30",
  },
  {
    id: "d014",
    key: "CACHE_TTL_SECONDS",
    category: "cache",
    severity: "warning",
    status: "ignored",
    values: { dev: "60", staging: "300", prod: "3600" },
    detectedAt: "2026-02-19T13:00:00Z",
    lastChangedBy: "cache-team@company.com",
    description:
      "Cache TTL intentionally lower in dev for faster iteration — marked as ignored drift.",
    expectedValue: "3600",
  },
  {
    id: "d015",
    key: "OAUTH_PKCE_REQUIRED",
    category: "auth",
    severity: "critical",
    status: "drifted",
    values: { dev: "false", staging: "false", prod: "true" },
    detectedAt: "2026-02-21T20:00:00Z",
    lastChangedBy: "security-team@company.com",
    description:
      "PKCE enforcement disabled in dev/staging — OAuth flow security untested against production requirements.",
    expectedValue: "true",
  },
  {
    id: "d016",
    key: "ENABLE_REQUEST_SIGNING",
    category: "api",
    severity: "critical",
    status: "drifted",
    values: { dev: "false", staging: "true", prod: "true" },
    detectedAt: "2026-02-20T10:00:00Z",
    lastChangedBy: "platform-team@company.com",
    description:
      "Request signing disabled in dev — API authentication bugs won't be caught before production.",
    expectedValue: "true",
  },
  {
    id: "d017",
    key: "DB_REPLICA_READ_ENABLED",
    category: "database",
    severity: "warning",
    status: "drifted",
    values: { dev: "false", staging: "false", prod: "true" },
    detectedAt: "2026-02-19T15:30:00Z",
    lastChangedBy: "dba-team@company.com",
    description:
      "Read replicas enabled in prod only — replica lag issues untestable in lower environments.",
    expectedValue: "true",
  },
  {
    id: "d018",
    key: "ALERT_WEBHOOK_URL",
    category: "networking",
    severity: "info",
    status: "drifted",
    values: {
      dev: "https://hooks.dev.example.com/alerts",
      staging: "https://hooks.staging.example.com/alerts",
      prod: "https://hooks.example.com/alerts",
    },
    detectedAt: "2026-02-18T08:00:00Z",
    lastChangedBy: "platform-team@company.com",
    description: "Webhook URLs differ by environment — this is expected and intentional.",
    expectedValue: "https://hooks.example.com/alerts",
  },
];

const HISTORY_DATA: HistoryEvent[] = [
  {
    id: "h001",
    timestamp: "2026-02-22T04:15:00Z",
    actor: "sarah.chen@company.com",
    environment: "staging",
    configKey: "DATABASE_CONNECTION_POOL_SIZE",
    oldValue: "10",
    newValue: "25",
    severity: "critical",
    action: "changed",
    comment: "Increasing pool size to handle load test requirements for Q1 launch.",
  },
  {
    id: "h002",
    timestamp: "2026-02-22T03:45:00Z",
    actor: "security-team@company.com",
    environment: "dev",
    configKey: "SMTP_TLS_ENABLED",
    oldValue: "true",
    newValue: "false",
    severity: "critical",
    action: "changed",
    comment: "Disabled TLS in dev for local mail testing with Mailhog.",
  },
  {
    id: "h003",
    timestamp: "2026-02-22T01:30:00Z",
    actor: "alex.rodriguez@company.com",
    environment: "dev",
    configKey: "JWT_EXPIRY_SECONDS",
    oldValue: "3600",
    newValue: "86400",
    severity: "critical",
    action: "changed",
    comment: "Extended JWT expiry in dev to avoid constant re-login during feature development.",
  },
  {
    id: "h004",
    timestamp: "2026-02-22T00:00:00Z",
    actor: "ai-team@company.com",
    environment: "dev",
    configKey: "FEATURE_FLAG_AI_SEARCH",
    oldValue: "false",
    newValue: "true",
    severity: "info",
    action: "changed",
    comment: "Enabling AI search in dev for experimental integration testing.",
  },
  {
    id: "h005",
    timestamp: "2026-02-21T22:10:00Z",
    actor: "platform-team@company.com",
    environment: "prod",
    configKey: "API_RATE_LIMIT_RPM",
    oldValue: "2000",
    newValue: "1000",
    severity: "warning",
    action: "changed",
    comment: "Tightening rate limits to protect prod from potential abuse patterns.",
  },
  {
    id: "h006",
    timestamp: "2026-02-21T20:00:00Z",
    actor: "security-team@company.com",
    environment: "prod",
    configKey: "OAUTH_PKCE_REQUIRED",
    oldValue: "false",
    newValue: "true",
    severity: "critical",
    action: "changed",
    comment: "Enabling PKCE enforcement per security audit recommendation #SEC-2024-091.",
  },
  {
    id: "h007",
    timestamp: "2026-02-21T18:45:00Z",
    actor: "ops-bot@company.com",
    environment: "prod",
    configKey: "REDIS_CLUSTER_ENABLED",
    oldValue: "false",
    newValue: "true",
    severity: "critical",
    action: "changed",
    comment: "Automated cluster migration completed — enabling cluster mode in production.",
  },
  {
    id: "h008",
    timestamp: "2026-02-21T14:00:00Z",
    actor: "security-bot@company.com",
    environment: "prod",
    configKey: "SECRET_ROTATION_INTERVAL_DAYS",
    oldValue: "90",
    newValue: "30",
    severity: "critical",
    action: "changed",
    comment: "Compliance requirement: secret rotation must be ≤30 days per SOC2 audit findings.",
  },
  {
    id: "h009",
    timestamp: "2026-02-21T11:20:00Z",
    actor: "infra-bot@company.com",
    environment: "prod",
    configKey: "S3_BUCKET_VERSIONING",
    oldValue: "false",
    newValue: "true",
    severity: "warning",
    action: "changed",
    comment: "Enabling versioning for disaster recovery compliance requirement.",
  },
  {
    id: "h010",
    timestamp: "2026-02-21T07:15:00Z",
    actor: "dba-team@company.com",
    environment: "prod",
    configKey: "DB_QUERY_TIMEOUT_MS",
    oldValue: "10000",
    newValue: "5000",
    severity: "warning",
    action: "changed",
    comment: "Stricter query timeouts to prevent runaway queries in production.",
  },
  {
    id: "h011",
    timestamp: "2026-02-20T16:30:00Z",
    actor: "security-team@company.com",
    environment: "staging",
    configKey: "CORS_ALLOWED_ORIGINS",
    oldValue: "*",
    newValue: "https://staging.example.com",
    severity: "warning",
    action: "changed",
    comment: "Locking down CORS to staging domain — mirrors production restrictions.",
  },
  {
    id: "h012",
    timestamp: "2026-02-20T14:00:00Z",
    actor: "product-team@company.com",
    environment: "prod",
    configKey: "FEATURE_FLAG_DARK_MODE",
    oldValue: "true",
    newValue: "false",
    severity: "info",
    action: "changed",
    comment: "Reverting dark mode in prod — UX issues reported by beta users, needs polish.",
  },
  {
    id: "h013",
    timestamp: "2026-02-20T10:00:00Z",
    actor: "platform-team@company.com",
    environment: "staging",
    configKey: "ENABLE_REQUEST_SIGNING",
    oldValue: "false",
    newValue: "true",
    severity: "critical",
    action: "changed",
    comment: "Enabling request signing in staging to mirror production security posture.",
  },
  {
    id: "h014",
    timestamp: "2026-02-19T15:30:00Z",
    actor: "dba-team@company.com",
    environment: "prod",
    configKey: "DB_REPLICA_READ_ENABLED",
    oldValue: "false",
    newValue: "true",
    severity: "warning",
    action: "changed",
    comment: "Enabling read replicas for improved read performance in production.",
  },
  {
    id: "h015",
    timestamp: "2026-02-19T13:00:00Z",
    actor: "cache-team@company.com",
    environment: "dev",
    configKey: "CACHE_TTL_SECONDS",
    oldValue: "3600",
    newValue: "60",
    severity: "warning",
    action: "ignored",
    comment: "Intentional deviation — short TTL in dev enables faster cache invalidation during development.",
  },
  {
    id: "h016",
    timestamp: "2026-02-19T09:00:00Z",
    actor: "dev-ops@company.com",
    environment: "prod",
    configKey: "LOG_LEVEL",
    oldValue: "info",
    newValue: "warn",
    severity: "warning",
    action: "changed",
    comment: "Reducing log verbosity in prod to cut Datadog costs by ~40%.",
  },
  {
    id: "h017",
    timestamp: "2026-02-18T10:30:00Z",
    actor: "backend-team@company.com",
    environment: "staging",
    configKey: "MAX_UPLOAD_SIZE_MB",
    oldValue: "100",
    newValue: "50",
    severity: "info",
    action: "resolved",
    comment: "Aligning staging with prod upload limits — drift resolved.",
  },
  {
    id: "h018",
    timestamp: "2026-02-18T08:00:00Z",
    actor: "platform-team@company.com",
    environment: "dev",
    configKey: "ALERT_WEBHOOK_URL",
    oldValue: "https://hooks.example.com/alerts",
    newValue: "https://hooks.dev.example.com/alerts",
    severity: "info",
    action: "changed",
    comment: "Routing dev alerts to dev-specific webhook to avoid noise in prod Slack channel.",
  },
];

const POLICIES_DATA: Policy[] = [
  {
    id: "p001",
    name: "Critical Auth Security Drift",
    description:
      "Alert immediately when authentication or authorization configs differ between staging and prod. Zero tolerance.",
    enabled: true,
    category: "auth",
    severity: "critical",
    environments: ["staging", "prod"],
    threshold: 0,
    ignorePatterns: [],
    lastTriggered: "2026-02-22T01:30:00Z",
    triggerCount: 12,
  },
  {
    id: "p002",
    name: "Database Configuration Parity",
    description:
      "Ensure database settings (pool size, timeouts, replicas) are consistent between staging and production.",
    enabled: true,
    category: "database",
    severity: "critical",
    environments: ["staging", "prod"],
    threshold: 0,
    ignorePatterns: ["*_DEV_*"],
    lastTriggered: "2026-02-22T04:15:00Z",
    triggerCount: 8,
  },
  {
    id: "p003",
    name: "API Rate Limit Variance",
    description:
      "Warn when API rate limits differ by more than 50% between any two environments.",
    enabled: true,
    category: "api",
    severity: "warning",
    environments: ["dev", "staging", "prod"],
    threshold: 50,
    ignorePatterns: [],
    lastTriggered: "2026-02-21T22:10:00Z",
    triggerCount: 5,
  },
  {
    id: "p004",
    name: "Feature Flag Sync Tracker",
    description:
      "Track feature flags enabled in dev but not yet in production — informational, not blocking.",
    enabled: true,
    category: "feature-flags",
    severity: "info",
    environments: ["dev", "prod"],
    threshold: 0,
    ignorePatterns: ["FEATURE_FLAG_*_EXPERIMENTAL"],
    lastTriggered: "2026-02-22T00:00:00Z",
    triggerCount: 23,
  },
  {
    id: "p005",
    name: "Secret Rotation Compliance",
    description:
      "Enforce consistent secret rotation policies across all environments per SOC2 requirements.",
    enabled: true,
    category: "secrets",
    severity: "critical",
    environments: ["dev", "staging", "prod"],
    threshold: 0,
    ignorePatterns: [],
    lastTriggered: "2026-02-21T14:00:00Z",
    triggerCount: 3,
  },
  {
    id: "p006",
    name: "Network Security Parity",
    description:
      "Ensure networking and TLS settings in staging match production security posture.",
    enabled: true,
    category: "networking",
    severity: "critical",
    environments: ["staging", "prod"],
    threshold: 0,
    ignorePatterns: [],
    lastTriggered: "2026-02-22T03:45:00Z",
    triggerCount: 6,
  },
  {
    id: "p007",
    name: "Cache TTL Monitoring",
    description:
      "Inform when cache TTL deviates by more than 5x between dev and production environments.",
    enabled: false,
    category: "cache",
    severity: "warning",
    environments: ["dev", "staging", "prod"],
    threshold: 500,
    ignorePatterns: ["CACHE_TTL_DEV_*"],
    lastTriggered: null,
    triggerCount: 0,
  },
  {
    id: "p008",
    name: "Log Level Enforcement",
    description:
      "Warn when log levels differ between staging and prod — staging should mirror prod verbosity.",
    enabled: true,
    category: "logging",
    severity: "warning",
    environments: ["staging", "prod"],
    threshold: 0,
    ignorePatterns: [],
    lastTriggered: "2026-02-19T09:00:00Z",
    triggerCount: 4,
  },
];

const IGNORE_RULES_DATA: IgnoreRule[] = [
  {
    id: "ir001",
    pattern: "FEATURE_FLAG_*_EXPERIMENTAL",
    reason:
      "Experimental feature flags are expected to differ between environments by product design.",
    addedBy: "product-team@company.com",
    addedAt: "2026-02-01T00:00:00Z",
    matchCount: 7,
    enabled: true,
  },
  {
    id: "ir002",
    pattern: "LOG_LEVEL_DEV",
    reason: "Dev log verbosity is intentionally higher for debugging purposes.",
    addedBy: "dev-ops@company.com",
    addedAt: "2026-01-15T00:00:00Z",
    matchCount: 1,
    enabled: true,
  },
  {
    id: "ir003",
    pattern: "*_LOCAL_*",
    reason:
      "Local-only config keys are not expected to match any environment by definition.",
    addedBy: "platform-team@company.com",
    addedAt: "2025-12-01T00:00:00Z",
    matchCount: 12,
    enabled: true,
  },
  {
    id: "ir004",
    pattern: "CACHE_TTL_*",
    reason:
      "Cache TTL differences between dev and prod are acceptable per team agreement (Feb 2026).",
    addedBy: "cache-team@company.com",
    addedAt: "2026-02-19T13:00:00Z",
    matchCount: 2,
    enabled: false,
  },
  {
    id: "ir005",
    pattern: "ALERT_WEBHOOK_URL",
    reason:
      "Webhook URLs differ by environment intentionally — each env routes to its own alert channel.",
    addedBy: "platform-team@company.com",
    addedAt: "2026-02-18T09:00:00Z",
    matchCount: 1,
    enabled: true,
  },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string): string {
  const now = new Date("2026-02-22T06:44:00Z");
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) {return "just now";}
  if (diffMin < 60) {return `${diffMin}m ago`;}
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {return `${diffH}h ago`;}
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function severityTextColor(severity: Severity): string {
  if (severity === "critical") {return "text-rose-400";}
  if (severity === "warning") {return "text-amber-400";}
  return "text-indigo-400";
}

function severityBgBorder(severity: Severity): string {
  if (severity === "critical") {return "bg-rose-400/10 border-rose-400/30";}
  if (severity === "warning") {return "bg-amber-400/10 border-amber-400/30";}
  return "bg-indigo-400/10 border-indigo-400/30";
}

function severityDotColor(severity: Severity): string {
  if (severity === "critical") {return "bg-rose-400";}
  if (severity === "warning") {return "bg-amber-400";}
  return "bg-indigo-400";
}

function envBadgeStyle(env: Environment): string {
  if (env === "dev") {return "bg-sky-500/20 text-sky-300 border-sky-500/30";}
  if (env === "staging") {return "bg-amber-500/20 text-amber-300 border-amber-500/30";}
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
}

function envLabel(env: Environment): string {
  if (env === "dev") {return "Dev";}
  if (env === "staging") {return "Staging";}
  return "Prod";
}

function categoryLabel(cat: Category | "all"): string {
  const map: Record<Category | "all", string> = {
    database: "Database",
    api: "API",
    auth: "Auth",
    cache: "Cache",
    "feature-flags": "Feature Flags",
    networking: "Networking",
    logging: "Logging",
    secrets: "Secrets",
    all: "All",
  };
  return map[cat];
}

function actionTextColor(action: HistoryAction): string {
  if (action === "changed") {return "text-amber-400";}
  if (action === "resolved") {return "text-emerald-400";}
  if (action === "added") {return "text-indigo-400";}
  if (action === "removed") {return "text-rose-400";}
  return "text-zinc-400";
}

function computeEnvHealthScore(env: Environment, entries: DriftEntry[]): number {
  const active = entries.filter((e) => e.status === "drifted");
  const criticals = active.filter((e) => e.severity === "critical" && e.values[env] !== null);
  const warnings = active.filter((e) => e.severity === "warning" && e.values[env] !== null);
  const total = entries.length;
  const deductions = criticals.length * 15 + warnings.length * 5;
  return Math.max(0, Math.round(((total - deductions / 10) / total) * 100));
}

// ============================================================
// SMALL REUSABLE COMPONENTS
// ============================================================

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        className
      )}
    >
      {children}
    </span>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors duration-200",
        enabled ? "bg-indigo-500 border-indigo-500" : "bg-zinc-700 border-zinc-600"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
          enabled ? "translate-x-[14px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// ============================================================
// OVERVIEW TAB COMPONENTS
// ============================================================

interface SummaryCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent: "default" | "critical" | "warning" | "success";
  barPercent?: number;
}

function SummaryCard({ label, value, sub, accent, barPercent }: SummaryCardProps) {
  const valueColor =
    accent === "critical"
      ? "text-rose-400"
      : accent === "warning"
      ? "text-amber-400"
      : accent === "success"
      ? "text-emerald-400"
      : "text-indigo-400";

  const barColor =
    accent === "critical"
      ? "bg-rose-500"
      : accent === "warning"
      ? "bg-amber-500"
      : accent === "success"
      ? "bg-emerald-500"
      : "bg-indigo-500";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-2">
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      <span className={cn("text-4xl font-bold tabular-nums", valueColor)}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
      {barPercent !== undefined && (
        <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barColor)}
            style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface EnvHealthCardProps {
  env: Environment;
  score: number;
  driftCount: number;
  criticalCount: number;
}

function EnvHealthCard({ env, score, driftCount, criticalCount }: EnvHealthCardProps) {
  const scoreColor =
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  const trackColor =
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500";
  const status = score >= 80 ? "Healthy" : score >= 60 ? "Degraded" : "Critical";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <Badge className={envBadgeStyle(env)}>{envLabel(env)}</Badge>
        <span className={cn("text-xs font-medium", scoreColor)}>{status}</span>
      </div>
      <div className={cn("text-5xl font-bold tabular-nums mb-1", scoreColor)}>{score}</div>
      <div className="text-xs text-zinc-500 mb-3">Health score</div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div
          className={cn("h-full rounded-full transition-all duration-700", trackColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs">
        <div>
          <span className="text-rose-400 font-semibold">{criticalCount}</span>
          <span className="text-zinc-500 ml-1">critical</span>
        </div>
        <div>
          <span className="text-amber-400 font-semibold">{driftCount}</span>
          <span className="text-zinc-500 ml-1">total drifts</span>
        </div>
      </div>
    </div>
  );
}

interface MatrixCellProps {
  envA: Environment;
  envB: Environment;
  entries: DriftEntry[];
}

function MatrixCell({ envA, envB, entries }: MatrixCellProps) {
  if (envA === envB) {
    return (
      <div className="h-14 flex items-center justify-center bg-zinc-800/30 rounded text-zinc-700 text-xs font-mono select-none">
        ―
      </div>
    );
  }

  const drifted = entries.filter(
    (e) => e.status === "drifted" && e.values[envA] !== e.values[envB]
  );
  const criticals = drifted.filter((e) => e.severity === "critical");
  const inSync = drifted.length === 0;

  return (
    <div
      className={cn(
        "h-14 flex flex-col items-center justify-center rounded border text-xs font-medium transition-all cursor-default select-none",
        inSync
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : criticals.length > 0
          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
      )}
    >
      {inSync ? (
        <>
          <span className="text-lg leading-tight">✓</span>
          <span className="text-[10px] opacity-70">In Sync</span>
        </>
      ) : (
        <>
          <span className="text-base font-bold leading-tight">{drifted.length}</span>
          <span className="text-[10px] opacity-70">
            {criticals.length > 0 ? `${criticals.length} critical` : "drifts"}
          </span>
        </>
      )}
    </div>
  );
}

interface CategoryBarChartProps {
  entries: DriftEntry[];
}

function CategoryBarChart({ entries }: CategoryBarChartProps) {
  const cats: Category[] = [
    "database",
    "api",
    "auth",
    "cache",
    "feature-flags",
    "networking",
    "logging",
    "secrets",
  ];

  const rows = cats
    .map((cat) => ({
      cat,
      drifted: entries.filter((e) => e.category === cat && e.status === "drifted").length,
      total: entries.filter((e) => e.category === cat).length,
    }))
    .filter((r) => r.total > 0)
    .toSorted((a, b) => b.drifted - a.drifted);

  const maxDrifted = Math.max(...rows.map((r) => r.drifted), 1);

  return (
    <div className="space-y-2">
      {rows.map(({ cat, drifted, total }) => (
        <div key={cat} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-28 shrink-0">{categoryLabel(cat)}</span>
          <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden relative">
            <div
              className={cn(
                "h-full rounded transition-all duration-700",
                drifted === 0 ? "bg-emerald-500/20" : "bg-indigo-500"
              )}
              style={{ width: `${Math.max(4, (drifted / maxDrifted) * 100)}%` }}
            />
            <span className="absolute inset-0 flex items-center pl-2 text-xs font-medium text-white/70">
              {drifted > 0 ? `${drifted} drift${drifted !== 1 ? "s" : ""}` : "Clean"}
            </span>
          </div>
          <span className="text-xs text-zinc-500 w-10 text-right shrink-0">
            {drifted}/{total}
          </span>
        </div>
      ))}
    </div>
  );
}

interface TrendChartProps {
  entries: DriftEntry[];
}

function TrendChart({ entries }: TrendChartProps) {
  const driftedNow = entries.filter((e) => e.status === "drifted").length;
  // Simulated 7-day trend
  const trendData: number[] = [3, 5, 4, 8, 6, 10, driftedNow];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
  const maxVal = Math.max(...trendData, 1);

  return (
    <div>
      <div className="flex items-end gap-2 h-28">
        {trendData.map((val, idx) => {
          const isToday = idx === trendData.length - 1;
          const heightPct = (val / maxVal) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-zinc-500">{val}</span>
              <div
                className={cn(
                  "w-full rounded-t transition-all duration-500",
                  isToday ? "bg-indigo-500" : "bg-zinc-700"
                )}
                style={{ height: `${heightPct}%`, minHeight: "4px" }}
              />
              <span className="text-[9px] text-zinc-600">{days[idx]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================

interface OverviewTabProps {
  entries: DriftEntry[];
}

function OverviewTab({ entries }: OverviewTabProps) {
  const total = entries.length;
  const drifted = entries.filter((e) => e.status === "drifted").length;
  const critical = entries.filter(
    (e) => e.status === "drifted" && e.severity === "critical"
  ).length;
  const resolved = entries.filter((e) => e.status === "resolved").length;
  const ignored = entries.filter((e) => e.status === "ignored").length;

  const envs: Environment[] = ["dev", "staging", "prod"];

  const devScore = computeEnvHealthScore("dev", entries);
  const stagingScore = computeEnvHealthScore("staging", entries);
  const prodScore = computeEnvHealthScore("prod", entries);

  const envScores: Record<Environment, number> = {
    dev: devScore,
    staging: stagingScore,
    prod: prodScore,
  };

  const envDriftCounts = (env: Environment): number =>
    entries.filter(
      (e) =>
        e.status === "drifted" &&
        envs.some((other) => other !== env && e.values[env] !== e.values[other])
    ).length;

  const envCriticalCounts = (env: Environment): number =>
    entries.filter(
      (e) =>
        e.status === "drifted" &&
        e.severity === "critical" &&
        envs.some((other) => other !== env && e.values[env] !== e.values[other])
    ).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Configs Tracked"
          value={total}
          sub="across all environments"
          accent="default"
          barPercent={100}
        />
        <SummaryCard
          label="Active Drifts"
          value={drifted}
          sub={`${Math.round((drifted / total) * 100)}% of tracked configs`}
          accent="critical"
          barPercent={(drifted / total) * 100}
        />
        <SummaryCard
          label="Critical Drifts"
          value={critical}
          sub="immediate attention needed"
          accent="critical"
          barPercent={(critical / total) * 100}
        />
        <SummaryCard
          label="Resolved / Ignored"
          value={resolved}
          sub={`${ignored} currently ignored`}
          accent="success"
          barPercent={(resolved / total) * 100}
        />
      </div>

      {/* Environment Health Scores */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Environment Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {envs.map((env) => (
            <EnvHealthCard
              key={env}
              env={env}
              score={envScores[env]}
              driftCount={envDriftCounts(env)}
              criticalCount={envCriticalCounts(env)}
            />
          ))}
        </div>
      </div>

      {/* Sync Matrix */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Environment Sync Matrix</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Pairwise drift count between environments
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
              In Sync
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/30" />
              Drifted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-500/30" />
              Critical
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div />
          {envs.map((env) => (
            <div key={env} className="text-center">
              <Badge className={envBadgeStyle(env)}>{envLabel(env)}</Badge>
            </div>
          ))}
          {envs.map((rowEnv) => (
            <React.Fragment key={rowEnv}>
              <div className="flex items-center">
                <Badge className={envBadgeStyle(rowEnv)}>{envLabel(rowEnv)}</Badge>
              </div>
              {envs.map((colEnv) => (
                <MatrixCell key={colEnv} envA={rowEnv} envB={colEnv} entries={entries} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Bottom: Category Chart + 7-day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Drifts by Category</h3>
          <p className="text-xs text-zinc-500 mb-4">Active drift count per config category</p>
          <CategoryBarChart entries={entries} />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">7-Day Drift Trend</h3>
          <p className="text-xs text-zinc-500 mb-4">Active drifts detected per day</p>
          <TrendChart entries={entries} />
          <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3 text-center">
            {envs.map((env) => (
              <div key={env}>
                <div className="text-xl font-bold text-white">{envDriftCounts(env)}</div>
                <div className="mt-1">
                  <Badge className={cn("text-[10px]", envBadgeStyle(env))}>
                    {envLabel(env)}
                  </Badge>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">drifted keys</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DRIFT DETAILS TAB
// ============================================================

interface DriftDetailsTabProps {
  entries: DriftEntry[];
  onResolve: (id: string) => void;
  onIgnore: (id: string) => void;
}

function DriftDetailsTab({ entries, onResolve, onIgnore }: DriftDetailsTabProps) {
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterStatus, setFilterStatus] = useState<DriftStatus | "all">("drifted");
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("severity");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allCategories: (Category | "all")[] = [
    "all",
    "database",
    "api",
    "auth",
    "cache",
    "feature-flags",
    "networking",
    "logging",
    "secrets",
  ];

  const filtered = entries
    .filter((e) => filterSeverity === "all" || e.severity === filterSeverity)
    .filter((e) => filterStatus === "all" || e.status === filterStatus)
    .filter((e) => filterCategory === "all" || e.category === filterCategory)
    .filter((e) => {
      if (!searchQuery.trim()) {return true;}
      const q = searchQuery.toLowerCase();
      return (
        e.key.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.lastChangedBy.toLowerCase().includes(q)
      );
    })
    .toSorted((a, b) => {
      if (sortBy === "severity") {
        const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      }
      if (sortBy === "recent") {
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      }
      return a.key.localeCompare(b.key);
    });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkResolve = () => {
    selectedIds.forEach((id) => onResolve(id));
    setSelectedIds([]);
  };

  const handleBulkIgnore = () => {
    selectedIds.forEach((id) => onIgnore(id));
    setSelectedIds([]);
  };

  return (
    <div className="space-y-4">
      {/* Filter + Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">
            ⌕
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search config keys, descriptions, or authors…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-4 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium shrink-0">Severity</span>
            <div className="flex gap-1">
              {(["all", "critical", "warning", "info"] as (Severity | "all")[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium border transition-all",
                    filterSeverity === s
                      ? s === "all"
                        ? "bg-zinc-700 border-zinc-600 text-white"
                        : cn(severityBgBorder(s), severityTextColor(s))
                      : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium shrink-0">Status</span>
            <div className="flex gap-1">
              {(["all", "drifted", "resolved", "ignored"] as (DriftStatus | "all")[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium border transition-all",
                    filterStatus === s
                      ? "bg-zinc-700 border-zinc-600 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-zinc-500 font-medium">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-1.5 focus:outline-none"
            >
              <option value="severity">By Severity</option>
              <option value="recent">Most Recent</option>
              <option value="key">By Key Name</option>
            </select>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "px-2 py-0.5 rounded text-xs border transition-all",
                filterCategory === cat
                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-500">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {searchQuery && (
            <span className="ml-1 text-zinc-600">
              for &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-indigo-300 font-medium">
            {selectedIds.length} selected
          </span>
          <button
            onClick={handleBulkResolve}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            ✓ Resolve All
          </button>
          <button
            onClick={handleBulkIgnore}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium hover:bg-zinc-700 transition-colors"
          >
            Ignore All
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Drift List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-16 text-center">
            <div className="text-zinc-600 text-3xl mb-3">⌕</div>
            <div className="text-zinc-500 text-sm font-medium">No drift entries match your filters</div>
            <div className="text-zinc-600 text-xs mt-1">Try adjusting your filters or search query</div>
          </div>
        )}

        {filtered.map((entry) => {
          const isExpanded = expandedId === entry.id;
          const isSelected = selectedIds.includes(entry.id);
          const envs: Environment[] = ["dev", "staging", "prod"];

          const borderClass =
            entry.status === "drifted" && entry.severity === "critical"
              ? "border-rose-500/30"
              : entry.status === "drifted" && entry.severity === "warning"
              ? "border-amber-500/20"
              : "border-zinc-800";

          return (
            <div
              key={entry.id}
              className={cn(
                "bg-zinc-900 border rounded-xl overflow-hidden transition-all",
                borderClass,
                isSelected && "ring-1 ring-indigo-500/40"
              )}
            >
              {/* Row Header */}
              <div className="flex items-center">
                {/* Checkbox */}
                {entry.status === "drifted" && (
                  <button
                    onClick={() => toggleSelect(entry.id)}
                    className="pl-4 pr-2 py-3.5 text-zinc-600 hover:text-indigo-400 transition-colors shrink-0"
                  >
                    <span className="text-base leading-none">
                      {isSelected ? "☑" : "☐"}
                    </span>
                  </button>
                )}
                {entry.status !== "drifted" && <div className="w-4" />}

                {/* Main content */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex-1 px-3 py-3.5 flex items-center gap-3 hover:bg-zinc-800/40 transition-colors text-left"
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      severityDotColor(entry.severity)
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-mono font-semibold text-white truncate">
                        {entry.key}
                      </span>
                      <Badge
                        className={cn(
                          severityBgBorder(entry.severity),
                          severityTextColor(entry.severity)
                        )}
                      >
                        {entry.severity}
                      </Badge>
                      <Badge
                        className={cn(
                          entry.status === "resolved"
                            ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
                            : entry.status === "ignored"
                            ? "bg-zinc-700 border-zinc-600 text-zinc-400"
                            : "bg-rose-400/10 border-rose-400/30 text-rose-400"
                        )}
                      >
                        {entry.status}
                      </Badge>
                      <Badge className="bg-zinc-800 border-zinc-700 text-zinc-400">
                        {categoryLabel(entry.category)}
                      </Badge>
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{entry.description}</div>
                  </div>

                  <div className="text-xs text-zinc-600 shrink-0 text-right hidden sm:block">
                    <div className="text-zinc-400">{timeAgo(entry.detectedAt)}</div>
                    <div className="text-zinc-600">{formatTimestamp(entry.detectedAt)}</div>
                  </div>
                  <span className="text-zinc-600 text-xs ml-1">{isExpanded ? "▲" : "▼"}</span>
                </button>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                  {/* Values per environment */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Current Values Per Environment
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {envs.map((env) => {
                        const val = entry.values[env];
                        const isExpected = val === entry.expectedValue;
                        return (
                          <div
                            key={env}
                            className={cn(
                              "rounded-lg border p-3",
                              isExpected
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-zinc-700 bg-zinc-800/50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <Badge className={envBadgeStyle(env)}>{envLabel(env)}</Badge>
                              {isExpected && (
                                <span className="text-[10px] text-emerald-400">✓ Expected</span>
                              )}
                            </div>
                            <div className="font-mono text-sm text-white break-all">
                              {val !== null ? (
                                val
                              ) : (
                                <span className="text-zinc-500 italic">not set</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Expected value:</span>
                      <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {entry.expectedValue}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500">Last changed by</span>
                      <div className="text-zinc-300 mt-0.5 font-mono">{entry.lastChangedBy}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Detected at</span>
                      <div className="text-zinc-300 mt-0.5">{formatTimestamp(entry.detectedAt)}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  {entry.status === "drifted" && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => onResolve(entry.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                      >
                        ✓ Mark Resolved
                      </button>
                      <button
                        onClick={() => onIgnore(entry.id)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium hover:bg-zinc-700 transition-colors"
                      >
                        Ignore Drift
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors">
                        View in History
                      </button>
                    </div>
                  )}
                  {entry.status === "resolved" && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <span>✓</span>
                      <span>This drift has been marked as resolved.</span>
                    </div>
                  )}
                  {entry.status === "ignored" && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                      <span>—</span>
                      <span>This drift is suppressed by an active ignore rule or policy.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// HISTORY TAB
// ============================================================

interface HistoryTabProps {
  events: HistoryEvent[];
}

function HistoryTab({ events }: HistoryTabProps) {
  const [filterEnv, setFilterEnv] = useState<Environment | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterAction, setFilterAction] = useState<HistoryAction | "all">("all");
  const [searchActor, setSearchActor] = useState<string>("");

  const filtered = events
    .filter((e) => filterEnv === "all" || e.environment === filterEnv)
    .filter((e) => filterSeverity === "all" || e.severity === filterSeverity)
    .filter((e) => filterAction === "all" || e.action === filterAction)
    .filter((e) => {
      if (!searchActor.trim()) {return true;}
      const q = searchActor.toLowerCase();
      return (
        e.actor.toLowerCase().includes(q) ||
        e.configKey.toLowerCase().includes(q) ||
        e.comment.toLowerCase().includes(q)
      );
    });

  // Group events by date
  const grouped: { date: string; evts: HistoryEvent[] }[] = [];
  filtered.forEach((evt) => {
    const date = formatDate(evt.timestamp);
    const existing = grouped.find((g) => g.date === date);
    if (existing) {
      existing.evts.push(evt);
    } else {
      grouped.push({ date, evts: [evt] });
    }
  });

  const allActions: (HistoryAction | "all")[] = [
    "all",
    "changed",
    "resolved",
    "added",
    "removed",
    "ignored",
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">
            ⌕
          </span>
          <input
            type="text"
            value={searchActor}
            onChange={(e) => setSearchActor(e.target.value)}
            placeholder="Search by actor, config key, or comment…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-4 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Environment filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Environment</span>
            <div className="flex gap-1">
              {(["all", "dev", "staging", "prod"] as (Environment | "all")[]).map((env) => (
                <button
                  key={env}
                  onClick={() => setFilterEnv(env)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium border transition-all",
                    filterEnv === env
                      ? env === "all"
                        ? "bg-zinc-700 border-zinc-600 text-white"
                        : envBadgeStyle(env)
                      : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {env === "all" ? "All" : envLabel(env)}
                </button>
              ))}
            </div>
          </div>

          {/* Action filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Action</span>
            <div className="flex gap-1 flex-wrap">
              {allActions.map((action) => (
                <button
                  key={action}
                  onClick={() => setFilterAction(action)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium border transition-all",
                    filterAction === action
                      ? "bg-zinc-700 border-zinc-600 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {action === "all"
                    ? "All"
                    : action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Timeline — grouped by date */}
      {grouped.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-16 text-center">
          <div className="text-zinc-600 text-3xl mb-3">📅</div>
          <div className="text-zinc-500 text-sm font-medium">No events match your filters</div>
        </div>
      )}

      {grouped.map(({ date, evts }) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">
              {date}
            </span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="relative">
            <div className="absolute left-[22px] top-0 bottom-0 w-px bg-zinc-800" />
            <div className="space-y-3">
              {evts.map((event) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div
                    className={cn(
                      "relative z-10 w-3 h-3 rounded-full mt-4 ml-4 shrink-0 border-2 border-zinc-950",
                      severityDotColor(event.severity)
                    )}
                  />

                  {/* Card */}
                  <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={cn(
                              "text-xs font-bold uppercase tracking-wide",
                              actionTextColor(event.action)
                            )}
                          >
                            {event.action}
                          </span>
                          <Badge className={envBadgeStyle(event.environment)}>
                            {envLabel(event.environment)}
                          </Badge>
                          <Badge
                            className={cn(
                              severityBgBorder(event.severity),
                              severityTextColor(event.severity)
                            )}
                          >
                            {event.severity}
                          </Badge>
                        </div>

                        <div className="font-mono text-sm font-semibold text-white mb-1.5">
                          {event.configKey}
                        </div>

                        {event.action === "changed" && (
                          <div className="flex items-center gap-2 text-xs mb-1.5">
                            <span className="font-mono text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded border border-rose-400/20">
                              {event.oldValue}
                            </span>
                            <span className="text-zinc-600">→</span>
                            <span className="font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                              {event.newValue}
                            </span>
                          </div>
                        )}

                        {event.action === "resolved" && (
                          <div className="flex items-center gap-2 text-xs mb-1.5">
                            <span className="font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                              Drift resolved
                            </span>
                          </div>
                        )}

                        {event.comment && (
                          <div className="text-xs text-zinc-500 italic mt-1">
                            &ldquo;{event.comment}&rdquo;
                          </div>
                        )}

                        <div className="mt-2 text-xs text-zinc-600 font-mono">
                          {event.actor}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-zinc-400">
                          {timeAgo(event.timestamp)}
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">
                          {formatTimestamp(event.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// POLICIES TAB
// ============================================================

interface PoliciesTabProps {
  policies: Policy[];
  ignoreRules: IgnoreRule[];
  onTogglePolicy: (id: string) => void;
  onToggleIgnoreRule: (id: string) => void;
}

function PoliciesTab({
  policies,
  ignoreRules,
  onTogglePolicy,
  onToggleIgnoreRule,
}: PoliciesTabProps) {
  const [activeSection, setActiveSection] = useState<PolicySection>("policies");

  const activePolicies = policies.filter((p) => p.enabled);
  const disabledPolicies = policies.filter((p) => !p.enabled);
  const totalTriggers = policies.reduce((acc, p) => acc + p.triggerCount, 0);

  const activeIgnoreRules = ignoreRules.filter((r) => r.enabled);
  const totalMatches = ignoreRules.reduce((acc, r) => acc + r.matchCount, 0);

  return (
    <div className="space-y-4">
      {/* Section Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection("policies")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
            activeSection === "policies"
              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300"
          )}
        >
          Detection Policies ({policies.length})
        </button>
        <button
          onClick={() => setActiveSection("ignore-rules")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
            activeSection === "ignore-rules"
              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300"
          )}
        >
          Ignore Rules ({ignoreRules.length})
        </button>
      </div>

      {/* Detection Policies */}
      {activeSection === "policies" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {activePolicies.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Active Policies</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-zinc-500">
                {disabledPolicies.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Disabled</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-indigo-400">{totalTriggers}</div>
              <div className="text-xs text-zinc-400 mt-1">Total Triggers</div>
            </div>
          </div>

          {/* Policy cards */}
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={cn(
                "bg-zinc-900 border rounded-xl p-5 transition-all",
                policy.enabled ? "border-zinc-800" : "border-zinc-800/40 opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-white">{policy.name}</span>
                    <Badge
                      className={cn(
                        severityBgBorder(policy.severity),
                        severityTextColor(policy.severity)
                      )}
                    >
                      {policy.severity}
                    </Badge>
                    <Badge className="bg-zinc-800 border-zinc-700 text-zinc-400">
                      {categoryLabel(policy.category)}
                    </Badge>
                    {!policy.enabled && (
                      <Badge className="bg-zinc-800 border-zinc-700 text-zinc-500">
                        disabled
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-zinc-500 mb-4">{policy.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-zinc-500 mb-1.5">Environments</div>
                      <div className="flex gap-1 flex-wrap">
                        {policy.environments.map((env) => (
                          <Badge key={env} className={envBadgeStyle(env)}>
                            {envLabel(env)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Threshold</div>
                      <div className="text-zinc-300 font-medium">
                        {policy.threshold === 0 ? "Any deviation" : `±${policy.threshold}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Total Triggers</div>
                      <div className="text-zinc-300 font-medium">{policy.triggerCount}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Last Triggered</div>
                      <div className="text-zinc-300 font-medium">
                        {policy.lastTriggered ? timeAgo(policy.lastTriggered) : "Never"}
                      </div>
                    </div>
                  </div>

                  {/* Trigger count bar */}
                  <div className="mt-3">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/60 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (policy.triggerCount / Math.max(totalTriggers, 1)) * 100 * 3)}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {Math.round((policy.triggerCount / Math.max(totalTriggers, 1)) * 100)}% of total triggers
                    </div>
                  </div>

                  {policy.ignorePatterns.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-zinc-500 mb-1">Ignore patterns</div>
                      <div className="flex gap-1 flex-wrap">
                        {policy.ignorePatterns.map((pattern) => (
                          <span
                            key={pattern}
                            className="font-mono text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700"
                          >
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 mt-1">
                  <ToggleSwitch enabled={policy.enabled} onChange={() => onTogglePolicy(policy.id)} />
                </div>
              </div>
            </div>
          ))}

          {/* Add policy CTA */}
          <button className="w-full bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all">
            + Create Detection Policy
          </button>
        </div>
      )}

      {/* Ignore Rules */}
      {activeSection === "ignore-rules" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{activeIgnoreRules.length}</div>
              <div className="text-xs text-zinc-400 mt-1">Active Rules</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-zinc-500">
                {ignoreRules.length - activeIgnoreRules.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Disabled</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-indigo-400">{totalMatches}</div>
              <div className="text-xs text-zinc-400 mt-1">Total Matches</div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
            <strong className="text-zinc-300">Ignore rules</strong> suppress drift alerts for
            config keys matching the glob pattern. Use{" "}
            <code className="font-mono bg-zinc-800 px-1 py-0.5 rounded text-indigo-300">
              *
            </code>{" "}
            as a wildcard. Disabled rules are retained for audit history and can be re-enabled
            at any time.
          </div>

          {/* Rules */}
          {ignoreRules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "bg-zinc-900 border rounded-xl p-5 transition-all",
                rule.enabled ? "border-zinc-800" : "border-zinc-800/40 opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-white">
                      {rule.pattern}
                    </span>
                    {!rule.enabled && (
                      <Badge className="bg-zinc-800 border-zinc-700 text-zinc-500">
                        disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">{rule.reason}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-zinc-500 mb-0.5">Added by</div>
                      <div className="text-zinc-300 font-mono truncate">{rule.addedBy}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-0.5">Added</div>
                      <div className="text-zinc-300">{formatDate(rule.addedAt)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-0.5">Matches</div>
                      <div className="text-zinc-300">
                        {rule.matchCount} key{rule.matchCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 mt-1">
                  <ToggleSwitch
                    enabled={rule.enabled}
                    onChange={() => onToggleIgnoreRule(rule.id)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add rule CTA */}
          <button className="w-full bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all">
            + Add Ignore Rule
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function EnvironmentDriftDetector() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [driftEntries, setDriftEntries] = useState<DriftEntry[]>(DRIFT_DATA);
  const [policies, setPolicies] = useState<Policy[]>(POLICIES_DATA);
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>(IGNORE_RULES_DATA);
  const [lastRefreshed, setLastRefreshed] = useState<string>("2026-02-22T06:44:00Z");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showScanBanner, setShowScanBanner] = useState<boolean>(true);

  const handleResolve = (id: string) => {
    setDriftEntries((prev) =>
      prev.map((e): DriftEntry => (e.id === id ? { ...e, status: "resolved" } : e))
    );
  };

  const handleIgnore = (id: string) => {
    setDriftEntries((prev) =>
      prev.map((e): DriftEntry => (e.id === id ? { ...e, status: "ignored" } : e))
    );
  };

  const handleTogglePolicy = (id: string) => {
    setPolicies((prev) =>
      prev.map((p): Policy => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleToggleIgnoreRule = (id: string) => {
    setIgnoreRules((prev) =>
      prev.map((r): IgnoreRule => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleRefresh = () => {
    if (isRefreshing) {return;}
    setIsRefreshing(true);
    setTimeout(() => {
      setLastRefreshed(new Date().toISOString());
      setIsRefreshing(false);
    }, 1400);
  };

  const criticalCount = driftEntries.filter(
    (e) => e.status === "drifted" && e.severity === "critical"
  ).length;
  const driftedCount = driftEntries.filter((e) => e.status === "drifted").length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Drift Details", badge: driftedCount },
    { id: "history", label: "History" },
    { id: "policies", label: "Policies" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Critical banner */}
      {criticalCount > 0 && showScanBanner && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-rose-400 text-xs font-bold uppercase tracking-wider animate-pulse">
              ● {criticalCount} Critical Drift{criticalCount !== 1 ? "s" : ""} Detected
            </span>
            <span className="text-rose-400/60 text-xs">—</span>
            <span className="text-rose-300/70 text-xs">
              Production environment health may be at risk. Review and resolve immediately.
            </span>
            <button
              onClick={() => {
                setActiveTab("details");
                setShowScanBanner(false);
              }}
              className="ml-auto text-xs text-rose-400 underline underline-offset-2 hover:text-rose-300 transition-colors"
            >
              View Critical Drifts →
            </button>
            <button
              onClick={() => setShowScanBanner(false)}
              className="text-rose-500 hover:text-rose-300 text-xs transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <span className="text-xl select-none">🔍</span>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Environment Drift Detector
                </h1>
                {criticalCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                    {criticalCount} CRITICAL
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Configuration drift monitoring across{" "}
                <strong className="text-zinc-300">dev</strong>,{" "}
                <strong className="text-zinc-300">staging</strong>, and{" "}
                <strong className="text-zinc-300">prod</strong> — {driftEntries.length} configs
                tracked
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right text-xs hidden sm:block">
                <div className="text-zinc-600">Last scan</div>
                <div className="text-zinc-400 font-medium">{timeAgo(lastRefreshed)}</div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  isRefreshing
                    ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed"
                    : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"
                )}
              >
                {isRefreshing ? "Scanning…" : "↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-0 mt-4 -mb-px border-b border-zinc-800/0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 -mb-px",
                  activeTab === tab.id
                    ? "border-indigo-500 text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                )}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "overview" && <OverviewTab entries={driftEntries} />}
        {activeTab === "details" && (
          <DriftDetailsTab
            entries={driftEntries}
            onResolve={handleResolve}
            onIgnore={handleIgnore}
          />
        )}
        {activeTab === "history" && <HistoryTab events={HISTORY_DATA} />}
        {activeTab === "policies" && (
          <PoliciesTab
            policies={policies}
            ignoreRules={ignoreRules}
            onTogglePolicy={handleTogglePolicy}
            onToggleIgnoreRule={handleToggleIgnoreRule}
          />
        )}
      </div>
    </div>
  );
}
