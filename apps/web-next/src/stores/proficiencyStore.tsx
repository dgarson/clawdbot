/**
 * ProficiencyStore — Adaptive UX
 *
 * Tracks user proficiency level and persists to localStorage.
 * Drives ComplexityGate to show/hide UI based on experience level.
 *
 * Levels: beginner → intermediate → advanced → expert
 *
 * Auto-progression: tracks interaction count and promotes users
 * who engage enough features. Users can also manually set their level.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProficiencyLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface ProficiencyState {
  level: ProficiencyLevel;
  interactionCount: number;
  viewsVisited: string[];
  manuallySet: boolean;
  promotedAt: Partial<Record<ProficiencyLevel, string>>; // ISO timestamp
}

type ProficiencyAction =
  | { type: "SET_LEVEL"; level: ProficiencyLevel }
  | { type: "RECORD_INTERACTION" }
  | { type: "VISIT_VIEW"; viewId: string }
  | { type: "RESET" };

export interface ProficiencyContextValue {
  state: ProficiencyState;
  level: ProficiencyLevel;
  levelIndex: number; // 0–3
  setLevel: (level: ProficiencyLevel) => void;
  recordInteraction: () => void;
  visitView: (viewId: string) => void;
  reset: () => void;
  isAtLeast: (min: ProficiencyLevel) => boolean;
  meetsLevel: (min: ProficiencyLevel, max?: ProficiencyLevel) => boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

export const PROFICIENCY_META: Record<
  ProficiencyLevel,
  { label: string; emoji: string; description: string; color: string }
> = {
  beginner: {
    label: "Beginner",
    emoji: "🌱",
    description: "Essential features only. Clean and simple.",
    color: "text-emerald-400",
  },
  intermediate: {
    label: "Intermediate",
    emoji: "⚡",
    description: "Common features + power tips revealed.",
    color: "text-blue-400",
  },
  advanced: {
    label: "Advanced",
    emoji: "🔥",
    description: "Full feature set. Pro controls visible.",
    color: "text-orange-400",
  },
  expert: {
    label: "Expert",
    emoji: "🚀",
    description: "Everything. Raw access. No hand-holding.",
    color: "text-purple-400",
  },
};

// Auto-promotion thresholds (interaction count)
export const PROMOTION_THRESHOLDS: Record<ProficiencyLevel, number> = {
  beginner: 0,
  intermediate: 20,
  advanced: 60,
  expert: 150,
};

const STORAGE_KEY = "openclaw:proficiency";

// ─── Initial State ────────────────────────────────────────────────────────────

const DEFAULT_STATE: ProficiencyState = {
  level: "beginner",
  interactionCount: 0,
  viewsVisited: [],
  manuallySet: false,
  promotedAt: {},
};

function loadState(): ProficiencyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function nextAutoLevel(count: number, current: ProficiencyLevel): ProficiencyLevel {
  // Walk levels in reverse to find the highest we qualify for
  for (let i = PROFICIENCY_LEVELS.length - 1; i >= 0; i--) {
    const lvl = PROFICIENCY_LEVELS[i];
    if (count >= PROMOTION_THRESHOLDS[lvl]) {
      return lvl;
    }
  }
  return "beginner";
}

function reducer(state: ProficiencyState, action: ProficiencyAction): ProficiencyState {
  switch (action.type) {
    case "SET_LEVEL":
      return {
        ...state,
        level: action.level,
        manuallySet: true,
        promotedAt: {
          ...state.promotedAt,
          [action.level]: new Date().toISOString(),
        },
      };

    case "RECORD_INTERACTION": {
      const newCount = state.interactionCount + 1;
      const autoLevel = state.manuallySet
        ? state.level
        : nextAutoLevel(newCount, state.level);

      const promoted = autoLevel !== state.level;
      return {
        ...state,
        interactionCount: newCount,
        level: autoLevel,
        promotedAt: promoted
          ? { ...state.promotedAt, [autoLevel]: new Date().toISOString() }
          : state.promotedAt,
      };
    }

    case "VISIT_VIEW": {
      if (state.viewsVisited.includes(action.viewId)) return state;
      const viewsVisited = [...state.viewsVisited, action.viewId];
      // Visiting views counts as interactions
      const newCount = state.interactionCount + 2; // views worth 2 each
      const autoLevel = state.manuallySet
        ? state.level
        : nextAutoLevel(newCount, state.level);
      return {
        ...state,
        viewsVisited,
        interactionCount: newCount,
        level: autoLevel,
      };
    }

    case "RESET":
      return DEFAULT_STATE;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProficiencyContext = createContext<ProficiencyContextValue | null>(null);

export function ProficiencyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota exceeded — ignore
    }
  }, [state]);

  const setLevel = useCallback((level: ProficiencyLevel) => {
    dispatch({ type: "SET_LEVEL", level });
  }, []);

  const recordInteraction = useCallback(() => {
    dispatch({ type: "RECORD_INTERACTION" });
  }, []);

  const visitView = useCallback((viewId: string) => {
    dispatch({ type: "VISIT_VIEW", viewId });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const levelIndex = useMemo(
    () => PROFICIENCY_LEVELS.indexOf(state.level),
    [state.level]
  );

  const isAtLeast = useCallback(
    (min: ProficiencyLevel) => {
      return PROFICIENCY_LEVELS.indexOf(state.level) >= PROFICIENCY_LEVELS.indexOf(min);
    },
    [state.level]
  );

  const meetsLevel = useCallback(
    (min: ProficiencyLevel, max?: ProficiencyLevel) => {
      const idx = PROFICIENCY_LEVELS.indexOf(state.level);
      const minIdx = PROFICIENCY_LEVELS.indexOf(min);
      const maxIdx = max ? PROFICIENCY_LEVELS.indexOf(max) : PROFICIENCY_LEVELS.length - 1;
      return idx >= minIdx && idx <= maxIdx;
    },
    [state.level]
  );

  const value = useMemo<ProficiencyContextValue>(
    () => ({
      state,
      level: state.level,
      levelIndex,
      setLevel,
      recordInteraction,
      visitView,
      reset,
      isAtLeast,
      meetsLevel,
    }),
    [state, levelIndex, setLevel, recordInteraction, visitView, reset, isAtLeast, meetsLevel]
  );

  return (
    <ProficiencyContext.Provider value={value}>
      {children}
    </ProficiencyContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useProficiency(): ProficiencyContextValue {
  const ctx = useContext(ProficiencyContext);
  if (!ctx) {
    throw new Error("useProficiency must be used inside <ProficiencyProvider>");
  }
  return ctx;
}

export function useProficiencyLevel(): ProficiencyLevel {
  return useProficiency().level;
}
