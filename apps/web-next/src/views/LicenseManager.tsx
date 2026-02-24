import React, { useState } from "react";
import { cn } from "../lib/utils";

type LicenseStatus = "active" | "expiring" | "expired" | "suspended" | "trial";
type LicenseType = "perpetual" | "subscription" | "trial" | "enterprise" | "oss";
type AllocationStatus = "allocated" | "available" | "reserved";

interface License {
  id: string;
  productName: string;
  vendor: string;
  licenseKey: string;
  type: LicenseType;
  status: LicenseStatus;
  seats: number;
  usedSeats: number;
  expiresAt: string | null;
  purchasedAt: string;
  cost: number;
  billingCycle: "monthly" | "annual" | "perpetual";
  tier: string;
  features: string[];
}

interface SeatAllocation {
  userId: string;
  userName: string;
  email: string;
  productName: string;
  licenseId: string;
  status: AllocationStatus;
  allocatedAt: string;
  lastActivity: string;
}

interface ComplianceCheck {
  productName: string;
  required: number;
  actual: number;
  status: "compliant" | "over_licensed" | "under_licensed";
  delta: number;
  recommendation: string;
}

const LICENSES: License[] = [
  {
    id: "lic1",
    productName: "OpenClaw Platform",
    vendor: "OpenClaw Inc.",
    licenseKey: "OCPL-XXXX-YYYY-ZZZZ-AAAA",
    type: "subscription",
    status: "active",
    seats: 500,
    usedSeats: 384,
    expiresAt: "2026-12-31",
    purchasedAt: "2026-01-01",
    cost: 12000,
    billingCycle: "annual",
    tier: "Enterprise",
    features: ["Unlimited agents", "SSO/SCIM", "Audit logs", "SLA 99.9%", "Dedicated support"],
  },
  {
    id: "lic2",
    productName: "GitHub Enterprise",
    vendor: "GitHub Inc.",
    licenseKey: "GHE-XXXX-YYYY-ZZ01",
    type: "subscription",
    status: "active",
    seats: 200,
    usedSeats: 198,
    expiresAt: "2026-06-30",
    purchasedAt: "2025-07-01",
    cost: 9900,
    billingCycle: "annual",
    tier: "Enterprise Cloud",
    features: ["Advanced security", "Audit stream", "GitHub Actions", "Secret scanning"],
  },
  {
    id: "lic3",
    productName: "Datadog APM",
    vendor: "Datadog Inc.",
    licenseKey: "DD-APM-INFRA-AAAA",
    type: "subscription",
    status: "expiring",
    seats: 50,
    usedSeats: 47,
    expiresAt: "2026-03-15",
    purchasedAt: "2025-03-15",
    cost: 4800,
    billingCycle: "annual",
    tier: "Pro",
    features: ["APM traces", "Infrastructure monitoring", "Log management", "Dashboards"],
  },
  {
    id: "lic4",
    productName: "Figma Organization",
    vendor: "Figma Inc.",
    licenseKey: "FIG-ORG-BBBB-CCCC",
    type: "subscription",
    status: "active",
    seats: 25,
    usedSeats: 12,
    expiresAt: "2026-08-20",
    purchasedAt: "2025-08-20",
    cost: 3600,
    billingCycle: "annual",
    tier: "Organization",
    features: ["Unlimited projects", "Design systems", "Branch sharing", "Analytics"],
  },
  {
    id: "lic5",
    productName: "Atlassian Jira",
    vendor: "Atlassian",
    licenseKey: "JIRA-CLOUD-500-DDDD",
    type: "subscription",
    status: "active",
    seats: 100,
    usedSeats: 89,
    expiresAt: "2027-01-15",
    purchasedAt: "2026-01-15",
    cost: 5880,
    billingCycle: "annual",
    tier: "Standard",
    features: ["Scrum & Kanban", "Roadmaps", "Backlog", "250 GB storage"],
  },
  {
    id: "lic6",
    productName: "Legacy CRM",
    vendor: "OldSoft Corp",
    licenseKey: "CRM-PERP-V3-EEEE",
    type: "perpetual",
    status: "expired",
    seats: 50,
    usedSeats: 0,
    expiresAt: "2025-12-31",
    purchasedAt: "2020-01-01",
    cost: 0,
    billingCycle: "perpetual",
    tier: "Enterprise v3",
    features: ["Contact management", "Pipeline tracking"],
  },
  {
    id: "lic7",
    productName: "Slack Business+",
    vendor: "Slack Technologies",
    licenseKey: "SLACK-BIZ-300-FFFF",
    type: "subscription",
    status: "active",
    seats: 300,
    usedSeats: 276,
    expiresAt: "2026-09-01",
    purchasedAt: "2025-09-01",
    cost: 7800,
    billingCycle: "annual",
    tier: "Business+",
    features: ["Unlimited history", "Guest access", "Compliance exports", "99.99% SLA"],
  },
];

const ALLOCATIONS: SeatAllocation[] = [
  { userId: "u1", userName: "Alice Chen", email: "alice.chen@co.io", productName: "OpenClaw Platform", licenseId: "lic1", status: "allocated", allocatedAt: "2026-01-05", lastActivity: "2026-02-22T14:20:00Z" },
  { userId: "u2", userName: "Bob Martinez", email: "bob.martinez@co.io", productName: "OpenClaw Platform", licenseId: "lic1", status: "allocated", allocatedAt: "2026-01-05", lastActivity: "2026-02-22T13:45:00Z" },
  { userId: "u3", userName: "Carol Jones", email: "carol.jones@co.io", productName: "GitHub Enterprise", licenseId: "lic2", status: "allocated", allocatedAt: "2025-07-10", lastActivity: "2026-02-22T11:00:00Z" },
  { userId: "u4", userName: "David Kim", email: "david.kim@co.io", productName: "Datadog APM", licenseId: "lic3", status: "allocated", allocatedAt: "2025-03-20", lastActivity: "2026-02-22T14:30:00Z" },
  { userId: "u5", userName: "Eve Thompson", email: "eve.t@co.io", productName: "Figma Organization", licenseId: "lic4", status: "reserved", allocatedAt: "2026-01-20", lastActivity: "2026-02-10T09:00:00Z" },
];

const COMPLIANCE: ComplianceCheck[] = [
  { productName: "OpenClaw Platform", required: 384, actual: 500, status: "over_licensed", delta: 116, recommendation: "Consider downgrading to 400-seat tier at next renewal. Current: 500 seats." },
  { productName: "GitHub Enterprise", required: 198, actual: 200, status: "compliant", delta: 2, recommendation: "Nearly at capacity. Request 25-seat expansion before next renewal." },
  { productName: "Datadog APM", required: 47, actual: 50, status: "compliant", delta: 3, recommendation: "License expiring in 21 days. Renew or negotiate 10% reduction." },
  { productName: "Figma Organization", required: 12, actual: 25, status: "over_licensed", delta: 13, recommendation: "Reduce to 15-seat tier at next renewal. 13 seats unused for >60 days." },
  { productName: "Slack Business+", required: 276, actual: 300, status: "compliant", delta: 24, recommendation: "On track. Consider renegotiating volume discount at renewal." },
  { productName: "Legacy CRM", required: 0, actual: 50, status: "over_licensed", delta: 50, recommendation: "License expired. Remove from inventory and reclaim infrastructure." },
];

const TABS = ["Licenses", "Allocations", "Compliance", "Renewals"] as const;
type Tab = typeof TABS[number];

const statusColor: Record<LicenseStatus, string> = {
  active:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  expiring:  "text-amber-400 bg-amber-400/10 border-amber-400/30",
  expired:   "text-rose-400 bg-rose-400/10 border-rose-400/30",
  suspended: "text-zinc-400 bg-zinc-400/10 border-zinc-400/30",
  trial:     "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const complianceColor: Record<ComplianceCheck["status"], string> = {
  compliant:       "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  over_licensed:   "text-amber-400 bg-amber-400/10 border-amber-400/30",
  under_licensed:  "text-rose-400 bg-rose-400/10 border-rose-400/30",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) {return null;}
  const now = new Date("2026-02-22");
  const exp = new Date(dateStr);
  return Math.floor((exp.getTime() - now.getTime()) / 86400000);
}

export default function LicenseManager(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Licenses");
  const [selectedLicense, setSelectedLicense] = useState<License>(LICENSES[0]);

  const totalAnnualCost = LICENSES.filter(l => l.billingCycle === "annual" && l.status !== "expired").reduce((a, l) => a + l.cost, 0);
  const expiringCount = LICENSES.filter(l => l.status === "expiring").length;
  const expiredCount  = LICENSES.filter(l => l.status === "expired").length;

  const renewalsSorted = [...LICENSES]
    .filter(l => l.expiresAt && l.status !== "expired")
    .toSorted((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime());

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div>
          <h1 className="text-lg font-semibold">License Manager</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Software license inventory, seat allocation, and compliance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {expiringCount > 0 && (
            <div className="text-xs px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400">
              ⚠ {expiringCount} expiring soon
            </div>
          )}
          <div className="text-xs text-zinc-400">Annual spend: <span className="text-white font-semibold">{totalAnnualCost.toLocaleString()} USD</span></div>
          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">
            + Add License
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-zinc-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-indigo-400 border-indigo-500"
                : "text-zinc-400 border-transparent hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── LICENSES ── */}
        {tab === "Licenses" && (
          <div className="h-full flex">
            <div className="w-72 border-r border-zinc-800 overflow-y-auto">
              {LICENSES.map((lic) => {
                const days = daysUntil(lic.expiresAt);
                return (
                  <button
                    key={lic.id}
                    onClick={() => setSelectedLicense(lic)}
                    className={cn(
                      "w-full text-left px-4 py-4 border-b border-zinc-800/50 transition-colors",
                      selectedLicense.id === lic.id ? "bg-indigo-600/10" : "hover:bg-zinc-800/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white truncate max-w-[140px]">{lic.productName}</span>
                      <span className={cn("text-[10px] px-1 py-0.5 rounded border shrink-0", statusColor[lic.status])}>{lic.status}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">{lic.vendor} · {lic.tier}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", lic.usedSeats / lic.seats > 0.9 ? "bg-amber-500" : "bg-indigo-500")}
                          style={{ width: `${Math.min(100, (lic.usedSeats / lic.seats) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 shrink-0">{lic.usedSeats}/{lic.seats}</span>
                    </div>
                    {days !== null && days <= 30 && days >= 0 && (
                      <div className="text-[10px] text-amber-400 mt-1">Expires in {days}d</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedLicense.productName}</h2>
                  <div className="text-sm text-zinc-400">{selectedLicense.vendor} · {selectedLicense.tier}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded border", statusColor[selectedLicense.status])}>{selectedLicense.status}</span>
                  <button className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-600 rounded-md transition-colors">Manage</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Seats", value: selectedLicense.seats.toString() },
                  { label: "Used Seats", value: selectedLicense.usedSeats.toString() },
                  { label: "Annual Cost", value: `${selectedLicense.cost.toLocaleString()} USD` },
                  { label: "Expires", value: selectedLicense.expiresAt ?? "Perpetual" },
                ].map((m) => (
                  <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-500">{m.label}</div>
                    <div className="text-sm font-semibold mt-1">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Seat utilization */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className="flex justify-between text-sm mb-3">
                  <span className="font-medium">Seat Utilization</span>
                  <span className={cn("font-mono", (selectedLicense.usedSeats / selectedLicense.seats) > 0.9 ? "text-amber-400" : "text-zinc-400")}>
                    {Math.round((selectedLicense.usedSeats / selectedLicense.seats) * 100)}%
                  </span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", (selectedLicense.usedSeats / selectedLicense.seats) > 0.9 ? "bg-amber-500" : "bg-indigo-500")}
                    style={{ width: `${Math.min(100, (selectedLicense.usedSeats / selectedLicense.seats) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1.5">
                  <span>{selectedLicense.usedSeats} used</span>
                  <span>{selectedLicense.seats - selectedLicense.usedSeats} available</span>
                </div>
              </div>

              {/* License key */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">License Key</div>
                <div className="font-mono text-sm text-zinc-300 tracking-wider">{selectedLicense.licenseKey}</div>
              </div>

              {/* Features */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3">Included Features</div>
                <div className="grid grid-cols-2 gap-1">
                  {selectedLicense.features.map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <span className="text-emerald-400">✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ALLOCATIONS ── */}
        {tab === "Allocations" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-medium">Seat Allocations</h3>
                <button className="text-xs text-indigo-400 hover:text-indigo-300">+ Allocate Seat</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {["User", "Product", "Status", "Allocated", "Last Activity"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {ALLOCATIONS.map((a) => (
                      <tr key={a.userId + a.licenseId} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-3">
                          <div className="text-sm">{a.userName}</div>
                          <div className="text-[10px] text-zinc-500">{a.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{a.productName}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs", a.status === "allocated" ? "text-emerald-400" : a.status === "reserved" ? "text-amber-400" : "text-zinc-400")}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{a.allocatedAt}</td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{a.lastActivity.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLIANCE ── */}
        {tab === "Compliance" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {COMPLIANCE.map((c) => (
              <div key={c.productName} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{c.productName}</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", complianceColor[c.status])}>
                    {c.status.replace("_", " ")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-xl font-bold">{c.required}</div>
                    <div className="text-xs text-zinc-500">Required</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold">{c.actual}</div>
                    <div className="text-xs text-zinc-500">Licensed</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("text-xl font-bold", c.status === "under_licensed" ? "text-rose-400" : c.status === "over_licensed" ? "text-amber-400" : "text-emerald-400")}>
                      {c.delta > 0 ? "+" : ""}{c.delta}
                    </div>
                    <div className="text-xs text-zinc-500">Delta</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 border-t border-zinc-800 pt-3">{c.recommendation}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── RENEWALS ── */}
        {tab === "Renewals" && (
          <div className="h-full overflow-y-auto p-6 space-y-3">
            <div className="text-xs text-zinc-400 mb-4">Upcoming renewals sorted by expiration date</div>
            {renewalsSorted.map((lic) => {
              const days = daysUntil(lic.expiresAt);
              const urgency = days !== null && days <= 21 ? "border-rose-500/40" : days !== null && days <= 60 ? "border-amber-500/40" : "border-zinc-800";
              return (
                <div key={lic.id} className={cn("bg-zinc-900 border rounded-lg p-4 flex items-center gap-4", urgency)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{lic.productName}</span>
                      <span className="text-xs text-zinc-500">{lic.vendor}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{lic.seats} seats · {lic.tier} · {lic.cost.toLocaleString()} USD/yr</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">{lic.expiresAt}</div>
                    <div className={cn("text-xs mt-0.5", days !== null && days <= 21 ? "text-rose-400" : days !== null && days <= 60 ? "text-amber-400" : "text-zinc-500")}>
                      {days !== null ? (days > 0 ? `${days} days` : "Expired") : "—"}
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-xs bg-indigo-600/20 border border-indigo-600/40 text-indigo-300 hover:bg-indigo-600/30 rounded-md transition-colors shrink-0">
                    Renew
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
