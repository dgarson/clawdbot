import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface ClaimWorkItemInput {
  itemId: string;
  agentId: string;
}

interface ReleaseWorkItemInput {
  itemId: string;
}

async function readonlyWorkQueueMutation<TData>(message: string): Promise<TData> {
  throw new Error(message);
}

export function useClaimWorkItem() {
  return useMutation<ClaimWorkItemInput, Error, ClaimWorkItemInput>({
    mutationFn: (_input) =>
      readonlyWorkQueueMutation<ClaimWorkItemInput>(
        "Work queue actions require gateway support."
      ),
    onError: (error) => {
      toast.error(
        `Failed to claim work item: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useReleaseWorkItem() {
  return useMutation<ReleaseWorkItemInput, Error, ReleaseWorkItemInput>({
    mutationFn: (_input) =>
      readonlyWorkQueueMutation<ReleaseWorkItemInput>(
        "Work queue actions require gateway support."
      ),
    onError: (error) => {
      toast.error(
        `Failed to release work item: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
