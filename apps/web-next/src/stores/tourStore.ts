import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TourStep {
  id: string;
  target?: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourState {
  isTourOpen: boolean;
  hasCompletedTour: boolean;
  currentStepIndex: number;
  
  startTour: () => void;
  completeTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  resetTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      isTourOpen: false,
      hasCompletedTour: false,
      currentStepIndex: 0,

      startTour: () => set({ isTourOpen: true, currentStepIndex: 0 }),
      completeTour: () => set({ isTourOpen: false, hasCompletedTour: true }),
      skipTour: () => set({ isTourOpen: false }),
      nextStep: () => set((state) => ({ currentStepIndex: state.currentStepIndex + 1 })),
      prevStep: () => set((state) => ({ currentStepIndex: Math.max(0, state.currentStepIndex - 1) })),
      resetTour: () => set({ hasCompletedTour: false, currentStepIndex: 0, isTourOpen: false }),
    }),
    {
      name: 'openclaw:tour-storage',
    }
  )
);
