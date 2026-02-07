import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  approveDevice,
  rejectDevice,
  rotateDeviceToken,
  revokeDeviceToken,
  setExecApprovals,
  type ExecApprovalsFile,
} from "@/lib/api/nodes";
import { nodeKeys } from "@/hooks/queries/useNodes";

// ---------------------------------------------------------------------------
// Device mutations
// ---------------------------------------------------------------------------

export function useApproveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveDevice(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nodeKeys.devices() });
      toast.success("Device approved");
    },
    onError: () => toast.error("Failed to approve device"),
  });
}

export function useRejectDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => rejectDevice(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nodeKeys.devices() });
      toast.success("Device rejected");
    },
    onError: () => toast.error("Failed to reject device"),
  });
}

export function useRotateDeviceToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      deviceId: string;
      role: string;
      scopes?: string[];
    }) => rotateDeviceToken(params.deviceId, params.role, params.scopes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nodeKeys.devices() });
      toast.success("Token rotated");
    },
    onError: () => toast.error("Failed to rotate token"),
  });
}

export function useRevokeDeviceToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { deviceId: string; role: string }) =>
      revokeDeviceToken(params.deviceId, params.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nodeKeys.devices() });
      toast.success("Token revoked");
    },
    onError: () => toast.error("Failed to revoke token"),
  });
}

// ---------------------------------------------------------------------------
// Exec Approvals mutations
// ---------------------------------------------------------------------------

export interface SaveExecApprovalsParams {
  file: ExecApprovalsFile;
  hash: string;
  target?: "gateway" | "node";
  nodeId?: string;
}

export function useSaveExecApprovals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: SaveExecApprovalsParams) =>
      setExecApprovals(
        params.file,
        params.hash,
        params.target ?? "gateway",
        params.nodeId,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: nodeKeys.execApprovals(
          vars.target ?? "gateway",
          vars.nodeId,
        ),
      });
      toast.success("Approvals saved");
    },
    onError: () => toast.error("Failed to save approvals"),
  });
}
