import type { DependencyHealthProbe, DependencyHealthStatus } from "./types.js";

const probes = new Map<string, DependencyHealthProbe>();

/** Register a dependency health probe (idempotent, overwrites by id). */
export function registerDependencyProbe(probe: DependencyHealthProbe): void {
  probes.set(probe.id, probe);
}

/** Remove a dependency health probe by id. */
export function unregisterDependencyProbe(id: string): void {
  probes.delete(id);
}

/** Synchronously read cached status from every registered probe. */
export function getDependencyHealthSnapshot(): DependencyHealthStatus[] {
  return Array.from(probes.values()).map((probe) => probe.getStatus());
}

/** Force re-probe all dependencies in parallel, returning updated statuses. */
export async function refreshAllDependencyHealth(): Promise<DependencyHealthStatus[]> {
  const entries = Array.from(probes.values());
  return Promise.all(entries.map((probe) => probe.refresh()));
}

/** Force re-probe a single dependency by id. */
export async function refreshDependencyHealth(id: string): Promise<DependencyHealthStatus | null> {
  const probe = probes.get(id);
  if (!probe) {
    return null;
  }
  return probe.refresh();
}

/** Call start() on all probes that support it. */
export function startDependencyHealthProbes(): void {
  for (const probe of probes.values()) {
    probe.start?.();
  }
}

/** Call stop() on all probes and clear the registry. */
export function stopDependencyHealthProbes(): void {
  for (const probe of probes.values()) {
    probe.stop?.();
  }
  probes.clear();
}

/** Return all registered probe IDs. */
export function listDependencyProbeIds(): string[] {
  return Array.from(probes.keys());
}
