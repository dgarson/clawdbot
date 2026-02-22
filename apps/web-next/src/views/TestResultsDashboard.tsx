import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type TestStatus = "passed" | "failed" | "skipped"
type SuiteStatus = "success" | "failed" | "partial"
type ActiveTab = "latest" | "flaky" | "coverage" | "history"

interface TestCase {
  id: string
  name: string
  duration: number
  status: TestStatus
  errorMessage?: string
}

interface TestSuite {
  id: string
  name: string
  tests: number
  passed: number
  failed: number
  skipped: number
  duration: number
  status: SuiteStatus
  testCases: TestCase[]
}

interface FlakyTest {
  id: string
  name: string
  suite: string
  flakinessRate: number
  recentAttempts: boolean[]
  lastFailure: string
  lastPass: string
  suggestedAction: string
}

interface CoverageModule {
  id: string
  module: string
  line: number
  branch: number
  func: number
  statement: number
  change: number
}

interface BuildCoverage {
  build: string
  coverage: number
}

interface HistoryRun {
  id: string
  runId: string
  branch: string
  commit: string
  started: string
  duration: number
  passed: number
  failed: number
  skipped: number
  triggeredBy: string
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const testSuites: TestSuite[] = [
  {
    id: "s1",
    name: "AuthService",
    tests: 42,
    passed: 40,
    failed: 2,
    skipped: 0,
    duration: 28,
    status: "failed",
    testCases: [
      { id: "t1", name: "should authenticate with valid credentials", duration: 120, status: "passed" },
      { id: "t2", name: "should reject invalid password with 401", duration: 95, status: "passed" },
      { id: "t3", name: "should handle token expiry gracefully", duration: 210, status: "failed", errorMessage: "Expected token refresh but received 401 Unauthorized after 3000ms timeout" },
      { id: "t4", name: "should revoke session on explicit logout", duration: 88, status: "passed" },
      { id: "t5", name: "should enforce MFA on sensitive actions", duration: 134, status: "failed", errorMessage: "MFA bypass detected: verification step skipped for role=admin on /settings/billing" },
      { id: "t6", name: "should rate limit login to 5 attempts/min", duration: 156, status: "passed" },
      { id: "t7", name: "should persist session across browser tabs", duration: 203, status: "passed" },
    ],
  },
  {
    id: "s2",
    name: "UserDashboard",
    tests: 67,
    passed: 61,
    failed: 4,
    skipped: 2,
    duration: 51,
    status: "failed",
    testCases: [
      { id: "t8", name: "renders user profile header with avatar", duration: 45, status: "passed" },
      { id: "t9", name: "displays activity feed in reverse-chron order", duration: 67, status: "passed" },
      { id: "t10", name: "shows empty state placeholder when no data", duration: 33, status: "passed" },
      { id: "t11", name: "pagination shows correct items on page 3", duration: 189, status: "failed", errorMessage: "Page 3 returns duplicates — offset calculation error (items 40-59 returned twice)" },
      { id: "t12", name: "combined filter: status:active + role:admin", duration: 77, status: "failed", errorMessage: "Filter combination yields 0 results; expected 14 matching users in test dataset" },
      { id: "t13", name: "CSV export includes all 24 data columns", duration: 112, status: "passed" },
      { id: "t14", name: "realtime updates arrive via WebSocket feed", duration: 340, status: "skipped" },
      { id: "t15", name: "avatar upload rejects non-image MIME types", duration: 88, status: "passed" },
    ],
  },
  {
    id: "s3",
    name: "PaymentGateway",
    tests: 89,
    passed: 82,
    failed: 7,
    skipped: 0,
    duration: 72,
    status: "failed",
    testCases: [
      { id: "t16", name: "processes Stripe charge for valid card", duration: 450, status: "passed" },
      { id: "t17", name: "returns user-friendly error on card decline", duration: 380, status: "passed" },
      { id: "t18", name: "retries payment on transient 503 error", duration: 890, status: "failed", errorMessage: "Max retry attempts (3) exceeded — mock returned 5 retry invocations unexpectedly" },
      { id: "t19", name: "validates Luhn algorithm for card number", duration: 55, status: "passed" },
      { id: "t20", name: "SAVE20 promo reduces order total by 20%", duration: 134, status: "failed", errorMessage: "Promo applied but total shows $99.99 instead of expected $79.99" },
      { id: "t21", name: "payment.completed event emitted after capture", duration: 210, status: "passed" },
      { id: "t22", name: "refund flow completes within 48hr SLA", duration: 670, status: "passed" },
      { id: "t23", name: "all transactions written to audit log", duration: 145, status: "passed" },
    ],
  },
  {
    id: "s4",
    name: "NotificationService",
    tests: 49,
    passed: 36,
    failed: 5,
    skipped: 8,
    duration: 33,
    status: "partial",
    testCases: [
      { id: "t24", name: "sends welcome email within 30s of signup", duration: 230, status: "passed" },
      { id: "t25", name: "batches digest emails to single daily send", duration: 180, status: "passed" },
      { id: "t26", name: "respects marketing opt-out preference", duration: 90, status: "failed", errorMessage: "User with marketing_opt_out=true received PROMO-2026-Q1 campaign blast" },
      { id: "t27", name: "unsubscribe link removes from all lists", duration: 110, status: "passed" },
      { id: "t28", name: "FCM push notification delivered on mobile", duration: 440, status: "skipped" },
      { id: "t29", name: "retries email send on SMTP 421 response", duration: 320, status: "passed" },
      { id: "t30", name: "open tracking pixel endpoint returns 200", duration: 78, status: "failed", errorMessage: "GET /track/pixel/open → 404 Not Found (route not registered in express app)" },
    ],
  },
]

const latestRunMeta = {
  branch: "feat/horizon-admin",
  repo: "dgarson/clawdbot",
  runId: "run-4892",
  total: 247,
  passed: 219,
  failed: 18,
  skipped: 10,
  duration: 184,
}

const flakyTests: FlakyTest[] = [
  { id: "f1", name: "retries payment on transient 503 error", suite: "PaymentGateway", flakinessRate: 82, recentAttempts: [false, true, false, false, true, false, true, false, false, true], lastFailure: "Feb 22, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Add deterministic retry mock" },
  { id: "f2", name: "realtime updates arrive via WebSocket feed", suite: "UserDashboard", flakinessRate: 74, recentAttempts: [true, false, true, false, false, true, false, false, true, false], lastFailure: "Feb 22, 2026", lastPass: "Feb 21, 2026", suggestedAction: "Mock WS server in tests" },
  { id: "f3", name: "FCM push notification delivered on mobile", suite: "NotificationService", flakinessRate: 68, recentAttempts: [false, false, true, false, true, false, true, true, false, false], lastFailure: "Feb 21, 2026", lastPass: "Feb 21, 2026", suggestedAction: "Stub FCM client entirely" },
  { id: "f4", name: "should handle token expiry gracefully", suite: "AuthService", flakinessRate: 61, recentAttempts: [true, false, true, true, false, false, true, false, true, false], lastFailure: "Feb 22, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Use fake timers for JWT expiry" },
  { id: "f5", name: "pagination shows correct items on page 3", suite: "UserDashboard", flakinessRate: 55, recentAttempts: [true, true, false, true, false, true, false, false, true, false], lastFailure: "Feb 22, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Seed deterministic dataset" },
  { id: "f6", name: "refund flow completes within 48hr SLA", suite: "PaymentGateway", flakinessRate: 48, recentAttempts: [true, false, true, true, true, false, true, false, true, false], lastFailure: "Feb 20, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Mock time assertions with jest.useFakeTimers" },
  { id: "f7", name: "batches digest emails to single daily send", suite: "NotificationService", flakinessRate: 43, recentAttempts: [true, true, false, true, true, true, false, true, false, true], lastFailure: "Feb 21, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Fix scheduler race condition" },
  { id: "f8", name: "combined filter: status:active + role:admin", suite: "UserDashboard", flakinessRate: 39, recentAttempts: [true, true, true, false, true, false, true, true, false, true], lastFailure: "Feb 19, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Investigate query planner caching" },
  { id: "f9", name: "rate limit recovers after 60s window reset", suite: "AuthService", flakinessRate: 33, recentAttempts: [true, true, false, true, true, true, false, true, true, false], lastFailure: "Feb 18, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Use fake timers for window reset" },
  { id: "f10", name: "Stripe webhook signature verification", suite: "PaymentGateway", flakinessRate: 27, recentAttempts: [true, true, true, false, true, true, true, false, true, true], lastFailure: "Feb 17, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Pin webhook timestamp in fixture" },
  { id: "f11", name: "unsubscribe removes from all segment lists", suite: "NotificationService", flakinessRate: 21, recentAttempts: [true, true, true, true, false, true, true, true, false, true], lastFailure: "Feb 16, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Await all segment sync promises" },
  { id: "f12", name: "audit log entry on permission change", suite: "AuthService", flakinessRate: 14, recentAttempts: [true, true, true, true, true, false, true, true, true, true], lastFailure: "Feb 14, 2026", lastPass: "Feb 22, 2026", suggestedAction: "Flush DB transaction before assert" },
]

const coverageModules: CoverageModule[] = [
  { id: "m1", module: "auth/", line: 91.4, branch: 84.2, func: 93.1, statement: 90.7, change: 2.1 },
  { id: "m2", module: "api/routes/", line: 78.9, branch: 68.5, func: 81.2, statement: 79.4, change: -1.3 },
  { id: "m3", module: "components/ui/", line: 95.2, branch: 89.7, func: 96.4, statement: 94.8, change: 0.6 },
  { id: "m4", module: "services/payment/", line: 82.7, branch: 71.3, func: 85.0, statement: 83.1, change: 3.4 },
  { id: "m5", module: "services/notifications/", line: 69.3, branch: 58.1, func: 72.8, statement: 70.2, change: -2.7 },
  { id: "m6", module: "utils/", line: 97.6, branch: 94.1, func: 98.3, statement: 97.2, change: 0.2 },
]

const buildHistory: BuildCoverage[] = [
  { build: "#4885", coverage: 81.2 },
  { build: "#4886", coverage: 80.8 },
  { build: "#4887", coverage: 82.4 },
  { build: "#4888", coverage: 81.9 },
  { build: "#4889", coverage: 83.1 },
  { build: "#4890", coverage: 82.7 },
  { build: "#4891", coverage: 84.3 },
  { build: "#4892", coverage: 85.7 },
]

const historyRuns: HistoryRun[] = [
  { id: "h1", runId: "#4892", branch: "feat/horizon-admin", commit: "a3f9c21", started: "Feb 22, 05:04", duration: 184, passed: 219, failed: 18, skipped: 10, triggeredBy: "push" },
  { id: "h2", runId: "#4891", branch: "feat/horizon-admin", commit: "b1e7d44", started: "Feb 21, 23:47", duration: 177, passed: 224, failed: 13, skipped: 10, triggeredBy: "push" },
  { id: "h3", runId: "#4890", branch: "fix/payment-retry", commit: "c9a2f83", started: "Feb 21, 18:22", duration: 201, passed: 211, failed: 26, skipped: 10, triggeredBy: "push" },
  { id: "h4", runId: "#4889", branch: "feat/horizon-admin", commit: "d4b5e19", started: "Feb 21, 14:05", duration: 169, passed: 231, failed: 6, skipped: 10, triggeredBy: "schedule" },
  { id: "h5", runId: "#4888", branch: "main", commit: "e7c3a56", started: "Feb 21, 08:00", duration: 182, passed: 228, failed: 9, skipped: 10, triggeredBy: "schedule" },
  { id: "h6", runId: "#4887", branch: "feat/notif-batching", commit: "f2d8b91", started: "Feb 20, 22:31", duration: 195, passed: 215, failed: 22, skipped: 10, triggeredBy: "push" },
  { id: "h7", runId: "#4886", branch: "main", commit: "g5e1c74", started: "Feb 20, 16:15", duration: 174, passed: 233, failed: 4, skipped: 10, triggeredBy: "schedule" },
  { id: "h8", runId: "#4885", branch: "fix/auth-mfa", commit: "h8f4d02", started: "Feb 20, 10:48", duration: 188, passed: 209, failed: 28, skipped: 10, triggeredBy: "push" },
  { id: "h9", runId: "#4884", branch: "main", commit: "i3b7e65", started: "Feb 20, 08:00", duration: 171, passed: 236, failed: 1, skipped: 10, triggeredBy: "schedule" },
  { id: "h10", runId: "#4883", branch: "feat/user-dashboard", commit: "j6c9f38", started: "Feb 19, 21:03", duration: 193, passed: 220, failed: 17, skipped: 10, triggeredBy: "push" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) {return `${seconds}s`}
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatMs(ms: number): string {
  if (ms < 1000) {return `${ms}ms`}
  return `${(ms / 1000).toFixed(1)}s`
}

function statusIcon(status: TestStatus | SuiteStatus): string {
  if (status === "passed" || status === "success") {return "✓"}
  if (status === "failed") {return "✗"}
  if (status === "skipped") {return "–"}
  if (status === "partial") {return "◐"}
  return "?"
}

function statusTextColor(status: TestStatus | SuiteStatus): string {
  if (status === "passed" || status === "success") {return "text-emerald-400"}
  if (status === "failed") {return "text-rose-400"}
  if (status === "skipped") {return "text-zinc-400"}
  if (status === "partial") {return "text-amber-400"}
  return "text-zinc-400"
}

function coverageColor(pct: number, threshold: number): string {
  if (pct >= threshold + 5) {return "text-emerald-400"}
  if (pct >= threshold) {return "text-emerald-400"}
  if (pct >= threshold - 5) {return "text-amber-400"}
  return "text-rose-400"
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TestResultsDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("latest")
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [selectedBranch, setSelectedBranch] = useState("feat/horizon-admin")

  const tabs: Array<{ id: ActiveTab; label: string; badge?: number }> = [
    { id: "latest", label: "Latest Run" },
    { id: "flaky", label: "Flaky Tests", badge: flakyTests.filter(t => t.flakinessRate >= 50).length },
    { id: "coverage", label: "Coverage" },
    { id: "history", label: "History" },
  ]

  function toggleSuite(id: string) {
    setExpandedSuites(prev => {
      const next = new Set(prev)
      if (next.has(id)) {next.delete(id)}
      else {next.add(id)}
      return next
    })
  }

  function toggleHistory(id: string) {
    setExpandedHistory(prev => {
      const next = new Set(prev)
      if (next.has(id)) {next.delete(id)}
      else {next.add(id)}
      return next
    })
  }

  // ── Tab 1: Latest Run ──────────────────────────────────────────────────────

  const renderLatest = () => {
    const passRate = ((latestRunMeta.passed / latestRunMeta.total) * 100).toFixed(1)
    const failPct = (latestRunMeta.failed / latestRunMeta.total) * 100
    const passPct = (latestRunMeta.passed / latestRunMeta.total) * 100
    const skipPct = (latestRunMeta.skipped / latestRunMeta.total) * 100

    return (
      <div className="space-y-5">
        {/* Branch picker */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-zinc-400 text-sm">Branch:</span>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-3 py-1.5 outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="feat/horizon-admin">feat/horizon-admin</option>
            <option value="main">main</option>
            <option value="fix/payment-retry">fix/payment-retry</option>
            <option value="fix/auth-mfa">fix/auth-mfa</option>
          </select>
          <span className="text-zinc-500 text-xs font-mono">
            {latestRunMeta.runId} · {latestRunMeta.repo}
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Tests", value: String(latestRunMeta.total), color: "text-white", icon: "◎" },
            { label: "Passed", value: String(latestRunMeta.passed), color: "text-emerald-400", icon: "✓" },
            { label: "Failed", value: String(latestRunMeta.failed), color: "text-rose-400", icon: "✗" },
            { label: "Skipped", value: String(latestRunMeta.skipped), color: "text-zinc-400", icon: "–" },
            { label: "Duration", value: formatDuration(latestRunMeta.duration), color: "text-indigo-400", icon: "⏱" },
          ].map(card => (
            <div key={card.label} className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn("text-xs", card.color)}>{card.icon}</span>
                <span className="text-zinc-400 text-xs">{card.label}</span>
              </div>
              <div className={cn("text-2xl font-bold tabular-nums", card.color)}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Pass rate bar */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-zinc-400">Pass rate</span>
            <span className="text-white font-semibold">{passRate}%</span>
          </div>
          <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden flex">
            <div className="bg-emerald-400 h-full transition-all" style={{ width: `${passPct}%` }} />
            <div className="bg-rose-400 h-full transition-all" style={{ width: `${failPct}%` }} />
            <div className="bg-zinc-600 h-full transition-all" style={{ width: `${skipPct}%` }} />
          </div>
          <div className="flex gap-5 mt-2.5 text-xs">
            {[
              { color: "bg-emerald-400", label: `Passed (${latestRunMeta.passed})` },
              { color: "bg-rose-400", label: `Failed (${latestRunMeta.failed})` },
              { color: "bg-zinc-600", label: `Skipped (${latestRunMeta.skipped})` },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-1.5 text-zinc-400">
                <span className={cn("w-2 h-2 rounded-full inline-block", item.color)} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Test suites table */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <h3 className="text-white font-medium text-sm">Test Suites</h3>
            <span className="text-zinc-500 text-xs">{testSuites.length} suites · click to expand</span>
          </div>
          {/* Column headers */}
          <div className="grid grid-cols-12 px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800">
            <span className="col-span-4">Suite</span>
            <span className="col-span-1 text-right">Tests</span>
            <span className="col-span-2 text-right text-emerald-400/60">Passed</span>
            <span className="col-span-2 text-right text-rose-400/60">Failed</span>
            <span className="col-span-1 text-right">Duration</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {testSuites.map(suite => (
              <div key={suite.id}>
                <button
                  onClick={() => toggleSuite(suite.id)}
                  className="w-full grid grid-cols-12 px-4 py-3.5 text-sm hover:bg-zinc-800/50 transition-colors text-left items-center"
                >
                  <span className="col-span-4 flex items-center gap-2 text-white font-medium">
                    <span className="text-zinc-500 text-xs w-3">{expandedSuites.has(suite.id) ? "▼" : "▶"}</span>
                    {suite.name}
                  </span>
                  <span className="col-span-1 text-right text-zinc-300 tabular-nums">{suite.tests}</span>
                  <span className="col-span-2 text-right text-emerald-400 tabular-nums">{suite.passed}</span>
                  <span className={cn("col-span-2 text-right tabular-nums", suite.failed > 0 ? "text-rose-400" : "text-zinc-500")}>
                    {suite.failed}
                  </span>
                  <span className="col-span-1 text-right text-zinc-400 text-xs">{formatDuration(suite.duration)}</span>
                  <span className={cn("col-span-2 text-right text-xs font-semibold", statusTextColor(suite.status))}>
                    {statusIcon(suite.status)} {suite.status}
                  </span>
                </button>

                {expandedSuites.has(suite.id) && (
                  <div className="bg-zinc-950/60 border-t border-zinc-800">
                    <div className="grid grid-cols-12 px-8 py-2 text-xs text-zinc-500 border-b border-zinc-800/50">
                      <span className="col-span-6">Test Case</span>
                      <span className="col-span-2 text-right">Duration</span>
                      <span className="col-span-4 text-right">Status</span>
                    </div>
                    <div className="divide-y divide-zinc-800/40">
                      {suite.testCases.map(tc => (
                        <div key={tc.id} className="px-8 py-2.5">
                          <div className="grid grid-cols-12 text-xs items-start">
                            <span className="col-span-6 text-zinc-300 leading-relaxed pr-2">{tc.name}</span>
                            <span className="col-span-2 text-right text-zinc-500 tabular-nums">{formatMs(tc.duration)}</span>
                            <span className={cn("col-span-4 text-right font-semibold", statusTextColor(tc.status))}>
                              {statusIcon(tc.status)} {tc.status}
                            </span>
                          </div>
                          {tc.errorMessage && (
                            <div className="mt-2 bg-rose-950/40 border border-rose-900/50 rounded px-3 py-2 text-xs text-rose-300 font-mono leading-relaxed">
                              {tc.errorMessage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab 2: Flaky Tests ─────────────────────────────────────────────────────

  const renderFlaky = () => {
    const highSeverity = flakyTests.filter(t => t.flakinessRate >= 50).length
    const medSeverity = flakyTests.filter(t => t.flakinessRate >= 25 && t.flakinessRate < 50).length

    return (
      <div className="space-y-5">
        {/* Summary banner */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-rose-400/10 border border-rose-400/20 text-rose-400 text-xs px-3 py-1.5 rounded-md">
            ✗ {highSeverity} high severity (≥50%)
          </div>
          <div className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs px-3 py-1.5 rounded-md">
            ⚠ {medSeverity} medium severity (25–49%)
          </div>
          <div className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs px-3 py-1.5 rounded-md">
            {flakyTests.length - highSeverity - medSeverity} low severity (&lt;25%)
          </div>
          <span className="text-zinc-500 text-xs ml-auto">Sorted by flakiness rate ↓</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 text-xs text-zinc-500 border-b border-zinc-700">
            <span className="col-span-3">Test Name</span>
            <span className="col-span-2">Suite</span>
            <span className="col-span-1 text-right">Flakiness</span>
            <span className="col-span-2 text-center">Last 10 Runs</span>
            <span className="col-span-1 text-right">Last Fail</span>
            <span className="col-span-1 text-right">Last Pass</span>
            <span className="col-span-2 text-right">Suggested Fix</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {flakyTests.map(test => {
              const severity =
                test.flakinessRate >= 70 ? "text-rose-400" :
                test.flakinessRate >= 40 ? "text-amber-400" :
                "text-zinc-300"

              return (
                <div
                  key={test.id}
                  className="grid grid-cols-12 px-4 py-3.5 text-xs hover:bg-zinc-800/30 transition-colors items-center"
                >
                  <span className="col-span-3 text-zinc-300 leading-relaxed pr-2">{test.name}</span>
                  <span className="col-span-2 text-zinc-400 pr-1">{test.suite}</span>
                  <div className="col-span-1 flex justify-end">
                    <span className={cn("font-bold text-sm tabular-nums", severity)}>
                      {test.flakinessRate}%
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-center gap-0.5 flex-wrap">
                    {test.recentAttempts.map((pass, idx) => (
                      <div
                        key={idx}
                        title={pass ? "pass" : "fail"}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full flex-shrink-0",
                          pass ? "bg-emerald-400" : "bg-rose-400"
                        )}
                      />
                    ))}
                  </div>
                  <span className="col-span-1 text-right text-zinc-500 tabular-nums">
                    {test.lastFailure.slice(4, 10)}
                  </span>
                  <span className="col-span-1 text-right text-zinc-500 tabular-nums">
                    {test.lastPass.slice(4, 10)}
                  </span>
                  <div className="col-span-2 flex justify-end">
                    <span className="bg-zinc-800 border border-zinc-700 text-indigo-400 rounded px-2 py-1 text-xs leading-tight text-right">
                      {test.suggestedAction}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab 3: Coverage ────────────────────────────────────────────────────────

  const renderCoverage = () => {
    const overall = 85.7
    const threshold = 80
    const minCoverage = 79
    const maxCoverage = 87

    return (
      <div className="space-y-5">
        {/* Threshold indicator cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Overall Coverage", value: `${overall}%`, threshold: `≥ ${threshold}%`, passing: overall >= threshold },
            { label: "Line Coverage", value: "85.8%", threshold: "≥ 80%", passing: true },
            { label: "Branch Coverage", value: "77.7%", threshold: "≥ 75%", passing: true },
            { label: "Function Coverage", value: "87.8%", threshold: "≥ 80%", passing: true },
          ].map(card => (
            <div
              key={card.label}
              className={cn(
                "bg-zinc-900 rounded-lg p-4 border",
                card.passing ? "border-emerald-700/40" : "border-rose-700/40"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-zinc-400 text-xs leading-tight">{card.label}</span>
                <span className={cn("text-xs font-semibold", card.passing ? "text-emerald-400" : "text-rose-400")}>
                  {card.passing ? "✓ OK" : "✗ FAIL"}
                </span>
              </div>
              <div className={cn("text-2xl font-bold tabular-nums", card.passing ? "text-emerald-400" : "text-rose-400")}>
                {card.value}
              </div>
              <div className="text-zinc-500 text-xs mt-1">Threshold: {card.threshold}</div>
            </div>
          ))}
        </div>

        {/* Coverage trend bar chart */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white text-sm font-medium">Coverage Trend — Last 8 Builds</h3>
            <span className="text-zinc-500 text-xs">Overall line coverage %</span>
          </div>
          {/* Y-axis labels + threshold line hint */}
          <div className="text-xs text-zinc-500 mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-amber-400/50 inline-block" />
            <span className="text-amber-400/70">80% threshold</span>
          </div>
          {/* Bar chart */}
          <div className="flex items-end gap-2" style={{ height: "120px" }}>
            {buildHistory.map(b => {
              const isLatest = b.build === "#4892"
              // Normalize bar height within visible range min–max for visual clarity
              const normalized = ((b.coverage - minCoverage) / (maxCoverage - minCoverage)) * 100
              const barH = Math.max(normalized, 8)

              return (
                <div key={b.build} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className={cn("text-xs tabular-nums", isLatest ? "text-indigo-400 font-semibold" : "text-zinc-500")}>
                    {b.coverage}%
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      isLatest ? "bg-indigo-500" : "bg-indigo-500/30 hover:bg-indigo-500/50"
                    )}
                    style={{ height: `${barH}%` }}
                  />
                  <span className={cn("text-xs truncate w-full text-center", isLatest ? "text-indigo-400" : "text-zinc-600")}>
                    {b.build}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Module breakdown table */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700">
            <h3 className="text-white font-medium text-sm">Coverage by Module</h3>
          </div>
          <div className="grid grid-cols-12 px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800">
            <span className="col-span-3">Module</span>
            <span className="col-span-2 text-right">Line%</span>
            <span className="col-span-2 text-right">Branch%</span>
            <span className="col-span-2 text-right">Function%</span>
            <span className="col-span-2 text-right">Statement%</span>
            <span className="col-span-1 text-right">Δ</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {coverageModules.map(mod => (
              <div key={mod.id} className="grid grid-cols-12 px-4 py-3 hover:bg-zinc-800/30 transition-colors items-center">
                <span className="col-span-3 font-mono text-zinc-300 text-xs">{mod.module}</span>
                <span className={cn("col-span-2 text-right text-xs tabular-nums font-medium", coverageColor(mod.line, threshold))}>
                  {mod.line}%
                </span>
                <span className={cn("col-span-2 text-right text-xs tabular-nums font-medium", coverageColor(mod.branch, 75))}>
                  {mod.branch}%
                </span>
                <span className={cn("col-span-2 text-right text-xs tabular-nums font-medium", coverageColor(mod.func, threshold))}>
                  {mod.func}%
                </span>
                <span className={cn("col-span-2 text-right text-xs tabular-nums font-medium", coverageColor(mod.statement, threshold))}>
                  {mod.statement}%
                </span>
                <span className={cn(
                  "col-span-1 text-right text-xs font-semibold tabular-nums",
                  mod.change > 0 ? "text-emerald-400" : mod.change < 0 ? "text-rose-400" : "text-zinc-500"
                )}>
                  {mod.change > 0 ? "↑" : mod.change < 0 ? "↓" : "–"}
                  {mod.change !== 0 ? ` ${Math.abs(mod.change)}%` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab 4: History ─────────────────────────────────────────────────────────

  const renderHistory = () => {
    const maxTotal = Math.max(...historyRuns.map(r => r.passed + r.failed + r.skipped))

    return (
      <div className="space-y-5">
        {/* Stacked bar chart */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-sm font-medium">Run Results — Last {historyRuns.length} Runs</h3>
            <div className="flex gap-4 text-xs">
              {[
                { color: "bg-emerald-500/70", label: "Passed" },
                { color: "bg-rose-400/70", label: "Failed" },
                { color: "bg-zinc-600/70", label: "Skipped" },
              ].map(item => (
                <span key={item.label} className="flex items-center gap-1.5 text-zinc-400">
                  <span className={cn("w-2.5 h-2.5 rounded-sm inline-block", item.color)} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Chart bars */}
          <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
            {historyRuns.map(run => {
              const total = run.passed + run.failed + run.skipped
              const barH = Math.round((total / maxTotal) * 96) // px, max 96px
              const passH = Math.round((run.passed / total) * barH)
              const failH = Math.round((run.failed / total) * barH)
              const skipH = barH - passH - failH

              return (
                <div key={run.id} className="flex-1 flex flex-col items-stretch justify-end" style={{ height: "112px" }}>
                  <div style={{ height: `${barH}px` }} className="flex flex-col">
                    {skipH > 0 && (
                      <div
                        className="bg-zinc-600/60 w-full flex-shrink-0"
                        style={{ height: `${skipH}px` }}
                        title={`Skip: ${run.skipped}`}
                      />
                    )}
                    {failH > 0 && (
                      <div
                        className="bg-rose-400/70 w-full flex-shrink-0"
                        style={{ height: `${failH}px` }}
                        title={`Fail: ${run.failed}`}
                      />
                    )}
                    {passH > 0 && (
                      <div
                        className="bg-emerald-500/70 w-full flex-shrink-0"
                        style={{ height: `${passH}px` }}
                        title={`Pass: ${run.passed}`}
                      />
                    )}
                  </div>
                  <span className="text-zinc-600 text-xs text-center mt-1 truncate block">{run.runId}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* History table */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <h3 className="text-white font-medium text-sm">Run History</h3>
            <span className="text-zinc-500 text-xs">Click row to view diff</span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800">
            <span className="col-span-1">Run</span>
            <span className="col-span-3">Branch</span>
            <span className="col-span-1">Commit</span>
            <span className="col-span-2">Started</span>
            <span className="col-span-1 text-right">Duration</span>
            <span className="col-span-1 text-right text-emerald-400/60">Pass</span>
            <span className="col-span-1 text-right text-rose-400/60">Fail</span>
            <span className="col-span-1 text-right">Skip</span>
            <span className="col-span-1 text-right">Trigger</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {historyRuns.map((run, idx) => {
              const prev = historyRuns[idx + 1]
              const failDiff = prev ? run.failed - prev.failed : 0

              return (
                <div key={run.id}>
                  <button
                    onClick={() => toggleHistory(run.id)}
                    className="w-full grid grid-cols-12 px-4 py-3 text-xs hover:bg-zinc-800/40 transition-colors text-left items-center"
                  >
                    <span className="col-span-1 text-indigo-400 font-mono font-medium">{run.runId}</span>
                    <span className="col-span-3 text-zinc-300 truncate pr-2">{run.branch}</span>
                    <span className="col-span-1 font-mono text-zinc-500">{run.commit}</span>
                    <span className="col-span-2 text-zinc-400">{run.started}</span>
                    <span className="col-span-1 text-right text-zinc-300 tabular-nums">{formatDuration(run.duration)}</span>
                    <span className="col-span-1 text-right text-emerald-400 tabular-nums">{run.passed}</span>
                    <span className={cn("col-span-1 text-right tabular-nums", run.failed > 0 ? "text-rose-400" : "text-zinc-500")}>
                      {run.failed}
                    </span>
                    <span className="col-span-1 text-right text-zinc-500 tabular-nums">{run.skipped}</span>
                    <span className="col-span-1 text-right text-zinc-500">{run.triggeredBy}</span>
                  </button>

                  {expandedHistory.has(run.id) && (
                    <div className="bg-zinc-950/60 border-t border-zinc-800 px-8 py-4 text-xs space-y-2">
                      <div className="text-zinc-300 font-medium">Diff from previous run</div>
                      {prev ? (
                        <div className="space-y-1.5">
                          {failDiff > 0 && (
                            <div className="flex items-center gap-2 text-rose-300">
                              <span className="text-rose-400">+{failDiff}</span>
                              <span>new test failures vs {prev.runId}</span>
                              <span className="font-mono text-zinc-500">(commit {prev.commit} → {run.commit})</span>
                            </div>
                          )}
                          {failDiff < 0 && (
                            <div className="flex items-center gap-2 text-emerald-300">
                              <span className="text-emerald-400">{failDiff}</span>
                              <span>fewer failures vs {prev.runId} — good progress</span>
                            </div>
                          )}
                          {failDiff === 0 && (
                            <div className="text-zinc-400">No change in failure count vs {prev.runId}</div>
                          )}
                          <div className="text-zinc-500">
                            Pass rate: {((run.passed / (run.passed + run.failed + run.skipped)) * 100).toFixed(1)}%
                            {" "}({run.passed} / {run.passed + run.failed + run.skipped}) ·{" "}
                            Duration: {formatDuration(run.duration)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-500">No previous run to compare against.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-white text-xl font-semibold tracking-tight">Test Results Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          CI/CD test results, coverage tracking, and flakiness analysis for {latestRunMeta.repo}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-end gap-0.5 border-b border-zinc-800 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-700"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                activeTab === tab.id
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "bg-rose-400/15 text-rose-400"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "latest" && renderLatest()}
      {activeTab === "flaky" && renderFlaky()}
      {activeTab === "coverage" && renderCoverage()}
      {activeTab === "history" && renderHistory()}
    </div>
  )
}
