import React, { useState } from "react";
import { Receipt } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

type Tab = "plan" | "usage" | "invoices";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  current?: boolean;
  cta: string;
}

import { Skeleton } from '../components/Skeleton';

function BillingSubscriptionSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 p-6 md:p-12 text-fg-primary">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10 space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 border-b border-tok-border mb-8">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-20 mb-0.5" />)}
        </div>

        {/* Plan overview: 2-col */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-surface-1 border border-tok-border rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="h-7 w-16 ml-auto" />
                <Skeleton className="h-3 w-36 ml-auto" />
              </div>
            </div>
            <Skeleton className="h-8 w-40 rounded-lg" />
            <div className="grid grid-cols-2 gap-4 border-t border-tok-border pt-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="w-5 h-5 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface-1 border border-tok-border rounded-xl p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-12 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="pt-6 border-t border-tok-border space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>

        {/* Plan comparison cards */}
        <div className="space-y-3 mb-2">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface-1 border border-tok-border rounded-xl p-6 space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-9 w-20 mt-2" />
              </div>
              <div className="space-y-2 flex-grow">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BillingSubscription: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  if (isLoading) return <BillingSubscriptionSkeleton />;

  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans: Plan[] = [
    {
      name: "Free",
      price: "$0",
      description: "For individuals and hobbyists",
      features: ["3 active agents", "1 node connection", "100k tokens/mo", "Community support"],
      cta: "Current Plan",
    },
    {
      name: "Pro",
      price: billingCycle === "monthly" ? "$49" : "$39",
      description: "For power users and small teams",
      features: ["Unlimited agents", "10 node connections", "10M tokens/mo", "Priority support", "Advanced analytics"],
      current: true,
      cta: "Current Plan",
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large scale production",
      features: ["Custom resource limits", "Dedicated infrastructure", "SLA guarantees", "24/7 account manager"],
      cta: "Contact Sales",
    },
  ];

  const usageMeters = [
    { label: "Tokens", used: 8.2, limit: 10, unit: "M", color: "bg-primary", overage: "$0.002 per 1K" },
    { label: "API Calls", used: 45200, limit: 100000, unit: "", color: "bg-emerald-500", overage: "$0.01 per 100" },
    { label: "Active Agents", used: 12, limit: 20, unit: "", color: "bg-primary", overage: "$5 per agent" },
    { label: "Nodes Paired", used: 4, limit: 10, unit: "", color: "bg-amber-500", overage: "$10 per node" },
    { label: "Storage", used: 4.2, limit: 5, unit: "GB", color: "bg-rose-500", overage: "$0.50 per GB" },
  ];

  const invoices = [
    { id: "INV-2024-006", period: "May 1, 2024 - May 31, 2024", amount: "$49.00", status: "Paid" },
    { id: "INV-2024-005", period: "Apr 1, 2024 - Apr 30, 2024", amount: "$52.40", status: "Paid" },
    { id: "INV-2024-004", period: "Mar 1, 2024 - Mar 31, 2024", amount: "$49.00", status: "Failed" },
    { id: "INV-2024-003", period: "Feb 1, 2024 - Feb 28, 2024", amount: "$49.00", status: "Paid" },
    { id: "INV-2024-002", period: "Jan 1, 2024 - Jan 31, 2024", amount: "$61.20", status: "Paid" },
    { id: "INV-2023-012", period: "Dec 1, 2023 - Dec 31, 2023", amount: "$49.00", status: "Paid" },
  ];

  const renderTabs = () => (
    <div role="tablist" className="flex space-x-1 border-b border-tok-border mb-8">
      {(["plan", "usage", "invoices"] as Tab[]).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => setActiveTab(tab)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none capitalize",
            activeTab === tab 
              ? "text-fg-primary border-b-2 border-primary" 
              : "text-fg-secondary hover:text-fg-primary"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  const renderPlanTab = () => (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Current Plan Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface-1 border border-tok-border rounded-xl p-3 sm:p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-fg-primary">Pro Plan</h2>
                <p className="text-fg-secondary">Your current billing cycle is {billingCycle}.</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-fg-primary">$49<span className="text-sm font-normal text-fg-muted">/mo</span></div>
                <div className="text-xs text-primary font-medium">Next renewal: June 1, 2024</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 mb-6 bg-surface-0/50 p-2 rounded-lg w-fit">
              <span className={cn("text-xs font-medium px-2 py-1 rounded", billingCycle === 'monthly' ? 'bg-primary text-fg-primary' : 'text-fg-secondary cursor-pointer')} onClick={() => setBillingCycle('monthly')}>Monthly</span>
              <span className={cn("text-xs font-medium px-2 py-1 rounded", billingCycle === 'annual' ? 'bg-primary text-fg-primary' : 'text-fg-secondary cursor-pointer')} onClick={() => setBillingCycle('annual')}>Annual (Save 20%)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-tok-border pt-6">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-fg-primary">Unlimited Agents</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-fg-primary">10M Monthly Tokens</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-1 border border-tok-border rounded-xl p-3 sm:p-4 md:p-6">
          <h3 className="text-lg font-semibold text-fg-primary mb-4">Payment Method</h3>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-surface-2 px-2 py-1 rounded text-[10px] font-bold text-fg-primary">VISA</div>
              <div>
                <div className="text-sm text-fg-primary font-mono">•••• 4242</div>
                <div className="text-xs text-fg-muted">Expires 12/26</div>
              </div>
            </div>
          </div>
          <button className="w-full py-2 bg-surface-2 hover:bg-surface-3 text-fg-primary text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none">
            Update Card
          </button>
          <div className="mt-6 pt-6 border-t border-tok-border">
            <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-2">Billing Address</h4>
            <address className="not-italic text-sm text-fg-secondary leading-relaxed">
              123 Neural Lane<br />
              Suite 404<br />
              San Francisco, CA 94103
            </address>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div>
        <h3 className="text-xl font-bold text-fg-primary mb-6">Available Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={cn(
                "bg-surface-1 border rounded-xl p-3 sm:p-4 md:p-6 flex flex-col",
                plan.current ? "border-primary ring-1 ring-indigo-500" : "border-tok-border"
              )}
            >
              <div className="mb-6">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-lg font-bold text-fg-primary">{plan.name}</h4>
                  {plan.current && <span className="bg-primary text-[10px] font-bold text-fg-primary px-2 py-0.5 rounded-full uppercase">Current</span>}
                </div>
                <p className="text-sm text-fg-muted mb-4">{plan.description}</p>
                <div className="text-3xl font-bold text-fg-primary">
                  {plan.price}
                  {plan.price !== "Custom" && <span className="text-sm font-normal text-fg-muted">/mo</span>}
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start space-x-3 text-sm text-fg-secondary">
                    <svg className="w-4 h-4 text-fg-muted mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none",
                  plan.current 
                    ? "bg-surface-2 text-fg-secondary cursor-default" 
                    : plan.name === "Enterprise"
                      ? "bg-white text-surface-0 hover:bg-surface-2"
                      : "bg-primary text-fg-primary hover:bg-primary shadow-lg shadow-indigo-500/20"
                )}
                disabled={plan.current}
              >
                {plan.name === "Free" ? "Downgrade" : plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUsageTab = () => {
    const isNearLimit = usageMeters.some(m => (m.used / m.limit) > 0.8);
    
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
          <div>
            <h2 className="text-2xl font-bold text-fg-primary mb-1">Usage Statistics</h2>
            <p className="text-fg-secondary text-sm">Current period: May 1, 2024 - May 31, 2024</p>
          </div>
          <div className="bg-surface-1 border border-tok-border px-3 py-1.5 rounded-full text-xs font-medium text-amber-400 self-start sm:self-auto">
            9 days remaining
          </div>
        </div>

        {isNearLimit && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center space-x-4">
            <div className="bg-amber-500/20 p-2 rounded-lg">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15.682c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-amber-500 font-bold text-sm">Resource Limit Warning</h4>
              <p className="text-amber-500/80 text-xs">One or more of your resources are above 80% capacity. Overages will be billed at the rates shown below.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {usageMeters.map((meter) => {
              const percent = Math.min((meter.used / meter.limit) * 100, 100);
              return (
                <div key={meter.label}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-fg-primary">{meter.label}</span>
                    <span className="text-xs text-fg-secondary">
                      <span className="text-fg-primary font-bold">{meter.used}{meter.unit}</span> / {meter.limit}{meter.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", meter.color)}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] text-fg-muted uppercase tracking-wider font-semibold">
                    Overage: {meter.overage}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-surface-1 border border-tok-border rounded-xl p-3 sm:p-4 md:p-6">
            <h3 className="text-sm font-bold text-fg-primary mb-6 uppercase tracking-widest text-fg-muted">Token Consumption (Last 7 Days)</h3>
            <div className="h-48 flex items-end justify-between px-2">
              {[65, 42, 88, 95, 76, 54, 82].map((val, i) => (
                <div key={i} className="flex flex-col items-center group">
                  <div className="text-[10px] text-fg-muted font-bold mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{(val * 100).toLocaleString()}</div>
                  <div 
                    className="w-8 bg-primary/20 border-t-2 border-primary rounded-t-sm transition-all duration-300 group-hover:bg-primary/40"
                    style={{ height: `${val}%` }}
                  >
                    {/* SVG squiggle texture for "hand-drawn" feel */}
                    <svg width="100%" height="100%" preserveAspectRatio="none">
                      <pattern id="squiggle" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M0 10 L5 0 L10 10" fill="none" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
                      </pattern>
                      <rect width="100%" height="100%" fill="url(#squiggle)" />
                    </svg>
                  </div>
                  <span className="text-[10px] text-fg-muted mt-2 font-medium">05/{20+i}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-surface-0 p-3 rounded-lg border border-tok-border">
                <div className="text-[10px] text-fg-muted font-bold uppercase mb-1">Peak Day</div>
                <div className="text-lg font-mono text-fg-primary">952k</div>
              </div>
              <div className="bg-surface-0 p-3 rounded-lg border border-tok-border">
                <div className="text-[10px] text-fg-muted font-bold uppercase mb-1">Avg / Day</div>
                <div className="text-lg font-mono text-fg-primary">712k</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInvoicesTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-fg-primary mb-1">Billing History</h2>
          <p className="text-fg-secondary text-sm">View and download your past invoices.</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-surface-1 border border-tok-border hover:bg-surface-2 text-fg-primary text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download all (CSV)</span>
        </button>
      </div>

      {invoices.length === 0 ? (
        <ContextualEmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Your billing history will appear here after your first payment cycle."
        />
      ) : (
        <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-tok-border bg-surface-0/50">
                  <th className="px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Period</th>
                  <th className="px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-fg-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tok-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-fg-primary">{invoice.id}</td>
                    <td className="px-6 py-4 text-sm text-fg-secondary">{invoice.period}</td>
                    <td className="px-6 py-4 text-sm font-bold text-fg-primary">{invoice.amount}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        invoice.status === "Paid" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                        invoice.status === "Pending" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                        invoice.status === "Failed" && "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      )}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {invoice.status === "Failed" ? (
                        <button className="text-xs font-bold text-primary hover:text-indigo-300 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none p-1 rounded">
                          Retry Payment
                        </button>
                      ) : (
                        <button className="text-xs font-bold text-fg-muted hover:text-fg-primary transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none p-1 rounded">
                          Download PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-0 p-3 sm:p-6 md:p-12 text-fg-primary">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Billing & Subscription</h1>
          <p className="text-fg-muted">Manage your plan, monitor usage, and view billing history.</p>
        </header>

        {renderTabs()}

        <main className="mt-8">
          {activeTab === "plan" && renderPlanTab()}
          {activeTab === "usage" && renderUsageTab()}
          {activeTab === "invoices" && renderInvoicesTab()}
        </main>
      </div>
    </div>
  );
};

export default BillingSubscription;
