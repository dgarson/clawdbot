import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type UiState = {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  commandPaletteOpen: boolean;

  setTheme: (theme: ThemeMode) => void;
  setResolvedTheme: (resolved: "light" | "dark") => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      resolvedTheme: "dark",
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      commandPaletteOpen: false,

      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolved) => set({ resolvedTheme: resolved }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: "openclaw-ui",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
