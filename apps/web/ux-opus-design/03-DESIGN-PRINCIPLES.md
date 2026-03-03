# Design Principles

> The foundational UX principles that guide all design decisions.

---

## Core Principle: Progressive Disclosure

**Simple by default, deep when asked.**

This principle shapes every aspect of the interface:

```
┌─────────────────────────────────────────────────────────────┐
│                    VISIBILITY LAYERS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Essential (Always Visible)                        │
│  ├── Agent name, status, avatar                             │
│  ├── Primary action buttons                                  │
│  └── Most-used settings (Creativity, Response length)       │
│                                                              │
│  Layer 2: Standard (One Click Away)                         │
│  ├── Tab navigation to feature areas                        │
│  ├── Tool profiles and capability toggles                   │
│  └── Memory and availability settings                       │
│                                                              │
│  Layer 3: Advanced (Collapsed Accordions)                   │
│  ├── Model overrides and fallbacks                          │
│  ├── Provider-specific parameters                           │
│  └── Sandbox and execution controls                         │
│                                                              │
│  Layer 4: Expert (Gated Access)                             │
│  ├── Raw configuration editor                               │
│  ├── CLI pairing and advanced auth                          │
│  └── Experimental features                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Patterns

1. **Accordions** — Advanced sections collapsed by default
2. **Expert Mode Toggle** — Global preference in `useUIStore.powerUserMode`
3. **"Use system default" switches** — Per-field opt-in for overrides
4. **Inline expansion** — Details revealed without page navigation

---

## Principle: Friendly First

**Human language over technical jargon.**

Every label visible to users should be understandable without AI/ML knowledge.

### The Label Test

Before shipping any UI text, ask:
> "Would my non-technical friend understand this?"

If no, rewrite or add helper text.

### Technical Access

Technical terms are still available:
- Tooltips show technical equivalents
- Advanced panels use original terms with friendly labels
- Raw config uses canonical field names

```
┌────────────────────────────────────────┐
│  Creativity                      [?]  │
│  ├── Tooltip: "Also known as           │
│  │   'temperature' in AI models"       │
│  └── Slider: ────●────── 0.7           │
└────────────────────────────────────────┘
```

---

## Principle: Safe Defaults

**Users should not accidentally break things.**

### Default Behaviors

| Category | Default | Reasoning |
|----------|---------|-----------|
| Runtime | Pi (stateful) | Better for most use cases |
| Tool profile | Minimal | Start safe, expand as needed |
| Sandbox | Enabled | Prevent accidental system access |
| Memory | Enabled | Users expect context retention |
| Streaming | Enabled | Better perceived responsiveness |

### Override Pattern

All per-agent settings start with "Use system default" enabled:

```
┌────────────────────────────────────────┐
│  [✓] Use system default                │
│                                        │
│  Creativity: 0.7 (from system)         │
│  ────────────── (disabled slider)      │
└────────────────────────────────────────┘

        ↓ User unchecks ↓

┌────────────────────────────────────────┐
│  [ ] Use system default                │
│                                        │
│  Creativity                            │
│  ────●────────── 0.5 (custom)          │
└────────────────────────────────────────┘
```

---

## Principle: Visual Status

**Show, don't tell.**

Users should understand system state at a glance.

### Status Indicators

```
Provider Cards:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ ● Anthropic      │  │ ○ OpenAI         │  │ ⚠ Google         │
│   Connected      │  │   Missing key    │  │   Error          │
└──────────────────┘  └──────────────────┘  └──────────────────┘
     (green)              (gray)                (red)

Agent Status:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ ● Research Bot   │  │ ◐ Code Helper    │  │ ○ Archive Bot    │
│   Active         │  │   Working...     │  │   Paused         │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Inline Feedback

- **Validation errors:** Appear immediately below the field
- **Save status:**
  - System settings: auto-save with subtle confirmation (existing pattern).
  - Per-agent config: draft edits with an explicit Save/Discard commit point (to avoid accidental partial changes).
- **Connection tests:** Inline success/failure with retry option

---

## Principle: Guided Complexity

**Complex tasks get wizards, not forms.**

When a task requires multiple decisions:

### Use a Wizard When:
- Creating a new agent (identity + tools + behavior)
- Connecting a new provider (auth + test + defaults)
- Setting up a toolset (name + permissions + assignment)

### Wizard Structure

```
Step 1/4: Basics        Step 2/4: Tools         Step 3/4: Behavior
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Name your agent │ →  │ What can it do? │ →  │ How should it   │
│                 │    │                 │    │ respond?        │
│ [Research Bot ] │    │ ○ Minimal       │    │                 │
│                 │    │ ● Messaging     │    │ Creativity: ─●─ │
│ [Next →]        │    │ ○ Full          │    │ Length: ─────●  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Principle: Consistent Patterns

**Same problems, same solutions.**

### Standard Control Patterns

| Data Type | Control | Example |
|-----------|---------|---------|
| On/Off | Toggle switch | Streaming: [●───] |
| Range (continuous) | Slider | Creativity: ─●─── |
| Range (discrete) | Segmented control | Depth: [Short][Med][Long] |
| Single choice | Radio group | Runtime: ○ Pi ● SDK |
| Multi-choice | Checkboxes | Tools: ☑ Files ☑ Web ☐ Exec |
| Selection from list | Dropdown | Model: [Claude Sonnet ▼] |
| Multiple from list | Multi-select chips | Fallbacks: [GPT-4] [Gemini] [+] |
| Ordered list | Drag-to-reorder | Priority: 1. Claude 2. GPT-4 |

### Standard Section Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Section Title                                    [Actions]  │
│ Helper text explaining what this section controls           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Field Label                                         [?]    │
│  Helper text for this specific field                        │
│  ┌───────────────────────────────────────────────────┐     │
│  │ Control                                           │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  ▶ Advanced                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Principle: Escape Hatches

**Power users can go deeper quickly.**

Every friendly abstraction has a path to the underlying system:

| Friendly UI | Escape Hatch |
|-------------|--------------|
| Creativity slider | Advanced → temperature field |
| Tool profiles | Advanced → allow/deny lists |
| System defaults | Per-agent overrides |
| Visual editor | Raw config JSON viewer |
| Web UI | CLI commands |

### Expert Mode

A global toggle (`useUIStore.powerUserMode`) that:
- Expands all advanced sections by default
- Shows technical terms alongside friendly labels
- Enables raw config editing
- Adds CLI command suggestions

#### Explicit Behavior Table (Required)

This table defines what changes when Expert Mode is toggled.

| Surface | Expert Mode OFF | Expert Mode ON |
|--------|------------------|----------------|
| Settings: Model & Provider | Hide advanced-only sections (e.g. Global Behavior). Show safe defaults and essential provider/model choices. | Show advanced sections and knobs (e.g. Global Behavior). Show technical term tooltips + config paths. |
| Agent detail tabs | Show the default tab set intended for non-experts. Advanced tabs/sections are hidden or minimized. | Show full tab set and advanced sections by default; allow raw config access. |
| Tool permissions | Prefer toolsets and high-level profiles; hide allow/deny and elevated policy details unless explicitly entered. | Show allow/deny lists, elevated mode details, and policy precedence explanations. |
| Inputs | Friendly labels only. | Friendly labels + technical equivalents (tooltip or secondary label). |
| Help | Conceptual help (“what happens if I change this?”). | Adds “copy CLI equivalent” and “copy config path” affordances where meaningful. |

### View Mode Override (Per Page)

Expert Mode is a persisted preference. Separately, each agent detail view must offer an immediate, local override:
- `View: Simple / Full` (local-only; does not persist; defaults from Expert Mode)

This prevents “global preference lock-in” while still keeping progressive disclosure as the default.

MVP requirement:
- **Agent detail:** required
- **Settings pages:** optional (can rely on Expert Mode), but allowed if it improves usability without introducing inconsistent patterns

| Surface | Simple | Full |
|--------|--------|------|
| Agent detail tabs | Primary tabs: **Basics** + **More** | Full tab set (Overview/Behavior/Tools/...) plus Basics/More |
| Density | Collapsed sections, fewer visible controls | More visible controls; advanced accordions expanded by default |
| Power affordances | Hide config paths; keep jump available | Show keyboard hints, config paths, and raw config affordances |

---

## Principle: Outcome-First Controls (No Mystery Knobs)

Every control must clearly answer:
- What user-facing outcome changes if I adjust this?
- What is the safe default?
- What are the recommended ranges/presets?
- What happens at the extremes?

If a control cannot answer these questions, it must be gated behind Expert Mode (and ideally capability-gated by provider/runtime).

---

## Principle: Accessibility First (a11y)

Accessibility is not optional. All configuration UI must:
- Work with keyboard only (focus order, tab stops, shortcuts).
- Avoid communicating status using color alone (text/icons must carry meaning).
- Use clear, descriptive labels and helper text associations (ARIA).
- Provide focus management on errors (e.g. “save failed” should focus the failing field).

Power-user shortcut baseline:
- Configuration Command Palette: `Cmd+K` / `Ctrl+K` (must be discoverable, not hidden).

---

## Principle: Platform Focus (Web First)

**This UX plan targets `apps/web/` and does not aim to fully solve mobile UX.**

If/when a dedicated mobile app exists, it should have its own IA, patterns, and constraints rather than inheriting the web UI.

---

## Anti-Patterns to Avoid

### Don't Do This

| Anti-Pattern | Why It's Bad | Do This Instead |
|--------------|--------------|-----------------|
| Showing all options at once | Overwhelming for new users | Progressive disclosure |
| Using only technical terms | Excludes non-developers | Friendly labels with tooltips |
| Requiring advanced config to start | High friction | Smart defaults |
| Hiding critical status | Users can't troubleshoot | Visual status indicators |
| Modal overload | Interrupts flow | Inline editing |
| Inconsistent controls | Confusing | Standard patterns |
