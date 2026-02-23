import React, { useState, useEffect, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert"
import { Progress } from "../components/ui/progress"
import { cn } from "../lib/utils"

// ============================================================================
// Types
// ============================================================================

export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown"

export interface APIQuota {
  used: number
  total: number
  resetDate?: string
}

export interface APIErrorMetrics {
  totalRequests: number
  errorCount: number
  lastError?: string
  lastErrorTime?: string
}

export interface APICredential {
  id: string
  name: string
  provider: "shodan" | "brave" | "openai" | "anthropic" | "github" | "vercel" | "custom"
  status: HealthStatus
  lastChecked: string
  quota?: APIQuota
  expiryDate?: string
  errorMetrics?: APIErrorMetrics
  rateLimit?: {
    remaining: number
    limit: number
    resetAt: string
  }
  description?: string
}

export interface HealthAlert {
  id: string
  credentialId: string
  type: "quota" | "expiry" | "error_rate" | "rate_limit"
  severity: "warning" | "critical"
  message: string
  timestamp: string
  acknowledged: boolean
}

export interface APICredentialHealthDashboardProps {
  credentials: APICredential[]
  alerts?: HealthAlert[]
  onAcknowledgeAlert?: (alertId: string) => void
  onRefresh?: (credentialId?: string) => void
  onConfigure?: (credentialId: string) => void
  isLoading?: boolean
  lastUpdated?: string
  className?: string
}

// ============================================================================
// Icons (inline SVG for self-containment)
// ============================================================================

const Icons = {
  CheckCircle: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ExclamationTriangle: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  XCircle: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  QuestionMarkCircle: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Refresh: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Settings: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Clock: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ChartBar: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Database: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  Bell: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
}

// ============================================================================
// Provider Configuration
// ============================================================================

const PROVIDER_CONFIG: Record<APICredential["provider"], { color: string; icon: React.ReactNode }> = {
  shodan: {
    color: "text-red-400",
    icon: <span className="font-mono font-bold text-red-400">S</span>,
  },
  brave: {
    color: "text-orange-400",
    icon: <span className="font-mono font-bold text-orange-400">B</span>,
  },
  openai: {
    color: "text-emerald-400",
    icon: <span className="font-mono font-bold text-emerald-400">O</span>,
  },
  anthropic: {
    color: "text-amber-400",
    icon: <span className="font-mono font-bold text-amber-400">A</span>,
  },
  github: {
    color: "text-zinc-300",
    icon: <span className="font-mono font-bold text-zinc-300">G</span>,
  },
  vercel: {
    color: "text-white",
    icon: <span className="font-mono font-bold text-white">V</span>,
  },
  custom: {
    color: "text-purple-400",
    icon: <span className="font-mono font-bold text-purple-400">C</span>,
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "text-emerald-400"
    case "degraded":
      return "text-amber-400"
    case "critical":
      return "text-red-400"
    case "unknown":
    default:
      return "text-zinc-500"
  }
}

function getStatusBadgeVariant(status: HealthStatus): "default" | "outline" | "destructive" | "secondary" {
  switch (status) {
    case "healthy":
      return "default"
    case "degraded":
      return "outline"
    case "critical":
      return "destructive"
    case "unknown":
    default:
      return "secondary"
  }
}

function getStatusIcon(status: HealthStatus): React.ReactNode {
  const iconClass = cn("h-5 w-5", getStatusColor(status))
  switch (status) {
    case "healthy":
      return <Icons.CheckCircle className={iconClass} />
    case "degraded":
      return <Icons.ExclamationTriangle className={iconClass} />
    case "critical":
      return <Icons.XCircle className={iconClass} />
    case "unknown":
    default:
      return <Icons.QuestionMarkCircle className={iconClass} />
  }
}

function getQuotaPercentage(quota: APIQuota): number {
  if (quota.total === 0) return 0
  return Math.round((quota.used / quota.total) * 100)
}

function getQuotaColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500"
  if (percentage >= 70) return "bg-amber-500"
  return "bg-emerald-500"
}

function getDaysUntilExpiry(expiryDate: string): number {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now.getTime() - time.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return time.toLocaleDateString()
}

function getErrorRate(metrics: APIErrorMetrics): number {
  if (metrics.totalRequests === 0) return 0
  return (metrics.errorCount / metrics.totalRequests) * 100
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  className?: string
}

function StatCard({ title, value, subtitle, icon, className }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="text-2xl font-semibold text-zinc-100">{value}</p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

interface CredentialCardProps {
  credential: APICredential
  onRefresh?: () => void
  onConfigure?: () => void
  isLoading?: boolean
}

function CredentialCard({ credential, onRefresh, onConfigure, isLoading }: CredentialCardProps) {
  const quotaPercentage = credential.quota ? getQuotaPercentage(credential.quota) : null
  const daysUntilExpiry = credential.expiryDate ? getDaysUntilExpiry(credential.expiryDate) : null
  const errorRate = credential.errorMetrics ? getErrorRate(credential.errorMetrics) : null
  const providerConfig = PROVIDER_CONFIG[credential.provider]

  return (
    <Card className="flex flex-col transition-colors hover:border-zinc-700">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
              {providerConfig.icon}
            </div>
            <div>
              <CardTitle className="text-base">{credential.name}</CardTitle>
              <CardDescription className="text-xs capitalize">
                {credential.provider}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(credential.status)}
            <Badge variant={getStatusBadgeVariant(credential.status)} className="capitalize">
              {credential.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4">
        {/* Quota Section */}
        {credential.quota && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Icons.Database className="h-3.5 w-3.5" />
                Quota Used
              </span>
              <span className="text-zinc-100 font-medium">
                {credential.quota.used.toLocaleString()} / {credential.quota.total.toLocaleString()}
              </span>
            </div>
            <Progress
              value={quotaPercentage ?? 0}
              className="h-1.5"
            />
            {credential.quota.resetDate && (
              <p className="text-xs text-zinc-500">
                Resets {formatRelativeTime(credential.quota.resetDate)}
              </p>
            )}
          </div>
        )}

        {/* Expiry Section */}
        {credential.expiryDate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Icons.Clock className="h-3.5 w-3.5" />
              Expires
            </span>
            <span className={cn(
              "font-medium",
              daysUntilExpiry !== null && daysUntilExpiry < 0
                ? "text-red-400"
                : daysUntilExpiry !== null && daysUntilExpiry < 7
                ? "text-amber-400"
                : "text-zinc-100"
            )}>
              {daysUntilExpiry !== null && daysUntilExpiry < 0
                ? "Expired"
                : `${daysUntilExpiry} days`}
            </span>
          </div>
        )}

        {/* Error Rate Section */}
        {credential.errorMetrics && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Icons.ChartBar className="h-3.5 w-3.5" />
              Error Rate
            </span>
            <span className={cn(
              "font-medium",
              errorRate !== null && errorRate > 5
                ? "text-red-400"
                : errorRate !== null && errorRate > 1
                ? "text-amber-400"
                : "text-zinc-100"
            )}>
              {errorRate?.toFixed(2)}%
            </span>
          </div>
        )}

        {/* Rate Limit Section */}
        {credential.rateLimit && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Rate Limit</span>
            <span className="text-zinc-100 font-medium">
              {credential.rateLimit.remaining} / {credential.rateLimit.limit}
            </span>
          </div>
        )}

        {/* Last Error */}
        {credential.errorMetrics?.lastError && (
          <div className="rounded-md bg-zinc-800/50 p-2">
            <p className="text-xs text-zinc-400">Last Error</p>
            <p className="text-xs text-red-400 truncate">{credential.errorMetrics.lastError}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 border-t border-zinc-800 pt-4">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={`Refresh ${credential.name}`}
        >
          <Icons.Refresh className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </button>
        <button
          onClick={onConfigure}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          aria-label={`Configure ${credential.name}`}
        >
          <Icons.Settings className="h-4 w-4" />
          Configure
        </button>
      </CardFooter>
    </Card>
  )
}

interface AlertItemProps {
  alert: HealthAlert
  credentialName: string
  onAcknowledge?: () => void
}

function AlertItem({ alert, credentialName, onAcknowledge }: AlertItemProps) {
  const iconClass = cn(
    "h-5 w-5",
    alert.severity === "critical" ? "text-red-400" : "text-amber-400"
  )

  return (
    <Alert variant={alert.severity === "critical" ? "destructive" : "default"}>
      <Icons.ExclamationTriangle className={iconClass} />
      <AlertTitle className="flex items-center justify-between">
        <span>{alert.type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
        {!alert.acknowledged && (
          <button
            onClick={onAcknowledge}
            className="text-xs font-normal text-zinc-400 hover:text-zinc-200 underline"
          >
            Acknowledge
          </button>
        )}
      </AlertTitle>
      <AlertDescription>
        <span className="font-medium text-zinc-300">{credentialName}:</span> {alert.message}
        <span className="block text-xs mt-1 text-zinc-500">
          {formatRelativeTime(alert.timestamp)}
        </span>
      </AlertDescription>
    </Alert>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function APICredentialHealthDashboard({
  credentials,
  alerts = [],
  onAcknowledgeAlert,
  onRefresh,
  onConfigure,
  isLoading = false,
  lastUpdated,
  className,
}: APICredentialHealthDashboardProps) {
  const [filter, setFilter] = useState<"all" | HealthStatus>("all")
  const [showAcknowledged, setShowAcknowledged] = useState(false)

  // Calculate summary statistics
  const stats = useMemo(() => {
    const healthy = credentials.filter(c => c.status === "healthy").length
    const degraded = credentials.filter(c => c.status === "degraded").length
    const critical = credentials.filter(c => c.status === "critical").length
    const unknown = credentials.filter(c => c.status === "unknown").length

    const totalQuotaUsed = credentials.reduce((sum, c) => sum + (c.quota?.used ?? 0), 0)
    const totalQuotaAvailable = credentials.reduce((sum, c) => sum + (c.quota?.total ?? 0), 0)

    const expiringSoon = credentials.filter(c => 
      c.expiryDate && getDaysUntilExpiry(c.expiryDate) < 7
    ).length

    const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged).length

    return {
      healthy,
      degraded,
      critical,
      unknown,
      totalQuotaUsed,
      totalQuotaAvailable,
      expiringSoon,
      unacknowledgedAlerts,
    }
  }, [credentials, alerts])

  // Filter credentials based on selected status
  const filteredCredentials = useMemo(() => {
    if (filter === "all") return credentials
    return credentials.filter(c => c.status === filter)
  }, [credentials, filter])

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    if (showAcknowledged) return alerts
    return alerts.filter(a => !a.acknowledged)
  }, [alerts, showAcknowledged])

  // Overall health status
  const overallHealth = useMemo((): HealthStatus => {
    if (stats.critical > 0) return "critical"
    if (stats.degraded > 0) return "degraded"
    if (stats.healthy > 0) return "healthy"
    return "unknown"
  }, [stats])

  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">API Credential Health</h1>
          <p className="text-sm text-zinc-400">
            Monitor quota, expiry, and error rates across your API credentials
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-zinc-500">
              Last updated: {formatRelativeTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => onRefresh?.()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            aria-label="Refresh all credentials"
          >
            <Icons.Refresh className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh All
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Overall Health"
          value={stats.critical > 0 ? "Critical" : stats.degraded > 0 ? "Degraded" : "Healthy"}
          icon={getStatusIcon(overallHealth)}
          className={cn(
            "border-l-4",
            overallHealth === "healthy" && "border-l-emerald-500",
            overallHealth === "degraded" && "border-l-amber-500",
            overallHealth === "critical" && "border-l-red-500"
          )}
        />
        <StatCard
          title="Credentials"
          value={`${stats.healthy}/${credentials.length}`}
          subtitle={`${stats.degraded} degraded, ${stats.critical} critical`}
          icon={<Icons.Database className="h-6 w-6 text-zinc-400" />}
        />
        <StatCard
          title="Total Quota Used"
          value={`${Math.round((stats.totalQuotaUsed / (stats.totalQuotaAvailable || 1)) * 100)}%`}
          subtitle={`${stats.totalQuotaUsed.toLocaleString()} / ${stats.totalQuotaAvailable.toLocaleString()}`}
          icon={<Icons.ChartBar className="h-6 w-6 text-zinc-400" />}
        />
        <StatCard
          title="Active Alerts"
          value={stats.unacknowledgedAlerts}
          subtitle={stats.expiringSoon > 0 ? `${stats.expiringSoon} expiring soon` : undefined}
          icon={<Icons.Bell className={cn("h-6 w-6", stats.unacknowledgedAlerts > 0 ? "text-amber-400" : "text-zinc-400")} />}
        />
      </div>

      {/* Alerts Section */}
      {filteredAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Alerts</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={(e) => setShowAcknowledged(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-zinc-100 focus:ring-zinc-500"
              />
              Show acknowledged
            </label>
          </div>
          <div className="space-y-2">
            {filteredAlerts.map(alert => {
              const credential = credentials.find(c => c.id === alert.credentialId)
              return (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  credentialName={credential?.name ?? "Unknown"}
                  onAcknowledge={() => onAcknowledgeAlert?.(alert.id)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <span className="text-sm text-zinc-400">Filter:</span>
        {(["all", "healthy", "degraded", "critical", "unknown"] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize",
              filter === status
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
            )}
          >
            {status}
            {status !== "all" && (
              <span className="ml-1.5 text-xs">
                ({credentials.filter(c => c.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Credentials Grid */}
      {filteredCredentials.length === 0 ? (
        <Card className="p-8 text-center">
          <Icons.QuestionMarkCircle className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-4 text-zinc-400">No credentials found for the selected filter.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCredentials.map(credential => (
            <CredentialCard
              key={credential.id}
              credential={credential}
              onRefresh={() => onRefresh?.(credential.id)}
              onConfigure={() => onConfigure?.(credential.id)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default APICredentialHealthDashboard
