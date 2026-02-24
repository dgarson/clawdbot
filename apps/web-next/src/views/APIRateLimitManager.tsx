import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "free" | "basic" | "pro" | "enterprise" | "internal";
type Scope = "global" | "per-user" | "per-ip" | "per-endpoint";
type RuleStatus = "active" | "disabled" | "draft";
type ViolationSeverity = "low" | "medium" | "high" | "critical";
type Tab = "overview" | "rules" | "violations" | "consumers";

interface RateLimitRule {
  id: string;
  name: string;
  description: string;
  tier: Tier;
  scope: Scope;
  status: RuleStatus;
  requestsPerWindow: number;
  windowSeconds: number;
  burstLimit: number;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
  violationsLast24h: number;
  throttledCount: number;
}

interface Violation {
  id: string;
  consumerId: string;
  consumerName: string;
  endpoint: string;
  ruleId: string;
  ruleName: string;
  count: number;
  severity: ViolationSeverity;
  timestamp: string;
  ipAddress: string;
  timelinePoints: number[];
}

interface Consumer {
  id: string;
  name: string;
  tier: Tier;
  apiKey: string;
  currentRequests: number;
  requestLimit: number;
  burstUsed: number;
  burstLimit: number;
  windowResetAt: string;
  isThrottled: boolean;
  lastActive: string;
  totalRequestsToday: number;
  endpointBreakdown: EndpointUsage[];
}

interface EndpointUsage {
  endpoint: string;
  requests: number;
  limit: number;
}

interface OverviewStat {
  label: string;
  value: string | number;
  delta: string;
  positive: boolean;
  accent: "indigo" | "emerald" | "rose" | "amber";
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const RULES: RateLimitRule[] = [
  {
    id: "rule-001",
    name: "Free Tier Global",
    description: "Default rate limit for all free tier API consumers across all endpoints.",
    tier: "free",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 100,
    windowSeconds: 3600,
    burstLimit: 20,
    endpoint: "*",
    createdAt: "2025-09-01T10:00:00Z",
    updatedAt: "2026-01-15T08:30:00Z",
    violationsLast24h: 134,
    throttledCount: 23,
  },
  {
    id: "rule-002",
    name: "Basic Tier Global",
    description: "Standard rate limit for basic plan subscribers. Covers all public endpoints.",
    tier: "basic",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 1000,
    windowSeconds: 3600,
    burstLimit: 100,
    endpoint: "*",
    createdAt: "2025-09-01T10:00:00Z",
    updatedAt: "2026-01-20T14:00:00Z",
    violationsLast24h: 47,
    throttledCount: 8,
  },
  {
    id: "rule-003",
    name: "Pro Tier Global",
    description: "Generous rate limit for pro plan subscribers with burst allowances.",
    tier: "pro",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 10000,
    windowSeconds: 3600,
    burstLimit: 500,
    endpoint: "*",
    createdAt: "2025-09-01T10:00:00Z",
    updatedAt: "2026-02-01T09:15:00Z",
    violationsLast24h: 12,
    throttledCount: 2,
  },
  {
    id: "rule-004",
    name: "Enterprise Tier Global",
    description: "High-volume rate limit for enterprise customers with dedicated quota.",
    tier: "enterprise",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 100000,
    windowSeconds: 3600,
    burstLimit: 5000,
    endpoint: "*",
    createdAt: "2025-09-01T10:00:00Z",
    updatedAt: "2026-02-10T11:00:00Z",
    violationsLast24h: 3,
    throttledCount: 0,
  },
  {
    id: "rule-005",
    name: "Auth Endpoint Strict",
    description: "Strict rate limiting on authentication endpoints to prevent brute-force attacks.",
    tier: "free",
    scope: "per-ip",
    status: "active",
    requestsPerWindow: 5,
    windowSeconds: 300,
    burstLimit: 2,
    endpoint: "/api/v1/auth/*",
    createdAt: "2025-10-15T10:00:00Z",
    updatedAt: "2026-01-30T16:45:00Z",
    violationsLast24h: 89,
    throttledCount: 31,
  },
  {
    id: "rule-006",
    name: "Search Endpoint Throttle",
    description: "Rate limit on search to prevent expensive query abuse from all tiers.",
    tier: "basic",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 60,
    windowSeconds: 60,
    burstLimit: 10,
    endpoint: "/api/v1/search",
    createdAt: "2025-11-01T10:00:00Z",
    updatedAt: "2026-02-05T10:00:00Z",
    violationsLast24h: 28,
    throttledCount: 7,
  },
  {
    id: "rule-007",
    name: "Webhook Delivery Limit",
    description: "Outbound webhook delivery rate limiting to protect downstream systems.",
    tier: "pro",
    scope: "per-endpoint",
    status: "active",
    requestsPerWindow: 1000,
    windowSeconds: 60,
    burstLimit: 50,
    endpoint: "/api/v1/webhooks/*",
    createdAt: "2025-11-10T10:00:00Z",
    updatedAt: "2026-01-28T12:00:00Z",
    violationsLast24h: 5,
    throttledCount: 1,
  },
  {
    id: "rule-008",
    name: "Export Heavy Throttle",
    description: "Low limit on data export endpoints — CPU-intensive operations.",
    tier: "basic",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 10,
    windowSeconds: 3600,
    burstLimit: 3,
    endpoint: "/api/v1/exports/*",
    createdAt: "2025-12-01T10:00:00Z",
    updatedAt: "2026-02-12T09:00:00Z",
    violationsLast24h: 19,
    throttledCount: 6,
  },
  {
    id: "rule-009",
    name: "Internal Services Unlimited",
    description: "No effective limit for internal service-to-service communication.",
    tier: "internal",
    scope: "global",
    status: "active",
    requestsPerWindow: 9999999,
    windowSeconds: 60,
    burstLimit: 99999,
    endpoint: "/internal/*",
    createdAt: "2025-09-01T10:00:00Z",
    updatedAt: "2025-09-01T10:00:00Z",
    violationsLast24h: 0,
    throttledCount: 0,
  },
  {
    id: "rule-010",
    name: "Legacy API Deprecation",
    description: "Tight limit on legacy v0 API to encourage migration. Will be removed Q3 2026.",
    tier: "basic",
    scope: "per-user",
    status: "active",
    requestsPerWindow: 50,
    windowSeconds: 3600,
    burstLimit: 5,
    endpoint: "/api/v0/*",
    createdAt: "2025-08-01T10:00:00Z",
    updatedAt: "2026-01-10T10:00:00Z",
    violationsLast24h: 62,
    throttledCount: 18,
  },
  {
    id: "rule-011",
    name: "GraphQL Query Depth Limit",
    description: "Rate limit applied to GraphQL queries with nested depth > 5 to prevent N+1 abuse.",
    tier: "pro",
    scope: "per-user",
    status: "disabled",
    requestsPerWindow: 200,
    windowSeconds: 3600,
    burstLimit: 20,
    endpoint: "/api/graphql",
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-02-18T15:30:00Z",
    violationsLast24h: 0,
    throttledCount: 0,
  },
  {
    id: "rule-012",
    name: "File Upload Bandwidth",
    description: "Limit concurrent upload operations per user — storage and memory consideration.",
    tier: "free",
    scope: "per-user",
    status: "draft",
    requestsPerWindow: 5,
    windowSeconds: 300,
    burstLimit: 2,
    endpoint: "/api/v1/files/upload",
    createdAt: "2026-02-20T10:00:00Z",
    updatedAt: "2026-02-22T06:00:00Z",
    violationsLast24h: 0,
    throttledCount: 0,
  },
];

const VIOLATIONS: Violation[] = [
  {
    id: "viol-001",
    consumerId: "cons-003",
    consumerName: "DataSync Corp",
    endpoint: "/api/v1/search",
    ruleId: "rule-006",
    ruleName: "Search Endpoint Throttle",
    count: 847,
    severity: "critical",
    timestamp: "2026-02-22T06:31:00Z",
    ipAddress: "203.0.113.42",
    timelinePoints: [12, 34, 56, 89, 120, 145, 180, 210, 195, 220, 185, 160],
  },
  {
    id: "viol-002",
    consumerId: "cons-007",
    consumerName: "BotNet Scanner",
    endpoint: "/api/v1/auth/login",
    ruleId: "rule-005",
    ruleName: "Auth Endpoint Strict",
    count: 3204,
    severity: "critical",
    timestamp: "2026-02-22T06:28:00Z",
    ipAddress: "198.51.100.77",
    timelinePoints: [45, 88, 134, 210, 340, 410, 520, 680, 720, 690, 600, 540],
  },
  {
    id: "viol-003",
    consumerId: "cons-011",
    consumerName: "Metrics Harvester",
    endpoint: "/api/v0/events",
    ruleId: "rule-010",
    ruleName: "Legacy API Deprecation",
    count: 412,
    severity: "high",
    timestamp: "2026-02-22T06:15:00Z",
    ipAddress: "192.0.2.15",
    timelinePoints: [8, 15, 22, 38, 55, 62, 71, 80, 88, 90, 87, 85],
  },
  {
    id: "viol-004",
    consumerId: "cons-002",
    consumerName: "QuickBuild SaaS",
    endpoint: "/api/v1/exports/csv",
    ruleId: "rule-008",
    ruleName: "Export Heavy Throttle",
    count: 67,
    severity: "medium",
    timestamp: "2026-02-22T05:58:00Z",
    ipAddress: "203.0.113.99",
    timelinePoints: [2, 5, 8, 10, 12, 14, 16, 14, 12, 11, 10, 9],
  },
  {
    id: "viol-005",
    consumerId: "cons-005",
    consumerName: "AutoReporter",
    endpoint: "/api/v1/search",
    ruleId: "rule-006",
    ruleName: "Search Endpoint Throttle",
    count: 289,
    severity: "high",
    timestamp: "2026-02-22T05:44:00Z",
    ipAddress: "203.0.113.201",
    timelinePoints: [5, 12, 24, 40, 55, 62, 58, 51, 48, 45, 42, 38],
  },
  {
    id: "viol-006",
    consumerId: "cons-009",
    consumerName: "FreeTier User #4482",
    endpoint: "/api/v1/users",
    ruleId: "rule-001",
    ruleName: "Free Tier Global",
    count: 145,
    severity: "medium",
    timestamp: "2026-02-22T05:30:00Z",
    ipAddress: "198.51.100.33",
    timelinePoints: [3, 8, 14, 22, 30, 35, 33, 28, 25, 22, 18, 15],
  },
  {
    id: "viol-007",
    consumerId: "cons-014",
    consumerName: "Legacy Integrator Pro",
    endpoint: "/api/v0/reports",
    ruleId: "rule-010",
    ruleName: "Legacy API Deprecation",
    count: 201,
    severity: "medium",
    timestamp: "2026-02-22T05:12:00Z",
    ipAddress: "203.0.113.150",
    timelinePoints: [6, 11, 18, 26, 35, 41, 40, 37, 33, 30, 27, 24],
  },
  {
    id: "viol-008",
    consumerId: "cons-003",
    consumerName: "DataSync Corp",
    endpoint: "/api/v1/webhooks/deliver",
    ruleId: "rule-007",
    ruleName: "Webhook Delivery Limit",
    count: 98,
    severity: "low",
    timestamp: "2026-02-22T04:55:00Z",
    ipAddress: "203.0.113.42",
    timelinePoints: [2, 4, 7, 10, 13, 15, 14, 13, 12, 11, 10, 9],
  },
  {
    id: "viol-009",
    consumerId: "cons-016",
    consumerName: "SecurityAudit Bot",
    endpoint: "/api/v1/auth/reset",
    ruleId: "rule-005",
    ruleName: "Auth Endpoint Strict",
    count: 512,
    severity: "critical",
    timestamp: "2026-02-22T04:38:00Z",
    ipAddress: "198.51.100.88",
    timelinePoints: [10, 22, 45, 80, 110, 130, 125, 120, 105, 95, 88, 80],
  },
  {
    id: "viol-010",
    consumerId: "cons-006",
    consumerName: "EcomPlatform Ltd",
    endpoint: "/api/v1/products",
    ruleId: "rule-002",
    ruleName: "Basic Tier Global",
    count: 78,
    severity: "low",
    timestamp: "2026-02-22T04:20:00Z",
    ipAddress: "192.0.2.200",
    timelinePoints: [1, 3, 6, 9, 12, 15, 14, 13, 11, 10, 9, 8],
  },
];

const CONSUMERS: Consumer[] = [
  {
    id: "cons-001",
    name: "Acme Analytics",
    tier: "enterprise",
    apiKey: "ent_ak_a1b2c3d4",
    currentRequests: 72450,
    requestLimit: 100000,
    burstUsed: 1820,
    burstLimit: 5000,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: false,
    lastActive: "2026-02-22T06:43:00Z",
    totalRequestsToday: 812340,
    endpointBreakdown: [
      { endpoint: "/api/v1/analytics", requests: 45200, limit: 60000 },
      { endpoint: "/api/v1/reports", requests: 18900, limit: 25000 },
      { endpoint: "/api/v1/exports/*", requests: 8350, limit: 15000 },
    ],
  },
  {
    id: "cons-002",
    name: "QuickBuild SaaS",
    tier: "pro",
    apiKey: "pro_ak_e5f6g7h8",
    currentRequests: 9812,
    requestLimit: 10000,
    burstUsed: 487,
    burstLimit: 500,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: true,
    lastActive: "2026-02-22T06:44:00Z",
    totalRequestsToday: 142800,
    endpointBreakdown: [
      { endpoint: "/api/v1/builds", requests: 5600, limit: 6000 },
      { endpoint: "/api/v1/deployments", requests: 3100, limit: 3000 },
      { endpoint: "/api/v1/exports/*", requests: 1112, limit: 1000 },
    ],
  },
  {
    id: "cons-003",
    name: "DataSync Corp",
    tier: "pro",
    apiKey: "pro_ak_i9j0k1l2",
    currentRequests: 8900,
    requestLimit: 10000,
    burstUsed: 320,
    burstLimit: 500,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: false,
    lastActive: "2026-02-22T06:42:00Z",
    totalRequestsToday: 98500,
    endpointBreakdown: [
      { endpoint: "/api/v1/search", requests: 4400, limit: 3600 },
      { endpoint: "/api/v1/sync", requests: 3200, limit: 5000 },
      { endpoint: "/api/v1/webhooks/*", requests: 1300, limit: 1400 },
    ],
  },
  {
    id: "cons-004",
    name: "FinTrack Pro",
    tier: "enterprise",
    apiKey: "ent_ak_m3n4o5p6",
    currentRequests: 41200,
    requestLimit: 100000,
    burstUsed: 900,
    burstLimit: 5000,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: false,
    lastActive: "2026-02-22T06:40:00Z",
    totalRequestsToday: 521000,
    endpointBreakdown: [
      { endpoint: "/api/v1/transactions", requests: 28000, limit: 60000 },
      { endpoint: "/api/v1/ledger", requests: 9200, limit: 25000 },
      { endpoint: "/api/v1/reports", requests: 4000, limit: 15000 },
    ],
  },
  {
    id: "cons-005",
    name: "AutoReporter",
    tier: "basic",
    apiKey: "bas_ak_q7r8s9t0",
    currentRequests: 940,
    requestLimit: 1000,
    burstUsed: 98,
    burstLimit: 100,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: true,
    lastActive: "2026-02-22T06:44:00Z",
    totalRequestsToday: 22800,
    endpointBreakdown: [
      { endpoint: "/api/v1/search", requests: 610, limit: 600 },
      { endpoint: "/api/v1/reports", requests: 240, limit: 300 },
      { endpoint: "/api/v1/exports/*", requests: 90, limit: 100 },
    ],
  },
  {
    id: "cons-006",
    name: "EcomPlatform Ltd",
    tier: "basic",
    apiKey: "bas_ak_u1v2w3x4",
    currentRequests: 780,
    requestLimit: 1000,
    burstUsed: 45,
    burstLimit: 100,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: false,
    lastActive: "2026-02-22T06:38:00Z",
    totalRequestsToday: 18900,
    endpointBreakdown: [
      { endpoint: "/api/v1/products", requests: 480, limit: 600 },
      { endpoint: "/api/v1/orders", requests: 220, limit: 300 },
      { endpoint: "/api/v1/inventory", requests: 80, limit: 100 },
    ],
  },
  {
    id: "cons-007",
    name: "BotNet Scanner",
    tier: "free",
    apiKey: "fre_ak_y5z6a7b8",
    currentRequests: 98,
    requestLimit: 100,
    burstUsed: 20,
    burstLimit: 20,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: true,
    lastActive: "2026-02-22T06:28:00Z",
    totalRequestsToday: 4100,
    endpointBreakdown: [
      { endpoint: "/api/v1/auth/login", requests: 80, limit: 30 },
      { endpoint: "/api/v1/users", requests: 18, limit: 50 },
    ],
  },
  {
    id: "cons-008",
    name: "InsightDash",
    tier: "pro",
    apiKey: "pro_ak_c9d0e1f2",
    currentRequests: 4230,
    requestLimit: 10000,
    burstUsed: 100,
    burstLimit: 500,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: false,
    lastActive: "2026-02-22T06:35:00Z",
    totalRequestsToday: 55000,
    endpointBreakdown: [
      { endpoint: "/api/v1/analytics", requests: 2800, limit: 6000 },
      { endpoint: "/api/v1/search", requests: 900, limit: 3600 },
      { endpoint: "/api/v1/dashboard", requests: 530, limit: 400 },
    ],
  },
  {
    id: "cons-009",
    name: "FreeTier User #4482",
    tier: "free",
    apiKey: "fre_ak_g3h4i5j6",
    currentRequests: 145,
    requestLimit: 100,
    burstUsed: 20,
    burstLimit: 20,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: true,
    lastActive: "2026-02-22T06:30:00Z",
    totalRequestsToday: 3800,
    endpointBreakdown: [
      { endpoint: "/api/v1/users", requests: 95, limit: 60 },
      { endpoint: "/api/v1/posts", requests: 50, limit: 40 },
    ],
  },
  {
    id: "cons-010",
    name: "CloudBridge API",
    tier: "enterprise",
    apiKey: "ent_ak_k7l8m9n0",
    currentRequests: 55000,
    requestLimit: 100000,
    burstUsed: 2100,
    burstLimit: 5000,
    windowResetAt: "2026-02-22T07:00:00Z",
    isThrottled: false,
    lastActive: "2026-02-22T06:44:00Z",
    totalRequestsToday: 631200,
    endpointBreakdown: [
      { endpoint: "/api/v1/bridge", requests: 38000, limit: 60000 },
      { endpoint: "/api/v1/sync", requests: 12000, limit: 25000 },
      { endpoint: "/api/v1/webhooks/*", requests: 5000, limit: 15000 },
    ],
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000000) {return (n / 1000000).toFixed(1) + "M";}
  if (n >= 1000) {return (n / 1000).toFixed(1) + "K";}
  return n.toString();
}

function formatWindowSeconds(s: number): string {
  if (s < 60) {return `${s}s`;}
  if (s < 3600) {return `${s / 60}m`;}
  if (s < 86400) {return `${s / 3600}h`;}
  return `${s / 86400}d`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hours = d.getUTCHours().toString().padStart(2, "0");
  const minutes = d.getUTCMinutes().toString().padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hours}:${minutes} UTC`;
}

function getUtilizationPct(current: number, limit: number): number {
  return Math.min(Math.round((current / limit) * 100), 100);
}

function getMaskKey(key: string): string {
  const parts = key.split("_");
  if (parts.length < 3) {return key.slice(0, 4) + "••••••••";}
  const prefix = parts.slice(0, 2).join("_");
  const suffix = parts[2].slice(-4);
  return `${prefix}_••••${suffix}`;
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: Tier }) {
  const styles: Record<Tier, string> = {
    free: "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]",
    basic: "bg-sky-900 text-sky-300",
    pro: "bg-indigo-900 text-indigo-300",
    enterprise: "bg-violet-900 text-violet-300",
    internal: "bg-emerald-900 text-emerald-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide",
        styles[tier]
      )}
    >
      {tier}
    </span>
  );
}

// ─── Scope Badge ──────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: Scope }) {
  const styles: Record<Scope, string> = {
    global: "bg-amber-900 text-amber-300",
    "per-user": "bg-blue-900 text-blue-300",
    "per-ip": "bg-orange-900 text-orange-300",
    "per-endpoint": "bg-teal-900 text-teal-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        styles[scope]
      )}
    >
      {scope}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RuleStatus }) {
  const styles: Record<RuleStatus, string> = {
    active: "bg-emerald-900 text-emerald-400",
    disabled: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
    draft: "bg-amber-900 text-amber-400",
  };
  const dots: Record<RuleStatus, string> = {
    active: "bg-emerald-400",
    disabled: "bg-[var(--color-surface-3)]",
    draft: "bg-amber-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
        styles[status]
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dots[status])} />
      {status}
    </span>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: ViolationSeverity }) {
  const styles: Record<ViolationSeverity, string> = {
    low: "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]",
    medium: "bg-amber-900 text-amber-400",
    high: "bg-orange-900 text-orange-400",
    critical: "bg-rose-900 text-rose-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase",
        styles[severity]
      )}
    >
      {severity}
    </span>
  );
}

// ─── Utilization Bar ─────────────────────────────────────────────────────────

function UtilizationBar({
  current,
  limit,
  showLabel = true,
}: {
  current: number;
  limit: number;
  showLabel?: boolean;
}) {
  const pct = getUtilizationPct(current, limit);
  const isOver = current > limit;
  const barColor =
    pct >= 100
      ? "bg-rose-500"
      : pct >= 85
      ? "bg-amber-400"
      : pct >= 60
      ? "bg-indigo-400"
      : "bg-emerald-400";

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span className={cn("font-mono", isOver ? "text-rose-400" : "text-[var(--color-text-primary)]")}>
            {formatNumber(current)} / {formatNumber(limit)}
          </span>
          <span className={cn("font-semibold", pct >= 100 ? "text-rose-400" : pct >= 85 ? "text-amber-400" : "text-[var(--color-text-secondary)]")}>
            {pct}%
          </span>
        </div>
      )}
      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Sparkline (plain div chart) ─────────────────────────────────────────────

function Sparkline({
  points,
  severity,
  width = 120,
  height = 32,
}: {
  points: number[];
  severity: ViolationSeverity;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...points, 1);
  const barColor: Record<ViolationSeverity, string> = {
    low: "bg-[var(--color-surface-3)]",
    medium: "bg-amber-400",
    high: "bg-orange-400",
    critical: "bg-rose-400",
  };

  return (
    <div
      className="flex items-end gap-px"
      style={{ width, height }}
      aria-label="Violation timeline chart"
    >
      {points.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm opacity-80", barColor[severity])}
          style={{ height: `${Math.max(4, (v / max) * height)}px` }}
        />
      ))}
    </div>
  );
}

// ─── Mini Bar Chart (Overview) ────────────────────────────────────────────────

function TopConsumersChart({
  consumers,
}: {
  consumers: Consumer[];
}) {
  const sorted = [...consumers]
    .toSorted((a, b) => b.currentRequests - a.currentRequests)
    .slice(0, 8);
  const maxVal = Math.max(...sorted.map((c) => c.currentRequests), 1);

  return (
    <div className="space-y-3">
      {sorted.map((c) => {
        const pct = (c.currentRequests / maxVal) * 100;
        const utilPct = getUtilizationPct(c.currentRequests, c.requestLimit);
        const barColor =
          utilPct >= 100
            ? "bg-rose-500"
            : utilPct >= 85
            ? "bg-amber-400"
            : utilPct >= 60
            ? "bg-indigo-500"
            : "bg-emerald-500";
        return (
          <div key={c.id} className="flex items-center gap-3">
            <div className="w-28 shrink-0 truncate text-xs text-[var(--color-text-primary)]">{c.name}</div>
            <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-4 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-16 shrink-0 text-right text-xs font-mono text-[var(--color-text-secondary)]">
              {formatNumber(c.currentRequests)}
            </div>
            <TierBadge tier={c.tier} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        enabled ? "bg-indigo-500" : "bg-[var(--color-surface-3)]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── Rule Detail Panel ────────────────────────────────────────────────────────

function RuleDetailPanel({
  rule,
  onClose,
  onToggle,
}: {
  rule: RateLimitRule;
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{rule.name}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{rule.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ml-4 mt-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Meta */}
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <TierBadge tier={rule.tier} />
            <ScopeBadge scope={rule.scope} />
            <StatusBadge status={rule.status} />
          </div>

          {/* Limits grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Requests",
                value: formatNumber(rule.requestsPerWindow),
                sub: `per ${formatWindowSeconds(rule.windowSeconds)}`,
              },
              {
                label: "Window",
                value: formatWindowSeconds(rule.windowSeconds),
                sub: `${rule.windowSeconds.toLocaleString()} seconds`,
              },
              {
                label: "Burst",
                value: formatNumber(rule.burstLimit),
                sub: "max burst",
              },
            ].map((item) => (
              <div key={item.label} className="bg-[var(--color-surface-2)] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">{item.value}</div>
                <div className="text-xs text-indigo-400 font-medium mt-0.5">{item.label}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Endpoint */}
          <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Endpoint Pattern</div>
            <code className="text-sm text-indigo-300 font-mono">{rule.endpoint}</code>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <div className="text-xs text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Violations (24h)</div>
              <div className={cn("text-xl font-bold", rule.violationsLast24h > 50 ? "text-rose-400" : rule.violationsLast24h > 10 ? "text-amber-400" : "text-emerald-400")}>
                {rule.violationsLast24h}
              </div>
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <div className="text-xs text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Throttled Now</div>
              <div className={cn("text-xl font-bold", rule.throttledCount > 0 ? "text-rose-400" : "text-emerald-400")}>
                {rule.throttledCount}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="text-xs text-[var(--color-text-muted)] space-y-1">
            <div>Created: {formatTimestamp(rule.createdAt)}</div>
            <div>Updated: {formatTimestamp(rule.updatedAt)}</div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between bg-[var(--color-surface-2)] rounded-xl px-4 py-3">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">Rule Active</div>
              <div className="text-xs text-[var(--color-text-muted)]">Toggle to enable or disable enforcement</div>
            </div>
            <Toggle
              enabled={rule.status === "active"}
              onToggle={() => onToggle(rule.id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ rules, violations, consumers }: { rules: RateLimitRule[]; violations: Violation[]; consumers: Consumer[] }) {
  const activeRules = rules.filter((r) => r.status === "active").length;
  const totalViolationsHour = violations.filter((v) => {
    const ts = new Date(v.timestamp).getTime();
    const now = new Date("2026-02-22T07:00:00Z").getTime();
    return now - ts < 3600000;
  }).length;
  const throttledNow = consumers.filter((c) => c.isThrottled).length;
  const totalRules = rules.length;

  const stats: OverviewStat[] = [
    {
      label: "Total Rules",
      value: totalRules,
      delta: "+2 this week",
      positive: true,
      accent: "indigo",
    },
    {
      label: "Active Rules",
      value: activeRules,
      delta: `${totalRules - activeRules} inactive`,
      positive: true,
      accent: "emerald",
    },
    {
      label: "Violations (1h)",
      value: totalViolationsHour,
      delta: "+12 vs last hour",
      positive: false,
      accent: "rose",
    },
    {
      label: "Throttled Now",
      value: throttledNow,
      delta: `of ${consumers.length} consumers`,
      positive: throttledNow === 0,
      accent: throttledNow > 3 ? "rose" : "amber",
    },
  ];

  const accentBorder: Record<string, string> = {
    indigo: "border-indigo-500/40",
    emerald: "border-emerald-500/40",
    rose: "border-rose-500/40",
    amber: "border-amber-500/40",
  };
  const accentText: Record<string, string> = {
    indigo: "text-indigo-400",
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    amber: "text-amber-400",
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn("bg-[var(--color-surface-1)] border rounded-xl p-5", accentBorder[s.accent])}
          >
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">{s.value}</div>
            <div className={cn("text-xs mt-2", s.positive ? "text-emerald-400" : "text-rose-400")}>
              {s.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Top Consumers Chart */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Top Consumers by Usage</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Current window requests vs. limit</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" />Normal</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />High</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-rose-500 rounded-full inline-block" />Over Limit</span>
          </div>
        </div>
        <TopConsumersChart consumers={consumers} />
      </div>

      {/* Two-column: violations + throttled */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent critical violations */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Recent Critical Violations</h3>
          <div className="space-y-3">
            {violations
              .filter((v) => v.severity === "critical" || v.severity === "high")
              .slice(0, 4)
              .map((v) => (
                <div key={v.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] truncate">{v.consumerName}</div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono truncate">{v.endpoint}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-sm font-mono font-semibold text-rose-400">
                      {formatNumber(v.count)}
                    </span>
                    <SeverityBadge severity={v.severity} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Throttled consumers */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Currently Throttled Consumers</h3>
          <div className="space-y-4">
            {consumers.filter((c) => c.isThrottled).map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm text-[var(--color-text-primary)]">{c.name}</div>
                  <TierBadge tier={c.tier} />
                </div>
                <UtilizationBar current={c.currentRequests} limit={c.requestLimit} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rule health breakdown */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Rule Violation Heat Map (Last 24h)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rules.filter((r) => r.violationsLast24h > 0).map((r) => {
            const intensity = r.violationsLast24h;
            const bg =
              intensity > 100
                ? "bg-rose-900/60 border-rose-700"
                : intensity > 50
                ? "bg-amber-900/60 border-amber-700"
                : intensity > 10
                ? "bg-yellow-900/60 border-yellow-800"
                : "bg-[var(--color-surface-2)] border-[var(--color-border)]";
            const textColor =
              intensity > 100
                ? "text-rose-300"
                : intensity > 50
                ? "text-amber-300"
                : intensity > 10
                ? "text-yellow-300"
                : "text-[var(--color-text-secondary)]";
            return (
              <div key={r.id} className={cn("border rounded-lg p-3", bg)}>
                <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">{r.name}</div>
                <div className={cn("text-lg font-bold mt-1", textColor)}>
                  {r.violationsLast24h}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">violations</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab({
  rules,
  ruleStatuses,
  onToggleRule,
}: {
  rules: RateLimitRule[];
  ruleStatuses: Record<string, RuleStatus>;
  onToggleRule: (id: string) => void;
}) {
  const [selectedRule, setSelectedRule] = useState<RateLimitRule | null>(null);
  const [filterTier, setFilterTier] = useState<Tier | "all">("all");
  const [filterStatus, setFilterStatus] = useState<RuleStatus | "all">("all");
  const [filterScope, setFilterScope] = useState<Scope | "all">("all");

  const tiers: Array<Tier | "all"> = ["all", "free", "basic", "pro", "enterprise", "internal"];
  const scopes: Array<Scope | "all"> = ["all", "global", "per-user", "per-ip", "per-endpoint"];
  const statuses: Array<RuleStatus | "all"> = ["all", "active", "disabled", "draft"];

  const filtered = rules.filter((r) => {
    const effectiveStatus = ruleStatuses[r.id] ?? r.status;
    if (filterTier !== "all" && r.tier !== filterTier) {return false;}
    if (filterStatus !== "all" && effectiveStatus !== filterStatus) {return false;}
    if (filterScope !== "all" && r.scope !== filterScope) {return false;}
    return true;
  });

  const effectiveRule = (r: RateLimitRule): RateLimitRule => ({
    ...r,
    status: ruleStatuses[r.id] ?? r.status,
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Tier</label>
            <div className="flex gap-1 flex-wrap">
              {tiers.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filterTier === t
                      ? "bg-indigo-600 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Status</label>
            <div className="flex gap-1">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filterStatus === s
                      ? "bg-indigo-600 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Scope</label>
            <div className="flex gap-1 flex-wrap">
              {scopes.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterScope(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filterScope === s
                      ? "bg-indigo-600 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-3">
          Showing {filtered.length} of {rules.length} rules
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Rule</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Limit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Burst</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Violations 24h</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Toggle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const eff = effectiveRule(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRule(eff)}
                    className={cn(
                      "border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/50 cursor-pointer transition-colors",
                      i % 2 === 0 ? "bg-transparent" : "bg-[var(--color-surface-1)]/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text-primary)]">{r.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5 truncate max-w-xs">{r.endpoint}</div>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={r.tier} />
                    </td>
                    <td className="px-4 py-3">
                      <ScopeBadge scope={r.scope} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--color-text-primary)] font-mono font-medium">
                        {formatNumber(r.requestsPerWindow)}
                      </span>
                      <span className="text-[var(--color-text-muted)] text-xs ml-1">
                        / {formatWindowSeconds(r.windowSeconds)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-indigo-400 font-mono font-medium">
                        {formatNumber(r.burstLimit)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          r.violationsLast24h > 100
                            ? "text-rose-400"
                            : r.violationsLast24h > 20
                            ? "text-amber-400"
                            : "text-emerald-400"
                        )}
                      >
                        {r.violationsLast24h}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={eff.status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        enabled={eff.status === "active"}
                        onToggle={() => onToggleRule(r.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            No rules match the current filters.
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedRule && (
        <RuleDetailPanel
          rule={effectiveRule(selectedRule)}
          onClose={() => setSelectedRule(null)}
          onToggle={(id) => {
            onToggleRule(id);
            setSelectedRule((prev) =>
              prev
                ? {
                    ...prev,
                    status:
                      (ruleStatuses[id] ?? prev.status) === "active"
                        ? "disabled"
                        : "active",
                  }
                : null
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Violations Tab ───────────────────────────────────────────────────────────

function ViolationsTab({ violations }: { violations: Violation[] }) {
  const [filterSeverity, setFilterSeverity] = useState<ViolationSeverity | "all">("all");
  const [sortBy, setSortBy] = useState<"count" | "timestamp" | "severity">("timestamp");
  const [expanded, setExpanded] = useState<string | null>(null);

  const severities: Array<ViolationSeverity | "all"> = ["all", "critical", "high", "medium", "low"];

  const severityOrder: Record<ViolationSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filtered = violations
    .filter((v) => filterSeverity === "all" || v.severity === filterSeverity)
    .toSorted((a, b) => {
      if (sortBy === "count") {return b.count - a.count;}
      if (sortBy === "severity")
        {return severityOrder[b.severity] - severityOrder[a.severity];}
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const totalViolations = filtered.reduce((s, v) => s + v.count, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as ViolationSeverity[]).map((sev) => {
          const count = violations.filter((v) => v.severity === sev).length;
          const total = violations.filter((v) => v.severity === sev).reduce((s, v) => s + v.count, 0);
          const colors: Record<ViolationSeverity, string> = {
            critical: "border-rose-700 bg-rose-950/30",
            high: "border-orange-700 bg-orange-950/30",
            medium: "border-amber-700 bg-amber-950/30",
            low: "border-[var(--color-border)] bg-[var(--color-surface-2)]/30",
          };
          const textColors: Record<ViolationSeverity, string> = {
            critical: "text-rose-400",
            high: "text-orange-400",
            medium: "text-amber-400",
            low: "text-[var(--color-text-secondary)]",
          };
          return (
            <div key={sev} className={cn("border rounded-xl p-4 cursor-pointer transition-all", colors[sev], filterSeverity === sev ? "ring-1 ring-white/20" : "")} onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}>
              <div className="text-xs text-[var(--color-text-muted)] capitalize">{sev}</div>
              <div className={cn("text-2xl font-bold mt-1", textColors[sev])}>{count}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{formatNumber(total)} hits</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                filterSeverity === s
                  ? "bg-indigo-600 text-[var(--color-text-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--color-text-muted)]">Sort:</span>
          {(["timestamp", "count", "severity"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize",
                sortBy === s
                  ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-[var(--color-text-muted)]">
        {filtered.length} violation events · {formatNumber(totalViolations)} total hits
      </div>

      {/* Violations List */}
      <div className="space-y-2">
        {filtered.map((v) => (
          <div
            key={v.id}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden"
          >
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--color-surface-2)]/40 transition-colors"
              onClick={() => setExpanded(expanded === v.id ? null : v.id)}
            >
              {/* Left: consumer + endpoint */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{v.consumerName}</span>
                  <SeverityBadge severity={v.severity} />
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] font-mono mt-1 truncate">{v.endpoint}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{v.ruleName}</div>
              </div>

              {/* Sparkline */}
              <div className="shrink-0 hidden sm:block">
                <Sparkline points={v.timelinePoints} severity={v.severity} />
              </div>

              {/* Count */}
              <div className="shrink-0 text-right">
                <div className={cn("text-xl font-bold font-mono", v.severity === "critical" ? "text-rose-400" : v.severity === "high" ? "text-orange-400" : v.severity === "medium" ? "text-amber-400" : "text-[var(--color-text-secondary)]")}>
                  {formatNumber(v.count)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">hits</div>
              </div>

              {/* Timestamp */}
              <div className="shrink-0 hidden md:block text-right">
                <div className="text-xs text-[var(--color-text-secondary)]">{formatTimestamp(v.timestamp)}</div>
              </div>

              {/* Expand icon */}
              <div className="shrink-0 text-[var(--color-text-muted)]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className={cn("transition-transform", expanded === v.id ? "rotate-180" : "")}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === v.id && (
              <div className="border-t border-[var(--color-border)] px-4 py-4 bg-[var(--color-surface-0)]/40">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Consumer ID</div>
                    <div className="font-mono text-[var(--color-text-primary)] text-xs">{v.consumerId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">IP Address</div>
                    <div className="font-mono text-[var(--color-text-primary)] text-xs">{v.ipAddress}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Rule ID</div>
                    <div className="font-mono text-[var(--color-text-primary)] text-xs">{v.ruleId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Timestamp</div>
                    <div className="text-[var(--color-text-primary)] text-xs">{formatTimestamp(v.timestamp)}</div>
                  </div>
                </div>
                {/* Larger sparkline in expanded */}
                <div className="mt-4">
                  <div className="text-xs text-[var(--color-text-muted)] mb-2">Activity Timeline (last 12 intervals)</div>
                  <div className="flex items-end gap-1" style={{ height: 60 }}>
                    {v.timelinePoints.map((pt, idx) => {
                      const max = Math.max(...v.timelinePoints, 1);
                      const h = Math.max(4, (pt / max) * 60);
                      const barColor =
                        v.severity === "critical"
                          ? "bg-rose-500"
                          : v.severity === "high"
                          ? "bg-orange-400"
                          : v.severity === "medium"
                          ? "bg-amber-400"
                          : "bg-[var(--color-surface-3)]";
                      return (
                        <div
                          key={idx}
                          className={cn("flex-1 rounded-sm", barColor)}
                          style={{ height: h }}
                          title={`${pt} hits`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                    <span>-12 intervals</span>
                    <span>now</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Consumers Tab ────────────────────────────────────────────────────────────

function ConsumersTab({ consumers }: { consumers: Consumer[] }) {
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [filterTier, setFilterTier] = useState<Tier | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "throttled" | "healthy">("all");
  const [sortBy, setSortBy] = useState<"usage" | "name" | "requests">("usage");

  const tiers: Array<Tier | "all"> = ["all", "free", "basic", "pro", "enterprise", "internal"];

  const filtered = consumers
    .filter((c) => {
      if (filterTier !== "all" && c.tier !== filterTier) {return false;}
      if (filterStatus === "throttled" && !c.isThrottled) {return false;}
      if (filterStatus === "healthy" && c.isThrottled) {return false;}
      return true;
    })
    .toSorted((a, b) => {
      if (sortBy === "usage") {
        return getUtilizationPct(b.currentRequests, b.requestLimit) - getUtilizationPct(a.currentRequests, a.requestLimit);
      }
      if (sortBy === "requests") {return b.currentRequests - a.currentRequests;}
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Consumers", value: consumers.length, color: "text-[var(--color-text-primary)]" },
          { label: "Throttled", value: consumers.filter((c) => c.isThrottled).length, color: "text-rose-400" },
          { label: "Near Limit (>85%)", value: consumers.filter((c) => getUtilizationPct(c.currentRequests, c.requestLimit) >= 85).length, color: "text-amber-400" },
          { label: "Healthy (<60%)", value: consumers.filter((c) => getUtilizationPct(c.currentRequests, c.requestLimit) < 60).length, color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{stat.label}</div>
            <div className={cn("text-2xl font-bold mt-1", stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Tier</label>
            <div className="flex gap-1 flex-wrap">
              {tiers.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filterTier === t
                      ? "bg-indigo-600 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Status</label>
            <div className="flex gap-1">
              {(["all", "throttled", "healthy"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize",
                    filterStatus === s
                      ? "bg-indigo-600 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Sort</label>
            <div className="flex gap-1">
              {(["usage", "requests", "name"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize",
                    sortBy === s
                      ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-3">
          Showing {filtered.length} of {consumers.length} consumers
        </div>
      </div>

      {/* Consumer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((c) => {
          const utilPct = getUtilizationPct(c.currentRequests, c.requestLimit);
          const burstPct = getUtilizationPct(c.burstUsed, c.burstLimit);
          return (
            <div
              key={c.id}
              className={cn(
                "bg-[var(--color-surface-1)] border rounded-xl p-5 cursor-pointer hover:bg-[var(--color-surface-2)]/40 transition-all",
                c.isThrottled ? "border-rose-800" : utilPct >= 85 ? "border-amber-800" : "border-[var(--color-border)]"
              )}
              onClick={() => setSelectedConsumer(c)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{c.name}</span>
                    {c.isThrottled && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-rose-900 text-rose-400 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse inline-block" />
                        THROTTLED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{getMaskKey(c.apiKey)}</div>
                </div>
                <TierBadge tier={c.tier} />
              </div>

              {/* Request usage */}
              <div className="mb-3">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Request Usage</div>
                <UtilizationBar current={c.currentRequests} limit={c.requestLimit} />
              </div>

              {/* Burst usage */}
              <div className="mb-4">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Burst Usage</div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {formatNumber(c.burstUsed)} / {formatNumber(c.burstLimit)}
                    </span>
                    <span className={cn("font-semibold", burstPct >= 100 ? "text-rose-400" : burstPct >= 85 ? "text-amber-400" : "text-[var(--color-text-secondary)]")}>
                      {burstPct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        burstPct >= 100 ? "bg-rose-500" : burstPct >= 85 ? "bg-amber-400" : "bg-indigo-500"
                      )}
                      style={{ width: `${Math.min(burstPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Today: <span className="text-[var(--color-text-primary)] font-mono">{formatNumber(c.totalRequestsToday)}</span></span>
                <span>Last active: <span className="text-[var(--color-text-secondary)]">{formatTimestamp(c.lastActive)}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Consumer Detail Modal */}
      {selectedConsumer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedConsumer(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface-1)] z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedConsumer.name}</h3>
                  {selectedConsumer.isThrottled && (
                    <span className="px-2 py-0.5 rounded text-xs bg-rose-900 text-rose-400 font-semibold">THROTTLED</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <TierBadge tier={selectedConsumer.tier} />
                  <span className="text-xs text-[var(--color-text-muted)] font-mono">{getMaskKey(selectedConsumer.apiKey)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedConsumer(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Quota overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Request Quota</div>
                  <UtilizationBar current={selectedConsumer.currentRequests} limit={selectedConsumer.requestLimit} />
                </div>
                <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Burst Quota</div>
                  <UtilizationBar current={selectedConsumer.burstUsed} limit={selectedConsumer.burstLimit} />
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Requests Today", value: formatNumber(selectedConsumer.totalRequestsToday), color: "text-[var(--color-text-primary)]" },
                  { label: "Window Resets", value: formatTimestamp(selectedConsumer.windowResetAt), color: "text-indigo-300" },
                  { label: "Last Active", value: formatTimestamp(selectedConsumer.lastActive), color: "text-[var(--color-text-primary)]" },
                ].map((item) => (
                  <div key={item.label} className="bg-[var(--color-surface-2)] rounded-xl p-4">
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{item.label}</div>
                    <div className={cn("text-sm font-semibold", item.color)}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Endpoint breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Endpoint Breakdown</h4>
                <div className="space-y-4">
                  {selectedConsumer.endpointBreakdown.map((ep) => {
                    const pct = getUtilizationPct(ep.requests, ep.limit);
                    const isOver = ep.requests > ep.limit;
                    return (
                      <div key={ep.endpoint}>
                        <div className="flex items-center justify-between mb-1.5">
                          <code className={cn("text-xs font-mono", isOver ? "text-rose-400" : "text-[var(--color-text-primary)]")}>
                            {ep.endpoint}
                          </code>
                          <span className={cn("text-xs font-semibold", isOver ? "text-rose-400" : pct >= 85 ? "text-amber-400" : "text-[var(--color-text-muted)]")}>
                            {pct}%
                          </span>
                        </div>
                        <UtilizationBar current={ep.requests} limit={ep.limit} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Visual usage by endpoint (horizontal bar chart) */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Relative Usage by Endpoint</h4>
                <div className="space-y-2">
                  {selectedConsumer.endpointBreakdown.map((ep) => {
                    const maxReq = Math.max(...selectedConsumer.endpointBreakdown.map((e) => e.requests), 1);
                    const barPct = (ep.requests / maxReq) * 100;
                    const isOver = ep.requests > ep.limit;
                    return (
                      <div key={ep.endpoint + "-bar"} className="flex items-center gap-3">
                        <code className="text-xs font-mono text-[var(--color-text-secondary)] w-40 shrink-0 truncate">{ep.endpoint}</code>
                        <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded overflow-hidden">
                          <div
                            className={cn("h-full rounded transition-all", isOver ? "bg-rose-500" : "bg-indigo-500")}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-[var(--color-text-primary)] w-12 text-right shrink-0">
                          {formatNumber(ep.requests)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function APIRateLimitManager() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [ruleStatuses, setRuleStatuses] = useState<Record<string, RuleStatus>>({});

  const handleToggleRule = (id: string) => {
    setRuleStatuses((prev) => {
      const current: RuleStatus = prev[id] ?? (RULES.find((r) => r.id === id)?.status ?? "active");
      const next: RuleStatus = current === "active" ? "disabled" : "active";
      return { ...prev, [id]: next };
    });
  };

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    {
      id: "rules",
      label: "Rules",
      count: RULES.filter((r) => (ruleStatuses[r.id] ?? r.status) === "active").length,
    },
    {
      id: "violations",
      label: "Violations",
      count: VIOLATIONS.filter((v) => v.severity === "critical" || v.severity === "high").length,
    },
    { id: "consumers", label: "Consumers", count: CONSUMERS.length },
  ];

  const activeRulesCount = RULES.filter(
    (r) => (ruleStatuses[r.id] ?? r.status) === "active"
  ).length;
  const throttledCount = CONSUMERS.filter((c) => c.isThrottled).length;
  const criticalViolations = VIOLATIONS.filter((v) => v.severity === "critical").length;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Top Bar */}
      <div className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--color-text-primary)]">API Rate Limit Manager</h1>
                <p className="text-xs text-[var(--color-text-muted)]">Manage rate limiting rules, violations, and consumer quotas</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {throttledCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/50 border border-rose-800 rounded-lg">
                <span className="w-2 h-2 bg-rose-400 rounded-full animate-pulse" />
                <span className="text-xs text-rose-300 font-semibold">
                  {throttledCount} throttled
                </span>
              </div>
            )}
            {criticalViolations > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-900/50 border border-orange-800 rounded-lg">
                <span className="w-2 h-2 bg-orange-400 rounded-full" />
                <span className="text-xs text-orange-300 font-semibold">
                  {criticalViolations} critical
                </span>
              </div>
            )}
            <div className="text-xs text-[var(--color-text-muted)]">
              <span className="text-emerald-400 font-semibold">{activeRulesCount}</span>
              <span> active rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)] px-6">
        <div className="max-w-7xl mx-auto">
          <nav className="flex gap-1" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-semibold",
                      activeTab === tab.id ? "bg-indigo-900 text-indigo-300" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "overview" && (
          <OverviewTab rules={RULES} violations={VIOLATIONS} consumers={CONSUMERS} />
        )}
        {activeTab === "rules" && (
          <RulesTab
            rules={RULES}
            ruleStatuses={ruleStatuses}
            onToggleRule={handleToggleRule}
          />
        )}
        {activeTab === "violations" && <ViolationsTab violations={VIOLATIONS} />}
        {activeTab === "consumers" && <ConsumersTab consumers={CONSUMERS} />}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] mt-8 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>API Rate Limit Manager · Product &amp; UI Squad</span>
          <span>Data refreshes every 30s in production · All times UTC</span>
        </div>
      </div>
    </div>
  );
}
