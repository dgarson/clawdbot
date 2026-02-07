/**
 * React Query hooks for skills management.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getSkillsStatus,
  getSkill,
  type SkillStatusEntry,
  type SkillsStatusReport,
} from "@/lib/api/skills";

// Query keys factory
export const skillKeys = {
  all: ["skills"] as const,
  status: (agentId?: string) => [...skillKeys.all, "status", agentId ?? "default"] as const,
  details: () => [...skillKeys.all, "detail"] as const,
  detail: (name: string, agentId?: string) =>
    [...skillKeys.details(), name, agentId ?? "default"] as const,
};

/**
 * Hook to get the status of all skills
 */
export function useSkillsStatus(options?: { agentId?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: skillKeys.status(options?.agentId),
    queryFn: () => getSkillsStatus(options?.agentId ? { agentId: options.agentId } : undefined),
    staleTime: 1000 * 60, // 1 minute
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to get a specific skill by name
 */
export function useSkill(name: string, agentId?: string) {
  return useQuery({
    queryKey: skillKeys.detail(name, agentId),
    queryFn: () => getSkill(name, agentId),
    enabled: !!name,
  });
}

/**
 * Hook to get only enabled skills
 */
export function useEnabledSkills() {
  const query = useSkillsStatus();

  const enabledSkills = query.data?.skills.filter((s) => !s.disabled) ?? [];

  return {
    ...query,
    data: enabledSkills,
    count: enabledSkills.length,
  };
}

/**
 * Hook to get only built-in skills
 */
export function useBuiltInSkills() {
  const query = useSkillsStatus();

  const builtInSkills = query.data?.skills.filter((s) => s.bundled) ?? [];

  return {
    ...query,
    data: builtInSkills,
    count: builtInSkills.length,
  };
}

/**
 * Hook to get custom (non-built-in) skills
 */
export function useCustomSkills() {
  const query = useSkillsStatus();

  const customSkills = query.data?.skills.filter((s) => !s.bundled) ?? [];

  return {
    ...query,
    data: customSkills,
    count: customSkills.length,
  };
}

// Re-export types
export type { SkillStatusEntry, SkillsStatusReport };
