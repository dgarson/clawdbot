# Configure Tab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate Rituals, Tools, and Soul top-level tabs into a single Configure tab containing nested sub-tabs: Agent Builder, Rituals, Tools.

**Architecture:** Add an `embedded` prop to `AgentConfigPage` that strips the outer page chrome (back button, header) but keeps AI Assist and Auto Review in a slim toolbar. A new `AgentConfigureTab` component wraps the three nested sub-tabs. The top-level `$agentId.tsx` route removes the three individual tabs and adds Configure.

**Tech Stack:** React, TanStack Router, Framer Motion, shadcn/ui Tabs, Vitest + React Testing Library

---

### Task 1: Add `embedded` prop to `AgentConfigPage`

**Files:**

- Modify: `apps/web/src/components/domain/agents/AgentConfigPage.tsx`

**Step 1: Add the prop to the interface**

In `AgentConfigPage.tsx`, find the `AgentConfigPageProps` interface (line ~132) and add the prop:

```tsx
export interface AgentConfigPageProps {
  agentId: string;
  embedded?: boolean;
}
```

**Step 2: Thread the prop into the component**

In the `AgentConfigPage` function signature (line ~136):

```tsx
export function AgentConfigPage({ agentId, embedded = false }: AgentConfigPageProps) {
```

**Step 3: Replace the header block with conditional rendering**

Find the `{/* Header */}` `<motion.div>` block (lines ~189–274). Replace it with:

```tsx
{
  /* Header */
}
{
  !embedded && (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/agents/$agentId", params: { agentId } })}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            {agentEmoji}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-5 animate-spin" />
                  Loading…
                </span>
              ) : (
                <>Configure {agentName}</>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {workspace ? (
                <code className="text-xs">{workspace}</code>
              ) : (
                "Agent workspace configuration"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={reviewOpen ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setReviewOpen(!reviewOpen)}
              >
                <CheckCircle2 className="size-4" />
                Auto Review
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Analyze config and get suggestions for improvement</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={assistOpen ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setAssistOpen(!assistOpen)}
              >
                {assistOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
                AI Assist
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Get AI help configuring this agent</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 4: Add embedded toolbar (shown only when embedded)**

Directly after the `{!embedded && (...)}` block and before the `<Separator>`, add:

```tsx
{
  embedded && (
    <div className="flex items-center justify-end gap-2 mb-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={reviewOpen ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setReviewOpen(!reviewOpen)}
          >
            <CheckCircle2 className="size-4" />
            Auto Review
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Analyze config and get suggestions for improvement</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={assistOpen ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setAssistOpen(!assistOpen)}
          >
            {assistOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
            AI Assist
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Get AI help configuring this agent</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
```

**Step 5: Conditionally render the Separator**

The `<Separator className="mb-6" />` (line ~276) should only show in full-page mode:

```tsx
{
  !embedded && <Separator className="mb-6" />;
}
```

**Step 6: Verify TypeScript compiles**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `AgentConfigPage`.

**Step 7: Commit**

```bash
git add apps/web/src/components/domain/agents/AgentConfigPage.tsx
git commit -m "feat(agents): add embedded prop to AgentConfigPage"
```

---

### Task 2: Create `AgentConfigureTab` component

**Files:**

- Create: `apps/web/src/components/domain/agents/AgentConfigureTab.tsx`
- Create: `apps/web/src/components/domain/agents/AgentConfigureTab.test.tsx`

**Step 1: Write the failing test first**

Create `apps/web/src/components/domain/agents/AgentConfigureTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentConfigureTab } from "./AgentConfigureTab";

// Mock heavy child components
vi.mock("./AgentConfigPage", () => ({
  AgentConfigPage: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="agent-config-page" data-embedded={embedded ? "true" : "false"}>
      Agent Builder Content
    </div>
  ),
}));

vi.mock("./AgentRitualsTab", () => ({
  AgentRitualsTab: () => <div data-testid="agent-rituals-tab">Rituals Content</div>,
}));

vi.mock("./AgentToolsTab", () => ({
  AgentToolsTab: () => <div data-testid="agent-tools-tab">Tools Content</div>,
}));

describe("AgentConfigureTab", () => {
  it("renders Agent Builder sub-tab by default", () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByTestId("agent-config-page")).toBeInTheDocument();
  });

  it("passes embedded=true to AgentConfigPage", () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByTestId("agent-config-page")).toHaveAttribute("data-embedded", "true");
  });

  it("shows all three sub-tab triggers", () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByRole("tab", { name: /agent builder/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /rituals/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tools/i })).toBeInTheDocument();
  });

  it("switches to Rituals tab on click", async () => {
    const user = userEvent.setup();
    render(<AgentConfigureTab agentId="agent-1" />);
    await user.click(screen.getByRole("tab", { name: /rituals/i }));
    expect(screen.getByTestId("agent-rituals-tab")).toBeInTheDocument();
  });

  it("switches to Tools tab on click", async () => {
    const user = userEvent.setup();
    render(<AgentConfigureTab agentId="agent-1" />);
    await user.click(screen.getByRole("tab", { name: /tools/i }));
    expect(screen.getByTestId("agent-tools-tab")).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx vitest run src/components/domain/agents/AgentConfigureTab.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `AgentConfigureTab` does not exist yet.

**Step 3: Create the component**

Create `apps/web/src/components/domain/agents/AgentConfigureTab.tsx`:

```tsx
import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, Calendar, Wrench } from "lucide-react";
import { AgentConfigPage } from "./AgentConfigPage";
import { AgentRitualsTab } from "./AgentRitualsTab";
import { AgentToolsTab } from "./AgentToolsTab";

type ConfigureSubTab = "builder" | "rituals" | "tools";

interface AgentConfigureTabProps {
  agentId: string;
}

export function AgentConfigureTab({ agentId }: AgentConfigureTabProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<ConfigureSubTab>("builder");

  return (
    <Tabs
      value={activeSubTab}
      onValueChange={(v) => setActiveSubTab(v as ConfigureSubTab)}
      className="space-y-4"
    >
      <TabsList className="bg-muted/50 p-1">
        <TabsTrigger value="builder" className="gap-1.5">
          <Bot className="size-4" />
          Agent Builder
        </TabsTrigger>
        <TabsTrigger value="rituals" className="gap-1.5">
          <Calendar className="size-4" />
          Rituals
        </TabsTrigger>
        <TabsTrigger value="tools" className="gap-1.5">
          <Wrench className="size-4" />
          Tools
        </TabsTrigger>
      </TabsList>

      <TabsContent value="builder" className="mt-0">
        <AgentConfigPage agentId={agentId} embedded />
      </TabsContent>

      <TabsContent value="rituals" className="mt-0">
        <AgentRitualsTab agentId={agentId} />
      </TabsContent>

      <TabsContent value="tools" className="mt-0">
        <AgentToolsTab agentId={agentId} />
      </TabsContent>
    </Tabs>
  );
}
```

**Step 4: Run the tests to confirm they pass**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx vitest run src/components/domain/agents/AgentConfigureTab.test.tsx 2>&1 | tail -20
```

Expected: 5 tests PASS.

**Step 5: TypeScript check**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/web/src/components/domain/agents/AgentConfigureTab.tsx \
        apps/web/src/components/domain/agents/AgentConfigureTab.test.tsx
git commit -m "feat(agents): add AgentConfigureTab with nested builder/rituals/tools sub-tabs"
```

---

### Task 3: Add `AgentConfigureTab` to barrel export

**Files:**

- Modify: `apps/web/src/components/domain/agents/index.ts`

**Step 1: Add the export**

In `index.ts`, after the `AgentConfigPage` export line, add:

```ts
export { AgentConfigureTab } from "./AgentConfigureTab";
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/domain/agents/index.ts
git commit -m "chore(agents): export AgentConfigureTab from barrel"
```

---

### Task 4: Update `$agentId.tsx` — replace three tabs with Configure

**Files:**

- Modify: `apps/web/src/routes/agents/$agentId.tsx`

**Step 1: Update the import**

In `$agentId.tsx`, find the import from `@/components/domain/agents` (lines ~11–19). Replace `AgentRitualsTab, AgentToolsTab, AgentSoulTab` with `AgentConfigureTab`:

```tsx
import {
  AgentOverviewTab,
  AgentWorkstreamsTab,
  AgentConfigureTab,
  AgentActivityTab,
  NewSessionDialog,
} from "@/components/domain/agents";
```

**Step 2: Update the `AgentDetailTab` type**

Find line ~45:

```tsx
type AgentDetailTab = "overview" | "workstreams" | "rituals" | "tools" | "soul" | "activity";
```

Replace with:

```tsx
type AgentDetailTab = "overview" | "workstreams" | "configure" | "activity";
```

**Step 3: Update `validateSearch`**

Find the `validTabs` array in `validateSearch` (lines ~50–53):

```tsx
const validTabs: AgentDetailTab[] = ["overview", "workstreams", "configure", "activity"];
```

**Step 4: Update the default tab**

Find line ~64:

```tsx
const [activeTab, setActiveTab] = React.useState<AgentDetailTab>(searchTab ?? "overview");
```

No change needed — default is still `"overview"`.

**Step 5: Update the `TabsList`**

Find the `<TabsList>` block (lines ~385–392). Replace the three individual tabs:

```tsx
<TabsList className="w-full justify-start bg-muted/50 p-1">
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="workstreams">Workstreams</TabsTrigger>
  <TabsTrigger value="configure">Configure</TabsTrigger>
  <TabsTrigger value="activity">Activity</TabsTrigger>
</TabsList>
```

**Step 6: Remove old `TabsContent` blocks and add Configure**

Remove the `TabsContent` blocks for `rituals`, `tools`, and `soul`. Add:

```tsx
<TabsContent value="configure">
  <AgentConfigureTab agentId={agentId} />
</TabsContent>
```

The final tabs section should look like:

```tsx
<TabsContent value="overview">
  <AgentOverviewTab
    agent={agent}
    workstreams={workstreams}
    rituals={rituals}
  />
</TabsContent>

<TabsContent value="workstreams">
  <AgentWorkstreamsTab agentId={agentId} />
</TabsContent>

<TabsContent value="configure">
  <AgentConfigureTab agentId={agentId} />
</TabsContent>

<TabsContent value="activity">
  <AgentActivityTab
    agentId={agentId}
    selectedActivityId={activityId ?? null}
    onSelectedActivityIdChange={(nextActivityId) => {
      setActiveTab("activity");
      navigate({
        search: (prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { activityId: _activityId, ...rest } = prev as Record<string, unknown>;
          return nextActivityId
            ? { ...rest, tab: "activity", activityId: nextActivityId }
            : { ...rest, tab: "activity" };
        },
        replace: true,
      });
    }}
  />
</TabsContent>
```

**Step 7: Remove unused imports**

Remove `AgentRitualsTab`, `AgentToolsTab`, `AgentSoulTab` from the import list if no longer used anywhere else in the file.

**Step 8: TypeScript check**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 9: Run all tests**

```bash
cd /Users/davidgarson/dev/openclaw/apps/web
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

**Step 10: Commit**

```bash
git add apps/web/src/routes/agents/\$agentId.tsx
git commit -m "feat(agents): replace Rituals/Tools/Soul tabs with Configure nested tab panel"
```

---

## Verification

After all tasks:

1. Navigate to `/agents/<any-id>` — confirm top-level tabs are: Overview, Workstreams, Configure, Activity
2. Click Configure — confirm nested sub-tabs: Agent Builder, Rituals, Tools
3. Agent Builder sub-tab — confirm inner tabs (Overview, Soul, Instructions, Model, etc.) are present, no back button, no page header, AI Assist and Auto Review buttons visible in slim toolbar
4. Rituals sub-tab — confirm rituals list renders
5. Tools sub-tab — confirm tools config renders
6. Navigate to `/agents/<id>/configure` directly — confirm full-page configure still works (back button, header present)
