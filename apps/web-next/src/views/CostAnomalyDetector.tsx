import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * CostAnomalyDetector
 * 
 * An AI-driven cost anomaly detection and alerting dashboard for the Horizon UI.
 * Built with accessibility and responsiveness in mind.
 */

// --- Types ---

type Severity = "critical" | "high" | "medium";
type Status = "open" | "investigating" | "resolved";
type ServiceStatus = "normal" | "elevated" | "anomaly";

interface Anomaly {
  id: string;
  service: string;
  detectedAt: string;
  expectedCost: number;
  actualCost: number;
  deltaPercentage: number;
  severity: Severity;
  status: Status;
  description: string;
  likelyCauses: string[];
  recommendedActions: string[];
}

interface ServiceCost {
  id: string;
  name: string;
  yesterdayCost: number;
  avg7d: number;
  avg30d: number;
  changePercentage: number;
  trend: number[]; // Array of 7 values for sparkline
  status: ServiceStatus;
}

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  actual: number;
  projected: number;
}

interface Alert {
  id: string;
  service: string;
  magnitude: number;
  timestamp: string;
}

// --- Sample Data ---

const INITIAL_ANOMALIES: Anomaly[] = [
  {
    id: "anom-1",
    service: "Lambda-Inference-Llama3",
    detectedAt: "2026-02-22 02:15 AM",
    expectedCost: 120.50,
    actualCost: 450.25,
    deltaPercentage: 273,
    severity: "critical",
    status: "open",
    description: "Sudden spike in invocation volume for Llama-3-70b-instruct endpoints in us-east-1 region.",
    likelyCauses: ["Traffic spike", "Runaway job", "Misconfiguration"],
    recommendedActions: ["Check CloudWatch metrics", "Verify API key rotation", "Scale down concurrency limits"]
  },
  {
    id: "anom-2",
    service: "S3-Storage-VectorDB",
    detectedAt: "2026-02-21 11:45 PM",
    expectedCost: 85.00,
    actualCost: 145.00,
    deltaPercentage: 70,
    severity: "high",
    status: "investigating",
    description: "Unexpected increase in PUT requests to the main vector embeddings bucket.",
    likelyCauses: ["Traffic spike", "Misconfiguration"],
    recommendedActions: ["Audit recent data ingestion jobs", "Check bucket lifecycle policies"]
  },
  {
    id: "anom-3",
    service: "RDS-PostgreSQL-Core",
    detectedAt: "2026-02-21 09:30 PM",
    expectedCost: 210.00,
    actualCost: 260.00,
    deltaPercentage: 23,
    severity: "medium",
    status: "resolved",
    description: "Elevated IOPS cost due to unoptimized query patterns during batch processing.",
    likelyCauses: ["Misconfiguration", "Traffic spike"],
    recommendedActions: ["Review slow query logs", "Implement query caching"]
  }
];

const SERVICE_COSTS: ServiceCost[] = [
  { id: "s1", name: "Lambda Inference", yesterdayCost: 450.25, avg7d: 135.20, avg30d: 128.40, changePercentage: 232.9, trend: [120, 130, 125, 140, 135, 150, 450], status: "anomaly" },
  { id: "s2", name: "S3 Storage", yesterdayCost: 145.00, avg7d: 88.50, avg30d: 82.10, changePercentage: 63.8, trend: [80, 82, 85, 83, 88, 90, 145], status: "elevated" },
  { id: "s3", name: "RDS PostgreSQL", yesterdayCost: 260.00, avg7d: 215.00, avg30d: 208.50, changePercentage: 20.9, trend: [200, 210, 205, 215, 220, 218, 260], status: "elevated" },
  { id: "s4", name: "EC2 GPU Clusters", yesterdayCost: 890.00, avg7d: 875.50, avg30d: 860.20, changePercentage: 1.6, trend: [850, 860, 870, 865, 875, 880, 890], status: "normal" },
  { id: "s5", name: "CloudFront CDN", yesterdayCost: 45.20, avg7d: 48.10, avg30d: 50.50, changePercentage: -6.0, trend: [52, 51, 50, 49, 48, 47, 45], status: "normal" },
  { id: "s6", name: "OpenSearch Service", yesterdayCost: 112.00, avg7d: 110.50, avg30d: 111.20, changePercentage: 1.3, trend: [110, 111, 112, 110, 111, 110, 112], status: "normal" },
  { id: "s7", name: "ElastiCache Redis", yesterdayCost: 65.40, avg7d: 64.80, avg30d: 65.10, changePercentage: 0.9, trend: [64, 65, 66, 65, 64, 65, 65], status: "normal" },
  { id: "s8", name: "DynamoDB", yesterdayCost: 32.10, avg7d: 31.50, avg30d: 30.80, changePercentage: 1.9, trend: [30, 31, 30, 32, 31, 32, 32], status: "normal" },
  { id: "s9", name: "Route 53", yesterdayCost: 12.50, avg7d: 12.40, avg30d: 12.30, changePercentage: 0.8, trend: [12, 12, 13, 12, 12, 12, 13], status: "normal" },
  { id: "s10", name: "Kinesis Data Streams", yesterdayCost: 78.90, avg7d: 75.20, avg30d: 74.50, changePercentage: 4.9, trend: [74, 75, 76, 75, 74, 76, 79], status: "normal" },
  { id: "s11", name: "SageMaker Endpoints", yesterdayCost: 315.00, avg7d: 310.00, avg30d: 305.50, changePercentage: 1.6, trend: [300, 305, 310, 308, 312, 310, 315], status: "normal" },
  { id: "s12", name: "SQS Queues", yesterdayCost: 8.45, avg7d: 8.10, avg30d: 7.90, changePercentage: 4.3, trend: [8, 8, 8, 9, 8, 8, 8], status: "normal" },
  { id: "s13", name: "SNS Notifications", yesterdayCost: 4.20, avg7d: 4.15, avg30d: 4.05, changePercentage: 1.2, trend: [4, 4, 4, 4, 4, 4, 4], status: "normal" },
  { id: "s14", name: "WAF Shield", yesterdayCost: 55.00, avg7d: 55.00, avg30d: 55.00, changePercentage: 0.0, trend: [55, 55, 55, 55, 55, 55, 55], status: "normal" },
  { id: "s15", name: "App Runner", yesterdayCost: 22.40, avg7d: 45.10, avg30d: 48.20, changePercentage: -50.3, trend: [50, 48, 46, 44, 42, 40, 22], status: "normal" },
];

const BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: "b1", name: "Infrastructure", allocated: 15000, actual: 12450, projected: 14800 },
  { id: "b2", name: "AI/ML Compute", allocated: 12000, actual: 10800, projected: 13500 },
  { id: "b3", name: "Data Storage", allocated: 5000, actual: 4200, projected: 4950 },
  { id: "b4", name: "Security & Compliance", allocated: 3000, actual: 1500, projected: 2100 },
  { id: "b5", name: "Tooling & SaaS", allocated: 2500, actual: 2350, projected: 2650 },
];

const RECENT_ALERTS: Alert[] = [
  { id: "al-1", service: "Lambda-Inference-Llama3", magnitude: 273, timestamp: "2 hours ago" },
  { id: "al-2", service: "S3-Storage-VectorDB", magnitude: 70, timestamp: "5 hours ago" },
  { id: "al-3", service: "RDS-PostgreSQL-Core", magnitude: 23, timestamp: "Yesterday" },
  { id: "al-4", service: "EC2-Internal-Proxy", magnitude: 12, timestamp: "2 days ago" },
];

const WEEKLY_SPEND = [
  { day: "Mon", amount: 1240 },
  { day: "Tue", amount: 1180 },
  { day: "Wed", amount: 1320 },
  { day: "Thu", amount: 1290 },
  { day: "Fri", amount: 1410 },
  { day: "Sat", amount: 1380 },
  { day: "Sun", amount: 2450 }, // Big spike
];

// --- Components ---

const KPICard = ({ title, value, subValue, trend }: { title: string; value: string; subValue?: string; trend?: { val: string; pos: boolean } }) => (
  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl shadow-sm">
    <div className="text-zinc-400 text-sm font-medium mb-2">{title}</div>
    <div className="text-2xl font-bold text-white mb-1">{value}</div>
    {subValue && (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">{subValue}</span>
        {trend && (
          <span className={cn("text-xs font-medium", trend.pos ? "text-emerald-400" : "text-rose-400")}>
            {trend.pos ? "↑" : "↓"} {trend.val}
          </span>
        )}
      </div>
    )}
  </div>
);

const Tabs = ({ active, onChange, items }: { active: string; onChange: (id: string) => void; items: { id: string; label: string }[] }) => (
  <nav className="flex gap-1 border-b border-zinc-800 mb-6" aria-label="Dashboard Tabs">
    {items.map((item) => (
      <button
        key={item.id}
        onClick={() => onChange(item.id)}
        className={cn(
          "px-4 py-2 text-sm font-medium transition-colors relative",
          active === item.id ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
        )}
      >
        {item.label}
        {active === item.id && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" aria-hidden="true" />
        )}
      </button>
    ))}
  </nav>
);

const SeverityBadge = ({ level }: { level: Severity }) => {
  const styles = {
    critical: "bg-rose-950 text-rose-400 border-rose-900",
    high: "bg-amber-950 text-amber-400 border-amber-900",
    medium: "bg-indigo-950 text-indigo-400 border-indigo-900",
  };
  return (
    <span className={cn("px-2 py-0.5 text-[10px] uppercase font-bold border rounded-full", styles[level])}>
      {level}
    </span>
  );
};

const StatusBadge = ({ status }: { status: Status | ServiceStatus }) => {
  const styles: Record<string, string> = {
    open: "text-rose-400 bg-rose-400/10",
    investigating: "text-amber-400 bg-amber-400/10",
    resolved: "text-emerald-400 bg-emerald-400/10",
    anomaly: "text-rose-400 bg-rose-400/10",
    elevated: "text-amber-400 bg-amber-400/10",
    normal: "text-emerald-400 bg-emerald-400/10",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", styles[status] || "text-zinc-400 bg-zinc-400/10")}>
      {status}
    </span>
  );
};

const Sparkline = ({ data, colorClass = "bg-indigo-500" }: { data: number[]; colorClass?: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-0.5 h-6 w-16" aria-hidden="true">
      {data.map((val, i) => {
        const height = ((val - min) / range) * 100;
        return (
          <div
            key={i}
            className={cn("w-1 rounded-t-sm opacity-60", colorClass)}
            style={{ height: `${Math.max(15, height)}%` }}
          />
        );
      })}
    </div>
  );
};

// --- View Components ---

const OverviewView = () => {
  const maxSpend = Math.max(...WEEKLY_SPEND.map(s => s.amount));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Today's Spend" value="$2,450.25" subValue="vs $1,380 yesterday" trend={{ val: "77.5%", pos: true }} />
        <KPICard title="Projected Month" value="$42,850.00" subValue="Budget: $37,500" trend={{ val: "14.2%", pos: true }} />
        <KPICard title="Active Anomalies" value="2" subValue="1 critical, 1 high" />
        <KPICard title="Top Spike Service" value="Lambda-Inf" subValue="273% delta today" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <h3 className="text-white font-semibold mb-6">7-Day Spend Trend</h3>
          <div className="flex items-end justify-between h-48 gap-2 pt-4">
            {WEEKLY_SPEND.map((item) => {
              const height = (item.amount / maxSpend) * 100;
              const isAnomaly = item.amount > 2000;
              return (
                <div key={item.day} className="flex-1 flex flex-col items-center group">
                  <div 
                    className={cn(
                      "w-full max-w-[40px] rounded-t-md transition-all duration-300 relative",
                      isAnomaly ? "bg-rose-500" : "bg-indigo-500/40 group-hover:bg-indigo-500/60"
                    )}
                    style={{ height: `${height}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      ${item.amount}
                    </div>
                  </div>
                  <span className="text-zinc-500 text-xs mt-3">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <h3 className="text-white font-semibold mb-4">Recent Alerts</h3>
          <div className="space-y-4">
            {RECENT_ALERTS.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 border border-zinc-800/50 rounded-lg hover:bg-zinc-800/30 transition-colors cursor-pointer">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", alert.magnitude > 100 ? "bg-rose-400" : "bg-amber-400")} />
                <div>
                  <div className="text-sm font-medium text-white">{alert.service}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Spike: <span className="text-rose-400">+{alert.magnitude}%</span> • {alert.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-xs font-medium text-zinc-400 hover:text-white border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors">
            View All History
          </button>
        </div>
      </div>
    </div>
  );
};

const AnomaliesView = () => {
  const [expandedId, setExpandedId] = useState<string | null>("anom-1");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Service</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Detected</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Cost Delta</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Severity</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_ANOMALIES.map((anom) => (
              <React.Fragment key={anom.id}>
                <tr 
                  onClick={() => setExpandedId(expandedId === anom.id ? null : anom.id)}
                  className={cn(
                    "border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer",
                    expandedId === anom.id && "bg-zinc-800/50"
                  )}
                >
                  <td className="px-6 py-4 font-medium text-white">{anom.service}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{anom.detectedAt}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-bold text-rose-400">+{anom.deltaPercentage}%</div>
                    <div className="text-[10px] text-zinc-500">${anom.actualCost} vs ${anom.expectedCost}</div>
                  </td>
                  <td className="px-6 py-4">
                    <SeverityBadge level={anom.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={anom.status} />
                  </td>
                </tr>
                {expandedId === anom.id && (
                  <tr className="bg-zinc-900/80 border-b border-zinc-800">
                    <td colSpan={5} className="px-6 py-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-sm text-zinc-300 leading-relaxed">{anom.description}</p>
                          
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-6 mb-3">Likely Causes</h4>
                          <div className="flex flex-wrap gap-2">
                            {anom.likelyCauses.map(cause => (
                              <span key={cause} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded border border-zinc-700">
                                {cause}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Recommended Actions</h4>
                          <ul className="space-y-3">
                            {anom.recommendedActions.map((action, idx) => (
                              <li key={idx} className="flex gap-3 text-sm text-zinc-300">
                                <span className="text-indigo-500 font-bold">{idx + 1}.</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-6 flex gap-3">
                            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded transition-colors">
                              Take Action
                            </button>
                            <button className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded transition-colors">
                              Mute Alert
                            </button>
                          </div>
                        </div>
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
  );
};

const ServicesView = () => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Service</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Yesterday</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">7D Avg</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">30D Avg</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">% Change</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">7D Trend</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_COSTS.map((service) => (
              <tr key={service.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{service.name}</td>
                <td className="px-6 py-4 text-right text-sm text-zinc-300">${service.yesterdayCost.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-sm text-zinc-400">${service.avg7d.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-sm text-zinc-400">${service.avg30d.toFixed(2)}</td>
                <td className={cn(
                  "px-6 py-4 text-right text-sm font-medium",
                  service.changePercentage > 5 ? "text-rose-400" : service.changePercentage < -5 ? "text-emerald-400" : "text-zinc-500"
                )}>
                  {service.changePercentage > 0 ? "+" : ""}{service.changePercentage}%
                </td>
                <td className="px-6 py-4">
                  <Sparkline 
                    data={service.trend} 
                    colorClass={service.status === "anomaly" ? "bg-rose-500" : service.status === "elevated" ? "bg-amber-500" : "bg-emerald-500"} 
                  />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={service.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BudgetView = () => {
  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h3 className="text-white font-semibold mb-6">Budget Allocation vs Actual</h3>
        <div className="space-y-8">
          {BUDGET_CATEGORIES.map((cat) => {
            const usagePercent = (cat.actual / cat.allocated) * 100;
            const barColor = usagePercent > 90 ? "bg-rose-400" : usagePercent > 70 ? "bg-amber-400" : "bg-emerald-400";
            const projectedPercent = (cat.projected / cat.allocated) * 100;

            return (
              <div key={cat.id} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-sm font-bold text-white mb-0.5">{cat.name}</div>
                    <div className="text-xs text-zinc-500">${cat.actual.toLocaleString()} spent of ${cat.allocated.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-sm font-bold", usagePercent > 90 ? "text-rose-400" : "text-white")}>
                      {usagePercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-zinc-500">Projected: ${cat.projected.toLocaleString()} ({projectedPercent.toFixed(0)}%)</div>
                  </div>
                </div>
                <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-500", barColor)}
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                  {projectedPercent > usagePercent && (
                    <div 
                      className="absolute top-0 left-0 h-full opacity-20 bg-white" 
                      style={{ width: `${Math.min(100, projectedPercent)}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">Projected Month-End</h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">$42,850</span>
            <span className="text-rose-400 text-sm font-medium">+$5,350 over budget</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            Based on current consumption rates and detected anomalies, the total spend is projected to exceed the budget by 14.2%.
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">Saving Opportunities</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Unused Reserved Instances</span>
              <span className="text-emerald-400 text-sm font-bold">-$1,200</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Zombie EC2 Instances</span>
              <span className="text-emerald-400 text-sm font-bold">-$450</span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
              <span className="text-sm font-bold text-white">Potential Monthly Savings</span>
              <span className="text-emerald-400 text-sm font-bold">-$1,650</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

export default function CostAnomalyDetector() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "anomalies", label: "Anomalies" },
    { id: "services", label: "Services" },
    { id: "budget", label: "Budget" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 lg:p-10 font-sans">
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-indigo-500 rounded-lg text-white" aria-hidden="true">
                💰
              </span>
              <h1 className="text-2xl font-bold tracking-tight">Cost Anomaly Detector</h1>
            </div>
            <p className="text-zinc-500 text-sm">
              AI-driven monitoring for AWS/Azure cloud spend and usage patterns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Monitoring Active
            </div>
            <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-zinc-700">
              Export Report
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <Tabs active={activeTab} onChange={setActiveTab} items={tabItems} />

        <div className="mt-8 transition-all duration-300">
          {activeTab === "overview" && <OverviewView />}
          {activeTab === "anomalies" && <AnomaliesView />}
          {activeTab === "services" && <ServicesView />}
          {activeTab === "budget" && <BudgetView />}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-20 pt-8 border-t border-zinc-900 text-zinc-600 text-[10px] uppercase tracking-widest flex flex-col md:flex-row justify-between gap-4">
        <div>Horizon Cloud Intelligence &copy; 2026</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-zinc-400 transition-colors">Documentation</a>
          <a href="#" className="hover:text-zinc-400 transition-colors">API Access</a>
          <a href="#" className="hover:text-zinc-400 transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}
