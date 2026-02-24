import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

export interface UIState {
  sidebarCollapsed: boolean;
  theme: Theme;
  powerUserMode: boolean;
  useLiveGateway: boolean;
  /**
   * Snooze window for in-app attention nudges (e.g. tool approvals).
   * Timestamp in ms since epoch; 0 means not snoozed.
   */
  attentionSnoozeUntilMs: number;
}

export interface UIActions {
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  setPowerUserMode: (enabled: boolean) => void;
  setUseLiveGateway: (enabled: boolean) => void;
  setAttentionSnoozeUntilMs: (untilMs: number) => void;
  clearAttentionSnooze: () => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // State
      sidebarCollapsed: false,
      theme: "dark",
      powerUserMode: false,
      useLiveGateway: false,
      attentionSnoozeUntilMs: 0,

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setPowerUserMode: (enabled) => set({ powerUserMode: enabled }),
      setUseLiveGateway: (enabled) => set({ useLiveGateway: enabled }),
      setAttentionSnoozeUntilMs: (untilMs) => set({ attentionSnoozeUntilMs: untilMs }),
      clearAttentionSnooze: () => set({ attentionSnoozeUntilMs: 0 }),
    }),
    { name: "ui-preferences" }
  )
);
