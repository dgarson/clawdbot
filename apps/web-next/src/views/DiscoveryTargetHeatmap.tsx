import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ============================================================================
// Types
// ============================================================================

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingType = "vulnerability" | "misconfiguration" | "exposure" | "compliance" | "best-practice";

export interface DiscoveryTarget {
  id: string;
  domain: string;
  ipAddress: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  discoveredAt: string;
  status: "open" | "in-progress" | "resolved" | "false-positive";
}

export interface HeatmapCell {
  x: number; // 0-9 grid column (domain segment)
  y: number; // 0-9 grid row (severity level)
  count: number;
  targets: DiscoveryTarget[];
}

// ============================================================================
// Seed Data
// ============================================================================

const SEED_TARGETS: DiscoveryTarget[] = [
  { id: "1", domain: "api.production.example.com", ipAddress: "203.0.113.1", country: "US", city: "San Francisco", latitude: 37.7749, longitude: -122.4194, type: "vulnerability", severity: "critical", title: "SQL Injection in /auth", description: "Unsanitized input in authentication endpoint", discoveredAt: "2026-02-20T14:32:00Z", status: "open" },
  { id: "2", domain: "api.production.example.com", ipAddress: "203.0.113.1", country: "US", city: "San Francisco", latitude: 37.7749, longitude: -122.4194, type: "misconfiguration", severity: "high", title: "CORS Allow-All", description: "CORS policy allows any origin", discoveredAt: "2026-02-20T14:35:00Z", status: "in-progress" },
  { id: "3", domain: "dashboard.example.com", ipAddress: "198.51.100.1", country: "US", city: "New York", latitude: 40.7128, longitude: -74.0060, type: "exposure", severity: "critical", title: "Exposed Admin Panel", description: "Admin interface accessible without auth", discoveredAt: "2026-02-19T09:15:00Z", status: "open" },
  { id: "4", domain: "dashboard.example.com", ipAddress: "198.51.100.1", country: "US", city: "New York", latitude: 40.7128, longitude: -74.0060, type: "vulnerability", severity: "high", title: "XSS in Search", description: "Cross-site scripting in search parameter", discoveredAt: "2026-02-19T09:20:00Z", status: "open" },
  { id: "5", domain: "api-staging.example.com", ipAddress: "203.0.113.2", country: "DE", city: "Frankfurt", latitude: 50.1109, longitude: 8.6821, type: "best-practice", severity: "low", title: "Missing Cache Headers", description: "Static assets lack cache headers", discoveredAt: "2026-02-21T11:00:00Z", status: "open" },
  { id: "6", domain: "api-staging.example.com", ipAddress: "203.0.113.2", country: "DE", city: "Frankfurt", latitude: 50.1109, longitude: 8.6821, type: "compliance", severity: "medium", title: "TLS 1.0 Enabled", description: "Legacy TLS version still supported", discoveredAt: "2026-02-21T11:05:00Z", status: "in-progress" },
  { id: "7", domain: "cdn.example.com", ipAddress: "203.0.113.3", country: "JP", city: "Tokyo", latitude: 35.6762, longitude: 139.6503, type: "exposure", severity: "medium", title: "Debug Mode Enabled", description: "Application running in debug mode", discoveredAt: "2026-02-18T16:45:00Z", status: "resolved" },
  { id: "8", domain: "cdn.example.com", ipAddress: "203.0.113.3", country: "JP", city: "Tokyo", latitude: 35.6762, longitude: 139.6503, type: "misconfiguration", severity: "high", title: "Insecure Cookie Flags", description: "Session cookies missing Secure flag", discoveredAt: "2026-02-18T16:50:00Z", status: "open" },
  { id: "9", domain: "auth.example.com", ipAddress: "198.51.100.2", country: "GB", city: "London", latitude: 51.5074, longitude: -0.1278, type: "vulnerability", severity: "critical", title: "Broken Authentication", description: "JWT validation bypass possible", discoveredAt: "2026-02-22T08:30:00Z", status: "open" },
  { id: "10", domain: "auth.example.com", ipAddress: "198.51.100.2", country: "GB", city: "London", latitude: 51.5074, longitude: -0.1278, type: "compliance", severity: "medium", title: "Weak Password Policy", description: "Minimum password length < 12 chars", discoveredAt: "2026-02-22T08:35:00Z", status: "in-progress" },
  { id: "11", domain: "www.example.com", ipAddress: "203.0.113.4", country: "AU", city: "Sydney", latitude: -33.8688, longitude: 151.2093, type: "best-practice", severity: "info", title: "Missing HSTS Header", description: "HSTS not enabled on main domain", discoveredAt: "2026-02-17T13:20:00Z", status: "open" },
  { id: "12", domain: "www.example.com", ipAddress: "203.0.113.4", country: "AU", city: "Sydney", latitude: -33.8688, longitude: 151.2093, type: "misconfiguration", severity: "low", title: "Verbose Error Pages", description: "Detailed error messages exposed", discoveredAt: "2026-02-17T13:25:00Z", status: "resolved" },
  { id: "13", domain: "internal.example.com", ipAddress: "10.0.1.1", country: "CA", city: "Toronto", latitude: 43.6532, longitude: -79.3832, type: "exposure", severity: "high", title: "Internal Service Exposed", description: "Internal API accessible externally", discoveredAt: "2026-02-21T15:00:00Z", status: "open" },
  { id: "14", domain: "internal.example.com", ipAddress: "10.0.1.1", country: "CA", city: "Toronto", latitude: 43.6532, longitude: -79.3832, type: "vulnerability", severity: "critical", title: "Remote Code Execution", description: "RCE via file upload endpoint", discoveredAt: "2026-02-21T15:10:00Z", status: "open" },
  { id: "15", domain: "mail.example.com", ipAddress: "198.51.100.3", country: "NL", city: "Amsterdam", latitude: 52.3676, longitude: 4.9041, type: "best-practice", severity: "low", title: "SPF Record Missing", description: "No SPF record for domain", discoveredAt: "2026-02-16T10:00:00Z", status: "open" },
  { id: "16", domain: "mail.example.com", ipAddress: "198.51.100.3", country: "NL", city: "Amsterdam", latitude: 52.3676, longitude: 4.9041, type: "compliance", severity: "medium", title: "DMARC Not Configured", description: "DMARC policy not set", discoveredAt: "2026-02-16T10:05:00Z", status: "in-progress" },
  { id: "17", domain: "db.example.com", ipAddress: "203.0.113.5", country: "SG", city: "Singapore", latitude: 1.3521, longitude: 103.8198, type: "exposure", severity: "critical", title: "Database Exposed", description: "PostgreSQL accessible without VPN", discoveredAt: "2026-02-22T10:00:00Z", status: "open" },
  { id: "18", domain: "db.example.com", ipAddress: "203.0.113.5", country: "SG", city: "Singapore", latitude: 1.3521, longitude: 103.8198, type: "misconfiguration", severity: "high", title: "Weak Database Credentials", description: "Default credentials in use", discoveredAt: "2026-02-22T10:05:00Z", status: "in-progress" },
  { id: "19", domain: "cdn2.example.com", ipAddress: "203.0.113.6", country: "BR", city: "São Paulo", latitude: -23.5505, longitude: -46.6333, type: "best-practice", severity: "info", title: "Missing Compression", description: "Brotli compression not enabled", discoveredAt: "2026-02-15T14:30:00Z", status: "open" },
  { id: "20", domain: "cdn2.example.com", ipAddress: "203.0.113.6", country: "BR", city: "São Paulo", latitude: -23.5505, longitude: -46.6333, type: "compliance", severity: "low", title: "Outdated TLS Cipher", description: "Weak cipher suites enabled", discoveredAt: "2026-02-15T14:35:00Z", status: "resolved" },
];

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low", "info"];
const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
  info: "bg-[var(--color-surface-3)]",
};

const FINDING_TYPES: FindingType[] = ["vulnerability", "misconfiguration", "exposure", "compliance", "best-practice"];

// ============================================================================
// Utility Functions
// ============================================================================

function getDomainSegment(domain: string): number {
  // Simple hash to distribute domains across 10 columns
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = ((hash << 5) - hash) + domain.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 10;
}

function getSeverityIndex(severity: FindingSeverity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-[var(--color-text-primary)]",
        SEVERITY_COLORS[severity]
      )}
    >
      {severity}
    </span>
  );
}

function TypeBadge({ type }: { type: FindingType }) {
  const colors: Record<FindingType, string> = {
    vulnerability: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    misconfiguration: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    exposure: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    compliance: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    "best-practice": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs border", colors[type])}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: DiscoveryTarget["status"] }) {
  const styles: Record<DiscoveryTarget["status"], string> = {
    "open": "bg-red-500/20 text-red-400 border-red-500/30",
    "in-progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "resolved": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "false-positive": "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]/30",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs border", styles[status])}>
      {status}
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
        active
          ? color 
            ? `${color} text-[var(--color-text-primary)]`
            : "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
          : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
      )}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DiscoveryTargetHeatmap() {
  const [targets] = useState<DiscoveryTarget[]>(SEED_TARGETS);
  const [selectedTypes, setSelectedTypes] = useState<Set<FindingType>>(new Set(FINDING_TYPES));
  const [selectedSeverities, setSelectedSeverities] = useState<Set<FindingSeverity>>(new Set(SEVERITY_ORDER));
  const [zoom, setZoom] = useState(1);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<DiscoveryTarget | null>(null);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // Filter targets based on selected filters
  const filteredTargets = useMemo(() => {
    return targets.filter(
      (t) => selectedTypes.has(t.type) && selectedSeverities.has(t.severity)
    );
  }, [targets, selectedTypes, selectedSeverities]);

  // Build heatmap grid
  const heatmapData = useMemo(() => {
    const grid: HeatmapCell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 10 }, () => ({ x: 0, y: 0, count: 0, targets: [] }))
    );

    filteredTargets.forEach((target) => {
      const x = getDomainSegment(target.domain);
      const y = getSeverityIndex(target.severity);
      if (grid[y] && grid[y][x]) {
        grid[y][x].x = x;
        grid[y][x].y = y;
        grid[y][x].count += 1;
        grid[y][x].targets.push(target);
      }
    });

    return grid;
  }, [filteredTargets]);

  // Calculate max count for color scaling
  const maxCount = useMemo(() => {
    return Math.max(...heatmapData.flat().map((cell) => cell.count), 1);
  }, [heatmapData]);

  // Toggle handlers
  const toggleType = useCallback((type: FindingType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const toggleSeverity = useCallback((severity: FindingSeverity) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSelectedTypes(new Set(FINDING_TYPES));
    setSelectedSeverities(new Set(SEVERITY_ORDER));
  }, []);

  // Stats
  const stats = useMemo(() => ({
    total: filteredTargets.length,
    critical: filteredTargets.filter((t) => t.severity === "critical").length,
    open: filteredTargets.filter((t) => t.status === "open").length,
    resolved: filteredTargets.filter((t) => t.status === "resolved").length,
  }), [filteredTargets]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-surface-3)] border-t-zinc-100 rounded-full animate-spin" />
          <span className="text-[var(--color-text-secondary)] text-sm">Loading discovery data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-red-500/30 bg-red-500/10 max-w-md">
          <div className="text-red-400 text-lg font-medium">Failed to load findings</div>
          <p className="text-[var(--color-text-secondary)] text-sm text-center">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">Discovery Target Heatmap</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            Geographic and domain distribution of security findings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-text-muted)] text-xs">
            Last scan: {formatDate(SEED_TARGETS[0]?.discoveredAt || "")}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 p-4">
          <div className="text-sm text-[var(--color-text-secondary)]">Total Findings</div>
          <div className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-red-900/30 bg-red-900/10 p-4">
          <div className="text-sm text-red-400">Critical</div>
          <div className="text-2xl font-semibold text-red-400 mt-1">{stats.critical}</div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 p-4">
          <div className="text-sm text-[var(--color-text-secondary)]">Open</div>
          <div className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{stats.open}</div>
        </div>
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-900/10 p-4">
          <div className="text-sm text-emerald-400">Resolved</div>
          <div className="text-2xl font-semibold text-emerald-400 mt-1">{stats.resolved}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Filters</span>
          <button
            onClick={resetFilters}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Reset all
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] w-20">Severity</span>
            <div className="flex gap-2">
              {SEVERITY_ORDER.map((severity) => (
                <FilterChip
                  key={severity}
                  label={severity}
                  active={selectedSeverities.has(severity)}
                  onClick={() => toggleSeverity(severity)}
                  color={SEVERITY_COLORS[severity]}
                />
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] w-20">Type</span>
            <div className="flex gap-2">
              {FINDING_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={type}
                  active={selectedTypes.has(type)}
                  onClick={() => toggleType(type)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Visualization */}
      <div className="relative">
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 p-1 rounded-lg bg-[var(--color-surface-1)]/80 backdrop-blur border border-[var(--color-border)]">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            disabled={zoom <= 0.5}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-[var(--color-text-secondary)] w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            disabled={zoom >= 2}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Heatmap Grid */}
        <div 
          className="overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 p-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {/* Y-axis labels (severity) */}
          <div className="flex">
            <div className="w-20 shrink-0" />
            <div className="flex-1 grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="text-xs text-[var(--color-text-muted)] text-center">
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Grid rows */}
          {heatmapData.map((row, y) => (
            <div key={y} className="flex gap-1 mb-1">
              <div className="w-20 shrink-0 flex items-center">
                <span className="text-xs text-[var(--color-text-muted)] capitalize">{SEVERITY_ORDER[y]}</span>
              </div>
              <div className="flex-1 grid grid-cols-10 gap-1">
                {row.map((cell, x) => {
                  const intensity = cell.count > 0 ? Math.min(cell.count / maxCount, 1) : 0;
                  const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => cell.targets[0] && setSelectedTarget(cell.targets[0])}
                      className={cn(
                        "h-10 rounded-md transition-all duration-200 cursor-pointer",
                        cell.count > 0
                          ? `hover:ring-2 hover:ring-zinc-400 hover:scale-105`
                          : "bg-[var(--color-surface-2)]/30"
                      )}
                      style={{
                        backgroundColor: cell.count > 0 
                          ? `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`
                          : undefined,
                      }}
                    >
                      {cell.count > 0 && (
                        <div className="h-full flex items-center justify-center">
                          <span className={cn(
                            "text-xs font-medium",
                            intensity > 0.5 ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]"
                          )}>
                            {cell.count}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[var(--color-surface-2)]/30" />
              <span className="text-xs text-[var(--color-text-muted)]">No findings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/40" />
              <span className="text-xs text-[var(--color-text-muted)]">Low density</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/80" />
              <span className="text-xs text-[var(--color-text-muted)]">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-xs text-[var(--color-text-muted)]">High density</span>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredCell && hoveredCell.count > 0 && (
          <div 
            className="absolute z-20 p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-xl pointer-events-none"
            style={{
              left: `${(hoveredCell.x / 10) * 100 + 10}%`,
              top: `${(hoveredCell.y / 5) * 100 + 60}px`,
            }}
          >
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              {hoveredCell.count} finding{hoveredCell.count > 1 ? "s" : ""}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              {hoveredCell.targets.slice(0, 3).map((t) => t.domain).join(", ")}
              {hoveredCell.targets.length > 3 && ` +${hoveredCell.targets.length - 3} more`}
            </div>
          </div>
        )}
      </div>

      {/* Finding Details Panel */}
      {selectedTarget && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedTarget.title}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">{selectedTarget.description}</p>
            </div>
            <button
              onClick={() => setSelectedTarget(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">Domain</div>
              <div className="text-sm text-[var(--color-text-primary)]">{selectedTarget.domain}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">IP Address</div>
              <div className="text-sm text-[var(--color-text-primary)] font-mono">{selectedTarget.ipAddress}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">Location</div>
              <div className="text-sm text-[var(--color-text-primary)]">{selectedTarget.city}, {selectedTarget.country}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">Discovered</div>
              <div className="text-sm text-[var(--color-text-primary)]">{formatDate(selectedTarget.discoveredAt)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SeverityBadge severity={selectedTarget.severity} />
            <TypeBadge type={selectedTarget.type} />
            <StatusBadge status={selectedTarget.status} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredTargets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">No findings match your filters</h3>
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">
            Try adjusting your severity or type filters to see more results.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Targets List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">All Findings ({filteredTargets.length})</h3>
        <div className="max-h-[300px] overflow-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--color-surface-1)]">
              <tr className="text-left text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="px-4 py-2 font-medium">Domain</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Severity</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTargets.map((target) => (
                <tr
                  key={target.id}
                  onClick={() => setSelectedTarget(target)}
                  className={cn(
                    "border-b border-[var(--color-border)]/50 cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]/30",
                    selectedTarget?.id === target.id && "bg-[var(--color-surface-2)]/50"
                  )}
                >
                  <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{target.domain}</td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{target.city}, {target.country}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={target.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={target.type} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={target.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
