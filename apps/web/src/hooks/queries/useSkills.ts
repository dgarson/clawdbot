/**
 * React Query hooks for skills management.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getSkillsStatus,
  getSkill,
  type Skill,
  type SkillsStatusReport,
} from "@/lib/api/skills";

// Query keys factory
export const skillKeys = {
  all: ["skills"] as const,
  status: () => [...skillKeys.all, "status"] as const,
  details: () => [...skillKeys.all, "detail"] as const,
  detail: (name: string) => [...skillKeys.details(), name] as const,
};

/**
 * Hook to get the status of all skills
 */
export function useSkillsStatus() {
  return useQuery({
    queryKey: skillKeys.status(),
    queryFn: getSkillsStatus,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get a specific skill by name
 */
export function useSkill(name: string) {
  return useQuery({
    queryKey: skillKeys.detail(name),
    queryFn: () => getSkill(name),
    enabled: !!name,
  });
}

/**
 * Hook to get only enabled skills
 */
export function useEnabledSkills() {
  const query = useSkillsStatus();

  const enabledSkills = query.data?.skills.filter((s) => s.enabled) ?? [];

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

  const builtInSkills = query.data?.skills.filter((s) => s.builtIn) ?? [];

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

  const customSkills = query.data?.skills.filter((s) => !s.builtIn) ?? [];

  return {
    ...query,
    data: customSkills,
    count: customSkills.length,
  };
}

// Re-export types
export type { Skill, SkillsStatusReport };
