import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "devices" | "sessions" | "policies" | "audit"
type TrustLevel = "trusted" | "unverified" | "blocked"
type DeviceKind = "desktop" | "mobile" | "tablet"
type EventType = "login" | "logout" | "block" | "unblock" | "trust" | "revoke"
type PolicyStatus = "compliant" | "non-compliant" | "warning"

interface Device {
  id: string
  name: string
  kind: DeviceKind
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  lastSeen: string
  firstSeen: string
  ipAddress: string
  location: string
  trustLevel: TrustLevel
  isCurrentDevice: boolean
  sessionCount: number
}

interface Session {
  id: string
  deviceId: string
  deviceName: string
  startedAt: string
  lastActivity: string
  ipAddress: string
  location: string
  browser: string
  os: string
}

interface Policy {
  id: string
  name: string
  description: string
  rule: string
  status: PolicyStatus
  affectedDevices: number
  totalDevices: number
  lastChecked: string
}

interface AuditEvent {
  id: string
  deviceId: string
  deviceName: string
  eventType: EventType
  timestamp: string
  ipAddress: string
  location: string
  details: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const DEVICES: Device[] = [
  {
    id: "dev-001",
    name: 'MacBook Pro 16"',
    kind: "desktop",
    browser: "Chrome",
    browserVersion: "121.0.6167",
    os: "macOS",
    osVersion: "14.3.1 Sonoma",
    lastSeen: "2026-02-22T05:30:00Z",
    firstSeen: "2024-08-15T09:00:00Z",
    ipAddress: "192.168.1.100",
    location: "Denver, CO",
    trustLevel: "trusted",
    isCurrentDevice: true,
    sessionCount: 2,
  },
  {
    id: "dev-002",
    name: "iPhone 15 Pro",
    kind: "mobile",
    browser: "Safari",
    browserVersion: "17.3",
    os: "iOS",
    osVersion: "17.3.1",
    lastSeen: "2026-02-22T03:15:00Z",
    firstSeen: "2024-10-01T14:00:00Z",
    ipAddress: "10.0.0.42",
    location: "Denver, CO",
    trustLevel: "trusted",
    isCurrentDevice: false,
    sessionCount: 1,
  },
  {
    id: "dev-003",
    name: "Windows Work PC",
    kind: "desktop",
    browser: "Firefox",
    browserVersion: "122.0",
    os: "Windows",
    osVersion: "11 Pro 23H2",
    lastSeen: "2026-02-21T17:45:00Z",
    firstSeen: "2025-01-10T08:30:00Z",
    ipAddress: "203.0.113.55",
    location: "Austin, TX",
    trustLevel: "unverified",
    isCurrentDevice: false,
    sessionCount: 0,
  },
  {
    id: "dev-004",
    name: "iPad Air",
    kind: "tablet",
    browser: "Safari",
    browserVersion: "17.2",
    os: "iPadOS",
    osVersion: "17.2",
    lastSeen: "2026-02-19T11:00:00Z",
    firstSeen: "2025-03-22T10:00:00Z",
    ipAddress: "192.168.1.105",
    location: "Denver, CO",
    trustLevel: "trusted",
    isCurrentDevice: false,
    sessionCount: 0,
  },
  {
    id: "dev-005",
    name: "Unknown Linux Device",
    kind: "desktop",
    browser: "Chrome",
    browserVersion: "120.0.6099",
    os: "Linux",
    osVersion: "Ubuntu 22.04",
    lastSeen: "2026-02-18T02:10:00Z",
    firstSeen: "2026-02-18T02:05:00Z",
    ipAddress: "198.51.100.23",
    location: "Amsterdam, NL",
    trustLevel: "blocked",
    isCurrentDevice: false,
    sessionCount: 0,
  },
  {
    id: "dev-006",
    name: "Android Phone",
    kind: "mobile",
    browser: "Chrome Mobile",
    browserVersion: "121.0.6167",
    os: "Android",
    osVersion: "14",
    lastSeen: "2026-02-20T09:30:00Z",
    firstSeen: "2025-07-15T16:00:00Z",
    ipAddress: "10.0.0.77",
    location: "Denver, CO",
    trustLevel: "unverified",
    isCurrentDevice: false,
    sessionCount: 1,
  },
]

const SESSIONS: Session[] = [
  {
    id: "sess-001",
    deviceId: "dev-001",
    deviceName: 'MacBook Pro 16"',
    startedAt: "2026-02-22T04:00:00Z",
    lastActivity: "2026-02-22T05:28:00Z",
    ipAddress: "192.168.1.100",
    location: "Denver, CO",
    browser: "Chrome 121",
    os: "macOS 14",
  },
  {
    id: "sess-002",
    deviceId: "dev-001",
    deviceName: 'MacBook Pro 16"',
    startedAt: "2026-02-21T20:15:00Z",
    lastActivity: "2026-02-21T23:45:00Z",
    ipAddress: "192.168.1.100",
    location: "Denver, CO",
    browser: "Chrome 121",
    os: "macOS 14",
  },
  {
    id: "sess-003",
    deviceId: "dev-002",
    deviceName: "iPhone 15 Pro",
    startedAt: "2026-02-22T03:00:00Z",
    lastActivity: "2026-02-22T03:15:00Z",
    ipAddress: "10.0.0.42",
    location: "Denver, CO",
    browser: "Safari 17",
    os: "iOS 17",
  },
  {
    id: "sess-004",
    deviceId: "dev-006",
    deviceName: "Android Phone",
    startedAt: "2026-02-20T09:00:00Z",
    lastActivity: "2026-02-20T09:30:00Z",
    ipAddress: "10.0.0.77",
    location: "Denver, CO",
    browser: "Chrome Mobile 121",
    os: "Android 14",
  },
]

const POLICIES: Policy[] = [
  {
    id: "pol-001",
    name: "Trusted Device Only",
    description: "Access restricted to devices with trusted status",
    rule: "device.trustLevel === 'trusted'",
    status: "compliant",
    affectedDevices: 3,
    totalDevices: 6,
    lastChecked: "2026-02-22T05:00:00Z",
  },
  {
    id: "pol-002",
    name: "MFA Required on New Devices",
    description: "Multi-factor authentication required for unverified devices",
    rule: "device.trustLevel !== 'unverified' || session.mfaVerified",
    status: "warning",
    affectedDevices: 2,
    totalDevices: 6,
    lastChecked: "2026-02-22T05:00:00Z",
  },
  {
    id: "pol-003",
    name: "Geographic Restriction",
    description: "Block logins from outside approved regions",
    rule: "device.location.country === 'US'",
    status: "non-compliant",
    affectedDevices: 1,
    totalDevices: 6,
    lastChecked: "2026-02-22T05:00:00Z",
  },
  {
    id: "pol-004",
    name: "Browser Version Minimum",
    description: "Enforce minimum supported browser version",
    rule: "browser.majorVersion >= 120",
    status: "compliant",
    affectedDevices: 6,
    totalDevices: 6,
    lastChecked: "2026-02-22T05:00:00Z",
  },
  {
    id: "pol-005",
    name: "Session Idle Timeout",
    description: "Sessions expire after 30 minutes of inactivity",
    rule: "session.idleMinutes < 30",
    status: "compliant",
    affectedDevices: 4,
    totalDevices: 4,
    lastChecked: "2026-02-22T05:00:00Z",
  },
  {
    id: "pol-006",
    name: "Max Concurrent Sessions",
    description: "No more than 3 active sessions per user",
    rule: "user.activeSessions <= 3",
    status: "warning",
    affectedDevices: 4,
    totalDevices: 6,
    lastChecked: "2026-02-22T05:00:00Z",
  },
]

const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "evt-001",
    deviceId: "dev-001",
    deviceName: 'MacBook Pro 16"',
    eventType: "login",
    timestamp: "2026-02-22T04:00:00Z",
    ipAddress: "192.168.1.100",
    location: "Denver, CO",
    details: "Successful login via Chrome",
  },
  {
    id: "evt-002",
    deviceId: "dev-005",
    deviceName: "Unknown Linux Device",
    eventType: "block",
    timestamp: "2026-02-18T02:10:00Z",
    ipAddress: "198.51.100.23",
    location: "Amsterdam, NL",
    details: "Auto-blocked: login from unrecognized location",
  },
  {
    id: "evt-003",
    deviceId: "dev-002",
    deviceName: "iPhone 15 Pro",
    eventType: "login",
    timestamp: "2026-02-22T03:00:00Z",
    ipAddress: "10.0.0.42",
    location: "Denver, CO",
    details: "Successful login via Safari",
  },
  {
    id: "evt-004",
    deviceId: "dev-003",
    deviceName: "Windows Work PC",
    eventType: "login",
    timestamp: "2026-02-21T08:00:00Z",
    ipAddress: "203.0.113.55",
    location: "Austin, TX",
    details: "Login from new location — MFA challenged",
  },
  {
    id: "evt-005",
    deviceId: "dev-001",
    deviceName: 'MacBook Pro 16"',
    eventType: "trust",
    timestamp: "2026-02-21T10:00:00Z",
    ipAddress: "192.168.1.100",
    location: "Denver, CO",
    details: "Device marked as trusted by user",
  },
  {
    id: "evt-006",
    deviceId: "dev-006",
    deviceName: "Android Phone",
    eventType: "login",
    timestamp: "2026-02-20T09:00:00Z",
    ipAddress: "10.0.0.77",
    location: "Denver, CO",
    details: "Successful login via Chrome Mobile",
  },
  {
    id: "evt-007",
    deviceId: "dev-001",
    deviceName: 'MacBook Pro 16"',
    eventType: "logout",
    timestamp: "2026-02-21T23:45:00Z",
    ipAddress: "192.168.1.100",
    location: "Denver, CO",
    details: "Manual logout",
  },
  {
    id: "evt-008",
    deviceId: "dev-005",
    deviceName: "Unknown Linux Device",
    eventType: "block",
    timestamp: "2026-02-18T02:05:00Z",
    ipAddress: "198.51.100.23",
    location: "Amsterdam, NL",
    details: "Flagged by geo-restriction policy",
  },
  {
    id: "evt-009",
    deviceId: "dev-003",
    deviceName: "Windows Work PC",
    eventType: "logout",
    timestamp: "2026-02-21T17:45:00Z",
    ipAddress: "203.0.113.55",
    location: "Austin, TX",
    details: "Session timeout — auto logout",
  },
  {
    id: "evt-010",
    deviceId: "dev-004",
    deviceName: "iPad Air",
    eventType: "login",
    timestamp: "2026-02-19T11:00:00Z",
    ipAddress: "192.168.1.105",
    location: "Denver, CO",
    details: "Successful login via Safari",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const now = new Date("2026-02-22T05:43:00Z")
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) {return "just now"}
  if (diffMin < 60) {return `${diffMin}m ago`}
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) {return `${diffHrs}h ago`}
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) {return `${diffDays}d ago`}
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Icon Components ──────────────────────────────────────────────────────────

function DesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function MobileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TabletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function ShieldAlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function ShieldOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}

function LogInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10,17 15,12 10,7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeviceKindIcon({ kind, className }: { kind: DeviceKind; className?: string }) {
  if (kind === "mobile") {return <MobileIcon className={className} />}
  if (kind === "tablet") {return <TabletIcon className={className} />}
  return <DesktopIcon className={className} />
}

function TrustBadge({ level }: { level: TrustLevel }) {
  if (level === "trusted") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <ShieldCheckIcon className="w-3 h-3" />
        Trusted
      </span>
    )
  }
  if (level === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <ShieldOffIcon className="w-3 h-3" />
        Blocked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <ShieldAlertIcon className="w-3 h-3" />
      Unverified
    </span>
  )
}

function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  if (status === "compliant") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircleIcon className="w-3 h-3" />
        Compliant
      </span>
    )
  }
  if (status === "non-compliant") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XIcon className="w-3 h-3" />
        Non-Compliant
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <AlertCircleIcon className="w-3 h-3" />
      Warning
    </span>
  )
}

function EventTypeBadge({ eventType }: { eventType: EventType }) {
  const configs: Record<EventType, { label: string; color: string }> = {
    login: { label: "Login", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    logout: { label: "Logout", color: "text-zinc-400 bg-zinc-700/30 border-zinc-700/40" },
    block: { label: "Blocked", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
    unblock: { label: "Unblocked", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    trust: { label: "Trusted", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
    revoke: { label: "Revoked", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  }
  const cfg = configs[eventType]
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", cfg.color)}>
      {cfg.label}
    </span>
  )
}

function EventIcon({ eventType }: { eventType: EventType }) {
  const base = "w-4 h-4"
  if (eventType === "login") {return <LogInIcon className={cn(base, "text-emerald-400")} />}
  if (eventType === "logout") {return <LogOutIcon className={cn(base, "text-zinc-400")} />}
  if (eventType === "block") {return <BanIcon className={cn(base, "text-rose-400")} />}
  if (eventType === "unblock") {return <ShieldCheckIcon className={cn(base, "text-emerald-400")} />}
  if (eventType === "trust") {return <ShieldCheckIcon className={cn(base, "text-indigo-400")} />}
  return <XIcon className={cn(base, "text-amber-400")} />
}

// ─── Devices Tab ──────────────────────────────────────────────────────────────

function DevicesTab() {
  const [selectedId, setSelectedId] = useState<string | null>("dev-001")
  const [trustFilter, setTrustFilter] = useState<TrustLevel | "all">("all")

  const filtered = trustFilter === "all"
    ? DEVICES
    : DEVICES.filter((d) => d.trustLevel === trustFilter)

  const selected = selectedId ? DEVICES.find((d) => d.id === selectedId) ?? null : null

  const trustCounts = {
    trusted: DEVICES.filter((d) => d.trustLevel === "trusted").length,
    unverified: DEVICES.filter((d) => d.trustLevel === "unverified").length,
    blocked: DEVICES.filter((d) => d.trustLevel === "blocked").length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-zinc-400">Trusted</span>
          </div>
          <span className="text-2xl font-bold text-white">{trustCounts.trusted}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlertIcon className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400">Unverified</span>
          </div>
          <span className="text-2xl font-bold text-white">{trustCounts.unverified}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldOffIcon className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-zinc-400">Blocked</span>
          </div>
          <span className="text-2xl font-bold text-white">{trustCounts.blocked}</span>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2">
        {(["all", "trusted", "unverified", "blocked"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setTrustFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize",
              trustFilter === f
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700"
            )}
          >
            {f === "all" ? `All (${DEVICES.length})` : f}
          </button>
        ))}
      </div>

      {/* List + Detail layout */}
      <div className="flex gap-4 min-h-[400px]">
        {/* Device list */}
        <div className="flex-shrink-0 w-72 flex flex-col gap-2">
          {filtered.map((device) => (
            <button
              key={device.id}
              onClick={() => setSelectedId(device.id)}
              className={cn(
                "w-full text-left bg-zinc-900 border rounded-xl p-3 transition-colors group",
                selectedId === device.id
                  ? "border-indigo-500 bg-zinc-800"
                  : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                  device.trustLevel === "trusted" ? "bg-emerald-500/10 text-emerald-400" :
                  device.trustLevel === "blocked" ? "bg-rose-500/10 text-rose-400" :
                  "bg-amber-500/10 text-amber-400"
                )}>
                  <DeviceKindIcon kind={device.kind} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">{device.name}</span>
                    {device.isCurrentDevice && (
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{device.browser} · {device.os}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ClockIcon className="w-3 h-3 text-zinc-600" />
                    <span className="text-xs text-zinc-500">{formatRelativeTime(device.lastSeen)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {selected ? (
            <div className="h-full flex flex-col">
              {/* Panel header */}
              <div className="flex items-start gap-4 p-5 border-b border-zinc-800">
                <div className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                  selected.trustLevel === "trusted" ? "bg-emerald-500/10 text-emerald-400" :
                  selected.trustLevel === "blocked" ? "bg-rose-500/10 text-rose-400" :
                  "bg-amber-500/10 text-amber-400"
                )}>
                  <DeviceKindIcon kind={selected.kind} className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{selected.name}</h3>
                    {selected.isCurrentDevice && (
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        Current Device
                      </span>
                    )}
                    <TrustBadge level={selected.trustLevel} />
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {selected.browser} {selected.browserVersion} · {selected.os} {selected.osVersion}
                  </p>
                </div>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Last Seen</div>
                    <div className="text-sm text-white">{formatDateTime(selected.lastSeen)}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{formatRelativeTime(selected.lastSeen)}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">First Seen</div>
                    <div className="text-sm text-white">{formatDateTime(selected.firstSeen)}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">IP Address</div>
                    <div className="text-sm font-mono text-white">{selected.ipAddress}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                      <GlobeIcon className="w-3 h-3" />
                      Location
                    </div>
                    <div className="text-sm text-white">{selected.location}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Device Type</div>
                    <div className="text-sm text-white capitalize">{selected.kind}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Active Sessions</div>
                    <div className="text-sm text-white">{selected.sessionCount}</div>
                  </div>
                </div>

                {/* Trust level bar */}
                <div className="mb-6">
                  <div className="text-xs text-zinc-500 mb-2">Trust Score</div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        selected.trustLevel === "trusted" ? "bg-emerald-500 w-full" :
                        selected.trustLevel === "unverified" ? "bg-amber-500 w-1/2" :
                        "bg-rose-500 w-[15%]"
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>Untrusted</span>
                    <span>Fully Trusted</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {selected.trustLevel !== "trusted" && selected.trustLevel !== "blocked" && (
                    <button className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
                      Mark as Trusted
                    </button>
                  )}
                  {selected.trustLevel !== "blocked" && (
                    <button className="px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-sm font-medium transition-colors">
                      Block Device
                    </button>
                  )}
                  {selected.trustLevel === "blocked" && (
                    <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors border border-zinc-700">
                      Unblock Device
                    </button>
                  )}
                  {!selected.isCurrentDevice && (
                    <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors border border-zinc-700">
                      Remove Device
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <DesktopIcon className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-zinc-500">Select a device to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab() {
  const [revokedIds, setRevokedIds] = useState<string[]>([])

  const activeSessions = SESSIONS.filter((s) => !revokedIds.includes(s.id))

  function handleRevoke(id: string) {
    setRevokedIds((prev) => [...prev, id])
  }

  function handleRevokeAll() {
    setRevokedIds(SESSIONS.map((s) => s.id))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">
            {activeSessions.length} active session{activeSessions.length !== 1 ? "s" : ""} across {
              new Set(activeSessions.map((s) => s.deviceId)).size
            } device{new Set(activeSessions.map((s) => s.deviceId)).size !== 1 ? "s" : ""}
          </p>
        </div>
        {activeSessions.length > 1 && (
          <button
            onClick={handleRevokeAll}
            className="px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-sm font-medium transition-colors"
          >
            Revoke All Other Sessions
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex flex-col gap-3">
        {activeSessions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 flex flex-col items-center text-center">
            <CheckCircleIcon className="w-10 h-10 text-emerald-500 mb-3" />
            <p className="text-white font-medium">All sessions revoked</p>
            <p className="text-zinc-500 text-sm mt-1">All other active sessions have been terminated.</p>
          </div>
        ) : (
          activeSessions.map((session) => {
            const isCurrentDevice = session.deviceId === "dev-001"
            return (
              <div
                key={session.id}
                className={cn(
                  "bg-zinc-900 border rounded-xl p-4 flex items-center gap-4",
                  isCurrentDevice ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                  isCurrentDevice ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-800 text-zinc-400"
                )}>
                  <DesktopIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{session.deviceName}</span>
                    {isCurrentDevice && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {session.browser} · {session.os}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <GlobeIcon className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-500">{session.location} · {session.ipAddress}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-500">
                        Started {formatRelativeTime(session.startedAt)} · Active {formatRelativeTime(session.lastActivity)}
                      </span>
                    </div>
                  </div>
                </div>
                {!isCurrentDevice && (
                  <button
                    onClick={() => handleRevoke(session.id)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
                  >
                    Revoke
                  </button>
                )}
                {isCurrentDevice && (
                  <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400">Active now</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Revoked notice */}
      {revokedIds.length > 0 && activeSessions.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
          <AlertCircleIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">{revokedIds.length} session{revokedIds.length !== 1 ? "s" : ""} revoked this session. Changes are reflected immediately.</p>
        </div>
      )}
    </div>
  )
}

// ─── Policies Tab ─────────────────────────────────────────────────────────────

function PoliciesTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const compliant = POLICIES.filter((p) => p.status === "compliant").length
  const warning = POLICIES.filter((p) => p.status === "warning").length
  const nonCompliant = POLICIES.filter((p) => p.status === "non-compliant").length

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status overview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-sm font-medium text-white mb-3">Policy Compliance Overview</div>
        <div className="flex items-center gap-2 mb-3">
          {/* Stacked bar */}
          <div className="flex-1 h-3 flex rounded-full overflow-hidden gap-0.5">
            {compliant > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(compliant / POLICIES.length) * 100}%` }}
              />
            )}
            {warning > 0 && (
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${(warning / POLICIES.length) * 100}%` }}
              />
            )}
            {nonCompliant > 0 && (
              <div
                className="bg-rose-500 transition-all"
                style={{ width: `${(nonCompliant / POLICIES.length) * 100}%` }}
              />
            )}
          </div>
          <span className="text-xs text-zinc-400 flex-shrink-0">
            {Math.round((compliant / POLICIES.length) * 100)}% compliant
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">Compliant ({compliant})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-zinc-400">Warning ({warning})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-zinc-400">Non-Compliant ({nonCompliant})</span>
          </div>
        </div>
      </div>

      {/* Policy list */}
      <div className="flex flex-col gap-2">
        {POLICIES.map((policy) => (
          <div
            key={policy.id}
            className={cn(
              "bg-zinc-900 border rounded-xl overflow-hidden transition-colors",
              policy.status === "non-compliant" ? "border-rose-500/30" :
              policy.status === "warning" ? "border-amber-500/30" :
              "border-zinc-800"
            )}
          >
            <button
              onClick={() => toggleExpand(policy.id)}
              className="w-full text-left p-4 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors"
            >
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                policy.status === "compliant" ? "bg-emerald-500/10" :
                policy.status === "non-compliant" ? "bg-rose-500/10" :
                "bg-amber-500/10"
              )}>
                {policy.status === "compliant" && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
                {policy.status === "non-compliant" && <XIcon className="w-4 h-4 text-rose-400" />}
                {policy.status === "warning" && <AlertCircleIcon className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{policy.name}</span>
                  <PolicyStatusBadge status={policy.status} />
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{policy.description}</p>
              </div>
              <div className="flex-shrink-0 text-xs text-zinc-500 text-right">
                <div>{policy.affectedDevices}/{policy.totalDevices} devices</div>
                <div className="mt-0.5">{formatRelativeTime(policy.lastChecked)}</div>
              </div>
              <svg
                className={cn("flex-shrink-0 w-4 h-4 text-zinc-500 transition-transform ml-2", expandedId === policy.id && "rotate-180")}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {expandedId === policy.id && (
              <div className="border-t border-zinc-800 p-4 bg-zinc-800/20">
                <div className="mb-3">
                  <div className="text-xs text-zinc-500 mb-1">Rule Expression</div>
                  <code className="text-xs text-indigo-300 bg-zinc-800 px-2 py-1 rounded font-mono">
                    {policy.rule}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Device compliance</div>
                    <div className="w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          policy.status === "compliant" ? "bg-emerald-500" :
                          policy.status === "non-compliant" ? "bg-rose-500" :
                          "bg-amber-500"
                        )}
                        style={{ width: `${(policy.affectedDevices / policy.totalDevices) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {policy.affectedDevices} of {policy.totalDevices} devices passing
                    </div>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">
                    Edit Policy
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab() {
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = AUDIT_EVENTS.filter((e) => {
    if (typeFilter !== "all" && e.eventType !== typeFilter) {return false}
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        e.deviceName.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q) ||
        e.ipAddress.includes(q)
      )
    }
    return true
  })

  const eventTypes: Array<{ value: EventType | "all"; label: string }> = [
    { value: "all", label: "All Events" },
    { value: "login", label: "Logins" },
    { value: "logout", label: "Logouts" },
    { value: "block", label: "Blocks" },
    { value: "trust", label: "Trust" },
    { value: "revoke", label: "Revokes" },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, devices, IPs..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {eventTypes.map((et) => (
            <button
              key={et.value}
              onClick={() => setTypeFilter(et.value)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                typeFilter === et.value
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700"
              )}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event count */}
      <div className="text-xs text-zinc-500">
        Showing {filtered.length} of {AUDIT_EVENTS.length} events
      </div>

      {/* Event log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center">
            <AlertCircleIcon className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-zinc-500">No events match your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filtered.map((event, idx) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors hover:bg-zinc-800/40",
                  idx === 0 && "rounded-t-xl"
                )}
              >
                {/* Timeline dot + icon */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-0.5">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    event.eventType === "login" ? "bg-emerald-500/10" :
                    event.eventType === "logout" ? "bg-zinc-800" :
                    event.eventType === "block" ? "bg-rose-500/10" :
                    event.eventType === "trust" ? "bg-indigo-500/10" :
                    event.eventType === "unblock" ? "bg-emerald-500/10" :
                    "bg-amber-500/10"
                  )}>
                    <EventIcon eventType={event.eventType} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{event.deviceName}</span>
                    <EventTypeBadge eventType={event.eventType} />
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{event.details}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <GlobeIcon className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-500">{event.location} · {event.ipAddress}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-zinc-500">{formatDateTime(event.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Relative time */}
                <div className="flex-shrink-0 text-xs text-zinc-600">
                  {formatRelativeTime(event.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserDeviceManager() {
  const [activeTab, setActiveTab] = useState<Tab>("devices")

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "devices", label: "Devices", count: DEVICES.length },
    { id: "sessions", label: "Sessions", count: SESSIONS.length },
    { id: "policies", label: "Policies", count: POLICIES.filter((p) => p.status !== "compliant").length },
    { id: "audit", label: "Audit Log", count: AUDIT_EVENTS.length },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ShieldCheckIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Device Manager</h1>
          </div>
          <p className="text-sm text-zinc-400 ml-11">
            Manage trusted devices, active sessions, and security policies for your account.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-mono",
                  activeTab === tab.id
                    ? "bg-indigo-500/40 text-indigo-100"
                    : "bg-zinc-800 text-zinc-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "devices" && <DevicesTab />}
          {activeTab === "sessions" && <SessionsTab />}
          {activeTab === "policies" && <PoliciesTab />}
          {activeTab === "audit" && <AuditTab />}
        </div>
      </div>
    </div>
  )
}
