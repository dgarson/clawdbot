import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "sessions" | "detail" | "heatmaps" | "filters";
type DeviceKind = "desktop" | "mobile" | "tablet";
type DeviceFilter = "all" | "desktop" | "mobile" | "tablet";
type EventKind = "click" | "scroll" | "error" | "input" | "navigation";
type DateRange = "today" | "7d" | "30d";

interface ReplayEvent {
  id: string;
  kind: EventKind;
  ts: number; // seconds from session start
  label: string;
  detail: string;
}

interface NetRequest {
  url: string;
  method: string;
  status: number;
  duration: number; // ms
}

interface ReplaySession {
  id: string;
  userId: string;
  name: string;
  email: string;
  duration: number; // seconds
  device: DeviceKind;
  browser: string;
  os: string;
  country: string;
  startedAt: string;
  hasErrors: boolean;
  hasRageClicks: boolean;
  events: ReplayEvent[];
  requests: NetRequest[];
}

interface HeatCell {
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVT_ICON: Record<EventKind, string> = {
  click: "🖱️",
  scroll: "📜",
  error: "❌",
  input: "⌨️",
  navigation: "🔗",
};

const PAGES = ["/dashboard", "/reports", "/settings", "/onboarding", "/analytics"];

const SCROLL_DEPTHS: { label: string; pct: number }[] = [
  { label: "0–10%", pct: 100 },
  { label: "10–25%", pct: 91 },
  { label: "25–50%", pct: 74 },
  { label: "50–75%", pct: 53 },
  { label: "75–90%", pct: 31 },
  { label: "90–100%", pct: 14 },
];

// Deterministic heatmap grid (10×6 = 60 cells)
const HEAT_COUNTS = [
  5, 12, 8, 34, 67, 45, 23, 11, 6, 3,
  9, 18, 41, 72, 80, 61, 38, 19, 7, 2,
  4, 22, 55, 70, 78, 65, 42, 25, 10, 5,
  3, 14, 38, 60, 74, 58, 35, 17, 8, 4,
  6, 10, 27, 44, 62, 49, 28, 13, 5, 2,
  2, 5, 11, 21, 38, 30, 16, 8, 3, 1,
];

const HEATMAP: HeatCell[] = HEAT_COUNTS.map((count) => ({ count }));

// ─── Mock Event Factory ───────────────────────────────────────────────────────

function makeEvents(hasErrors: boolean, hasRageClicks: boolean): ReplayEvent[] {
  const base: ReplayEvent[] = [
    { id: "e1", kind: "navigation", ts: 0, label: "Page Load", detail: "/dashboard" },
    { id: "e2", kind: "click", ts: 3, label: "Click", detail: "Nav: Reports" },
    { id: "e3", kind: "scroll", ts: 7, label: "Scroll", detail: "Depth 30%" },
    { id: "e4", kind: "click", ts: 14, label: "Click", detail: "Filter button" },
    { id: "e5", kind: "input", ts: 20, label: "Input", detail: "Search field" },
    { id: "e6", kind: "scroll", ts: 28, label: "Scroll", detail: "Depth 60%" },
    { id: "e7", kind: "click", ts: 40, label: "Click", detail: "Table row #3" },
    { id: "e8", kind: "navigation", ts: 44, label: "Navigation", detail: "/reports/detail/3" },
    { id: "e9", kind: "scroll", ts: 51, label: "Scroll", detail: "Depth 20%" },
    { id: "e10", kind: "click", ts: 63, label: "Click", detail: "Export button" },
    { id: "e11", kind: "input", ts: 71, label: "Input", detail: "Date range picker" },
    { id: "e12", kind: "click", ts: 79, label: "Click", detail: "Apply filters" },
    { id: "e13", kind: "scroll", ts: 94, label: "Scroll", detail: "Depth 85%" },
    { id: "e14", kind: "click", ts: 108, label: "Click", detail: "Settings icon" },
    { id: "e15", kind: "navigation", ts: 112, label: "Navigation", detail: "/settings" },
    { id: "e16", kind: "input", ts: 128, label: "Input", detail: "Email preferences" },
    { id: "e17", kind: "click", ts: 141, label: "Click", detail: "Save settings" },
    { id: "e18", kind: "scroll", ts: 157, label: "Scroll", detail: "Depth 50%" },
    { id: "e19", kind: "click", ts: 172, label: "Click", detail: "Back to dashboard" },
    { id: "e20", kind: "navigation", ts: 175, label: "Navigation", detail: "/dashboard" },
    { id: "e21", kind: "scroll", ts: 190, label: "Scroll", detail: "Depth 40%" },
    { id: "e22", kind: "click", ts: 203, label: "Click", detail: "Notification bell" },
  ];
  if (hasErrors) {
    base.push({ id: "e23", kind: "error", ts: 88, label: "JS Error", detail: "TypeError: Cannot read properties of undefined (reading 'id')" });
    base.push({ id: "e24", kind: "error", ts: 90, label: "Network Error", detail: "POST /api/events/track → 500 Internal Server Error" });
  }
  if (hasRageClicks) {
    base.push({ id: "e25", kind: "click", ts: 53, label: "Rage Click ×6", detail: "Submit button (unresponsive for 4s)" });
  }
  return base.slice().sort((a, b) => a.ts - b.ts);
}

// ─── Mock Sessions ────────────────────────────────────────────────────────────

const SESSIONS: ReplaySession[] = [
  {
    id: "s1", userId: "u001", name: "Alice Chen", email: "alice@acme.com",
    duration: 342, device: "desktop", browser: "Chrome 121", os: "macOS 14",
    country: "US", startedAt: "2026-02-22 06:01",
    hasErrors: true, hasRageClicks: false,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 145 },
      { url: "http://127.0.0.1:3000/api/sessions/list", method: "GET", status: 200, duration: 213 },
      { url: "http://127.0.0.1:3000/api/events/track", method: "POST", status: 500, duration: 1203 },
      { url: "http://127.0.0.1:3000/api/auth/refresh", method: "POST", status: 401, duration: 89 },
    ],
    events: makeEvents(true, false),
  },
  {
    id: "s2", userId: "u002", name: "Bob Martinez", email: "bob@techcorp.io",
    duration: 189, device: "mobile", browser: "Safari 17", os: "iOS 17",
    country: "MX", startedAt: "2026-02-22 05:47",
    hasErrors: false, hasRageClicks: true,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 98 },
      { url: "http://127.0.0.1:3000/api/dashboard/stats", method: "GET", status: 200, duration: 312 },
      { url: "http://127.0.0.1:3000/api/events/batch", method: "POST", status: 200, duration: 445 },
    ],
    events: makeEvents(false, true),
  },
  {
    id: "s3", userId: "u003", name: "Carol White", email: "carol@startup.vc",
    duration: 501, device: "desktop", browser: "Firefox 122", os: "Ubuntu 22",
    country: "CA", startedAt: "2026-02-22 05:30",
    hasErrors: true, hasRageClicks: true,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 201 },
      { url: "http://127.0.0.1:3000/api/reports/export", method: "POST", status: 422, duration: 678 },
      { url: "http://127.0.0.1:3000/api/auth/refresh", method: "POST", status: 200, duration: 112 },
      { url: "http://127.0.0.1:3000/api/reports/export", method: "POST", status: 422, duration: 590 },
    ],
    events: makeEvents(true, true),
  },
  {
    id: "s4", userId: "u004", name: "Dan Lee", email: "dan@enterprise.com",
    duration: 87, device: "tablet", browser: "Chrome 121", os: "Android 14",
    country: "KR", startedAt: "2026-02-22 05:15",
    hasErrors: false, hasRageClicks: false,
    requests: [
      { url: "http://127.0.0.1:3000/api/dashboard/stats", method: "GET", status: 200, duration: 189 },
      { url: "http://127.0.0.1:3000/api/user/preferences", method: "PUT", status: 200, duration: 234 },
    ],
    events: makeEvents(false, false),
  },
  {
    id: "s5", userId: "u005", name: "Eva Schmidt", email: "eva@company.de",
    duration: 623, device: "desktop", browser: "Edge 121", os: "Windows 11",
    country: "DE", startedAt: "2026-02-22 04:58",
    hasErrors: false, hasRageClicks: false,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 134 },
      { url: "http://127.0.0.1:3000/api/analytics/funnel", method: "GET", status: 200, duration: 891 },
      { url: "http://127.0.0.1:3000/api/segments/list", method: "GET", status: 200, duration: 267 },
      { url: "http://127.0.0.1:3000/api/events/track", method: "POST", status: 200, duration: 99 },
      { url: "http://127.0.0.1:3000/api/exports/csv", method: "POST", status: 200, duration: 1456 },
    ],
    events: makeEvents(false, false),
  },
  {
    id: "s6", userId: "u006", name: "Felix Obi", email: "felix@saas.ng",
    duration: 256, device: "mobile", browser: "Chrome 121", os: "Android 13",
    country: "NG", startedAt: "2026-02-22 04:33",
    hasErrors: true, hasRageClicks: false,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 312 },
      { url: "http://127.0.0.1:3000/api/onboarding/step", method: "POST", status: 500, duration: 2341 },
      { url: "http://127.0.0.1:3000/api/onboarding/step", method: "POST", status: 500, duration: 2189 },
    ],
    events: makeEvents(true, false),
  },
  {
    id: "s7", userId: "u007", name: "Grace Kim", email: "grace@studio.kr",
    duration: 412, device: "tablet", browser: "Safari 17", os: "iPadOS 17",
    country: "KR", startedAt: "2026-02-22 04:10",
    hasErrors: false, hasRageClicks: false,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 178 },
      { url: "http://127.0.0.1:3000/api/design/assets", method: "GET", status: 200, duration: 892 },
      { url: "http://127.0.0.1:3000/api/design/assets", method: "PUT", status: 200, duration: 445 },
    ],
    events: makeEvents(false, false),
  },
  {
    id: "s8", userId: "u008", name: "Henry Park", email: "henry@logistics.com",
    duration: 178, device: "desktop", browser: "Chrome 121", os: "Windows 10",
    country: "JP", startedAt: "2026-02-22 03:55",
    hasErrors: true, hasRageClicks: true,
    requests: [
      { url: "http://127.0.0.1:3000/api/user/profile", method: "GET", status: 200, duration: 156 },
      { url: "http://127.0.0.1:3000/api/shipping/routes", method: "GET", status: 200, duration: 789 },
      { url: "http://127.0.0.1:3000/api/shipping/book", method: "POST", status: 503, duration: 3001 },
      { url: "http://127.0.0.1:3000/api/shipping/book", method: "POST", status: 503, duration: 2998 },
    ],
    events: makeEvents(true, true),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("");
}

function statusColor(code: number): string {
  if (code >= 500) return "text-rose-400";
  if (code >= 400) return "text-amber-400";
  return "text-emerald-400";
}

function statusBg(code: number): string {
  if (code >= 500) return "bg-rose-500/10 border-rose-500/20";
  if (code >= 400) return "bg-amber-500/10 border-amber-500/20";
  return "bg-emerald-500/10 border-emerald-500/20";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionReplayViewer() {
  const [tab, setTab] = useState<TabId>("sessions");
  const [selectedSession, setSelectedSession] = useState<ReplaySession | null>(null);
  const [scrubberPos, setScrubberPos] = useState(0);
  const [selectedPage, setSelectedPage] = useState(PAGES[0]);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [hasErrorsOnly, setHasErrorsOnly] = useState(false);
  const [minDuration, setMinDuration] = useState("");

  const filteredSessions = SESSIONS.filter((s) => {
    if (deviceFilter !== "all" && s.device !== deviceFilter) return false;
    if (hasErrorsOnly && !s.hasErrors) return false;
    const minSecs = minDuration !== "" ? parseInt(minDuration, 10) : 0;
    if (!isNaN(minSecs) && minSecs > 0 && s.duration < minSecs) return false;
    return true;
  });

  const openDetail = (session: ReplaySession) => {
    setSelectedSession(session);
    setScrubberPos(0);
    setTab("detail");
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "sessions", label: "Sessions" },
    { id: "detail", label: "Session Detail" },
    { id: "heatmaps", label: "Heatmaps" },
    { id: "filters", label: "Filters" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">

      {/* ── App Header ── */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Session Replay</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Debug real user sessions — Hotjar-style</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">{SESSIONS.length} total sessions</span>
          <button className="text-xs bg-indigo-600 hover:bg-indigo-500 transition-colors px-3 py-1.5 rounded-md font-medium">
            + Record New
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 flex gap-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">

        {/* ════════════════════════════════════
            TAB: Sessions
        ════════════════════════════════════ */}
        {tab === "sessions" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 mb-4">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} recorded
            </p>
            {filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => openDetail(s)}
                className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 hover:bg-zinc-800/70 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: avatar + user info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 select-none">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{s.name}</span>
                        <span className="text-xs text-zinc-500">{s.email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
                        <span>{s.startedAt}</span>
                        <span className="text-zinc-700">·</span>
                        <span>{s.country}</span>
                        <span className="text-zinc-700">·</span>
                        <span>{s.browser}</span>
                        <span className="text-zinc-700">·</span>
                        <span className="capitalize">{s.device}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: stats + badges */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">{fmtDuration(s.duration)}</div>
                      <div className="text-xs text-zinc-500">{s.events.length} events</div>
                    </div>
                    <div className="flex flex-col gap-1 min-w-[72px]">
                      {s.hasErrors && (
                        <span className="text-xs bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full text-center">
                          Error
                        </span>
                      )}
                      {s.hasRageClicks && (
                        <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full text-center">
                          Rage Click
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════
            TAB: Session Detail
        ════════════════════════════════════ */}
        {tab === "detail" && (
          <div>
            {!selectedSession ? (
              <div className="text-center py-20 text-zinc-500">
                <div className="text-4xl mb-3">▶</div>
                <p className="text-sm">Select a session to view its replay.</p>
                <button
                  onClick={() => setTab("sessions")}
                  className="mt-4 text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors"
                >
                  Browse Sessions
                </button>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Breadcrumb */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTab("sessions")}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    ← Sessions
                  </button>
                  <span className="text-zinc-700 text-xs">/</span>
                  <span className="text-sm font-medium text-white">{selectedSession.name}</span>
                  {selectedSession.hasErrors && (
                    <span className="text-xs bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full">Error</span>
                  )}
                  {selectedSession.hasRageClicks && (
                    <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">Rage Click</span>
                  )}
                </div>

                {/* Timeline Scrubber */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Timeline</h3>
                    <span className="text-xs text-zinc-500 font-mono">
                      {Math.round((scrubberPos / 100) * selectedSession.duration)}s
                      {" / "}
                      {fmtDuration(selectedSession.duration)}
                    </span>
                  </div>

                  {/* Track */}
                  <div
                    className="relative h-3 bg-zinc-800 rounded-full cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      setScrubberPos(Math.round(pct));
                    }}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute left-0 top-0 h-full bg-indigo-600 rounded-full pointer-events-none"
                      style={{ width: `${scrubberPos}%` }}
                    />
                    {/* Event markers */}
                    {selectedSession.events.map((ev) => {
                      const pct = (ev.ts / selectedSession.duration) * 100;
                      const bg =
                        ev.kind === "error" ? "#f87171"
                          : ev.kind === "navigation" ? "#a5b4fc"
                          : ev.kind === "click" ? "#71717a"
                          : "#52525b";
                      return (
                        <div
                          key={ev.id}
                          title={ev.label + ": " + ev.detail}
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                          style={{ left: `${pct}%`, backgroundColor: bg }}
                        />
                      );
                    })}
                    {/* Thumb */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg -translate-x-1/2 pointer-events-none border-2 border-indigo-500"
                      style={{ left: `${scrubberPos}%` }}
                    />
                  </div>

                  {/* Time labels */}
                  <div className="flex justify-between text-xs text-zinc-600 mt-2 font-mono">
                    <span>0s</span>
                    <span>{fmtDuration(Math.round(selectedSession.duration / 2))}</span>
                    <span>{fmtDuration(selectedSession.duration)}</span>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                    {[
                      { color: "#f87171", label: "Error" },
                      { color: "#a5b4fc", label: "Navigation" },
                      { color: "#71717a", label: "Click/Other" },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Events + User Info grid */}
                <div className="grid grid-cols-3 gap-4">

                  {/* Events list */}
                  <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="border-b border-zinc-800 px-4 py-3">
                      <h3 className="text-sm font-semibold text-white">
                        Events <span className="text-zinc-500 font-normal">({selectedSession.events.length})</span>
                      </h3>
                    </div>
                    <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
                      {selectedSession.events.map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-800/40 transition-colors",
                            ev.kind === "error" && "bg-rose-500/5 hover:bg-rose-500/10"
                          )}
                        >
                          <span className="text-base flex-shrink-0 mt-0.5 select-none">{EVT_ICON[ev.kind]}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "text-xs font-medium",
                                ev.kind === "error" ? "text-rose-400" : "text-zinc-200"
                              )}>
                                {ev.label}
                              </span>
                              <span className="text-xs text-zinc-600 font-mono flex-shrink-0">{ev.ts}s</span>
                            </div>
                            <p className="text-xs text-zinc-500 truncate mt-0.5">{ev.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User info panel */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="border-b border-zinc-800 px-4 py-3">
                      <h3 className="text-sm font-semibold text-white">User</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold select-none">
                          {initials(selectedSession.name)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{selectedSession.name}</div>
                          <div className="text-xs text-zinc-500">{selectedSession.email}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          ["User ID", selectedSession.userId],
                          ["Device", selectedSession.device],
                          ["Browser", selectedSession.browser],
                          ["OS", selectedSession.os],
                          ["Country", selectedSession.country],
                          ["Duration", fmtDuration(selectedSession.duration)],
                          ["Events", String(selectedSession.events.length)],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">{k}</span>
                            <span className="text-zinc-300 capitalize font-mono">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Network Requests */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <h3 className="text-sm font-semibold text-white">
                      Network Requests <span className="text-zinc-500 font-normal">({selectedSession.requests.length})</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {selectedSession.requests.map((req, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                        <span className={cn(
                          "text-xs font-mono font-bold w-10 flex-shrink-0 text-center px-1.5 py-0.5 rounded border",
                          statusBg(req.status), statusColor(req.status)
                        )}>
                          {req.status}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono w-10 flex-shrink-0">{req.method}</span>
                        <span className="text-xs text-zinc-300 font-mono flex-1 truncate">{req.url}</span>
                        <span className={cn(
                          "text-xs font-mono flex-shrink-0",
                          req.duration > 1000 ? "text-amber-400" : "text-zinc-500"
                        )}>
                          {req.duration}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════
            TAB: Heatmaps
        ════════════════════════════════════ */}
        {tab === "heatmaps" && (
          <div className="space-y-6">

            {/* Page selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-zinc-400 font-medium">Page:</label>
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {PAGES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Click density heatmap */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Click Density — {selectedPage}</h3>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span>Low</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((op) => (
                    <div
                      key={op}
                      className="w-4 h-3 rounded-sm"
                      style={{ backgroundColor: `rgba(99, 102, 241, ${op})` }}
                    />
                  ))}
                  <span>High</span>
                </div>
              </div>
              <div className="p-4">
                {/* Wireframe overlay labels */}
                <div className="mb-2 flex gap-2 text-xs text-zinc-600">
                  <span>← nav bar →</span>
                  <span className="ml-auto">← content area →</span>
                </div>
                <div
                  className="rounded-lg overflow-hidden border border-zinc-800"
                  style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", height: 240 }}
                >
                  {HEATMAP.map((cell, i) => {
                    const opacity = cell.count / 80;
                    return (
                      <div
                        key={i}
                        title={cell.count + " clicks"}
                        style={{ backgroundColor: `rgba(99, 102, 241, ${opacity.toFixed(2)})` }}
                        className="border border-zinc-900/30 cursor-crosshair transition-opacity hover:opacity-80"
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-600 mt-2 text-center">
                  Hover cells to see click counts · 10×6 grid · {selectedPage}
                </p>
              </div>
            </div>

            {/* Scroll depth */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="border-b border-zinc-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Scroll Depth — {selectedPage}</h3>
              </div>
              <div className="p-5 space-y-3">
                {SCROLL_DEPTHS.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-16 flex-shrink-0 font-mono">{d.label}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-300 w-10 text-right font-mono">{d.pct}%</span>
                  </div>
                ))}
                <p className="text-xs text-zinc-600 pt-1">
                  % of sessions reaching each scroll depth on {selectedPage}
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════
            TAB: Filters
        ════════════════════════════════════ */}
        {tab === "filters" && (
          <div className="space-y-5 max-w-xl">
            <h2 className="text-base font-semibold text-white">Filter Sessions</h2>

            {/* Date range */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-white">Date Range</label>
              <div className="flex gap-2">
                {(["today", "7d", "30d"] as DateRange[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDateRange(d)}
                    className={cn(
                      "px-4 py-2 text-sm rounded-lg border transition-colors font-medium",
                      dateRange === d
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    )}
                  >
                    {d === "today" ? "Today" : d === "7d" ? "Last 7 Days" : "Last 30 Days"}
                  </button>
                ))}
              </div>
            </div>

            {/* User segment */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-white">User Segment</label>
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="all">All Users</option>
                <option value="new">New Users</option>
                <option value="returning">Returning Users</option>
                <option value="paying">Paying Customers</option>
                <option value="trial">Trial Users</option>
                <option value="churned">Churned Users</option>
              </select>
            </div>

            {/* Device type */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-white">Device Type</label>
              <div className="flex gap-2 flex-wrap">
                {(["all", "desktop", "mobile", "tablet"] as DeviceFilter[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDeviceFilter(d)}
                    className={cn(
                      "px-4 py-2 text-sm rounded-lg border transition-colors capitalize font-medium",
                      deviceFilter === d
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    )}
                  >
                    {d === "all" ? "All Devices" : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Has errors toggle */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Has Errors Only</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Show only sessions with at least one error event
                  </div>
                </div>
                <button
                  onClick={() => setHasErrorsOnly(!hasErrorsOnly)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                    hasErrorsOnly ? "bg-indigo-600" : "bg-zinc-700"
                  )}
                  aria-label="Toggle errors filter"
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                      hasErrorsOnly ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Min duration */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-white">Minimum Duration (seconds)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 60"
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600 font-mono"
              />
            </div>

            {/* Results summary */}
            <div className={cn(
              "rounded-xl p-5 flex items-center justify-between transition-colors",
              filteredSessions.length > 0
                ? "bg-emerald-500/10 border border-emerald-500/25"
                : "bg-zinc-900 border border-zinc-800"
            )}>
              <div>
                <div className={cn(
                  "text-3xl font-bold",
                  filteredSessions.length > 0 ? "text-emerald-400" : "text-zinc-500"
                )}>
                  {filteredSessions.length}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  session{filteredSessions.length !== 1 ? "s" : ""} match your filters
                </div>
              </div>
              <button
                onClick={() => setTab("sessions")}
                className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors font-medium"
              >
                View Results →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
