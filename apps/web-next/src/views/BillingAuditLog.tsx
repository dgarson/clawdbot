import React, { useState } from "react";
import { cn } from "../lib/utils";

type EventCategory = "subscription" | "payment" | "invoice" | "refund" | "credit" | "usage" | "promo" | "tax";
type EventStatus = "success" | "failed" | "pending" | "cancelled";
type PaymentMethod = "card" | "ach" | "wire" | "crypto" | "credit";
type ExportFormat = "csv" | "pdf" | "json";

interface BillingEvent {
  id: string;
  timestamp: string;
  category: EventCategory;
  status: EventStatus;
  description: string;
  amount: number;
  currency: string;
  customerId: string;
  customerName: string;
  invoiceId: string | null;
  paymentMethod: PaymentMethod | null;
  metadata: Record<string, string>;
  actorType: "system" | "user" | "stripe";
  actor: string;
  idempotencyKey: string | null;
}

interface SubscriptionChange {
  id: string;
  customerId: string;
  customerName: string;
  timestamp: string;
  fromPlan: string;
  toPlan: string;
  reason: string;
  mrr_delta: number;
  actor: string;
}

interface RefundRequest {
  id: string;
  customerId: string;
  customerName: string;
  originalAmount: number;
  refundAmount: number;
  reason: string;
  status: "approved" | "pending" | "denied";
  requestedAt: string;
  processedAt: string | null;
  reviewer: string | null;
  invoiceId: string;
}

interface TaxRecord {
  id: string;
  customerId: string;
  customerName: string;
  period: string;
  jurisdiction: string;
  taxType: string;
  amount: number;
  status: "filed" | "pending" | "amended";
  filedAt: string | null;
}

const EVENTS: BillingEvent[] = [
  { id: "ev1", timestamp: "2026-02-22 15:42:18", category: "payment", status: "success", description: "Monthly subscription payment", amount: 499, currency: "USD", customerId: "cust_001", customerName: "TechFlow Inc", invoiceId: "inv_2026_002_001", paymentMethod: "card", metadata: { last4: "4242", brand: "visa" }, actorType: "stripe", actor: "Stripe Webhook", idempotencyKey: "idem_abc123" },
  { id: "ev2", timestamp: "2026-02-22 14:30:05", category: "invoice", status: "success", description: "Invoice INV-2026-002 generated", amount: 499, currency: "USD", customerId: "cust_001", customerName: "TechFlow Inc", invoiceId: "inv_2026_002_001", paymentMethod: null, metadata: { line_items: "3", period: "Feb 2026" }, actorType: "system", actor: "Billing Engine", idempotencyKey: null },
  { id: "ev3", timestamp: "2026-02-22 12:10:44", category: "subscription", status: "success", description: "Plan upgraded from Growth to Enterprise", amount: 0, currency: "USD", customerId: "cust_002", customerName: "GlobalRetail Co", invoiceId: null, paymentMethod: null, metadata: { from_plan: "growth", to_plan: "enterprise" }, actorType: "user", actor: "elena.v@globalretail.com", idempotencyKey: null },
  { id: "ev4", timestamp: "2026-02-22 11:55:02", category: "refund", status: "success", description: "Partial refund for service downtime credit", amount: -150, currency: "USD", customerId: "cust_003", customerName: "StartupXYZ", invoiceId: "inv_2026_001_003", paymentMethod: "card", metadata: { reason: "SLA credit", incident: "INC-4421" }, actorType: "user", actor: "billing-admin@co.com", idempotencyKey: "ref_idem_001" },
  { id: "ev5", timestamp: "2026-02-22 10:00:00", category: "usage", status: "success", description: "Usage overage charge: API calls", amount: 48.50, currency: "USD", customerId: "cust_004", customerName: "Acme Corporation", invoiceId: "inv_2026_002_004", paymentMethod: null, metadata: { calls_used: "1284000", included: "1000000", overage: "284000" }, actorType: "system", actor: "Usage Meter", idempotencyKey: null },
  { id: "ev6", timestamp: "2026-02-21 18:30:15", category: "payment", status: "failed", description: "Card payment declined", amount: 99, currency: "USD", customerId: "cust_005", customerName: "DevStudio LLC", invoiceId: "inv_2026_002_005", paymentMethod: "card", metadata: { decline_code: "insufficient_funds", last4: "1234" }, actorType: "stripe", actor: "Stripe Webhook", idempotencyKey: "idem_xyz789" },
  { id: "ev7", timestamp: "2026-02-21 09:14:33", category: "credit", status: "success", description: "Account credit applied: referral bonus", amount: -50, currency: "USD", customerId: "cust_006", customerName: "CloudApp Co", invoiceId: null, paymentMethod: "credit", metadata: { credit_type: "referral", referrer: "cust_001" }, actorType: "system", actor: "Referral Engine", idempotencyKey: null },
  { id: "ev8", timestamp: "2026-02-20 16:45:00", category: "promo", status: "success", description: "Promo code LAUNCH25 applied: 25% off", amount: -124.75, currency: "USD", customerId: "cust_007", customerName: "NewBrand Inc", invoiceId: "inv_2026_002_007", paymentMethod: null, metadata: { code: "LAUNCH25", discount_pct: "25" }, actorType: "user", actor: "m.chen@newbrand.com", idempotencyKey: null },
  { id: "ev9", timestamp: "2026-02-20 14:00:00", category: "tax", status: "success", description: "California sales tax collected", amount: 41.17, currency: "USD", customerId: "cust_008", customerName: "WestCoast SaaS", invoiceId: "inv_2026_002_008", paymentMethod: null, metadata: { jurisdiction: "CA", rate: "8.25%", taxable_amount: "499" }, actorType: "system", actor: "Tax Engine", idempotencyKey: null },
  { id: "ev10", timestamp: "2026-02-19 11:20:00", category: "subscription", status: "cancelled", description: "Subscription cancelled by user", amount: 0, currency: "USD", customerId: "cust_009", customerName: "SpindownCo", invoiceId: null, paymentMethod: null, metadata: { reason: "too_expensive", cancellation_type: "at_period_end" }, actorType: "user", actor: "cfo@spindownco.com", idempotencyKey: null },
];

const SUB_CHANGES: SubscriptionChange[] = [
  { id: "sc1", customerId: "cust_002", customerName: "GlobalRetail Co", timestamp: "2026-02-22 12:10:44", fromPlan: "Growth ($499/mo)", toPlan: "Enterprise (Custom)", reason: "User-initiated upgrade", mrr_delta: 2001, actor: "elena.v@globalretail.com" },
  { id: "sc2", customerId: "cust_009", customerName: "SpindownCo", timestamp: "2026-02-19 11:20:00", fromPlan: "Starter ($99/mo)", toPlan: "Cancelled", reason: "too_expensive", mrr_delta: -99, actor: "cfo@spindownco.com" },
  { id: "sc3", customerId: "cust_010", customerName: "GrowthHQ", timestamp: "2026-02-15 09:00:00", fromPlan: "Starter ($99/mo)", toPlan: "Growth ($499/mo)", reason: "User-initiated upgrade", mrr_delta: 400, actor: "admin@growthhq.com" },
];

const REFUNDS: RefundRequest[] = [
  { id: "rf1", customerId: "cust_003", customerName: "StartupXYZ", originalAmount: 99, refundAmount: 150, reason: "SLA credit for INC-4421 outage (47 min downtime). Credit exceeds monthly fee — balance carried over.", status: "approved", requestedAt: "2026-02-22 10:30", processedAt: "2026-02-22 11:55", reviewer: "billing-admin@co.com", invoiceId: "inv_2026_001_003" },
  { id: "rf2", customerId: "cust_011", customerName: "BetaTest Corp", originalAmount: 499, refundAmount: 499, reason: "Duplicate charge — payment processor error.", status: "pending", requestedAt: "2026-02-21 14:00", processedAt: null, reviewer: null, invoiceId: "inv_2026_002_011" },
  { id: "rf3", customerId: "cust_012", customerName: "OldClient LLC", originalAmount: 99, refundAmount: 33, reason: "Pro-rated refund for mid-cycle downgrade.", status: "approved", requestedAt: "2026-02-10 09:00", processedAt: "2026-02-10 16:00", reviewer: "finance@co.com", invoiceId: "inv_2026_002_012" },
];

const TAX_RECORDS: TaxRecord[] = [
  { id: "tx1", customerId: "cust_008", customerName: "WestCoast SaaS", period: "Feb 2026", jurisdiction: "California, US", taxType: "Sales Tax", amount: 41.17, status: "pending", filedAt: null },
  { id: "tx2", customerId: "cust_013", customerName: "EuroTech GmbH", period: "Feb 2026", jurisdiction: "Germany", taxType: "VAT (19%)", amount: 94.81, status: "pending", filedAt: null },
  { id: "tx3", customerId: "cust_008", customerName: "WestCoast SaaS", period: "Jan 2026", jurisdiction: "California, US", taxType: "Sales Tax", amount: 41.17, status: "filed", filedAt: "2026-02-10" },
];

function categoryBadge(c: EventCategory) {
  const map: Record<EventCategory, string> = {
    payment: "bg-emerald-500/10 text-emerald-400",
    subscription: "bg-indigo-500/10 text-indigo-400",
    invoice: "bg-blue-500/10 text-blue-400",
    refund: "bg-amber-500/10 text-amber-400",
    credit: "bg-purple-500/10 text-purple-400",
    usage: "bg-orange-500/10 text-orange-400",
    promo: "bg-pink-500/10 text-pink-400",
    tax: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)]",
  };
  return map[c];
}
function statusBadge(s: EventStatus) {
  if (s === "success") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "failed") {return "bg-rose-400/10 text-rose-400";}
  if (s === "pending") {return "bg-amber-400/10 text-amber-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function amountColor(amount: number) {
  if (amount < 0) {return "text-rose-400";}
  if (amount === 0) {return "text-[var(--color-text-muted)]";}
  return "text-emerald-400";
}
function formatAmount(amount: number, currency: string) {
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2);
  if (amount < 0) {return `-$${formatted} ${currency}`;}
  if (amount === 0) {return "—";}
  return `+$${formatted} ${currency}`;
}

export default function BillingAuditLog() {
  const [tab, setTab] = useState<"events" | "subscriptions" | "refunds" | "tax">("events");
  const [filterCategory, setFilterCategory] = useState<EventCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<EventStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [_exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  void _exportFormat;

  const filteredEvents = EVENTS.filter(e => {
    if (filterCategory !== "all" && e.category !== filterCategory) {return false;}
    if (filterStatus !== "all" && e.status !== filterStatus) {return false;}
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.customerName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
    }
    return true;
  });

  const totalRevenue = EVENTS.filter(e => e.category === "payment" && e.status === "success").reduce((s, e) => s + e.amount, 0);
  const totalRefunds = EVENTS.filter(e => e.category === "refund").reduce((s, e) => s + Math.abs(e.amount), 0);
  const failedPayments = EVENTS.filter(e => e.category === "payment" && e.status === "failed").length;
  const pendingRefunds = REFUNDS.filter(r => r.status === "pending").length;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "events", label: "All Events" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "refunds", label: `Refunds (${pendingRefunds} pending)` },
    { id: "tax", label: "Tax Records" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Billing Audit Log</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Immutable record of all billing events, subscription changes, and financial transactions</p>
        </div>
        <div className="flex gap-2">
          <select onChange={e => setExportFormat(e.target.value as ExportFormat)} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
            <option value="csv">Export CSV</option>
            <option value="pdf">Export PDF</option>
            <option value="json">Export JSON</option>
          </select>
          <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[var(--color-text-primary)] transition-colors">Download</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Revenue (Feb)</div>
          <div className="text-2xl font-bold text-emerald-400">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Refunds Issued</div>
          <div className="text-2xl font-bold text-amber-400">${totalRefunds.toFixed(0)}</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Failed Payments</div>
          <div className={cn("text-2xl font-bold", failedPayments > 0 ? "text-rose-400" : "text-emerald-400")}>{failedPayments}</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Total Events</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{EVENTS.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Events */}
      {tab === "events" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] w-48"
            />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as EventCategory | "all")} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Categories</option>
              {(["subscription", "payment", "invoice", "refund", "credit", "usage", "promo", "tax"] as EventCategory[]).map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as EventStatus | "all")} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Timestamp", "Customer", "Event", "Amount", "Status", "Actor"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-[var(--color-text-muted)] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredEvents.map(ev => (
                  <tr key={ev.id} className="hover:bg-[var(--color-surface-2)]/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{ev.timestamp}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{ev.customerName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", categoryBadge(ev.category))}>{ev.category}</span>
                        <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-48">{ev.description}</span>
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-sm font-medium whitespace-nowrap", amountColor(ev.amount))}>{formatAmount(ev.amount, ev.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", statusBadge(ev.status))}>{ev.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{ev.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription Changes */}
      {tab === "subscriptions" && (
        <div className="space-y-3">
          {SUB_CHANGES.map(sc => (
            <div key={sc.id} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-[var(--color-text-primary)]">{sc.customerName}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{sc.timestamp} · by {sc.actor}</div>
                </div>
                <div className={cn("text-sm font-bold", sc.mrr_delta > 0 ? "text-emerald-400" : "text-rose-400")}>
                  {sc.mrr_delta > 0 ? "+" : ""}${sc.mrr_delta}/mo MRR
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-text-secondary)]">{sc.fromPlan}</span>
                <span className="text-[var(--color-text-muted)]">→</span>
                <span className="text-[var(--color-text-primary)]">{sc.toPlan}</span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Reason: {sc.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* Refunds */}
      {tab === "refunds" && (
        <div className="space-y-3">
          {REFUNDS.map(ref => (
            <div key={ref.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", ref.status === "pending" ? "border-amber-500/30" : "border-[var(--color-border)]")}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[var(--color-text-primary)]">{ref.customerName}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", ref.status === "approved" ? "bg-emerald-400/10 text-emerald-400" : ref.status === "pending" ? "bg-amber-400/10 text-amber-400" : "bg-rose-400/10 text-rose-400")}>{ref.status}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">Invoice: {ref.invoiceId} · Requested: {ref.requestedAt}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-rose-400">-${ref.refundAmount.toFixed(2)}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">of ${ref.originalAmount.toFixed(2)} charged</div>
                </div>
              </div>
              <div className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-2)] rounded-lg p-3 mt-2">{ref.reason}</div>
              <div className="mt-2 flex justify-between text-xs text-[var(--color-text-muted)]">
                {ref.reviewer && <span>Reviewed by: {ref.reviewer}</span>}
                {ref.processedAt && <span>Processed: {ref.processedAt}</span>}
              </div>
              {ref.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[var(--color-text-primary)] transition-colors">Approve Refund</button>
                  <button className="px-3 py-1.5 text-xs bg-rose-700 hover:bg-rose-600 rounded-lg text-[var(--color-text-primary)] transition-colors">Deny</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tax Records */}
      {tab === "tax" && (
        <div>
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Customer", "Period", "Jurisdiction", "Tax Type", "Amount", "Status", "Filed"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-[var(--color-text-muted)] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {TAX_RECORDS.map(tx => (
                  <tr key={tx.id} className="hover:bg-[var(--color-surface-2)]/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{tx.customerName}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{tx.period}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{tx.jurisdiction}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-primary)]">{tx.taxType}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">${tx.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", tx.status === "filed" ? "bg-emerald-400/10 text-emerald-400" : tx.status === "pending" ? "bg-amber-400/10 text-amber-400" : "bg-indigo-400/10 text-indigo-400")}>{tx.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.filedAt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
