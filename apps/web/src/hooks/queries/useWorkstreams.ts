import { useQuery } from "@tanstack/react-query";
import { useGatewayModeKey } from "../useGatewayEnabled";

// Types
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type WorkstreamStatus = "active" | "paused" | "completed" | "archived";

export interface Task {
  id: string;
  workstreamId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  dependencies?: string[]; // Task IDs this task depends on
  tags?: string[];
}

export interface Workstream {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  progress: number; // 0-100
  status: WorkstreamStatus;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// Query keys factory
export const workstreamKeys = {
  all: ["workstreams"] as const,
  lists: () => [...workstreamKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...workstreamKeys.lists(), filters] as const,
  details: () => [...workstreamKeys.all, "detail"] as const,
  detail: (id: string, mode?: "live" | "mock") => [...workstreamKeys.details(), id, mode] as const,
  tasks: (workstreamId: string, mode?: "live" | "mock") =>
    [...workstreamKeys.detail(workstreamId, mode), "tasks"] as const,
};

async function fetchWorkstreams(): Promise<Workstream[]> {
  return [];
}

async function fetchWorkstream(id: string): Promise<Workstream | null> {
  const workstreams = await fetchWorkstreams();
  return workstreams.find((w) => w.id === id) ?? null;
}

async function fetchWorkstreamsByStatus(
  status: WorkstreamStatus
): Promise<Workstream[]> {
  const workstreams = await fetchWorkstreams();
  return workstreams.filter((w) => w.status === status);
}

async function fetchWorkstreamsByOwner(ownerId: string): Promise<Workstream[]> {
  const workstreams = await fetchWorkstreams();
  return workstreams.filter((w) => w.ownerId === ownerId);
}

async function fetchTasks(workstreamId: string): Promise<Task[]> {
  const workstream = await fetchWorkstream(workstreamId);
  return workstream?.tasks ?? [];
}

async function fetchTasksByStatus(
  workstreamId: string,
  status: TaskStatus
): Promise<Task[]> {
  const tasks = await fetchTasks(workstreamId);
  return tasks.filter((t) => t.status === status);
}

// Query hooks
export function useWorkstreams() {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: workstreamKeys.list({ mode: modeKey }),
    queryFn: fetchWorkstreams,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

export function useWorkstream(id: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: workstreamKeys.detail(id, modeKey),
    queryFn: () => fetchWorkstream(id),
    enabled: !!id,
  });
}

export function useWorkstreamsByStatus(status: WorkstreamStatus) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: workstreamKeys.list({ status, mode: modeKey }),
    queryFn: () => fetchWorkstreamsByStatus(status),
    enabled: !!status,
  });
}

export function useWorkstreamsByOwner(ownerId: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: workstreamKeys.list({ ownerId, mode: modeKey }),
    queryFn: () => fetchWorkstreamsByOwner(ownerId),
    enabled: !!ownerId,
  });
}

export function useTasks(workstreamId: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: workstreamKeys.tasks(workstreamId, modeKey),
    queryFn: () => fetchTasks(workstreamId),
    enabled: !!workstreamId,
  });
}

export function useTasksByStatus(workstreamId: string, status: TaskStatus) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: [...workstreamKeys.tasks(workstreamId, modeKey), { status }],
    queryFn: () => fetchTasksByStatus(workstreamId, status),
    enabled: !!workstreamId && !!status,
  });
}
