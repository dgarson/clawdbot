import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * CDNManager Component
 * 
 * A comprehensive CDN management dashboard for Horizon UI.
 * Features:
 * - Overview: Global status map, key metrics, and top origins.
 * - Origins: Origin server management, health monitoring, and addition form.
 * - Cache Rules: Priority-based caching logic and rule editor.
 * - Analytics: Bandwidth and cache performance visualizations with URL-level details.
 * 
 * Design System: Dark theme (Zinc-950/900), Indigo accents, div-based charts.
 */

// --- Types ---

type TabType = "overview" | "origins" | "cache-rules" | "analytics";

interface RegionStatus {
  id: string;
  name: string;
  traffic: number; // 0-100 scale for bar
  latency: number; // in ms
  status: "healthy" | "degraded" | "down";
}

interface Origin {
  id: string;
  hostname: string;
  protocol: "http" | "https";
  status: "healthy" | "degraded" | "down";
  healthCheckInterval: number; // seconds
  timeout: number; // seconds
  sslExpiry: string;
  history: number[]; // Last 7 days status (0: down, 1: degraded, 2: healthy)
}

interface CacheRule {
  id: string;
  priority: number;
  pathPattern: string;
  directive: "bypass" | "cache" | "force-cache";
  ttl: number; // seconds
}

interface AnalyticsEntry {
  id: string;
  url: string;
  hits: number;
  status: "hit" | "miss" | "stale";
}

interface BandwidthData {
  day: string;
  value: number; // GB
}

// --- Sample Data ---

const REGIONS: RegionStatus[] = [
  { id: "us-east", name: "US East (N. Virginia)", traffic: 85, latency: 22, status: "healthy" },
  { id: "us-west", name: "US West (Oregon)", traffic: 62, latency: 28, status: "healthy" },
  { id: "eu-central", name: "Europe (Frankfurt)", traffic: 92, latency: 18, status: "healthy" },
  { id: "eu-west", name: "Europe (London)", traffic: 45, latency: 31, status: "healthy" },
  { id: "ap-east", name: "Asia Pacific (Hong Kong)", traffic: 78, latency: 45, status: "degraded" },
  { id: "ap-south", name: "Asia Pacific (Mumbai)", traffic: 30, latency: 62, status: "healthy" },
  { id: "ap-northeast", name: "Asia Pacific (Tokyo)", traffic: 88, latency: 24, status: "healthy" },
  { id: "sa-east", name: "South America (São Paulo)", traffic: 25, latency: 110, status: "degraded" },
  { id: "af-south", name: "Africa (Cape Town)", traffic: 12, latency: 145, status: "healthy" },
  { id: "me-south", name: "Middle East (Bahrain)", traffic: 18, latency: 88, status: "healthy" },
  { id: "au-southeast", name: "Australia (Sydney)", traffic: 40, latency: 55, status: "healthy" },
  { id: "ca-central", name: "Canada (Central)", traffic: 35, latency: 29, status: "healthy" },
];

const INITIAL_ORIGINS: Origin[] = [
  { id: "o1", hostname: "origin-primary.horizon.io", protocol: "https", status: "healthy", healthCheckInterval: 30, timeout: 5, sslExpiry: "2026-12-15", history: [2, 2, 2, 2, 2, 2, 2] },
  { id: "o2", hostname: "origin-backup.horizon.io", protocol: "https", status: "healthy", healthCheckInterval: 60, timeout: 10, sslExpiry: "2026-08-20", history: [2, 2, 2, 1, 2, 2, 2] },
  { id: "o3", hostname: "assets.horizon-cdn.net", protocol: "https", status: "degraded", healthCheckInterval: 30, timeout: 5, sslExpiry: "2026-05-10", history: [2, 2, 2, 2, 2, 1, 1] },
  { id: "o4", hostname: "media-server-01.internal", protocol: "http", status: "healthy", healthCheckInterval: 15, timeout: 2, sslExpiry: "N/A", history: [2, 2, 2, 2, 2, 2, 2] },
  { id: "o5", hostname: "legacy-api.old-stack.com", protocol: "https", status: "down", healthCheckInterval: 120, timeout: 30, sslExpiry: "2025-01-01", history: [1, 0, 0, 0, 0, 0, 0] },
  { id: "o6", hostname: "edge-compute-lambda.aws", protocol: "https", status: "healthy", healthCheckInterval: 60, timeout: 5, sslExpiry: "2027-02-28", history: [2, 2, 2, 2, 2, 2, 2] },
];

const INITIAL_RULES: CacheRule[] = [
  { id: "r1", priority: 1, pathPattern: "/static/*", directive: "force-cache", ttl: 31536000 },
  { id: "r2", priority: 2, pathPattern: "/api/v1/user/*", directive: "bypass", ttl: 0 },
  { id: "r3", priority: 3, pathPattern: "/*.jpg", directive: "cache", ttl: 86400 },
  { id: "r4", priority: 4, pathPattern: "/*.png", directive: "cache", ttl: 86400 },
  { id: "r5", priority: 5, pathPattern: "/_next/static/*", directive: "force-cache", ttl: 31536000 },
  { id: "r6", priority: 6, pathPattern: "/search", directive: "cache", ttl: 300 },
  { id: "r7", priority: 7, pathPattern: "/feed", directive: "cache", ttl: 60 },
  { id: "r8", priority: 100, pathPattern: "*", directive: "cache", ttl: 3600 },
];

const ANALYTICS_URLS: AnalyticsEntry[] = [
  { id: "u1", url: "/index.html", hits: 1250400, status: "hit" },
  { id: "u2", url: "/static/js/main.chunk.js", hits: 980200, status: "hit" },
  { id: "u3", url: "/api/v1/products", hits: 450300, status: "miss" },
  { id: "u4", url: "/images/hero-banner.webp", hits: 320100, status: "hit" },
  { id: "u5", url: "/static/css/global.css", hits: 280500, status: "hit" },
  { id: "u6", url: "/api/v1/auth/session", hits: 210000, status: "miss" },
  { id: "u7", url: "/favicon.ico", hits: 150200, status: "stale" },
  { id: "u8", url: "/fonts/inter-bold.woff2", hits: 120400, status: "hit" },
  { id: "u9", url: "/api/v1/search?q=horizon", hits: 95000, status: "miss" },
  { id: "u10", url: "/legal/privacy-policy", hits: 45000, status: "hit" },
];

const BANDWIDTH_HISTORY: BandwidthData[] = [
  { day: "Feb 08", value: 450 },
  { day: "Feb 09", value: 480 },
  { day: "Feb 10", value: 520 },
  { day: "Feb 11", value: 490 },
  { day: "Feb 12", value: 610 },
  { day: "Feb 13", value: 750 },
  { day: "Feb 14", value: 820 },
  { day: "Feb 15", value: 780 },
  { day: "Feb 16", value: 710 },
  { day: "Feb 17", value: 650 },
  { day: "Feb 18", value: 680 },
  { day: "Feb 19", value: 720 },
  { day: "Feb 20", value: 740 },
  { day: "Feb 21", value: 790 },
];

// --- Sub-components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden", className)}>
    {children}
  </div>
);

const Badge = ({ children, variant }: { children: React.ReactNode; variant: "success" | "error" | "warning" | "neutral" }) => {
  const styles = {
    success: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    error: "bg-rose-400/10 text-rose-400 border-rose-400/20",
    warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    neutral: "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", styles[variant])}>
      {children}
    </span>
  );
};

// --- Main Component ---

export default function CDNManager() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [origins, setOrigins] = useState<Origin[]>(INITIAL_ORIGINS);
  const [rules, setRules] = useState<CacheRule[]>(INITIAL_RULES);

  // Form states
  const [newOrigin, setNewOrigin] = useState<{ hostname: string; protocol: "http" | "https" }>({ hostname: "", protocol: "https" });
  const [newRule, setNewRule] = useState<{ pathPattern: string; directive: "bypass" | "cache" | "force-cache"; ttl: number }>({ pathPattern: "", directive: "cache", ttl: 3600 });

  const handleAddOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrigin.hostname) {return;}
    const origin: Origin = {
      id: Math.random().toString(36).substr(2, 9),
      hostname: newOrigin.hostname,
      protocol: newOrigin.protocol,
      status: "healthy",
      healthCheckInterval: 60,
      timeout: 5,
      sslExpiry: "2027-01-01",
      history: [2, 2, 2, 2, 2, 2, 2],
    };
    setOrigins([origin, ...origins]);
    setNewOrigin({ hostname: "", protocol: "https" });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.pathPattern) {return;}
    const rule: CacheRule = {
      id: Math.random().toString(36).substr(2, 9),
      priority: rules.length + 1,
      pathPattern: newRule.pathPattern,
      directive: newRule.directive,
      ttl: newRule.ttl,
    };
    setRules([...rules, rule]);
    setNewRule({ pathPattern: "", directive: "cache", ttl: 3600 });
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-8 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CDN Manager</h1>
            <p className="text-[var(--color-text-secondary)] mt-1 text-sm">Configure edge delivery, origins, and global performance.</p>
          </div>
          <div className="flex bg-[var(--color-surface-1)] p-1 rounded-lg border border-[var(--color-border)]">
            {(["overview", "origins", "cache-rules", "analytics"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                  activeTab === tab 
                    ? "bg-primary text-[var(--color-text-primary)] shadow-lg shadow-indigo-500/20" 
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                {tab.replace("-", " ")}
              </button>
            ))}
          </div>
        </header>

        {/* Tab Content */}
        <main>
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <div className="text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider mb-2">Total Bandwidth (30d)</div>
                  <div className="text-4xl font-bold tracking-tight">1.24 <span className="text-[var(--color-text-muted)] text-xl font-normal tracking-normal">PB</span></div>
                  <div className="mt-4 flex items-center text-emerald-400 text-sm">
                    <span className="mr-1">↑</span> 12.4% vs last period
                  </div>
                </Card>
                <Card className="p-6">
                  <div className="text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider mb-2">Cache Hit Ratio</div>
                  <div className="flex items-center gap-6">
                    <div className="text-4xl font-bold">94.2%</div>
                    {/* Gauge Visual */}
                    <div className="flex-1 h-3 bg-[var(--color-surface-2)] rounded-full overflow-hidden flex">
                      <div className="h-full bg-primary" style={{ width: "94.2%" }} />
                    </div>
                  </div>
                  <div className="mt-4 text-[var(--color-text-muted)] text-sm">1.17 PB served from edge</div>
                </Card>
                <Card className="p-6">
                  <div className="text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider mb-2">Active Origin Health</div>
                  <div className="flex items-center gap-2 text-4xl font-bold">
                    6/6 <span className="text-emerald-400 text-xl">✅</span>
                  </div>
                  <div className="mt-4 text-[var(--color-text-muted)] text-sm">All origins responding within SLA</div>
                </Card>
              </div>

              {/* Global Map Status */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Global Delivery Network</h3>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Healthy</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> Degraded</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-400" /> Down</div>
                  </div>
                </div>
                
                {/* Simulated Map Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {REGIONS.map((region) => (
                    <div key={region.id} className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{region.name}</span>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          region.status === "healthy" ? "bg-emerald-400" : region.status === "degraded" ? "bg-amber-400" : "bg-rose-400"
                        )} />
                      </div>
                      <div className="flex items-end gap-2 h-12 mb-2">
                        {/* Fake traffic bars */}
                        {[...Array(5)].map((_, i) => (
                          <div 
                            key={i} 
                            className="flex-1 bg-primary/40 rounded-t-sm" 
                            style={{ height: `${Math.max(10, region.traffic * (0.6 + Math.random() * 0.4))}%` }} 
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] font-mono uppercase">
                        <span>Traffic: {region.traffic}%</span>
                        <span>{region.latency}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Top Origins */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Top Origin Endpoints</h3>
                  <div className="space-y-4">
                    {origins.slice(0, 5).map((origin) => (
                      <div key={origin.id} className="flex items-center justify-between group">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono text-[var(--color-text-primary)] group-hover:text-primary transition-colors">{origin.hostname}</span>
                          <span className="text-xs text-[var(--color-text-muted)] uppercase">{origin.protocol}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{(Math.random() * 100).toFixed(1)} TB</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">LAST 30D</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-6 flex flex-col justify-center items-center text-center space-y-4 bg-primary/5 border-primary/20">
                  <div className="text-5xl">⚡️</div>
                  <div>
                    <h3 className="text-lg font-semibold">Edge Optimization Active</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1 max-w-sm">Smart Routing and Tiered Caching are currently reducing origin load by 82% across all regions.</p>
                  </div>
                  <button className="px-4 py-2 bg-primary hover:bg-primary rounded-lg text-sm font-medium transition-colors">
                    View Network Settings
                  </button>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "origins" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Origin List */}
              <div className="lg:col-span-2 space-y-4">
                {origins.map((origin) => (
                  <Card key={origin.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                        origin.status === "healthy" ? "bg-emerald-400/10 text-emerald-400" : origin.status === "degraded" ? "bg-amber-400/10 text-amber-400" : "bg-rose-400/10 text-rose-400"
                      )}>
                        {origin.status === "healthy" ? "✓" : origin.status === "degraded" ? "!" : "×"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-mono text-sm font-semibold">{origin.hostname}</h4>
                          <Badge variant={origin.status === "healthy" ? "success" : origin.status === "degraded" ? "warning" : "error"}>{origin.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                          <span>{origin.protocol.toUpperCase()}</span>
                          <span>•</span>
                          <span>Poll: {origin.healthCheckInterval}s</span>
                          <span>•</span>
                          <span>Timeout: {origin.timeout}s</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="hidden md:flex flex-col items-center">
                        <span className="text-[10px] text-[var(--color-text-muted)] uppercase mb-1">Health (7d)</span>
                        <div className="flex gap-0.5">
                          {origin.history.map((h, i) => (
                            <div 
                              key={i} 
                              className={cn(
                                "w-1.5 h-4 rounded-sm",
                                h === 2 ? "bg-emerald-500/60" : h === 1 ? "bg-amber-500/60" : "bg-rose-500/60"
                              )} 
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-[var(--color-text-muted)] uppercase">SSL Expiry</div>
                        <div className={cn("text-xs font-mono", origin.sslExpiry === "N/A" ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]")}>{origin.sslExpiry}</div>
                      </div>
                      <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2">
                        ⚙️
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Add Origin Sidebar */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Add Origin</h3>
                  <form onSubmit={handleAddOrigin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase font-medium">Hostname</label>
                      <input 
                        type="text" 
                        value={newOrigin.hostname}
                        onChange={(e) => setNewOrigin({ ...newOrigin, hostname: e.target.value })}
                        placeholder="e.g. s3.amazonaws.com"
                        className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase font-medium">Protocol</label>
                      <select 
                        value={newOrigin.protocol}
                        onChange={(e) => setNewOrigin({ ...newOrigin, protocol: e.target.value as "http" | "https" })}
                        className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="https">HTTPS (Recommended)</option>
                        <option value="http">HTTP</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] py-2 rounded-lg text-sm font-semibold transition-colors mt-2">
                      Connect Origin
                    </button>
                  </form>
                </Card>
                
                <Card className="p-4 bg-amber-400/5 border-amber-400/20">
                  <div className="flex gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-400">Security Warning</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                        One origin is currently using an unencrypted HTTP protocol. This may expose data in transit between the edge and your server.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "cache-rules" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Rule List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-xs text-[var(--color-text-muted)] uppercase font-medium">Active Rules (Priority Order)</span>
                  <span className="text-xs text-[var(--color-text-muted)] uppercase font-medium">Rules: {rules.length}</span>
                </div>
                {rules.toSorted((a, b) => a.priority - b.priority).map((rule) => (
                  <div key={rule.id} className="group relative">
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-[var(--color-text-muted)]">
                      ⣿
                    </div>
                    <Card className="p-4 flex items-center justify-between hover:border-[var(--color-border)] transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="text-xs font-mono text-[var(--color-text-muted)] w-4">{rule.priority}</div>
                        <div>
                          <div className="font-mono text-sm font-semibold">{rule.pathPattern}</div>
                          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-1 uppercase">
                            <span className={cn(
                              rule.directive === "bypass" ? "text-rose-400" : rule.directive === "force-cache" ? "text-emerald-400" : "text-primary"
                            )}>
                              {rule.directive}
                            </span>
                            <span>•</span>
                            <span>TTL: {rule.ttl === 0 ? "NONE" : `${rule.ttl}s`}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">✏️</button>
                        <button className="p-2 text-[var(--color-text-muted)] hover:text-rose-400 transition-colors">🗑️</button>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>

              {/* Rule Editor */}
              <div className="space-y-6">
                <Card className="p-6 sticky top-8">
                  <h3 className="text-lg font-semibold mb-4">Rule Editor</h3>
                  <form onSubmit={handleAddRule} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase font-medium">Path Pattern</label>
                      <input 
                        type="text" 
                        value={newRule.pathPattern}
                        onChange={(e) => setNewRule({ ...newRule, pathPattern: e.target.value })}
                        placeholder="/static/* or *.pdf"
                        className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase font-medium">Action</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["cache", "bypass", "force-cache"] as const).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => setNewRule({ ...newRule, directive: dir })}
                            className={cn(
                              "text-[10px] uppercase font-bold py-2 rounded border transition-all",
                              newRule.directive === dir 
                                ? "bg-primary/20 border-primary text-primary" 
                                : "bg-[var(--color-surface-0)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border)]"
                            )}
                          >
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase font-medium">TTL (Seconds)</label>
                      <select 
                        value={newRule.ttl}
                        onChange={(e) => setNewRule({ ...newRule, ttl: parseInt(e.target.value) })}
                        className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                      >
                        <option value={0}>0 (No Cache)</option>
                        <option value={60}>60 (1 Minute)</option>
                        <option value={3600}>3600 (1 Hour)</option>
                        <option value={86400}>86400 (1 Day)</option>
                        <option value={604800}>604800 (1 Week)</option>
                        <option value={31536000}>31536000 (1 Year)</option>
                      </select>
                    </div>

                    <button type="submit" className="w-full bg-primary hover:bg-primary text-[var(--color-text-primary)] py-2 rounded-lg text-sm font-semibold transition-colors mt-2">
                      Create Rule
                    </button>
                  </form>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Traffic Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-semibold">Bandwidth Usage (14d)</h3>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono">VALUES IN GB/DAY</div>
                  </div>
                  <div className="flex items-end justify-between h-48 gap-2">
                    {BANDWIDTH_HISTORY.map((item, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center group relative">
                        {/* Tooltip on hover */}
                        <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-[var(--color-surface-2)] text-[var(--color-text-primary)] text-[10px] px-2 py-1 rounded border border-[var(--color-border)] z-10 whitespace-nowrap">
                          {item.value} GB
                        </div>
                        <div 
                          className="w-full bg-primary/60 rounded-t-sm group-hover:bg-primary transition-colors" 
                          style={{ height: `${(item.value / 1000) * 100}%` }}
                        />
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-2 rotate-45 origin-left">{item.day}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-8">Cache Efficiency</h3>
                  <div className="flex flex-col h-48 justify-center">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs uppercase font-medium">
                          <span className="text-primary">Cache Hits</span>
                          <span>94.2%</span>
                        </div>
                        <div className="h-4 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: "94.2%" }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs uppercase font-medium">
                          <span className="text-rose-400">Cache Misses</span>
                          <span>4.1%</span>
                        </div>
                        <div className="h-4 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: "4.1%" }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs uppercase font-medium">
                          <span className="text-amber-400">Stale/Revalidated</span>
                          <span>1.7%</span>
                        </div>
                        <div className="h-4 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: "1.7%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* URL Table */}
              <Card className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/50">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Resource Path</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Hit Count</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {ANALYTICS_URLS.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[var(--color-surface-2)]/30 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)]">{entry.url}</td>
                        <td className="px-6 py-4 text-sm font-semibold">{entry.hits.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <Badge variant={entry.status === "hit" ? "success" : entry.status === "miss" ? "error" : "warning"}>
                            {entry.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            {[...Array(6)].map((_, i) => (
                              <div 
                                key={i} 
                                className="w-1 bg-[var(--color-surface-3)] rounded-full" 
                                style={{ height: `${Math.random() * 16 + 4}px` }} 
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
