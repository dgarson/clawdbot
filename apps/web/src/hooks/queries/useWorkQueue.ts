import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGatewayModeKey } from "../useGatewayEnabled";

export type WorkQueueItemStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkQueueItemPriority = "critical" | "high" | "medium" | "low";

export interface WorkQueue {
  id: string;
  agentId: string;
  name: string;
  concurrencyLimit: number;
  defaultPriority: WorkQueueItemPriority;
  createdAt: string;
  updatedAt: string;
}

export interface WorkQueueItem {
  id: string;
  queueId: string;
  title: string;
  description?: string;
  status: WorkQueueItemStatus;
  statusReason?: string;
  priority: WorkQueueItemPriority;
  tags?: string[];
  workstreamId?: string;
  taskId?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkQueueStats {
  pending: number;
  inProgress: number;
  blocked: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface WorkQueueStatusSnapshot {
  queue: WorkQueue | null;
  stats: WorkQueueStats | null;
  items: WorkQueueItem[];
}

export const workQueueKeys = {
  all: ["work-queue"] as const,
  queues: () => [...workQueueKeys.all, "queues"] as const,
  queue: (queueId: string) => [...workQueueKeys.queues(), queueId] as const,
  items: () => [...workQueueKeys.all, "items"] as const,
  itemsByQueue: (queueId: string) => [...workQueueKeys.items(), queueId] as const,
  statusByAgent: (agentId: string) => [...workQueueKeys.all, "status", agentId] as const,
};

const emptyStats: WorkQueueStats = {
  pending: 0,
  inProgress: 0,
  blocked: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  total: 0,
};

async function fetchWorkQueues(): Promise<WorkQueue[]> {
  return [];
}

async function fetchWorkQueue(queueId: string): Promise<WorkQueue | null> {
  const queues = await fetchWorkQueues();
  return queues.find((queue) => queue.id === queueId) ?? null;
}

async function fetchWorkQueueItems(queueId?: string): Promise<WorkQueueItem[]> {
  if (!queueId) {
    return [];
  }
  return [];
}

async function fetchWorkQueueStatusByAgent(agentId: string): Promise<WorkQueueStatusSnapshot> {
  return {
    queue: null,
    stats: emptyStats,
    items: [],
  } as WorkQueueStatusSnapshot;
}

export function useWorkQueues() {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: [...workQueueKeys.queues(), modeKey],
    queryFn: fetchWorkQueues,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

export function useWorkQueue(queueId: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: [...workQueueKeys.queue(queueId), modeKey],
    queryFn: () => fetchWorkQueue(queueId),
    enabled: !!queueId,
  });
}

export function useWorkQueueItems(queueId?: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: queueId
      ? [...workQueueKeys.itemsByQueue(queueId), modeKey]
      : [...workQueueKeys.items(), modeKey],
    queryFn: () => fetchWorkQueueItems(queueId),
  });
}

export function useWorkQueueStatusByAgent(agentId: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: [...workQueueKeys.statusByAgent(agentId), modeKey],
    queryFn: () => fetchWorkQueueStatusByAgent(agentId),
    enabled: !!agentId,
  });
}

export function useInvalidateWorkQueue() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: workQueueKeys.all });
}
