import { useQuery } from "@tanstack/react-query";

// Types
export type RitualStatus = "active" | "paused" | "completed" | "failed";

export type RitualFrequency =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export interface RitualExecution {
  id: string;
  ritualId: string;
  status: "success" | "failed" | "skipped" | "running";
  startedAt: string;
  completedAt?: string;
  result?: string;
  error?: string;
  sessionKey?: string;
  toolCalls?: number;
  tokens?: number;
  costUsd?: number;
  tools?: string[];
}

export interface Ritual {
  id: string;
  name: string;
  description?: string;
  schedule: string; // cron expression or human-readable
  frequency: RitualFrequency;
  nextRun?: string;
  lastRun?: string;
  agentId?: string;
  guidancePackIds?: string[];
  goals?: string[];
  workstreams?: string[];
  directivesMarkdown?: string;
  status: RitualStatus;
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  successRate?: number;
  actions?: string[];
}

// Query keys factory
export const ritualKeys = {
  all: ["rituals"] as const,
  lists: () => [...ritualKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...ritualKeys.lists(), filters] as const,
  details: () => [...ritualKeys.all, "detail"] as const,
  detail: (id: string) => [...ritualKeys.details(), id] as const,
  executions: (ritualId: string) =>
    [...ritualKeys.detail(ritualId), "executions"] as const,
};

// Mock API functions
async function fetchRituals(): Promise<Ritual[]> {
  await new Promise((resolve) => setTimeout(resolve, 350));

  return [
    {
      id: "ritual-1",
      name: "Daily Standup Summary",
      description: "Compile and send daily standup notes to the team",
      schedule: "0 9 * * 1-5",
      frequency: "daily",
      nextRun: getNextWeekday(9).toISOString(),
      lastRun: new Date(Date.now() - 86400000).toISOString(),
      agentId: "4",
      status: "active",
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 22,
      successRate: 95,
      actions: ["collect-updates", "summarize", "send-email"],
    },
    {
      id: "ritual-2",
      name: "Weekly Report Generation",
      description: "Generate comprehensive weekly progress report",
      schedule: "0 17 * * 5",
      frequency: "weekly",
      nextRun: getNextFriday(17).toISOString(),
      lastRun: new Date(Date.now() - 604800000).toISOString(),
      agentId: "1",
      guidancePackIds: ["pack-weekly-clarity"],
      status: "active",
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
      updatedAt: new Date(Date.now() - 604800000).toISOString(),
      executionCount: 8,
      successRate: 100,
      actions: ["gather-metrics", "analyze-progress", "generate-pdf"],
    },
    {
      id: "ritual-3",
      name: "Code Quality Check",
      description: "Run automated code quality analysis",
      schedule: "0 */4 * * *",
      frequency: "hourly",
      nextRun: new Date(Date.now() + 14400000).toISOString(),
      lastRun: new Date(Date.now() - 14400000).toISOString(),
      agentId: "2",
      status: "active",
      createdAt: new Date(Date.now() - 1296000000).toISOString(),
      updatedAt: new Date(Date.now() - 14400000).toISOString(),
      executionCount: 180,
      successRate: 88,
      actions: ["run-linter", "check-types", "analyze-complexity"],
    },
    {
      id: "ritual-4",
      name: "Monthly Newsletter",
      description: "Compile and draft monthly newsletter content",
      schedule: "0 10 1 * *",
      frequency: "monthly",
      nextRun: getFirstOfNextMonth(10).toISOString(),
      lastRun: new Date(Date.now() - 2592000000).toISOString(),
      agentId: "3",
      status: "paused",
      createdAt: new Date(Date.now() - 7776000000).toISOString(),
      updatedAt: new Date(Date.now() - 604800000).toISOString(),
      executionCount: 3,
      successRate: 100,
      actions: ["gather-highlights", "draft-content", "create-draft"],
    },
  ];
}

// Helper functions for mock dates
function getNextWeekday(hour: number): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  if (date <= new Date()) {
    date.setDate(date.getDate() + 1);
  }
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function getNextFriday(hour: number): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  const daysUntilFriday = (5 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return date;
}

function getFirstOfNextMonth(hour: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function fetchRitual(id: string): Promise<Ritual | null> {
  const rituals = await fetchRituals();
  return rituals.find((r) => r.id === id) ?? null;
}

async function fetchRitualsByStatus(status: RitualStatus): Promise<Ritual[]> {
  const rituals = await fetchRituals();
  return rituals.filter((r) => r.status === status);
}

async function fetchRitualsByAgent(agentId: string): Promise<Ritual[]> {
  const rituals = await fetchRituals();
  return rituals.filter((r) => r.agentId === agentId);
}

async function fetchRitualExecutions(
  ritualId: string
): Promise<RitualExecution[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Mock execution history
  const isLive = ritualId === "ritual-1";
  return [
    {
      id: "exec-1",
      ritualId,
      status: isLive ? "running" : "success",
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: isLive ? undefined : new Date(Date.now() - 86300000).toISOString(),
      result: isLive ? "Running now" : "Completed successfully",
      sessionKey: `${ritualId}-session-1`,
      toolCalls: 6,
      tokens: isLive ? 380 : 1420,
      costUsd: isLive ? 0.06 : 0.22,
      tools: ["calendar.read", "docs.search", "email.send"],
    },
    {
      id: "exec-2",
      ritualId,
      status: "success",
      startedAt: new Date(Date.now() - 172800000).toISOString(),
      completedAt: new Date(Date.now() - 172700000).toISOString(),
      result: "Completed successfully",
      sessionKey: `${ritualId}-session-2`,
      toolCalls: 5,
      tokens: 1210,
      costUsd: 0.18,
      tools: ["metrics.fetch", "report.generate"],
    },
    {
      id: "exec-3",
      ritualId,
      status: "failed",
      startedAt: new Date(Date.now() - 259200000).toISOString(),
      completedAt: new Date(Date.now() - 259150000).toISOString(),
      error: "Network timeout during execution",
      sessionKey: `${ritualId}-session-3`,
      toolCalls: 2,
      tokens: 320,
      costUsd: 0.05,
      tools: ["http.request"],
    },
  ];
}

// Query hooks
export function useRituals() {
  return useQuery({
    queryKey: ritualKeys.lists(),
    queryFn: fetchRituals,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useRitual(id: string) {
  return useQuery({
    queryKey: ritualKeys.detail(id),
    queryFn: () => fetchRitual(id),
    enabled: !!id,
  });
}

export function useRitualsByStatus(status: RitualStatus) {
  return useQuery({
    queryKey: ritualKeys.list({ status }),
    queryFn: () => fetchRitualsByStatus(status),
    enabled: !!status,
  });
}

export function useRitualsByAgent(agentId: string) {
  return useQuery({
    queryKey: ritualKeys.list({ agentId }),
    queryFn: () => fetchRitualsByAgent(agentId),
    enabled: !!agentId,
  });
}

export function useRitualExecutions(ritualId: string) {
  return useQuery({
    queryKey: ritualKeys.executions(ritualId),
    queryFn: () => fetchRitualExecutions(ritualId),
    enabled: !!ritualId,
  });
}
