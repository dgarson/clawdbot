import React, { useState } from "react";
import { cn } from "../lib/utils";

interface PlanFeature {
  name: string;
  starter: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number; // per month
  unit: string;
  quantity?: number;
}

const FEATURES: PlanFeature[] = [
  { name: "API Calls (monthly)",    starter: "10K",      pro: "500K",       enterprise: "Unlimited" },
  { name: "Projects",               starter: "3",        pro: "25",         enterprise: "Unlimited" },
  { name: "Team Members",           starter: "1",        pro: "10",         enterprise: "Unlimited" },
  { name: "Storage",                starter: "1 GB",     pro: "50 GB",      enterprise: "1 TB" },
  { name: "Custom Domain",          starter: false,      pro: true,         enterprise: true },
  { name: "SSO / SAML",             starter: false,      pro: false,        enterprise: true },
  { name: "Audit Logs",             starter: false,      pro: "30 days",    enterprise: "1 year" },
  { name: "SLA",                    starter: "99.5%",    pro: "99.9%",      enterprise: "99.99%" },
  { name: "Support",                starter: "Community",pro: "Priority",   enterprise: "Dedicated CSM" },
  { name: "API Rate Limit",         starter: "10 rpm",   pro: "500 rpm",    enterprise: "Custom" },
  { name: "Webhooks",               starter: false,      pro: "5 endpoints",enterprise: "Unlimited" },
  { name: "Advanced Analytics",     starter: false,      pro: true,         enterprise: true },
  { name: "White Labeling",         starter: false,      pro: false,        enterprise: true },
  { name: "Custom Integrations",    starter: false,      pro: false,        enterprise: true },
];

const ADDONS: Addon[] = [
  { id: "a1", name: "Extra API Calls",     description: "Additional 100K API calls per month",  price: 25,    unit: "per 100K calls/mo" },
  { id: "a2", name: "Additional Seats",    description: "Extra team member seats",               price: 15,    unit: "per seat/mo",      quantity: 0 },
  { id: "a3", name: "Priority Support",    description: "2h SLA response time guarantee",        price: 199,   unit: "per month" },
  { id: "a4", name: "Data Retention+",     description: "Extended log/event retention to 2 years",price: 49,  unit: "per month" },
  { id: "a5", name: "Custom Domain SSL",   description: "Dedicated SSL cert for custom domain",  price: 29,   unit: "per month" },
  { id: "a6", name: "Dedicated Infra",     description: "Single-tenant dedicated infrastructure", price: 999, unit: "per month" },
];

type Plan = "starter" | "pro" | "enterprise";
type Billing = "monthly" | "annual";

const PLAN_BASE: Record<Plan, number> = {
  starter:    0,
  pro:        99,
  enterprise: 499,
};

const PLAN_ANNUAL_DISCOUNT = 0.20; // 20% off

export default function PricingCalculator() {
  const [selectedPlan, setSelectedPlan]     = useState<Plan>("pro");
  const [billing, setBilling]               = useState<Billing>("monthly");
  const [seats, setSeats]                   = useState(5);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [addonQtys, setAddonQtys]           = useState<Record<string, number>>({ a1: 1, a2: 0 });
  const [activeTab, setActiveTab]           = useState<"calculator" | "compare" | "enterprise">("calculator");

  const TABS = [
    { id: "calculator" as const, label: "💰 Calculator" },
    { id: "compare"    as const, label: "📊 Compare Plans" },
    { id: "enterprise" as const, label: "🏢 Enterprise" },
  ];

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);}
      else {next.add(id);}
      return next;
    });
  };

  const basePrice = PLAN_BASE[selectedPlan];
  const seatPrice = selectedPlan === "pro" ? (Math.max(0, seats - 10) * 15) : 0;

  const addonTotal = Array.from(selectedAddons).reduce((sum, id) => {
    const addon = ADDONS.find(a => a.id === id);
    if (!addon) {return sum;}
    const qty = addonQtys[id] ?? 1;
    return sum + addon.price * qty;
  }, 0);

  const subtotal = basePrice + seatPrice + addonTotal;
  const discount = billing === "annual" ? subtotal * PLAN_ANNUAL_DISCOUNT : 0;
  const total = subtotal - discount;
  const annualTotal = total * 12;

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  const PLANS: { id: Plan; name: string; tagline: string; color: string }[] = [
    { id: "starter",    name: "Starter",    tagline: "For individuals & small projects",   color: "border-[var(--color-border)]" },
    { id: "pro",        name: "Pro",        tagline: "For growing teams and startups",     color: "border-indigo-500" },
    { id: "enterprise", name: "Enterprise", tagline: "For large teams with advanced needs",color: "border-amber-500" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Pricing Calculator</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Configure your plan and estimate monthly cost</p>
        </div>
        <div className="flex gap-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] p-1 rounded-lg">
          {(["monthly", "annual"] as Billing[]).map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={cn(
                "px-4 py-1.5 text-sm rounded-md capitalize transition-colors",
                billing === b ? "bg-indigo-500 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {b} {b === "annual" && <span className="text-xs text-emerald-400 ml-1">-20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--color-surface-1)] p-1 rounded-lg border border-[var(--color-border)] w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id ? "bg-indigo-500 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calculator" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Plan + addons */}
          <div className="col-span-2 space-y-5">
            {/* Plan picker */}
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Choose Plan</div>
              <div className="grid grid-cols-3 gap-3">
                {PLANS.map(plan => {
                  const price = billing === "annual"
                    ? Math.round(PLAN_BASE[plan.id] * (1 - PLAN_ANNUAL_DISCOUNT))
                    : PLAN_BASE[plan.id];
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={cn(
                        "bg-[var(--color-surface-1)] border-2 rounded-lg p-4 text-left transition-all",
                        selectedPlan === plan.id ? plan.color : "border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                      )}
                    >
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">{plan.name}</div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">{plan.tagline}</div>
                      <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                        {plan.id === "enterprise" && price === 0 ? "Custom" : fmt(price)}
                        {price > 0 && <span className="text-sm font-normal text-[var(--color-text-secondary)]">/mo</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seat slider */}
            {selectedPlan !== "starter" && (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">Team Seats</div>
                  <div className="text-sm text-indigo-300 font-medium">{seats} seats</div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={seats}
                  onChange={e => setSeats(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                </div>
                {selectedPlan === "pro" && seats > 10 && (
                  <div className="mt-2 text-xs text-amber-400">
                    +{seats - 10} extra seats × $15 = {fmt((seats - 10) * 15)}/mo
                  </div>
                )}
              </div>
            )}

            {/* Add-ons */}
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Add-ons</div>
              <div className="space-y-2">
                {ADDONS.map(addon => {
                  const checked = selectedAddons.has(addon.id);
                  return (
                    <label
                      key={addon.id}
                      className={cn(
                        "flex items-center gap-3 bg-[var(--color-surface-1)] border rounded-lg p-3.5 cursor-pointer transition-colors",
                        checked ? "border-indigo-500/50 bg-indigo-500/5" : "border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddon(addon.id)}
                        className="accent-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--color-text-primary)] font-medium">{addon.name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{addon.description}</div>
                      </div>
                      {(addon.id === "a1" || addon.id === "a2") && checked && (
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={addonQtys[addon.id] ?? 1}
                          onChange={e => setAddonQtys(prev => ({ ...prev, [addon.id]: Number(e.target.value) }))}
                          className="w-16 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs rounded px-2 py-1 focus:outline-none text-center"
                          onClick={e => e.preventDefault()}
                        />
                      )}
                      <div className="text-sm text-indigo-300 font-medium whitespace-nowrap">
                        {fmt(addon.price)}<span className="text-xs text-[var(--color-text-secondary)]">/{addon.unit.includes("mo") ? "mo" : addon.unit}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Price summary */}
          <div className="col-span-1">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5 sticky top-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Price Summary</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Base plan ({selectedPlan})</span>
                  <span className="text-[var(--color-text-primary)]">{fmt(basePrice)}/mo</span>
                </div>
                {seatPrice > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Extra seats</span>
                    <span className="text-[var(--color-text-primary)]">{fmt(seatPrice)}/mo</span>
                  </div>
                )}
                {Array.from(selectedAddons).map(id => {
                  const addon = ADDONS.find(a => a.id === id);
                  if (!addon) {return null;}
                  const qty = addonQtys[id] ?? 1;
                  const price = addon.price * qty;
                  return (
                    <div key={id} className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)] truncate max-w-[60%]">{addon.name}{qty > 1 ? ` ×${qty}` : ""}</span>
                      <span className="text-[var(--color-text-primary)]">{fmt(price)}/mo</span>
                    </div>
                  );
                })}

                <div className="border-t border-[var(--color-border)] pt-2 mt-2 flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Subtotal</span>
                  <span className="text-[var(--color-text-primary)]">{fmt(subtotal)}/mo</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Annual discount (20%)</span>
                    <span>-{fmt(discount)}/mo</span>
                  </div>
                )}

                <div className="border-t border-[var(--color-border)] pt-3 mt-1">
                  <div className="flex items-end justify-between">
                    <span className="text-[var(--color-text-primary)] font-semibold">Total</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-400">{fmt(total)}<span className="text-sm text-[var(--color-text-secondary)]">/mo</span></div>
                      {billing === "annual" && (
                        <div className="text-xs text-[var(--color-text-secondary)]">{fmt(annualTotal)} billed annually</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button className="w-full mt-5 py-2.5 bg-indigo-500 text-[var(--color-text-primary)] text-sm font-medium rounded hover:bg-indigo-600 transition-colors">
                Start Free Trial →
              </button>
              <button className="w-full mt-2 py-2.5 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm rounded hover:bg-[var(--color-surface-2)] transition-colors">
                Talk to Sales
              </button>

              <div className="mt-4 text-xs text-[var(--color-text-muted)] text-center">
                No credit card required · Cancel anytime
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "compare" && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-5 py-4 text-left text-[var(--color-text-secondary)] font-medium w-56">Feature</th>
                {PLANS.map(plan => (
                  <th key={plan.id} className="px-5 py-4 text-center">
                    <div className="text-[var(--color-text-primary)] font-semibold">{plan.name}</div>
                    <div className="text-lg font-bold text-indigo-400 mt-0.5">
                      {PLAN_BASE[plan.id] === 0 ? "Free" : fmt(PLAN_BASE[plan.id])}
                      {PLAN_BASE[plan.id] > 0 && <span className="text-xs font-normal text-[var(--color-text-secondary)]">/mo</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {FEATURES.map(f => (
                <tr key={f.name} className="hover:bg-[var(--color-surface-2)]/20 transition-colors">
                  <td className="px-5 py-3 text-[var(--color-text-primary)] text-xs">{f.name}</td>
                  {(["starter","pro","enterprise"] as Plan[]).map(plan => {
                    const val = f[plan];
                    return (
                      <td key={plan} className="px-5 py-3 text-center text-xs">
                        {val === true  ? <span className="text-emerald-400 text-base">✓</span> :
                         val === false ? <span className="text-[var(--color-text-muted)]">—</span> :
                                         <span className="text-[var(--color-text-primary)]">{val}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "enterprise" && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-gradient-to-br from-indigo-500/10 to-zinc-900 border border-indigo-500/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Enterprise Plan</h2>
            <p className="text-[var(--color-text-secondary)] text-sm">Custom pricing for large organizations with advanced security, compliance, and support requirements.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { emoji: "🔒", title: "Single Sign-On",          desc: "SAML 2.0, OIDC, LDAP integration" },
              { emoji: "📋", title: "Custom SLAs",              desc: "99.99% uptime with dedicated support" },
              { emoji: "🏗️", title: "Dedicated Infrastructure", desc: "Single-tenant isolated environment" },
              { emoji: "📊", title: "Advanced Analytics",       desc: "Custom dashboards and data exports" },
              { emoji: "🔧", title: "Custom Integrations",      desc: "Bespoke API and workflow integrations" },
              { emoji: "👥", title: "Unlimited Seats",          desc: "No per-seat pricing limits" },
              { emoji: "🌍", title: "Multi-Region",             desc: "Data residency in EU, US, APAC" },
              { emoji: "🎓", title: "Training & Onboarding",    desc: "Dedicated onboarding + CSM support" },
            ].map(f => (
              <div key={f.title} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-lg mb-1">{f.emoji}</div>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{f.title}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Contact Sales</h3>
            <div className="grid grid-cols-2 gap-3">
              {["First Name","Last Name","Company","Work Email","Team Size","Use Case"].map(label => (
                <div key={label} className={label === "Use Case" ? "col-span-2" : ""}>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={label}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded px-3 py-2 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-2.5 bg-indigo-500 text-[var(--color-text-primary)] text-sm font-medium rounded hover:bg-indigo-600 transition-colors">
              Request Enterprise Demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
