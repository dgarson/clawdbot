import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = {
  id: string;
  user: string;
  email: string;
  duration: number;
  pageCount: number;
  rageClicks: number;
  errors: number;
  country: string;
  browser: string;
  device: string;
  startTime: string;
  url: string;
};

type EventType = "click" | "navigation" | "error" | "rage_click";

type SessionEvent = {
  time: number;
  type: EventType;
  label: string;
};

type HeatmapZone = {
  zone: string;
  clicks: number;
  intensity: number;
};

type TopElement = {
  selector: string;
  clicks: number;
  percentage: number;
};

type FunnelStep = {
  name: string;
  users: number;
  dropoff: number;
};

type Funnel = {
  name: string;
  steps: FunnelStep[];
};

type TrendDirection = "up" | "down";

type InsightMetric = {
  label: string;
  value: string;
  change: number;
  trend: TrendDirection;
  isGoodWhenDown: boolean;
};

type SatisfactionBucket = {
  label: string;
  value: number;
  color: string;
};

type ExitPage = {
  page: string;
  exits: number;
  rate: number;
};

type RageHotspot = {
  element: string;
  count: number;
  sessions: number;
};

type DeadClick = {
  element: string;
  count: number;
  page: string;
};

type HeatmapCell = {
  row: number;
  col: number;
  intensity: number;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SESSIONS: Session[] = [
  {
    id: "s001",
    user: "Alice Johnson",
    email: "alice@example.com",
    duration: 342,
    pageCount: 7,
    rageClicks: 3,
    errors: 1,
    country: "US",
    browser: "Chrome",
    device: "Desktop",
    startTime: "2026-02-22 09:14:23",
    url: "/dashboard",
  },
  {
    id: "s002",
    user: "Bob Martinez",
    email: "bob@example.com",
    duration: 128,
    pageCount: 3,
    rageClicks: 0,
    errors: 0,
    country: "UK",
    browser: "Firefox",
    device: "Desktop",
    startTime: "2026-02-22 09:22:11",
    url: "/pricing",
  },
  {
    id: "s003",
    user: "Carol White",
    email: "carol@example.com",
    duration: 587,
    pageCount: 12,
    rageClicks: 7,
    errors: 3,
    country: "CA",
    browser: "Safari",
    device: "Mobile",
    startTime: "2026-02-22 09:31:04",
    url: "/checkout",
  },
  {
    id: "s004",
    user: "David Lee",
    email: "david@example.com",
    duration: 215,
    pageCount: 5,
    rageClicks: 1,
    errors: 0,
    country: "AU",
    browser: "Chrome",
    device: "Tablet",
    startTime: "2026-02-22 09:45:33",
    url: "/settings",
  },
  {
    id: "s005",
    user: "Eva Brown",
    email: "eva@example.com",
    duration: 92,
    pageCount: 2,
    rageClicks: 0,
    errors: 2,
    country: "DE",
    browser: "Edge",
    device: "Desktop",
    startTime: "2026-02-22 10:02:17",
    url: "/login",
  },
  {
    id: "s006",
    user: "Frank Davis",
    email: "frank@example.com",
    duration: 431,
    pageCount: 9,
    rageClicks: 4,
    errors: 1,
    country: "FR",
    browser: "Chrome",
    device: "Desktop",
    startTime: "2026-02-22 10:15:44",
    url: "/reports",
  },
  {
    id: "s007",
    user: "Grace Kim",
    email: "grace@example.com",
    duration: 178,
    pageCount: 4,
    rageClicks: 0,
    errors: 0,
    country: "KR",
    browser: "Chrome",
    device: "Mobile",
    startTime: "2026-02-22 10:28:09",
    url: "/onboarding",
  },
  {
    id: "s008",
    user: "Henry Wilson",
    email: "henry@example.com",
    duration: 644,
    pageCount: 15,
    rageClicks: 9,
    errors: 4,
    country: "US",
    browser: "Firefox",
    device: "Desktop",
    startTime: "2026-02-22 10:41:55",
    url: "/analytics",
  },
];

const SESSION_EVENTS: SessionEvent[] = [
  { time: 5, type: "navigation", label: "Navigated to /dashboard" },
  { time: 12, type: "click", label: "Clicked 'New Report' button" },
  { time: 28, type: "click", label: "Clicked date picker" },
  { time: 45, type: "rage_click", label: "Rage clicked submit button (3x)" },
  { time: 67, type: "navigation", label: "Navigated to /reports" },
  { time: 89, type: "error", label: "JS Error: Cannot read property 'id'" },
  { time: 102, type: "click", label: "Clicked 'Download CSV'" },
  { time: 134, type: "navigation", label: "Navigated to /settings" },
  { time: 156, type: "click", label: "Clicked 'Save Changes'" },
  { time: 198, type: "click", label: "Clicked 'Back' button" },
];

const HEATMAP_PAGES = ["/dashboard", "/pricing", "/checkout", "/settings", "/reports"];

const HEATMAP_ZONES: HeatmapZone[] = [
  { zone: "Header Nav", clicks: 1240, intensity: 0.9 },
  { zone: "Hero CTA", clicks: 980, intensity: 0.75 },
  { zone: "Feature Cards", clicks: 750, intensity: 0.6 },
  { zone: "Footer Links", clicks: 320, intensity: 0.25 },
  { zone: "Sidebar", clicks: 580, intensity: 0.45 },
  { zone: "Main Content", clicks: 1100, intensity: 0.85 },
  { zone: "Search Bar", clicks: 890, intensity: 0.68 },
  { zone: "User Avatar", clicks: 420, intensity: 0.32 },
  { zone: "Notifications", clicks: 670, intensity: 0.52 },
  { zone: "Settings Icon", clicks: 280, intensity: 0.22 },
];

const TOP_ELEMENTS: TopElement[] = [
  { selector: "button.cta-primary", clicks: 980, percentage: 28.4 },
  { selector: "nav a.active", clicks: 750, percentage: 21.7 },
  { selector: "input#search", clicks: 612, percentage: 17.7 },
  { selector: "div.card:first-child", clicks: 445, percentage: 12.9 },
  { selector: "a.logo", clicks: 380, percentage: 11.0 },
];

// Precompute heatmap grid (deterministic, no random)
const HEATMAP_ROWS = 8;
const HEATMAP_COLS = 12;
const HEATMAP_GRID: HeatmapCell[] = (function buildGrid() {
  const cells: HeatmapCell[] = [];
  for (let i = 0; i < HEATMAP_ROWS * HEATMAP_COLS; i++) {
    const row = Math.floor(i / HEATMAP_COLS);
    const col = i % HEATMAP_COLS;
    const centerX = Math.abs(col - HEATMAP_COLS / 2) / (HEATMAP_COLS / 2);
    const topBias = 1 - row / HEATMAP_ROWS;
    const pseudoNoise = (((row * 7 + col * 13) % 17) / 17) * 0.3;
    const intensity = Math.max(
      0,
      Math.min(1, (1 - centerX * 0.5) * topBias * 0.8 + pseudoNoise)
    );
    cells.push({ row, col, intensity });
  }
  return cells;
})();

const FUNNELS: Funnel[] = [
  {
    name: "Signup Flow",
    steps: [
      { name: "Landing Page", users: 10000, dropoff: 0 },
      { name: "Signup Form", users: 6200, dropoff: 38.0 },
      { name: "Email Verify", users: 4800, dropoff: 22.6 },
      { name: "Onboarding", users: 3900, dropoff: 18.8 },
      { name: "First Action", users: 2600, dropoff: 33.3 },
    ],
  },
  {
    name: "Checkout Flow",
    steps: [
      { name: "Product Page", users: 8000, dropoff: 0 },
      { name: "Add to Cart", users: 5400, dropoff: 32.5 },
      { name: "Cart Review", users: 4100, dropoff: 24.1 },
      { name: "Payment Info", users: 2800, dropoff: 31.7 },
      { name: "Order Complete", users: 2200, dropoff: 21.4 },
    ],
  },
  {
    name: "Feature Adoption",
    steps: [
      { name: "Dashboard View", users: 5000, dropoff: 0 },
      { name: "Feature Click", users: 3200, dropoff: 36.0 },
      { name: "Feature Used", users: 2100, dropoff: 34.4 },
      { name: "Return Use", users: 1400, dropoff: 33.3 },
    ],
  },
];

const MOBILE_FUNNEL: number[] = [78, 48, 31, 18, 12];
const DESKTOP_FUNNEL: number[] = [100, 67, 54, 38, 27];

const CONVERSION_TREND = [
  { month: "Sep", rate: 22 },
  { month: "Oct", rate: 24 },
  { month: "Nov", rate: 21 },
  { month: "Dec", rate: 26 },
  { month: "Jan", rate: 28 },
  { month: "Feb", rate: 31 },
];

const SATISFACTION_BREAKDOWN: SatisfactionBucket[] = [
  { label: "Very Satisfied", value: 38, color: "bg-emerald-500" },
  { label: "Satisfied", value: 29, color: "bg-emerald-400" },
  { label: "Neutral", value: 18, color: "bg-amber-400" },
  { label: "Dissatisfied", value: 11, color: "bg-rose-400" },
  { label: "Very Dissatisfied", value: 4, color: "bg-rose-600" },
];

const TOP_EXIT_PAGES: ExitPage[] = [
  { page: "/pricing", exits: 1842, rate: 34.2 },
  { page: "/checkout/payment", exits: 1234, rate: 28.7 },
  { page: "/signup", exits: 987, rate: 22.1 },
  { page: "/dashboard", exits: 621, rate: 14.8 },
  { page: "/settings/billing", exits: 445, rate: 10.3 },
];

const RAGE_HOTSPOTS: RageHotspot[] = [
  { element: "Submit Button (#checkout-submit)", count: 342, sessions: 89 },
  { element: "Tab Navigation (.nav-tabs)", count: 218, sessions: 64 },
  { element: "Load More Button (.load-more)", count: 187, sessions: 52 },
  { element: "Filter Dropdown (#category-filter)", count: 134, sessions: 41 },
  { element: "Close Modal (button.modal-close)", count: 98, sessions: 33 },
];

const DEAD_CLICKS: DeadClick[] = [
  { element: "Product Image (.product-img)", count: 512, page: "/products" },
  { element: "Static Badge (.badge-new)", count: 398, page: "/catalog" },
  { element: "Decorative Icon (.icon-info)", count: 276, page: "/dashboard" },
  { element: "Disabled Button (#export-btn)", count: 201, page: "/reports" },
  { element: "Label Text (label.form-label)", count: 156, page: "/settings" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getIntensityColor(intensity: number): string {
  if (intensity >= 0.8) {return "bg-rose-500";}
  if (intensity >= 0.6) {return "bg-orange-500";}
  if (intensity >= 0.4) {return "bg-amber-400";}
  if (intensity >= 0.2) {return "bg-yellow-300";}
  return "bg-blue-300";
}

function getEventBadgeClass(type: EventType): string {
  if (type === "click") {return "bg-indigo-500/20 text-indigo-400";}
  if (type === "navigation") {return "bg-emerald-500/20 text-emerald-400";}
  if (type === "error") {return "bg-rose-500/20 text-rose-400";}
  if (type === "rage_click") {return "bg-amber-400/20 text-amber-400";}
  return "bg-zinc-700 text-zinc-400";
}

function getEventDotClass(type: EventType): string {
  if (type === "click") {return "bg-indigo-500";}
  if (type === "navigation") {return "bg-emerald-500";}
  if (type === "error") {return "bg-rose-500";}
  if (type === "rage_click") {return "bg-amber-400";}
  return "bg-zinc-500";
}

function getEventLabel(type: EventType): string {
  if (type === "click") {return "Click";}
  if (type === "navigation") {return "Nav";}
  if (type === "error") {return "Error";}
  if (type === "rage_click") {return "Rage";}
  return "Event";
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string>(SESSIONS[0]?.id ?? "");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackTime, setPlaybackTime] = useState<number>(45);
  const [speed, setSpeed] = useState<number>(1);

  const selected: Session =
    SESSIONS.find((s) => s.id === selectedId) ?? (SESSIONS[0] as Session);

  const scrubPercent = (playbackTime / selected.duration) * 100;

  function stepBack(): void {
    setPlaybackTime((t) => Math.max(0, t - 10));
  }

  function stepForward(): void {
    setPlaybackTime((t) => Math.min(selected.duration, t + 10));
  }

  function handleScrubClick(e: React.MouseEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setPlaybackTime(Math.round(ratio * selected.duration));
  }

  return (
    <div className="flex gap-4">
      {/* Session List */}
      <div className="w-72 flex-shrink-0 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold text-sm">Recorded Sessions</h3>
          <p className="text-zinc-500 text-xs mt-0.5">8 sessions · last 24h</p>
        </div>
        <div className="overflow-y-auto flex-1">
          {SESSIONS.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setSelectedId(session.id);
                setPlaybackTime(0);
                setIsPlaying(false);
              }}
              className={cn(
                "w-full text-left p-3 border-b border-zinc-800 transition-colors",
                selectedId === session.id
                  ? "bg-indigo-500/10 border-l-2 border-l-indigo-500"
                  : "hover:bg-zinc-800"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-sm font-medium truncate pr-2">
                  {session.user}
                </span>
                <span className="text-zinc-500 text-xs flex-shrink-0">
                  {formatDuration(session.duration)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                <span>{session.browser}</span>
                <span>·</span>
                <span>{session.device}</span>
                <span>·</span>
                <span>{session.country}</span>
              </div>
              <div className="flex items-center gap-2">
                {session.rageClicks > 0 && (
                  <span className="text-amber-400 text-xs bg-amber-400/10 px-1.5 py-0.5 rounded">
                    {session.rageClicks} rage
                  </span>
                )}
                {session.errors > 0 && (
                  <span className="text-rose-400 text-xs bg-rose-400/10 px-1.5 py-0.5 rounded">
                    {session.errors} err
                  </span>
                )}
                <span className="text-zinc-600 text-xs">{session.pageCount}pg</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Session Detail */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Replay Player */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold">{selected.user}</h3>
              <p className="text-zinc-500 text-xs">
                {selected.startTime} · {selected.url}
              </p>
            </div>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-zinc-800 text-zinc-400 text-xs rounded-lg px-2 py-1.5 border border-zinc-700 focus:outline-none"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          {/* Mock Viewport */}
          <div className="bg-zinc-950 rounded-lg h-36 mb-3 border border-zinc-800 relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="h-7 bg-zinc-700 flex items-center px-2 gap-1.5 border-b border-zinc-600">
                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="flex-1 mx-3 bg-zinc-600 rounded h-3.5"></div>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                <div className="h-5 bg-zinc-700 rounded col-span-3"></div>
                <div className="h-10 bg-zinc-700 rounded"></div>
                <div className="h-10 bg-zinc-700 rounded"></div>
                <div className="h-10 bg-zinc-700 rounded"></div>
                <div className="h-5 bg-zinc-700 rounded col-span-2"></div>
                <div className="h-5 bg-zinc-700 rounded"></div>
              </div>
            </div>
            <div className="relative z-10 text-center">
              <p className="text-zinc-400 text-sm font-medium">Session Recording</p>
              <p className="text-zinc-600 text-xs mt-0.5">{selected.url}</p>
              <p className="text-indigo-400 text-xs mt-1 font-mono">
                {formatTimestamp(playbackTime)} / {formatTimestamp(selected.duration)}
              </p>
            </div>
          </div>

          {/* Scrubber */}
          <div
            className="relative h-3 bg-zinc-800 rounded-full mb-3 cursor-pointer"
            onClick={handleScrubClick}
          >
            <div
              className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full pointer-events-none"
              style={{ width: `${scrubPercent}%` }}
            ></div>
            {SESSION_EVENTS.map((ev) => (
              <div
                key={ev.time}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-zinc-900 pointer-events-none",
                  getEventDotClass(ev.type)
                )}
                style={{ left: `${(ev.time / selected.duration) * 100}%` }}
              ></div>
            ))}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none border border-zinc-300"
              style={{ left: `calc(${scrubPercent}% - 6px)` }}
            ></div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={stepBack}
              className="text-zinc-400 hover:text-white text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              ‹‹ 10s
            </button>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors font-medium"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={stepForward}
              className="text-zinc-400 hover:text-white text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              10s ››
            </button>
            <span className="text-zinc-600 text-xs ml-auto">
              {speed}x speed
            </span>
          </div>
        </div>

        {/* Bottom: Events + Metadata */}
        <div className="flex gap-4">
          {/* Event Timeline */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 p-4 overflow-y-auto max-h-64">
            <h4 className="text-white font-semibold text-sm mb-3">Event Timeline</h4>
            <div className="space-y-1.5">
              {SESSION_EVENTS.map((ev, idx) => (
                <button
                  key={idx}
                  onClick={() => setPlaybackTime(ev.time)}
                  className={cn(
                    "w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors",
                    playbackTime >= ev.time
                      ? "bg-zinc-800/60 hover:bg-zinc-800"
                      : "opacity-40 hover:opacity-60"
                  )}
                >
                  <span className="text-zinc-600 text-xs w-8 flex-shrink-0 font-mono mt-0.5">
                    {formatTimestamp(ev.time)}
                  </span>
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0",
                      getEventBadgeClass(ev.type)
                    )}
                  >
                    {getEventLabel(ev.type)}
                  </span>
                  <span className="text-zinc-400 text-xs leading-relaxed">
                    {ev.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="w-44 flex-shrink-0 bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Metadata</h4>
            <div className="space-y-3">
              {[
                { label: "Browser", value: selected.browser },
                { label: "Device", value: selected.device },
                { label: "Country", value: selected.country },
                { label: "Duration", value: formatDuration(selected.duration) },
                { label: "Pages", value: String(selected.pageCount) },
                { label: "Rage Clicks", value: String(selected.rageClicks) },
                { label: "Errors", value: String(selected.errors) },
                { label: "Email", value: selected.email },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-zinc-500 text-xs">{label}</div>
                  <div className="text-zinc-300 text-xs font-medium truncate mt-0.5">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Heatmaps Tab ─────────────────────────────────────────────────────────────

function HeatmapsTab(): React.ReactElement {
  const [selectedPage, setSelectedPage] = useState<string>(
    HEATMAP_PAGES[0] ?? "/dashboard"
  );

  const totalZoneClicks = HEATMAP_ZONES.reduce((sum, z) => sum + z.clicks, 0);

  return (
    <div className="space-y-4">
      {/* Header + Page Selector */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Click Heatmap</h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              Aggregated click density across {HEATMAP_PAGES.length} pages
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {HEATMAP_PAGES.map((page) => (
              <button
                key={page}
                onClick={() => setSelectedPage(page)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg transition-colors font-mono",
                  selectedPage === page
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                )}
              >
                {page}
              </button>
            ))}
          </div>
        </div>

        {/* Browser Chrome + Grid */}
        <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
          <div className="h-7 bg-zinc-800 flex items-center px-3 gap-1.5 border-b border-zinc-700">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 opacity-70"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-70"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-70"></div>
            <div className="flex-1 mx-3 bg-zinc-700 rounded h-4 text-zinc-500 text-xs flex items-center px-2">
              {selectedPage}
            </div>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)` }}
          >
            {HEATMAP_GRID.map((cell, i) => (
              <div
                key={i}
                className={cn(
                  "h-8 opacity-75 hover:opacity-100 transition-opacity cursor-crosshair",
                  getIntensityColor(cell.intensity)
                )}
                title={`Row ${cell.row + 1}, Col ${cell.col + 1} — ${Math.round(cell.intensity * 100)}% density`}
              ></div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-zinc-600 text-xs">Low clicks</span>
          <div className="flex gap-0.5">
            {["bg-blue-300", "bg-yellow-300", "bg-amber-400", "bg-orange-500", "bg-rose-500"].map(
              (c, i) => (
                <div key={i} className={cn("w-6 h-3 rounded-sm", c)}></div>
              )
            )}
          </div>
          <span className="text-zinc-600 text-xs">High clicks</span>
        </div>
      </div>

      {/* Zone Table + Top Elements */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h4 className="text-white font-semibold text-sm mb-3">Clicks by Zone</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left pb-2 font-medium">Zone</th>
                <th className="text-right pb-2 font-medium">Clicks</th>
                <th className="text-right pb-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {HEATMAP_ZONES.map((zone) => {
                const share = ((zone.clicks / totalZoneClicks) * 100).toFixed(1);
                return (
                  <tr key={zone.zone} className="border-b border-zinc-800/40">
                    <td className="py-2 text-zinc-300">{zone.zone}</td>
                    <td className="py-2 text-right text-zinc-400">
                      {zone.clicks.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-10 bg-zinc-800 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: share + "%" }}
                          ></div>
                        </div>
                        <span className="text-zinc-400 w-8 text-right">{share}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h4 className="text-white font-semibold text-sm mb-3">Top Clicked Elements</h4>
          <div className="space-y-4">
            {TOP_ELEMENTS.map((el, i) => (
              <div key={el.selector}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-600 text-xs flex-shrink-0">{i + 1}.</span>
                    <code className="text-indigo-400 text-xs truncate">{el.selector}</code>
                  </div>
                  <span className="text-zinc-400 text-xs flex-shrink-0 ml-2">
                    {el.clicks.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: el.percentage + "%" }}
                    ></div>
                  </div>
                  <span className="text-zinc-500 text-xs w-9 text-right">
                    {el.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Funnels Tab ──────────────────────────────────────────────────────────────

function FunnelsTab(): React.ReactElement {
  const [selectedFunnel, setSelectedFunnel] = useState<number>(0);

  const funnel = FUNNELS[selectedFunnel] ?? FUNNELS[0];
  const maxUsers = funnel.steps[0]?.users ?? 1;
  const lastStep = funnel.steps[funnel.steps.length - 1];
  const overallConversion = lastStep
    ? ((lastStep.users / maxUsers) * 100).toFixed(1)
    : "0.0";
  const totalLost = lastStep ? maxUsers - lastStep.users : 0;

  const maxTrendRate = Math.max(...CONVERSION_TREND.map((p) => p.rate));

  return (
    <div className="space-y-4">
      {/* Funnel Selector */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 text-sm">Funnel:</span>
        {FUNNELS.map((f, i) => (
          <button
            key={f.name}
            onClick={() => setSelectedFunnel(i)}
            className={cn(
              "text-sm px-4 py-1.5 rounded-lg transition-colors font-medium",
              selectedFunnel === i
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Main Funnel Chart */}
        <div className="col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h3 className="text-white font-semibold mb-5">{funnel.name}</h3>
          <div className="space-y-4">
            {funnel.steps.map((step, i) => {
              const barWidth = (step.users / maxUsers) * 100;
              const isFirst = i === 0;
              return (
                <div key={step.name}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-zinc-500 text-xs w-28 text-right flex-shrink-0">
                      {step.name}
                    </span>
                    <div className="flex-1">
                      <div
                        className={cn(
                          "h-9 rounded-lg flex items-center px-3 min-w-0 transition-all",
                          isFirst ? "bg-indigo-600" : "bg-indigo-500/60"
                        )}
                        style={{ width: barWidth + "%" }}
                      >
                        <span className="text-white text-xs font-semibold whitespace-nowrap">
                          {step.users.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-zinc-500 text-xs w-10 text-right flex-shrink-0">
                      {((step.users / maxUsers) * 100).toFixed(0)}%
                    </span>
                  </div>
                  {!isFirst && (
                    <div className="flex items-center gap-3 ml-31">
                      <div className="w-28 flex-shrink-0"></div>
                      <p className="text-rose-400 text-xs ml-3">
                        ↓ {step.dropoff}% drop-off
                        <span className="text-zinc-600 ml-1">
                          ({(maxUsers - step.users).toLocaleString()} users lost)
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center gap-8">
            <div>
              <div className="text-zinc-500 text-xs mb-1">Overall Conversion</div>
              <div className="text-white text-3xl font-bold">{overallConversion}%</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">Total Users Lost</div>
              <div className="text-rose-400 text-3xl font-bold">
                {totalLost.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">Steps</div>
              <div className="text-white text-3xl font-bold">{funnel.steps.length}</div>
            </div>
          </div>
        </div>

        {/* Mobile vs Desktop */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h4 className="text-white font-semibold text-sm mb-4">
            Mobile vs Desktop
          </h4>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-amber-400 rounded-sm"></div>
              <span className="text-zinc-400 text-xs">Mobile</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-indigo-500 rounded-sm"></div>
              <span className="text-zinc-400 text-xs">Desktop</span>
            </div>
          </div>
          <div className="space-y-5">
            {funnel.steps.map((step, i) => {
              const mobile = MOBILE_FUNNEL[i] ?? 0;
              const desktop = DESKTOP_FUNNEL[i] ?? 0;
              return (
                <div key={step.name}>
                  <div className="text-zinc-500 text-xs mb-1.5">{step.name}</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 text-xs w-12">Mobile</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="bg-amber-400 h-2 rounded-full"
                          style={{ width: mobile + "%" }}
                        ></div>
                      </div>
                      <span className="text-zinc-400 text-xs w-7 text-right">
                        {mobile}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 text-xs w-12">Desktop</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{ width: desktop + "%" }}
                        ></div>
                      </div>
                      <span className="text-zinc-400 text-xs w-7 text-right">
                        {desktop}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conversion Rate Trend */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-semibold text-sm">
            Conversion Rate Trend — Last 6 Months
          </h4>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 text-xs font-semibold">↑ 41%</span>
            <span className="text-zinc-500 text-xs">improvement</span>
          </div>
        </div>
        <div className="flex items-end gap-3" style={{ height: "120px" }}>
          {CONVERSION_TREND.map((point) => {
            const barH = (point.rate / maxTrendRate) * 90;
            return (
              <div key={point.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-zinc-400 text-xs">{point.rate}%</span>
                <div className="w-full flex items-end" style={{ height: "80px" }}>
                  <div
                    className="w-full bg-indigo-500 hover:bg-indigo-400 rounded-t-md transition-colors"
                    style={{ height: barH + "px" }}
                  ></div>
                </div>
                <span className="text-zinc-500 text-xs">{point.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab(): React.ReactElement {
  const metrics: InsightMetric[] = [
    {
      label: "Rage Click Sessions",
      value: "12.4%",
      change: 2.1,
      trend: "down",
      isGoodWhenDown: true,
    },
    {
      label: "Dead Click Rate",
      value: "8.7%",
      change: 0.8,
      trend: "up",
      isGoodWhenDown: true,
    },
    {
      label: "Error Session Rate",
      value: "5.2%",
      change: 1.3,
      trend: "down",
      isGoodWhenDown: true,
    },
    {
      label: "Avg Session Duration",
      value: "3m 18s",
      change: 14,
      trend: "up",
      isGoodWhenDown: false,
    },
  ];

  const satisfactionTotal = SATISFACTION_BREAKDOWN.reduce(
    (sum, s) => sum + s.value,
    0
  );

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => {
          const isPositive =
            (m.trend === "down" && m.isGoodWhenDown) ||
            (m.trend === "up" && !m.isGoodWhenDown);
          return (
            <div key={m.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="text-zinc-500 text-xs mb-2">{m.label}</div>
              <div className="text-white text-2xl font-bold mb-1">{m.value}</div>
              <div
                className={cn(
                  "text-xs font-medium",
                  isPositive ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {m.trend === "up" ? "↑" : "↓"} {m.change} vs last week
              </div>
            </div>
          );
        })}
      </div>

      {/* Satisfaction + Exit Pages */}
      <div className="grid grid-cols-2 gap-4">
        {/* User Satisfaction */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h4 className="text-white font-semibold text-sm mb-1">
            User Satisfaction Score
          </h4>
          <div className="flex items-baseline gap-2 mb-5">
            <span className="text-5xl font-bold text-white">67</span>
            <span className="text-zinc-500 text-sm">/ 100 NPS</span>
            <span className="text-emerald-400 text-xs font-medium ml-auto">
              ↑ 4 pts this month
            </span>
          </div>
          <div className="space-y-3">
            {SATISFACTION_BREAKDOWN.map((item) => {
              const pct = (item.value / satisfactionTotal) * 100;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-400 text-xs">{item.label}</span>
                    <span className="text-zinc-500 text-xs">{item.value}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div
                      className={cn("h-2 rounded-full transition-all", item.color)}
                      style={{ width: pct.toFixed(1) + "%" }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Exit Pages */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h4 className="text-white font-semibold text-sm mb-4">Top Exit Pages</h4>
          <div className="space-y-4">
            {TOP_EXIT_PAGES.map((page, i) => (
              <div key={page.page}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-600 text-xs flex-shrink-0">{i + 1}</span>
                    <span className="text-zinc-300 text-xs font-mono truncate">
                      {page.page}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <span className="text-rose-400 text-xs font-semibold">
                      {page.rate}%
                    </span>
                    <span className="text-zinc-600 text-xs">exit</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className="bg-rose-500 h-1.5 rounded-full"
                      style={{ width: page.rate + "%" }}
                    ></div>
                  </div>
                  <span className="text-zinc-600 text-xs w-14 text-right">
                    {page.exits.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rage Clicks + Dead Clicks */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold text-sm">Rage Click Hotspots</h4>
            <span className="text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded-full">
              679 total
            </span>
          </div>
          <div className="space-y-3">
            {RAGE_HOTSPOTS.map((item) => (
              <div key={item.element} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-300 text-xs font-mono truncate">
                    {item.element}
                  </div>
                  <div className="text-zinc-600 text-xs mt-0.5">
                    {item.sessions} sessions affected
                  </div>
                </div>
                <div className="flex-shrink-0 text-amber-400 text-sm font-bold">
                  {item.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold text-sm">Dead Click Analysis</h4>
            <span className="text-zinc-400 text-xs bg-zinc-800 px-2 py-0.5 rounded-full">
              1,543 total
            </span>
          </div>
          <div className="space-y-3">
            {DEAD_CLICKS.map((item) => (
              <div key={item.element} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-300 text-xs font-mono truncate">
                    {item.element}
                  </div>
                  <div className="text-zinc-600 text-xs mt-0.5">{item.page}</div>
                </div>
                <div className="flex-shrink-0 text-zinc-400 text-sm font-bold">
                  {item.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SessionReplayViewer() {
  const TABS = ["Sessions", "Heatmaps", "Funnels", "Insights"];
  const [activeTab, setActiveTab] = useState<string>("Sessions");

  const summaryStats = [
    { label: "Sessions Today", value: "2,847", sub: "+12% vs yesterday" },
    { label: "Avg Duration", value: "3m 18s", sub: "↑ 14s improvement" },
    { label: "Rage Click Rate", value: "12.4%", sub: "↓ 2.1% this week" },
    { label: "Error Rate", value: "5.2%", sub: "↓ 1.3% this week" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">
              Session Replay
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              User behavior analysis and session recordings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span className="text-zinc-400 text-sm">Live</span>
            </div>
            <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors border border-zinc-700">
              Date Range
            </button>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium">
              Export Data
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          {summaryStats.map(({ label, value, sub }) => (
            <div
              key={label}
              className="bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-3"
            >
              <div className="text-zinc-500 text-xs mb-1">{label}</div>
              <div className="text-white text-xl font-bold">{value}</div>
              <div className="text-zinc-600 text-xs mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-zinc-900 rounded-xl border border-zinc-800 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-indigo-600 text-white shadow"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "Sessions" && <SessionsTab />}
        {activeTab === "Heatmaps" && <HeatmapsTab />}
        {activeTab === "Funnels" && <FunnelsTab />}
        {activeTab === "Insights" && <InsightsTab />}
      </div>
    </div>
  );
}
