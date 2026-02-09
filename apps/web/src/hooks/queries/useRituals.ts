import { useQuery } from "@tanstack/react-query";
import {
  formatCronSchedule,
  getCronJob,
  getCronRuns,
  listCronJobs,
  type CronJob,
  type CronRunEntry,
  type CronSchedule,
} from "@/lib/api/cron";
import { useGatewayEnabled, useGatewayModeKey } from "../useGatewayEnabled";

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
  detail: (id: string, mode?: "live" | "mock") => [...ritualKeys.details(), id, mode] as const,
  executions: (ritualId: string, mode?: "live" | "mock") =>
    [...ritualKeys.detail(ritualId, mode), "executions"] as const,
};

function inferFrequency(schedule: CronSchedule): RitualFrequency {
  if (schedule.kind === "every") {
    if (schedule.everyMs === 60 * 60 * 1000) {
      return "hourly";
    }
    if (schedule.everyMs === 24 * 60 * 60 * 1000) {
      return "daily";
    }
    if (schedule.everyMs === 7 * 24 * 60 * 60 * 1000) {
      return "weekly";
    }
    if (schedule.everyMs === 30 * 24 * 60 * 60 * 1000) {
      return "monthly";
    }
    return "custom";
  }
  if (schedule.kind !== "cron") {
    return "custom";
  }
  const parts = schedule.expr.trim().split(/\s+/);
  if (parts.length < 5) {
    return "custom";
  }
  const [, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (hour === "*" || hour.includes("/")) {
    return "hourly";
  }
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "daily";
  }
  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    return "weekly";
  }
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    return "monthly";
  }
  return "custom";
}

function mapCronJobToRitual(job: CronJob): Ritual {
  const status: RitualStatus = !job.enabled
    ? "paused"
    : job.state.lastStatus === "error"
      ? "failed"
      : "active";

  return {
    id: job.id,
    name: job.name,
    description: job.description,
    schedule: formatCronSchedule(job.schedule),
    frequency: inferFrequency(job.schedule),
    nextRun: job.state.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : undefined,
    lastRun: job.state.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : undefined,
    agentId: job.agentId ?? undefined,
    status,
    createdAt: new Date(job.createdAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
  };
}

function mapCronRunEntry(entry: CronRunEntry): RitualExecution {
  const statusMap: Record<string, RitualExecution["status"]> = {
    ok: "success",
    error: "failed",
    skipped: "skipped",
  };
  return {
    id: `${entry.jobId}-${entry.ts}`,
    ritualId: entry.jobId,
    status: statusMap[entry.status ?? "ok"] ?? "success",
    startedAt: new Date(entry.runAtMs ?? entry.ts).toISOString(),
    completedAt: entry.durationMs
      ? new Date((entry.runAtMs ?? entry.ts) + entry.durationMs).toISOString()
      : undefined,
    result: entry.summary,
    error: entry.error,
  };
}

async function fetchRituals(liveMode: boolean): Promise<Ritual[]> {
  if (!liveMode) {
    return [];
  }
  const result = await listCronJobs();
  return result.jobs.map(mapCronJobToRitual);
}

async function fetchRitual(id: string, liveMode: boolean): Promise<Ritual | null> {
  if (!liveMode) {
    return null;
  }
  const job = await getCronJob(id);
  return mapCronJobToRitual(job);
}

async function fetchRitualsByStatus(
  status: RitualStatus,
  liveMode: boolean
): Promise<Ritual[]> {
  const rituals = await fetchRituals(liveMode);
  return rituals.filter((r) => r.status === status);
}

async function fetchRitualsByAgent(agentId: string, liveMode: boolean): Promise<Ritual[]> {
  const rituals = await fetchRituals(liveMode);
  return rituals.filter((r) => r.agentId === agentId);
}

async function fetchRitualExecutions(
  ritualId: string,
  liveMode: boolean
): Promise<RitualExecution[]> {
  if (!liveMode) {
    return [];
  }
  const result = await getCronRuns({ id: ritualId, limit: 20 });
  return result.entries.map(mapCronRunEntry);
}

// Query hooks
export function useRituals() {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: ritualKeys.list({ mode: modeKey }),
    queryFn: () => fetchRituals(liveMode),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useRitual(id: string) {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: ritualKeys.detail(id, modeKey),
    queryFn: () => fetchRitual(id, liveMode),
    enabled: !!id,
  });
}

export function useRitualsByStatus(status: RitualStatus) {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: ritualKeys.list({ status, mode: modeKey }),
    queryFn: () => fetchRitualsByStatus(status, liveMode),
    enabled: !!status,
  });
}

export function useRitualsByAgent(agentId: string) {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: ritualKeys.list({ agentId, mode: modeKey }),
    queryFn: () => fetchRitualsByAgent(agentId, liveMode),
    enabled: !!agentId,
  });
}

export function useRitualExecutions(ritualId: string) {
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: ritualKeys.executions(ritualId, modeKey),
    queryFn: () => fetchRitualExecutions(ritualId, liveMode),
    enabled: !!ritualId,
  });
}
