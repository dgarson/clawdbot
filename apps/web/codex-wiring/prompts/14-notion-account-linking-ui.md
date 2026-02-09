# Ticket 14 — Notion Account Linking UI/UX

## Goal
Enhance the existing Notion connection UI/UX in the web app settings with improved onboarding guidance, prominent documentation links, and a polished OAuth + API key flow. Notion already has backend OAuth support — this task focuses on the UI experience for linking accounts.

## Background
- Notion OAuth backend is fully implemented at `src/providers/connections/notion.ts` with authorize/token URLs, scope definitions, categories, and presets.
- Notion is already in `CONNECTION_DEFINITIONS` in `ConnectionsSectionWithOAuth.tsx` with both OAuth and Internal Integration Token methods.
- The `ConnectionWizardWithScopes.tsx` dialog handles the wizard flow with scope selection.
- Notion scope definitions exist in `apps/web/src/lib/scopes/registry.ts` (read_content, update_content, insert_content, read_comments, create_comments).
- The backend connection provider at `src/providers/connections/notion.ts` supports OAuth and token refresh (tokens don't expire).
- Notion's official developer docs: `https://developers.notion.com/`
- Notion integration setup: `https://www.notion.so/my-integrations`

## Scope
1. Add a documentation/guidance panel to the Notion connection wizard.
2. Improve the Internal Integration Token flow with step-by-step setup instructions.
3. Add prominent links to official Notion developer documentation.
4. Ensure the OAuth flow has clear pre-authorization guidance.
5. Polish the connected state with workspace info and scope display.

## Requirements

### 1. Documentation Guidance Panel
Add a persistent guidance section to the Notion connection wizard (either at the top of the wizard or as a collapsible "Setup Help" panel):

**For OAuth method:**
- **Title**: "Connect with Notion OAuth"
- **Steps**:
  1. "Click 'Continue with Notion' to authorize OpenClaw."
  2. "Select the pages and databases you want to share."
  3. "Notion will redirect you back after authorization."
- **Note**: "OAuth is recommended — it lets you control exactly which pages OpenClaw can access."

**For Internal Integration Token method:**
- **Title**: "Set up an Internal Integration"
- **Steps**:
  1. "Go to [My Integrations](https://www.notion.so/my-integrations) and click '+ New integration'."
  2. "Name your integration (e.g., 'OpenClaw') and select the workspace."
  3. "Under Capabilities, enable the permissions you need (read content, update content, etc.)."
  4. "Copy the 'Internal Integration Secret' and paste it below."
  5. "In Notion, share the pages/databases you want by adding your integration via the '...' menu → 'Connect to' → your integration name."
- **Important callout**: "Internal integrations can only access pages explicitly shared with them."

### 2. External Documentation Links
Add clearly visible links (with `ExternalLink` icon, opening in new tabs):
- "Notion Developer Docs" → `https://developers.notion.com/`
- "My Integrations" → `https://www.notion.so/my-integrations`
- "Authorization Guide" → `https://developers.notion.com/docs/authorization`
- "Getting Started" → `https://developers.notion.com/docs/getting-started`

These should appear:
- In the connection wizard (both OAuth and token methods)
- Optionally in the connected/manage view as "helpful links"

### 3. OAuth Pre-Authorization Screen
Before redirecting to Notion OAuth, show a brief explainer:
- What scopes will be requested (pulled from selected scopes)
- What Notion will ask the user to do (select pages)
- A "Continue with Notion" primary button
- A link to "Learn more about Notion OAuth" → `https://developers.notion.com/docs/authorization`

### 4. Internal Integration Token Improvements
Enhance the existing token entry form:
- Add a "Create Integration" button/link that opens `https://www.notion.so/my-integrations` in a new tab.
- Show the workspace ID field with help text: "Found in your workspace URL: notion.so/{workspace_id}/..."
- Add field validation: Integration tokens start with `secret_` — show an inline error if the format doesn't match.
- Add a "Test Connection" button that calls a lightweight Notion API endpoint to verify the token works before saving.

### 5. Connected State Enhancements
When Notion is connected, the card should display:
- Connection method badge: "OAuth" or "Integration Token"
- Workspace name (from `userInfo.name` in the connection state)
- Connected user (from `userInfo.username` or `userInfo.email`)
- Active scopes in small badges (already partially implemented)
- Last sync timestamp
- Quick links: "Manage Pages" (link to Notion), "View Docs" (link to dev docs)

### 6. Scope Selection Improvements
The scope selector (in `ConnectionScopesStep.tsx` / `ScopeSelector.tsx`) already exists. Ensure:
- Notion preset buttons ("Read-only", "Full access") are prominent.
- Each scope shows its `examples` array as bullet points on hover or expand.
- Required scopes (`read_content`) are visually locked with explanation.
- Risk badges are color-coded (green=low, yellow=medium, red=high).

## Fixed Decisions (Do Not Re-decide)
- Notion OAuth uses the backend provider at `src/providers/connections/notion.ts` — do NOT reimplement OAuth logic.
- Scope definitions come from `apps/web/src/lib/scopes/registry.ts` — add missing scopes there if needed.
- The `ConnectionWizardWithScopes` component is the wizard shell — extend it, don't replace it.
- The "Continue with Notion" OAuth button calls `connect({ providerId: 'notion', scopes })` which triggers the backend OAuth flow.

## Files to Touch (expected)
- `apps/web/src/components/domain/settings/ConnectionsSectionWithOAuth.tsx` — Enhance Notion definition with docs URLs, better descriptions
- `apps/web/src/components/domain/settings/ConnectionWizardWithScopes.tsx` — Add guidance panel slot
- Possibly create `apps/web/src/components/domain/settings/NotionSetupGuide.tsx` — Reusable docs guidance component
- `apps/web/src/components/domain/settings/ConnectionScopesStep.tsx` — Enhance scope display for Notion
- `apps/web/src/lib/scopes/registry.ts` — Verify Notion scopes are complete (add `read_user_info` if missing)

## Acceptance Criteria
- Notion connection wizard includes a visible documentation guidance panel for both OAuth and token methods.
- Documentation links to notion.so/my-integrations and developers.notion.com are prominent and work correctly.
- Internal Integration Token flow includes step-by-step setup instructions.
- Token validation checks for `secret_` prefix format.
- Connected state shows workspace name, user, scopes, and method used.
- OAuth pre-auth screen explains what will happen and what scopes are requested.
- All external links open in new tabs.

## Testing
- Manual: Walk through OAuth flow and verify guidance is visible at each step.
- Manual: Walk through Internal Integration Token flow with setup instructions.
- Manual: Verify all documentation links are valid URLs.
- Manual: Test token format validation (valid/invalid prefixes).
- Manual: Verify connected state displays all expected information.
