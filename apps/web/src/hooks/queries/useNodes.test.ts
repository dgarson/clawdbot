import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

// Hoist mock state
const hoisted = vi.hoisted(() => ({
  listNodes: vi.fn(),
  listDevices: vi.fn(),
  getExecApprovals: vi.fn(),
  useLiveGateway: false,
}));

vi.mock("@/lib/api/nodes", () => ({
  listNodes: hoisted.listNodes,
  listDevices: hoisted.listDevices,
  getExecApprovals: hoisted.getExecApprovals,
}));

vi.mock("@/stores/useUIStore", () => ({
  useUIStore: (selector: (s: { useLiveGateway: boolean }) => boolean) =>
    selector({ useLiveGateway: hoisted.useLiveGateway }),
}));

import { useNodes, useDevices, useExecApprovals, nodeKeys } from "./useNodes";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useNodes hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useLiveGateway = false;
  });

  // ---------------------------------------------------------------------------
  // nodeKeys
  // ---------------------------------------------------------------------------
  describe("nodeKeys", () => {
    it("generates correct query key hierarchy", () => {
      expect(nodeKeys.all).toEqual(["nodes"]);
      expect(nodeKeys.list()).toEqual(["nodes", "list"]);
      expect(nodeKeys.devices()).toEqual(["nodes", "devices"]);
      expect(nodeKeys.execApprovals("gateway")).toEqual([
        "nodes",
        "execApprovals",
        "gateway",
        undefined,
      ]);
      expect(nodeKeys.execApprovals("node", "n1")).toEqual([
        "nodes",
        "execApprovals",
        "node",
        "n1",
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // useNodes (mock mode)
  // ---------------------------------------------------------------------------
  describe("useNodes", () => {
    it("returns mock data in dev mode (non-live)", async () => {
      const { result } = renderHook(() => useNodes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Mock data has 3 nodes
      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(3);
      expect(result.current.data![0].nodeId).toBe("mbp-main");
    });
  });

  // ---------------------------------------------------------------------------
  // useDevices (mock mode)
  // ---------------------------------------------------------------------------
  describe("useDevices", () => {
    it("returns mock data in dev mode (non-live)", async () => {
      const { result } = renderHook(() => useDevices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.pending).toEqual([]);
      expect(result.current.data!.paired.length).toBe(2);
      expect(result.current.data!.paired[0].roles).toContain("operator");
    });
  });

  // ---------------------------------------------------------------------------
  // useExecApprovals (mock mode)
  // ---------------------------------------------------------------------------
  describe("useExecApprovals", () => {
    it("returns mock data in dev mode (non-live)", async () => {
      const { result } = renderHook(() => useExecApprovals(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.exists).toBe(true);
      expect(data.file.defaults?.security).toBe("deny");
      expect(data.file.defaults?.ask).toBe("on-miss");
      expect(data.file.agents).toBeDefined();
      expect(data.file.agents!["work"]).toBeDefined();
      expect(data.file.agents!["work"].security).toBe("allowlist");
    });

    it("uses different query key for node target", async () => {
      const { result } = renderHook(
        () => useExecApprovals("node", "node-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      // Should still return mock data (same mock for both targets in dev)
      expect(result.current.data).toBeDefined();
    });
  });
});
