import { useQuery, useQueryClient } from "@tanstack/react-query";

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

const mockQueues: WorkQueue[] = [
  {
    id: "queue-2",
    agentId: "2",
    name: "Core Engineering Queue",
    concurrencyLimit: 2,
    defaultPriority: "high",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "queue-3",
    agentId: "3",
    name: "Content Ops Queue",
    concurrencyLimit: 1,
    defaultPriority: "medium",
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

let mockItems: WorkQueueItem[] = [
  {
    id: "item-101",
    queueId: "queue-2",
    title: "Wire up Work Queue UI",
    description: "Implement queue hooks and UI bindings",
    status: "in_progress",
    priority: "critical",
    tags: ["frontend"],
    workstreamId: "ws-1",
    taskId: "task-ws-1-6",
    assignedTo: "2",
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "item-102",
    queueId: "queue-2",
    title: "Prep integration tests",
    description: "Align integration test plan with new workstreams",
    status: "pending",
    priority: "high",
    tags: ["testing"],
    workstreamId: "ws-1",
    taskId: "task-ws-1-9",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "item-103",
    queueId: "queue-2",
    title: "Resolve infra blocker",
    description: "Unblock the performance optimization task",
    status: "blocked",
    statusReason: "Waiting on vendor review",
    priority: "medium",
    tags: ["infra"],
    workstreamId: "ws-3",
    taskId: "task-ws-3-10",
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "item-201",
    queueId: "queue-3",
    title: "Publish Q2 campaign assets",
    description: "Finalize distribution for social channels",
    status: "in_progress",
    priority: "high",
    tags: ["marketing"],
    workstreamId: "ws-2",
    taskId: "task-ws-2-6",
    assignedTo: "3",
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "item-202",
    queueId: "queue-3",
    title: "Review copy drafts",
    description: "Approval pass for new landing page copy",
    status: "pending",
    priority: "low",
    tags: ["copy"],
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateStats(items: WorkQueueItem[]): WorkQueueStats {
  const stats = {
    pending: 0,
    inProgress: 0,
    blocked: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: items.length,
  } satisfies WorkQueueStats;

  for (const item of items) {
    switch (item.status) {
      case "pending":
        stats.pending += 1;
        break;
      case "in_progress":
        stats.inProgress += 1;
        break;
      case "blocked":
        stats.blocked += 1;
        break;
      case "completed":
        stats.completed += 1;
        break;
      case "failed":
        stats.failed += 1;
        break;
      case "cancelled":
        stats.cancelled += 1;
        break;
      default:
        break;
    }
  }

  return stats;
}

export function patchMockWorkQueueItem(
  itemId: string,
  patch: Partial<WorkQueueItem>
): WorkQueueItem | null {
  const index = mockItems.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return null;
  }

  const updated: WorkQueueItem = {
    ...mockItems[index],
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };

  mockItems = [...mockItems.slice(0, index), updated, ...mockItems.slice(index + 1)];
  return updated;
}

async function fetchWorkQueues(): Promise<WorkQueue[]> {
  await delay(300);
  return mockQueues;
}

async function fetchWorkQueue(queueId: string): Promise<WorkQueue | null> {
  await delay(200);
  return mockQueues.find((queue) => queue.id === queueId) ?? null;
}

async function fetchWorkQueueItems(queueId?: string): Promise<WorkQueueItem[]> {
  await delay(250);
  if (!queueId) {
    return mockItems;
  }
  return mockItems.filter((item) => item.queueId === queueId);
}

async function fetchWorkQueueStatusByAgent(agentId: string): Promise<WorkQueueStatusSnapshot> {
  await delay(250);
  const queue = mockQueues.find((entry) => entry.agentId === agentId) ?? null;
  if (!queue) {
    return { queue: null, stats: null, items: [] };
  }
  const items = mockItems.filter((item) => item.queueId === queue.id);
  const stats = calculateStats(items);
  return { queue, stats, items };
}

export function useWorkQueues() {
  return useQuery({
    queryKey: workQueueKeys.queues(),
    queryFn: fetchWorkQueues,
    staleTime: 1000 * 60 * 2,
  });
}

export function useWorkQueue(queueId: string) {
  return useQuery({
    queryKey: workQueueKeys.queue(queueId),
    queryFn: () => fetchWorkQueue(queueId),
    enabled: !!queueId,
  });
}

export function useWorkQueueItems(queueId?: string) {
  return useQuery({
    queryKey: queueId ? workQueueKeys.itemsByQueue(queueId) : workQueueKeys.items(),
    queryFn: () => fetchWorkQueueItems(queueId),
  });
}

export function useWorkQueueStatusByAgent(agentId: string) {
  return useQuery({
    queryKey: workQueueKeys.statusByAgent(agentId),
    queryFn: () => fetchWorkQueueStatusByAgent(agentId),
    enabled: !!agentId,
    refetchInterval: 1000 * 30,
  });
}

export function useInvalidateWorkQueue() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: workQueueKeys.all });
}
