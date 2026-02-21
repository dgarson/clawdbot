# Agent Config UX - Implementation Plan and L&F Vision

This document translates the design into an implementation plan for `apps/web`, referencing current source code and configuration schemas. It includes a look-and-feel (L&F) vision that stays consistent with the existing UI system while making the new configuration surfaces feel clear, modern, and friendly.

References:
- Design overview: `ux-agent-config/DESIGN.md`
- Wireframes: `ux-agent-config/WIREFRAMES.md`
- Copy: `ux-agent-config/COPY.md`
- Settings nav + sections: `src/components/domain/settings/SettingsNav.tsx`, `src/routes/you/index.tsx`
- Agent config surfaces: `src/components/domain/config/AgentConfig.tsx`, `src/components/domain/config/AgentFormModal.tsx`, `src/routes/agents/$agentId.tsx`
- Model APIs: `src/lib/api/config.ts`, `src/hooks/queries/useModels.ts`
- Agent/runtime/tool schemas: `src/config/types.agents.ts`, `src/config/types.agent-defaults.ts`, `src/config/types.tools.ts`, `src/config/types.models.ts`

---

## L&F Vision (UX + Visual Direction)

- Preserve the existing Clawdbrain UI system and component patterns (cards, tabs, accordions, section headers) rather than introducing a new visual language.
- Emphasize clarity over density: short helper text under controls, consistent spacing, and collapsed advanced sections by default.
- Use strong, friendly labels (Creativity, Response length, Memory depth) with short inline guidance. Avoid jargon unless a user explicitly opens Advanced.
- Provide visual status cues in provider cards (Connected / Missing key) with subtle color coding that already matches the design system.
- Maintain responsiveness: 2-column layouts on desktop, single column on mobile.
- Advanced options should be tucked into accordion panels with clear "Use system default" toggles for overrides.

---

## Implementation Plan (Design -> Build)

### Phase 0: UX Assets + Reference Mapping (no code)
1) Finalize these files:
   - `ux-agent-config/DESIGN.md`
   - `ux-agent-config/WIREFRAMES.md`
   - `ux-agent-config/COPY.md`
   - `ux-agent-config/IMPLEMENTATION.md`
2) Map all UI controls to config fields:
   - System defaults -> `agents.defaults` (from `src/config/types.agent-defaults.ts`)
   - Per-agent overrides -> `agents.list[]` (from `src/config/types.agents.ts`)
   - Provider auth -> `auth.*` + `models.providers` (from `src/config/types.models.ts`)

### Phase 1: System-Wide Model & Provider Page (new settings section)
1) Update Settings navigation and routing:
   - Add or rename settings section to "Model & Provider" (replaces or renames `ai-provider`).
   - Files:
     - `src/components/domain/settings/SettingsNav.tsx`
     - `src/components/domain/settings/SettingsMobileNav.tsx`
     - `src/routes/you/index.tsx`
2) Build a new settings section component (e.g. `src/components/domain/settings/ModelProviderSection.tsx`):
   - Runtime card
   - System Brain card (gateway loop overrides)
   - Provider cards with auth UI
   - Default models and fallbacks
   - Global behavior controls
   - Heartbeat card (system-wide scheduling + model/provider)
3) Wire data:
   - Use `getConfig()` and `patchConfig()` from `src/lib/api/config.ts`.
   - Use `useModels()` / `useModelsByProvider()` from `src/hooks/queries/useModels.ts`.
   - Use `verifyProviderApiKey()` / `saveProviderApiKey()` from `src/lib/api/config.ts`.
4) Provider auth flows:
   - API key: already supported (verify + save).
   - OAuth: design-only for now, but UI should be ready. Add placeholder CTA + disabled state.
   - CLI pairing: provide pairing code + command stub (requires backend support later).

### Phase 2: Agent Detail Pages (per-agent overrides)
1) Extend agent detail tabs in `src/routes/agents/$agentId.tsx`:
   - Add tabs: Behavior, Tools, Memory, Availability, Advanced.
   - Keep existing Overview, Workstreams, Rituals, Activity.
2) New per-agent settings panels under `src/components/domain/agents/` or `src/components/domain/config/`:
   - `AgentBehaviorPanel` (creativity, response length, streaming, runtime override)
   - `AgentToolsPanel` (tool profiles + advanced allow/deny)
   - `AgentMemoryPanel` (memory toggle + advanced pruning)
   - `AgentAvailabilityPanel` (quiet hours + heartbeat)
   - `AgentAdvancedPanel` (sandbox, group chat, raw config)
3) Connect these panels to the agent config mutations (`useUpdateAgent`, `useCreateAgent` from `src/hooks/mutations/useAgentMutations.ts`).
4) Add "Use system default" toggles that clear or set the per-agent override.

### Phase 3: Friendly Labels + Tooltips
1) Apply copy from `ux-agent-config/COPY.md` to all new controls.
2) Add helpers near controls with subtle typography.
3) Add warnings around elevated permissions and exec tools.

### Phase 4: Advanced Fields and Power-User UX
1) Provide a collapsible advanced section for each tab.
2) Add a raw config viewer/editor (read-only by default; edit gated behind a confirmation).
3) Ensure advanced controls map to the correct schema paths:
   - Per-agent: `agents.list[].*`
   - Defaults: `agents.defaults.*`

### Phase 5: UX Polishing
1) Empty states and errors as defined in `COPY.md`.
2) Validate all sliders and inputs with constraints (e.g. max tokens, concurrency). 
3) Ensure mobile layouts are correct.

### Phase 6: Docs / Internal References (optional)
1) If internal docs are updated, reference only root-relative doc links per repo rules.
2) Avoid personal machine details in docs.

---

## Data Mapping Cheat Sheet (UI -> Config)

System-wide:
- Default runtime -> `agents.defaults.runtime`
- System Brain (gateway loop) -> `agents.main.*`
- Main CCSDK provider fallback -> `agents.defaults.mainCcsdkProvider`
- Default model -> `agents.defaults.model.primary`
- Default model fallbacks -> `agents.defaults.model.fallbacks`
- Image model -> `agents.defaults.imageModel.*`
- Streaming -> `agents.defaults.blockStreamingDefault`
- Creativity -> provider model params (per model) OR introduce a new unified field
- Response length -> provider model params (per model) OR introduce a new unified field
- Heartbeat (system-wide) -> `agents.defaults.heartbeat.*` (model, schedule, target)

Per-agent:
- Model override -> `agents.list[].model`
- Runtime override -> `agents.list[].runtime`
- CCSDK provider override -> `agents.list[].ccsdkProvider`
- Tools profile/allow/deny -> `agents.list[].tools.profile`, `agents.list[].tools.allow`, `agents.list[].tools.deny`
- Memory search -> `agents.list[].memorySearch`
- Heartbeat -> `agents.list[].heartbeat`
- Sandbox -> `agents.list[].sandbox`

Note: Some per-agent rate limit settings are not present in schema. Add only if new config fields are introduced.

---

## UX + Implementation Risks

- OAuth for Claude Max in containerized setups requires a device-code or external login flow. UI should show the intended flow even if backend is not ready.
- Some model settings (temperature, max tokens) are provider-specific and may live in `models.*.params`. A unified UI must either:
  - write per-provider params, or
  - introduce a new standardized config field.
- Heartbeat escalation to System Brain requires backend support (new config + runtime behavior). UI can be present but disabled/flagged.
  - Place under an Experimental accordion on the Heartbeat card.

---

## Open Questions (Resolve Before Build)

1) Where do temperature/max tokens live in config for each provider?
2) How should we represent fallback models in UI and config (global vs per-agent)?
3) OAuth flow mechanics: device code vs local CLI pairing.
4) Should "Expert mode" be a per-user preference or a global admin setting?

---

## Suggested File Structure (apps/web)

- `src/components/domain/settings/ModelProviderSection.tsx`
- `src/components/domain/settings/ProviderCard.tsx`
- `src/components/domain/agents/AgentBehaviorPanel.tsx`
- `src/components/domain/agents/AgentToolsPanel.tsx`
- `src/components/domain/agents/AgentMemoryPanel.tsx`
- `src/components/domain/agents/AgentAvailabilityPanel.tsx`
- `src/components/domain/agents/AgentAdvancedPanel.tsx`

This keeps new functionality modular and avoids bloating existing monolithic components.
