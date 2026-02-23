import { create } from "zustand";

interface InheritanceState {
  /** agentId → fieldName → isCustom (true = overridden, false = using default) */
  agentOverrides: Record<string, Record<string, boolean>>;
  setOverride: (agentId: string, field: string, isCustom: boolean) => void;
  isUsingDefault: (agentId: string, field: string) => boolean;
  clearOverrides: (agentId: string) => void;
}

export const useInheritanceStore = create<InheritanceState>((set, get) => ({
  agentOverrides: {},
  setOverride: (agentId, field, isCustom) =>
    set((state) => ({
      agentOverrides: {
        ...state.agentOverrides,
        [agentId]: {
          ...state.agentOverrides[agentId],
          [field]: isCustom,
        },
      },
    })),
  isUsingDefault: (agentId, field) => {
    const overrides = get().agentOverrides[agentId];
    return !overrides?.[field];
  },
  clearOverrides: (agentId) =>
    set((state) => {
      const next = { ...state.agentOverrides };
      delete next[agentId];
      return { agentOverrides: next };
    }),
}));
