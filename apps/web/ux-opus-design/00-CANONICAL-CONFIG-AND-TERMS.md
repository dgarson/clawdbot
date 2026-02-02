# Canonical Config + Terminology (apps/web)

This document is the source of truth for:
- The **canonical internal config keys** used by Clawdbrain (as surfaced by `apps/web/`).
- The **user-facing terminology** (friendly labels + definitions) that must remain consistent across the UI and docs.
- The **scope boundary** between the Agent Configuration MVP and future Graph/Ingestion/RAG work.

If a UI spec or plan conflicts with this document, **update the other doc** (not this one) unless you are intentionally changing the underlying config model.

## Scope Boundaries (MVP vs Future Tracks)

### Agent Configuration MVP (in scope for apps/web UX)
- System defaults configuration (providers, default models, runtime, heartbeat, baseline behavior).
- Per-agent overrides for behavior/tools/memory/advanced settings.
- Toolsets (as a UX concept) and power-user navigation (command palette + shortcuts).

### Explicit non-goals for Agent Configuration MVP
- Graph DB integration (Neo4j/Graphiti/etc.), knowledge graph UX, entity extraction, graph-based retrieval.
- End-to-end ingestion pipeline (crawler, multimodal ingestion, embedding jobs) and hybrid RAG.

These belong to the **Graph + Ingestion/RAG Track** (separate MVP, separate risks/security). See:
- `apps/web/docs/plans/2026-02-01-graph-and-ingestion-track.md`
- `apps/web/docs/plans/2026-02-01-entity-relationships-and-memory-audit-trail.md` (lightweight relationships + audit trail UX; no external graph DB required)

---

## Crisp Definitions (One Paragraph)

In the Clawdbrain web app, an **Agent** is a named assistant the user interacts with directly (chatting, running tools, doing work) whose behavior can inherit system defaults or be overridden per-agent; the **System Brain** is a special system-level “default agent” used for system tasks and fallbacks (routing, safety, background decisions) that can be configured separately from normal agents; and the **Gateway** is the running backend service (local or remote) that stores config, connects to providers/channels, executes tools, and exposes APIs/events to the web UI.

---

## Canonical Personas (N:N across docs)

All UX + monetization docs must use **exactly** these four personas (no extras, no synonyms):

1) **Business User**
   - Goal: team productivity and repeatable workflows.
   - UX needs: safe defaults, shared presets/toolsets, auditability, permissions.

2) **Personal User (Non-Technical)**
   - Goal: personal productivity and daily assistance.
   - UX needs: minimal setup, plain language, “do the right thing” defaults.

3) **Tech-Savvy Personal User**
   - Goal: customization and experimentation without enterprise overhead.
   - UX needs: power features discoverable, import/export, templates, faster iteration.

4) **Engineer / Technical Expert**
   - Goal: integration, automation, reproducibility, and deep control.
   - UX needs: raw config, keyboard-first workflows, clear schema/paths, API parity.

---

## Canonical Internal Keys (Use These in Docs and UI Logic)

## Provider Support (apps/web)

This section defines the MVP provider set at the *product* level. The `apps/web` code may lag behind this list; docs should reflect the target.

MVP provider set (by user decision, 2026-02-02):
- OpenAI
- Anthropic (Claude)
- Gemini
- OpenRouter
- Z.AI
- Azure OpenAI
- Amazon Bedrock
- Vertex AI

Implementation note (avoid premature coupling):
- `apps/web` currently hardcodes a smaller provider list in `settings/ModelProviderSection.tsx` (Anthropic/OpenAI/Google/Z.AI/OpenRouter).
- Current provider ids in code (see `apps/web/src/lib/api/types.ts`): `anthropic`, `openai`, `google`, `openrouter`, `zai`.
- Recommended ids to add for MVP expansion (align backend + frontend types together):
  - `azureOpenai`
  - `bedrock`
  - `vertex`

### Agents (system defaults)
- Default runtime: `agents.defaults.runtime`
- Main (System Brain) runtime overrides:
  - `agents.main.runtime` (highest precedence for System Brain)
  - `agents.defaults.mainRuntime` (fallback, main-only)
- Default model selection:
  - Primary: `agents.defaults.model.primary` (model ref, e.g. `provider/model`)
  - Fallbacks: `agents.defaults.model.fallbacks` (ordered list of model refs)
- Default image model selection:
  - Primary: `agents.defaults.imageModel.primary`
  - Fallbacks: `agents.defaults.imageModel.fallbacks`
- Default model params (provider/model-specific, stored under the model ref key):
  - `agents.defaults.models["<provider>/<model>"].params.temperature`
  - `agents.defaults.models["<provider>/<model>"].params.maxTokens`
- Streaming default:
  - `agents.defaults.blockStreamingDefault` (implementation detail: current UI treats `"off"` as streaming enabled and `"on"` as streaming disabled; docs must describe the user behavior, not the internal inversion)
- Human-like delay:
  - `agents.defaults.humanDelay.*`
- Heartbeat (system-wide):
  - `agents.defaults.heartbeat.*` (schedule, active hours, model, target, etc.)

## Planned Additions (Not Yet Canonical)

### Quiet Hours (proposed schema; do not treat keys as canonical yet)

Quiet hours are a differentiator: they are a **policy layer** that governs when *user-facing agents* are allowed to initiate or emit certain kinds of actions.

Important constraints (by user decision, 2026-02-02):
- Quiet hours must **not** interrupt the System Brain or background activity.
- Quiet hours must still allow explicit manual interaction:
  - Direct chats should still get responses.
  - In channels/group chats, “Respond only when mentioned” should be the default behavior.
- Notification/event suppression (e.g. quieting alerts until morning) is a separate, future layer (see “future extension” below).

Current reality in `apps/web`:
- There is already a user-preferences concept of quiet hours for notifications (e.g. `notificationSettings.pauseDuringQuietHours` in `useUserSettings.ts`). This is UI-level preference storage (localStorage today), not agent runtime behavior.

Proposed future config placement (system default + per-agent overrides) - document only:
- System default: `agents.defaults.availability.quietHours` (proposed)
- Per-agent override: `agents.list[].availability.quietHours` (proposed)

Proposed schema (illustrative; keep fields optional and extendable):
```json
{
  "enabled": true,
  "timezone": "America/Los_Angeles",
  "schedule": [
    { "days": ["mon","tue","wed","thu","fri"], "start": "22:00", "end": "07:00" },
    { "days": ["sat","sun"], "start": "00:00", "end": "09:00" }
  ],
  "policy": {
    "respondOnlyWhenMentioned": true,
    "muteOutboundNotifications": true,
    "blockProactiveMessages": true,
    "blockToolExecution": false,
    "allowDirectChats": true,
    "allowOwnerOnlyOverride": true
  },
  "exceptions": {
    "channelsAllow": [],
    "agentsAllow": [],
    "toolsAllow": [],
    "messageTypesAllow": ["error","security"]
  },
  "behaviorDuringQuietHours": "queue" 
}
```

Canonical meaning options (must be surfaced in UI copy):
- "Respond only when mentioned" (default) - silence in group contexts unless explicitly addressed; direct chats still work.
- "Mute outbound notifications/messages" - reduce interruptions while preserving explicit interactions.
- "Pause agent" (strongest) - stop user-facing emissions; background continues via System Brain.
- "Queue until quiet hours end" vs "Drop/skip" (behaviorDuringQuietHours).

Future extension (scoped, not implemented):
- A “quiet notifications” layer that suppresses *delivery* (UI/email/push) of certain event types until quiet hours end, without stopping background work.

### System Brain (main agent)
- Model for System Brain “SDK” behavior:
  - `agents.main.sdk.model`
- System Brain thinking budget (provider-dependent):
  - `agents.main.sdk.thinkingBudget`

### Tools / Permissions
Tools have both “simple” and “power” modes. Docs must assume all exist even if the UI ships progressively.
- Global tool policy: `tools.*`
- Per-agent tool policy overrides: `agents.list[].tools.*`

Toolsets (web UX concept):
- In `apps/web/` today, toolsets are managed in web state + persisted locally (prototype).
- The planned direction is gateway-backed CRUD via RPC (see toolset plan docs in `apps/web/docs/plans/`).

### UI Power User Mode (web-only preference)
- `useUIStore.powerUserMode` (persisted in `apps/web/src/stores/useUIStore.ts`)

---

## Provider/Runtime Capability Gating (Design Requirement)

The web UI must only display “power knobs” when they are supported by the selected **runtime** and/or **model provider/model**.

Design requirement:
- The system must include a **capabilities declaration** per model and (where relevant) per runtime.
- The UI reads that declaration and gates controls accordingly (show/hide/disable + explanation).

Recommended approach (implementation detail for future subagents):
- Extend the model catalog data returned to the web UI to include a `compat`/`capabilities` object per model, e.g.:
  - `supportsTemperature`, `supportsTopP`, `supportsTopK`, `supportsStopSequences`
  - `supportsReasoningEffort` / “speed vs depth” style controls
  - `maxTokensField` mapping for provider APIs (already exists in core config types)
- Add runtime capability flags for `pi` vs `claude` where behavior differs.

---

## Naming + Copy Style (Canonical)

### Rules
- **Primary UI uses friendly labels**; technical terms appear in tooltips and in Expert Mode.
- **Title Case** for section titles and page titles (e.g. “Model & Provider”).
- **Sentence case** for helper text and descriptions.
- Labels should be **nouns or noun phrases** (not verbs): “Creativity”, “Response length”, “Quiet hours”.
- Toggles should be phrased as **states** (not actions): “Streaming replies” (not “Enable streaming”).
- Avoid absolute language in marketing/competitive claims (“only”, “none”, “unique”). Prefer: “we focus on”, “we aim to”, “we’re building toward”.

### Canonical label set (examples)
- `temperature` (internal param key): **Creativity**
- `maxTokens` (internal param key): **Response length**
- `agents.defaults.runtime`: **Default runtime**
- `agents.main.*`: **System Brain**
- `tools.elevated.enabled`: **Elevated mode**
- `agents.defaults.blockStreamingDefault`: **Streaming replies**
