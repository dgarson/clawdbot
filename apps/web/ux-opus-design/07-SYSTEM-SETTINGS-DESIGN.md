# System Settings Design

> Model & Provider page specification

This document details the system-wide settings page that configures defaults for all agents.

**Canonical keys/terms + scope boundary:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

---

## Page Overview

**Route:** `/settings?section=model-provider`
**Component:** `ModelProviderSection.tsx` (existing, needs extension)

**Purpose:** Configure the runtime, providers, default models, and global behavior that all agents inherit.

---

## Section 1: Default Agent Runtime

**Config path:** `agents.defaults.runtime`

```
┌─────────────────────────────────────────────────────────────────┐
│ Default Agent Runtime                                           │
│ Choose the engine that powers your agents.                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ○ Pi (recommended)                                             │
│    Keeps conversation memory between messages.                  │
│    Best for ongoing conversations and personal assistants.      │
│                                                                 │
│  ○ Claude Code SDK                                              │
│    Stateless but faster for single tasks.                       │
│    Best for one-off requests and automation.                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- Radio button group with descriptive labels
- Selected option should have visual emphasis
- Change triggers config patch to `agents.defaults.runtime`

---

## Section 2: System Brain

**Config path:** `agents.main.*`

```
┌─────────────────────────────────────────────────────────────────┐
│ System Brain                                              [?]   │
│ System-level intelligence for system tasks and fallback         │
│ responses when no specific agent is selected.                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Runtime                                                        │
│  [Use system default (Pi) ▼]                                    │
│                                                                 │
│  Model / Provider                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Provider            │  │ Model               │              │
│  │ [Anthropic     ▼]   │  │ [Claude Sonnet  ▼]  │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ▶ Advanced                                                     │
│    └── CCSDK provider override (when SDK runtime)              │
│    └── Custom instructions for system brain                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- This card doesn't exist currently — needs to be added
- Runtime dropdown: "Use system default (Pi)" + explicit options
- Provider/Model: Cascading dropdowns (provider first, then models for that provider)
- Advanced section collapsed by default

---

## Section 3: Heartbeat Process

**Config path:** `agents.defaults.heartbeat.*`

```
┌─────────────────────────────────────────────────────────────────┐
│ Heartbeat                                                 [?]   │
│ Scheduled check-ins that monitor ongoing work and can           │
│ perform background tasks.                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Schedule                                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Every               │  │ Active hours        │              │
│  │ [30 minutes    ▼]   │  │ [9am - 6pm      ▼]  │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  Heartbeat model                                                │
│  A lighter model can reduce costs for routine check-ins.        │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Provider            │  │ Model               │              │
│  │ [Anthropic     ▼]   │  │ [Claude Haiku  ▼]   │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ▶ Experimental                                                 │
│    └── [  ] Escalate low-confidence items to System Brain      │
│             When the heartbeat is unsure, ask the System       │
│             Brain to continue the work.                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- This card doesn't exist currently — needs to be added
- Schedule: Dropdown with preset intervals (15m, 30m, 1h, 2h, 4h, daily)
- Active hours: Time range picker or preset options
- Heartbeat model: Can be different (cheaper) than main model
- Experimental section with feature flag awareness

---

## Section 4: Providers & Auth

**Config path:** `auth.*`, `models.providers.*`

### MVP Support Matrix (Model Providers)

This matrix is for **model providers only**.
Channels and other Connections may also support OAuth; they must reuse the same auth patterns and UI primitives described below.

Legend:
- ✅ = supported in MVP
- 🔶 = partial / phased (UI present, backend incomplete)
- ❌ = not in MVP

Auth method families (canonical):
- **API key / Token**: paste a token into the UI.
- **OAuth (browser)**: web UI can open a browser window/tab to complete OAuth.
- **OAuth (device code)**: show a code + URL, user completes auth elsewhere.
- **Pair from local machine**: generate a pairing code in the web UI, complete the flow via CLI on a machine that can open a browser.

MVP provider set (by user decision, 2026-02-02):
- OpenAI, Anthropic, Gemini
- OpenRouter, Z.AI
- Azure OpenAI, Bedrock, Vertex AI

| Provider | API key | Token(s) / Cloud creds | Service account JSON | OAuth (browser) | OAuth (device code) | Pair from local machine | Platforms supported |
|----------|---------|------------------------|----------------------|----------------|----------------------|-------------------------|--------------------|
| OpenAI | ✅ | ❌ | ❌ | ✅ | 🔶 | ✅ | Browser UI + headless gateway via pairing |
| Anthropic | ✅ | ❌ | ❌ | ✅ | 🔶 | ✅ | Browser UI + headless gateway via pairing |
| Gemini | ✅ | ❌ | ❌ | ✅ | 🔶 | ✅ | Browser UI + headless gateway via pairing |
| OpenRouter | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | Browser UI + headless gateway via pairing |
| Z.AI | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | Browser UI + headless gateway via pairing |
| Azure OpenAI | ✅ | 🔶 | ❌ | ❌ | ❌ | ✅ | Browser UI + headless gateway via pairing |
| Bedrock | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | Browser UI + headless gateway via pairing |
| Vertex AI | ❌ | 🔶 | ✅ | ✅ | 🔶 | ✅ | Browser UI + headless gateway via pairing |

Notes:
- OAuth (browser) is a target MVP for OpenAI/Anthropic/Gemini when possible.
- A headless gateway is not inherently a blocker for OAuth (browser) because OAuth happens in the user’s browser; the key requirement is a reachable callback endpoint and secure server-side token storage.
- “Pair from local machine” is required for headless deployments when callbacks are not reachable or provider apps are misconfigured.

Canonical cross-integration auth UX (Providers + Channels + Connections):
- `apps/web/docs/plans/2026-02-01-auth-oauth-pairing-secrets-and-errors.md`

```
┌─────────────────────────────────────────────────────────────────┐
│ Providers & Auth                                                │
│ Connect model providers once. Agents can use them immediately.  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ● Anthropic     │  │ ○ OpenAI        │  │ ○ Google        │ │
│  │   Connected     │  │   Missing key   │  │   Missing key   │ │
│  │   Claude Sonnet │  │                 │  │                 │ │
│  │   [Edit]        │  │   [Connect]     │  │   [Connect]     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ○ OpenRouter    │  │ ○ Z.AI          │  │ ○ Azure OpenAI  │ │
│  │   Not configured│  │   Not configured│  │   Not configured│ │
│  │                 │  │                 │  │                 │ │
│  │   [Connect]     │  │   [Connect]     │  │   [Connect]     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ○ Bedrock       │  │ ○ Vertex AI     │  │ + Add Provider  │ │
│  │   Not configured│  │   Not configured│  │                 │ │
│  │                 │  │                 │  │                 │ │
│  │   [Connect]     │  │   [Connect]     │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Provider Card (Expanded/Edit State)

```
┌─────────────────────────────────────────────────────────────────┐
│ Anthropic                                           [Test] [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Authentication                                                 │
│  ○ API key                                                      │
│  ○ OAuth sign-in (Claude Max)                                   │
│                                                                 │
│  API key                                                        │
│  [sk-ant-api03-...................................] [👁] [📋]   │
│                                                                 │
│  ✓ Connected — Last tested 2 hours ago                         │
│                                                                 │
│  Default model for this provider                                │
│  [Claude Sonnet 4 ▼]                                            │
│                                                                 │
│  ▶ Advanced                                                     │
│    └── Base URL: https://api.anthropic.com                     │
│    └── Custom headers: [...]                                   │
│    └── Max concurrent requests: [10]                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Alternative: Connect from your local machine                   │
│  Use this if your Clawdbrain server cannot open a browser.      │
│                                                                 │
│  Run this command:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ clawdbrain auth pair --provider anthropic               │ [📋]│
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Pairing code: ABC-123-XYZ                         [Refresh]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- Provider cards already exist in `ModelProviderSection.tsx`
- Need to add CLI pairing option (requires backend)
- OAuth (browser) flow should be implemented for OpenAI/Anthropic/Gemini (requires gateway endpoints + callback handling); device code is post-MVP.

### Secrets Handling Requirements (MVP)

The MVP must treat provider credentials as sensitive secrets everywhere in the UI:
- Mask by default (never render the full value after initial entry).
- Reveal affordance: explicit reveal action with clear risk copy; log an audit event on reveal.
- Copy affordance: copy-to-clipboard button with a warning and an audit event on copy.
- No "secret echo": after saving, the UI can show metadata (connected status, last tested), but not the secret value.
- Preserve drafts on failures: save/test failures must not wipe the user's input.

Canonical requirements and unhappy cases:
- `apps/web/docs/plans/2026-02-01-auth-oauth-pairing-secrets-and-errors.md`

### Explicit Error States (MVP)

The MVP must explicitly design and implement these failure states (do not collapse into generic toasts):
- Save failed: inline field error (when known) + page-level banner with retry.
- Test failed: provider-specific error summary, preserve drafts, link to logs (if available).
- Models list fetch failed: inline error with retry + fallback to manual model id entry in Expert Mode.

---

## Control Outcomes + Guardrails (MVP)

Each control must be tied to a user-facing outcome, with recommended ranges and safe defaults. The UI must avoid presenting “mystery knobs”.

### Creativity (internal: `temperature`)
- User outcome: “more precise vs more creative wording”
- Recommended range: 0.0 - 1.0
- Guardrails:
  - Presets: Precise (0.2), Balanced (0.5), Creative (0.8)
  - Show warnings when set extremely low/high for long-running agents

### Response length (internal: `maxTokens`)
- User outcome: “shorter vs longer replies”
- Guardrails:
  - Must be capped by the selected model’s max output tokens (provider capability data)
  - Provide presets (e.g. 512/1024/2048/4096) and show the numeric value in Expert Mode

### Streaming replies (internal: `agents.defaults.blockStreamingDefault`)
- User outcome: “see responses as they are generated”
- Guardrails:
  - Default on for perceived responsiveness
  - If streaming is disabled, explain: “responses arrive all at once”

---

## Section 5: Default Models & Fallbacks

**Config path:** `agents.defaults.model.*`, `agents.defaults.imageModel.*`

```
┌─────────────────────────────────────────────────────────────────┐
│ Default Models                                                  │
│ Models used when agents don't specify their own.                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Default text model                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Provider            │  │ Model               │              │
│  │ [Anthropic     ▼]   │  │ [Claude Sonnet  ▼]  │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  Default image model                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Provider            │  │ Model               │              │
│  │ [OpenAI        ▼]   │  │ [DALL-E 3      ▼]   │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ▶ Fallbacks                                                    │
│    Used in order if the default model is unavailable.           │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ 1. [≡] GPT-4                                        [×] │ │
│    │ 2. [≡] Gemini Pro                                   [×] │ │
│    │ 3. [≡] Claude Haiku                                 [×] │ │
│    │    [+ Add fallback]                                     │ │
│    └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▶ Advanced                                                     │
│    └── Model aliases                                           │
│    └── Model routing rules                                     │
│    └── Provider-specific parameters                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- Default model selectors likely exist
- Fallbacks drag list is missing — needs new component
- Advanced model options may be partially implemented

---

## Section 6: Global Behavior

**Config path:** `agents.defaults.blockStreamingDefault`, etc.

```
┌─────────────────────────────────────────────────────────────────┐
│ Global Behavior                                                 │
│ Default behaviors inherited by all agents.                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Streaming replies                                       [ON]   │
│  Show responses as they're generated.                           │
│                                                                 │
│  Creativity                                               [?]   │
│  Lower is more precise. Higher is more creative.                │
│  ────────────●────────────────────────────── 0.7                │
│  Precise                                          Creative      │
│                                                                 │
│  Response length                                          [?]   │
│  Higher allows longer replies.                                  │
│  ──────────────────────●────────────────────                    │
│  Short          Medium          Long          Very Long         │
│                                                                 │
│  ▶ Advanced                                                     │
│    └── Streaming boundary (message end / paragraph)            │
│    └── Chunk size: [50] characters                             │
│    └── [  ] Combine small chunks                               │
│    └── Human-like delay: [Off ▼]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- These controls don't exist with friendly labels
- Creativity/Response length need slider components
- Maps to internal params `temperature` and `maxTokens` in config (provider APIs may use different field names)

---

## Save Behavior

### Auto-Save vs Manual Save

**Recommendation:** Auto-save with debounce + visual feedback

```
┌─────────────────────────────────────────────────────────────────┐
│ Model & Provider                          ✓ All changes saved   │
└─────────────────────────────────────────────────────────────────┘

       ↓ (while typing/changing) ↓

┌─────────────────────────────────────────────────────────────────┐
│ Model & Provider                                ● Saving...     │
└─────────────────────────────────────────────────────────────────┘

       ↓ (on error) ↓

┌─────────────────────────────────────────────────────────────────┐
│ Model & Provider              ⚠️ Failed to save  [Retry] [Undo] │
└─────────────────────────────────────────────────────────────────┘
```

### Validation

- API key validation: Inline test on blur
- Required fields: Prevent save if missing
- Invalid values: Show inline error, allow save of valid fields

---

## Component Structure

```
ModelProviderSection.tsx
├── RuntimeCard               ← Extend existing
├── SystemBrainCard           ← NEW
├── HeartbeatCard             ← NEW
├── ProvidersGrid
│   └── ProviderCard (multiple)
├── DefaultModelsCard
│   ├── TextModelSelector
│   ├── ImageModelSelector
│   └── FallbacksList        ← NEW (drag-to-reorder)
└── GlobalBehaviorCard       ← NEW
    ├── StreamingToggle
    ├── CreativitySlider
    ├── ResponseLengthSlider
    └── AdvancedAccordion
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Action                              │
│                    (change a setting)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Local State Update                          │
│               (optimistic UI update)                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   useConfigMutations.patchConfig()               │
│                 (debounced API call)                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway API                                 │
│              PATCH /api/config                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Query Cache Invalidation                       │
│              useConfig() refetches                               │
└─────────────────────────────────────────────────────────────────┘
```
