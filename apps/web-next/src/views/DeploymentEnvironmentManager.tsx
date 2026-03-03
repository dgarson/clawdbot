import React, { useState } from "react"
import { cn } from "../lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "degraded" | "down" | "unknown"
type DeployStatus = "success" | "failed" | "in_progress" | "rolled_back"
type AccessRole = "admin" | "deployer" | "viewer"
type ApprovalStatus = "approved" | "pending" | "denied"

interface Service {
  id: string
  name: string
  version: string
  status: HealthStatus
  replicas: number
  desiredReplicas: number
  cpu: number
  memory: number
}

interface Environment {
  id: string
  name: string
  slug: string
  health: HealthStatus
  lastDeploy: string
  lastDeployBy: string
  branch: string
  region: string
  services: Service[]
  deployCount: number
  uptime: number
}

interface Deployment {
  id: string
  env: string
  service: string
  version: string
  previousVersion: string
  deployedBy: string
  deployedAt: string
  status: DeployStatus
  duration: string
  commit: string
  message: string
}

interface ConfigVar {
  key: string
  value: string
  secret: boolean
  lastModified: string
  modifiedBy: string
}

interface EnvConfig {
  envId: string
  vars: ConfigVar[]
}

interface AccessEntry {
  id: string
  name: string
  email: string
  role: AccessRole
  envId: string
  grantedAt: string
  grantedBy: string
  status: ApprovalStatus
  mfaEnabled: boolean
}

interface ApprovalRequest {
  id: string
  requestedBy: string
  requestedAt: string
  envId: string
  role: AccessRole
  reason: string
  status: ApprovalStatus
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const ENVIRONMENTS: Environment[] = [
  {
    id: "env-dev",
    name: "Development",
    slug: "dev",
    health: "healthy",
    lastDeploy: "2026-02-22T05:12:00Z",
    lastDeployBy: "piper",
    branch: "feat/env-manager",
    region: "us-west-2",
    deployCount: 142,
    uptime: 99.1,
    services: [
      { id: "svc-api", name: "api-gateway", version: "0.9.14-dev.3", status: "healthy", replicas: 1, desiredReplicas: 1, cpu: 18, memory: 42 },
      { id: "svc-web", name: "web-next", version: "1.4.2-dev.7", status: "healthy", replicas: 1, desiredReplicas: 1, cpu: 12, memory: 31 },
      { id: "svc-worker", name: "task-worker", version: "0.7.1-dev.2", status: "degraded", replicas: 0, desiredReplicas: 1, cpu: 0, memory: 0 },
      { id: "svc-db", name: "postgres-proxy", version: "2.1.0", status: "healthy", replicas: 1, desiredReplicas: 1, cpu: 8, memory: 55 },
    ],
  },
  {
    id: "env-staging",
    name: "Staging",
    slug: "staging",
    health: "healthy",
    lastDeploy: "2026-02-21T22:45:00Z",
    lastDeployBy: "quinn",
    branch: "dgarson/fork",
    region: "us-east-1",
    deployCount: 89,
    uptime: 99.7,
    services: [
      { id: "svc-api", name: "api-gateway", version: "0.9.13", status: "healthy", replicas: 2, desiredReplicas: 2, cpu: 24, memory: 48 },
      { id: "svc-web", name: "web-next", version: "1.4.1", status: "healthy", replicas: 2, desiredReplicas: 2, cpu: 19, memory: 37 },
      { id: "svc-worker", name: "task-worker", version: "0.7.0", status: "healthy", replicas: 2, desiredReplicas: 2, cpu: 31, memory: 62 },
      { id: "svc-db", name: "postgres-proxy", version: "2.1.0", status: "healthy", replicas: 2, desiredReplicas: 2, cpu: 14, memory: 67 },
      { id: "svc-cache", name: "redis-cluster", version: "7.2.3", status: "healthy", replicas: 3, desiredReplicas: 3, cpu: 9, memory: 44 },
    ],
  },
  {
    id: "env-prod",
    name: "Production",
    slug: "prod",
    health: "healthy",
    lastDeploy: "2026-02-20T18:00:00Z",
    lastDeployBy: "luis",
    branch: "dgarson/fork",
    region: "us-east-1 + eu-west-1",
    deployCount: 34,
    uptime: 99.98,
    services: [
      { id: "svc-api", name: "api-gateway", version: "0.9.12", status: "healthy", replicas: 6, desiredReplicas: 6, cpu: 61, memory: 72 },
      { id: "svc-web", name: "web-next", version: "1.4.0", status: "healthy", replicas: 4, desiredReplicas: 4, cpu: 44, memory: 58 },
      { id: "svc-worker", name: "task-worker", version: "0.6.9", status: "healthy", replicas: 4, desiredReplicas: 4, cpu: 52, memory: 69 },
      { id: "svc-db", name: "postgres-proxy", version: "2.1.0", status: "healthy", replicas: 4, desiredReplicas: 4, cpu: 38, memory: 81 },
      { id: "svc-cache", name: "redis-cluster", version: "7.2.3", status: "healthy", replicas: 6, desiredReplicas: 6, cpu: 27, memory: 63 },
      { id: "svc-search", name: "search-indexer", version: "1.0.4", status: "healthy", replicas: 2, desiredReplicas: 2, cpu: 33, memory: 55 },
    ],
  },
  {
    id: "env-canary",
    name: "Canary",
    slug: "canary",
    health: "degraded",
    lastDeploy: "2026-02-22T04:00:00Z",
    lastDeployBy: "wes",
    branch: "feat/search-v2",
    region: "us-east-1 (5%)",
    deployCount: 12,
    uptime: 97.3,
    services: [
      { id: "svc-api", name: "api-gateway", version: "0.9.14-rc.1", status: "healthy", replicas: 1, desiredReplicas: 1, cpu: 29, memory: 51 },
      { id: "svc-web", name: "web-next", version: "1.4.2-rc.2", status: "degraded", replicas: 1, desiredReplicas: 1, cpu: 88, memory: 79 },
      { id: "svc-search", name: "search-indexer", version: "2.0.0-rc.1", status: "down", replicas: 0, desiredReplicas: 1, cpu: 0, memory: 0 },
    ],
  },
]

const DEPLOYMENTS: Deployment[] = [
  { id: "d-001", env: "dev", service: "web-next", version: "1.4.2-dev.7", previousVersion: "1.4.2-dev.6", deployedBy: "piper", deployedAt: "2026-02-22T05:12:00Z", status: "success", duration: "1m 42s", commit: "a3f9c1d", message: "feat: add deployment manager view" },
  { id: "d-002", env: "canary", service: "search-indexer", version: "2.0.0-rc.1", previousVersion: "1.0.4", deployedBy: "wes", deployedAt: "2026-02-22T04:00:00Z", status: "failed", duration: "3m 11s", commit: "b7e2a44", message: "feat: search v2 indexing pipeline" },
  { id: "d-003", env: "canary", service: "api-gateway", version: "0.9.14-rc.1", previousVersion: "0.9.13", deployedBy: "wes", deployedAt: "2026-02-22T03:55:00Z", status: "success", duration: "2m 08s", commit: "c1d5f72", message: "feat: search v2 indexing pipeline" },
  { id: "d-004", env: "staging", service: "task-worker", version: "0.7.0", previousVersion: "0.6.9", deployedBy: "quinn", deployedAt: "2026-02-21T22:45:00Z", status: "success", duration: "2m 33s", commit: "d9a8b31", message: "fix: worker queue drain on shutdown" },
  { id: "d-005", env: "staging", service: "api-gateway", version: "0.9.13", previousVersion: "0.9.12", deployedBy: "quinn", deployedAt: "2026-02-21T22:40:00Z", status: "success", duration: "1m 57s", commit: "e4c7293", message: "fix: rate limit header propagation" },
  { id: "d-006", env: "prod", service: "web-next", version: "1.4.0", previousVersion: "1.3.9", deployedBy: "luis", deployedAt: "2026-02-20T18:00:00Z", status: "success", duration: "4m 22s", commit: "f2b1e85", message: "feat: analytics overview redesign" },
  { id: "d-007", env: "prod", service: "api-gateway", version: "0.9.12", previousVersion: "0.9.11", deployedBy: "luis", deployedAt: "2026-02-20T17:52:00Z", status: "success", duration: "3m 48s", commit: "g7d4c19", message: "feat: analytics overview redesign" },
  { id: "d-008", env: "dev", service: "task-worker", version: "0.7.1-dev.2", previousVersion: "0.7.1-dev.1", deployedBy: "reed", deployedAt: "2026-02-22T04:30:00Z", status: "failed", duration: "0m 44s", commit: "h5e9a02", message: "fix: memory leak in job processor" },
]

const ENV_CONFIGS: EnvConfig[] = [
  {
    envId: "env-dev",
    vars: [
      { key: "API_URL", value: "https://api.dev.clawdbot.io", secret: false, lastModified: "2026-02-10", modifiedBy: "piper" },
      { key: "LOG_LEVEL", value: "debug", secret: false, lastModified: "2026-02-01", modifiedBy: "quinn" },
      { key: "DB_POOL_SIZE", value: "5", secret: false, lastModified: "2026-01-28", modifiedBy: "reed" },
      { key: "DB_PASSWORD", value: "••••••••", secret: true, lastModified: "2026-02-15", modifiedBy: "luis" },
      { key: "FEATURE_SEARCH_V2", value: "true", secret: false, lastModified: "2026-02-20", modifiedBy: "wes" },
      { key: "RATE_LIMIT_RPM", value: "1000", secret: false, lastModified: "2026-02-05", modifiedBy: "piper" },
    ],
  },
  {
    envId: "env-staging",
    vars: [
      { key: "API_URL", value: "https://api.staging.clawdbot.io", secret: false, lastModified: "2026-02-10", modifiedBy: "piper" },
      { key: "LOG_LEVEL", value: "info", secret: false, lastModified: "2026-02-01", modifiedBy: "quinn" },
      { key: "DB_POOL_SIZE", value: "20", secret: false, lastModified: "2026-01-28", modifiedBy: "reed" },
      { key: "DB_PASSWORD", value: "••••••••", secret: true, lastModified: "2026-02-15", modifiedBy: "luis" },
      { key: "FEATURE_SEARCH_V2", value: "false", secret: false, lastModified: "2026-02-18", modifiedBy: "wes" },
      { key: "RATE_LIMIT_RPM", value: "5000", secret: false, lastModified: "2026-02-05", modifiedBy: "piper" },
    ],
  },
  {
    envId: "env-prod",
    vars: [
      { key: "API_URL", value: "https://api.clawdbot.io", secret: false, lastModified: "2026-01-15", modifiedBy: "luis" },
      { key: "LOG_LEVEL", value: "warn", secret: false, lastModified: "2026-01-20", modifiedBy: "luis" },
      { key: "DB_POOL_SIZE", value: "50", secret: false, lastModified: "2026-01-28", modifiedBy: "reed" },
      { key: "DB_PASSWORD", value: "••••••••", secret: true, lastModified: "2026-02-15", modifiedBy: "luis" },
      { key: "FEATURE_SEARCH_V2", value: "false", secret: false, lastModified: "2026-01-15", modifiedBy: "luis" },
      { key: "RATE_LIMIT_RPM", value: "10000", secret: false, lastModified: "2026-02-05", modifiedBy: "piper" },
    ],
  },
  {
    envId: "env-canary",
    vars: [
      { key: "API_URL", value: "https://api.canary.clawdbot.io", secret: false, lastModified: "2026-02-20", modifiedBy: "wes" },
      { key: "LOG_LEVEL", value: "debug", secret: false, lastModified: "2026-02-20", modifiedBy: "wes" },
      { key: "DB_POOL_SIZE", value: "10", secret: false, lastModified: "2026-02-20", modifiedBy: "wes" },
      { key: "DB_PASSWORD", value: "••••••••", secret: true, lastModified: "2026-02-20", modifiedBy: "wes" },
      { key: "FEATURE_SEARCH_V2", value: "true", secret: false, lastModified: "2026-02-20", modifiedBy: "wes" },
      { key: "RATE_LIMIT_RPM", value: "10000", secret: false, lastModified: "2026-02-20", modifiedBy: "wes" },
    ],
  },
]

const ACCESS_ENTRIES: AccessEntry[] = [
  { id: "a-001", name: "Luis Ramirez", email: "luis@clawdbot.io", role: "admin", envId: "env-prod", grantedAt: "2025-12-01", grantedBy: "xavier", status: "approved", mfaEnabled: true },
  { id: "a-002", name: "Quinn Park", email: "quinn@clawdbot.io", role: "deployer", envId: "env-prod", grantedAt: "2026-01-10", grantedBy: "luis", status: "approved", mfaEnabled: true },
  { id: "a-003", name: "Piper Chen", email: "piper@clawdbot.io", role: "viewer", envId: "env-prod", grantedAt: "2026-01-15", grantedBy: "luis", status: "approved", mfaEnabled: true },
  { id: "a-004", name: "Wes Turner", email: "wes@clawdbot.io", role: "deployer", envId: "env-canary", grantedAt: "2026-02-18", grantedBy: "luis", status: "approved", mfaEnabled: true },
  { id: "a-005", name: "Reed Nakamura", email: "reed@clawdbot.io", role: "deployer", envId: "env-staging", grantedAt: "2026-01-05", grantedBy: "luis", status: "approved", mfaEnabled: false },
  { id: "a-006", name: "Sam Okafor", email: "sam@clawdbot.io", role: "viewer", envId: "env-staging", grantedAt: "2026-01-05", grantedBy: "luis", status: "approved", mfaEnabled: false },
  { id: "a-007", name: "Piper Chen", email: "piper@clawdbot.io", role: "admin", envId: "env-dev", grantedAt: "2026-01-01", grantedBy: "luis", status: "approved", mfaEnabled: true },
  { id: "a-008", name: "Reed Nakamura", email: "reed@clawdbot.io", role: "admin", envId: "env-dev", grantedAt: "2026-01-01", grantedBy: "luis", status: "approved", mfaEnabled: false },
]

const APPROVAL_REQUESTS: ApprovalRequest[] = [
  { id: "req-001", requestedBy: "Sam Okafor", requestedAt: "2026-02-22T03:00:00Z", envId: "env-prod", role: "viewer", reason: "Need read access to investigate production latency spike.", status: "pending" },
  { id: "req-002", requestedBy: "Wes Turner", requestedAt: "2026-02-21T18:30:00Z", envId: "env-prod", role: "deployer", reason: "Search v2 canary promotion needs prod deploy access.", status: "pending" },
  { id: "req-003", requestedBy: "Piper Chen", requestedAt: "2026-02-20T10:00:00Z", envId: "env-staging", role: "admin", reason: "Need to update staging config vars for new feature.", status: "approved" },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) {return `${mins}m ago`}
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) {return `${hrs}h ago`}
  return `${Math.floor(hrs / 24)}d ago`
}

function healthColor(h: HealthStatus): string {
  if (h === "healthy") {return "text-emerald-400"}
  if (h === "degraded") {return "text-amber-400"}
  if (h === "down") {return "text-rose-400"}
  return "text-zinc-500"
}

function healthDot(h: HealthStatus): string {
  if (h === "healthy") {return "bg-emerald-400"}
  if (h === "degraded") {return "bg-amber-400"}
  if (h === "down") {return "bg-rose-500"}
  return "bg-zinc-600"
}

function statusColor(s: DeployStatus): string {
  if (s === "success") {return "text-emerald-400"}
  if (s === "failed") {return "text-rose-400"}
  if (s === "in_progress") {return "text-indigo-400"}
  if (s === "rolled_back") {return "text-amber-400"}
  return "text-zinc-400"
}

function statusBadge(s: DeployStatus): string {
  if (s === "success") {return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"}
  if (s === "failed") {return "bg-rose-500/15 text-rose-400 border-rose-500/30"}
  if (s === "in_progress") {return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"}
  if (s === "rolled_back") {return "bg-amber-500/15 text-amber-400 border-amber-500/30"}
  return "bg-zinc-800 text-zinc-400 border-zinc-700"
}

function roleBadge(r: AccessRole): string {
  if (r === "admin") {return "bg-rose-500/15 text-rose-400 border-rose-500/30"}
  if (r === "deployer") {return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"}
  return "bg-zinc-800 text-zinc-400 border-zinc-700"
}

function approvalBadge(s: ApprovalStatus): string {
  if (s === "approved") {return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"}
  if (s === "pending") {return "bg-amber-500/15 text-amber-400 border-amber-500/30"}
  return "bg-rose-500/15 text-rose-400 border-rose-500/30"
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-zinc-500">{value}%</span>
    </div>
  )
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function EnvHealthBadge({ health }: { health: HealthStatus }) {
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium capitalize", healthColor(health))}>
      <span className={cn("w-2 h-2 rounded-full inline-block", healthDot(health))} />
      {health}
    </span>
  )
}

// ── Environments Tab ───────────────────────────────────────────────────────

function ServiceRow({ svc }: { svc: Service }) {
  const replicaOk = svc.replicas === svc.desiredReplicas
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors">
      <div className="flex items-center gap-2 w-44 min-w-0">
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", healthDot(svc.status))} />
        <span className="text-sm text-white truncate">{svc.name}</span>
      </div>
      <span className="text-xs text-zinc-500 font-mono w-36 flex-shrink-0">{svc.version}</span>
      <span className={cn("text-xs w-20 flex-shrink-0", replicaOk ? "text-zinc-400" : "text-amber-400")}>
        {svc.replicas}/{svc.desiredReplicas} pods
      </span>
      <div className="w-28 flex-shrink-0">
        <MiniBar value={svc.cpu} color={svc.cpu > 80 ? "bg-rose-500" : svc.cpu > 60 ? "bg-amber-400" : "bg-indigo-500"} />
      </div>
      <div className="w-28 flex-shrink-0">
        <MiniBar value={svc.memory} color={svc.memory > 85 ? "bg-rose-500" : svc.memory > 70 ? "bg-amber-400" : "bg-emerald-500"} />
      </div>
    </div>
  )
}

function EnvDetail({ env }: { env: Environment }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold text-lg">{env.name}</h3>
            <p className="text-zinc-500 text-sm mt-0.5">{env.slug} · {env.region}</p>
          </div>
          <EnvHealthBadge health={env.health} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-500 text-xs mb-1">Last Deploy</p>
            <p className="text-white text-sm font-medium">{timeAgo(env.lastDeploy)}</p>
            <p className="text-zinc-500 text-xs">by {env.lastDeployBy}</p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-500 text-xs mb-1">Deploys (30d)</p>
            <p className="text-white text-sm font-medium">{env.deployCount}</p>
            <p className="text-zinc-500 text-xs">deployments</p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-500 text-xs mb-1">Uptime</p>
            <p className={cn("text-sm font-medium", env.uptime > 99.5 ? "text-emerald-400" : env.uptime > 98 ? "text-amber-400" : "text-rose-400")}>{env.uptime}%</p>
            <p className="text-zinc-500 text-xs">30-day avg</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Branch:</span>
          <code className="text-indigo-400 text-xs bg-indigo-500/10 px-2 py-0.5 rounded font-mono">{env.branch}</code>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-4 px-4 py-2 bg-zinc-800/60 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
          <span className="w-44">Service</span>
          <span className="w-36">Version</span>
          <span className="w-20">Replicas</span>
          <span className="w-28">CPU</span>
          <span className="w-28">Memory</span>
        </div>
        {env.services.map(svc => <ServiceRow key={svc.id} svc={svc} />)}
      </div>
    </div>
  )
}

function EnvironmentsTab() {
  const [selectedId, setSelectedId] = useState<string>(ENVIRONMENTS[0].id)
  const selected = ENVIRONMENTS.find(e => e.id === selectedId) ?? ENVIRONMENTS[0]

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* List */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-2">
        {ENVIRONMENTS.map(env => (
          <button
            key={env.id}
            onClick={() => setSelectedId(env.id)}
            className={cn(
              "w-full text-left rounded-xl border p-4 transition-all",
              selectedId === env.id
                ? "border-indigo-500/50 bg-indigo-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn("text-sm font-semibold", selectedId === env.id ? "text-white" : "text-white")}>{env.name}</span>
              <span className={cn("w-2 h-2 rounded-full", healthDot(env.health))} />
            </div>
            <p className="text-xs text-zinc-500 mb-1">{env.slug} · {env.services.length} services</p>
            <p className="text-xs text-zinc-500">Deployed {timeAgo(env.lastDeploy)}</p>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col min-h-0 overflow-hidden">
        <EnvDetail env={selected} />
      </div>
    </div>
  )
}

// ── Deployments Tab ────────────────────────────────────────────────────────

function DeploymentsTab() {
  const [rolledBack, setRolledBack] = useState<string[]>([])
  const [filterEnv, setFilterEnv] = useState<string>("all")

  const filtered = filterEnv === "all" ? DEPLOYMENTS : DEPLOYMENTS.filter(d => d.env === filterEnv)

  function handleRollback(id: string) {
    setRolledBack(prev => [...prev, id])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {["all", "dev", "staging", "prod", "canary"].map(env => (
          <button
            key={env}
            onClick={() => setFilterEnv(env)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize",
              filterEnv === env
                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
            )}
          >
            {env}
          </button>
        ))}
        <span className="ml-auto text-sm text-zinc-500">{filtered.length} events</span>
      </div>

      {/* Events */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_130px_140px_120px_130px] gap-4 px-5 py-2.5 bg-zinc-800/60 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
          <span>Service / Message</span>
          <span>Environment</span>
          <span>Version</span>
          <span>Deployed By</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {filtered.map(dep => {
          const wasRolledBack = rolledBack.includes(dep.id)
          return (
            <div key={dep.id} className="grid grid-cols-[1fr_120px_130px_140px_120px_130px] gap-4 px-5 py-4 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{dep.service}</span>
                  <code className="text-xs text-zinc-500 font-mono">{dep.commit}</code>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{dep.message}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(dep.deployedAt)} · {dep.duration}</p>
              </div>
              <span className="text-sm text-zinc-300 capitalize">{dep.env}</span>
              <div>
                <p className="text-xs font-mono text-white">{dep.version}</p>
                <p className="text-xs font-mono text-zinc-600">← {dep.previousVersion}</p>
              </div>
              <span className="text-sm text-zinc-300">{dep.deployedBy}</span>
              <span className={cn("text-xs font-medium px-2 py-1 rounded-md border inline-block", statusBadge(wasRolledBack ? "rolled_back" : dep.status))}>
                {wasRolledBack ? "rolled back" : dep.status.replace(/_/g, " ")}
              </span>
              <div>
                {!wasRolledBack && dep.status !== "in_progress" && dep.env !== "prod" && (
                  <button
                    onClick={() => handleRollback(dep.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all"
                  >
                    ↩ Rollback
                  </button>
                )}
                {dep.env === "prod" && !wasRolledBack && dep.status !== "in_progress" && (
                  <span className="text-xs text-zinc-600 italic">Approval req.</span>
                )}
                {wasRolledBack && (
                  <span className="text-xs text-amber-400">✓ Initiated</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Config Tab ─────────────────────────────────────────────────────────────

function ConfigTab() {
  const [selectedEnvId, setSelectedEnvId] = useState<string>("env-dev")
  const [diffMode, setDiffMode] = useState<boolean>(false)

  const currentConfig = ENV_CONFIGS.find(c => c.envId === selectedEnvId)
  const stagingConfig = ENV_CONFIGS.find(c => c.envId === "env-staging")

  function getDiff(key: string, val: string): "same" | "different" | "new" {
    const stagingVar = stagingConfig?.vars.find(v => v.key === key)
    if (!stagingVar) {return "new"}
    if (stagingVar.value === val) {return "same"}
    return "different"
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ENVIRONMENTS.map(env => (
            <button
              key={env.id}
              onClick={() => setSelectedEnvId(env.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize",
                selectedEnvId === env.id
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
              )}
            >
              {env.slug}
            </button>
          ))}
        </div>
        {selectedEnvId !== "env-staging" && (
          <button
            onClick={() => setDiffMode(d => !d)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5",
              diffMode
                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <span>⎇</span> Diff vs staging
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[240px_1fr_120px_160px_130px] gap-4 px-5 py-2.5 bg-zinc-800/60 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
          <span>Key</span>
          <span>Value</span>
          <span>Type</span>
          <span>Modified By</span>
          <span>Last Modified</span>
        </div>
        {currentConfig?.vars.map(v => {
          const diff = diffMode ? getDiff(v.key, v.value) : "same"
          const stagingVal = stagingConfig?.vars.find(sv => sv.key === v.key)?.value
          return (
            <div
              key={v.key}
              className={cn(
                "grid grid-cols-[240px_1fr_120px_160px_130px] gap-4 px-5 py-3.5 border-b border-zinc-800 last:border-0 transition-colors items-start",
                diffMode && diff === "different" ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-zinc-800/30",
                diffMode && diff === "new" ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""
              )}
            >
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-white">{v.key}</code>
                {diffMode && diff === "different" && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">changed</span>}
                {diffMode && diff === "new" && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">new</span>}
              </div>
              <div>
                <code className={cn("text-sm font-mono", v.secret ? "text-zinc-600" : "text-indigo-300")}>{v.value}</code>
                {diffMode && diff === "different" && stagingVal && (
                  <p className="text-xs font-mono text-zinc-500 mt-1 line-through">{stagingVal} <span className="no-underline text-zinc-600">(staging)</span></p>
                )}
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-md border inline-block", v.secret ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700")}>
                {v.secret ? "secret" : "plain"}
              </span>
              <span className="text-sm text-zinc-400">{v.modifiedBy}</span>
              <span className="text-sm text-zinc-500">{v.lastModified}</span>
            </div>
          )
        })}
      </div>

      {diffMode && selectedEnvId !== "env-staging" && (
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500/30 inline-block" /> Changed vs staging</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/20 inline-block" /> Not in staging</span>
        </div>
      )}
    </div>
  )
}

// ── Access Tab ─────────────────────────────────────────────────────────────

function AccessTab() {
  const [selectedEnvId, setSelectedEnvId] = useState<string>("all")
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(APPROVAL_REQUESTS)

  const filteredAccess = selectedEnvId === "all"
    ? ACCESS_ENTRIES
    : ACCESS_ENTRIES.filter(a => a.envId === selectedEnvId)

  function handleApproval(id: string, decision: ApprovalStatus) {
    setApprovals(prev => prev.map(r => r.id === id ? { ...r, status: decision } : r))
  }

  const pendingCount = approvals.filter(r => r.status === "pending").length

  return (
    <div className="flex flex-col gap-6">
      {/* Pending Approvals */}
      {pendingCount > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-amber-500/30 overflow-hidden">
          <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <span className="text-amber-400 text-sm font-semibold">⏳ Pending Approvals</span>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">{pendingCount}</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {approvals.map(req => {
              const env = ENVIRONMENTS.find(e => e.id === req.envId)
              return (
                <div key={req.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{req.requestedBy}</span>
                      <span className="text-zinc-500 text-xs">→</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded border", roleBadge(req.role))}>{req.role}</span>
                      <span className="text-xs text-zinc-500">on</span>
                      <span className="text-xs text-white font-medium">{env?.name}</span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">{req.reason}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(req.requestedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {req.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleApproval(req.id, "approved")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleApproval(req.id, "denied")}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium hover:bg-rose-500/25 transition-all"
                        >
                          ✕ Deny
                        </button>
                      </>
                    ) : (
                      <span className={cn("text-xs px-2.5 py-1 rounded-md border", approvalBadge(req.status))}>
                        {req.status}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Access list */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400 mr-1">Filter:</span>
          {[{ id: "all", label: "All" }, ...ENVIRONMENTS.map(e => ({ id: e.id, label: e.name }))].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedEnvId(opt.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                selectedEnvId === opt.id
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_120px_120px_80px] gap-4 px-5 py-2.5 bg-zinc-800/60 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <span>User</span>
            <span>Environment</span>
            <span>Role</span>
            <span>Granted By</span>
            <span>MFA</span>
          </div>
          {filteredAccess.map(entry => {
            const env = ENVIRONMENTS.find(e => e.id === entry.envId)
            return (
              <div key={entry.id} className="grid grid-cols-[1fr_160px_120px_120px_80px] gap-4 px-5 py-3.5 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors items-center">
                <div>
                  <p className="text-sm text-white font-medium">{entry.name}</p>
                  <p className="text-xs text-zinc-500">{entry.email}</p>
                </div>
                <span className="text-sm text-zinc-300">{env?.name}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-md border inline-block w-fit", roleBadge(entry.role))}>{entry.role}</span>
                <div>
                  <p className="text-sm text-zinc-400">{entry.grantedBy}</p>
                  <p className="text-xs text-zinc-600">{entry.grantedAt}</p>
                </div>
                <span className={cn("text-xs font-medium", entry.mfaEnabled ? "text-emerald-400" : "text-rose-400")}>
                  {entry.mfaEnabled ? "✓ On" : "✕ Off"}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Root Component ─────────────────────────────────────────────────────────

type Tab = "environments" | "deployments" | "config" | "access"

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "environments", label: "Environments", icon: "🌐" },
  { id: "deployments", label: "Deployments", icon: "🚀" },
  { id: "config", label: "Config", icon: "⚙️" },
  { id: "access", label: "Access", icon: "🔑" },
]

export default function DeploymentEnvironmentManager() {
  const [activeTab, setActiveTab] = useState<Tab>("environments")

  const healthSummary = {
    healthy: ENVIRONMENTS.filter(e => e.health === "healthy").length,
    degraded: ENVIRONMENTS.filter(e => e.health === "degraded").length,
    down: ENVIRONMENTS.filter(e => e.health === "down").length,
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Deployment Environment Manager</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage environments, track deployments, configure variables, and control access.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{healthSummary.healthy} healthy</span>
          </div>
          {healthSummary.degraded > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{healthSummary.degraded} degraded</span>
            </div>
          )}
          {healthSummary.down > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{healthSummary.down} down</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
              activeTab === tab.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={cn("flex-1", activeTab === "environments" ? "flex flex-col" : "")}>
        {activeTab === "environments" && <EnvironmentsTab />}
        {activeTab === "deployments" && <DeploymentsTab />}
        {activeTab === "config" && <ConfigTab />}
        {activeTab === "access" && <AccessTab />}
      </div>
    </div>
  )
}
