import { useQuery } from "@tanstack/react-query";

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
  detail: (id: string) => [...workstreamKeys.details(), id] as const,
  tasks: (workstreamId: string) =>
    [...workstreamKeys.detail(workstreamId), "tasks"] as const,
};

// Mock data helper - creates tree-structured dependencies
function createMockTasks(workstreamId: string): Task[] {
  // Create a realistic DAG structure with proper dependencies
  // Tree structure: root tasks branch into subtasks that converge at milestones
  const tasks: Task[] = [
    // Level 0 - Root tasks (no dependencies)
    {
      id: `task-${workstreamId}-1`,
      workstreamId,
      title: "Requirements Analysis",
      description: "Gather and document project requirements",
      status: "done",
      priority: "high",
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      updatedAt: new Date(Date.now() - 432000000).toISOString(),
      tags: ["planning"],
    },
    {
      id: `task-${workstreamId}-2`,
      workstreamId,
      title: "Technical Spike",
      description: "Research technical approaches and constraints",
      status: "done",
      priority: "high",
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      updatedAt: new Date(Date.now() - 345600000).toISOString(),
      tags: ["research"],
    },
    // Level 1 - Depends on requirements
    {
      id: `task-${workstreamId}-3`,
      workstreamId,
      title: "Design System Setup",
      description: "Configure design tokens and component library",
      status: "done",
      priority: "medium",
      dependencies: [`task-${workstreamId}-1`],
      createdAt: new Date(Date.now() - 518400000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
      tags: ["design"],
    },
    {
      id: `task-${workstreamId}-4`,
      workstreamId,
      title: "API Schema Design",
      description: "Define API contracts and data models",
      status: "done",
      priority: "high",
      dependencies: [`task-${workstreamId}-1`, `task-${workstreamId}-2`],
      createdAt: new Date(Date.now() - 518400000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      tags: ["backend"],
    },
    {
      id: `task-${workstreamId}-5`,
      workstreamId,
      title: "Database Schema",
      description: "Design and implement database structure",
      status: "done",
      priority: "high",
      dependencies: [`task-${workstreamId}-2`],
      createdAt: new Date(Date.now() - 432000000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      tags: ["backend"],
    },
    // Level 2 - Implementation branches
    {
      id: `task-${workstreamId}-6`,
      workstreamId,
      title: "Frontend Components",
      description: "Build core UI components",
      status: "in_progress",
      priority: "high",
      dependencies: [`task-${workstreamId}-3`],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      tags: ["frontend", "feature"],
    },
    {
      id: `task-${workstreamId}-7`,
      workstreamId,
      title: "API Implementation",
      description: "Implement REST/GraphQL endpoints",
      status: "in_progress",
      priority: "high",
      dependencies: [`task-${workstreamId}-4`, `task-${workstreamId}-5`],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      tags: ["backend", "feature"],
    },
    {
      id: `task-${workstreamId}-8`,
      workstreamId,
      title: "Authentication Flow",
      description: "Implement user authentication and authorization",
      status: "review",
      priority: "urgent",
      dependencies: [`task-${workstreamId}-4`],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 14400000).toISOString(),
      tags: ["security"],
    },
    // Level 3 - Depends on implementation
    {
      id: `task-${workstreamId}-9`,
      workstreamId,
      title: "Integration Testing",
      description: "End-to-end integration tests",
      status: "todo",
      priority: "medium",
      dependencies: [`task-${workstreamId}-6`, `task-${workstreamId}-7`],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      tags: ["testing"],
    },
    {
      id: `task-${workstreamId}-10`,
      workstreamId,
      title: "Performance Optimization",
      description: "Optimize for speed and efficiency",
      status: "blocked",
      priority: "medium",
      dependencies: [`task-${workstreamId}-7`],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 43200000).toISOString(),
      tags: ["performance"],
    },
    // Level 4 - Final convergence
    {
      id: `task-${workstreamId}-11`,
      workstreamId,
      title: "Documentation",
      description: "Write user and developer documentation",
      status: "todo",
      priority: "low",
      dependencies: [`task-${workstreamId}-8`, `task-${workstreamId}-9`],
      createdAt: new Date(Date.now() - 43200000).toISOString(),
      updatedAt: new Date(Date.now() - 43200000).toISOString(),
      tags: ["docs"],
    },
    {
      id: `task-${workstreamId}-12`,
      workstreamId,
      title: "Release Preparation",
      description: "Prepare release artifacts and deployment",
      status: "todo",
      priority: "high",
      dependencies: [`task-${workstreamId}-9`, `task-${workstreamId}-10`, `task-${workstreamId}-11`],
      createdAt: new Date(Date.now() - 21600000).toISOString(),
      updatedAt: new Date(Date.now() - 21600000).toISOString(),
      tags: ["release"],
    },
  ];

  return tasks;
}

// Mock API functions
async function fetchWorkstreams(): Promise<Workstream[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return [
    {
      id: "ws-1",
      name: "Product Development",
      description: "Core product features and improvements",
      tasks: createMockTasks("ws-1"),
      progress: 65,
      status: "active",
      ownerId: "2",
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 1209600000).toISOString(),
      tags: ["product", "engineering"],
    },
    {
      id: "ws-2",
      name: "Marketing Campaign",
      description: "Q2 marketing initiatives and campaigns",
      tasks: createMockTasks("ws-2"),
      progress: 40,
      status: "active",
      ownerId: "3",
      createdAt: new Date(Date.now() - 1296000000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      dueDate: new Date(Date.now() + 2592000000).toISOString(),
      tags: ["marketing", "growth"],
    },
    {
      id: "ws-3",
      name: "Infrastructure Upgrade",
      description: "Cloud infrastructure modernization",
      tasks: createMockTasks("ws-3"),
      progress: 85,
      status: "active",
      ownerId: "2",
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      tags: ["infrastructure", "devops"],
    },
    {
      id: "ws-4",
      name: "User Research",
      description: "Customer discovery and research initiatives",
      tasks: createMockTasks("ws-4"),
      progress: 100,
      status: "completed",
      ownerId: "1",
      createdAt: new Date(Date.now() - 7776000000).toISOString(),
      updatedAt: new Date(Date.now() - 604800000).toISOString(),
      tags: ["research", "users"],
    },
    {
      id: "ws-5",
      name: "Documentation Overhaul",
      description: "Comprehensive documentation update",
      tasks: createMockTasks("ws-5"),
      progress: 20,
      status: "paused",
      ownerId: "3",
      createdAt: new Date(Date.now() - 1728000000).toISOString(),
      updatedAt: new Date(Date.now() - 432000000).toISOString(),
      tags: ["docs", "content"],
    },
  ];
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
  return useQuery({
    queryKey: workstreamKeys.lists(),
    queryFn: fetchWorkstreams,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

export function useWorkstream(id: string) {
  return useQuery({
    queryKey: workstreamKeys.detail(id),
    queryFn: () => fetchWorkstream(id),
    enabled: !!id,
  });
}

export function useWorkstreamsByStatus(status: WorkstreamStatus) {
  return useQuery({
    queryKey: workstreamKeys.list({ status }),
    queryFn: () => fetchWorkstreamsByStatus(status),
    enabled: !!status,
  });
}

export function useWorkstreamsByOwner(ownerId: string) {
  return useQuery({
    queryKey: workstreamKeys.list({ ownerId }),
    queryFn: () => fetchWorkstreamsByOwner(ownerId),
    enabled: !!ownerId,
  });
}

export function useTasks(workstreamId: string) {
  return useQuery({
    queryKey: workstreamKeys.tasks(workstreamId),
    queryFn: () => fetchTasks(workstreamId),
    enabled: !!workstreamId,
  });
}

export function useTasksByStatus(workstreamId: string, status: TaskStatus) {
  return useQuery({
    queryKey: [...workstreamKeys.tasks(workstreamId), { status }],
    queryFn: () => fetchTasksByStatus(workstreamId, status),
    enabled: !!workstreamId && !!status,
  });
}
