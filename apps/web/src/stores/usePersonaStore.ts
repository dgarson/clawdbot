import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PersonaTier = "casual" | "engaged" | "expert";

interface PersonaState {
  tier: PersonaTier;
  setTier: (tier: PersonaTier) => void;
  hasSeenTierPrompt: boolean;
  setHasSeenTierPrompt: (seen: boolean) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      tier: "casual",
      setTier: (tier) => set({ tier }),
      hasSeenTierPrompt: false,
      setHasSeenTierPrompt: (seen) => set({ hasSeenTierPrompt: seen }),
    }),
    { name: "clawdbrain-persona" }
  )
);
