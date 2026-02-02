import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ToolsetConfig } from "@/components/domain/tools";

/**
 * Toolset store state
 */
export interface ToolsetsState {
  /** User-created toolsets (built-in toolsets are defined separately) */
  toolsets: ToolsetConfig[];
  /** Default toolset ID to use for new agents (null = custom/none) */
  defaultToolsetId: string | null;
}

/**
 * Toolset store actions
 */
export interface ToolsetsActions {
  /** Create a new toolset */
  createToolset: (
    data: Omit<ToolsetConfig, "id" | "createdAt" | "updatedAt">
  ) => ToolsetConfig;
  /** Update an existing toolset */
  updateToolset: (
    id: string,
    data: Partial<Omit<ToolsetConfig, "id" | "createdAt" | "updatedAt">>
  ) => void;
  /** Delete a toolset */
  deleteToolset: (id: string) => void;
  /** Duplicate a toolset */
  duplicateToolset: (id: string) => ToolsetConfig | null;
  /** Get a toolset by ID */
  getToolset: (id: string) => ToolsetConfig | undefined;
  /** Set the default toolset for new agents */
  setDefaultToolsetId: (id: string | null) => void;
  /** Import toolsets (for config import) */
  importToolsets: (toolsets: ToolsetConfig[], merge?: boolean) => void;
  /** Export toolsets (for config export) */
  exportToolsets: () => ToolsetConfig[];
}

export type ToolsetsStore = ToolsetsState & ToolsetsActions;

/**
 * Generate a unique ID for a toolset
 */
function generateToolsetId(): string {
  return `toolset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useToolsetsStore = create<ToolsetsStore>()(
  persist(
    (set, get) => ({
      // State
      toolsets: [],
      defaultToolsetId: null,

      // Actions
      createToolset: (data) => {
        const newToolset: ToolsetConfig = {
          ...data,
          id: generateToolsetId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({
          toolsets: [...state.toolsets, newToolset],
        }));
        return newToolset;
      },

      updateToolset: (id, data) => {
        set((state) => ({
          toolsets: state.toolsets.map((t) =>
            t.id === id
              ? { ...t, ...data, updatedAt: new Date() }
              : t
          ),
        }));
      },

      deleteToolset: (id) => {
        set((state) => ({
          toolsets: state.toolsets.filter((t) => t.id !== id),
          // Clear default if deleted toolset was the default
          defaultToolsetId:
            state.defaultToolsetId === id ? null : state.defaultToolsetId,
        }));
      },

      duplicateToolset: (id) => {
        const { toolsets, createToolset } = get();
        const original = toolsets.find((t) => t.id === id);
        if (!original) {return null;}

        return createToolset({
          name: `${original.name} (Copy)`,
          description: original.description,
          tools: original.tools.map((t) => ({ ...t })),
          isBuiltIn: false,
        });
      },

      getToolset: (id) => {
        return get().toolsets.find((t) => t.id === id);
      },

      setDefaultToolsetId: (id) => {
        set({ defaultToolsetId: id });
      },

      importToolsets: (toolsets, merge = true) => {
        set((state) => {
          if (!merge) {
            // Replace all toolsets
            return { toolsets };
          }

          // Merge: add new toolsets, update existing ones by ID
          const existingIds = new Set(state.toolsets.map((t) => t.id));
          const merged = [...state.toolsets];

          for (const toolset of toolsets) {
            if (existingIds.has(toolset.id)) {
              // Update existing
              const index = merged.findIndex((t) => t.id === toolset.id);
              if (index !== -1) {
                merged[index] = { ...toolset, updatedAt: new Date() };
              }
            } else {
              // Add new
              merged.push(toolset);
            }
          }

          return { toolsets: merged };
        });
      },

      exportToolsets: () => {
        return get().toolsets;
      },
    }),
    {
      name: "toolsets-storage",
      // Custom serialization to handle Date objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) {return null;}
          const data = JSON.parse(str);
          // Rehydrate Date objects
          if (data.state?.toolsets) {
            data.state.toolsets = data.state.toolsets.map(
              (t: ToolsetConfig) => ({
                ...t,
                createdAt: new Date(t.createdAt),
                updatedAt: new Date(t.updatedAt),
              })
            );
          }
          return data;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
