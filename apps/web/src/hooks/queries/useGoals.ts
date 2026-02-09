import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGoalStatus, listOverseerGoals, type OverseerGoal } from "@/lib/api/overseer";
import { useGatewayEnabled, useGatewayModeKey } from "../useGatewayEnabled";

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
  /** Success criteria from overseer goal detail */
  successCriteria?: string[];
  /** Constraints from overseer goal detail */
  constraints?: string[];
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
  detail: (id: string, mode?: "live" | "mock") => [...goalKeys.details(), id, mode] as const,
};

const allowedGoalPriorities: GoalPriority[] = ["low", "medium", "high", "critical"];

function toGoalStatus(status: OverseerGoal["status"]): GoalStatus {
  switch (status) {
    case "pending":
      return "not_started";
    case "running":
      return "in_progress";
    case "completed":
      return "completed";
    case "paused":
      return "paused";
    case "failed":
      return "paused";
    default:
      return "not_started";
  }
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value.filter((tag) => typeof tag === "string");
  return tags.length > 0 ? tags : undefined;
}

function normalizeMilestones(value: unknown): Milestone[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      if (typeof record.title !== "string") {
        return null;
      }
      const milestone: Milestone = {
        id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
        title: record.title,
        completed: Boolean(record.completed),
      };
      if (typeof record.dueDate === "string") {
        milestone.dueDate = record.dueDate;
      }
      return milestone;
    })
    .filter((entry): entry is Milestone => entry !== null);
}

export function mapOverseerGoalToGoal(goal: OverseerGoal): Goal {
  const metadata = goal.metadata ?? {};
  const milestoneOverrides = normalizeMilestones(metadata.milestones);
  const priority = allowedGoalPriorities.includes(metadata.priority as GoalPriority)
    ? (metadata.priority as GoalPriority)
    : undefined;

  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    progress: Math.round(goal.progress ?? 0),
    milestones: milestoneOverrides,
    status: toGoalStatus(goal.status),
    priority,
    dueDate: typeof metadata.dueDate === "string" ? metadata.dueDate : undefined,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    tags: normalizeTags(metadata.tags),
    successCriteria: goal.successCriteria,
    constraints: goal.constraints,
  };
}

async function fetchGoalsLive(): Promise<Goal[]> {
  const result = await listOverseerGoals({ limit: 100 });
  return result.goals.map(mapOverseerGoalToGoal);
}

async function fetchGoalLive(id: string): Promise<Goal | null> {
  const result = await getGoalStatus(id);
  return result.goal ? mapOverseerGoalToGoal(result.goal) : null;
}

async function fetchGoalsByStatus(
  status: GoalStatus,
  liveMode: boolean
): Promise<Goal[]> {
  if (!liveMode) {
    return [];
  }
  const goals = await fetchGoalsLive();
  return goals.filter((g) => g.status === status);
}

// Query hooks
export function useGoals() {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: goalKeys.list({ mode: modeKey }),
    queryFn: () => (liveMode ? fetchGoalsLive() : []),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGoal(id: string) {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: goalKeys.detail(id, modeKey),
    queryFn: () => (liveMode ? fetchGoalLive(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useGoalsByStatus(status: GoalStatus) {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: goalKeys.list({ status, mode: modeKey }),
    queryFn: () => fetchGoalsByStatus(status, liveMode),
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
