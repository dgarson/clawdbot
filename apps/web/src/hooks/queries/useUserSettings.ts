/**
 * React Query hooks for user settings (profile and preferences).
 *
 * Currently uses localStorage for persistence, structured for future
 * gateway API integration when user settings endpoints are available.
 */

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// Types

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
}

export interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface UserPreferences {
  timezone: string;
  language: string;
  defaultAgentId: string;
  notifications: NotificationPreference[];
}

export interface InteractionStyle {
  tone: "casual" | "balanced" | "professional";
  verbosity: "brief" | "balanced" | "detailed";
  useAnalogies: boolean;
  technicalLevel: number;
  proactive: boolean;
}

export interface Appearance {
  sidebarCollapsedDefault: boolean;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
}

export interface Accessibility {
  reduceMotion: boolean;
  highContrast: boolean;
  fontSize: "default" | "large" | "extra-large";
  showKeyboardHints: boolean;
  screenReaderOptimized: boolean;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  soundEnabled: boolean;
  pauseDuringQuietHours: boolean;
  digestFrequency: "immediately" | "daily" | "weekly";
}

export interface UserSettings {
  profile: UserProfile;
  preferences: UserPreferences;
  interactionStyle: InteractionStyle;
  appearance: Appearance;
  accessibility: Accessibility;
  notificationSettings: NotificationSettings;
}

// Storage keys
const STORAGE_KEY_PROFILE = "clawdbrain:user:profile";
const STORAGE_KEY_PREFERENCES = "clawdbrain:user:preferences";
const STORAGE_KEY_INTERACTION_STYLE = "clawdbrain:user:interaction-style";
const STORAGE_KEY_APPEARANCE = "clawdbrain:user:appearance";
const STORAGE_KEY_ACCESSIBILITY = "clawdbrain:user:accessibility";
const STORAGE_KEY_NOTIFICATION_SETTINGS = "clawdbrain:user:notification-settings";

// Default values
const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  avatar: undefined,
  bio: "",
};

const DEFAULT_NOTIFICATIONS: NotificationPreference[] = [
  {
    id: "agent-updates",
    label: "Agent Updates",
    description: "Get notified when agents complete tasks or need attention",
    enabled: true,
  },
  {
    id: "ritual-reminders",
    label: "Ritual Reminders",
    description: "Receive reminders before scheduled rituals run",
    enabled: true,
  },
  {
    id: "goal-progress",
    label: "Goal Progress",
    description: "Weekly updates on your goal progress",
    enabled: false,
  },
  {
    id: "memory-digests",
    label: "Memory Digests",
    description: "Daily summary of new memories and insights",
    enabled: false,
  },
  {
    id: "system-alerts",
    label: "System Alerts",
    description: "Important system notifications and updates",
    enabled: true,
  },
];

const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
  language: navigator.language?.split("-")[0] || "en",
  defaultAgentId: "",
  notifications: DEFAULT_NOTIFICATIONS,
};

const DEFAULT_INTERACTION_STYLE: InteractionStyle = {
  tone: "balanced",
  verbosity: "balanced",
  useAnalogies: true,
  technicalLevel: 50,
  proactive: true,
};

const DEFAULT_APPEARANCE: Appearance = {
  sidebarCollapsedDefault: false,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

const DEFAULT_ACCESSIBILITY: Accessibility = {
  reduceMotion: false,
  highContrast: false,
  fontSize: "default",
  showKeyboardHints: true,
  screenReaderOptimized: false,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: false,
  soundEnabled: true,
  pauseDuringQuietHours: false,
  digestFrequency: "immediately",
};

// Query keys factory
export const userSettingsKeys = {
  all: ["userSettings"] as const,
  profile: () => [...userSettingsKeys.all, "profile"] as const,
  preferences: () => [...userSettingsKeys.all, "preferences"] as const,
  interactionStyle: () => [...userSettingsKeys.all, "interactionStyle"] as const,
  appearance: () => [...userSettingsKeys.all, "appearance"] as const,
  accessibility: () => [...userSettingsKeys.all, "accessibility"] as const,
  notificationSettings: () => [...userSettingsKeys.all, "notificationSettings"] as const,
};

// Storage helpers

function getStoredProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (stored) {
      return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PROFILE;
}

function getStoredPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFERENCES);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure new notification types are included
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        notifications: DEFAULT_NOTIFICATIONS.map((defaultNotif) => {
          const storedNotif = parsed.notifications?.find(
            (n: NotificationPreference) => n.id === defaultNotif.id
          );
          return storedNotif ? { ...defaultNotif, enabled: storedNotif.enabled } : defaultNotif;
        }),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PREFERENCES;
}

function getStoredInteractionStyle(): InteractionStyle {
  if (typeof window === "undefined") return DEFAULT_INTERACTION_STYLE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_INTERACTION_STYLE);
    if (stored) {
      return { ...DEFAULT_INTERACTION_STYLE, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_INTERACTION_STYLE;
}

function getStoredAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_APPEARANCE);
    if (stored) {
      return { ...DEFAULT_APPEARANCE, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_APPEARANCE;
}

function getStoredAccessibility(): Accessibility {
  if (typeof window === "undefined") return DEFAULT_ACCESSIBILITY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACCESSIBILITY);
    if (stored) {
      return { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_ACCESSIBILITY;
}

function getStoredNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_NOTIFICATION_SETTINGS);
    if (stored) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

// API functions (localStorage-based, ready for gateway migration)

export async function getUserProfile(): Promise<UserProfile> {
  // Simulate network delay for realistic behavior
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getStoredProfile();
}

export async function getUserPreferences(): Promise<UserPreferences> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getStoredPreferences();
}

export async function getInteractionStyle(): Promise<InteractionStyle> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getStoredInteractionStyle();
}

export async function getAppearance(): Promise<Appearance> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getStoredAppearance();
}

export async function getAccessibility(): Promise<Accessibility> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getStoredAccessibility();
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getStoredNotificationSettings();
}

export async function getUserSettings(): Promise<UserSettings> {
  const [profile, preferences, interactionStyle, appearance, accessibility, notificationSettings] = await Promise.all([
    getUserProfile(),
    getUserPreferences(),
    getInteractionStyle(),
    getAppearance(),
    getAccessibility(),
    getNotificationSettings(),
  ]);
  return { profile, preferences, interactionStyle, appearance, accessibility, notificationSettings };
}

// Query hooks

/**
 * Hook to get the user profile
 */
export function useUserProfile() {
  return useQuery({
    queryKey: userSettingsKeys.profile(),
    queryFn: getUserProfile,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to get user preferences
 */
export function useUserPreferences() {
  return useQuery({
    queryKey: userSettingsKeys.preferences(),
    queryFn: getUserPreferences,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to get interaction style preferences
 */
export function useInteractionStyle() {
  return useQuery({
    queryKey: userSettingsKeys.interactionStyle(),
    queryFn: getInteractionStyle,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * Hook to get appearance preferences
 */
export function useAppearance() {
  return useQuery({
    queryKey: userSettingsKeys.appearance(),
    queryFn: getAppearance,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * Hook to get accessibility preferences
 */
export function useAccessibility() {
  return useQuery({
    queryKey: userSettingsKeys.accessibility(),
    queryFn: getAccessibility,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * Hook to get notification settings
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: userSettingsKeys.notificationSettings(),
    queryFn: getNotificationSettings,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * Hook to get all user settings (profile + preferences + all new settings)
 */
export function useUserSettings() {
  return useQuery({
    queryKey: userSettingsKeys.all,
    queryFn: getUserSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to prefetch user settings (useful for preloading)
 */
export function usePrefetchUserSettings() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: userSettingsKeys.profile(),
      queryFn: getUserProfile,
    });
    queryClient.prefetchQuery({
      queryKey: userSettingsKeys.preferences(),
      queryFn: getUserPreferences,
    });
    queryClient.prefetchQuery({
      queryKey: userSettingsKeys.interactionStyle(),
      queryFn: getInteractionStyle,
    });
    queryClient.prefetchQuery({
      queryKey: userSettingsKeys.appearance(),
      queryFn: getAppearance,
    });
    queryClient.prefetchQuery({
      queryKey: userSettingsKeys.accessibility(),
      queryFn: getAccessibility,
    });
  };
}

// Mutation hooks

/**
 * Hook to update interaction style
 */
export function useUpdateInteractionStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<InteractionStyle>) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const current = getStoredInteractionStyle();
      const updated = { ...current, ...params };
      localStorage.setItem(STORAGE_KEY_INTERACTION_STYLE, JSON.stringify(updated));
      return updated;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.interactionStyle() });
      const previous = queryClient.getQueryData<InteractionStyle>(userSettingsKeys.interactionStyle());
      if (previous) {
        queryClient.setQueryData<InteractionStyle>(userSettingsKeys.interactionStyle(), {
          ...previous,
          ...params,
        });
      }
      return { previous };
    },
    onError: (_error, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userSettingsKeys.interactionStyle(), context.previous);
      }
      toast.error("Failed to update interaction style", { id: "interaction-style-error" });
    },
    onSuccess: () => {
      // Use a consistent ID to deduplicate rapid updates
      toast.success("Interaction style updated", { id: "interaction-style-update" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.interactionStyle() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

/**
 * Hook to update appearance
 */
export function useUpdateAppearance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<Appearance>) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const current = getStoredAppearance();
      const updated = { ...current, ...params };
      localStorage.setItem(STORAGE_KEY_APPEARANCE, JSON.stringify(updated));
      return updated;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.appearance() });
      const previous = queryClient.getQueryData<Appearance>(userSettingsKeys.appearance());
      if (previous) {
        queryClient.setQueryData<Appearance>(userSettingsKeys.appearance(), {
          ...previous,
          ...params,
        });
      }
      return { previous };
    },
    onError: (_error, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userSettingsKeys.appearance(), context.previous);
      }
      toast.error("Failed to update appearance", { id: "appearance-error" });
    },
    onSuccess: () => {
      toast.success("Appearance updated", { id: "appearance-update" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.appearance() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

/**
 * Hook to update accessibility
 */
export function useUpdateAccessibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<Accessibility>) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const current = getStoredAccessibility();
      const updated = { ...current, ...params };
      localStorage.setItem(STORAGE_KEY_ACCESSIBILITY, JSON.stringify(updated));
      return updated;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.accessibility() });
      const previous = queryClient.getQueryData<Accessibility>(userSettingsKeys.accessibility());
      if (previous) {
        queryClient.setQueryData<Accessibility>(userSettingsKeys.accessibility(), {
          ...previous,
          ...params,
        });
      }
      return { previous };
    },
    onError: (_error, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userSettingsKeys.accessibility(), context.previous);
      }
      toast.error("Failed to update accessibility settings", { id: "accessibility-error" });
    },
    onSuccess: () => {
      toast.success("Accessibility settings updated", { id: "accessibility-update" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.accessibility() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}

/**
 * Hook to update notification settings
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<NotificationSettings>) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const current = getStoredNotificationSettings();
      const updated = { ...current, ...params };
      localStorage.setItem(STORAGE_KEY_NOTIFICATION_SETTINGS, JSON.stringify(updated));
      return updated;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKeys.notificationSettings() });
      const previous = queryClient.getQueryData<NotificationSettings>(userSettingsKeys.notificationSettings());
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(userSettingsKeys.notificationSettings(), {
          ...previous,
          ...params,
        });
      }
      return { previous };
    },
    onError: (_error, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userSettingsKeys.notificationSettings(), context.previous);
      }
      toast.error("Failed to update notification settings", { id: "notification-settings-error" });
    },
    onSuccess: () => {
      toast.success("Notification settings updated", { id: "notification-settings-update" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.notificationSettings() });
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
    },
  });
}
