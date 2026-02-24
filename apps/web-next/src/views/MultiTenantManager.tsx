import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Type Definitions ────────────────────────────────────────────────────────

type OrgStatus = "active" | "suspended" | "trial";
type PlanTier = "starter" | "professional" | "enterprise" | "custom";
type UserRole = "owner" | "admin" | "member" | "viewer";
type AccountStatus = "active" | "suspended" | "invited";
type TabId = "organizations" | "users" | "quotas" | "billing";

interface OrgMember {
  userId: string;
  role: UserRole;
}

interface OrgUsageStats {
  apiCallsToday: number;
  apiCallsMonth: number;
  avgResponseMs: number;
  errorRate: number;
}

interface Organization {
  id: string;
  name: string;
  plan: PlanTier;
  userCount: number;
  storageUsedGb: number;
  storageLimitGb: number;
  agentCount: number;
  agentLimit: number;
  status: OrgStatus;
  createdAt: string;
  domain: string;
  members: OrgMember[];
  usage: OrgUsageStats;
  settings: {
    ssoEnabled: boolean;
    ipWhitelist: boolean;
    auditLog: boolean;
    customBranding: boolean;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  orgId: string;
  orgName: string;
  role: UserRole;
  lastLogin: string;
  mfaEnabled: boolean;
  status: AccountStatus;
  createdAt: string;
}

interface QuotaConfig {
  orgId: string;
  orgName: string;
  apiCalls: { used: number; limit: number };
  storage: { usedGb: number; limitGb: number };
  agents: { used: number; limit: number };
  modelTokens: { usedM: number; limitM: number };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
}

interface BillingInfo {
  orgId: string;
  orgName: string;
  plan: PlanTier;
  monthlySpend: number;
  overages: number;
  nextRenewal: string;
  invoices: Invoice[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const ORGANIZATIONS: Organization[] = [
  {
    id: "org-1",
    name: "Nextera Analytics",
    plan: "enterprise",
    userCount: 48,
    storageUsedGb: 245,
    storageLimitGb: 500,
    agentCount: 12,
    agentLimit: 25,
    status: "active",
    createdAt: "2024-03-15",
    domain: "nextera-analytics.com",
    members: [
      { userId: "usr-1", role: "owner" },
      { userId: "usr-2", role: "admin" },
      { userId: "usr-6", role: "member" },
    ],
    usage: { apiCallsToday: 14320, apiCallsMonth: 387400, avgResponseMs: 142, errorRate: 0.3 },
    settings: { ssoEnabled: true, ipWhitelist: true, auditLog: true, customBranding: true },
  },
  {
    id: "org-2",
    name: "BrightPath Education",
    plan: "professional",
    userCount: 23,
    storageUsedGb: 67,
    storageLimitGb: 200,
    agentCount: 5,
    agentLimit: 10,
    status: "active",
    createdAt: "2024-07-22",
    domain: "brightpath.edu",
    members: [
      { userId: "usr-3", role: "owner" },
      { userId: "usr-7", role: "admin" },
    ],
    usage: { apiCallsToday: 5840, apiCallsMonth: 142600, avgResponseMs: 198, errorRate: 0.8 },
    settings: { ssoEnabled: true, ipWhitelist: false, auditLog: true, customBranding: false },
  },
  {
    id: "org-3",
    name: "Verdant Health Systems",
    plan: "enterprise",
    userCount: 112,
    storageUsedGb: 489,
    storageLimitGb: 1000,
    agentCount: 22,
    agentLimit: 50,
    status: "active",
    createdAt: "2023-11-08",
    domain: "verdanthealth.io",
    members: [
      { userId: "usr-4", role: "owner" },
      { userId: "usr-8", role: "admin" },
      { userId: "usr-9", role: "member" },
    ],
    usage: { apiCallsToday: 28750, apiCallsMonth: 821000, avgResponseMs: 115, errorRate: 0.2 },
    settings: { ssoEnabled: true, ipWhitelist: true, auditLog: true, customBranding: true },
  },
  {
    id: "org-4",
    name: "Catalina Robotics",
    plan: "starter",
    userCount: 6,
    storageUsedGb: 8,
    storageLimitGb: 50,
    agentCount: 2,
    agentLimit: 3,
    status: "trial",
    createdAt: "2026-01-29",
    domain: "catalinarobotics.dev",
    members: [
      { userId: "usr-5", role: "owner" },
      { userId: "usr-10", role: "member" },
    ],
    usage: { apiCallsToday: 920, apiCallsMonth: 12400, avgResponseMs: 210, errorRate: 1.2 },
    settings: { ssoEnabled: false, ipWhitelist: false, auditLog: false, customBranding: false },
  },
  {
    id: "org-5",
    name: "Pinnacle Financial Group",
    plan: "custom",
    userCount: 74,
    storageUsedGb: 312,
    storageLimitGb: 750,
    agentCount: 18,
    agentLimit: 30,
    status: "suspended",
    createdAt: "2024-01-10",
    domain: "pinnaclefg.com",
    members: [
      { userId: "usr-11", role: "owner" },
      { userId: "usr-12", role: "admin" },
    ],
    usage: { apiCallsToday: 0, apiCallsMonth: 4200, avgResponseMs: 0, errorRate: 0 },
    settings: { ssoEnabled: true, ipWhitelist: true, auditLog: true, customBranding: true },
  },
];

const USERS: User[] = [
  { id: "usr-1", name: "Maria Chen", email: "maria.chen@nextera-analytics.com", orgId: "org-1", orgName: "Nextera Analytics", role: "owner", lastLogin: "2026-02-22T08:14:00Z", mfaEnabled: true, status: "active", createdAt: "2024-03-15" },
  { id: "usr-2", name: "James Okafor", email: "j.okafor@nextera-analytics.com", orgId: "org-1", orgName: "Nextera Analytics", role: "admin", lastLogin: "2026-02-21T17:30:00Z", mfaEnabled: true, status: "active", createdAt: "2024-04-02" },
  { id: "usr-3", name: "Priya Sharma", email: "priya@brightpath.edu", orgId: "org-2", orgName: "BrightPath Education", role: "owner", lastLogin: "2026-02-22T06:45:00Z", mfaEnabled: true, status: "active", createdAt: "2024-07-22" },
  { id: "usr-4", name: "Dr. Alan Reeves", email: "a.reeves@verdanthealth.io", orgId: "org-3", orgName: "Verdant Health Systems", role: "owner", lastLogin: "2026-02-22T09:01:00Z", mfaEnabled: true, status: "active", createdAt: "2023-11-08" },
  { id: "usr-5", name: "Sofia Gutierrez", email: "sofia@catalinarobotics.dev", orgId: "org-4", orgName: "Catalina Robotics", role: "owner", lastLogin: "2026-02-20T14:22:00Z", mfaEnabled: false, status: "active", createdAt: "2026-01-29" },
  { id: "usr-6", name: "Tomoko Hayashi", email: "t.hayashi@nextera-analytics.com", orgId: "org-1", orgName: "Nextera Analytics", role: "member", lastLogin: "2026-02-19T11:00:00Z", mfaEnabled: true, status: "active", createdAt: "2024-06-10" },
  { id: "usr-7", name: "Liam O'Brien", email: "liam@brightpath.edu", orgId: "org-2", orgName: "BrightPath Education", role: "admin", lastLogin: "2026-02-21T09:30:00Z", mfaEnabled: false, status: "active", createdAt: "2024-08-15" },
  { id: "usr-8", name: "Amina Diallo", email: "a.diallo@verdanthealth.io", orgId: "org-3", orgName: "Verdant Health Systems", role: "admin", lastLogin: "2026-02-22T07:55:00Z", mfaEnabled: true, status: "active", createdAt: "2024-01-20" },
  { id: "usr-9", name: "Kevin Park", email: "k.park@verdanthealth.io", orgId: "org-3", orgName: "Verdant Health Systems", role: "member", lastLogin: "2026-02-18T16:42:00Z", mfaEnabled: false, status: "suspended", createdAt: "2024-05-30" },
  { id: "usr-10", name: "Elena Vasquez", email: "elena@catalinarobotics.dev", orgId: "org-4", orgName: "Catalina Robotics", role: "member", lastLogin: "2026-02-15T10:10:00Z", mfaEnabled: false, status: "invited", createdAt: "2026-02-10" },
  { id: "usr-11", name: "Richard Hartley", email: "r.hartley@pinnaclefg.com", orgId: "org-5", orgName: "Pinnacle Financial Group", role: "owner", lastLogin: "2026-02-05T12:00:00Z", mfaEnabled: true, status: "active", createdAt: "2024-01-10" },
  { id: "usr-12", name: "Naomi Tanaka", email: "n.tanaka@pinnaclefg.com", orgId: "org-5", orgName: "Pinnacle Financial Group", role: "admin", lastLogin: "2026-02-04T08:30:00Z", mfaEnabled: true, status: "suspended", createdAt: "2024-02-18" },
];

const QUOTAS: QuotaConfig[] = [
  { orgId: "org-1", orgName: "Nextera Analytics", apiCalls: { used: 387400, limit: 500000 }, storage: { usedGb: 245, limitGb: 500 }, agents: { used: 12, limit: 25 }, modelTokens: { usedM: 42.3, limitM: 100 } },
  { orgId: "org-2", orgName: "BrightPath Education", apiCalls: { used: 142600, limit: 200000 }, storage: { usedGb: 67, limitGb: 200 }, agents: { used: 5, limit: 10 }, modelTokens: { usedM: 18.7, limitM: 50 } },
  { orgId: "org-3", orgName: "Verdant Health Systems", apiCalls: { used: 821000, limit: 1000000 }, storage: { usedGb: 489, limitGb: 1000 }, agents: { used: 22, limit: 50 }, modelTokens: { usedM: 88.1, limitM: 200 } },
  { orgId: "org-4", orgName: "Catalina Robotics", apiCalls: { used: 12400, limit: 50000 }, storage: { usedGb: 8, limitGb: 50 }, agents: { used: 2, limit: 3 }, modelTokens: { usedM: 1.2, limitM: 10 } },
  { orgId: "org-5", orgName: "Pinnacle Financial Group", apiCalls: { used: 4200, limit: 750000 }, storage: { usedGb: 312, limitGb: 750 }, agents: { used: 18, limit: 30 }, modelTokens: { usedM: 56.4, limitM: 150 } },
];

const BILLING: BillingInfo[] = [
  {
    orgId: "org-1", orgName: "Nextera Analytics", plan: "enterprise", monthlySpend: 2490, overages: 0, nextRenewal: "2026-03-15",
    invoices: [
      { id: "inv-101", date: "2026-02-01", amount: 2490, status: "paid" },
      { id: "inv-092", date: "2026-01-01", amount: 2490, status: "paid" },
      { id: "inv-083", date: "2025-12-01", amount: 2640, status: "paid" },
    ],
  },
  {
    orgId: "org-2", orgName: "BrightPath Education", plan: "professional", monthlySpend: 790, overages: 45, nextRenewal: "2026-03-22",
    invoices: [
      { id: "inv-104", date: "2026-02-01", amount: 835, status: "paid" },
      { id: "inv-095", date: "2026-01-01", amount: 790, status: "paid" },
      { id: "inv-086", date: "2025-12-01", amount: 790, status: "paid" },
    ],
  },
  {
    orgId: "org-3", orgName: "Verdant Health Systems", plan: "enterprise", monthlySpend: 4990, overages: 320, nextRenewal: "2026-03-08",
    invoices: [
      { id: "inv-107", date: "2026-02-01", amount: 5310, status: "pending" },
      { id: "inv-098", date: "2026-01-01", amount: 4990, status: "paid" },
      { id: "inv-089", date: "2025-12-01", amount: 5120, status: "paid" },
    ],
  },
  {
    orgId: "org-4", orgName: "Catalina Robotics", plan: "starter", monthlySpend: 0, overages: 0, nextRenewal: "2026-03-29",
    invoices: [
      { id: "inv-110", date: "2026-02-01", amount: 0, status: "paid" },
    ],
  },
  {
    orgId: "org-5", orgName: "Pinnacle Financial Group", plan: "custom", monthlySpend: 3200, overages: 0, nextRenewal: "2026-03-10",
    invoices: [
      { id: "inv-113", date: "2026-02-01", amount: 3200, status: "overdue" },
      { id: "inv-099", date: "2026-01-01", amount: 3200, status: "paid" },
      { id: "inv-090", date: "2025-12-01", amount: 3200, status: "paid" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAB_ITEMS: { id: TabId; label: string; emoji: string }[] = [
  { id: "organizations", label: "Organizations", emoji: "🏢" },
  { id: "users", label: "Users", emoji: "👥" },
  { id: "quotas", label: "Quotas", emoji: "📊" },
  { id: "billing", label: "Billing", emoji: "💳" },
];

function statusBadge(status: OrgStatus | AccountStatus | Invoice["status"]): string {
  switch (status) {
    case "active":
    case "paid":
      return "bg-emerald-400/15 text-emerald-400 border-emerald-400/30";
    case "trial":
    case "pending":
    case "invited":
      return "bg-amber-400/15 text-amber-400 border-amber-400/30";
    case "suspended":
    case "overdue":
      return "bg-rose-400/15 text-rose-400 border-rose-400/30";
    default:
      return "bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]";
  }
}

function planBadge(plan: PlanTier): string {
  switch (plan) {
    case "enterprise":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
    case "professional":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "custom":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "starter":
      return "bg-[var(--color-surface-3)]/40 text-[var(--color-text-primary)] border-[var(--color-surface-3)]";
    default:
      return "bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]";
  }
}

function roleBadge(role: UserRole): string {
  switch (role) {
    case "owner":
      return "bg-amber-400/15 text-amber-400 border-amber-400/30";
    case "admin":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
    case "member":
      return "bg-[var(--color-surface-3)]/40 text-[var(--color-text-primary)] border-[var(--color-surface-3)]";
    case "viewer":
      return "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)]";
    default:
      return "bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]";
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return n.toString();
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatLoginTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) {return "Just now";}
  if (diffHrs < 24) {return `${diffHrs}h ago`;}
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) {return `${diffDays}d ago`;}
  return formatDate(iso);
}

function progressPercent(used: number, limit: number): number {
  if (limit === 0) {return 0;}
  return Math.min(100, Math.round((used / limit) * 100));
}

function progressColor(pct: number): string {
  if (pct >= 90) {return "bg-rose-400";}
  if (pct >= 70) {return "bg-amber-400";}
  return "bg-indigo-500";
}

// ─── Badge / Pill Component ─────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border", className)}>
      {label}
    </span>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ used, limit, unit }: { used: number; limit: number; unit: string }) {
  const pct = progressPercent(used, limit);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">
          {typeof used === "number" && used % 1 !== 0 ? used.toFixed(1) : formatNumber(used)} / {typeof limit === "number" && limit % 1 !== 0 ? limit.toFixed(1) : formatNumber(limit)} {unit}
        </span>
        <span className={cn("font-medium", pct >= 90 ? "text-rose-400" : pct >= 70 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", progressColor(pct))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Organizations Tab ───────────────────────────────────────────────────────

function OrganizationsTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr_0.7fr_0.8fr_1fr] gap-3 px-4 py-2.5 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        <span>Organization</span>
        <span>Plan</span>
        <span>Users</span>
        <span>Storage</span>
        <span>Agents</span>
        <span>Status</span>
        <span>Created</span>
      </div>

      {ORGANIZATIONS.map((org) => {
        const isExpanded = expandedId === org.id;
        return (
          <div key={org.id} className="rounded-lg overflow-hidden">
            {/* Row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : org.id)}
              className={cn(
                "w-full grid grid-cols-[2fr_1fr_0.7fr_1fr_0.7fr_0.8fr_1fr] gap-3 px-4 py-3 text-sm text-left transition-colors",
                isExpanded ? "bg-[var(--color-surface-2)]/80" : "bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]/50"
              )}
            >
              <span className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                <span className="text-base">{isExpanded ? "🔽" : "▶️"}</span>
                {org.name}
              </span>
              <span><Badge label={org.plan} className={planBadge(org.plan)} /></span>
              <span className="text-[var(--color-text-primary)]">{org.userCount}</span>
              <span className="text-[var(--color-text-primary)]">{org.storageUsedGb} / {org.storageLimitGb} GB</span>
              <span className="text-[var(--color-text-primary)]">{org.agentCount} / {org.agentLimit}</span>
              <span><Badge label={org.status} className={statusBadge(org.status)} /></span>
              <span className="text-[var(--color-text-secondary)]">{formatDate(org.createdAt)}</span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="bg-[var(--color-surface-1)]/60 border-t border-[var(--color-border)] px-6 py-5 space-y-5">
                <div className="grid grid-cols-3 gap-6">
                  {/* Settings */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      ⚙️ Settings
                    </h4>
                    <div className="space-y-2 text-sm">
                      <SettingRow label="SSO Enabled" enabled={org.settings.ssoEnabled} />
                      <SettingRow label="IP Whitelist" enabled={org.settings.ipWhitelist} />
                      <SettingRow label="Audit Logging" enabled={org.settings.auditLog} />
                      <SettingRow label="Custom Branding" enabled={org.settings.customBranding} />
                    </div>
                  </div>

                  {/* Members */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      👥 Key Members
                    </h4>
                    <div className="space-y-2">
                      {org.members.map((m) => {
                        const user = USERS.find((u) => u.id === m.userId);
                        if (!user) {return null;}
                        return (
                          <div key={m.userId} className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-primary)]">{user.name}</span>
                            <Badge label={m.role} className={roleBadge(m.role)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      📈 Usage Stats
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard label="API Today" value={formatNumber(org.usage.apiCallsToday)} />
                      <StatCard label="API Month" value={formatNumber(org.usage.apiCallsMonth)} />
                      <StatCard label="Avg Response" value={`${org.usage.avgResponseMs}ms`} />
                      <StatCard label="Error Rate" value={`${org.usage.errorRate}%`} warn={org.usage.errorRate > 1} />
                    </div>
                  </div>
                </div>

                {/* Domain */}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
                  <span>🌐</span>
                  <span>{org.domain}</span>
                  <span className="mx-2">•</span>
                  <span>ID: {org.id}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-text-primary)]">{label}</span>
      <span className={cn("text-xs font-medium", enabled ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
        {enabled ? "✅ On" : "⛔ Off"}
      </span>
    </div>
  );
}

function StatCard({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-[var(--color-surface-2)]/60 rounded-md px-3 py-2">
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("text-sm font-semibold", warn ? "text-rose-400" : "text-[var(--color-text-primary)]")}>{value}</div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");

  const filteredUsers = statusFilter === "all" ? USERS : USERS.filter((u) => u.status === statusFilter);

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);}
      else {next.add(id);}
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  }

  const allSelected = filteredUsers.length > 0 && selectedIds.size === filteredUsers.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)] mr-1">Filter:</span>
          {(["all", "active", "suspended", "invited"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setStatusFilter(f); setSelectedIds(new Set()); }}
              className={cn(
                "px-3 py-1 text-xs rounded-md border transition-colors",
                statusFilter === f
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                  : "bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border)]"
              )}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)]">{selectedIds.size} selected</span>
            <BulkButton label="🚫 Suspend" className="text-rose-400 border-rose-400/30 hover:bg-rose-400/10" />
            <BulkButton label="✅ Enable" className="text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10" />
            <BulkButton label="🔑 Reset Password" className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10" />
          </div>
        )}
      </div>

      {/* Table */}
      <div>
        <div className="grid grid-cols-[2rem_1.5fr_2fr_1fr_0.8fr_0.7fr_0.6fr_0.8fr] gap-3 px-4 py-2.5 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          <span>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-[var(--color-surface-3)] bg-[var(--color-surface-2)] accent-indigo-500"
            />
          </span>
          <span>Name</span>
          <span>Email</span>
          <span>Organization</span>
          <span>Role</span>
          <span>Last Login</span>
          <span>MFA</span>
          <span>Status</span>
        </div>

        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className={cn(
              "grid grid-cols-[2rem_1.5fr_2fr_1fr_0.8fr_0.7fr_0.6fr_0.8fr] gap-3 px-4 py-3 text-sm border-t border-[var(--color-border)]/50 transition-colors",
              selectedIds.has(user.id) ? "bg-indigo-500/5" : "hover:bg-[var(--color-surface-2)]/30"
            )}
          >
            <span>
              <input
                type="checkbox"
                checked={selectedIds.has(user.id)}
                onChange={() => toggleUser(user.id)}
                className="rounded border-[var(--color-surface-3)] bg-[var(--color-surface-2)] accent-indigo-500"
              />
            </span>
            <span className="text-[var(--color-text-primary)] font-medium">{user.name}</span>
            <span className="text-[var(--color-text-secondary)] truncate">{user.email}</span>
            <span className="text-[var(--color-text-primary)] truncate">{user.orgName}</span>
            <span><Badge label={user.role} className={roleBadge(user.role)} /></span>
            <span className="text-[var(--color-text-secondary)] text-xs leading-6">{formatLoginTime(user.lastLogin)}</span>
            <span className={cn("text-xs leading-6", user.mfaEnabled ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
              {user.mfaEnabled ? "🔒 On" : "🔓 Off"}
            </span>
            <span><Badge label={user.status} className={statusBadge(user.status)} /></span>
          </div>
        ))}
      </div>

      <div className="text-xs text-[var(--color-text-muted)] px-4">
        Showing {filteredUsers.length} of {USERS.length} users
      </div>
    </div>
  );
}

function BulkButton({ label, className }: { label: string; className: string }) {
  return (
    <button
      type="button"
      className={cn("px-3 py-1 text-xs rounded-md border transition-colors", className)}
    >
      {label}
    </button>
  );
}

// ─── Quotas Tab ──────────────────────────────────────────────────────────────

function QuotasTab() {
  return (
    <div className="space-y-4">
      {QUOTAS.map((q) => {
        const org = ORGANIZATIONS.find((o) => o.id === q.orgId);
        return (
          <div key={q.orgId} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🏢</span>
                <h3 className="text-[var(--color-text-primary)] font-semibold">{q.orgName}</h3>
                {org && <Badge label={org.plan} className={planBadge(org.plan)} />}
              </div>
              {org && <Badge label={org.status} className={statusBadge(org.status)} />}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center gap-1">📡 API Calls (monthly)</div>
                <ProgressBar used={q.apiCalls.used} limit={q.apiCalls.limit} unit="calls" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center gap-1">💾 Storage</div>
                <ProgressBar used={q.storage.usedGb} limit={q.storage.limitGb} unit="GB" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center gap-1">🤖 Agents</div>
                <ProgressBar used={q.agents.used} limit={q.agents.limit} unit="agents" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center gap-1">🧠 Model Tokens</div>
                <ProgressBar used={q.modelTokens.usedM} limit={q.modelTokens.limitM} unit="M tokens" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab() {
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {BILLING.map((b) => {
        const isExpanded = expandedOrg === b.orgId;
        return (
          <div key={b.orgId} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            {/* Summary row */}
            <button
              type="button"
              onClick={() => setExpandedOrg(isExpanded ? null : b.orgId)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[var(--color-surface-2)]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{isExpanded ? "🔽" : "▶️"}</span>
                <span className="text-[var(--color-text-primary)] font-semibold">{b.orgName}</span>
                <Badge label={b.plan} className={planBadge(b.plan)} />
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <div className="text-xs text-[var(--color-text-muted)]">Monthly</div>
                  <div className="text-[var(--color-text-primary)] font-semibold">{formatCurrency(b.monthlySpend)}</div>
                </div>
                {b.overages > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-[var(--color-text-muted)]">Overages</div>
                    <div className="text-amber-400 font-semibold">+{formatCurrency(b.overages)}</div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-xs text-[var(--color-text-muted)]">Renewal</div>
                  <div className="text-[var(--color-text-primary)]">{formatDate(b.nextRenewal)}</div>
                </div>
              </div>
            </button>

            {/* Invoice history */}
            {isExpanded && (
              <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-3">
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  🧾 Invoice History
                </h4>
                <div>
                  <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr] gap-3 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    <span>Invoice</span>
                    <span>Date</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                  {b.invoices.map((inv) => (
                    <div key={inv.id} className="grid grid-cols-[1fr_1.5fr_1fr_1fr] gap-3 px-3 py-2.5 text-sm border-t border-[var(--color-border)]/50">
                      <span className="text-[var(--color-text-primary)] font-mono text-xs">{inv.id}</span>
                      <span className="text-[var(--color-text-secondary)]">{formatDate(inv.date)}</span>
                      <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(inv.amount)}</span>
                      <span><Badge label={inv.status} className={statusBadge(inv.status)} /></span>
                    </div>
                  ))}
                </div>

                {/* Totals summary */}
                <div className="flex items-center gap-6 pt-3 border-t border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Total invoiced: <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(b.invoices.reduce((sum, i) => sum + i.amount, 0))}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Next charge: <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(b.monthlySpend + b.overages)}</span> on {formatDate(b.nextRenewal)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Total summary card */}
      <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)] rounded-lg px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text-secondary)]">💰 Platform Total Monthly Revenue</span>
          <span className="text-xl font-bold text-[var(--color-text-primary)]">
            {formatCurrency(BILLING.reduce((sum, b) => sum + b.monthlySpend + b.overages, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function MultiTenantManager() {
  const [activeTab, setActiveTab] = useState<TabId>("organizations");

  const activeOrgCount = ORGANIZATIONS.filter((o) => o.status === "active").length;
  const totalUsers = USERS.length;
  const totalRevenue = BILLING.reduce((sum, b) => sum + b.monthlySpend + b.overages, 0);
  const suspendedCount = ORGANIZATIONS.filter((o) => o.status === "suspended").length;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🏢 Multi-Tenant Manager
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Manage organizations, users, quotas, and billing across all tenants
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <span>Last synced: just now</span>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <SummaryCard emoji="🏢" label="Active Orgs" value={String(activeOrgCount)} subtext={`of ${ORGANIZATIONS.length} total`} />
            <SummaryCard emoji="👥" label="Total Users" value={String(totalUsers)} subtext="across all tenants" />
            <SummaryCard emoji="💰" label="Monthly Revenue" value={formatCurrency(totalRevenue)} subtext="incl. overages" />
            <SummaryCard
              emoji="⚠️"
              label="Needs Attention"
              value={String(suspendedCount)}
              subtext="suspended orgs"
              alert={suspendedCount > 0}
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2",
                  activeTab === tab.id
                    ? "text-[var(--color-text-primary)] bg-[var(--color-surface-1)] border-indigo-500"
                    : "text-[var(--color-text-muted)] bg-transparent border-transparent hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]/50"
                )}
              >
                <span className="mr-1.5">{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "organizations" && <OrganizationsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "quotas" && <QuotasTab />}
        {activeTab === "billing" && <BillingTab />}
      </div>
    </div>
  );
}

function SummaryCard({
  emoji,
  label,
  value,
  subtext,
  alert = false,
}: {
  emoji: string;
  label: string;
  value: string;
  subtext: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      "bg-[var(--color-surface-1)] border rounded-lg px-4 py-3",
      alert ? "border-rose-400/30" : "border-[var(--color-border)]"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{emoji}</span>
        <span className="text-xs text-[var(--color-text-muted)] font-medium">{label}</span>
      </div>
      <div className={cn("text-xl font-bold", alert ? "text-rose-400" : "text-[var(--color-text-primary)]")}>{value}</div>
      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtext}</div>
    </div>
  );
}

export default MultiTenantManager;
