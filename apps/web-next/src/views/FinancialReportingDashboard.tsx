import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * FinancialReportingDashboard
 * 
 * A comprehensive financial analytics dashboard for Horizon UI.
 * Features: Overview, P&L, Cash Flow, and Budget vs Actual.
 * 
 * Design System: Dark theme (zinc-950/900), Indigo accent.
 * Custom div-based charts (Waterfall, Donut, Bar charts).
 */

// --- Types ---

type TabType = "overview" | "pnl" | "cashflow" | "budget";

interface KPIData {
  label: string;
  value: string;
  trend: number; // percentage
  isPositiveGood: boolean;
}

interface WaterfallItem {
  label: string;
  value: number;
  type: "base" | "add" | "subtract" | "total";
}

interface DonutData {
  label: string;
  value: number;
  color: string;
}

interface PLRow {
  label: string;
  current: number;
  ytd: number;
  prior: number;
  isHeader?: boolean;
  isTotal?: boolean;
  indent?: boolean;
}

interface CashFlowItem {
  label: string;
  amount: number;
  isTotal?: boolean;
}

interface BudgetRow {
  department: string;
  budget: number;
  actual: number;
}

// --- Sample Data ---

const KPI_SUMMARY: KPIData[] = [
  { label: "Monthly Recurring Revenue", value: "$1,240,500", trend: 12.5, isPositiveGood: true },
  { label: "Annual Recurring Revenue", value: "$14,886,000", trend: 14.2, isPositiveGood: true },
  { label: "Gross Margin %", value: "78.4%", trend: 1.2, isPositiveGood: true },
  { label: "Monthly Burn Rate", value: "$420,000", trend: -5.4, isPositiveGood: true }, // Negative burn trend is good
  { label: "Runway Months", value: "24", trend: 2, isPositiveGood: true },
];

const REVENUE_WATERFALL: WaterfallItem[] = [
  { label: "Starting MRR", value: 1100000, type: "base" },
  { label: "New Logo", value: 150000, type: "add" },
  { label: "Expansion", value: 45000, type: "add" },
  { label: "Contraction", value: -25000, type: "subtract" },
  { label: "Churn", value: -30000, type: "subtract" },
  { label: "Ending MRR", value: 1240000, type: "total" },
];

const REVENUE_SOURCES: DonutData[] = [
  { label: "Enterprise", value: 620000, color: "bg-indigo-500" },
  { label: "Mid-Market", value: 380000, color: "bg-indigo-400" },
  { label: "Self-Serve", value: 240500, color: "bg-indigo-600" },
];

const PL_DATA: PLRow[] = [
  { label: "Revenue", current: 1240500, ytd: 14886000, prior: 10500000, isHeader: true },
  { label: "Subscription Revenue", current: 1150000, ytd: 13800000, prior: 9800000, indent: true },
  { label: "Professional Services", current: 90500, ytd: 1086000, prior: 700000, indent: true },
  { label: "Cost of Goods Sold (COGS)", current: 267900, ytd: 3215000, prior: 2400000, isHeader: true },
  { label: "Hosting & Infrastructure", current: 180000, ytd: 2160000, prior: 1600000, indent: true },
  { label: "Customer Support", current: 87900, ytd: 1055000, prior: 800000, indent: true },
  { label: "Gross Profit", current: 972600, ytd: 11671000, prior: 8100000, isTotal: true },
  { label: "Operating Expenses", current: 685000, ytd: 8220000, prior: 7100000, isHeader: true },
  { label: "Sales & Marketing", current: 320000, ytd: 3840000, prior: 3400000, indent: true },
  { label: "Research & Development", current: 245000, ytd: 2940000, prior: 2600000, indent: true },
  { label: "General & Administrative", current: 120000, ytd: 1440000, prior: 1100000, indent: true },
  { label: "EBITDA", current: 287600, ytd: 3451000, prior: 1000000, isTotal: true },
  { label: "Taxes & Depreciation", current: 45000, ytd: 540000, prior: 500000 },
  { label: "Net Income", current: 242600, ytd: 2911000, prior: 500000, isTotal: true },
];

const CASH_FLOW_DATA = {
  operating: [
    { label: "Net Income", amount: 242600 },
    { label: "Depreciation & Amortization", amount: 35000 },
    { label: "Changes in Working Capital", amount: -12000 },
    { label: "Net Cash from Operating", amount: 265600, isTotal: true },
  ],
  investing: [
    { label: "Capital Expenditures", amount: -50000 },
    { label: "Software Development", amount: -85000 },
    { label: "Net Cash from Investing", amount: -135000, isTotal: true },
  ],
  financing: [
    { label: "Debt Repayment", amount: -20000 },
    { label: "Stock Issuance", amount: 0 },
    { label: "Net Cash from Financing", amount: -20000, isTotal: true },
  ],
  balances: {
    beginning: 8450000,
    ending: 8560600,
  }
};

const CASH_POSITION_HISTORY = [
  7200000, 7400000, 7100000, 7600000, 7900000, 8100000, 
  8000000, 8200000, 8350000, 8400000, 8450000, 8560600
];

const BUDGET_DATA: BudgetRow[] = [
  { department: "Engineering", budget: 250000, actual: 245000 },
  { department: "Marketing", budget: 180000, actual: 195000 },
  { department: "Sales", budget: 140000, actual: 125000 },
  { department: "Product", budget: 90000, actual: 92000 },
  { department: "Operations", budget: 60000, actual: 58000 },
  { department: "G&A", budget: 120000, actual: 120000 },
];

// --- Components ---

const Card = ({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) => (
  <div className={cn("bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-hidden", className)}>
    {title && <h3 className="text-zinc-400 text-sm font-medium mb-4">{title}</h3>}
    {children}
  </div>
);

const Badge = ({ children, variant }: { children: React.ReactNode; variant: "success" | "error" | "warning" | "neutral" }) => {
  const styles = {
    success: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    error: "bg-rose-400/10 text-rose-400 border-rose-400/20",
    warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    neutral: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", styles[variant])}>
      {children}
    </span>
  );
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
};

// --- View: Overview ---

const OverviewTab = () => {
  const maxWaterfall = Math.max(...REVENUE_WATERFALL.map(d => d.value > 0 ? d.value : Math.abs(d.value))) * 1.2;
  const startVal = REVENUE_WATERFALL[0].value;
  
  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI_SUMMARY.map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wider font-semibold">{kpi.label}</p>
            <p className="text-2xl font-bold text-white mb-2">{kpi.value}</p>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-xs font-medium",
                kpi.trend > 0 === kpi.isPositiveGood ? "text-emerald-400" : "text-rose-400"
              )}>
                {kpi.trend > 0 ? "↑" : "↓"} {Math.abs(kpi.trend)}%
              </span>
              <span className="text-zinc-600 text-[10px]">vs last month</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waterfall Chart */}
        <Card title="Monthly MRR Waterfall" className="lg:col-span-2">
          <div className="h-64 flex items-end justify-between gap-2 mt-8 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t border-zinc-800/50 w-full h-px" />
              ))}
            </div>

            {REVENUE_WATERFALL.map((item, i) => {
              let height = 0;
              let bottom = 0;
              let color = "bg-indigo-500";

              if (item.type === "base" || item.type === "total") {
                height = (item.value / 1300000) * 100;
                bottom = 0;
                color = item.type === "total" ? "bg-indigo-600" : "bg-zinc-700";
              } else {
                const prevSum = REVENUE_WATERFALL.slice(0, i).reduce((acc, curr) => 
                  curr.type === "base" || curr.type === "total" ? curr.value : acc + curr.value, startVal
                );
                
                if (item.type === "add") {
                  height = (item.value / 1300000) * 100;
                  bottom = (prevSum / 1300000) * 100;
                  color = "bg-emerald-400";
                } else {
                  height = (Math.abs(item.value) / 1300000) * 100;
                  bottom = ((prevSum + item.value) / 1300000) * 100;
                  color = "bg-rose-400";
                }
              }

              return (
                <div key={item.label} className="flex-1 flex flex-col items-center group relative z-10">
                  <div 
                    className={cn("w-full rounded-t-sm transition-all duration-300 group-hover:brightness-110", color)}
                    style={{ height: `${height}%`, marginBottom: `${bottom}%` }}
                  />
                  <span className="text-[10px] text-zinc-500 mt-2 rotate-[-45deg] origin-top-left whitespace-nowrap">
                    {item.label}
                  </span>
                  <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-white text-[10px] px-2 py-1 rounded border border-zinc-700 pointer-events-none">
                    {formatCurrency(item.value)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Donut Chart (Div-based) */}
        <Card title="Revenue by Source">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="relative w-40 h-40">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-[12px] border-zinc-800" />
              
              {/* Segmented Ring (Visual Approximation with CSS) */}
              <div className="absolute inset-0 rounded-full border-[12px] border-indigo-500" 
                   style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 50%)' }} />
              <div className="absolute inset-0 rounded-full border-[12px] border-indigo-400" 
                   style={{ clipPath: 'polygon(50% 50%, 0% 50%, 0% 0%, 50% 0%)', transform: 'rotate(20deg)' }} />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">$1.24M</span>
                <span className="text-[10px] text-zinc-500 uppercase">Total MRR</span>
              </div>
            </div>
            
            <div className="mt-6 w-full space-y-2">
              {REVENUE_SOURCES.map(source => (
                <div key={source.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", source.color)} />
                    <span className="text-zinc-400">{source.label}</span>
                  </div>
                  <span className="text-white font-medium">{formatCurrency(source.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Customer Acquisition Cost (CAC)">
            <div className="space-y-4">
               <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-white">$4,250</p>
                    <p className="text-xs text-zinc-500">Blended CAC</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-emerald-400">5.2 months</p>
                    <p className="text-xs text-zinc-500">Payback Period</p>
                  </div>
               </div>
               <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-500" style={{ width: '65%' }} />
                  <div className="h-full bg-indigo-400" style={{ width: '25%' }} />
                  <div className="h-full bg-indigo-300" style={{ width: '10%' }} />
               </div>
               <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="text-zinc-400">● Ad Spend (65%)</div>
                  <div className="text-zinc-400">● Sales (25%)</div>
                  <div className="text-zinc-400">● Other (10%)</div>
               </div>
            </div>
        </Card>
        <Card title="LTV : CAC Ratio">
            <div className="flex items-center justify-between h-full pb-4">
              <div className="space-y-1">
                <p className="text-4xl font-bold text-white">4.8x</p>
                <p className="text-sm text-zinc-400">Health: <span className="text-emerald-400 font-bold">EXCELLENT</span></p>
              </div>
              <div className="flex items-end gap-1 h-16">
                {[30, 45, 40, 55, 60, 75, 85].map((h, i) => (
                  <div key={i} className="w-3 bg-indigo-500/40 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
        </Card>
      </div>
    </div>
  );
};

// --- View: P&L ---

const PLTab = () => {
  return (
    <Card className="p-0 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Profit & Loss Statement</th>
            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Current Month</th>
            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">YTD Total</th>
            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Prior Year (YTD)</th>
            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Variance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {PL_DATA.map((row, i) => {
            const variance = ((row.ytd - row.prior) / row.prior) * 100;
            const isRevenue = row.label.includes("Revenue") || row.label.includes("Profit") || row.label === "EBITDA" || row.label === "Net Income";
            const isPositiveGood = isRevenue;
            const isFavorable = variance > 0 ? isPositiveGood : !isPositiveGood;

            return (
              <tr key={i} className={cn(
                "hover:bg-zinc-800/30 transition-colors",
                row.isHeader && "bg-zinc-900/30",
                row.isTotal && "bg-indigo-500/5"
              )}>
                <td className={cn(
                  "px-6 py-3 text-sm",
                  row.isHeader ? "font-bold text-zinc-300" : "text-zinc-400",
                  row.isTotal ? "font-bold text-white border-t border-zinc-700" : "",
                  row.indent ? "pl-10" : ""
                )}>
                  {row.label}
                </td>
                <td className={cn("px-6 py-3 text-sm text-right font-medium", row.isTotal ? "text-white" : "text-zinc-300")}>
                  {formatCurrency(row.current)}
                </td>
                <td className={cn("px-6 py-3 text-sm text-right font-medium", row.isTotal ? "text-white" : "text-zinc-300")}>
                  {formatCurrency(row.ytd)}
                </td>
                <td className="px-6 py-3 text-sm text-right text-zinc-500">
                  {formatCurrency(row.prior)}
                </td>
                <td className={cn(
                  "px-6 py-3 text-sm text-right font-bold",
                  isFavorable ? "text-emerald-400" : "text-rose-400"
                )}>
                  {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};

// --- View: Cash Flow ---

const CashFlowTab = () => {
  const maxCash = Math.max(...CASH_POSITION_HISTORY);
  
  const FlowSection = ({ title, items }: { title: string; items: CashFlowItem[] }) => (
    <div className="mb-6">
      <h4 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2 px-2">{title}</h4>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className={cn(
            "flex justify-between items-center px-2 py-1.5 rounded",
            item.isTotal ? "bg-zinc-800/50 font-bold border-t border-zinc-700 mt-2" : "text-sm"
          )}>
            <span className={item.isTotal ? "text-white" : "text-zinc-400"}>{item.label}</span>
            <span className={cn(
              item.amount < 0 ? "text-rose-400" : "text-emerald-400",
              item.isTotal ? "font-bold" : "font-medium"
            )}>
              {item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Cash Flow Statement" className="lg:col-span-1">
        <div className="space-y-6">
          <FlowSection title="Operating Activities" items={CASH_FLOW_DATA.operating} />
          <FlowSection title="Investing Activities" items={CASH_FLOW_DATA.investing} />
          <FlowSection title="Financing Activities" items={CASH_FLOW_DATA.financing} />
          
          <div className="mt-8 pt-4 border-t border-zinc-800">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Beginning Balance</span>
              <span>{formatCurrency(CASH_FLOW_DATA.balances.beginning)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Ending Cash Balance</span>
              <span>{formatCurrency(CASH_FLOW_DATA.balances.ending)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="lg:col-span-2 space-y-6">
        <Card title="12-Month Cash Position Trend">
          <div className="h-64 flex items-end justify-between gap-3 mt-8 px-4 border-b border-zinc-800">
            {CASH_POSITION_HISTORY.map((val, i) => {
              const height = (val / maxCash) * 100;
              const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div 
                    className="w-full bg-indigo-500/40 border-t-2 border-indigo-500 rounded-t-sm group-hover:bg-indigo-500/60 transition-all"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-zinc-500 mt-2">{months[i]}</span>
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-white text-[10px] px-2 py-1 rounded border border-zinc-700 pointer-events-none whitespace-nowrap z-20">
                    {formatCurrency(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-emerald-400/5 border-emerald-400/20">
            <p className="text-zinc-500 text-xs font-medium uppercase mb-1">Free Cash Flow</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(130600)}</p>
            <p className="text-[10px] text-zinc-400 mt-2 italic">Cash from operations minus CapEx</p>
          </Card>
          <Card className="bg-indigo-500/5 border-indigo-500/20">
            <p className="text-zinc-500 text-xs font-medium uppercase mb-1">Months of Runway</p>
            <p className="text-2xl font-bold text-indigo-400">20.4 Months</p>
            <p className="text-[10px] text-zinc-400 mt-2 italic">Based on 3-month avg net burn</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- View: Budget vs Actual ---

const BudgetTab = () => {
  const maxBudget = Math.max(...BUDGET_DATA.map(d => Math.max(d.budget, d.actual)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Department Budget Variance">
          <div className="h-80 flex items-end justify-between gap-6 mt-8 px-4">
            {BUDGET_DATA.map((d) => {
              const bHeight = (d.budget / maxBudget) * 100;
              const aHeight = (d.actual / maxBudget) * 100;
              const isOver = d.actual > d.budget;
              
              return (
                <div key={d.department} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    {/* Budget Bar */}
                    <div 
                      className="w-1/2 bg-zinc-800 rounded-t-sm relative group"
                      style={{ height: `${bHeight}%` }}
                    >
                       <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-zinc-800 text-[8px] px-1 py-0.5 rounded border border-zinc-700 whitespace-nowrap">B: {formatCurrency(d.budget)}</div>
                    </div>
                    {/* Actual Bar */}
                    <div 
                      className={cn(
                        "w-1/2 rounded-t-sm relative group",
                        isOver ? "bg-rose-400" : "bg-emerald-400"
                      )}
                      style={{ height: `${aHeight}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-zinc-800 text-[8px] px-1 py-0.5 rounded border border-zinc-700 whitespace-nowrap">A: {formatCurrency(d.actual)}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-2 truncate w-full text-center">
                    {d.department}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex justify-center gap-6">
             <div className="flex items-center gap-2 text-[10px] text-zinc-400">
               <div className="w-3 h-3 bg-zinc-800 rounded-sm" /> Budget
             </div>
             <div className="flex items-center gap-2 text-[10px] text-zinc-400">
               <div className="w-3 h-3 bg-emerald-400 rounded-sm" /> Under Budget
             </div>
             <div className="flex items-center gap-2 text-[10px] text-zinc-400">
               <div className="w-3 h-3 bg-rose-400 rounded-sm" /> Over Budget
             </div>
          </div>
        </Card>

        <Card title="Variance Analysis (Budget - Actual)">
           <div className="h-80 flex flex-col justify-center relative px-10">
              {/* Zero Line */}
              <div className="absolute left-10 right-10 top-1/2 border-t-2 border-zinc-800 z-0" />
              
              <div className="flex items-center justify-between h-full relative z-10">
                {BUDGET_DATA.map((d) => {
                  const variance = d.budget - d.actual;
                  const variancePercent = (variance / d.budget) * 50; // scaled for UI
                  const isPositive = variance >= 0;

                  return (
                    <div key={d.department} className="flex-1 flex flex-col items-center group">
                      <div 
                        className={cn(
                          "w-6 transition-all duration-300",
                          isPositive ? "bg-emerald-400 rounded-t-sm" : "bg-rose-400 rounded-b-sm"
                        )}
                        style={{ 
                          height: `${Math.abs(variancePercent)}%`,
                          marginTop: isPositive ? `-${Math.abs(variancePercent)}%` : '0',
                          marginBottom: !isPositive ? `-${Math.abs(variancePercent)}%` : '0'
                        }}
                      />
                      <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-white text-[10px] px-2 py-1 rounded border border-zinc-700 pointer-events-none whitespace-nowrap">
                        {isPositive ? "+" : ""}{formatCurrency(variance)}
                      </div>
                    </div>
                  );
                })}
              </div>
           </div>
           <p className="text-[10px] text-zinc-500 text-center mt-4 uppercase tracking-tighter">Positive indicates savings (Under budget)</p>
        </Card>
      </div>

      <Card className="p-0">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400">Department</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Budget</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Actual</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Variance $</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Variance %</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {BUDGET_DATA.map((d) => {
              const variance = d.budget - d.actual;
              const varPercent = (variance / d.budget) * 100;
              const isOver = d.actual > d.budget;
              const isCritical = (d.actual / d.budget) > 1.1;

              return (
                <tr key={d.department} className="hover:bg-zinc-800/30">
                  <td className="px-6 py-4 text-sm font-medium text-white">{d.department}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300 text-right">{formatCurrency(d.budget)}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300 text-right">{formatCurrency(d.actual)}</td>
                  <td className={cn("px-6 py-4 text-sm text-right font-medium", variance >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                  </td>
                  <td className={cn("px-6 py-4 text-sm text-right font-medium", variance >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {varPercent.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 text-center">
                    {isCritical ? (
                      <Badge variant="error">⚠️ Over</Badge>
                    ) : isOver ? (
                      <Badge variant="warning">Over</Badge>
                    ) : (
                      <Badge variant="success">✅ On Track</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// --- Main Component ---

export default function FinancialReportingDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "pnl", label: "Profit & Loss" },
    { id: "cashflow", label: "Cash Flow" },
    { id: "budget", label: "Budget vs Actual" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Reporting</h1>
            <p className="text-zinc-500 text-sm mt-1">Fiscal Year 2026 • Reporting Period: February</p>
          </div>
          <div className="flex items-center gap-3">
             <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
               Export PDF
             </button>
             <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
               Financial Settings
             </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-zinc-800 mb-8 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap",
                activeTab === tab.id 
                  ? "text-indigo-400" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-in fade-in duration-500">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "pnl" && <PLTab />}
          {activeTab === "cashflow" && <CashFlowTab />}
          {activeTab === "budget" && <BudgetTab />}
        </div>
        
        {/* Footer info */}
        <div className="mt-12 pt-6 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
           <div className="flex items-center gap-6">
              <span>Data Updated: 12 minutes ago</span>
              <span>Audit Log: Verified</span>
           </div>
           <div>
              HORIZON UI FINANCIAL ENGINE V4.2
           </div>
        </div>
      </div>
      
      {/* Scrollbar style */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
