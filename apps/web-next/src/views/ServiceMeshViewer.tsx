import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Namespace = "frontend" | "backend" | "data" | "infra"

type ConnectionHealth = "healthy" | "degraded" | "broken"

interface Service {
  id: string
  name: string
  version: string
  namespace: Namespace
  requestRate: number
  errorRate: number
  p99Latency: number
}

interface Connection {
  serviceId: string
  name: string
  health: ConnectionHealth
  trafficRate: number
}

interface ServiceDetail {
  serviceId: string
  upstreams: Connection[]
  downstreams: Connection[]
}

type Protocol = "HTTP" | "gRPC" | "TCP"

interface TrafficFlow {
  id: string
  source: string
  destination: string
  sourceNs: Namespace
  destNs: Namespace
  protocol: Protocol
  requestsPerSec: number
  successRate: number
  p50Latency: number
  p99Latency: number
  bytesPerSec: number
}

type MtlsMode = "enabled" | "permissive" | "disabled"

interface CircuitBreaker {
  threshold: number
  windowSeconds: number
  status: "open" | "closed" | "half-open"
}

interface RetryPolicy {
  attempts: number
  perTryTimeoutMs: number
}

interface NamespacePolicy {
  namespace: Namespace
  mtls: MtlsMode
  circuitBreaker: CircuitBreaker
  retryPolicy: RetryPolicy
  timeoutMs: number
}

type CertStatus = "valid" | "expiring" | "expired"

interface Certificate {
  id: string
  workload: string
  namespace: Namespace
  expiry: string
  issuer: string
  status: CertStatus
  lastRotated: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SERVICES: Service[] = [
  { id: "s1",  name: "web-gateway",      version: "v2.4.1", namespace: "frontend", requestRate: 1240, errorRate: 0.3,  p99Latency: 48  },
  { id: "s2",  name: "ui-renderer",      version: "v1.8.0", namespace: "frontend", requestRate: 890,  errorRate: 0.1,  p99Latency: 32  },
  { id: "s3",  name: "api-router",       version: "v3.1.2", namespace: "backend",  requestRate: 2100, errorRate: 1.2,  p99Latency: 95  },
  { id: "s4",  name: "auth-service",     version: "v2.0.5", namespace: "backend",  requestRate: 560,  errorRate: 0.0,  p99Latency: 22  },
  { id: "s5",  name: "user-service",     version: "v1.9.3", namespace: "backend",  requestRate: 780,  errorRate: 0.5,  p99Latency: 67  },
  { id: "s6",  name: "billing-service",  version: "v2.2.0", namespace: "backend",  requestRate: 340,  errorRate: 2.8,  p99Latency: 210 },
  { id: "s7",  name: "postgres-primary", version: "v14.5",  namespace: "data",     requestRate: 1850, errorRate: 0.0,  p99Latency: 12  },
  { id: "s8",  name: "redis-cluster",    version: "v7.0.1", namespace: "data",     requestRate: 4200, errorRate: 0.0,  p99Latency: 3   },
  { id: "s9",  name: "kafka-broker",     version: "v3.4.0", namespace: "data",     requestRate: 620,  errorRate: 0.2,  p99Latency: 18  },
  { id: "s10", name: "prometheus",       version: "v2.45",  namespace: "infra",    requestRate: 280,  errorRate: 0.0,  p99Latency: 55  },
  { id: "s11", name: "jaeger-collector", version: "v1.47",  namespace: "infra",    requestRate: 1100, errorRate: 0.0,  p99Latency: 28  },
  { id: "s12", name: "envoy-proxy",      version: "v1.27",  namespace: "infra",    requestRate: 3400, errorRate: 0.4,  p99Latency: 8   },
]

const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  s1: {
    serviceId: "s1",
    upstreams: [],
    downstreams: [
      { serviceId: "s3", name: "api-router",   health: "healthy",  trafficRate: 1200 },
      { serviceId: "s4", name: "auth-service", health: "healthy",  trafficRate: 420  },
    ],
  },
  s3: {
    serviceId: "s3",
    upstreams: [
      { serviceId: "s1", name: "web-gateway", health: "healthy",  trafficRate: 1200 },
      { serviceId: "s2", name: "ui-renderer", health: "healthy",  trafficRate: 860  },
    ],
    downstreams: [
      { serviceId: "s5", name: "user-service",    health: "healthy",   trafficRate: 780 },
      { serviceId: "s6", name: "billing-service", health: "degraded",  trafficRate: 340 },
      { serviceId: "s7", name: "postgres-primary",health: "healthy",   trafficRate: 950 },
      { serviceId: "s8", name: "redis-cluster",   health: "healthy",   trafficRate: 1800 },
    ],
  },
  s6: {
    serviceId: "s6",
    upstreams: [
      { serviceId: "s3", name: "api-router", health: "degraded", trafficRate: 340 },
    ],
    downstreams: [
      { serviceId: "s7", name: "postgres-primary", health: "broken",  trafficRate: 0   },
      { serviceId: "s9", name: "kafka-broker",     health: "degraded", trafficRate: 120 },
    ],
  },
}

const TRAFFIC_FLOWS: TrafficFlow[] = [
  { id: "t1",  source: "web-gateway",      destination: "api-router",       sourceNs: "frontend", destNs: "backend",  protocol: "HTTP",  requestsPerSec: 1200, successRate: 99.7, p50Latency: 18,  p99Latency: 95,  bytesPerSec: 248000 },
  { id: "t2",  source: "web-gateway",      destination: "auth-service",     sourceNs: "frontend", destNs: "backend",  protocol: "gRPC",  requestsPerSec: 420,  successRate: 100,  p50Latency: 8,   p99Latency: 22,  bytesPerSec: 52000  },
  { id: "t3",  source: "ui-renderer",      destination: "api-router",       sourceNs: "frontend", destNs: "backend",  protocol: "HTTP",  requestsPerSec: 860,  successRate: 99.1, p50Latency: 22,  p99Latency: 88,  bytesPerSec: 185000 },
  { id: "t4",  source: "api-router",       destination: "user-service",     sourceNs: "backend",  destNs: "backend",  protocol: "gRPC",  requestsPerSec: 780,  successRate: 99.5, p50Latency: 14,  p99Latency: 67,  bytesPerSec: 96000  },
  { id: "t5",  source: "api-router",       destination: "billing-service",  sourceNs: "backend",  destNs: "backend",  protocol: "HTTP",  requestsPerSec: 340,  successRate: 97.2, p50Latency: 82,  p99Latency: 210, bytesPerSec: 74000  },
  { id: "t6",  source: "api-router",       destination: "postgres-primary", sourceNs: "backend",  destNs: "data",     protocol: "TCP",   requestsPerSec: 950,  successRate: 100,  p50Latency: 4,   p99Latency: 12,  bytesPerSec: 420000 },
  { id: "t7",  source: "api-router",       destination: "redis-cluster",    sourceNs: "backend",  destNs: "data",     protocol: "TCP",   requestsPerSec: 1800, successRate: 100,  p50Latency: 1,   p99Latency: 3,   bytesPerSec: 128000 },
  { id: "t8",  source: "user-service",     destination: "postgres-primary", sourceNs: "backend",  destNs: "data",     protocol: "TCP",   requestsPerSec: 620,  successRate: 100,  p50Latency: 4,   p99Latency: 11,  bytesPerSec: 310000 },
  { id: "t9",  source: "billing-service",  destination: "kafka-broker",     sourceNs: "backend",  destNs: "data",     protocol: "TCP",   requestsPerSec: 120,  successRate: 98.3, p50Latency: 6,   p99Latency: 18,  bytesPerSec: 42000  },
  { id: "t10", source: "envoy-proxy",      destination: "web-gateway",      sourceNs: "infra",    destNs: "frontend", protocol: "HTTP",  requestsPerSec: 1240, successRate: 99.7, p50Latency: 2,   p99Latency: 8,   bytesPerSec: 560000 },
  { id: "t11", source: "prometheus",       destination: "api-router",       sourceNs: "infra",    destNs: "backend",  protocol: "HTTP",  requestsPerSec: 45,   successRate: 100,  p50Latency: 12,  p99Latency: 55,  bytesPerSec: 8200   },
  { id: "t12", source: "jaeger-collector", destination: "kafka-broker",     sourceNs: "infra",    destNs: "data",     protocol: "gRPC",  requestsPerSec: 280,  successRate: 100,  p50Latency: 5,   p99Latency: 28,  bytesPerSec: 95000  },
  { id: "t13", source: "billing-service",  destination: "postgres-primary", sourceNs: "backend",  destNs: "data",     protocol: "TCP",   requestsPerSec: 0,    successRate: 0,    p50Latency: 0,   p99Latency: 0,   bytesPerSec: 0      },
]

const NAMESPACE_POLICIES: NamespacePolicy[] = [
  {
    namespace: "frontend",
    mtls: "enabled",
    circuitBreaker: { threshold: 50,  windowSeconds: 30, status: "closed"    },
    retryPolicy:    { attempts: 3, perTryTimeoutMs: 2000 },
    timeoutMs:      5000,
  },
  {
    namespace: "backend",
    mtls: "enabled",
    circuitBreaker: { threshold: 25,  windowSeconds: 10, status: "half-open" },
    retryPolicy:    { attempts: 2, perTryTimeoutMs: 3000 },
    timeoutMs:      10000,
  },
  {
    namespace: "data",
    mtls: "permissive",
    circuitBreaker: { threshold: 10,  windowSeconds: 60, status: "closed"    },
    retryPolicy:    { attempts: 1, perTryTimeoutMs: 5000 },
    timeoutMs:      30000,
  },
  {
    namespace: "infra",
    mtls: "disabled",
    circuitBreaker: { threshold: 100, windowSeconds: 60, status: "closed"    },
    retryPolicy:    { attempts: 3, perTryTimeoutMs: 1000 },
    timeoutMs:      3000,
  },
]

const CERTIFICATES: Certificate[] = [
  { id: "c1",  workload: "web-gateway",      namespace: "frontend", expiry: "2026-04-15", issuer: "istio-ca",  status: "valid",    lastRotated: "2026-01-15" },
  { id: "c2",  workload: "ui-renderer",      namespace: "frontend", expiry: "2026-03-02", issuer: "istio-ca",  status: "expiring", lastRotated: "2025-12-02" },
  { id: "c3",  workload: "api-router",       namespace: "backend",  expiry: "2026-05-20", issuer: "istio-ca",  status: "valid",    lastRotated: "2026-02-20" },
  { id: "c4",  workload: "auth-service",     namespace: "backend",  expiry: "2026-04-08", issuer: "istio-ca",  status: "valid",    lastRotated: "2026-01-08" },
  { id: "c5",  workload: "user-service",     namespace: "backend",  expiry: "2026-02-25", issuer: "istio-ca",  status: "expiring", lastRotated: "2025-11-25" },
  { id: "c6",  workload: "billing-service",  namespace: "backend",  expiry: "2026-02-18", issuer: "istio-ca",  status: "expired",  lastRotated: "2025-11-18" },
  { id: "c7",  workload: "postgres-primary", namespace: "data",     expiry: "2026-06-01", issuer: "vault-pki", status: "valid",    lastRotated: "2026-02-01" },
  { id: "c8",  workload: "redis-cluster",    namespace: "data",     expiry: "2026-05-14", issuer: "vault-pki", status: "valid",    lastRotated: "2026-01-14" },
  { id: "c9",  workload: "kafka-broker",     namespace: "data",     expiry: "2026-03-05", issuer: "vault-pki", status: "expiring", lastRotated: "2025-12-05" },
  { id: "c10", workload: "prometheus",       namespace: "infra",    expiry: "2026-07-10", issuer: "istio-ca",  status: "valid",    lastRotated: "2026-01-10" },
  { id: "c11", workload: "jaeger-collector", namespace: "infra",    expiry: "2026-04-22", issuer: "istio-ca",  status: "valid",    lastRotated: "2026-01-22" },
  { id: "c12", workload: "envoy-proxy",      namespace: "infra",    expiry: "2026-02-28", issuer: "istio-ca",  status: "expiring", lastRotated: "2025-11-28" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NS_COLORS: Record<Namespace, string> = {
  frontend: "text-primary bg-primary/10 border-primary/30",
  backend:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  data:     "text-amber-400 bg-amber-500/10 border-amber-500/30",
  infra:    "text-[var(--color-text-primary)] bg-[var(--color-surface-2)] border-[var(--color-border)]",
}

const HEALTH_COLORS: Record<ConnectionHealth, string> = {
  healthy:  "text-emerald-400",
  degraded: "text-amber-400",
  broken:   "text-rose-400",
}

const HEALTH_DOT: Record<ConnectionHealth, string> = {
  healthy:  "bg-emerald-400",
  degraded: "bg-amber-400",
  broken:   "bg-rose-400",
}

const CERT_STATUS_COLORS: Record<CertStatus, string> = {
  valid:    "text-emerald-400 bg-emerald-400/10 border-emerald-500/30",
  expiring: "text-amber-400 bg-amber-400/10 border-amber-500/30",
  expired:  "text-rose-400 bg-rose-400/10 border-rose-500/30",
}

const MTLS_COLORS: Record<MtlsMode, string> = {
  enabled:    "text-emerald-400 bg-emerald-400/10 border-emerald-500/30",
  permissive: "text-amber-400 bg-amber-400/10 border-amber-500/30",
  disabled:   "text-rose-400 bg-rose-400/10 border-rose-500/30",
}

const CB_STATUS_COLORS: Record<string, string> = {
  closed:     "text-emerald-400",
  "half-open":"text-amber-400",
  open:       "text-rose-400",
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", className)}>
      {label}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] px-4 py-3 flex flex-col gap-1">
      <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</span>
      <span className="text-xl font-semibold text-[var(--color-text-primary)]">{value}</span>
      {sub && <span className="text-xs text-[var(--color-text-secondary)]">{sub}</span>}
    </div>
  )
}

// ─── Tab 1: Topology ──────────────────────────────────────────────────────────

function TopologyTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const namespaces: Namespace[] = ["frontend", "backend", "data", "infra"]

  function handleSelect(id: string) {
    setSelectedId(prev => (prev === id ? null : id))
  }

  const detail = selectedId ? SERVICE_DETAILS[selectedId] : null
  const selectedService = selectedId ? SERVICES.find(s => s.id === selectedId) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {namespaces.map(ns => {
          const services = SERVICES.filter(s => s.namespace === ns)
          return (
            <div key={ns} className="space-y-2">
              <div className={cn("text-xs font-semibold px-2 py-1 rounded-md border w-fit", NS_COLORS[ns])}>
                {ns}
              </div>
              <div className="space-y-2">
                {services.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => handleSelect(svc.id)}
                    className={cn(
                      "w-full text-left bg-[var(--color-surface-1)] rounded-lg border p-3 transition-colors hover:border-primary/60",
                      selectedId === svc.id
                        ? "border-primary ring-1 ring-indigo-500/40"
                        : "border-[var(--color-border)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{svc.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-1 shrink-0">{svc.version}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div>
                        <div className="text-[var(--color-text-secondary)]">RPS</div>
                        <div className="text-[var(--color-text-primary)]">{svc.requestRate.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[var(--color-text-secondary)]">Err%</div>
                        <div className={svc.errorRate > 1 ? "text-rose-400" : svc.errorRate > 0 ? "text-amber-400" : "text-emerald-400"}>
                          {svc.errorRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--color-text-secondary)]">p99</div>
                        <div className={svc.p99Latency > 100 ? "text-rose-400" : svc.p99Latency > 50 ? "text-amber-400" : "text-[var(--color-text-primary)]"}>
                          {svc.p99Latency}ms
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {selectedService && (
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-primary/40 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-[var(--color-text-primary)]">{selectedService.name}</span>
            <Badge label={selectedService.version} className="text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border-[var(--color-border)]" />
            <Badge label={selectedService.namespace} className={NS_COLORS[selectedService.namespace]} />
          </div>

          {detail ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  ↑ Upstream Callers ({detail.upstreams.length})
                </div>
                {detail.upstreams.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-muted)] italic">No upstream callers (entry point)</div>
                ) : (
                  <div className="space-y-1.5">
                    {detail.upstreams.map(conn => (
                      <div key={conn.serviceId} className="flex items-center justify-between bg-[var(--color-surface-2)] rounded-md px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", HEALTH_DOT[conn.health])} />
                          <span className="text-sm text-[var(--color-text-primary)]">{conn.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={HEALTH_COLORS[conn.health]}>{conn.health}</span>
                          <span className="text-[var(--color-text-secondary)]">{conn.trafficRate.toLocaleString()} rps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  ↓ Downstream Dependencies ({detail.downstreams.length})
                </div>
                {detail.downstreams.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-muted)] italic">No downstream dependencies</div>
                ) : (
                  <div className="space-y-1.5">
                    {detail.downstreams.map(conn => (
                      <div key={conn.serviceId} className="flex items-center justify-between bg-[var(--color-surface-2)] rounded-md px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", HEALTH_DOT[conn.health])} />
                          <span className="text-sm text-[var(--color-text-primary)]">{conn.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={HEALTH_COLORS[conn.health]}>{conn.health}</span>
                          <span className="text-[var(--color-text-secondary)]">{conn.trafficRate.toLocaleString()} rps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-secondary)]">
              No detailed connection data for this service.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Traffic ───────────────────────────────────────────────────────────

function TrafficTab() {
  const [filterNs, setFilterNs] = useState<Namespace | "all">("all")

  const totalRPS = TRAFFIC_FLOWS.reduce((sum, f) => sum + f.requestsPerSec, 0)
  const avgLatency = Math.round(
    TRAFFIC_FLOWS.filter(f => f.p99Latency > 0).reduce((sum, f) => sum + f.p99Latency, 0) /
    TRAFFIC_FLOWS.filter(f => f.p99Latency > 0).length
  )
  const avgSuccess = TRAFFIC_FLOWS.filter(f => f.requestsPerSec > 0).reduce((sum, f) => sum + f.successRate, 0) /
    TRAFFIC_FLOWS.filter(f => f.requestsPerSec > 0).length
  const errorBudget = Math.max(0, avgSuccess - 99.0).toFixed(2)

  const filtered = filterNs === "all"
    ? TRAFFIC_FLOWS
    : TRAFFIC_FLOWS.filter(f => f.sourceNs === filterNs || f.destNs === filterNs)

  const namespaceOptions: Array<Namespace | "all"> = ["all", "frontend", "backend", "data", "infra"]

  const PROTO_COLORS: Record<Protocol, string> = {
    HTTP:  "text-primary bg-primary/10 border-primary/30",
    gRPC:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    TCP:   "text-[var(--color-text-primary)] bg-[var(--color-surface-2)] border-[var(--color-border)]",
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total RPS" value={totalRPS.toLocaleString()} sub="across all flows" />
        <StatCard label="Avg p99 Latency" value={`${avgLatency}ms`} sub="weighted average" />
        <StatCard label="Error Budget Remaining" value={`${errorBudget}%`} sub="vs 99.0% SLO" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-secondary)]">Filter by namespace:</span>
        {namespaceOptions.map(ns => (
          <button
            key={ns}
            onClick={() => setFilterNs(ns)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md border transition-colors",
              filterNs === ns
                ? "bg-primary border-primary text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
            )}
          >
            {ns}
          </button>
        ))}
      </div>

      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Source</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Destination</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Protocol</th>
              <th className="text-right text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Req/s</th>
              <th className="text-right text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Success%</th>
              <th className="text-right text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">p50</th>
              <th className="text-right text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">p99</th>
              <th className="text-right text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Bytes/s</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((flow, i) => (
              <tr
                key={flow.id}
                className={cn(
                  "border-b border-[var(--color-border)] last:border-0",
                  i % 2 === 0 ? "bg-[var(--color-surface-1)]" : "bg-[var(--color-surface-2)]/40"
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="text-[var(--color-text-primary)]">{flow.source}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{flow.sourceNs}</div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-[var(--color-text-primary)]">{flow.destination}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{flow.destNs}</div>
                </td>
                <td className="px-4 py-2.5">
                  <Badge label={flow.protocol} className={PROTO_COLORS[flow.protocol]} />
                </td>
                <td className="px-4 py-2.5 text-right text-[var(--color-text-primary)] tabular-nums">
                  {flow.requestsPerSec.toLocaleString()}
                </td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums",
                  flow.successRate >= 99.5 ? "text-emerald-400" :
                  flow.successRate >= 99.0 ? "text-amber-400" :
                  flow.successRate > 0     ? "text-rose-400" : "text-[var(--color-text-muted)]"
                )}>
                  {flow.successRate > 0 ? `${flow.successRate.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-[var(--color-text-primary)] tabular-nums">
                  {flow.p50Latency > 0 ? `${flow.p50Latency}ms` : "—"}
                </td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums",
                  flow.p99Latency > 100 ? "text-rose-400" :
                  flow.p99Latency > 50  ? "text-amber-400" : "text-[var(--color-text-primary)]"
                )}>
                  {flow.p99Latency > 0 ? `${flow.p99Latency}ms` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-[var(--color-text-secondary)] tabular-nums">
                  {flow.bytesPerSec > 0 ? `${(flow.bytesPerSec / 1000).toFixed(0)}KB` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab 3: Policies ──────────────────────────────────────────────────────────

function PoliciesTab() {
  return (
    <div className="space-y-4">
      {NAMESPACE_POLICIES.map(policy => (
        <div key={policy.namespace} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] capitalize">{policy.namespace}</h3>
            <Badge label="namespace" className={NS_COLORS[policy.namespace]} />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* mTLS */}
            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">mTLS Mode</div>
              <Badge label={policy.mtls} className={MTLS_COLORS[policy.mtls]} />
              <div className="text-xs text-[var(--color-text-muted)]">
                {policy.mtls === "enabled"    && "Strict mutual TLS enforced"}
                {policy.mtls === "permissive" && "Mixed plaintext + mTLS"}
                {policy.mtls === "disabled"   && "No TLS enforcement"}
              </div>
            </div>

            {/* Circuit Breaker */}
            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Circuit Breaker</div>
              <div className={cn("text-sm font-medium flex items-center gap-1.5", CB_STATUS_COLORS[policy.circuitBreaker.status])}>
                <span className={cn("w-2 h-2 rounded-full", {
                  "bg-emerald-400": policy.circuitBreaker.status === "closed",
                  "bg-amber-400":   policy.circuitBreaker.status === "half-open",
                  "bg-rose-400":    policy.circuitBreaker.status === "open",
                })} />
                {policy.circuitBreaker.status}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] space-y-0.5">
                <div>Threshold: <span className="text-[var(--color-text-primary)]">{policy.circuitBreaker.threshold}%</span></div>
                <div>Window: <span className="text-[var(--color-text-primary)]">{policy.circuitBreaker.windowSeconds}s</span></div>
              </div>
            </div>

            {/* Retry Policy */}
            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Retry Policy</div>
              <div className="text-sm text-[var(--color-text-primary)]">{policy.retryPolicy.attempts} attempts</div>
              <div className="text-xs text-[var(--color-text-secondary)] space-y-0.5">
                <div>Per-try timeout:</div>
                <div className="text-[var(--color-text-primary)]">{policy.retryPolicy.perTryTimeoutMs}ms</div>
              </div>
            </div>

            {/* Timeout */}
            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Request Timeout</div>
              <div className="text-xl font-semibold text-[var(--color-text-primary)]">
                {policy.timeoutMs >= 1000 ? `${policy.timeoutMs / 1000}s` : `${policy.timeoutMs}ms`}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">global default</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab 4: Certificates ──────────────────────────────────────────────────────

function CertificatesTab() {
  const expiring = CERTIFICATES.filter(c => c.status === "expiring")
  const expired  = CERTIFICATES.filter(c => c.status === "expired")

  return (
    <div className="space-y-4">
      {(expiring.length > 0 || expired.length > 0) && (
        <div className="flex gap-3">
          {expired.length > 0 && (
            <div className="bg-rose-400/10 border border-rose-500/40 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-rose-400 text-lg">⚠</span>
              <div>
                <div className="text-sm font-semibold text-rose-400">{expired.length} Expired Certificate{expired.length > 1 ? "s" : ""}</div>
                <div className="text-xs text-rose-400/70">Immediate rotation required</div>
              </div>
            </div>
          )}
          {expiring.length > 0 && (
            <div className="bg-amber-400/10 border border-amber-500/40 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 text-lg">⚡</span>
              <div>
                <div className="text-sm font-semibold text-amber-400">{expiring.length} Certificate{expiring.length > 1 ? "s" : ""} Expiring Soon</div>
                <div className="text-xs text-amber-400/70">Rotation recommended within 7 days</div>
              </div>
            </div>
          )}
          <div className="bg-emerald-400/10 border border-emerald-500/40 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-emerald-400 text-lg">✓</span>
            <div>
              <div className="text-sm font-semibold text-emerald-400">
                {CERTIFICATES.filter(c => c.status === "valid").length} Valid Certificates
              </div>
              <div className="text-xs text-emerald-400/70">No action required</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Workload</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Namespace</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Issuer</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Status</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Expires</th>
              <th className="text-left text-xs text-[var(--color-text-secondary)] font-medium px-4 py-3">Last Rotated</th>
            </tr>
          </thead>
          <tbody>
            {CERTIFICATES.map((cert, i) => (
              <tr
                key={cert.id}
                className={cn(
                  "border-b border-[var(--color-border)] last:border-0",
                  i % 2 === 0 ? "bg-[var(--color-surface-1)]" : "bg-[var(--color-surface-2)]/40"
                )}
              >
                <td className="px-4 py-2.5">
                  <span className="text-[var(--color-text-primary)] font-medium">{cert.workload}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Badge label={cert.namespace} className={NS_COLORS[cert.namespace]} />
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-primary)]">{cert.issuer}</td>
                <td className="px-4 py-2.5">
                  <Badge label={cert.status} className={CERT_STATUS_COLORS[cert.status]} />
                </td>
                <td className={cn("px-4 py-2.5 tabular-nums",
                  cert.status === "expired"  ? "text-rose-400" :
                  cert.status === "expiring" ? "text-amber-400" : "text-[var(--color-text-primary)]"
                )}>
                  {cert.expiry}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-secondary)] tabular-nums">{cert.lastRotated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "topology" | "traffic" | "policies" | "certificates"

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "topology",     label: "Topology",     icon: "⬡" },
  { id: "traffic",      label: "Traffic",      icon: "⇄" },
  { id: "policies",     label: "Policies",     icon: "🔒" },
  { id: "certificates", label: "Certificates", icon: "📜" },
]

export default function ServiceMeshViewer() {
  const [activeTab, setActiveTab] = useState<Tab>("topology")

  const unhealthyCount = SERVICES.filter(s => s.errorRate > 1).length
  const totalServices  = SERVICES.length

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Service Mesh</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Istio/Envoy observability — {totalServices} services across 4 namespaces</p>
        </div>
        <div className="flex items-center gap-3">
          {unhealthyCount > 0 ? (
            <span className="flex items-center gap-1.5 text-sm text-rose-400 bg-rose-400/10 border border-rose-500/30 rounded-md px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              {unhealthyCount} degraded
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-500/30 rounded-md px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              All healthy
            </span>
          )}
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-2 py-1.5">
            Live · 30s refresh
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "text-[var(--color-text-primary)] border-primary bg-[var(--color-surface-1)]"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]/50"
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "topology"     && <TopologyTab />}
        {activeTab === "traffic"      && <TrafficTab />}
        {activeTab === "policies"     && <PoliciesTab />}
        {activeTab === "certificates" && <CertificatesTab />}
      </div>
    </div>
  )
}
