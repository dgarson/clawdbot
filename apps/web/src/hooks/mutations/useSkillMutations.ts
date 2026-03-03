/**
 * React Query mutation hooks for skills operations.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateSkill,
  enableSkill,
  disableSkill,
  installSkill,
  uninstallSkill,
  reloadSkills,
  type SkillUpdateParams,
  type SkillInstallParams,
} from "@/lib/api/skills";
import { skillKeys } from "@/hooks/queries/useSkills";

/**
 * Hook to update a skill's configuration
 */
export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SkillUpdateParams) => updateSkill(params),
    onSuccess: (_, params) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.detail(params.name) });
      void queryClient.invalidateQueries({ queryKey: skillKeys.status() });
      toast.success(`Skill "${params.name}" updated`);
    },
    onError: (error) => {
      console.error("[useUpdateSkill] Failed:", error);
      toast.error("Failed to update skill");
    },
  });
}

/**
 * Hook to enable a skill
 */
export function useEnableSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => enableSkill(name),
    onSuccess: (_, name) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.detail(name) });
      void queryClient.invalidateQueries({ queryKey: skillKeys.status() });
      toast.success(`Skill "${name}" enabled`);
    },
    onError: (error) => {
      console.error("[useEnableSkill] Failed:", error);
      toast.error("Failed to enable skill");
    },
  });
}

/**
 * Hook to disable a skill
 */
export function useDisableSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => disableSkill(name),
    onSuccess: (_, name) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.detail(name) });
      void queryClient.invalidateQueries({ queryKey: skillKeys.status() });
      toast.success(`Skill "${name}" disabled`);
    },
    onError: (error) => {
      console.error("[useDisableSkill] Failed:", error);
      toast.error("Failed to disable skill");
    },
  });
}

/**
 * Hook to install a new skill
 * Note: This operation can take up to 120 seconds
 */
export function useInstallSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SkillInstallParams) => installSkill(params),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.status() });
      if (result.installed) {
        toast.success(`Skill "${result.skill.name}" installed`);
      } else {
        toast.info(result.message ?? "Skill installation completed");
      }
    },
    onError: (error) => {
      console.error("[useInstallSkill] Failed:", error);
      toast.error("Failed to install skill");
    },
  });
}

/**
 * Hook to uninstall a skill
 */
export function useUninstallSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => uninstallSkill(name),
    onSuccess: (_, name) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.status() });
      toast.success(`Skill "${name}" uninstalled`);
    },
    onError: (error) => {
      console.error("[useUninstallSkill] Failed:", error);
      toast.error("Failed to uninstall skill");
    },
  });
}

/**
 * Hook to reload all skills
 */
export function useReloadSkills() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => reloadSkills(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: skillKeys.all });
      toast.success(`Reloaded ${result.count} skills`);
    },
    onError: (error) => {
      console.error("[useReloadSkills] Failed:", error);
      toast.error("Failed to reload skills");
    },
  });
}

// Re-export types
export type { SkillUpdateParams, SkillInstallParams };
