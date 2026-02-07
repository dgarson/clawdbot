import { useQuery, useQueryClient } from "@tanstack/react-query";

// Types
export type GoalStatus = "not_started" | "in_progress" | "completed" | "paused";
export type GoalPriority = "low" | "medium" | "high" | "critical";

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number; // 0-100
  milestones: Milestone[];
  status: GoalStatus;
  priority?: GoalPriority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface GoalDetail extends Goal {
  assignedTo?: string;
  completedMilestones: number;
  totalMilestones: number;
  logs?: Array<{
    timestamp: string;
    message: string;
    type: "info" | "warning" | "error";
  }>;
}

// Query keys factory
export const goalKeys = {
  all: ["goals"] as const,
  lists: () => [...goalKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...goalKeys.lists(), filters] as const,
  details: () => [...goalKeys.all, "detail"] as const,
  detail: (id: string) => [...goalKeys.details(), id] as const,
};

// Mock API functions
async function fetchGoals(): Promise<Goal[]> {
  await new Promise((resolve) => setTimeout(resolve, 450));

  return [
    {
      id: "goal-1",
      title: "Launch MVP",
      description: "Complete and launch the minimum viable product",
      progress: 75,
      milestones: [
        { id: "m1", title: "Core features complete", completed: true },
        { id: "m2", title: "Beta testing", completed: true },
        { id: "m3", title: "Bug fixes", completed: true },
        { id: "m4", title: "Production deployment", completed: false },
      ],
      status: "in_progress",
      dueDate: new Date(Date.now() + 604800000).toISOString(),
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["product", "launch", "priority"],
    },
    {
      id: "goal-2",
      title: "Improve documentation",
      description: "Update and expand all project documentation",
      progress: 40,
      milestones: [
        { id: "m5", title: "API docs", completed: true },
        { id: "m6", title: "User guides", completed: true },
        { id: "m7", title: "Developer tutorials", completed: false },
        { id: "m8", title: "FAQ section", completed: false },
        { id: "m9", title: "Video tutorials", completed: false },
      ],
      status: "in_progress",
      dueDate: new Date(Date.now() + 1209600000).toISOString(),
      createdAt: new Date(Date.now() - 1296000000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      tags: ["docs", "content"],
    },
    {
      id: "goal-3",
      title: "Team expansion",
      description: "Hire two new developers for the team",
      progress: 0,
      milestones: [
        { id: "m10", title: "Job postings", completed: false },
        { id: "m11", title: "Interview candidates", completed: false },
        { id: "m12", title: "Make offers", completed: false },
      ],
      status: "not_started",
      dueDate: new Date(Date.now() + 2592000000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["hiring", "team"],
    },
    {
      id: "goal-4",
      title: "Q1 revenue target",
      description: "Achieve $50k MRR by end of Q1",
      progress: 100,
      milestones: [
        { id: "m13", title: "Reach $25k MRR", completed: true },
        { id: "m14", title: "Reach $40k MRR", completed: true },
        { id: "m15", title: "Reach $50k MRR", completed: true },
      ],
      status: "completed",
      createdAt: new Date(Date.now() - 7776000000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
      tags: ["revenue", "business"],
    },
  ];
}

async function fetchGoal(id: string): Promise<Goal | null> {
  const goals = await fetchGoals();
  return goals.find((g) => g.id === id) ?? null;
}

async function fetchGoalsByStatus(status: GoalStatus): Promise<Goal[]> {
  const goals = await fetchGoals();
  return goals.filter((g) => g.status === status);
}

// Query hooks
export function useGoals() {
  return useQuery({
    queryKey: goalKeys.lists(),
    queryFn: fetchGoals,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: () => fetchGoal(id),
    enabled: !!id,
  });
}

export function useGoalsByStatus(status: GoalStatus) {
  return useQuery({
    queryKey: goalKeys.list({ status }),
    queryFn: () => fetchGoalsByStatus(status),
    enabled: !!status,
  });
}

/**
 * Hook to invalidate all goal queries
 */
export function useInvalidateGoals() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: goalKeys.all });
}
