# Ticket 13 — Obsidian Account Linking UI/UX

## Goal
Build a dedicated Obsidian connection/linking UI in the web app settings that allows users to connect their Obsidian vault using one of three methods: Local REST API (API key), direct vault path, or Node Bridge. Include clear guidance with links to official Obsidian documentation and the Local REST API plugin.

## Background
- Obsidian integration backend already exists at `src/obsidian/` with tools, watcher, parser, link-index, and event-router.
- Config schema: `src/config/zod-schema.obsidian.ts` — supports `syncMode` (`direct`, `rest-api`, `node-bridge`), `restApi` (url + apiKey), `nodeBridge` (nodeId + remoteVaultPath), `vaultPath`, watcher settings, and memory ingest options.
- The `ConnectionsSectionWithOAuth.tsx` component already has a pattern for connection cards with auth method selection (OAuth vs API key). Obsidian should follow the same card pattern but without OAuth (Obsidian doesn't support OAuth).
- Existing connection definitions in `ConnectionsSectionWithOAuth.tsx` show the `Connection` interface pattern with `authMethods`, `syncOptions`, etc.
- Obsidian does NOT have OAuth. Its connection methods are local/network-based.

## Scope
1. Add an Obsidian connection card to the Connections settings section.
2. Support three connection methods (sync modes) as distinct auth method tabs:
   - **Local REST API** (recommended): API key + URL for the Obsidian Local REST API plugin.
   - **Direct Vault Path**: Local filesystem path to the vault.
   - **Node Bridge**: Connect via a paired OpenClaw node (nodeId + remote vault path).
3. Add a prominent guidance/documentation section that links to:
   - Official Obsidian documentation: `https://help.obsidian.md/`
   - Local REST API plugin: `https://github.com/coddingtonbear/obsidian-local-rest-api`
   - Obsidian Community Plugins: `https://obsidian.md/plugins`
4. Wire connection to gateway `config.patch` for persisting Obsidian settings.

## Requirements

### 1. Connection Card
- Add Obsidian to `CONNECTION_DEFINITIONS` array in `ConnectionsSectionWithOAuth.tsx` (or create a separate `ObsidianConnectionCard.tsx`).
- Use an Obsidian SVG icon (the angular "O" icon).
- Description: "Connect your Obsidian vault for note sync and knowledge integration"

### 2. Auth Methods (Sync Modes)

**Method A: Local REST API** (badge: "Recommended")
- Type: `api_key`
- Fields:
  - `apiKey` — API Key from the Local REST API plugin (password field, required)
  - `url` — REST API URL (text, default: `https://localhost:27124`, with help text explaining this is the default port)
- CTA hint: "Install the Obsidian Local REST API plugin first"

**Method B: Direct Vault Path**
- Type: `api_key` (really just config fields)
- Fields:
  - `vaultPath` — Absolute path to your Obsidian vault (text, required, placeholder: `/Users/you/Documents/MyVault`)
  - Help text: "The vault must be accessible from the machine running OpenClaw"

**Method C: Node Bridge**
- Type: `api_key`
- Fields:
  - `nodeId` — Paired node ID (text, required, with help text "The OpenClaw node that has access to the vault")
  - `remoteVaultPath` — Vault path on the remote node (text, required, placeholder: `/home/user/vault`)

### 3. Documentation Guidance Panel
- Add an `Alert` or info callout inside the connection wizard/dialog with:
  - **Title**: "Setting up Obsidian"
  - **Body**: Step-by-step guidance for each method
  - For REST API: "1. Install the Local REST API plugin from Obsidian Community Plugins. 2. Enable the plugin and note the API key shown in settings. 3. Enter the key below."
  - External links (with `ExternalLink` icon):
    - "Obsidian Help" → `https://help.obsidian.md/`
    - "Local REST API Plugin" → `https://github.com/coddingtonbear/obsidian-local-rest-api`
    - "Community Plugins" → `https://obsidian.md/plugins`
  - Links should open in new tabs (`target="_blank" rel="noopener noreferrer"`)

### 4. Sync Options
- `syncNotes` — "Sync notes" / "Keep notes indexed for search and memory" (default: enabled)
- `watchChanges` — "Watch for changes" / "Auto-detect vault changes in real-time" (default: enabled)
- `indexWikiLinks` — "Index wiki-links" / "Parse and index [[wiki-links]] for knowledge graph" (default: enabled)
- `indexTags` — "Index tags" / "Parse and index #tags for categorization" (default: enabled)
- `ingestToMemory` — "Ingest to memory" / "Add vault content to the agent's memory pipeline" (default: disabled)

### 5. Config Wiring
- On "Connect" with REST API method: call `config.patch` with:
  ```json
  {
    "obsidian": {
      "enabled": true,
      "syncMode": "rest-api",
      "restApi": { "url": "<url>", "apiKey": "<key>" }
    }
  }
  ```
- On "Connect" with Direct Vault: patch `obsidian.enabled`, `obsidian.syncMode: "direct"`, `obsidian.vaultPath`.
- On "Connect" with Node Bridge: patch `obsidian.enabled`, `obsidian.syncMode: "node-bridge"`, `obsidian.nodeBridge`.
- Use `baseHash` from latest `config.get` snapshot.
- Connection status should read from `config.get` → check `obsidian.enabled` and `obsidian.syncMode`.

### 6. Status Display
- When connected, show:
  - Sync mode badge (e.g., "REST API", "Direct", "Node Bridge")
  - Vault path or REST API URL
  - Last sync timestamp (from health endpoint if available)
- "Manage" button to change settings or disconnect (set `obsidian.enabled: false`).

## Fixed Decisions (Do Not Re-decide)
- Obsidian does NOT use OAuth. No OAuth flow needed.
- The connection card follows the same `Connection` interface pattern as other providers in `ConnectionsSectionWithOAuth.tsx`.
- Config persistence uses `config.patch` (not a custom RPC).
- The Obsidian SVG icon should match the style of other provider icons (24x24 viewBox, `fill="currentColor"`).

## Files to Touch (expected)
- `apps/web/src/components/domain/settings/ConnectionsSectionWithOAuth.tsx` — Add Obsidian to `CONNECTION_DEFINITIONS`
- `apps/web/src/lib/scopes/registry.ts` — No changes needed (Obsidian has no scopes)
- Possibly create `apps/web/src/components/domain/settings/ObsidianSetupGuide.tsx` for the docs guidance panel

## Acceptance Criteria
- Obsidian card appears in the Connections section alongside GitHub, Google, Slack, Notion, Linear, Discord.
- User can select between REST API, Direct Vault, and Node Bridge connection methods.
- Each method shows appropriate input fields with helpful placeholders and guidance.
- Documentation links are prominently displayed and open in new tabs.
- Config is persisted via `config.patch` on connect.
- Status is read from config on load and displayed correctly.
- Disconnect sets `obsidian.enabled: false`.

## Testing
- Manual: Verify all three connection methods render correctly.
- Manual: Verify documentation links are valid and open in new tabs.
- Manual: Verify config.patch is called with correct shape on connect.
- Manual: Verify disconnect flow works.
