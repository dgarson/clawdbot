/**
 * User Preferences Store
 * Manages user preferences and feature flags
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatBackend = "gateway" | "vercel-ai";
export type SessionRightPanelTab = "activity" | "workspace";

interface PreferencesState {
  // Chat backend selection
  chatBackend: ChatBackend;

  // Session layout
  sessionLeftPanelCollapsed: boolean;
  sessionRightPanelCollapsed: boolean;
  sessionRightPanelTab: SessionRightPanelTab;
  sessionFocusMode: boolean;

  // Actions
  setChatBackend: (backend: ChatBackend) => void;
  setSessionLeftPanelCollapsed: (collapsed: boolean) => void;
  setSessionRightPanelCollapsed: (collapsed: boolean) => void;
  toggleSessionLeftPanel: () => void;
  toggleSessionRightPanel: () => void;
  setSessionRightPanelTab: (tab: SessionRightPanelTab) => void;
  setSessionFocusMode: (enabled: boolean) => void;
  toggleSessionFocusMode: () => void;
  reset: () => void;
}

const initialState = {
  chatBackend: "gateway" as ChatBackend,
  sessionLeftPanelCollapsed: false,
  sessionRightPanelCollapsed: false,
  sessionRightPanelTab: "activity" as SessionRightPanelTab,
  sessionFocusMode: false,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...initialState,

      setChatBackend: (backend) => {
        set({ chatBackend: backend });
      },

      setSessionLeftPanelCollapsed: (collapsed) => {
        set({ sessionLeftPanelCollapsed: collapsed });
      },

      setSessionRightPanelCollapsed: (collapsed) => {
        set({ sessionRightPanelCollapsed: collapsed });
      },

      toggleSessionLeftPanel: () => {
        set((state) => ({ sessionLeftPanelCollapsed: !state.sessionLeftPanelCollapsed }));
      },

      toggleSessionRightPanel: () => {
        set((state) => ({ sessionRightPanelCollapsed: !state.sessionRightPanelCollapsed }));
      },

      setSessionRightPanelTab: (tab) => {
        set({ sessionRightPanelTab: tab });
      },

      setSessionFocusMode: (enabled) => {
        set({
          sessionFocusMode: enabled,
          // Focus mode collapses both panels; exiting restores both
          ...(enabled
            ? { sessionLeftPanelCollapsed: true, sessionRightPanelCollapsed: true }
            : { sessionLeftPanelCollapsed: false, sessionRightPanelCollapsed: false }),
        });
      },

      toggleSessionFocusMode: () => {
        set((state) => {
          const enabled = !state.sessionFocusMode;
          return {
            sessionFocusMode: enabled,
            ...(enabled
              ? { sessionLeftPanelCollapsed: true, sessionRightPanelCollapsed: true }
              : { sessionLeftPanelCollapsed: false, sessionRightPanelCollapsed: false }),
          };
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "clawdbrain-preferences",
    }
  )
);
