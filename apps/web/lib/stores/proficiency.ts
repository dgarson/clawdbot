import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProficiencyLevel = "beginner" | "standard" | "expert";

type ProficiencyState = {
  level: ProficiencyLevel;
  detected: boolean;
  onboardingCompleted: boolean;

  setLevel: (level: ProficiencyLevel) => void;
  completeOnboarding: (level: ProficiencyLevel) => void;
  resetOnboarding: () => void;
};

export const useProficiencyStore = create<ProficiencyState>()(
  persist(
    (set) => ({
      level: "standard",
      detected: false,
      onboardingCompleted: false,

      setLevel: (level) => set({ level }),

      completeOnboarding: (level) =>
        set({ level, detected: true, onboardingCompleted: true }),

      resetOnboarding: () =>
        set({ level: "standard", detected: false, onboardingCompleted: false }),
    }),
    { name: "openclaw-proficiency" }
  )
);

export function useProficiency() {
  const level = useProficiencyStore((s) => s.level);
  const isAtLeast = (minLevel: ProficiencyLevel) => {
    const order: ProficiencyLevel[] = ["beginner", "standard", "expert"];
    return order.indexOf(level) >= order.indexOf(minLevel);
  };
  return { level, isAtLeast };
}
