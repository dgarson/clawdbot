/**
 * React Query mutation hooks for user settings changes.
 *
 * Currently uses localStorage for persistence, structured for future
 * gateway API integration when user settings endpoints are available.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  userSettingsKeys,
  type UserProfile,
  type UserPreferences,
  type NotificationPreference,
} from "../queries/useUserSettings";

// Storage keys
const STORAGE_KEY_PROFILE = "clawdbrain:user:profile";
const STORAGE_KEY_PREFERENCES = "clawdbrain:user:preferences";

// Types for mutations

export interface UpdateProfileParams {
  name?: string;
  email?: string;
  avatar?: string;
  bio?: string;
}

export interface UpdatePreferencesParams {
  timezone?: string;
  language?: string;
  defaultAgentId?: string;
  notifications?: NotificationPreference[];
}

export interface UpdateNotificationParams {
  id: string;
  enabled: boolean;
}

// Mutation functions (localStorage-based, ready for gateway migration)

async function updateProfile(params: UpdateProfileParams): Promise<UserProfile> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const current = getStoredProfile();
  const updated: UserProfile = {
    ...current,
    ...params,
  };

  localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
  return updated;
}

async function updatePreferences(params: UpdatePreferencesParams): Promise<UserPreferences> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const current = getStoredPreferences();
  const updated: UserPreferences = {
    ...current,
    ...params,
  };

  localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(updated));
  return updated;
}

async function updateNotification(params: UpdateNotificationParams): Promise<UserPreferences> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const current = getStoredPreferences();
  const updated: UserPreferences = {
    ...current,
    notifications: current.notifications.map((n) =>
      n.id === params.id ? { ...n, enabled: params.enabled } : n
    ),
  };

  localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(updated));
  return updated;
}

async function updateAllNotifications(enabled: boolean): Promise<UserPreferences> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const current = getStoredPreferences();
  const updated: UserPreferences = {
    ...current,
    notifications: current.notifications.map((n) => ({ ...n, enabled })),
  };

  localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(updated));
  return updated;
}

// Storage helpers (duplicated from queries for modularity)

function getStoredProfile(): UserProfile {
  if (typeof window === "undefined") {
    return { name: "", email: "", avatar: undefined, bio: "" };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { name: "", email: "", avatar: undefined, bio: "" };
}

function getStoredPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return {
      timezone: "America/Los_Angeles",
      language: "en",
      defaultAgentId: "",
      notifications: [],
    };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFERENCES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    timezone: "America/Los_Angeles",
    language: "en",
    defaultAgentId: "",
    notifications: [],
  };
}

// Mutation hooks

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onMutate: async (params) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.profile() });

      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<UserProfile>(userSettingsKeys.profile());

      // Optimistically update
      if (previousProfile) {
        queryClient.setQueryData<UserProfile>(userSettingsKeys.profile(), {
          ...previousProfile,
          ...params,
        });
      }

      return { previousProfile };
    },
    onError: (error, _params, context) => {
      // Rollback on error
      if (context?.previousProfile) {
        queryClient.setQueryData(userSettingsKeys.profile(), context.previousProfile);
      }
      toast.error(
        `Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.profile() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

/**
 * Hook to update user preferences (timezone, language, default agent)
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePreferences,
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.preferences() });

      const previousPreferences = queryClient.getQueryData<UserPreferences>(
        userSettingsKeys.preferences()
      );

      if (previousPreferences) {
        queryClient.setQueryData<UserPreferences>(userSettingsKeys.preferences(), {
          ...previousPreferences,
          ...params,
        });
      }

      return { previousPreferences };
    },
    onError: (error, _params, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(userSettingsKeys.preferences(), context.previousPreferences);
      }
      toast.error(
        `Failed to update preferences: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
    onSuccess: (_data, params) => {
      // Show specific message based on what was updated
      if (params.timezone) {
        toast.success("Timezone updated");
      } else if (params.language) {
        toast.success("Language preference updated");
      } else if (params.defaultAgentId !== undefined) {
        toast.success("Default agent updated");
      } else {
        toast.success("Preferences updated");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

/**
 * Hook to toggle a single notification preference
 */
export function useUpdateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNotification,
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.preferences() });

      const previousPreferences = queryClient.getQueryData<UserPreferences>(
        userSettingsKeys.preferences()
      );

      if (previousPreferences) {
        queryClient.setQueryData<UserPreferences>(userSettingsKeys.preferences(), {
          ...previousPreferences,
          notifications: previousPreferences.notifications.map((n) =>
            n.id === params.id ? { ...n, enabled: params.enabled } : n
          ),
        });
      }

      return { previousPreferences };
    },
    onError: (error, _params, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(userSettingsKeys.preferences(), context.previousPreferences);
      }
      toast.error(
        `Failed to update notification: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
    onSuccess: (_data, params) => {
      const prefs = queryClient.getQueryData<UserPreferences>(userSettingsKeys.preferences());
      const notification = prefs?.notifications.find((n) => n.id === params.id);
      if (notification) {
        toast.success(`${notification.label} ${params.enabled ? "enabled" : "disabled"}`);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

/**
 * Hook to enable or disable all notifications at once
 */
export function useUpdateAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAllNotifications,
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.preferences() });

      const previousPreferences = queryClient.getQueryData<UserPreferences>(
        userSettingsKeys.preferences()
      );

      if (previousPreferences) {
        queryClient.setQueryData<UserPreferences>(userSettingsKeys.preferences(), {
          ...previousPreferences,
          notifications: previousPreferences.notifications.map((n) => ({ ...n, enabled })),
        });
      }

      return { previousPreferences };
    },
    onError: (error, _enabled, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(userSettingsKeys.preferences(), context.previousPreferences);
      }
      toast.error(
        `Failed to update notifications: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
    onSuccess: (_data, enabled) => {
      toast.success(enabled ? "All notifications enabled" : "All notifications disabled");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

// Re-export types
export type { UserProfile, UserPreferences, NotificationPreference };
