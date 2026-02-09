import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

async function readonlyWorkQueueMutation(message: string): Promise<never> {
  throw new Error(message);
}

export function useClaimWorkItem() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkQueueMutation("Work queue actions require gateway support."),
    onError: (error) => {
      toast.error(
        `Failed to claim work item: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useReleaseWorkItem() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkQueueMutation("Work queue actions require gateway support."),
    onError: (error) => {
      toast.error(
        `Failed to release work item: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
