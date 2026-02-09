import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import {
  cancelGoal,
  createGoal as createOverseerGoal,
  deleteGoal as deleteOverseerGoal,
  pauseGoal,
  resumeGoal,
  updateGoal as updateOverseerGoal,
} from "@/lib/api/overseer";
import type { Goal, GoalStatus } from "../queries/useGoals";
import { goalKeys, mapOverseerGoalToGoal } from "../queries/useGoals";
import { useGatewayEnabled, useGatewayModeKey } from "../useGatewayEnabled";

type CreateGoalInput = Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress"> & {
  progress?: number;
};

export interface UpdateGoalInput {
  id: string;
  data: Partial<Omit<Goal, "id" | "createdAt" | "updatedAt">>;
}

interface MilestoneInput {
  goalId: string;
  milestone: {
    id?: string;
    title: string;
    completed: boolean;
    dueDate?: string;
  };
}

interface DeleteMilestoneInput {
  goalId: string;
  milestoneId: string;
}

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
  data: CreateGoalInput
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

async function readonlyGoalMutation<TData>(message: string): Promise<TData> {
  throw new Error(message);
}

// Mutation hooks
export function useCreateGoal() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();

  return useMutation<Goal, Error, CreateGoalInput>({
    mutationFn: (data: CreateGoalInput) =>
      liveMode
        ? createGoalLive(data)
        : readonlyGoalMutation<Goal>("Goals are read-only when the gateway is offline."),
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
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();

  return useMutation<Goal, Error, UpdateGoalInput, { previousGoals?: Goal[] }>({
    mutationFn: async (input: UpdateGoalInput) => {
      if (!liveMode) {
        throw new Error("Editing goals requires a live gateway connection.");
      }
      // Call the real overseer.goal.update RPC
      await updateOverseerGoal({
        goalId: input.id,
        title: input.data.title,
        problemStatement: input.data.description,
        successCriteria: input.data.successCriteria,
        constraints: input.data.constraints,
      });
      // Return a merged Goal object with the updated fields applied
      const existingGoals = queryClient.getQueryData<Goal[]>(
        goalKeys.list({ mode: modeKey })
      );
      const existing = existingGoals?.find((g) => g.id === input.id);
      return {
        ...(existing ?? ({} as Goal)),
        ...input.data,
        id: input.id,
        updatedAt: new Date().toISOString(),
      } as Goal;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.list({ mode: modeKey }) });
      const previousGoals = queryClient.getQueryData<Goal[]>(
        goalKeys.list({ mode: modeKey })
      );
      // Optimistic update
      queryClient.setQueryData<Goal[]>(goalKeys.list({ mode: modeKey }), (old) =>
        old
          ? old.map((goal) =>
              goal.id === input.id
                ? { ...goal, ...input.data, updatedAt: new Date().toISOString() }
                : goal
            )
          : []
      );
      return { previousGoals };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
      toast.success("Goal updated successfully");
    },
    onError: (error, _input, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(goalKeys.list({ mode: modeKey }), context.previousGoals);
      }
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

  return useMutation<string, Error, string, { previousGoals?: Goal[] }>({
    mutationFn: (id: string) =>
      liveMode
        ? deleteGoalLive(id)
        : readonlyGoalMutation<string>(
            "Deleting goals requires a live gateway connection."
          ),
    onMutate: async (id: string) => {
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
    onError: (_error, _id, context) => {
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

  return useMutation<
    { id: string; status: GoalStatus },
    Error,
    { id: string; status: GoalStatus },
    { previousGoal?: Goal }
  >({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) =>
      liveMode
        ? updateGoalStatusLive(id, status)
        : readonlyGoalMutation<{ id: string; status: GoalStatus }>(
            "Updating goal status requires a live gateway connection."
          ),
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
  return useMutation<Goal, Error, MilestoneInput>({
    mutationFn: (_input: MilestoneInput) =>
      readonlyGoalMutation<Goal>(
        "Milestone updates are not available via the gateway yet."
      ),
    onError: (error) => {
      toast.error(
        `Failed to add milestone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateMilestone() {
  return useMutation<Goal, Error, MilestoneInput>({
    mutationFn: (_input: MilestoneInput) =>
      readonlyGoalMutation<Goal>(
        "Milestone updates are not available via the gateway yet."
      ),
    onError: (error) => {
      toast.error(
        `Failed to update milestone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteMilestone() {
  return useMutation<Goal, Error, DeleteMilestoneInput>({
    mutationFn: (_input: DeleteMilestoneInput) =>
      readonlyGoalMutation<Goal>(
        "Milestone updates are not available via the gateway yet."
      ),
    onError: (error) => {
      toast.error(
        `Failed to delete milestone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
