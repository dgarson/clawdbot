import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import {
  cancelGoal,
  createGoal as createOverseerGoal,
  deleteGoal as deleteOverseerGoal,
  pauseGoal,
  resumeGoal,
} from "@/lib/api/overseer";
import type { Goal, GoalStatus } from "../queries/useGoals";
import { goalKeys, mapOverseerGoalToGoal } from "../queries/useGoals";
import { useGatewayEnabled, useGatewayModeKey } from "../useGatewayEnabled";

function toGoalMetadata(data: {
  milestones: { id?: string; title: string; completed: boolean }[];
  dueDate?: string;
  priority?: Goal["priority"];
  tags?: string[];
}) {
  return {
    milestones: data.milestones.map((milestone) => ({
      id: milestone.id ?? uuidv7(),
      title: milestone.title,
      completed: milestone.completed,
    })),
    dueDate: data.dueDate,
    priority: data.priority,
    tags: data.tags,
  };
}

async function createGoalLive(
  data: Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress"> & {
    progress?: number;
  }
): Promise<Goal> {
  const result = await createOverseerGoal({
    title: data.title,
    description: data.description,
    metadata: toGoalMetadata({
      milestones: data.milestones,
      dueDate: data.dueDate,
      priority: data.priority,
      tags: data.tags,
    }),
  });
  return mapOverseerGoalToGoal(result.goal);
}

async function updateGoalStatusLive(
  id: string,
  status: GoalStatus
): Promise<{ id: string; status: GoalStatus }> {
  if (status === "paused") {
    await pauseGoal(id);
    return { id, status };
  }
  if (status === "in_progress") {
    await resumeGoal(id);
    return { id, status };
  }
  if (status === "completed") {
    await cancelGoal(id);
    return { id, status };
  }
  throw new Error("Goal status updates are limited to pause/resume right now.");
}

async function deleteGoalLive(id: string): Promise<string> {
  await deleteOverseerGoal(id);
  return id;
}

async function readonlyGoalMutation(message: string): Promise<never> {
  throw new Error(message);
}

// Mutation hooks
export function useCreateGoal() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();

  return useMutation({
    mutationFn: (data) =>
      liveMode
        ? createGoalLive(data)
        : readonlyGoalMutation("Goals are read-only when the gateway is offline."),
    onSuccess: (newGoal) => {
      queryClient.setQueryData<Goal[]>(goalKeys.list({ mode: modeKey }), (old) =>
        old ? [newGoal, ...old] : [newGoal]
      );
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
      toast.success("Goal created successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to create goal: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateGoal() {
  return useMutation({
    mutationFn: () =>
      readonlyGoalMutation("Editing goal details is not yet supported via the gateway."),
    onError: (error) => {
      toast.error(
        `Failed to update goal: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();

  return useMutation({
    mutationFn: (id) =>
      liveMode
        ? deleteGoalLive(id)
        : readonlyGoalMutation("Deleting goals requires a live gateway connection."),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.list({ mode: modeKey }) });

      const previousGoals = queryClient.getQueryData<Goal[]>(
        goalKeys.list({ mode: modeKey })
      );

      queryClient.setQueryData<Goal[]>(goalKeys.list({ mode: modeKey }), (old) =>
        old ? old.filter((goal) => goal.id !== id) : []
      );

      return { previousGoals };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
      toast.success("Goal deleted successfully");
    },
    onError: (_error, _, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalKeys.list({ mode: modeKey }), context.previousGoals);
      }
      toast.error("Failed to delete goal");
    },
  });
}

export function useUpdateGoalStatus() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) =>
      liveMode
        ? updateGoalStatusLive(id, status)
        : readonlyGoalMutation("Updating goal status requires a live gateway connection."),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.detail(id, modeKey) });

      const previousGoal = queryClient.getQueryData<Goal>(goalKeys.detail(id, modeKey));

      queryClient.setQueryData<Goal>(goalKeys.detail(id, modeKey), (old) =>
        old ? { ...old, status } : undefined
      );

      queryClient.setQueryData<Goal[]>(goalKeys.list({ mode: modeKey }), (old) =>
        old
          ? old.map((goal) => (goal.id === id ? { ...goal, status } : goal))
          : []
      );

      return { previousGoal };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: goalKeys.detail(variables.id, modeKey),
      });
      toast.success(`Goal marked as ${variables.status.replace("_", " ")}`);
    },
    onError: (_error, variables, context) => {
      if (context?.previousGoal) {
        queryClient.setQueryData(
          goalKeys.detail(variables.id, modeKey),
          context.previousGoal
        );
      }
      toast.error("Failed to update goal status");
    },
  });
}

export function useAddMilestone() {
  return useMutation({
    mutationFn: () =>
      readonlyGoalMutation("Milestone updates are not available via the gateway yet."),
    onError: (error) => {
      toast.error(
        `Failed to add milestone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateMilestone() {
  return useMutation({
    mutationFn: () =>
      readonlyGoalMutation("Milestone updates are not available via the gateway yet."),
    onError: (error) => {
      toast.error(
        `Failed to update milestone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteMilestone() {
  return useMutation({
    mutationFn: () =>
      readonlyGoalMutation("Milestone updates are not available via the gateway yet."),
    onError: (error) => {
      toast.error(
        `Failed to delete milestone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
