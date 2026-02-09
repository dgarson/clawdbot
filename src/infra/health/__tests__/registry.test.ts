import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DependencyHealthProbe, DependencyHealthStatus } from "../types.js";
import {
  registerDependencyProbe,
  unregisterDependencyProbe,
  getDependencyHealthSnapshot,
  refreshAllDependencyHealth,
  refreshDependencyHealth,
  startDependencyHealthProbes,
  stopDependencyHealthProbes,
  listDependencyProbeIds,
} from "../registry.js";

function makeProbe(id: string, overrides?: Partial<DependencyHealthProbe>): DependencyHealthProbe {
  const status: DependencyHealthStatus = {
    id,
    label: `Test ${id}`,
    tier: "core",
    probeMode: "active",
    enabled: true,
    status: "ok",
    lastProbeAt: Date.now(),
    consecutiveFailures: 0,
  };
  return {
    id,
    label: `Test ${id}`,
    tier: "core",
    probeMode: "active",
    getStatus: () => status,
    refresh: vi.fn(async () => status),
    start: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

describe("DependencyHealth registry", () => {
  beforeEach(() => {
    // Clear all probes between tests
    stopDependencyHealthProbes();
  });

  it("registers and lists probes", () => {
    const p1 = makeProbe("test-a");
    const p2 = makeProbe("test-b");

    registerDependencyProbe(p1);
    registerDependencyProbe(p2);

    const ids = listDependencyProbeIds();
    expect(ids).toContain("test-a");
    expect(ids).toContain("test-b");
  });

  it("overwrites on re-register (idempotent)", () => {
    const p1 = makeProbe("dup");
    const p2 = makeProbe("dup");

    registerDependencyProbe(p1);
    registerDependencyProbe(p2);

    expect(listDependencyProbeIds()).toHaveLength(1);
  });

  it("unregisters a probe by id", () => {
    registerDependencyProbe(makeProbe("rm-me"));
    expect(listDependencyProbeIds()).toContain("rm-me");

    unregisterDependencyProbe("rm-me");
    expect(listDependencyProbeIds()).not.toContain("rm-me");
  });

  it("getDependencyHealthSnapshot returns cached status from all probes", () => {
    registerDependencyProbe(makeProbe("snap-a"));
    registerDependencyProbe(makeProbe("snap-b"));

    const snapshot = getDependencyHealthSnapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot.every((s) => s.status === "ok")).toBe(true);
  });

  it("refreshAllDependencyHealth calls refresh() on every probe", async () => {
    const p1 = makeProbe("r1");
    const p2 = makeProbe("r2");
    registerDependencyProbe(p1);
    registerDependencyProbe(p2);

    const results = await refreshAllDependencyHealth();
    expect(results).toHaveLength(2);
    expect(p1.refresh).toHaveBeenCalled();
    expect(p2.refresh).toHaveBeenCalled();
  });

  it("refreshDependencyHealth returns null for unknown id", async () => {
    const result = await refreshDependencyHealth("nope");
    expect(result).toBeNull();
  });

  it("refreshDependencyHealth refreshes a single probe", async () => {
    const probe = makeProbe("single");
    registerDependencyProbe(probe);

    const result = await refreshDependencyHealth("single");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("single");
    expect(probe.refresh).toHaveBeenCalled();
  });

  it("startDependencyHealthProbes calls start() on all probes", () => {
    const p = makeProbe("startable");
    registerDependencyProbe(p);

    startDependencyHealthProbes();
    expect(p.start).toHaveBeenCalled();
  });

  it("stopDependencyHealthProbes calls stop() and clears registry", () => {
    const p = makeProbe("stoppable");
    registerDependencyProbe(p);

    stopDependencyHealthProbes();
    expect(p.stop).toHaveBeenCalled();
    expect(listDependencyProbeIds()).toHaveLength(0);
  });
});
