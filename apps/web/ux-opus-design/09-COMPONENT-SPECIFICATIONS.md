# Component Specifications

> Reusable component definitions for the design system

**Canonical keys/terms:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`
**Shared validation/error spec + dependency options:** `apps/web/ux-opus-design/17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md`

---

## New Components Required

### 1. SystemDefaultToggle

A compound component for per-agent override fields.

```typescript
// src/components/ui/system-default-toggle.tsx

interface SystemDefaultToggleProps {
  /** Label shown next to the toggle */
  label: string;
  /** Additional context shown below the label */
  helpText?: string;
  /** Whether currently using system default */
  isUsingDefault: boolean;
  /** The current value (custom or inherited) */
  currentValue: unknown;
  /** The system default value to display */
  defaultValue: unknown;
  /** Format function for displaying values */
  formatValue?: (value: unknown) => string;
  /** Called when toggle state changes */
  onToggle: (useDefault: boolean) => void;
  /** Custom controls shown when not using default */
  children: React.ReactNode;
  /** Show reset button */
  showReset?: boolean;
  /** Called when reset is clicked */
  onReset?: () => void;
}
```

**Visual States:**

```
DEFAULT STATE (checked):
┌─────────────────────────────────────────────────────────────────┐
│ [✓] Use system default                                          │
│     Currently: 0.7 (from system settings)                       │
│                                                                 │
│     ──────────●────────────────────── (disabled)                │
└─────────────────────────────────────────────────────────────────┘

CUSTOM STATE (unchecked):
┌─────────────────────────────────────────────────────────────────┐
│ [ ] Use system default                       [Reset to default] │
│                                                                 │
│     Creativity                                                  │
│     ────●──────────────────────────── 0.3                       │
└─────────────────────────────────────────────────────────────────┘
```

**Variants:**
- Inherited (default) vs Overridden vs Group override (multi-field) vs Unsupported (capability-gated).
- Canonical definition: `apps/web/ux-opus-design/17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md`

---

### 2. FriendlySlider

A slider with human-readable labels and optional preset markers.

```typescript
// src/components/ui/friendly-slider.tsx

interface FriendlySliderProps {
  /** Friendly label (e.g., "Creativity") */
  label: string;
  /** Technical term shown in tooltip */
  technicalLabel?: string;
  /** Helper text below label */
  helpText?: string;
  /** Min value */
  min: number;
  /** Max value */
  max: number;
  /** Step size */
  step?: number;
  /** Current value */
  value: number;
  /** Called on change */
  onChange: (value: number) => void;
  /** Labels for the extremes */
  minLabel?: string;
  maxLabel?: string;
  /** Preset markers to show on track */
  presets?: Array<{ value: number; label: string }>;
  /** Whether to show the numeric value */
  showValue?: boolean;
  /** Format function for the value */
  formatValue?: (value: number) => string;
  /** Disabled state */
  disabled?: boolean;
}
```

**Visual:**

```
Creativity                                                   [?]
Lower is more precise. Higher is more creative.
────────●──────────────────────────────────────── 0.7
Precise                                            Creative

     ↑           ↑           ↑           ↑
   0.0         0.3         0.7         1.0
              (safe)    (default)   (creative)
```

---

### 3. SegmentedControl

For discrete choices like "Short / Medium / Long".

```typescript
// src/components/ui/segmented-control.tsx

interface SegmentedControlProps<T extends string> {
  /** Available options */
  options: Array<{
    value: T;
    label: string;
    description?: string;
  }>;
  /** Current value */
  value: T;
  /** Called on change */
  onChange: (value: T) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
}
```

**Visual:**

```
[Short]  [● Medium]  [Long]  [Very Long]
```

---

### 4. UnsavedChangesBar (Draft Save/Discard)

Per-agent configuration uses draft values with an explicit commit point. This component is the shared pattern.

```typescript
// src/components/ui/unsaved-changes-bar.tsx

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface UnsavedChangesBarProps {
  saveState: SaveState;
  errorMessage?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCopyChanges?: () => void;
}
```

Behavior:
- Hidden when `saveState` is `idle`.
- Appears when `dirty` with actions: `Discard` and `Save changes`.
- When `saving`: disable actions, show progress.
- When `error`: keep bar visible with retry + (optional) `Copy changes`.
- When navigating away while `dirty`: show a confirm dialog that routes through Save/Discard.

Accessibility:
- Bar must be reachable by keyboard and announced on appearance (non-disruptive).
- On save failure, focus should move to the first failing field if known.

---

### 5. TimeRangePicker

For quiet hours and availability schedules (single range). Weekly schedules compose multiple ranges per day/week.

```typescript
// src/components/ui/time-range-picker.tsx

interface TimeRange {
  start: string; // "22:00"
  end: string;   // "07:00"
}

interface TimeRangePickerProps {
  /** Current time range */
  value: TimeRange;
  /** Called on change */
  onChange: (range: TimeRange) => void;
  /** Show visual timeline */
  showTimeline?: boolean;
  /** Time zone for display */
  timezone?: string;
  /** Disabled state */
  disabled?: boolean;
}
```

**Visual:**

```
┌─────────────────────────────────────────────────────────────────┐
│     12am  3am  6am  9am  12pm  3pm  6pm  9pm  12am             │
│     [===]                                  [========]           │
│      ↑                                          ↑               │
│    quiet                                      quiet             │
└─────────────────────────────────────────────────────────────────┘

Start: [10:00 PM ▼]    End: [7:00 AM ▼]
```

---

### 6. ProviderModelSelector

Cascading provider → model dropdowns.

```typescript
// src/components/domain/config/provider-model-selector.tsx

interface ProviderModelSelectorProps {
  /** Currently selected provider */
  provider: string | null;
  /** Currently selected model */
  model: string | null;
  /** Called when selection changes */
  onChange: (provider: string | null, model: string | null) => void;
  /** Available providers (from useModels) */
  providers: Provider[];
  /** Show "Use system default" option */
  showDefault?: boolean;
  /** Default provider/model to display */
  defaultProvider?: string;
  defaultModel?: string;
  /** Label for the component */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
}
```

**Visual:**

```
Model / Provider
┌─────────────────────┐  ┌─────────────────────┐
│ Provider            │  │ Model               │
│ [Anthropic     ▼]   │  │ [Claude Sonnet  ▼]  │
└─────────────────────┘  └─────────────────────┘
```

---

### 6. DraggableList

For fallback model ordering.

```typescript
// src/components/ui/draggable-list.tsx

interface DraggableListProps<T> {
  /** Items in current order */
  items: T[];
  /** Called when order changes */
  onReorder: (items: T[]) => void;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Key extractor */
  keyExtractor: (item: T) => string;
  /** Called when item is removed */
  onRemove?: (item: T) => void;
  /** Placeholder for empty state */
  emptyPlaceholder?: React.ReactNode;
  /** Max items allowed */
  maxItems?: number;
}
```

**Visual:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. [≡] Claude Sonnet (Anthropic)                           [×] │
│ 2. [≡] GPT-4 (OpenAI)                                      [×] │
│ 3. [≡] Gemini Pro (Google)                                 [×] │
│    [+ Add fallback]                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency note (not yet chosen):**
- Preferred: dnd-kit
- Alternative: @hello-pangea/dnd
- Details + ranking: `apps/web/ux-opus-design/17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md`

---

### 7. ToolCategoryAccordion

Enhanced version of existing ToolCategorySection.

```typescript
// src/components/domain/tools/tool-category-accordion.tsx

interface ToolCategoryAccordionProps {
  /** Category metadata */
  category: ToolCategory;
  /** Tools in this category */
  tools: Tool[];
  /** Enabled tool IDs */
  enabledTools: Set<string>;
  /** Called when tool is toggled */
  onToggle: (toolId: string, enabled: boolean) => void;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Read-only mode (when using toolset) */
  readOnly?: boolean;
  /** Show permission badges */
  showPermissions?: boolean;
}
```

**Visual:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ▼ Files & Documents                                    4 of 6   │
├─────────────────────────────────────────────────────────────────┤
│  ☑ Read files         Read local files               [read]    │
│  ☑ Write files        Create and edit files          [write]   │
│  ☐ Delete files       Remove files permanently       [delete]  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8. StatusIndicator

Consistent status display across the app.

```typescript
// src/components/ui/status-indicator.tsx

type StatusVariant =
  | 'success'    // green dot
  | 'warning'    // yellow dot
  | 'error'      // red dot
  | 'info'       // blue dot
  | 'neutral'    // gray dot
  | 'loading';   // animated

interface StatusIndicatorProps {
  /** Status variant */
  variant: StatusVariant;
  /** Status text */
  label: string;
  /** Show dot or full badge */
  display?: 'dot' | 'badge';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
}
```

**Visual:**

```
Dot style:      ● Connected    ○ Missing key    ⚠ Error

Badge style:    [● Connected]  [○ Missing key]  [⚠ Error]
```

---

### 9. ConfigCard

Standard card layout for configuration sections.

```typescript
// src/components/domain/config/config-card.tsx

interface ConfigCardProps {
  /** Card title */
  title: string;
  /** Subtitle or helper text */
  description?: string;
  /** Info tooltip content */
  tooltip?: string;
  /** Actions in header (buttons, etc.) */
  headerActions?: React.ReactNode;
  /** Card content */
  children: React.ReactNode;
  /** Collapsible */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Warning/info banner at top */
  banner?: {
    variant: 'info' | 'warning' | 'error';
    message: string;
  };
}
```

**Visual:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Card Title                                    [Action] [?]      │
│ Helper text describing what this section controls               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Content goes here...                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 10. RawConfigEditor

JSON viewer/editor for power users.

```typescript
// src/components/domain/config/raw-config-editor.tsx

interface RawConfigEditorProps {
  /** Current config value */
  value: Record<string, unknown>;
  /** Called on change (only in edit mode) */
  onChange?: (value: Record<string, unknown>) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Max height before scroll */
  maxHeight?: number;
  /** Validation errors to highlight */
  errors?: Array<{ path: string; message: string }>;
}
```

**Visual:**

```

**Editor dependency note (not yet chosen):**
- Preferred: CodeMirror 6
- Alternative: Monaco (best UX, heavier)
- Details + ranking: `apps/web/ux-opus-design/17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md`
┌─────────────────────────────────────────────────────────────────┐
│ Raw Configuration                        [Copy] [Download]      │
├─────────────────────────────────────────────────────────────────┤
│  1 │ {                                                          │
│  2 │   "id": "abc123",                                          │
│  3 │   "name": "Research Bot",                                  │
│  4 │   "model": null,                                           │
│  5 │   ...                                                      │
│  6 │ }                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Existing Components to Extend

### Accordion (shadcn)

Already available, use for Advanced sections.

### Tabs (shadcn)

Already available, use for agent detail tabs.

### Select (shadcn)

Already available, use for dropdowns.

### Switch (shadcn)

Already available, use for toggles.

### Slider (shadcn)

Extend with FriendlySlider wrapper for labels.

### Card (shadcn)

Extend with ConfigCard wrapper for consistency.

---

## Component File Structure

```
src/components/
├── ui/                              # Base UI (shadcn + extensions)
│   ├── system-default-toggle.tsx    # NEW
│   ├── friendly-slider.tsx          # NEW
│   ├── segmented-control.tsx        # NEW
│   ├── time-range-picker.tsx        # NEW
│   ├── draggable-list.tsx           # NEW
│   ├── status-indicator.tsx         # NEW
│   └── ... (existing shadcn)
│
└── domain/
    ├── config/
    │   ├── config-card.tsx          # NEW
    │   ├── provider-model-selector.tsx # NEW
    │   ├── raw-config-editor.tsx    # NEW
    │   └── ... (existing)
    │
    ├── tools/
    │   ├── tool-category-accordion.tsx # Extend existing
    │   └── ... (existing)
    │
    └── agents/
        ├── AgentBehaviorPanel.tsx   # NEW
        ├── AgentMemoryPanel.tsx     # NEW
        ├── AgentAvailabilityPanel.tsx # NEW
        ├── AgentAdvancedPanel.tsx   # NEW
        └── ... (existing)
```

---

## Design Tokens

Use existing Tailwind/shadcn design tokens:

```css
/* Status colors */
--color-success: var(--green-500);
--color-warning: var(--yellow-500);
--color-error: var(--red-500);
--color-info: var(--blue-500);

/* Spacing for cards */
--card-padding: 1.5rem;
--section-gap: 1rem;
--field-gap: 0.75rem;

/* Typography */
--text-label: var(--text-sm) font-medium;
--text-helper: var(--text-sm) text-muted-foreground;
--text-value: var(--text-base);
```
