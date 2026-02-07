import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

// Hoist mock implementations
const hoisted = vi.hoisted(() => ({
  approveDevice: vi.fn(),
  rejectDevice: vi.fn(),
  rotateDeviceToken: vi.fn(),
  revokeDeviceToken: vi.fn(),
  setExecApprovals: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/nodes", () => ({
  approveDevice: hoisted.approveDevice,
  rejectDevice: hoisted.rejectDevice,
  rotateDeviceToken: hoisted.rotateDeviceToken,
  revokeDeviceToken: hoisted.revokeDeviceToken,
  setExecApprovals: hoisted.setExecApprovals,
}));

vi.mock("sonner", () => ({
  toast: hoisted.toast,
}));

import {
  useApproveDevice,
  useRejectDevice,
  useRotateDeviceToken,
  useRevokeDeviceToken,
  useSaveExecApprovals,
} from "./useNodeMutations";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useNodeMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // useApproveDevice
  // ---------------------------------------------------------------------------
  describe("useApproveDevice", () => {
    it("calls approveDevice and shows success toast", async () => {
      hoisted.approveDevice.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApproveDevice(), {
        wrapper: createWrapper(),
      });

      result.current.mutate("req-1");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(hoisted.approveDevice).toHaveBeenCalledWith("req-1");
      expect(hoisted.toast.success).toHaveBeenCalledWith("Device approved");
    });

    it("shows error toast on failure", async () => {
      hoisted.approveDevice.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() => useApproveDevice(), {
        wrapper: createWrapper(),
      });

      result.current.mutate("req-1");
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(hoisted.toast.error).toHaveBeenCalledWith(
        "Failed to approve device",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // useRejectDevice
  // ---------------------------------------------------------------------------
  describe("useRejectDevice", () => {
    it("calls rejectDevice and shows success toast", async () => {
      hoisted.rejectDevice.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useRejectDevice(), {
        wrapper: createWrapper(),
      });

      result.current.mutate("req-2");
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(hoisted.rejectDevice).toHaveBeenCalledWith("req-2");
      expect(hoisted.toast.success).toHaveBeenCalledWith("Device rejected");
    });
  });

  // ---------------------------------------------------------------------------
  // useRotateDeviceToken
  // ---------------------------------------------------------------------------
  describe("useRotateDeviceToken", () => {
    it("calls rotateDeviceToken with params", async () => {
      hoisted.rotateDeviceToken.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useRotateDeviceToken(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        deviceId: "dev-1",
        role: "operator",
        scopes: ["admin"],
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(hoisted.rotateDeviceToken).toHaveBeenCalledWith(
        "dev-1",
        "operator",
        ["admin"],
      );
      expect(hoisted.toast.success).toHaveBeenCalledWith("Token rotated");
    });
  });

  // ---------------------------------------------------------------------------
  // useRevokeDeviceToken
  // ---------------------------------------------------------------------------
  describe("useRevokeDeviceToken", () => {
    it("calls revokeDeviceToken with params", async () => {
      hoisted.revokeDeviceToken.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useRevokeDeviceToken(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ deviceId: "dev-1", role: "agent" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(hoisted.revokeDeviceToken).toHaveBeenCalledWith("dev-1", "agent");
      expect(hoisted.toast.success).toHaveBeenCalledWith("Token revoked");
    });

    it("shows error toast on failure", async () => {
      hoisted.revokeDeviceToken.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() => useRevokeDeviceToken(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ deviceId: "dev-1", role: "agent" });
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(hoisted.toast.error).toHaveBeenCalledWith(
        "Failed to revoke token",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // useSaveExecApprovals
  // ---------------------------------------------------------------------------
  describe("useSaveExecApprovals", () => {
    it("calls setExecApprovals with gateway target by default", async () => {
      hoisted.setExecApprovals.mockResolvedValueOnce({
        ok: true,
        hash: "h2",
      });

      const { result } = renderHook(() => useSaveExecApprovals(), {
        wrapper: createWrapper(),
      });

      const file = { version: 1, defaults: { security: "deny" } };
      result.current.mutate({ file, hash: "h1" });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(hoisted.setExecApprovals).toHaveBeenCalledWith(
        file,
        "h1",
        "gateway",
        undefined,
      );
      expect(hoisted.toast.success).toHaveBeenCalledWith("Approvals saved");
    });

    it("passes target and nodeId for node target", async () => {
      hoisted.setExecApprovals.mockResolvedValueOnce({
        ok: true,
        hash: "h3",
      });

      const { result } = renderHook(() => useSaveExecApprovals(), {
        wrapper: createWrapper(),
      });

      const file = { version: 1 };
      result.current.mutate({
        file,
        hash: "h1",
        target: "node",
        nodeId: "node-1",
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(hoisted.setExecApprovals).toHaveBeenCalledWith(
        file,
        "h1",
        "node",
        "node-1",
      );
    });

    it("shows error toast on failure", async () => {
      hoisted.setExecApprovals.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() => useSaveExecApprovals(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ file: {}, hash: "h1" });
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(hoisted.toast.error).toHaveBeenCalledWith(
        "Failed to save approvals",
      );
    });
  });
});
