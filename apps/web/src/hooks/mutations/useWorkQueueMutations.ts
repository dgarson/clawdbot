import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  patchMockWorkQueueItem,
  workQueueKeys,
  type WorkQueueItem,
} from "../queries/useWorkQueue";

interface ClaimWorkItemParams {
  itemId: string;
  agentId: string;
}

interface ReleaseWorkItemParams {
  itemId: string;
}

async function claimWorkItem({ itemId, agentId }: ClaimWorkItemParams): Promise<WorkQueueItem> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const now = new Date().toISOString();
  const updated = patchMockWorkQueueItem(itemId, {
    status: "in_progress",
    assignedTo: agentId,
    startedAt: now,
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Work item not found");
  }

  return updated;
}

async function releaseWorkItem({ itemId }: ReleaseWorkItemParams): Promise<WorkQueueItem> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const now = new Date().toISOString();
  const updated = patchMockWorkQueueItem(itemId, {
    status: "pending",
    assignedTo: undefined,
    statusReason: "Released",
    updatedAt: now,
    startedAt: undefined,
  });

  if (!updated) {
    throw new Error("Work item not found");
  }

  return updated;
}

export function useClaimWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: claimWorkItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workQueueKeys.all });
      toast.success("Work item claimed");
    },
    onError: (error) => {
      toast.error(
        `Failed to claim work item: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useReleaseWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: releaseWorkItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workQueueKeys.all });
      toast.success("Work item released");
    },
    onError: (error) => {
      toast.error(
        `Failed to release work item: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
