# Inheritance Clarity with Badges

> Visual system for communicating configuration inheritance, defaults, and customizations

---

## Executive Summary

This specification defines a comprehensive visual language for showing users which settings are inherited from system defaults versus explicitly customized per-agent. The goal is to reduce cognitive load by making the inheritance hierarchy immediately visible, while providing clear paths to customize or reset any setting.

### Problem Statement

Users currently cannot tell at a glance:
- Which agent settings use system defaults
- Which settings have been explicitly customized
- What the system default value actually is
- How to reset a customized setting back to default

This creates confusion, especially when:
- Debugging unexpected agent behavior
- Understanding why agents behave differently
- Onboarding new team members
- Maintaining consistency across agents

### Design Goals

1. **Instant Recognition** — Users know inheritance state within 0.5 seconds of viewing any setting
2. **Non-Intrusive** — Badges enhance rather than clutter the interface
3. **Actionable** — Every badge provides a clear next action
4. **Consistent** — Same visual language across all configuration surfaces
5. **Accessible** — Works for colorblind users and screen readers

---

## Inheritance Model

### Configuration Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONFIGURATION INHERITANCE TREE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level 0: Platform Defaults (immutable)                                      │
│  └── Hardcoded sensible defaults in code                                     │
│      └── temperature: 0.7, maxTokens: 4096, sandbox: true, etc.             │
│                                                                              │
│  Level 1: System Defaults (admin-configurable)                               │
│  └── Settings → Model & Provider → Global Behavior                           │
│      └── These become the "system default" for all agents                   │
│                                                                              │
│  Level 2: Agent Defaults (per-agent)                                         │
│  └── Agent → Configure → [any setting]                                       │
│      └── Can inherit from Level 1 OR override with custom value             │
│                                                                              │
│  Level 3: Session/Context Overrides (transient)                              │
│  └── Per-conversation or per-task temporary overrides                        │
│      └── Not persisted, resets after session                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Inheritance States

| State | Description | Visual Treatment |
|-------|-------------|------------------|
| **Inherited** | Using value from parent level | Subtle badge, muted control |
| **Customized** | Explicitly set at this level | Highlighted badge, full control |
| **Mixed** | Some child items inherited, some custom | Summary badge with breakdown |
| **Locked** | Cannot be changed at this level | Disabled with lock icon |
| **Experimental** | Feature flagged, may change | Warning badge |

---

## Badge Design System

### Badge Anatomy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BADGE ANATOMY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Standard Inherited Badge:                                                   │
│  ┌────────────────────────────────┐                                         │
│  │ ↑ System default              │                                         │
│  └────────────────────────────────┘                                         │
│    ↑         ↑                                                               │
│  icon    label text                                                          │
│                                                                              │
│  Customized Badge with Reset:                                                │
│  ┌────────────────────────────────────────┐                                 │
│  │ ✎ Custom  ·  Reset to default         │                                 │
│  └────────────────────────────────────────────┘                             │
│    ↑     ↑            ↑                                                      │
│  icon  label     action link                                                 │
│                                                                              │
│  Mixed State Badge:                                                          │
│  ┌────────────────────────────────────────┐                                 │
│  │ ◐ 3 of 7 customized                   │                                 │
│  └────────────────────────────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Badge Variants

#### 1. Inherited Badge (Default State)

```tsx
// Visual: Subtle, non-prominent
<Badge variant="ghost" className="text-muted-foreground">
  <ArrowUp className="h-3 w-3 mr-1" />
  System default
</Badge>
```

**Appearance:**
- Background: transparent or very subtle `bg-muted/30`
- Text: `text-muted-foreground`
- Border: `border-transparent` or `border-muted/50`
- Icon: `↑` (ArrowUp) or `○` (empty circle)

**Behavior:**
- Hover: Shows tooltip with actual inherited value
- Click: Opens popover with "Customize" option

#### 2. Customized Badge (Override State)

```tsx
// Visual: Prominent, indicates active override
<Badge variant="secondary" className="text-foreground">
  <Pencil className="h-3 w-3 mr-1" />
  Custom
  <Separator orientation="vertical" className="mx-2 h-3" />
  <button className="text-muted-foreground hover:text-foreground text-xs">
    Reset
  </button>
</Badge>
```

**Appearance:**
- Background: `bg-secondary` (light) or `bg-accent` (emphasis)
- Text: `text-secondary-foreground`
- Border: `border-border`
- Icon: `✎` (Pencil) or `●` (filled circle)

**Behavior:**
- Hover: Shows "Reset to default" action
- Click on "Reset": Confirms and removes override
- Click elsewhere: Expands to edit

#### 3. Mixed Badge (Partial Override)

```tsx
// Visual: Indicates partial customization within a group
<Badge variant="outline" className="text-foreground">
  <CircleHalf className="h-3 w-3 mr-1" />
  3 of 7 customized
</Badge>
```

**Appearance:**
- Background: `bg-transparent`
- Text: `text-foreground`
- Border: `border-border`
- Icon: `◐` (half-filled circle)

**Behavior:**
- Hover: Shows list of which items are customized
- Click: Expands section to show all items

#### 4. Locked Badge (Cannot Override)

```tsx
// Visual: Clearly disabled
<Badge variant="outline" className="text-muted-foreground opacity-60">
  <Lock className="h-3 w-3 mr-1" />
  Locked by admin
</Badge>
```

**Appearance:**
- Background: `bg-muted/20`
- Text: `text-muted-foreground`
- Border: `border-muted`
- Icon: `🔒` (Lock)
- Opacity: 60%

**Behavior:**
- Hover: Shows who locked it and why
- Click: No action (or shows "Contact admin" info)

---

## Component Specifications

### InheritanceBadge Component

```tsx
// src/components/ui/inheritance-badge.tsx

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowUp, Pencil, RotateCcw, Lock, AlertCircle } from "lucide-react";

export type InheritanceState =
  | "inherited"
  | "customized"
  | "mixed"
  | "locked"
  | "experimental";

export interface InheritanceBadgeProps {
  /** Current inheritance state */
  state: InheritanceState;

  /** The inherited/default value (for display in tooltips) */
  inheritedValue?: string | number | boolean;

  /** For mixed state: how many items are customized */
  customizedCount?: number;

  /** For mixed state: total number of items */
  totalCount?: number;

  /** Label to show (overrides default labels) */
  label?: string;

  /** Called when user clicks "Reset to default" */
  onReset?: () => void;

  /** Called when user clicks "Customize" */
  onCustomize?: () => void;

  /** Whether the badge is interactive */
  interactive?: boolean;

  /** Size variant */
  size?: "sm" | "default";

  /** Additional class names */
  className?: string;
}

const stateConfig: Record<InheritanceState, {
  icon: React.ComponentType<{ className?: string }>;
  defaultLabel: string;
  variant: "ghost" | "secondary" | "outline" | "destructive";
}> = {
  inherited: {
    icon: ArrowUp,
    defaultLabel: "System default",
    variant: "ghost",
  },
  customized: {
    icon: Pencil,
    defaultLabel: "Custom",
    variant: "secondary",
  },
  mixed: {
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 2 A6 6 0 0 1 8 14" fill="currentColor"/>
      </svg>
    ),
    defaultLabel: "Partially customized",
    variant: "outline",
  },
  locked: {
    icon: Lock,
    defaultLabel: "Locked",
    variant: "outline",
  },
  experimental: {
    icon: AlertCircle,
    defaultLabel: "Experimental",
    variant: "outline",
  },
};

export function InheritanceBadge({
  state,
  inheritedValue,
  customizedCount,
  totalCount,
  label,
  onReset,
  onCustomize,
  interactive = true,
  size = "default",
  className,
}: InheritanceBadgeProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  // Compute display label
  const displayLabel = React.useMemo(() => {
    if (label) return label;
    if (state === "mixed" && customizedCount !== undefined && totalCount !== undefined) {
      return `${customizedCount} of ${totalCount} customized`;
    }
    return config.defaultLabel;
  }, [label, state, customizedCount, totalCount, config.defaultLabel]);

  // Format inherited value for display
  const formattedInheritedValue = React.useMemo(() => {
    if (inheritedValue === undefined) return null;
    if (typeof inheritedValue === "boolean") return inheritedValue ? "Enabled" : "Disabled";
    if (typeof inheritedValue === "number") return inheritedValue.toLocaleString();
    return String(inheritedValue);
  }, [inheritedValue]);

  const badgeContent = (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1 font-normal",
        size === "sm" && "text-xs px-1.5 py-0",
        state === "inherited" && "text-muted-foreground",
        state === "locked" && "opacity-60",
        interactive && "cursor-pointer",
        className
      )}
    >
      <Icon className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />
      {displayLabel}
      {state === "customized" && onReset && interactive && (
        <>
          <span className="mx-1 text-muted-foreground">·</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        </>
      )}
    </Badge>
  );

  // Non-interactive: just show the badge
  if (!interactive) {
    return badgeContent;
  }

  // Inherited state: show tooltip with value and customize option
  if (state === "inherited") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="inline-flex">
            {badgeContent}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Using system default</p>
              {formattedInheritedValue && (
                <p className="text-sm text-muted-foreground mt-1">
                  Current value: <span className="font-mono">{formattedInheritedValue}</span>
                </p>
              )}
            </div>
            {onCustomize && (
              <Button size="sm" variant="outline" onClick={onCustomize} className="w-full">
                <Pencil className="h-3 w-3 mr-2" />
                Customize for this agent
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Customized state: show tooltip with inherited value
  if (state === "customized" && formattedInheritedValue) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            {badgeContent}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>System default: <span className="font-mono">{formattedInheritedValue}</span></p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Locked state: show tooltip with reason
  if (state === "locked") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            {badgeContent}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>This setting is controlled by system policy</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badgeContent;
}
```

### InheritableField Component

A wrapper that adds inheritance badges to any form field:

```tsx
// src/components/ui/inheritable-field.tsx

import * as React from "react";
import { Label } from "@/components/ui/label";
import { InheritanceBadge, InheritanceState } from "./inheritance-badge";
import { cn } from "@/lib/utils";

export interface InheritableFieldProps {
  /** Field label */
  label: string;

  /** Helper text shown below label */
  helperText?: string;

  /** Technical term (shown in tooltip for power users) */
  technicalName?: string;

  /** Whether using inherited value */
  isInherited: boolean;

  /** The system default value */
  systemDefault: unknown;

  /** The current value (if customized) */
  currentValue?: unknown;

  /** Called when user wants to customize */
  onCustomize: () => void;

  /** Called when user wants to reset to default */
  onReset: () => void;

  /** Whether the field is locked */
  isLocked?: boolean;

  /** The form control */
  children: React.ReactNode;

  /** Additional class names for the wrapper */
  className?: string;
}

export function InheritableField({
  label,
  helperText,
  technicalName,
  isInherited,
  systemDefault,
  currentValue,
  onCustomize,
  onReset,
  isLocked = false,
  children,
  className,
}: InheritableFieldProps) {
  const state: InheritanceState = isLocked
    ? "locked"
    : isInherited
      ? "inherited"
      : "customized";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">
            {label}
          </Label>
          {technicalName && (
            <span className="text-xs text-muted-foreground font-mono">
              ({technicalName})
            </span>
          )}
        </div>
        <InheritanceBadge
          state={state}
          inheritedValue={formatValue(systemDefault)}
          onCustomize={isInherited ? onCustomize : undefined}
          onReset={!isInherited ? onReset : undefined}
          size="sm"
        />
      </div>

      {helperText && (
        <p className="text-xs text-muted-foreground">
          {helperText}
        </p>
      )}

      <div className={cn(
        isInherited && "opacity-60 pointer-events-none",
        isLocked && "opacity-40"
      )}>
        {children}
      </div>

      {isInherited && (
        <p className="text-xs text-muted-foreground italic">
          Using system default: {formatValue(systemDefault)}
        </p>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "Not set";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
```

---

## Visual Patterns

### Pattern 1: Inline Badge (Single Field)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INLINE BADGE PATTERN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Inherited State:                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Creativity                              [↑ System default]            │ │
│  │  Lower is more precise. Higher is more creative.                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  ────────────●──────────  0.7                                   │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │  Using system default: 0.7                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Customized State:                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Creativity                              [✎ Custom · Reset]           │ │
│  │  Lower is more precise. Higher is more creative.                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  ●───────────────────────  0.3                                  │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 2: Section Summary Badge

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SECTION SUMMARY BADGE PATTERN                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  All Inherited:                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  ▸ Behavior                                    [↑ Using defaults]     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Partially Customized:                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  ▾ Behavior                                    [◐ 2 of 4 customized]  │ │
│  │    ├── Creativity .................... 0.3    [✎ Custom]             │ │
│  │    ├── Response length ............... Long   [✎ Custom]             │ │
│  │    ├── Streaming .................... On      [↑ Default]            │ │
│  │    └── Speed vs Depth ............... Fast    [↑ Default]            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  All Customized:                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  ▸ Behavior                                    [✎ All customized]     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 3: Overview Summary Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OVERVIEW SUMMARY CARD PATTERN                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agent Overview Tab - Configuration Summary:                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Configuration                                                         │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │ Behavior     │  │ Tools        │  │ Memory       │                 │ │
│  │  │ ↑ Defaults   │  │ ✎ Custom     │  │ ↑ Defaults   │                 │ │
│  │  │              │  │ Research     │  │              │                 │ │
│  │  │ [Configure]  │  │ [Edit]       │  │ [Configure]  │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐                                   │ │
│  │  │ Availability │  │ Advanced     │                                   │ │
│  │  │ ◐ 1 custom   │  │ ↑ Defaults   │                                   │ │
│  │  │ Quiet hours  │  │              │                                   │ │
│  │  │ [Edit]       │  │ [Configure]  │                                   │ │
│  │  └──────────────┘  └──────────────┘                                   │ │
│  │                                                                        │ │
│  │  [Reset all to system defaults]                                        │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 4: Diff View (Before Reset)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RESET CONFIRMATION DIALOG                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Reset to system defaults?                                    [X]     │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │                                                                        │ │
│  │  The following customizations will be removed:                         │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Setting              Current          → System Default          │ │ │
│  │  │  ─────────────────────────────────────────────────────────────── │ │ │
│  │  │  Creativity           0.3              → 0.7                     │ │ │
│  │  │  Response length      Short            → Medium                  │ │ │
│  │  │  Toolset              Research Mode    → (no toolset)            │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  This action cannot be undone.                                         │ │
│  │                                                                        │ │
│  │                              [Cancel]  [Reset to defaults]            │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management

### Inheritance Store

```tsx
// src/stores/useInheritanceStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AgentOverride {
  agentId: string;
  field: string;
  value: unknown;
  timestamp: number;
}

interface InheritanceState {
  /** Map of agentId -> field -> override value */
  overrides: Record<string, Record<string, unknown>>;

  /** Set an override for a specific agent field */
  setOverride: (agentId: string, field: string, value: unknown) => void;

  /** Remove an override (revert to system default) */
  removeOverride: (agentId: string, field: string) => void;

  /** Remove all overrides for an agent */
  resetAgent: (agentId: string) => void;

  /** Check if a field has an override */
  hasOverride: (agentId: string, field: string) => boolean;

  /** Get the override value or undefined */
  getOverride: (agentId: string, field: string) => unknown | undefined;

  /** Get count of overrides for an agent */
  getOverrideCount: (agentId: string) => number;
}

export const useInheritanceStore = create<InheritanceState>()(
  persist(
    (set, get) => ({
      overrides: {},

      setOverride: (agentId, field, value) => {
        set((state) => ({
          overrides: {
            ...state.overrides,
            [agentId]: {
              ...state.overrides[agentId],
              [field]: value,
            },
          },
        }));
      },

      removeOverride: (agentId, field) => {
        set((state) => {
          const agentOverrides = { ...state.overrides[agentId] };
          delete agentOverrides[field];
          return {
            overrides: {
              ...state.overrides,
              [agentId]: agentOverrides,
            },
          };
        });
      },

      resetAgent: (agentId) => {
        set((state) => {
          const { [agentId]: _, ...rest } = state.overrides;
          return { overrides: rest };
        });
      },

      hasOverride: (agentId, field) => {
        const state = get();
        return state.overrides[agentId]?.[field] !== undefined;
      },

      getOverride: (agentId, field) => {
        const state = get();
        return state.overrides[agentId]?.[field];
      },

      getOverrideCount: (agentId) => {
        const state = get();
        return Object.keys(state.overrides[agentId] || {}).length;
      },
    }),
    {
      name: "clawdbrain-inheritance",
    }
  )
);
```

### Hook: useInheritedValue

```tsx
// src/hooks/useInheritedValue.ts

import { useCallback, useMemo } from "react";
import { useInheritanceStore } from "@/stores/useInheritanceStore";
import { useSystemDefaults } from "@/hooks/queries/useConfig";

export interface UseInheritedValueOptions<T> {
  agentId: string;
  field: string;
  transform?: (value: unknown) => T;
}

export interface UseInheritedValueResult<T> {
  /** The effective value (override or default) */
  value: T;

  /** The system default value */
  systemDefault: T;

  /** Whether using inherited value */
  isInherited: boolean;

  /** Set a custom override */
  setCustomValue: (value: T) => void;

  /** Reset to system default */
  resetToDefault: () => void;
}

export function useInheritedValue<T>({
  agentId,
  field,
  transform = (v) => v as T,
}: UseInheritedValueOptions<T>): UseInheritedValueResult<T> {
  const { data: systemConfig } = useSystemDefaults();
  const {
    hasOverride,
    getOverride,
    setOverride,
    removeOverride
  } = useInheritanceStore();

  const systemDefault = useMemo(() => {
    const rawDefault = getNestedValue(systemConfig, field);
    return transform(rawDefault);
  }, [systemConfig, field, transform]);

  const isInherited = !hasOverride(agentId, field);

  const value = useMemo(() => {
    if (isInherited) return systemDefault;
    return transform(getOverride(agentId, field));
  }, [isInherited, systemDefault, agentId, field, transform, getOverride]);

  const setCustomValue = useCallback((newValue: T) => {
    setOverride(agentId, field, newValue);
  }, [agentId, field, setOverride]);

  const resetToDefault = useCallback(() => {
    removeOverride(agentId, field);
  }, [agentId, field, removeOverride]);

  return {
    value,
    systemDefault,
    isInherited,
    setCustomValue,
    resetToDefault,
  };
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
```

---

## Color System

### Light Mode

| State | Background | Text | Border | Icon |
|-------|------------|------|--------|------|
| Inherited | `transparent` | `hsl(var(--muted-foreground))` | `transparent` | `↑` muted |
| Customized | `hsl(var(--secondary))` | `hsl(var(--secondary-foreground))` | `hsl(var(--border))` | `✎` foreground |
| Mixed | `transparent` | `hsl(var(--foreground))` | `hsl(var(--border))` | `◐` foreground |
| Locked | `hsl(var(--muted) / 0.2)` | `hsl(var(--muted-foreground))` | `hsl(var(--muted))` | `🔒` muted |

### Dark Mode

Same semantic tokens, automatically adjusted by CSS variables.

### Colorblind Considerations

- Never rely solely on color to indicate state
- Icon shape differs for each state (↑ vs ✎ vs ◐ vs 🔒)
- Text labels always present
- Consider using patterns/textures for critical states

---

## Accessibility

### ARIA Labels

```tsx
<Badge
  role="status"
  aria-label={`${label}: ${isInherited ? 'using system default' : 'customized'}`}
>
  ...
</Badge>
```

### Keyboard Navigation

- Badges are focusable when interactive
- Enter/Space opens popover/triggers action
- Escape closes any open popovers
- Tab order follows visual order

### Screen Reader Announcements

```tsx
// When state changes
<div aria-live="polite" className="sr-only">
  {stateChanged && `Creativity setting ${isInherited ? 'reset to system default' : 'customized'}`}
</div>
```

---

## Implementation Phases

### Phase 1: Core Components (Week 1)

1. Create `InheritanceBadge` component
2. Create `InheritableField` wrapper
3. Create `useInheritanceStore` Zustand store
4. Create `useInheritedValue` hook
5. Add unit tests for all components

### Phase 2: Integration - Behavior Panel (Week 2)

1. Integrate into `AgentBehaviorPanel.tsx`
2. Wire up Creativity slider
3. Wire up Response length slider
4. Wire up Streaming toggle
5. Add section summary badge

### Phase 3: Integration - All Panels (Week 3)

1. Integrate into `AgentToolsTab.tsx`
2. Integrate into `AgentMemoryPanel.tsx`
3. Integrate into `AgentAvailabilityPanel.tsx`
4. Integrate into `AgentAdvancedPanel.tsx`

### Phase 4: Overview Summary (Week 4)

1. Create Configuration Summary card
2. Add to `AgentOverviewTab.tsx`
3. Implement "Reset all" functionality
4. Add diff view confirmation dialog

### Phase 5: Polish (Week 5)

1. Animations and transitions
2. Responsive design adjustments
3. Accessibility audit and fixes
4. Performance optimization (memoization)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recognition Time | < 0.5s | User testing: time to identify inheritance state |
| Reset Success Rate | > 95% | Analytics: successful reset actions vs errors |
| Support Tickets | -50% | Tickets mentioning "default" or "inherited" |
| User Comprehension | > 90% | Survey: "I understand which settings are customized" |

---

## Open Questions

1. **Bulk operations:** Should users be able to select multiple settings and reset/customize together?
2. **Import/Export:** When exporting agent config, should we include only overrides or full config?
3. **Audit log:** Should we track who changed overrides and when?
4. **Notifications:** Should admins be notified when users override system defaults?

---

## Related Documents

- `02-TERMINOLOGY-MAPPING.md` — Friendly labels for technical terms
- `03-DESIGN-PRINCIPLES.md` — Progressive disclosure principles
- `07-SYSTEM-SETTINGS-DESIGN.md` — System defaults configuration
- `08-AGENT-CONFIGURATION-DESIGN.md` — Agent-level configuration
- `21-PERSONA-PROGRESSION-SYSTEM.md` — Tier system that controls which badges are visible
- `22-HIGH-IMPACT-UX-PATTERNS.md` — Integration with other high-impact patterns
