# Configure Tab Redesign — Design Doc

**Date:** 2026-02-21
**Status:** Approved

## Summary

Consolidate the Rituals, Tools, and Soul top-level tabs on the Agent Detail page into a single **Configure** tab. Configure renders a nested tab panel with three sub-tabs: Agent Builder, Rituals, Tools.

## Motivation

The agent detail page has six tabs (Overview, Workstreams, Rituals, Tools, Soul, Activity). Rituals, Tools, and Soul are all configuration concerns. Grouping them under a single Configure tab reduces visual clutter and creates a unified configuration workspace — especially important as the Agent Builder (AgentConfigPage) already covers Soul and Tools internally.

## Design

### Top-level tab changes (`$agentId.tsx`)

- **Remove** tabs: `rituals`, `tools`, `soul`
- **Add** tab: `configure`
- **Result:** Overview · Workstreams · Configure · Activity
- Update `AgentDetailTab` type and `validateSearch` valid tabs list accordingly

### New `AgentConfigureTab` component

**File:** `apps/web/src/components/domain/agents/AgentConfigureTab.tsx`

Renders a second-level `<Tabs>` component with three sub-tabs:

| Sub-tab       | Component                                        | Notes                                                                       |
| ------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Agent Builder | `<AgentConfigPage agentId={agentId} embedded />` | Inner config tabs: Overview, Soul, Instructions, Model, Tools, Skills, etc. |
| Rituals       | `<AgentRitualsTab agentId={agentId} />`          | Existing component, no changes                                              |
| Tools         | `<AgentToolsTab agentId={agentId} />`            | Existing component, no changes                                              |

Default active sub-tab: Agent Builder.

### `AgentConfigPage` embedded prop

Add `embedded?: boolean` to `AgentConfigPageProps`.

When `embedded={true}`:

- **Hide:** back button, full page header (emoji + "Configure [Name]" title + workspace path code)
- **Keep:** AI Assist sidebar, Auto Review panel, all inner tabs
- **Add:** slim toolbar row at the top of the embedded view with Auto Review and AI Assist buttons right-aligned (replaces the header's button group)

### Barrel export update

Add `AgentConfigureTab` to `apps/web/src/components/domain/agents/index.ts`.

## Files Changed

1. `apps/web/src/routes/agents/$agentId.tsx` — update tab type, remove 3 tabs, add Configure tab
2. `apps/web/src/components/domain/agents/AgentConfigPage.tsx` — add `embedded` prop
3. `apps/web/src/components/domain/agents/AgentConfigureTab.tsx` — new file
4. `apps/web/src/components/domain/agents/index.ts` — add export

## Non-goals

- No URL sub-routing for Configure sub-tabs (not bookmarkable by design)
- No changes to AgentRitualsTab or AgentToolsTab internals
- The `/agents/$agentId/configure` route remains unchanged (still a full-page configure experience)
