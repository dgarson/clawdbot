import React, { useState } from "react";
import { cn } from "../lib/utils";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  number: string;
  customer: string;
  customerEmail: string;
  amount: number;
  tax: number;
  status: "paid" | "pending" | "overdue" | "draft" | "void";
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  lineItems: LineItem[];
  notes?: string;
}

const INVOICES: Invoice[] = [
  {
    id: "inv1", number: "INV-2026-0142", customer: "Acme Corp", customerEmail: "billing@acme.com",
    amount: 8400.00, tax: 756.00, status: "paid",
    issueDate: "2026-02-01", dueDate: "2026-02-15", paidDate: "2026-02-12",
    lineItems: [
      { description: "Enterprise Plan — Feb 2026",   quantity: 1,  unitPrice: 6000.00 },
      { description: "API Overage (42K calls)",       quantity: 42, unitPrice: 50.00   },
      { description: "Priority Support Addon",        quantity: 1,  unitPrice: 1200.00 },
    ],
    notes: "Auto-pay enabled",
  },
  {
    id: "inv2", number: "INV-2026-0143", customer: "Veritas Inc", customerEmail: "ap@veritas.io",
    amount: 2400.00, tax: 216.00, status: "pending",
    issueDate: "2026-02-05", dueDate: "2026-02-22",
    lineItems: [
      { description: "Pro Plan — Feb 2026",           quantity: 3,  unitPrice: 599.00  },
      { description: "Additional Seats",              quantity: 3,  unitPrice: 67.00   },
    ],
  },
  {
    id: "inv3", number: "INV-2026-0138", customer: "Novo Labs", customerEmail: "finance@novolabs.ai",
    amount: 14200.00, tax: 1278.00, status: "overdue",
    issueDate: "2026-01-15", dueDate: "2026-01-30",
    lineItems: [
      { description: "Enterprise Plan — Jan 2026",   quantity: 1,  unitPrice: 6000.00 },
      { description: "Custom Integrations (20h)",    quantity: 20, unitPrice: 250.00  },
      { description: "Training & Onboarding",        quantity: 2,  unitPrice: 2100.00 },
    ],
    notes: "Payment 23 days overdue. Escalate to account manager.",
  },
  {
    id: "inv4", number: "INV-2026-0144", customer: "Meridian Analytics", customerEmail: "billing@meridian.co",
    amount: 599.00, tax: 53.91, status: "draft",
    issueDate: "2026-02-20", dueDate: "2026-03-06",
    lineItems: [
      { description: "Pro Plan — Mar 2026",           quantity: 1,  unitPrice: 599.00  },
    ],
  },
  {
    id: "inv5", number: "INV-2026-0135", customer: "Cascade Data", customerEmail: "accounts@cascade.io",
    amount: 3200.00, tax: 288.00, status: "paid",
    issueDate: "2026-01-20", dueDate: "2026-02-04", paidDate: "2026-02-03",
    lineItems: [
      { description: "Professional Services (8h)",   quantity: 8,  unitPrice: 300.00  },
      { description: "Pro Plan — Feb 2026",           quantity: 2,  unitPrice: 599.00  },
      { description: "Storage Overage (500GB)",       quantity: 5,  unitPrice: 40.00   },
    ],
  },
  {
    id: "inv6", number: "INV-2026-0130", customer: "Quantum Systems", customerEmail: "billing@qsys.com",
    amount: 12000.00, tax: 1080.00, status: "void",
    issueDate: "2026-01-10", dueDate: "2026-01-25",
    lineItems: [
      { description: "Enterprise Annual (prorated)", quantity: 1,  unitPrice: 12000.00 },
    ],
    notes: "Voided — replaced by INV-2026-0141 with corrected tax.",
  },
  {
    id: "inv7", number: "INV-2026-0145", customer: "Solaris Group", customerEmail: "ap@solaris.co",
    amount: 1197.00, tax: 107.73, status: "pending",
    issueDate: "2026-02-10", dueDate: "2026-02-24",
    lineItems: [
      { description: "Starter Plan — Feb 2026",       quantity: 3,  unitPrice: 99.00   },
      { description: "Custom Domain Add-on",          quantity: 3,  unitPrice: 300.00  },
    ],
  },
  {
    id: "inv8", number: "INV-2026-0146", customer: "Harbor Cloud", customerEmail: "billing@harborcloud.io",
    amount: 24000.00, tax: 2160.00, status: "paid",
    issueDate: "2026-02-15", dueDate: "2026-03-01", paidDate: "2026-02-18",
    lineItems: [
      { description: "Enterprise Annual Plan",        quantity: 1,  unitPrice: 18000.00 },
      { description: "Dedicated Support (12mo)",      quantity: 12, unitPrice: 400.00   },
      { description: "Custom Integrations (8h)",      quantity: 8,  unitPrice: 250.00   },
    ],
  },
];

const STATUS_STYLES: Record<string, string> = {
  paid:    "bg-emerald-400/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-400/15 text-amber-400 border-amber-500/30",
  overdue: "bg-rose-400/15 text-rose-400 border-rose-500/30",
  draft:   "bg-zinc-700 text-zinc-400 border-zinc-600",
  void:    "bg-zinc-800 text-zinc-500 border-zinc-700",
};

type Tab = "invoices" | "detail" | "analytics" | "settings";

export default function InvoiceManager() {
  const [activeTab, setActiveTab]         = useState<Tab>("invoices");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus]   = useState("all");
  const [searchTerm, setSearchTerm]       = useState("");

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "invoices",  label: "All Invoices",  emoji: "🧾" },
    { id: "detail",    label: "Invoice Detail", emoji: "📄" },
    { id: "analytics", label: "Revenue",        emoji: "📈" },
    { id: "settings",  label: "Settings",       emoji: "⚙️" },
  ];

  const filteredInvoices = INVOICES.filter(inv => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (searchTerm && !inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !inv.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totals = {
    paid:    INVOICES.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    pending: INVOICES.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    overdue: INVOICES.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
  };

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const openDetail = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setActiveTab("detail");
  };

  // Monthly revenue data (last 6 months)
  const MONTHLY = [
    { month: "Sep 25", rev: 38200, invoices: 14 },
    { month: "Oct 25", rev: 42800, invoices: 16 },
    { month: "Nov 25", rev: 39500, invoices: 13 },
    { month: "Dec 25", rev: 51200, invoices: 19 },
    { month: "Jan 26", rev: 48700, invoices: 17 },
    { month: "Feb 26", rev: 53796, invoices: 8  },
  ];
  const maxRev = Math.max(...MONTHLY.map(m => m.rev));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoice Manager</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Manage invoices, track revenue, configure billing</p>
        </div>
        <button className="text-sm px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">
          + New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Paid",     value: fmt(totals.paid),    sub: `${INVOICES.filter(i=>i.status==="paid").length} invoices`,    color: "text-emerald-400" },
          { label: "Pending",        value: fmt(totals.pending), sub: `${INVOICES.filter(i=>i.status==="pending").length} invoices`, color: "text-amber-400"  },
          { label: "Overdue",        value: fmt(totals.overdue), sub: `${INVOICES.filter(i=>i.status==="overdue").length} invoices`, color: "text-rose-400"   },
          { label: "Total (Feb 26)", value: fmt(INVOICES.filter(i=>i.issueDate.startsWith("2026-02")).reduce((s,i)=>s+i.amount,0)), sub: "this month", color: "text-indigo-400" },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">{card.label}</div>
            <div className={cn("text-xl font-bold", card.color)}>{card.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* All Invoices */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search customer or invoice #..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-64 bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-1">
              {["all","paid","pending","overdue","draft","void"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded border capitalize transition-colors",
                    filterStatus === s
                      ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-mono">{inv.number}</div>
                      <div className="text-xs text-zinc-500">{inv.issueDate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{inv.customer}</div>
                      <div className="text-xs text-zinc-500">{inv.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-medium">{fmt(inv.amount)}</div>
                      <div className="text-xs text-zinc-500">+{fmt(inv.tax)} tax</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded border capitalize", STATUS_STYLES[inv.status])}>
                        {inv.status}
                      </span>
                      {inv.status === "overdue" && (
                        <div className="text-xs text-rose-400 mt-0.5">23d overdue</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn("text-sm", inv.status === "overdue" ? "text-rose-400" : "text-zinc-300")}>
                        {inv.dueDate}
                      </div>
                      {inv.paidDate && <div className="text-xs text-emerald-400">Paid {inv.paidDate}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetail(inv)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >View</button>
                        {inv.status === "draft" && (
                          <button className="text-xs text-emerald-400 hover:text-emerald-300">Send</button>
                        )}
                        {inv.status === "pending" && (
                          <button className="text-xs text-amber-400 hover:text-amber-300">Remind</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">No invoices match</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Detail */}
      {activeTab === "detail" && selectedInvoice && (
        <div className="max-w-2xl">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {/* Invoice header */}
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedInvoice.number}</h2>
                  <div className="text-zinc-400 text-sm mt-0.5">{selectedInvoice.customer}</div>
                  <div className="text-zinc-500 text-xs">{selectedInvoice.customerEmail}</div>
                </div>
                <span className={cn("text-sm px-3 py-1 rounded border capitalize", STATUS_STYLES[selectedInvoice.status])}>
                  {selectedInvoice.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5">
                {[
                  { label: "Issue Date", value: selectedInvoice.issueDate },
                  { label: "Due Date",   value: selectedInvoice.dueDate },
                  { label: "Paid Date",  value: selectedInvoice.paidDate ?? "—" },
                ].map(f => (
                  <div key={f.label}>
                    <div className="text-xs text-zinc-400">{f.label}</div>
                    <div className="text-sm text-white mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="p-6 border-b border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-400 border-b border-zinc-800">
                    <th className="pb-2 text-left font-medium">Description</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit Price</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {selectedInvoice.lineItems.map((li, i) => (
                    <tr key={i}>
                      <td className="py-3 text-zinc-300">{li.description}</td>
                      <td className="py-3 text-right text-zinc-400">{li.quantity}</td>
                      <td className="py-3 text-right text-zinc-400">{fmt(li.unitPrice)}</td>
                      <td className="py-3 text-right text-white font-medium">{fmt(li.quantity * li.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="p-6">
              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="flex gap-8 text-zinc-400">
                  <span>Subtotal</span>
                  <span>{fmt(selectedInvoice.amount)}</span>
                </div>
                <div className="flex gap-8 text-zinc-400">
                  <span>Tax (9%)</span>
                  <span>{fmt(selectedInvoice.tax)}</span>
                </div>
                <div className="flex gap-8 text-white font-bold text-base mt-1 pt-2 border-t border-zinc-800 w-40">
                  <span>Total</span>
                  <span>{fmt(selectedInvoice.amount + selectedInvoice.tax)}</span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="mt-4 p-3 bg-zinc-800 rounded text-xs text-zinc-400 italic">
                  {selectedInvoice.notes}
                </div>
              )}

              <div className="flex gap-3 mt-5">
                {selectedInvoice.status === "draft" && (
                  <button className="px-4 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600">Send Invoice</button>
                )}
                {selectedInvoice.status === "pending" && (
                  <button className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm rounded hover:bg-amber-500/30">Send Reminder</button>
                )}
                <button className="px-4 py-2 border border-zinc-700 text-zinc-400 text-sm rounded hover:bg-zinc-800">⬇ Download PDF</button>
                {selectedInvoice.status !== "void" && (
                  <button className="px-4 py-2 border border-zinc-700 text-zinc-400 text-sm rounded hover:bg-zinc-800">📋 Duplicate</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "detail" && !selectedInvoice && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500 text-sm max-w-2xl">
          Select an invoice from the list to view details
        </div>
      )}

      {/* Revenue Analytics */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Monthly bar chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Monthly Revenue</h3>
            <div className="flex items-end gap-3 h-40">
              {MONTHLY.map(m => {
                const pct = (m.rev / maxRev) * 100;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-zinc-400">{fmt(m.rev).replace("$","$").replace(".00","")}</div>
                    <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                      <div
                        className={cn("w-full rounded-t", m.month.includes("26") ? "bg-indigo-500" : "bg-zinc-700")}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-400">{m.month}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue by customer */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Revenue by Customer</h3>
            <div className="space-y-3">
              {INVOICES
                .filter(i => i.status === "paid" || i.status === "pending")
                .sort((a, b) => (b.amount + b.tax) - (a.amount + a.tax))
                .slice(0, 6)
                .map(inv => {
                  const total = inv.amount + inv.tax;
                  const maxTotal = 26160;
                  return (
                    <div key={inv.id} className="flex items-center gap-3">
                      <div className="w-36 text-xs text-zinc-300 truncate">{inv.customer}</div>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className={cn("h-full rounded-full", inv.status === "paid" ? "bg-emerald-500" : "bg-amber-500")}
                          style={{ width: `${(total / maxTotal) * 100}%` }}
                        />
                      </div>
                      <div className="w-24 text-xs text-zinc-300 text-right">{fmt(total)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      {activeTab === "settings" && (
        <div className="max-w-lg space-y-4">
          {[
            { label: "Company Name",    value: "Clawdbot Inc.",         type: "text" },
            { label: "Invoice Prefix",  value: "INV",                   type: "text" },
            { label: "Payment Terms",   value: "Net 15",                type: "text" },
            { label: "Tax Rate (%)",    value: "9",                     type: "number" },
            { label: "Default Currency",value: "USD",                   type: "text" },
            { label: "Billing Email",   value: "billing@clawdbot.io",   type: "email" },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-xs text-zinc-400 mb-1.5">{field.label}</label>
              <input
                type={field.type}
                defaultValue={field.value}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
          <div className="pt-2">
            <button className="px-4 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors">
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
