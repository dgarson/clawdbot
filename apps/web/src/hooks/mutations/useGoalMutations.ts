import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import type { Goal, Milestone, GoalStatus } from "../queries/useGoals";
import { goalKeys } from "../queries/useGoals";

// Mock API functions
async function createGoal(
  data: Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress"> & {
    progress?: number;
  }
): Promise<Goal> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const now = new Date().toISOString();
  return {
    ...data,
    id: uuidv7(),
    progress: data.progress ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function updateGoal(
  data: Partial<Goal> & { id: string }
): Promise<Goal> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Goal;
}

async function deleteGoal(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return id;
}

async function updateGoalStatus(
  id: string,
  status: GoalStatus
): Promise<{ id: string; status: GoalStatus }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, status };
}

async function addMilestone(
  _goalId: string,
  milestone: Omit<Milestone, "id">
): Promise<Milestone> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    ...milestone,
    id: uuidv7(),
  };
}

async function updateMilestone(
  _goalId: string,
  milestone: Milestone
): Promise<Milestone> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return milestone;
}

async function deleteMilestone(
  goalId: string,
  milestoneId: string
): Promise<{ goalId: string; milestoneId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { goalId, milestoneId };
}

// Mutation hooks
export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGoal,
    onSuccess: (newGoal) => {
      queryClient.setQueryData<Goal[]>(goalKeys.lists(), (old) =>
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

  return useMutation({
    mutationFn: updateGoal,
    onMutate: async (updatedGoal) => {
      await queryClient.cancelQueries({
        queryKey: goalKeys.detail(updatedGoal.id),
      });

      const previousGoal = queryClient.getQueryData<Goal>(
        goalKeys.detail(updatedGoal.id)
      );

      queryClient.setQueryData<Goal>(goalKeys.detail(updatedGoal.id), (old) =>
        old ? { ...old, ...updatedGoal } : undefined
      );

      return { previousGoal };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
      toast.success("Goal updated successfully");
    },
    onError: (_error, variables, context) => {
      if (context?.previousGoal) {
        queryClient.setQueryData(
          goalKeys.detail(variables.id),
          context.previousGoal
        );
      }
      toast.error("Failed to update goal");
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGoal,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.lists() });

      const previousGoals = queryClient.getQueryData<Goal[]>(goalKeys.lists());

      queryClient.setQueryData<Goal[]>(goalKeys.lists(), (old) =>
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
        queryClient.setQueryData(goalKeys.lists(), context.previousGoals);
      }
      toast.error("Failed to delete goal");
    },
  });
}

export function useUpdateGoalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) =>
      updateGoalStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.detail(id) });

      const previousGoal = queryClient.getQueryData<Goal>(goalKeys.detail(id));

      queryClient.setQueryData<Goal>(goalKeys.detail(id), (old) =>
        old ? { ...old, status } : undefined
      );

      queryClient.setQueryData<Goal[]>(goalKeys.lists(), (old) =>
        old
          ? old.map((goal) => (goal.id === id ? { ...goal, status } : goal))
          : []
      );

      return { previousGoal };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(variables.id) });
      toast.success(`Goal marked as ${variables.status.replace("_", " ")}`);
    },
    onError: (_error, variables, context) => {
      if (context?.previousGoal) {
        queryClient.setQueryData(
          goalKeys.detail(variables.id),
          context.previousGoal
        );
      }
      toast.error("Failed to update goal status");
    },
  });
}

export function useAddMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      milestone,
    }: {
      goalId: string;
      milestone: Omit<Milestone, "id">;
    }) => addMilestone(goalId, milestone),
    onSuccess: (newMilestone, { goalId }) => {
      queryClient.setQueryData<Goal>(goalKeys.detail(goalId), (old) =>
        old
          ? { ...old, milestones: [...old.milestones, newMilestone] }
          : undefined
      );
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      toast.success("Milestone added");
    },
    onError: () => {
      toast.error("Failed to add milestone");
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      milestone,
    }: {
      goalId: string;
      milestone: Milestone;
    }) => updateMilestone(goalId, milestone),
    onMutate: async ({ goalId, milestone }) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.detail(goalId) });

      const previousGoal = queryClient.getQueryData<Goal>(
        goalKeys.detail(goalId)
      );

      queryClient.setQueryData<Goal>(goalKeys.detail(goalId), (old) =>
        old
          ? {
              ...old,
              milestones: old.milestones.map((m) =>
                m.id === milestone.id ? milestone : m
              ),
            }
          : undefined
      );

      return { previousGoal };
    },
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      toast.success("Milestone updated");
    },
    onError: (_error, { goalId }, context) => {
      if (context?.previousGoal) {
        queryClient.setQueryData(goalKeys.detail(goalId), context.previousGoal);
      }
      toast.error("Failed to update milestone");
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      milestoneId,
    }: {
      goalId: string;
      milestoneId: string;
    }) => deleteMilestone(goalId, milestoneId),
    onMutate: async ({ goalId, milestoneId }) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.detail(goalId) });

      const previousGoal = queryClient.getQueryData<Goal>(
        goalKeys.detail(goalId)
      );

      queryClient.setQueryData<Goal>(goalKeys.detail(goalId), (old) =>
        old
          ? {
              ...old,
              milestones: old.milestones.filter((m) => m.id !== milestoneId),
            }
          : undefined
      );

      return { previousGoal };
    },
    onSuccess: () => {
      toast.success("Milestone deleted");
    },
    onError: (_error, { goalId }, context) => {
      if (context?.previousGoal) {
        queryClient.setQueryData(goalKeys.detail(goalId), context.previousGoal);
      }
      toast.error("Failed to delete milestone");
    },
  });
}
