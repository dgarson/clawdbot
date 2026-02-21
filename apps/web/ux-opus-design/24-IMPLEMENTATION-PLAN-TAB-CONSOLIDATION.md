# Implementation Plan: Tab Consolidation & Navigation Refactoring

> **Document:** 24-IMPLEMENTATION-PLAN-TAB-CONSOLIDATION.md
> **Created:** 2026-02-01
> **Depends On:** 23-TAB-CONSOLIDATION-NAVIGATION.md
> **Status:** Ready for Implementation

---

## Executive Summary

This document provides a complete, phased implementation plan for consolidating the agent detail page from 6 tabs to 5 tabs, implementing tier-based visibility, and restructuring the navigation for improved UX.

### Current State → Target State

```
CURRENT (6 tabs)              TARGET (5 tabs)
─────────────────────────────────────────────────
overview      ──────────────► Overview (enhanced)
workstreams   ──┬─────────────► Work
rituals       ──┘
tools         ──┬─────────────► Configure
soul (config) ──┘
activity      ──────────────► Activity
              NEW ────────────► Chat
```

---

## Phase 1: Foundation & Type System

**Duration:** ~2 days
**Risk:** Low
**Dependencies:** None

### 1.1 Update Tab Type Definition

**File:** `apps/web/src/routes/agents/$agentId.tsx`

```typescript
// BEFORE (line 45)
type AgentDetailTab = "overview" | "workstreams" | "rituals" | "tools" | "soul" | "activity";

// AFTER
type AgentDetailTab = "overview" | "work" | "activity" | "chat" | "configure";
```

### 1.2 Create Tab Configuration System

**New File:** `apps/web/src/config/agent-tabs.ts`

```typescript
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Briefcase, Activity, MessageSquare, Settings } from "lucide-react";

export type AgentDetailTab = "overview" | "work" | "activity" | "chat" | "configure";

export interface TabConfig {
  id: AgentDetailTab;
  label: string;
  icon: LucideIcon;
  description: string;
  order: number;
}

export const AGENT_TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Agent summary, stats, and personality",
    order: 0,
  },
  {
    id: "work",
    label: "Work",
    icon: Briefcase,
    description: "Workstreams and scheduled rituals",
    order: 1,
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    description: "Recent activity and execution logs",
    order: 2,
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    description: "Conversation sessions",
    order: 3,
  },
  {
    id: "configure",
    label: "Configure",
    icon: Settings,
    description: "Agent settings, tools, and personality",
    order: 4,
  },
];

export const DEFAULT_TAB: AgentDetailTab = "overview";

export function isValidTab(tab: string): tab is AgentDetailTab {
  return AGENT_TABS.some((t) => t.id === tab);
}
```

### 1.3 Add URL Redirect Mapping

**File:** `apps/web/src/config/agent-tabs.ts` (add to same file)

```typescript
// Map old tab URLs to new tabs for backwards compatibility
export const TAB_REDIRECTS: Record<string, AgentDetailTab> = {
  overview: "overview",
  workstreams: "work",
  rituals: "work",
  tools: "configure",
  soul: "configure",
  activity: "activity",
};

export function resolveTab(tab: string | undefined): AgentDetailTab {
  if (!tab) return DEFAULT_TAB;
  if (isValidTab(tab)) return tab;
  return TAB_REDIRECTS[tab] ?? DEFAULT_TAB;
}
```

### 1.4 Tasks Checklist

- [ ] Create `apps/web/src/config/agent-tabs.ts`
- [ ] Update type in `$agentId.tsx`
- [ ] Update `validateSearch` to use `resolveTab()`
- [ ] Add unit tests for tab resolution

---

## Phase 2: New Tab Components

**Duration:** ~4 days
**Risk:** Medium
**Dependencies:** Phase 1

### 2.1 Create Work Tab (Merges Workstreams + Rituals)

**New File:** `apps/web/src/components/domain/agents/AgentWorkTab.tsx`

This component combines workstreams and rituals into a unified view with sub-sections.

```typescript
// Component structure
export function AgentWorkTab({ agentId }: { agentId: string }) {
  return (
    <div className="space-y-6">
      {/* Sub-navigation pills */}
      <WorkSubNav activeSection={section} onSectionChange={setSection} />

      {/* Conditional content */}
      {section === "workstreams" && <WorkstreamsSection agentId={agentId} />}
      {section === "rituals" && <RitualsSection agentId={agentId} />}
    </div>
  );
}
```

**Implementation Details:**

1. Import and reuse existing `AgentWorkstreamsTab` and `AgentRitualsTab` as sub-sections
2. Add pill/segment navigation for switching between workstreams and rituals
3. Maintain URL state: `?tab=work&section=rituals`

### 2.2 Create Configure Tab (Merges Soul + Tools)

**New File:** `apps/web/src/components/domain/agents/AgentConfigureTab.tsx`

Accordion-based configuration with progressive disclosure.

```typescript
// Component structure
export function AgentConfigureTab({ agentId }: { agentId: string }) {
  return (
    <Accordion type="single" collapsible defaultValue="personality">
      <AccordionItem value="personality">
        <AccordionTrigger>
          <PersonalityIcon /> Personality
          <InheritanceBadge field="personality" />
        </AccordionTrigger>
        <AccordionContent>
          <PersonalityEditor agentId={agentId} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="tools">
        <AccordionTrigger>
          <WrenchIcon /> Tools & Toolsets
          <InheritanceBadge field="toolsets" />
        </AccordionTrigger>
        <AccordionContent>
          <ToolsEditor agentId={agentId} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="advanced">
        <AccordionTrigger>
          <SettingsIcon /> Advanced Settings
        </AccordionTrigger>
        <AccordionContent>
          <AdvancedSettingsEditor agentId={agentId} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

**Sub-components to extract:**

| New Component | Source | Location |
|---------------|--------|----------|
| `PersonalityEditor` | `AgentSoulTab` (sliders, values) | `components/domain/agents/configure/` |
| `ToolsEditor` | `AgentToolsTab` | `components/domain/agents/configure/` |
| `AdvancedSettingsEditor` | New | `components/domain/agents/configure/` |
| `ContextEditor` | `AgentSoulTab` (background textarea) | `components/domain/agents/configure/` |

### 2.3 Create Chat Tab

**New File:** `apps/web/src/components/domain/agents/AgentChatTab.tsx`

Session list and chat interface.

```typescript
// Component structure
export function AgentChatTab({ agentId }: { agentId: string }) {
  const { sessions, isLoading } = useAgentSessions(agentId);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      {/* Session list sidebar */}
      <SessionList
        sessions={sessions}
        selectedId={selectedSession}
        onSelect={setSelectedSession}
        onNewSession={handleNewSession}
      />

      {/* Chat area */}
      <ChatArea sessionId={selectedSession} agentId={agentId} />
    </div>
  );
}
```

**Integration with existing session routes:**
- Link to `/agents/$agentId/session/$sessionKey` for full session view
- Inline preview for quick interactions

### 2.4 Enhance Overview Tab

**File:** `apps/web/src/components/domain/agents/AgentOverviewTab.tsx`

Add personality summary from Soul tab (read-only display).

```typescript
// Add to existing component
<Card>
  <CardHeader>
    <CardTitle>Personality Profile</CardTitle>
    <Link to="?tab=configure" className="text-sm text-muted-foreground">
      Edit →
    </Link>
  </CardHeader>
  <CardContent>
    <PersonalitySummary agentId={agentId} />
  </CardContent>
</Card>
```

### 2.5 Tasks Checklist

- [ ] Create `AgentWorkTab.tsx` with sub-navigation
- [ ] Create `WorkSubNav.tsx` component
- [ ] Create `AgentConfigureTab.tsx` with accordion structure
- [ ] Extract `PersonalityEditor.tsx` from `AgentSoulTab`
- [ ] Extract `ToolsEditor.tsx` from `AgentToolsTab`
- [ ] Create `AdvancedSettingsEditor.tsx`
- [ ] Create `AgentChatTab.tsx`
- [ ] Create `SessionList.tsx` component
- [ ] Create `ChatArea.tsx` component
- [ ] Enhance `AgentOverviewTab.tsx` with personality summary
- [ ] Update barrel exports in `components/domain/agents/index.ts`

---

## Phase 3: Route & Navigation Updates

**Duration:** ~2 days
**Risk:** Medium
**Dependencies:** Phase 2

### 3.1 Update Agent Detail Route

**File:** `apps/web/src/routes/agents/$agentId.tsx`

```typescript
import { AGENT_TABS, resolveTab, type AgentDetailTab } from "@/config/agent-tabs";
import {
  AgentOverviewTab,
  AgentWorkTab,
  AgentActivityTab,
  AgentChatTab,
  AgentConfigureTab,
} from "@/components/domain/agents";

// Update validateSearch
validateSearch: (search): { tab?: AgentDetailTab; section?: string; activityId?: string } => {
  const rawTab = typeof search.tab === "string" ? search.tab : undefined;
  return {
    tab: resolveTab(rawTab),
    section: typeof search.section === "string" ? search.section : undefined,
    activityId: typeof search.activityId === "string" ? search.activityId : undefined,
  };
},

// Update tabs rendering (in component body)
<Tabs value={activeTab} onValueChange={handleTabChange}>
  <TabsList>
    {AGENT_TABS.map((tab) => (
      <TabsTrigger key={tab.id} value={tab.id}>
        <tab.icon className="h-4 w-4 mr-2" />
        {tab.label}
      </TabsTrigger>
    ))}
  </TabsList>

  <TabsContent value="overview">
    <AgentOverviewTab agentId={agentId} />
  </TabsContent>
  <TabsContent value="work">
    <AgentWorkTab agentId={agentId} section={searchSection} />
  </TabsContent>
  <TabsContent value="activity">
    <AgentActivityTab agentId={agentId} />
  </TabsContent>
  <TabsContent value="chat">
    <AgentChatTab agentId={agentId} />
  </TabsContent>
  <TabsContent value="configure">
    <AgentConfigureTab agentId={agentId} />
  </TabsContent>
</Tabs>
```

### 3.2 Update Internal Links

Search codebase for links to old tabs and update:

```bash
# Find all references to old tab names
grep -r "tab=workstreams\|tab=rituals\|tab=tools\|tab=soul" apps/web/src/
```

**Expected locations:**
- `AgentOverviewTab.tsx` — Links to workstreams/rituals sections
- `AgentCard.tsx` — Quick action links
- Notification links in activity feeds

### 3.3 Tasks Checklist

- [ ] Update `$agentId.tsx` with new tab structure
- [ ] Update `validateSearch` to use `resolveTab()`
- [ ] Update all internal links to old tab names
- [ ] Test URL backwards compatibility (old URLs → new tabs)
- [ ] Verify session routes still work (`/agents/$agentId/session/*`)

---

## Phase 4: Tier-Based Visibility System

**Duration:** ~3 days
**Risk:** Medium
**Dependencies:** Phases 1-3

### 4.1 Create Persona Store

**File:** `apps/web/src/stores/usePersonaStore.ts`

```typescript
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
```

### 4.2 Create Feature Gate Component

**File:** `apps/web/src/components/composed/FeatureGate.tsx`

```typescript
import { usePersonaStore, type PersonaTier } from "@/stores/usePersonaStore";

interface FeatureGateProps {
  minTier: PersonaTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const TIER_ORDER: PersonaTier[] = ["casual", "engaged", "expert"];

export function FeatureGate({ minTier, children, fallback = null }: FeatureGateProps) {
  const { tier } = usePersonaStore();

  const currentIndex = TIER_ORDER.indexOf(tier);
  const requiredIndex = TIER_ORDER.indexOf(minTier);

  if (currentIndex >= requiredIndex) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
```

### 4.3 Create Feature Visibility Matrix

**File:** `apps/web/src/config/feature-visibility.ts`

```typescript
import type { PersonaTier } from "@/stores/usePersonaStore";

export interface FeatureConfig {
  id: string;
  minTier: PersonaTier;
  category: "overview" | "work" | "activity" | "chat" | "configure";
}

export const FEATURE_VISIBILITY: FeatureConfig[] = [
  // Overview
  { id: "overview.stats", minTier: "casual", category: "overview" },
  { id: "overview.personality-summary", minTier: "casual", category: "overview" },
  { id: "overview.active-workstreams", minTier: "engaged", category: "overview" },
  { id: "overview.upcoming-rituals", minTier: "engaged", category: "overview" },

  // Work
  { id: "work.workstreams-list", minTier: "engaged", category: "work" },
  { id: "work.rituals-list", minTier: "engaged", category: "work" },
  { id: "work.create-workstream", minTier: "expert", category: "work" },
  { id: "work.create-ritual", minTier: "expert", category: "work" },

  // Configure
  { id: "configure.personality", minTier: "casual", category: "configure" },
  { id: "configure.tools", minTier: "engaged", category: "configure" },
  { id: "configure.advanced", minTier: "expert", category: "configure" },
  { id: "configure.raw-json", minTier: "expert", category: "configure" },

  // ... etc
];

export function getVisibleFeatures(tier: PersonaTier, category?: string): string[] {
  const TIER_ORDER: PersonaTier[] = ["casual", "engaged", "expert"];
  const tierIndex = TIER_ORDER.indexOf(tier);

  return FEATURE_VISIBILITY
    .filter((f) => {
      const featureTierIndex = TIER_ORDER.indexOf(f.minTier);
      const tierMatch = tierIndex >= featureTierIndex;
      const categoryMatch = !category || f.category === category;
      return tierMatch && categoryMatch;
    })
    .map((f) => f.id);
}
```

### 4.4 Add Tier Switcher to Settings

**File:** `apps/web/src/components/domain/settings/PersonaTierSection.tsx`

```typescript
export function PersonaTierSection() {
  const { tier, setTier } = usePersonaStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interface Complexity</CardTitle>
        <CardDescription>
          Choose how much detail you want to see in the interface
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={tier} onValueChange={setTier}>
          <RadioGroupItem value="casual" label="Simple" description="Just the basics" />
          <RadioGroupItem value="engaged" label="Standard" description="More options" />
          <RadioGroupItem value="expert" label="Advanced" description="Full control" />
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
```

### 4.5 Apply Feature Gates to Configure Tab

**File:** `apps/web/src/components/domain/agents/AgentConfigureTab.tsx`

```typescript
import { FeatureGate } from "@/components/composed/FeatureGate";

export function AgentConfigureTab({ agentId }: { agentId: string }) {
  return (
    <Accordion type="single" collapsible defaultValue="personality">
      {/* Always visible */}
      <AccordionItem value="personality">
        <AccordionTrigger>Personality</AccordionTrigger>
        <AccordionContent>
          <PersonalityEditor agentId={agentId} />
        </AccordionContent>
      </AccordionItem>

      {/* Engaged+ only */}
      <FeatureGate minTier="engaged">
        <AccordionItem value="tools">
          <AccordionTrigger>Tools & Toolsets</AccordionTrigger>
          <AccordionContent>
            <ToolsEditor agentId={agentId} />
          </AccordionContent>
        </AccordionItem>
      </FeatureGate>

      {/* Expert only */}
      <FeatureGate minTier="expert">
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced Settings</AccordionTrigger>
          <AccordionContent>
            <AdvancedSettingsEditor agentId={agentId} />
          </AccordionContent>
        </AccordionItem>
      </FeatureGate>
    </Accordion>
  );
}
```

### 4.6 Tasks Checklist

- [ ] Create `usePersonaStore.ts`
- [ ] Create `FeatureGate.tsx`
- [ ] Create `feature-visibility.ts` config
- [ ] Create `PersonaTierSection.tsx` for settings
- [ ] Add tier switcher to Settings page
- [ ] Apply feature gates to Configure tab
- [ ] Apply feature gates to Overview tab
- [ ] Apply feature gates to Work tab
- [ ] Test all three tier modes

---

## Phase 5: Inheritance Badges

**Duration:** ~2 days
**Risk:** Low
**Dependencies:** Phase 4

### 5.1 Create Inheritance Store

**File:** `apps/web/src/stores/useInheritanceStore.ts`

```typescript
import { create } from "zustand";

interface InheritanceState {
  // Track which fields use defaults vs custom values
  agentOverrides: Record<string, Record<string, boolean>>;
  setOverride: (agentId: string, field: string, isCustom: boolean) => void;
  isUsingDefault: (agentId: string, field: string) => boolean;
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
}));
```

### 5.2 Create Inheritance Badge Component

**File:** `apps/web/src/components/composed/InheritanceBadge.tsx`

```typescript
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useInheritanceStore } from "@/stores/useInheritanceStore";

interface InheritanceBadgeProps {
  agentId: string;
  field: string;
  defaultSource?: string;
}

export function InheritanceBadge({ agentId, field, defaultSource = "System" }: InheritanceBadgeProps) {
  const isUsingDefault = useInheritanceStore((s) => s.isUsingDefault(agentId, field));

  if (!isUsingDefault) {
    return (
      <Badge variant="secondary" className="ml-2 text-xs">
        Custom
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
          Using {defaultSource}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        This setting inherits from {defaultSource.toLowerCase()} defaults
      </TooltipContent>
    </Tooltip>
  );
}
```

### 5.3 Create Inheritable Field Wrapper

**File:** `apps/web/src/components/composed/InheritableField.tsx`

```typescript
interface InheritableFieldProps<T> {
  agentId: string;
  field: string;
  defaultValue: T;
  customValue: T | undefined;
  onValueChange: (value: T | undefined) => void;
  children: (props: { value: T; onChange: (v: T) => void }) => React.ReactNode;
}

export function InheritableField<T>({
  agentId,
  field,
  defaultValue,
  customValue,
  onValueChange,
  children,
}: InheritableFieldProps<T>) {
  const { setOverride } = useInheritanceStore();
  const isCustom = customValue !== undefined;
  const currentValue = isCustom ? customValue : defaultValue;

  const handleToggleInherit = () => {
    if (isCustom) {
      onValueChange(undefined); // Revert to default
      setOverride(agentId, field, false);
    } else {
      onValueChange(currentValue); // Make custom with current value
      setOverride(agentId, field, true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <InheritanceBadge agentId={agentId} field={field} />
        <Button variant="ghost" size="sm" onClick={handleToggleInherit}>
          {isCustom ? "Use Default" : "Customize"}
        </Button>
      </div>
      {children({
        value: currentValue,
        onChange: (v) => {
          onValueChange(v);
          setOverride(agentId, field, true);
        },
      })}
    </div>
  );
}
```

### 5.4 Tasks Checklist

- [ ] Create `useInheritanceStore.ts`
- [ ] Create `InheritanceBadge.tsx`
- [ ] Create `InheritableField.tsx`
- [ ] Apply inheritance badges to Configure tab sections
- [ ] Add "Use Default" toggle to personality sliders
- [ ] Add "Use Default" toggle to tool selections
- [ ] Test inheritance UI feedback

---

## Phase 6: Mobile Responsiveness

**Duration:** ~2 days
**Risk:** Low
**Dependencies:** Phases 1-5

### 6.1 Update Tab List for Mobile

**File:** `apps/web/src/routes/agents/$agentId.tsx`

```typescript
<TabsList className="w-full grid grid-cols-5 lg:w-auto lg:inline-flex">
  {AGENT_TABS.map((tab) => (
    <TabsTrigger
      key={tab.id}
      value={tab.id}
      className="flex flex-col items-center gap-1 lg:flex-row lg:gap-2"
    >
      <tab.icon className="h-4 w-4" />
      <span className="text-xs lg:text-sm">{tab.label}</span>
    </TabsTrigger>
  ))}
</TabsList>
```

### 6.2 Create Mobile Tab Navigation Component

**File:** `apps/web/src/components/composed/MobileTabNav.tsx`

```typescript
export function MobileTabNav({ tabs, activeTab, onTabChange }: MobileTabNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden z-50">
      <div className="grid grid-cols-5 h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1",
              activeTab === tab.id ? "text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```

### 6.3 Responsive Accordion for Configure Tab

**File:** `apps/web/src/components/domain/agents/AgentConfigureTab.tsx`

```typescript
// Mobile: single accordion, one section open at a time
// Desktop: all sections expanded by default
const [openSections, setOpenSections] = useState<string[]>(
  isMobile ? ["personality"] : ["personality", "tools", "advanced"]
);
```

### 6.4 Tasks Checklist

- [ ] Update TabsList for responsive grid
- [ ] Create `MobileTabNav.tsx` (optional bottom nav)
- [ ] Make Configure accordion responsive
- [ ] Test all tabs on mobile viewport
- [ ] Test touch interactions

---

## Phase 7: Cleanup & Migration

**Duration:** ~2 days
**Risk:** Low
**Dependencies:** Phases 1-6

### 7.1 Deprecate Old Tab Components

Mark old components as deprecated but keep for reference:

```typescript
// apps/web/src/components/domain/agents/AgentWorkstreamsTab.tsx
/**
 * @deprecated Use AgentWorkTab with section="workstreams" instead
 * Kept for reference during migration, will be removed in future version
 */
export function AgentWorkstreamsTab({ agentId }: { agentId: string }) { ... }
```

### 7.2 Update Component Barrel Exports

**File:** `apps/web/src/components/domain/agents/index.ts`

```typescript
// New consolidated components
export { AgentOverviewTab } from "./AgentOverviewTab";
export { AgentWorkTab } from "./AgentWorkTab";
export { AgentActivityTab } from "./AgentActivityTab";
export { AgentChatTab } from "./AgentChatTab";
export { AgentConfigureTab } from "./AgentConfigureTab";

// Deprecated (remove after migration verified)
// export { AgentWorkstreamsTab } from "./AgentWorkstreamsTab";
// export { AgentRitualsTab } from "./AgentRitualsTab";
// export { AgentToolsTab } from "./AgentToolsTab";
// export { AgentSoulTab } from "./AgentSoulTab";
```

### 7.3 Update Design Documentation

Update `ux-opus-design/05-GAP-ANALYSIS.md` to reflect completed items:

```markdown
## Completed Items (Tab Consolidation)

- [x] Tab consolidation (6 → 5 tabs)
- [x] Progressive disclosure via tier system
- [x] Inheritance badges for default values
- [x] Work tab with sub-sections
- [x] Configure tab with accordions
- [x] Chat tab with session list
```

### 7.4 Tasks Checklist

- [ ] Mark old components as deprecated
- [ ] Update barrel exports
- [ ] Remove unused imports across codebase
- [ ] Update gap analysis documentation
- [ ] Run full test suite
- [ ] Manual QA of all tab transitions

---

## Phase 8: Testing & QA

**Duration:** ~2 days
**Risk:** Low
**Dependencies:** Phases 1-7

### 8.1 Unit Tests

**Files to create:**

```
apps/web/src/config/__tests__/agent-tabs.test.ts
apps/web/src/stores/__tests__/usePersonaStore.test.ts
apps/web/src/stores/__tests__/useInheritanceStore.test.ts
apps/web/src/components/composed/__tests__/FeatureGate.test.tsx
apps/web/src/components/composed/__tests__/InheritanceBadge.test.tsx
```

### 8.2 Integration Tests

**Scenarios:**

1. Tab navigation and URL synchronization
2. Backwards compatibility (old URLs redirect correctly)
3. Tier switching changes visible features
4. Inheritance toggle updates state and UI
5. Configure accordion sections open/close correctly

### 8.3 E2E Tests

**File:** `apps/web/e2e/agent-tabs.spec.ts`

```typescript
test.describe("Agent Detail Tabs", () => {
  test("navigates between all tabs", async ({ page }) => {
    await page.goto("/agents/test-agent");

    for (const tab of ["overview", "work", "activity", "chat", "configure"]) {
      await page.click(`[data-tab="${tab}"]`);
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    }
  });

  test("redirects old tab URLs to new tabs", async ({ page }) => {
    await page.goto("/agents/test-agent?tab=workstreams");
    await expect(page).toHaveURL(/tab=work/);
  });

  test("tier switcher changes visible features", async ({ page }) => {
    // Set to casual tier
    await page.goto("/settings");
    await page.click('[data-tier="casual"]');

    // Navigate to agent configure
    await page.goto("/agents/test-agent?tab=configure");

    // Advanced section should be hidden
    await expect(page.locator('[data-accordion="advanced"]')).not.toBeVisible();
  });
});
```

### 8.4 Tasks Checklist

- [ ] Write unit tests for tab config utilities
- [ ] Write unit tests for stores
- [ ] Write component tests for FeatureGate
- [ ] Write component tests for InheritanceBadge
- [ ] Write integration tests for tab navigation
- [ ] Write E2E tests for full user flows
- [ ] Run full test suite, fix failures
- [ ] Manual QA checklist completion

---

## File Change Summary

### New Files

| File | Purpose |
|------|---------|
| `src/config/agent-tabs.ts` | Tab configuration and redirect mapping |
| `src/config/feature-visibility.ts` | Tier-based feature visibility matrix |
| `src/stores/usePersonaStore.ts` | User persona/tier state |
| `src/stores/useInheritanceStore.ts` | Default/custom inheritance tracking |
| `src/components/composed/FeatureGate.tsx` | Tier-based visibility wrapper |
| `src/components/composed/InheritanceBadge.tsx` | Inheritance status indicator |
| `src/components/composed/InheritableField.tsx` | Field with inherit/customize toggle |
| `src/components/composed/MobileTabNav.tsx` | Mobile bottom navigation (optional) |
| `src/components/domain/agents/AgentWorkTab.tsx` | Combined workstreams + rituals |
| `src/components/domain/agents/AgentChatTab.tsx` | Session list + chat |
| `src/components/domain/agents/AgentConfigureTab.tsx` | Accordion-based config |
| `src/components/domain/agents/configure/PersonalityEditor.tsx` | Extracted from Soul |
| `src/components/domain/agents/configure/ToolsEditor.tsx` | Extracted from Tools |
| `src/components/domain/agents/configure/AdvancedSettingsEditor.tsx` | New advanced options |
| `src/components/domain/agents/WorkSubNav.tsx` | Work tab sub-navigation |
| `src/components/domain/agents/SessionList.tsx` | Chat tab session list |
| `src/components/domain/agents/ChatArea.tsx` | Chat tab message area |
| `src/components/domain/settings/PersonaTierSection.tsx` | Tier switcher UI |

### Modified Files

| File | Changes |
|------|---------|
| `src/routes/agents/$agentId.tsx` | New tab type, new imports, updated render |
| `src/components/domain/agents/index.ts` | Updated exports |
| `src/components/domain/agents/AgentOverviewTab.tsx` | Add personality summary |
| `src/routes/settings/index.tsx` | Add PersonaTierSection |
| `ux-opus-design/05-GAP-ANALYSIS.md` | Mark items complete |
| `ux-opus-design/README.md` | Add link to this doc |

### Deprecated Files (keep initially)

| File | Replacement |
|------|-------------|
| `AgentWorkstreamsTab.tsx` | `AgentWorkTab` + section="workstreams" |
| `AgentRitualsTab.tsx` | `AgentWorkTab` + section="rituals" |
| `AgentToolsTab.tsx` | `AgentConfigureTab` tools accordion |
| `AgentSoulTab.tsx` | `AgentConfigureTab` personality accordion |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing URLs | URL redirect mapping with backwards compat |
| Data loss on migration | No data changes, only UI restructure |
| User confusion | Maintain feature parity, clear visual indicators |
| Regression in functionality | Comprehensive test coverage |
| Mobile breakage | Explicit responsive testing in each phase |

---

## Success Metrics

1. **Tab count reduced:** 6 → 5 tabs
2. **100% feature parity:** All 52 features preserved
3. **URL backwards compat:** Old URLs redirect correctly
4. **Tier system working:** Features show/hide by tier
5. **Inheritance badges visible:** Clear default vs custom indication
6. **Mobile responsive:** All tabs work on mobile viewport
7. **Tests passing:** Unit, integration, and E2E tests green
8. **No regressions:** Manual QA confirms existing workflows intact

---

## Appendix: Full Task Checklist

```
Phase 1: Foundation
  [ ] Create src/config/agent-tabs.ts
  [ ] Update type in $agentId.tsx
  [ ] Update validateSearch to use resolveTab()
  [ ] Add unit tests for tab resolution

Phase 2: New Tab Components
  [ ] Create AgentWorkTab.tsx with sub-navigation
  [ ] Create WorkSubNav.tsx component
  [ ] Create AgentConfigureTab.tsx with accordion structure
  [ ] Extract PersonalityEditor.tsx from AgentSoulTab
  [ ] Extract ToolsEditor.tsx from AgentToolsTab
  [ ] Create AdvancedSettingsEditor.tsx
  [ ] Create AgentChatTab.tsx
  [ ] Create SessionList.tsx component
  [ ] Create ChatArea.tsx component
  [ ] Enhance AgentOverviewTab.tsx with personality summary
  [ ] Update barrel exports

Phase 3: Route & Navigation
  [ ] Update $agentId.tsx with new tab structure
  [ ] Update validateSearch to use resolveTab()
  [ ] Update all internal links to old tab names
  [ ] Test URL backwards compatibility
  [ ] Verify session routes still work

Phase 4: Tier-Based Visibility
  [ ] Create usePersonaStore.ts
  [ ] Create FeatureGate.tsx
  [ ] Create feature-visibility.ts config
  [ ] Create PersonaTierSection.tsx for settings
  [ ] Add tier switcher to Settings page
  [ ] Apply feature gates to Configure tab
  [ ] Apply feature gates to Overview tab
  [ ] Apply feature gates to Work tab
  [ ] Test all three tier modes

Phase 5: Inheritance Badges
  [ ] Create useInheritanceStore.ts
  [ ] Create InheritanceBadge.tsx
  [ ] Create InheritableField.tsx
  [ ] Apply inheritance badges to Configure tab
  [ ] Add "Use Default" toggle to personality sliders
  [ ] Add "Use Default" toggle to tool selections
  [ ] Test inheritance UI feedback

Phase 6: Mobile Responsiveness
  [ ] Update TabsList for responsive grid
  [ ] Create MobileTabNav.tsx
  [ ] Make Configure accordion responsive
  [ ] Test all tabs on mobile viewport
  [ ] Test touch interactions

Phase 7: Cleanup & Migration
  [ ] Mark old components as deprecated
  [ ] Update barrel exports
  [ ] Remove unused imports
  [ ] Update gap analysis documentation
  [ ] Run full test suite
  [ ] Manual QA

Phase 8: Testing & QA
  [ ] Unit tests for tab config
  [ ] Unit tests for stores
  [ ] Component tests for FeatureGate
  [ ] Component tests for InheritanceBadge
  [ ] Integration tests for tab navigation
  [ ] E2E tests for full user flows
  [ ] Run full test suite
  [ ] Manual QA checklist
```
