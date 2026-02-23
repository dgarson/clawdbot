# High-Impact UX Patterns

> Deep dive into the patterns that most differentiate our UX and reduce complexity without sacrificing capability

---

## Executive Summary

This document expands on five high-impact UX patterns identified across our design system. Each pattern was selected because it simultaneously:

1. **Differentiates** our product from competitors (ChatGPT, Claude.ai, Poe, etc.)
2. **Reduces cognitive load** without removing features
3. **Maintains full configurability** for power users
4. **Scales** to future feature additions

These patterns are force multipliers — implementing them well has outsized impact on user satisfaction and retention.

---

## Pattern 1: The "Use Default" Toggle System

### Why This Matters

**Competitor Analysis:**

| Product | Approach | Problem |
|---------|----------|---------|
| ChatGPT | Global settings only | Can't customize per-conversation |
| Claude.ai | Project-level only | No inheritance visualization |
| Poe | Bot-level settings | No "reset to default" |
| Character.AI | Fixed presets | No customization at all |
| **Clawdbrain** | **Inherited + Override + Visual** | **Best of all worlds** |

**The Differentiator:** We're the only product that makes inheritance *visible* and *actionable* at every level.

### Deep Specification

#### The Three-State Model

Every configurable setting exists in one of three states:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE THREE-STATE TOGGLE MODEL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STATE 1: INHERITED (Default)                                                │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  [✓] Use system default                                                │ │
│  │                                                                        │ │
│  │  Creativity                                            System: 0.7     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │ │
│  │  │  ─────────────────────●─────────────────────                    │  │ │
│  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                         (slider disabled, shows inherited value)       │ │
│  │                                                                        │ │
│  │  Helper: Using system default. Uncheck to customize for this agent.   │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Visual cues:                                                                │
│  • Checkbox checked (✓)                                                      │
│  • Slider has muted/ghost appearance                                         │
│  • Value shows "System: X" label                                             │
│  • Cannot interact with slider                                               │
│  • Tooltip: "Click checkbox to customize"                                    │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  STATE 2: CUSTOMIZING (Transition)                                           │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  [ ] Use system default                                                │ │
│  │                                                                        │ │
│  │  Creativity                                                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                                                                 │  │ │
│  │  │  ─────────────────────●─────────────────────  0.7               │  │ │
│  │  │                       ▲                                         │  │ │
│  │  │                 (pulsing indicator)                             │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  Helper: Drag to customize. Current system default is 0.7             │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  💡 Tip: Your custom value will override the system default     │  │ │
│  │  │     for this agent only.                                        │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Visual cues:                                                                │
│  • Checkbox unchecked                                                        │
│  • Slider now interactive with pulse animation                               │
│  • Value shows actual number (no "System:" prefix)                           │
│  • Contextual tip appears                                                    │
│  • Reference line shows system default position                              │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  STATE 3: CUSTOMIZED (Override Active)                                       │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  [ ] Use system default                              [Reset to 0.7]   │ │
│  │                                                                        │ │
│  │  Creativity                                                    0.3     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │           ┆                                                     │  │ │
│  │  │  ────●────┆─────────────────────────────────                    │  │ │
│  │  │           ┆ (ghost marker at system default)                    │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  ✎ Custom value: 0.3                                            │  │ │
│  │  │  System default: 0.7 (−0.4 difference)                          │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Visual cues:                                                                │
│  • Checkbox unchecked                                                        │
│  • "Reset to X" button appears                                               │
│  • Slider shows custom value                                                 │
│  • Ghost marker shows where system default is                                │
│  • Info box shows difference from default                                    │
│  • Slight highlight/border indicates override active                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Component Implementation

```tsx
// src/components/ui/defaultable-field.tsx

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RotateCcw, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface DefaultableFieldProps<T> {
  /** Field label */
  label: string;

  /** Helper text */
  helperText?: string;

  /** Technical term for tooltip */
  technicalTerm?: string;

  /** The system default value */
  systemDefault: T;

  /** Current value (equals systemDefault when inherited) */
  value: T;

  /** Whether currently using system default */
  useDefault: boolean;

  /** Called when useDefault changes */
  onUseDefaultChange: (useDefault: boolean) => void;

  /** Called when value changes (only when not using default) */
  onValueChange: (value: T) => void;

  /** Render function for the control */
  children: (props: {
    value: T;
    onChange: (value: T) => void;
    disabled: boolean;
    systemDefault: T;
  }) => React.ReactNode;
}

export function DefaultableField<T>({
  label,
  helperText,
  technicalTerm,
  systemDefault,
  value,
  useDefault,
  onUseDefaultChange,
  onValueChange,
  children,
}: DefaultableFieldProps<T>) {
  const isCustomized = !useDefault && value !== systemDefault;

  const handleUseDefaultChange = (checked: boolean) => {
    onUseDefaultChange(checked);
    if (checked) {
      // Reset to system default when re-enabling
      onValueChange(systemDefault);
    }
  };

  const handleReset = () => {
    onValueChange(systemDefault);
    onUseDefaultChange(true);
  };

  return (
    <div className={cn(
      "space-y-3 p-4 rounded-lg border transition-colors",
      isCustomized ? "border-primary/30 bg-primary/5" : "border-transparent"
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`use-default-${label}`}
            checked={useDefault}
            onCheckedChange={handleUseDefaultChange}
          />
          <Label
            htmlFor={`use-default-${label}`}
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Use system default
          </Label>
        </div>

        <AnimatePresence>
          {isCustomized && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to {formatValue(systemDefault)}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {technicalTerm && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Technical name: <code className="font-mono">{technicalTerm}</code>
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {useDefault && (
          <span className="text-sm text-muted-foreground">
            System: {formatValue(systemDefault)}
          </span>
        )}
      </div>

      {/* Helper text */}
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}

      {/* Control */}
      <div className={cn(
        "relative transition-opacity",
        useDefault && "opacity-50"
      )}>
        {children({
          value: useDefault ? systemDefault : value,
          onChange: onValueChange,
          disabled: useDefault,
          systemDefault,
        })}

        {/* Overlay when disabled */}
        {useDefault && (
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => handleUseDefaultChange(false)}
            title="Click to customize"
          />
        )}
      </div>

      {/* Customization info */}
      <AnimatePresence>
        {isCustomized && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
              <span className="font-medium text-foreground">
                ✎ Custom: {formatValue(value)}
              </span>
              <span className="text-muted-foreground">
                (default: {formatValue(systemDefault)})
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
```

#### Slider with Default Marker

```tsx
// src/components/ui/slider-with-default.tsx

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderWithDefaultProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** The system default value to show as a marker */
  defaultMarkerValue?: number;
  /** Whether to show the default marker */
  showDefaultMarker?: boolean;
}

export const SliderWithDefault = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderWithDefaultProps
>(({ className, defaultMarkerValue, showDefaultMarker = true, ...props }, ref) => {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const range = max - min;

  // Calculate marker position as percentage
  const markerPercent = defaultMarkerValue !== undefined
    ? ((defaultMarkerValue - min) / range) * 100
    : null;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />

        {/* Default value marker */}
        {showDefaultMarker && markerPercent !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/40"
            style={{ left: `${markerPercent}%` }}
          >
            {/* Marker tooltip */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
              default
            </div>
          </div>
        )}
      </SliderPrimitive.Track>

      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
});

SliderWithDefault.displayName = "SliderWithDefault";
```

---

## Pattern 2: Configuration Summary Dashboard

### Why This Matters

**The Problem:** Users with multiple agents can't quickly see:
- Which agents have custom configurations
- What's been changed from defaults
- Whether settings are consistent across agents

**Competitor Gap:** No competitor provides a dashboard view of configuration state.

**The Differentiator:** A visual dashboard that shows configuration status at a glance, with drill-down capability.

### Deep Specification

#### Agent Overview Configuration Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CONFIGURATION SUMMARY CARD                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  In Agent Overview Tab:                                                      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Configuration                                                         │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │     USING DEFAULTS          │       CUSTOMIZED                  │  │ │
│  │  │         ████████████████████│██████                             │  │ │
│  │  │              71%            │  29%                              │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│  │  │  Behavior    │ │  Tools       │ │  Memory      │ │  Availability│ │ │
│  │  │  ┌────────┐  │ │  ┌────────┐  │ │  ┌────────┐  │ │  ┌────────┐  │ │ │
│  │  │  │ ↑      │  │ │  │ ✎      │  │ │  │ ↑      │  │ │  │ ◐      │  │ │ │
│  │  │  │Default │  │ │  │Custom  │  │ │  │Default │  │ │  │1 of 3  │  │ │ │
│  │  │  └────────┘  │ │  └────────┘  │ │  └────────┘  │ │  └────────┘  │ │ │
│  │  │              │ │  Research    │ │              │ │  Quiet hrs   │ │ │
│  │  │  [Edit →]    │ │  [Edit →]    │ │  [Edit →]    │ │  [Edit →]    │ │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│  │                                                                        │ │
│  │  Customizations:                                                       │ │
│  │  • Toolset: Research Mode (4 tools)                                   │ │
│  │  • Quiet hours: 10pm - 8am                                            │ │
│  │                                                                        │ │
│  │  [Reset all to defaults]                      [View full config →]    │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Multi-Agent Configuration Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   MULTI-AGENT CONFIG DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  In Settings → Agents section:                                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Agent Configuration Overview                          [+ New Agent]   │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Agent          Behavior   Tools      Memory    Availability    │  │ │
│  │  │  ─────────────────────────────────────────────────────────────  │  │ │
│  │  │                                                                 │  │ │
│  │  │  Research Bot   [↑ Def]    [✎ Cust]   [↑ Def]   [◐ 1/3]        │  │ │
│  │  │                            Research                             │  │ │
│  │  │                                                                 │  │ │
│  │  │  Code Helper    [✎ Cust]   [✎ Cust]   [✎ Cust]  [↑ Def]        │  │ │
│  │  │                 Low temp   Coding     Deep                      │  │ │
│  │  │                                                                 │  │ │
│  │  │  Daily Bot      [↑ Def]    [↑ Def]    [↑ Def]   [↑ Def]        │  │ │
│  │  │                 (all defaults)                                  │  │ │
│  │  │                                                                 │  │ │
│  │  │  Content Writer [✎ Cust]   [↑ Def]    [↑ Def]   [✎ Cust]       │  │ │
│  │  │                 High temp             Active hrs                │  │ │
│  │  │                                                                 │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  Legend: [↑ Def] Using defaults  [✎ Cust] Customized  [◐ N/M] Mixed  │ │
│  │                                                                        │ │
│  │  Quick Actions:                                                        │ │
│  │  [Apply defaults to all] [Copy config from...] [Export configs]       │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Component Implementation

```tsx
// src/components/domain/agents/ConfigurationSummary.tsx

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight, RotateCcw, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ConfigCategory {
  id: string;
  label: string;
  state: "default" | "customized" | "mixed";
  summary?: string;
  customCount?: number;
  totalCount?: number;
}

interface ConfigurationSummaryProps {
  agentId: string;
  categories: ConfigCategory[];
  onResetAll?: () => void;
}

export function ConfigurationSummary({
  agentId,
  categories,
  onResetAll,
}: ConfigurationSummaryProps) {
  const customizedCount = categories.filter(
    (c) => c.state === "customized" || c.state === "mixed"
  ).length;
  const totalCount = categories.length;
  const defaultPercent = Math.round(
    ((totalCount - customizedCount) / totalCount) * 100
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Configuration</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/agents/$agentId"
              params={{ agentId }}
              search={{ tab: "configure" }}
            >
              <Settings className="h-4 w-4 mr-1" />
              Full config
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Using defaults</span>
            <span>Customized</span>
          </div>
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/30 transition-all"
              style={{ width: `${defaultPercent}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-primary transition-all"
              style={{ width: `${100 - defaultPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{defaultPercent}%</span>
            <span className="text-primary font-medium">
              {100 - defaultPercent}%
            </span>
          </div>
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-2 gap-2">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              agentId={agentId}
            />
          ))}
        </div>

        {/* Customization list */}
        {customizedCount > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Customizations:
            </p>
            <ul className="text-sm space-y-1">
              {categories
                .filter((c) => c.state !== "default" && c.summary)
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">{c.summary}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {customizedCount > 0 && onResetAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="w-full text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-2" />
            Reset all to defaults
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryCard({
  category,
  agentId,
}: {
  category: ConfigCategory;
  agentId: string;
}) {
  const stateConfig = {
    default: {
      icon: "↑",
      label: "Default",
      className: "text-muted-foreground bg-muted/50",
    },
    customized: {
      icon: "✎",
      label: "Custom",
      className: "text-primary bg-primary/10",
    },
    mixed: {
      icon: "◐",
      label: `${category.customCount}/${category.totalCount}`,
      className: "text-foreground bg-muted",
    },
  };

  const config = stateConfig[category.state];

  return (
    <Link
      to="/agents/$agentId"
      params={{ agentId }}
      search={{ tab: "configure", section: category.id }}
      className={cn(
        "block p-3 rounded-lg border hover:border-primary/50 transition-colors",
        category.state === "customized" && "border-primary/30"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{category.label}</span>
        <Badge variant="secondary" className={cn("text-xs", config.className)}>
          {config.icon} {config.label}
        </Badge>
      </div>
      {category.summary && category.state !== "default" && (
        <p className="text-xs text-muted-foreground truncate">
          {category.summary}
        </p>
      )}
    </Link>
  );
}
```

---

## Pattern 3: Consolidated Tab Architecture

### Why This Matters

**The Problem:** Current design proposes 10 tabs for agent detail:
- Overview, Workstreams, Rituals, Tools, Soul, Activity, Behavior, Memory, Availability, Advanced

This creates:
- Cognitive overload (too many choices)
- Lost users (which tab has what?)
- Mobile usability issues (horizontal scroll)

**The Solution:** Consolidate to 4-5 tabs with internal organization.

### Deep Specification

#### Tab Consolidation Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TAB CONSOLIDATION MAPPING                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BEFORE (10 tabs):                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Overview │ Workstreams │ Rituals │ Tools │ Soul │ Activity │        │    │
│  │ Behavior │ Memory │ Availability │ Advanced                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  AFTER (4 tabs):                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Overview  │  Configure  │  Work  │  Activity                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  MAPPING:                                                                    │
│                                                                              │
│  Overview (was: Overview + Soul)                                             │
│  ├── Identity section (name, role, avatar)                                   │
│  ├── Soul/Personality section (moved here)                                   │
│  ├── Configuration summary card (NEW)                                        │
│  └── Recent conversations preview                                            │
│                                                                              │
│  Configure (was: Tools + Behavior + Memory + Availability + Advanced)        │
│  ├── Behavior section (accordion)                                            │
│  │   ├── Creativity, Response length, Streaming                             │
│  │   └── ▸ Advanced: Model override, Speed/Depth                            │
│  ├── Tools section (accordion)                                               │
│  │   ├── Toolset selector, Quick permissions                                │
│  │   └── ▸ Advanced: Allow/deny lists, Elevated mode                        │
│  ├── Memory section (accordion, collapsed by default)                        │
│  │   ├── Memory toggle, Depth selector                                      │
│  │   └── ▸ Advanced: Pruning, Compaction, Search provider                   │
│  ├── Availability section (accordion, collapsed by default)                  │
│  │   ├── Quiet hours picker                                                 │
│  │   └── ▸ Advanced: Heartbeat config                                       │
│  └── Advanced section (accordion, collapsed by default) [Expert only]        │
│      ├── Runtime selector, Sandbox settings                                  │
│      ├── Sub-agent defaults                                                  │
│      └── Raw config viewer/editor                                            │
│                                                                              │
│  Work (was: Workstreams + Rituals)                                           │
│  ├── Workstreams list + create                                               │
│  ├── Rituals list + create                                                   │
│  └── Goals section (if enabled)                                              │
│                                                                              │
│  Activity (unchanged)                                                        │
│  ├── Activity log                                                            │
│  └── Session history                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Configure Tab Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONFIGURE TAB DETAILED LAYOUT                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Configure                                           [Reset all ↺]     │ │
│  │  ══════════════════════════════════════════════════════════════════════│ │
│  │                                                                        │ │
│  │  ▾ Behavior                                         [↑ Using defaults] │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                                                                  │ │ │
│  │  │  [✓] Use system default for all behavior settings                │ │ │
│  │  │                                                                  │ │ │
│  │  │  Creativity                                          System: 0.7 │ │ │
│  │  │  Lower is more precise. Higher is more creative.                 │ │ │
│  │  │  ░░░░░░░░░░░░░░░░░░░────────●──────────░░░░░░░░░░░░░░░░░░░░░░░░░ │ │ │
│  │  │                                                                  │ │ │
│  │  │  Response length                                     System: Med │ │ │
│  │  │  [Concise]  [●Balanced]  [Detailed]                              │ │ │
│  │  │                                                                  │ │ │
│  │  │  Streaming replies                                    System: On │ │ │
│  │  │  [ON]  Show responses as they're generated                       │ │ │
│  │  │                                                                  │ │ │
│  │  │  ▸ Advanced behavior settings                                    │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ▾ Tools                                            [✎ Research Mode] │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                                                                  │ │ │
│  │  │  Toolset                                                         │ │ │
│  │  │  ┌────────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │ Research Mode                                           ▼ │ │ │ │
│  │  │  └────────────────────────────────────────────────────────────┘ │ │ │
│  │  │  Web search, file reading, document analysis enabled             │ │ │
│  │  │                                                                  │ │ │
│  │  │  Quick toggles (read-only when using preset):                    │ │ │
│  │  │  [ON] Web search  [ON] Files  [ON] Docs  [OFF] Code execution   │ │ │
│  │  │                                                                  │ │ │
│  │  │  ▸ Advanced tool settings                                        │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ▸ Memory                                           [↑ Using defaults] │ │
│  │                                                                        │ │
│  │  ▸ Availability                                     [◐ 1 customized]  │ │
│  │                                                                        │ │
│  │  ▸ Advanced                                         [↑ Using defaults] │ │
│  │    (Expert mode only)                                                  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Accordion Behavior Rules

```typescript
// src/lib/accordion-rules.ts

import { PersonaTier } from "@/types/persona";

export interface AccordionRules {
  /** Whether this section is visible at this tier */
  visible: boolean;
  /** Whether expanded by default at this tier */
  defaultExpanded: boolean;
  /** Whether the "Advanced" subsection exists */
  hasAdvanced: boolean;
  /** Whether Advanced subsection is expanded by default */
  advancedDefaultExpanded: boolean;
}

export const SECTION_RULES: Record<
  string,
  Record<PersonaTier, AccordionRules>
> = {
  behavior: {
    casual: { visible: false, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    engaged: { visible: true, defaultExpanded: true, hasAdvanced: false, advancedDefaultExpanded: false },
    expert: { visible: true, defaultExpanded: true, hasAdvanced: true, advancedDefaultExpanded: false },
  },
  tools: {
    casual: { visible: false, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    engaged: { visible: true, defaultExpanded: true, hasAdvanced: false, advancedDefaultExpanded: false },
    expert: { visible: true, defaultExpanded: true, hasAdvanced: true, advancedDefaultExpanded: false },
  },
  memory: {
    casual: { visible: false, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    engaged: { visible: true, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    expert: { visible: true, defaultExpanded: false, hasAdvanced: true, advancedDefaultExpanded: false },
  },
  availability: {
    casual: { visible: false, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    engaged: { visible: true, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    expert: { visible: true, defaultExpanded: false, hasAdvanced: true, advancedDefaultExpanded: false },
  },
  advanced: {
    casual: { visible: false, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    engaged: { visible: false, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
    expert: { visible: true, defaultExpanded: false, hasAdvanced: false, advancedDefaultExpanded: false },
  },
};

export function getSectionRules(sectionId: string, tier: PersonaTier): AccordionRules {
  return SECTION_RULES[sectionId]?.[tier] ?? {
    visible: false,
    defaultExpanded: false,
    hasAdvanced: false,
    advancedDefaultExpanded: false,
  };
}
```

---

## Pattern 4: Context-Aware Feature Surfacing

### Why This Matters

**The Problem:** Static UIs show the same features to everyone, regardless of:
- What the user has actually configured
- What features are relevant to their use case
- What they've explored before

**The Differentiator:** Dynamically surface features based on context, hiding irrelevant options without removing capability.

### Deep Specification

#### Feature Surfacing Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONTEXT-AWARE SURFACING RULES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RULE 1: Hide Empty Collections                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  IF agent has no workstreams AND user hasn't clicked "Add workstream"       │
│  THEN show "Workstreams" as a collapsed prompt, not a full section          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Instead of:                                                           │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Workstreams (0)                               [+ Add workstream] │ │ │
│  │  │  ──────────────────────────────────────────────────────────────  │ │ │
│  │  │                                                                  │ │ │
│  │  │  No workstreams yet.                                             │ │ │
│  │  │  Workstreams help organize ongoing projects...                   │ │ │
│  │  │                                                                  │ │ │
│  │  │                     [Create your first workstream]               │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  Show:                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  ▸ Workstreams        Organize ongoing projects  [+ Add]        │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  RULE 2: Surface Based on Agent Type                                         │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  IF agent purpose mentions "research" or "search"                            │
│  THEN auto-expand Tools section, pre-select "Research" toolset              │
│                                                                              │
│  IF agent purpose mentions "code" or "development"                           │
│  THEN show Sandbox settings prominently, pre-select "Coding" toolset        │
│                                                                              │
│  IF agent purpose mentions "daily" or "routine"                              │
│  THEN auto-expand Availability section, suggest ritual creation             │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  RULE 3: Surface Based on Usage Patterns                                     │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  IF user has modified Behavior settings on another agent                     │
│  THEN show Behavior section expanded for new agents                          │
│                                                                              │
│  IF user frequently creates rituals                                          │
│  THEN show "Add ritual" as a primary action on agent overview               │
│                                                                              │
│  IF user has never used memory features                                      │
│  THEN collapse Memory section, show brief explainer on hover                │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  RULE 4: Surface Based on Inheritance State                                  │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  IF all settings use defaults                                                │
│  THEN collapse Configure tab to summary card in Overview                     │
│       show "Configure" tab as "(defaults)" badge                             │
│                                                                              │
│  IF only Tools are customized                                                │
│  THEN expand only Tools section in Configure tab                             │
│       collapse other sections to one-line summaries                          │
│                                                                              │
│  IF agent has any custom behavior                                            │
│  THEN show behavior delta in Overview summary card                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
// src/hooks/useContextualFeatures.ts

import { useMemo } from "react";
import { usePersonaStore } from "@/stores/usePersonaStore";
import { useInheritanceStore } from "@/stores/useInheritanceStore";
import type { Agent } from "@/types/agent";

export interface ContextualFeatureState {
  /** Sections that should be expanded by default */
  expandedSections: string[];

  /** Sections that should be hidden/collapsed to one-liner */
  minimizedSections: string[];

  /** Features to surface prominently */
  highlightedFeatures: string[];

  /** Suggested actions based on context */
  suggestedActions: SuggestedAction[];

  /** Whether to show Configure tab as "(defaults)" */
  configureIsAllDefaults: boolean;
}

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  action: () => void;
  priority: number;
}

export function useContextualFeatures(agent: Agent): ContextualFeatureState {
  const { tier, usage } = usePersonaStore();
  const { getOverrideCount } = useInheritanceStore();

  return useMemo(() => {
    const overrideCount = getOverrideCount(agent.id);
    const purpose = (agent.description || "").toLowerCase();

    // Determine expanded sections
    const expandedSections: string[] = [];
    const minimizedSections: string[] = [];
    const highlightedFeatures: string[] = [];
    const suggestedActions: SuggestedAction[] = [];

    // Rule 1: Hide empty collections
    if (!agent.workstreams?.length) {
      minimizedSections.push("workstreams");
    }
    if (!agent.rituals?.length) {
      minimizedSections.push("rituals");
    }

    // Rule 2: Surface based on agent type
    if (purpose.includes("research") || purpose.includes("search")) {
      expandedSections.push("tools");
      highlightedFeatures.push("toolset:research");
    }

    if (purpose.includes("code") || purpose.includes("develop")) {
      expandedSections.push("tools");
      highlightedFeatures.push("toolset:coding");
      if (tier === "expert") {
        expandedSections.push("advanced");
        highlightedFeatures.push("sandbox");
      }
    }

    if (purpose.includes("daily") || purpose.includes("routine")) {
      expandedSections.push("availability");
      suggestedActions.push({
        id: "create-ritual",
        label: "Create a daily ritual",
        description: "Set up automated check-ins",
        action: () => {}, // Will be bound by consumer
        priority: 1,
      });
    }

    // Rule 3: Surface based on usage patterns
    if (usage.settingsModified > 0) {
      expandedSections.push("behavior");
    }

    if (usage.ritualsCreated > 2) {
      suggestedActions.push({
        id: "add-ritual",
        label: "Add ritual",
        description: "This agent could benefit from scheduled tasks",
        action: () => {},
        priority: 2,
      });
    }

    // Rule 4: Surface based on inheritance state
    const configureIsAllDefaults = overrideCount === 0;

    if (configureIsAllDefaults) {
      // Collapse most sections when all defaults
      minimizedSections.push("behavior", "memory", "availability");
    }

    return {
      expandedSections: [...new Set(expandedSections)],
      minimizedSections: minimizedSections.filter(
        (s) => !expandedSections.includes(s)
      ),
      highlightedFeatures,
      suggestedActions: suggestedActions.sort((a, b) => a.priority - b.priority),
      configureIsAllDefaults,
    };
  }, [agent, tier, usage, getOverrideCount]);
}
```

---

## Pattern 5: Smart Defaults with Visible Escape Hatches

### Why This Matters

**The Problem:** Users face a dilemma:
- Simple products hide complexity but feel limiting
- Powerful products expose everything but feel overwhelming

**The Differentiator:** Best-of-both via "smart defaults + always-visible escape hatches"

### Deep Specification

#### The Escape Hatch Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ESCAPE HATCH PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRINCIPLE: Every simplification has a visible path to the underlying       │
│             complexity.                                                      │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  EXAMPLE 1: Creativity Slider → Temperature                                  │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Default view:                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Creativity                                                     [?]   │ │
│  │  Lower is more precise. Higher is more creative.                       │ │
│  │  ────────────────────●──────────────────                              │ │
│  │  Precise            │            Creative                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Escape hatch (hover on [?] or click "Show exact value"):                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Creativity (temperature)                               [Hide exact]   │ │
│  │  Lower is more precise. Higher is more creative.                       │ │
│  │  ────────────────────●──────────────────  0.7                         │ │
│  │  0.0                 │                               1.0              │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Manual input: [0.7    ]  Valid range: 0.0 - 2.0                 │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  EXAMPLE 2: Toolset Presets → Custom Permissions                             │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Default view:                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Toolset: [Research Mode ▼]                                            │ │
│  │  Web search, file reading, document analysis enabled                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Escape hatch (select "Custom" or click "Edit permissions"):                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Toolset: [Custom ▼]                              [Save as preset...]  │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  ☑ web_search        Read/Execute        [Configure...]          │ │ │
│  │  │  ☑ file_read         Read only           [Configure...]          │ │ │
│  │  │  ☑ file_write        Read/Write          [Configure...]          │ │ │
│  │  │  ☐ code_execute      —                   [Configure...]          │ │ │
│  │  │  ☑ calendar          Read/Write          [Configure...]          │ │ │
│  │  │  ...                                                             │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ▸ Allow list (0 entries)                                              │ │
│  │  ▸ Deny list (0 entries)                                               │ │
│  │  ▸ Elevated mode settings                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  EXAMPLE 3: GUI Settings → Raw Config                                        │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Default: All settings via GUI controls                                      │
│                                                                              │
│  Escape hatch (in Advanced section, Expert tier):                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Raw Configuration                                        [Collapse]   │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │  ⚠️ Changes here override all UI settings for this agent               │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  {                                                               │ │ │
│  │  │    "temperature": 0.7,                                           │ │ │
│  │  │    "maxTokens": 4096,                                            │ │ │
│  │  │    "tools": {                                                    │ │ │
│  │  │      "profile": "custom",                                        │ │ │
│  │  │      "enabled": ["web_search", "file_read", "calendar"],         │ │ │
│  │  │      "elevated": false                                           │ │ │
│  │  │    },                                                            │ │ │
│  │  │    ...                                                           │ │ │
│  │  │  }                                                               │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  [Validate] [Apply changes] [Reset to GUI values] [Export] [Import]   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Escape Hatch Registry

```typescript
// src/lib/escape-hatches.ts

export interface EscapeHatch {
  /** Simplified feature ID */
  from: string;

  /** Advanced feature ID */
  to: string;

  /** How to reveal the escape hatch */
  trigger: "hover" | "click" | "toggle" | "dropdown" | "section";

  /** Trigger element (tooltip icon, link text, etc.) */
  triggerLabel: string;

  /** Minimum tier required to see this escape hatch */
  minTier: PersonaTier;

  /** Whether this is reversible (can go back to simple view) */
  reversible: boolean;
}

export const ESCAPE_HATCHES: EscapeHatch[] = [
  // Behavior
  {
    from: "creativity-slider",
    to: "temperature-input",
    trigger: "hover",
    triggerLabel: "Show exact value",
    minTier: "engaged",
    reversible: true,
  },
  {
    from: "response-length-chips",
    to: "max-tokens-input",
    trigger: "hover",
    triggerLabel: "Set exact tokens",
    minTier: "expert",
    reversible: true,
  },

  // Tools
  {
    from: "toolset-preset",
    to: "custom-tool-permissions",
    trigger: "dropdown",
    triggerLabel: "Custom",
    minTier: "expert",
    reversible: true,
  },
  {
    from: "tool-toggles",
    to: "allow-deny-lists",
    trigger: "section",
    triggerLabel: "Advanced tool settings",
    minTier: "expert",
    reversible: true,
  },

  // Memory
  {
    from: "memory-depth-chips",
    to: "pruning-settings",
    trigger: "section",
    triggerLabel: "Advanced memory settings",
    minTier: "expert",
    reversible: true,
  },

  // Full config
  {
    from: "all-gui-settings",
    to: "raw-config-editor",
    trigger: "section",
    triggerLabel: "View/Edit raw config",
    minTier: "expert",
    reversible: true,
  },
];

export function getEscapeHatch(
  fromFeature: string,
  tier: PersonaTier
): EscapeHatch | null {
  const hatch = ESCAPE_HATCHES.find((h) => h.from === fromFeature);
  if (!hatch) return null;

  const tierOrder: PersonaTier[] = ["casual", "engaged", "expert"];
  const minTierIndex = tierOrder.indexOf(hatch.minTier);
  const currentTierIndex = tierOrder.indexOf(tier);

  if (currentTierIndex < minTierIndex) return null;

  return hatch;
}
```

#### Component with Escape Hatch

```tsx
// src/components/ui/escapable-control.tsx

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { usePersonaStore } from "@/stores/usePersonaStore";
import { getEscapeHatch } from "@/lib/escape-hatches";

interface EscapableControlProps {
  /** Feature ID for escape hatch lookup */
  featureId: string;

  /** The simplified control */
  children: React.ReactNode;

  /** The advanced control (shown when escaped) */
  advancedControl: React.ReactNode;

  /** Optional label override */
  escapeLabel?: string;

  /** Whether currently in escaped state */
  isEscaped?: boolean;

  /** Called when escape state changes */
  onEscapeChange?: (escaped: boolean) => void;
}

export function EscapableControl({
  featureId,
  children,
  advancedControl,
  escapeLabel,
  isEscaped: controlledEscaped,
  onEscapeChange,
}: EscapableControlProps) {
  const { tier } = usePersonaStore();
  const [internalEscaped, setInternalEscaped] = React.useState(false);

  const isEscaped = controlledEscaped ?? internalEscaped;
  const setEscaped = onEscapeChange ?? setInternalEscaped;

  const hatch = getEscapeHatch(featureId, tier);

  // No escape hatch available for this tier
  if (!hatch) {
    return <>{children}</>;
  }

  const label = escapeLabel ?? hatch.triggerLabel;

  // Different trigger types
  if (hatch.trigger === "hover") {
    return (
      <div className="relative group">
        {isEscaped ? advancedControl : children}

        <div className={cn(
          "absolute right-0 top-0 transition-opacity",
          isEscaped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEscaped(!isEscaped)}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                <Settings2 className="h-3 w-3 mr-1" />
                {isEscaped ? "Simple view" : label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isEscaped
                ? "Switch back to simplified control"
                : "Show advanced options"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  if (hatch.trigger === "section") {
    return (
      <div className="space-y-3">
        {children}

        <Collapsible open={isEscaped} onOpenChange={setEscaped}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
            >
              {isEscaped ? (
                <ChevronUp className="h-4 w-4 mr-2" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              {label}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {advancedControl}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Default: always show simple, advanced behind toggle
  return (
    <div className="space-y-3">
      {children}
      {isEscaped && advancedControl}
      <Button
        variant="link"
        size="sm"
        onClick={() => setEscaped(!isEscaped)}
        className="p-0 h-auto text-xs text-muted-foreground"
      >
        {isEscaped ? "Hide advanced" : label}
      </Button>
    </div>
  );
}
```

---

## Summary: Impact Matrix

| Pattern | UX Differentiator | Complexity Reduction | Capability Preserved |
|---------|-------------------|---------------------|---------------------|
| **Use Default Toggle** | Only product with visible inheritance | 90% of settings need no interaction | Full override available |
| **Config Summary** | At-a-glance customization view | No hunting through tabs | All settings accessible |
| **Consolidated Tabs** | Clean 4-tab structure | 60% fewer navigation choices | All features in accordions |
| **Context-Aware Surfacing** | Adaptive to user needs | Irrelevant features hidden | Always accessible |
| **Escape Hatches** | Power when needed | Simple by default | Full control available |

### Implementation Priority

| Priority | Pattern | Reason |
|----------|---------|--------|
| **P0** | Use Default Toggle | Foundation for all inheritance UX |
| **P0** | Consolidated Tabs | Biggest immediate complexity reduction |
| **P1** | Config Summary | Builds on Use Default Toggle |
| **P1** | Escape Hatches | Enables simplification without loss |
| **P2** | Context-Aware Surfacing | Requires usage tracking infrastructure |

---

## Related Documents

- `03-DESIGN-PRINCIPLES.md` — Core UX principles
- `08-AGENT-CONFIGURATION-DESIGN.md` — Agent config structure
- `20-INHERITANCE-CLARITY-BADGES.md` — Full badge component specs
- `21-PERSONA-PROGRESSION-SYSTEM.md` — Full tier system specs
