import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "pages" | "geo" | "bots"

interface Endpoint {
  path: string
  requests: number
  avgMs: number
  errorRate: number
  trend: number[]
}

interface PageStat {
  url: string
  title: string
  requests: number
  avgTimeMs: number
  bounceRate: number
  trend: number[]
}

interface CountryStat {
  country: string
  code: string
  visits: number
  percentage: number
  trend: "up" | "down" | "stable"
}

interface BotEntry {
  name: string
  type: "crawler" | "scanner" | "social" | "monitor" | "malicious"
  requests: number
  lastSeen: string
  status: "allowed" | "blocked"
  ip: string
}

interface BlockedIP {
  ip: string
  reason: string
  requests: number
  firstSeen: string
  lastSeen: string
  status: "blocked" | "monitoring"
}

interface SuspiciousPattern {
  icon: string
  label: string
  severity: "high" | "medium" | "low"
  time: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ENDPOINTS: Endpoint[] = [
  { path: "/api/v2/users",         requests: 48291, avgMs: 45,  errorRate: 0.8, trend: [30, 35, 28, 42, 38, 45, 48] },
  { path: "/api/v2/products",      requests: 39284, avgMs: 62,  errorRate: 1.2, trend: [25, 30, 35, 28, 32, 38, 39] },
  { path: "/api/v2/orders",        requests: 28493, avgMs: 88,  errorRate: 2.1, trend: [20, 22, 25, 27, 24, 28, 28] },
  { path: "/api/v2/search",        requests: 24819, avgMs: 134, errorRate: 0.4, trend: [18, 20, 22, 24, 21, 23, 24] },
  { path: "/api/v2/auth/token",    requests: 19284, avgMs: 32,  errorRate: 3.8, trend: [15, 17, 16, 19, 18, 20, 19] },
  { path: "/api/v2/analytics",     requests: 14829, avgMs: 210, errorRate: 0.9, trend: [10, 12, 13, 14, 12, 14, 14] },
  { path: "/api/v2/notifications", requests: 11293, avgMs: 28,  errorRate: 0.2, trend: [8,  9,  10, 11, 10, 11, 11] },
  { path: "/health",               requests: 98201, avgMs: 4,   errorRate: 0.0, trend: [95, 96, 97, 98, 97, 98, 98] },
]

const PAGE_STATS: PageStat[] = [
  { url: "/dashboard",      title: "Dashboard",       requests: 84291, avgTimeMs: 320, bounceRate: 12.4, trend: [70, 75, 78, 80, 82, 83, 84] },
  { url: "/products",       title: "Products Catalog",requests: 61284, avgTimeMs: 450, bounceRate: 28.1, trend: [50, 54, 57, 59, 60, 61, 61] },
  { url: "/",               title: "Home",            requests: 58493, avgTimeMs: 280, bounceRate: 41.2, trend: [45, 48, 51, 54, 56, 57, 58] },
  { url: "/checkout",       title: "Checkout",        requests: 32819, avgTimeMs: 620, bounceRate: 18.7, trend: [25, 27, 29, 30, 31, 32, 32] },
  { url: "/account/profile",title: "Account Profile", requests: 28194, avgTimeMs: 380, bounceRate: 8.3,  trend: [22, 23, 24, 26, 27, 27, 28] },
  { url: "/blog",           title: "Blog",            requests: 24829, avgTimeMs: 290, bounceRate: 55.8, trend: [18, 19, 21, 22, 23, 24, 24] },
  { url: "/pricing",        title: "Pricing",         requests: 19203, avgTimeMs: 310, bounceRate: 35.4, trend: [14, 15, 16, 17, 18, 19, 19] },
  { url: "/docs",           title: "Documentation",   requests: 16842, avgTimeMs: 260, bounceRate: 22.1, trend: [12, 13, 14, 15, 16, 16, 16] },
  { url: "/settings",       title: "Settings",        requests: 13291, avgTimeMs: 410, bounceRate: 9.6,  trend: [10, 11, 11, 12, 13, 13, 13] },
  { url: "/login",          title: "Login",           requests: 12048, avgTimeMs: 240, bounceRate: 6.2,  trend: [9,  10, 11, 11, 12, 12, 12] },
]

const GEO_STATS: CountryStat[] = [
  { country: "United States", code: "US", visits: 284920, percentage: 38.2, trend: "up"     },
  { country: "United Kingdom",code: "GB", visits: 89201,  percentage: 11.9, trend: "up"     },
  { country: "Germany",       code: "DE", visits: 67492,  percentage: 9.0,  trend: "stable" },
  { country: "Canada",        code: "CA", visits: 52819,  percentage: 7.1,  trend: "up"     },
  { country: "France",        code: "FR", visits: 41203,  percentage: 5.5,  trend: "down"   },
  { country: "Japan",         code: "JP", visits: 38492,  percentage: 5.2,  trend: "up"     },
  { country: "Australia",     code: "AU", visits: 29841,  percentage: 4.0,  trend: "stable" },
  { country: "Netherlands",   code: "NL", visits: 24192,  percentage: 3.2,  trend: "up"     },
  { country: "Brazil",        code: "BR", visits: 19284,  percentage: 2.6,  trend: "down"   },
  { country: "India",         code: "IN", visits: 18291,  percentage: 2.5,  trend: "up"     },
  { country: "Sweden",        code: "SE", visits: 12849,  percentage: 1.7,  trend: "stable" },
  { country: "Singapore",     code: "SG", visits: 11203,  percentage: 1.5,  trend: "up"     },
]

const BOT_ENTRIES: BotEntry[] = [
  { name: "Googlebot",            type: "crawler",   requests: 48291, lastSeen: "2 min ago",  status: "allowed", ip: "66.249.66.1"    },
  { name: "Bingbot",              type: "crawler",   requests: 28194, lastSeen: "5 min ago",  status: "allowed", ip: "40.77.167.0"    },
  { name: "Twitterbot",           type: "social",    requests: 12049, lastSeen: "12 min ago", status: "allowed", ip: "199.16.156.0"   },
  { name: "facebookexternalhit",  type: "social",    requests: 9284,  lastSeen: "8 min ago",  status: "allowed", ip: "173.252.88.0"   },
  { name: "UptimeRobot",          type: "monitor",   requests: 7201,  lastSeen: "1 min ago",  status: "allowed", ip: "216.144.248.17" },
  { name: "SemrushBot",           type: "scanner",   requests: 5840,  lastSeen: "34 min ago", status: "allowed", ip: "149.205.202.0"  },
  { name: "AhrefsBot",            type: "scanner",   requests: 4829,  lastSeen: "1 hr ago",   status: "allowed", ip: "54.36.148.0"    },
  { name: "MJ12bot",              type: "scanner",   requests: 2948,  lastSeen: "2 hr ago",   status: "blocked", ip: "62.75.153.0"    },
  { name: "DotBot",               type: "scanner",   requests: 1829,  lastSeen: "3 hr ago",   status: "blocked", ip: "157.55.39.0"    },
  { name: "SuspiciousBot/1.0",    type: "malicious", requests: 8492,  lastSeen: "18 min ago", status: "blocked", ip: "185.220.101.0"  },
  { name: "VulnScanner",          type: "malicious", requests: 4201,  lastSeen: "45 min ago", status: "blocked", ip: "192.168.231.0"  },
]

const BLOCKED_IPS: BlockedIP[] = [
  { ip: "185.220.101.34", reason: "DDoS pattern",           requests: 28491, firstSeen: "2026-02-20", lastSeen: "5 min ago",  status: "blocked"    },
  { ip: "103.75.189.12",  reason: "SQL injection attempts", requests: 12048, firstSeen: "2026-02-21", lastSeen: "2 hr ago",   status: "blocked"    },
  { ip: "45.153.160.88",  reason: "Credential stuffing",    requests: 9284,  firstSeen: "2026-02-19", lastSeen: "6 hr ago",   status: "blocked"    },
  { ip: "192.42.116.204", reason: "Port scanning",          requests: 4829,  firstSeen: "2026-02-22", lastSeen: "22 min ago", status: "monitoring" },
  { ip: "77.247.181.162", reason: "Spam referrer",          requests: 3201,  firstSeen: "2026-02-18", lastSeen: "1 day ago",  status: "blocked"    },
  { ip: "198.144.121.93", reason: "Aggressive crawling",    requests: 2940,  firstSeen: "2026-02-21", lastSeen: "3 hr ago",   status: "monitoring" },
]

const SUSPICIOUS_PATTERNS: SuspiciousPattern[] = [
  { icon: "⚠️", label: "Rapid sequential requests from 185.220.101.x subnet",   severity: "high",   time: "Active now"  },
  { icon: "🔍", label: "Path traversal attempts on /api/v2/files endpoint",      severity: "high",   time: "18 min ago"  },
  { icon: "🤖", label: "Headless browser fingerprint detected (Puppeteer UA)",   severity: "medium", time: "42 min ago"  },
  { icon: "📊", label: "Unusual spike in /api/v2/auth/token error rate (3.8%)",  severity: "medium", time: "1 hr ago"    },
  { icon: "🌐", label: "Rotating proxy IPs matching known Tor exit node list",   severity: "low",    time: "2 hr ago"    },
]

const ERROR_RATE_TREND  = [1.2, 0.9, 0.8, 1.1, 2.8, 3.4, 2.1, 1.4, 0.9, 1.0, 0.8, 0.7, 0.9, 1.1, 1.3, 0.8, 0.9, 1.2, 1.8, 2.4, 1.9, 1.4, 1.1, 0.9]
const REQUEST_TREND     = [3200, 2800, 2400, 2100, 1900, 2200, 3800, 5200, 6800, 7400, 7800, 8200, 8400, 8100, 7900, 8300, 8600, 8900, 8400, 7800, 7200, 6400, 5200, 4800]
const BANDWIDTH_TREND   = [480, 420, 360, 320, 290, 330, 570, 780, 1020, 1110, 1170, 1230, 1260, 1215, 1185, 1245, 1290, 1335, 1260, 1170, 1080, 960, 780, 720]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SparkBar({
  values,
  color = "bg-indigo-500",
  height = "h-8",
}: {
  values: number[]
  color?: string
  height?: string
}) {
  const max = Math.max(...values)
  return (
    <div className={cn("flex items-end gap-px", height)}>
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm opacity-75 hover:opacity-100 transition-opacity", color)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function TrendArrow({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")     return <span className="text-emerald-400 text-xs font-bold">↑</span>
  if (trend === "down")   return <span className="text-rose-400   text-xs font-bold">↓</span>
  return                         <span className="text-zinc-400   text-xs font-bold">→</span>
}

function StatCard({
  label,
  value,
  sub,
  valueColor = "text-white",
}: {
  label: string
  value: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", valueColor)}>{value}</div>
      {sub && <div className="text-zinc-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

function BotTypeBadge({ type }: { type: BotEntry["type"] }) {
  const styleMap: Record<BotEntry["type"], string> = {
    crawler:   "bg-indigo-500/20 text-indigo-400  border-indigo-500/30",
    scanner:   "bg-amber-500/20  text-amber-400   border-amber-500/30",
    social:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    monitor:   "bg-zinc-500/20   text-zinc-400    border-zinc-500/30",
    malicious: "bg-rose-500/20   text-rose-400    border-rose-500/30",
  }
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", styleMap[type])}>
      {type}
    </span>
  )
}

function HourLabels() {
  return (
    <div className="flex justify-between text-zinc-600 text-xs mt-1 select-none">
      <span>00:00</span>
      <span>06:00</span>
      <span>12:00</span>
      <span>18:00</span>
      <span>23:00</span>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const maxReq = Math.max(...REQUEST_TREND)
  const maxBw  = Math.max(...BANDWIDTH_TREND)
  const maxErr = Math.max(...ERROR_RATE_TREND)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Requests / sec" value="8,924"   sub="↑ 12% from last hour"  valueColor="text-indigo-400"  />
        <StatCard label="Bandwidth"       value="1.34 GB/s" sub="↑ 8% from last hour" valueColor="text-emerald-400" />
        <StatCard label="Error Rate"      value="0.9%"    sub="↓ 0.3% from last hour" valueColor="text-amber-400"   />
        <StatCard label="P95 Latency"     value="142ms"   sub="↓ 18ms from last hour" />
      </div>

      {/* Time-series charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Requests / sec */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-white font-semibold text-sm">Requests / Second</div>
              <div className="text-zinc-500 text-xs">Last 24 hours</div>
            </div>
            <div className="text-indigo-400 font-bold text-lg tabular-nums">8,924</div>
          </div>
          <div className="flex items-end gap-0.5 h-24">
            {REQUEST_TREND.map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-indigo-500 rounded-sm opacity-75 hover:opacity-100 transition-opacity"
                style={{ height: `${Math.max(4, (v / maxReq) * 100)}%` }}
                title={`${v.toLocaleString()} req/s`}
              />
            ))}
          </div>
          <HourLabels />
        </div>

        {/* Bandwidth */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-white font-semibold text-sm">Bandwidth</div>
              <div className="text-zinc-500 text-xs">Last 24 hours (MB/s)</div>
            </div>
            <div className="text-emerald-400 font-bold text-lg tabular-nums">1.34 GB/s</div>
          </div>
          <div className="flex items-end gap-0.5 h-24">
            {BANDWIDTH_TREND.map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-emerald-500 rounded-sm opacity-75 hover:opacity-100 transition-opacity"
                style={{ height: `${Math.max(4, (v / maxBw) * 100)}%` }}
                title={`${v} MB/s`}
              />
            ))}
          </div>
          <HourLabels />
        </div>
      </div>

      {/* Error rate trend */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-white font-semibold text-sm">Error Rate Trend</div>
            <div className="text-zinc-500 text-xs">Last 24 hours (%)</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-400 text-xs">&lt; 1.5%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-zinc-400 text-xs">1.5 – 2.5%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-zinc-400 text-xs">&gt; 2.5%</span>
            </div>
            <span className="text-rose-400 font-bold tabular-nums ml-2">0.9%</span>
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-16">
          {ERROR_RATE_TREND.map((v, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-sm opacity-80 hover:opacity-100 transition-opacity",
                v > 2.5 ? "bg-rose-500" : v > 1.5 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ height: `${Math.max(4, (v / maxErr) * 100)}%` }}
              title={`${v}%`}
            />
          ))}
        </div>
        <HourLabels />
      </div>

      {/* Top endpoints */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="text-white font-semibold text-sm">Top Endpoints</div>
          <div className="text-zinc-500 text-xs">By request volume — 7-day sparkline</div>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-800/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-mono truncate">{ep.path}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-zinc-400 text-xs">{formatMs(ep.avgMs)} avg</span>
                  <span
                    className={cn(
                      "text-xs",
                      ep.errorRate > 2 ? "text-rose-400" : ep.errorRate > 1 ? "text-amber-400" : "text-emerald-400"
                    )}
                  >
                    {ep.errorRate}% err
                  </span>
                </div>
              </div>
              <div className="w-20 flex-shrink-0">
                <SparkBar values={ep.trend} height="h-7" />
              </div>
              <div className="text-zinc-200 font-semibold text-sm tabular-nums w-14 text-right flex-shrink-0">
                {formatNumber(ep.requests)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Top Pages Tab ────────────────────────────────────────────────────────────

type PageSortKey = "requests" | "avgTime" | "bounceRate"

function TopPagesTab() {
  const [sortBy, setSortBy] = useState<PageSortKey>("requests")

  const sorted = [...PAGE_STATS].sort((a, b) => {
    if (sortBy === "requests")   return b.requests   - a.requests
    if (sortBy === "avgTime")    return b.avgTimeMs  - a.avgTimeMs
    return b.bounceRate - a.bounceRate
  })

  const maxRequests = Math.max(...PAGE_STATS.map((p) => p.requests))

  const sortButtons: { key: PageSortKey; label: string }[] = [
    { key: "requests",   label: "Requests"    },
    { key: "avgTime",    label: "Avg Time"    },
    { key: "bounceRate", label: "Bounce Rate" },
  ]

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pageviews"  value="421K"   sub="last 24 hours"      />
        <StatCard label="Unique Sessions"  value="184K"   sub="last 24 hours"      />
        <StatCard label="Avg Load Time"    value="356ms"  sub="across all pages"   valueColor="text-emerald-400" />
        <StatCard label="Avg Bounce Rate"  value="23.8%"  sub="across all pages"   valueColor="text-amber-400"   />
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-white font-semibold text-sm">Page Statistics</div>
            <div className="text-zinc-500 text-xs">Top pages by traffic</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">Sort:</span>
            {sortButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                  sortBy === key
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="px-4 py-2 grid grid-cols-12 gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider border-b border-zinc-800/50 select-none">
          <div className="col-span-4">Page</div>
          <div className="col-span-2 text-right">Requests</div>
          <div className="col-span-2 text-right">Avg Time</div>
          <div className="col-span-2 text-right">Bounce</div>
          <div className="col-span-2">7d Trend</div>
        </div>

        <div className="divide-y divide-zinc-800/40">
          {sorted.map((page) => (
            <div
              key={page.url}
              className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-zinc-800/30 transition-colors"
            >
              <div className="col-span-4 min-w-0">
                <div className="text-white text-sm font-medium truncate">{page.title}</div>
                <div className="text-zinc-500 text-xs font-mono truncate">{page.url}</div>
              </div>
              <div className="col-span-2 text-right">
                <div className="text-zinc-200 text-sm tabular-nums font-medium">{formatNumber(page.requests)}</div>
                <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(page.requests / maxRequests) * 100}%` }}
                  />
                </div>
              </div>
              <div className="col-span-2 text-right">
                <span
                  className={cn(
                    "text-sm tabular-nums font-medium",
                    page.avgTimeMs > 800 ? "text-rose-400"
                    : page.avgTimeMs > 500 ? "text-amber-400"
                    : "text-zinc-200"
                  )}
                >
                  {formatMs(page.avgTimeMs)}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span
                  className={cn(
                    "text-sm tabular-nums font-medium",
                    page.bounceRate > 40 ? "text-rose-400"
                    : page.bounceRate > 25 ? "text-amber-400"
                    : "text-emerald-400"
                  )}
                >
                  {page.bounceRate}%
                </span>
              </div>
              <div className="col-span-2">
                <SparkBar values={page.trend} color="bg-indigo-500" height="h-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Geo Tab ──────────────────────────────────────────────────────────────────

function GeoTab() {
  const maxVisits  = Math.max(...GEO_STATS.map((g) => g.visits))
  const totalVisits = GEO_STATS.reduce((sum, g) => sum + g.visits, 0)

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Visits"   value={formatNumber(totalVisits)} sub="last 24 hours"    />
        <StatCard label="Countries"      value="68"          sub="active today"       valueColor="text-indigo-400"  />
        <StatCard label="Top Region"     value="N. America"  sub="50.1% of traffic"   />
        <StatCard label="New Regions"    value="+3"          sub="vs. yesterday"      valueColor="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-white font-semibold text-sm mb-0.5">Traffic by Country</div>
          <div className="text-zinc-500 text-xs mb-4">Top 12 — proportional bars</div>
          <div className="space-y-2.5">
            {GEO_STATS.map((stat) => (
              <div key={stat.code} className="flex items-center gap-3">
                <div className="text-zinc-400 text-xs w-7 font-mono font-medium text-center flex-shrink-0">
                  {stat.code}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-zinc-300 text-xs truncate">{stat.country}</span>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      <TrendArrow trend={stat.trend} />
                      <span className="text-zinc-500 text-xs tabular-nums">{stat.percentage}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(stat.visits / maxVisits) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-zinc-300 text-xs tabular-nums w-14 text-right font-medium flex-shrink-0">
                  {formatNumber(stat.visits)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ranked list */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="text-white font-semibold text-sm">Country Rankings</div>
            <div className="text-zinc-500 text-xs">Sorted by total visits</div>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {GEO_STATS.map((stat, idx) => (
              <div
                key={stat.code}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors"
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    idx === 0 ? "bg-amber-500/20  text-amber-400"  :
                    idx === 1 ? "bg-zinc-400/20   text-zinc-300"   :
                    idx === 2 ? "bg-orange-700/20 text-orange-500" :
                                "bg-zinc-800      text-zinc-500"
                  )}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{stat.country}</div>
                  <div className="text-zinc-500 text-xs">{stat.percentage}% of traffic</div>
                </div>
                <TrendArrow trend={stat.trend} />
                <div className="text-zinc-300 text-sm tabular-nums font-medium flex-shrink-0">
                  {formatNumber(stat.visits)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bots Tab ─────────────────────────────────────────────────────────────────

type BotFilter = "all" | "allowed" | "blocked"

function BotsTab() {
  const [botStatuses, setBotStatuses] = useState<Record<string, "allowed" | "blocked">>(
    Object.fromEntries(BOT_ENTRIES.map((b): [string, "allowed" | "blocked"] => [b.name, b.status]))
  )
  const [ipStatuses, setIpStatuses] = useState<Record<string, "blocked" | "monitoring">>(
    Object.fromEntries(BLOCKED_IPS.map((entry): [string, "blocked" | "monitoring"] => [entry.ip, entry.status]))
  )
  const [botFilter, setBotFilter] = useState<BotFilter>("all")

  const toggleBot = (name: string) => {
    setBotStatuses((prev) => ({
      ...prev,
      [name]: prev[name] === "allowed" ? "blocked" : "allowed",
    }))
  }

  const toggleIP = (ip: string) => {
    setIpStatuses((prev) => ({
      ...prev,
      [ip]: prev[ip] === "blocked" ? "monitoring" : "blocked",
    }))
  }

  const filteredBots = BOT_ENTRIES.filter((b) => {
    if (botFilter === "all") return true
    return botStatuses[b.name] === botFilter
  })

  const totalBotReqs   = BOT_ENTRIES.reduce((sum, b) => sum + b.requests, 0)
  const blockedBotReqs = BOT_ENTRIES
    .filter((b) => botStatuses[b.name] === "blocked")
    .reduce((sum, b) => sum + b.requests, 0)

  const filterOptions: BotFilter[] = ["all", "allowed", "blocked"]

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bot Requests"     value={formatNumber(totalBotReqs)}   sub="last 24 hours"     valueColor="text-amber-400"   />
        <StatCard label="Blocked Requests" value={formatNumber(blockedBotReqs)} sub="actively blocked"  valueColor="text-rose-400"    />
        <StatCard label="Suspicious IPs"   value={String(BLOCKED_IPS.length)}   sub="being tracked"     valueColor="text-amber-400"   />
        <StatCard label="Bot Traffic %"    value="14.2%"                         sub="of total traffic"  />
      </div>

      {/* Known bots */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-white font-semibold text-sm">Known Bots</div>
            <div className="text-zinc-500 text-xs">Detected user agents with allow/block controls</div>
          </div>
          <div className="flex items-center gap-2">
            {filterOptions.map((f) => (
              <button
                key={f}
                onClick={() => setBotFilter(f)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg border capitalize transition-colors",
                  botFilter === f
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="px-4 py-2 grid grid-cols-12 gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider border-b border-zinc-800/50 select-none">
          <div className="col-span-3">Bot Name</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">IP</div>
          <div className="col-span-2 text-right">Requests</div>
          <div className="col-span-2 text-center">Last Seen</div>
          <div className="col-span-1 text-center">Action</div>
        </div>

        <div className="divide-y divide-zinc-800/40">
          {filteredBots.map((bot) => {
            const status = botStatuses[bot.name] ?? bot.status
            return (
              <div
                key={bot.name}
                className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-zinc-800/30 transition-colors"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      status === "allowed" ? "bg-emerald-400" : "bg-rose-400"
                    )}
                  />
                  <span className="text-white text-sm truncate">{bot.name}</span>
                </div>
                <div className="col-span-2">
                  <BotTypeBadge type={bot.type} />
                </div>
                <div className="col-span-2 text-zinc-400 text-xs font-mono truncate">{bot.ip}</div>
                <div className="col-span-2 text-right text-zinc-300 text-sm tabular-nums font-medium">
                  {formatNumber(bot.requests)}
                </div>
                <div className="col-span-2 text-center text-zinc-500 text-xs">{bot.lastSeen}</div>
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => toggleBot(bot.name)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium",
                      status === "allowed"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    )}
                  >
                    {status === "allowed" ? "Block" : "Allow"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Suspicious / blocked IPs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="text-white font-semibold text-sm">Suspicious IPs</div>
          <div className="text-zinc-500 text-xs">Flagged for active blocking or monitoring</div>
        </div>

        {/* Table header */}
        <div className="px-4 py-2 grid grid-cols-12 gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider border-b border-zinc-800/50 select-none">
          <div className="col-span-3">IP Address</div>
          <div className="col-span-3">Reason</div>
          <div className="col-span-2 text-right">Requests</div>
          <div className="col-span-2">First Seen</div>
          <div className="col-span-1">Last Seen</div>
          <div className="col-span-1 text-center">Action</div>
        </div>

        <div className="divide-y divide-zinc-800/40">
          {BLOCKED_IPS.map((entry) => {
            const status = ipStatuses[entry.ip] ?? entry.status
            return (
              <div
                key={entry.ip}
                className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-zinc-800/30 transition-colors"
              >
                <div className="col-span-3 flex items-center gap-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      status === "blocked" ? "bg-rose-400" : "bg-amber-400"
                    )}
                  />
                  <span className="text-white text-sm font-mono">{entry.ip}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-zinc-400 text-xs">{entry.reason}</span>
                </div>
                <div className="col-span-2 text-right text-zinc-300 text-sm tabular-nums font-medium">
                  {formatNumber(entry.requests)}
                </div>
                <div className="col-span-2 text-zinc-500 text-xs">{entry.firstSeen}</div>
                <div className="col-span-1 text-zinc-500 text-xs">{entry.lastSeen}</div>
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => toggleIP(entry.ip)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-lg border transition-colors font-medium",
                      status === "blocked"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                    )}
                  >
                    {status === "blocked" ? "Watch" : "Block"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Suspicious patterns */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-white font-semibold text-sm mb-0.5">Suspicious Patterns Detected</div>
        <div className="text-zinc-500 text-xs mb-3">Automated anomaly detection — live feed</div>
        <div className="space-y-2">
          {SUSPICIOUS_PATTERNS.map((pattern, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                pattern.severity === "high"
                  ? "bg-rose-500/5 border-rose-500/20"
                  : pattern.severity === "medium"
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-zinc-800/40 border-zinc-700"
              )}
            >
              <span className="text-base flex-shrink-0 mt-0.5 select-none">{pattern.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-zinc-200 text-sm leading-snug">{pattern.label}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border font-medium",
                    pattern.severity === "high"
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : pattern.severity === "medium"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-zinc-700 text-zinc-400 border-zinc-600"
                  )}
                >
                  {pattern.severity}
                </span>
                <span className="text-zinc-500 text-xs whitespace-nowrap">{pattern.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrafficAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview")

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview",  icon: "📊" },
    { id: "pages",    label: "Top Pages", icon: "📄" },
    { id: "geo",      label: "Geo",       icon: "🌍" },
    { id: "bots",     label: "Bots",      icon: "🤖" },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 p-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Live</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Traffic Analytics</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Real-time web traffic monitoring and analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="text-zinc-500 text-xs">Last updated</div>
            <div className="text-white text-sm font-medium tabular-nums">Just now</div>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl border border-indigo-500 transition-colors font-medium">
            Export
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            )}
          >
            <span className="select-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "pages"    && <TopPagesTab />}
      {activeTab === "geo"      && <GeoTab />}
      {activeTab === "bots"     && <BotsTab />}
    </div>
  )
}
