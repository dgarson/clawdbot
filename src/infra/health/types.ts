export type DependencyTier = "core" | "channel" | "integration" | "infrastructure";
export type DependencyProbeMode = "active" | "passive";

export type DependencyHealthStatus = {
  id: string;
  label: string;
  tier: DependencyTier;
  probeMode: DependencyProbeMode;
  enabled: boolean;
  status: "ok" | "degraded" | "error" | "unknown" | "disabled";
  message?: string;
  lastProbeAt: number | null;
  consecutiveFailures: number;
  details?: Record<string, unknown>;
};

export type DependencyHealthProbe = {
  id: string;
  label: string;
  tier: DependencyTier;
  probeMode: DependencyProbeMode;
  /** Read cached/current status (sync, no network). */
  getStatus: () => DependencyHealthStatus;
  /** Force re-probe. Active probes make a network call; passive probes re-read state. */
  refresh: () => Promise<DependencyHealthStatus>;
  /** Start periodic probing (active probes only). */
  start?: () => void;
  /** Stop periodic probing. */
  stop?: () => void;
};
