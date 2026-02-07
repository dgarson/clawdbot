import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock so it's available before vi.mock runs
const hoisted = vi.hoisted(() => {
  const request = vi.fn();
  return { request };
});

vi.mock("./gateway-client", () => ({
  getGatewayClient: () => ({ request: hoisted.request }),
}));

import {
  listNodes,
  listDevices,
  approveDevice,
  rejectDevice,
  rotateDeviceToken,
  revokeDeviceToken,
  getExecApprovals,
  setExecApprovals,
} from "./nodes";

describe("nodes API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // listNodes
  // ---------------------------------------------------------------------------
  describe("listNodes", () => {
    it("calls node.list RPC", async () => {
      const result = { nodes: [{ nodeId: "n1", caps: [], commands: [] }] };
      hoisted.request.mockResolvedValueOnce(result);

      const res = await listNodes();
      expect(hoisted.request).toHaveBeenCalledWith("node.list", {});
      expect(res).toEqual(result);
    });
  });

  // ---------------------------------------------------------------------------
  // listDevices
  // ---------------------------------------------------------------------------
  describe("listDevices", () => {
    it("calls device.pair.list RPC", async () => {
      const result = { pending: [], paired: [] };
      hoisted.request.mockResolvedValueOnce(result);

      const res = await listDevices();
      expect(hoisted.request).toHaveBeenCalledWith("device.pair.list", {});
      expect(res).toEqual(result);
    });
  });

  // ---------------------------------------------------------------------------
  // approveDevice / rejectDevice
  // ---------------------------------------------------------------------------
  describe("approveDevice", () => {
    it("calls device.pair.approve with requestId", async () => {
      hoisted.request.mockResolvedValueOnce(undefined);

      await approveDevice("req-123");
      expect(hoisted.request).toHaveBeenCalledWith("device.pair.approve", {
        requestId: "req-123",
      });
    });
  });

  describe("rejectDevice", () => {
    it("calls device.pair.reject with requestId", async () => {
      hoisted.request.mockResolvedValueOnce(undefined);

      await rejectDevice("req-456");
      expect(hoisted.request).toHaveBeenCalledWith("device.pair.reject", {
        requestId: "req-456",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // rotateDeviceToken / revokeDeviceToken
  // ---------------------------------------------------------------------------
  describe("rotateDeviceToken", () => {
    it("sends deviceId, role, and scopes", async () => {
      hoisted.request.mockResolvedValueOnce(undefined);

      await rotateDeviceToken("dev-1", "operator", ["admin"]);
      expect(hoisted.request).toHaveBeenCalledWith("device.token.rotate", {
        deviceId: "dev-1",
        role: "operator",
        scopes: ["admin"],
      });
    });

    it("sends undefined scopes when not provided", async () => {
      hoisted.request.mockResolvedValueOnce(undefined);

      await rotateDeviceToken("dev-1", "agent");
      expect(hoisted.request).toHaveBeenCalledWith("device.token.rotate", {
        deviceId: "dev-1",
        role: "agent",
        scopes: undefined,
      });
    });
  });

  describe("revokeDeviceToken", () => {
    it("sends deviceId and role", async () => {
      hoisted.request.mockResolvedValueOnce(undefined);

      await revokeDeviceToken("dev-1", "operator");
      expect(hoisted.request).toHaveBeenCalledWith("device.token.revoke", {
        deviceId: "dev-1",
        role: "operator",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getExecApprovals
  // ---------------------------------------------------------------------------
  describe("getExecApprovals", () => {
    it("defaults to gateway target", async () => {
      const snap = { path: "/test", exists: true, hash: "h1", file: {} };
      hoisted.request.mockResolvedValueOnce(snap);

      const res = await getExecApprovals();
      expect(hoisted.request).toHaveBeenCalledWith("exec.approvals.get", {});
      expect(res).toEqual(snap);
    });

    it("calls gateway RPC when target is gateway", async () => {
      hoisted.request.mockResolvedValueOnce({});

      await getExecApprovals("gateway");
      expect(hoisted.request).toHaveBeenCalledWith("exec.approvals.get", {});
    });

    it("calls node RPC when target is node with nodeId", async () => {
      hoisted.request.mockResolvedValueOnce({});

      await getExecApprovals("node", "node-1");
      expect(hoisted.request).toHaveBeenCalledWith(
        "exec.approvals.node.get",
        { nodeId: "node-1" },
      );
    });

    it("falls back to gateway when target is node but no nodeId", async () => {
      hoisted.request.mockResolvedValueOnce({});

      await getExecApprovals("node");
      expect(hoisted.request).toHaveBeenCalledWith("exec.approvals.get", {});
    });
  });

  // ---------------------------------------------------------------------------
  // setExecApprovals
  // ---------------------------------------------------------------------------
  describe("setExecApprovals", () => {
    const testFile = { version: 1, defaults: { security: "deny" } };

    it("calls gateway set RPC by default", async () => {
      hoisted.request.mockResolvedValueOnce({ ok: true, hash: "h2" });

      const res = await setExecApprovals(testFile, "h1");
      expect(hoisted.request).toHaveBeenCalledWith("exec.approvals.set", {
        file: testFile,
        hash: "h1",
      });
      expect(res).toEqual({ ok: true, hash: "h2" });
    });

    it("calls node set RPC when target is node with nodeId", async () => {
      hoisted.request.mockResolvedValueOnce({ ok: true, hash: "h3" });

      await setExecApprovals(testFile, "h1", "node", "node-2");
      expect(hoisted.request).toHaveBeenCalledWith(
        "exec.approvals.node.set",
        { nodeId: "node-2", file: testFile, hash: "h1" },
      );
    });

    it("falls back to gateway when target is node but no nodeId", async () => {
      hoisted.request.mockResolvedValueOnce({ ok: true, hash: "h4" });

      await setExecApprovals(testFile, "h1", "node");
      expect(hoisted.request).toHaveBeenCalledWith("exec.approvals.set", {
        file: testFile,
        hash: "h1",
      });
    });
  });
});
