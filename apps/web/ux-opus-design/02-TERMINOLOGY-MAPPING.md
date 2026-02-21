# Terminology Mapping

> Technical terms → Friendly labels for the UI

This document defines the canonical mapping between Clawdbrain's **internal configuration keys** and user-friendly labels. Use these consistently across all UI surfaces.

Rules:
- Normalize on internal keys (e.g. `maxTokens`) rather than provider API field names (e.g. `max_tokens`).
- Provider API fields vary by provider/model (some use `max_tokens`, others `max_completion_tokens`). Those mappings are handled by model/provider compatibility metadata and must not leak into primary UI.

Canonical style rules and definitions:
- `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

---

## Core Mappings

### Model Parameters

These are internal param keys stored under model params (system defaults and per-agent overrides).

| Internal Key | Friendly Label | Helper Text | Visibility | Notes |
|--------------|----------------|-------------|------------|------|
| `temperature` | **Creativity** | Lower is more precise. Higher is more creative. | Basic (presets) + Expert (numeric) | Capability-gated by provider/model |
| `maxTokens` | **Response length** | Higher allows longer replies. | Basic (presets) + Expert (numeric) | Must be capped by model output limits |
| `topP` | **Focus** | Lower sticks to likely words. Higher explores alternatives. | Expert only | Capability-gated by provider/model |
| `topK` | **Vocabulary range** | Limits word choices per step. | Expert only | Capability-gated by provider/model |
| `stopSequences` | **Stop words** | Words that end the response early. | Expert only | Capability-gated by provider/model |

### Memory & Context

| Technical Term | Friendly Label | Helper Text | Notes |
|---------------|----------------|-------------|-------|
| `contextPruning` | **Memory cleanup** | Removes old context to stay within limits. | Toggle + mode selector |
| `contextPruning.mode` | **Cleanup mode** | How aggressively to trim old messages. | Dropdown |
| `contextPruning.ttl` | **Memory lifespan** | How long to keep old messages. | Duration picker |
| `compaction` | **Summarize long chats** | Condenses history to save space. | Toggle |
| `compaction.mode` | **Summary style** | How to condense conversation history. | Dropdown |
| `compaction.threshold` | **Summary trigger** | When to start summarizing. | Slider |
| `memorySearch` | **Memory search** | Search past conversations for context. | Toggle |
| `memorySearch.provider` | **Search provider** | Which service powers memory search. | Dropdown |

### Runtime & Execution

| Technical Term | Friendly Label | Helper Text | Notes |
|---------------|----------------|-------------|-------|
| `runtime` | **Agent runtime** | The engine that powers this agent. | Radio: Pi / Claude Code SDK |
| `runtime: pi` | **Pi (recommended)** | Keeps conversation memory between messages. | Default |
| `runtime: claude` | **Claude Code SDK** | Stateless but faster for single tasks. | Advanced |
| `ccsdkProvider` | **SDK provider** | Which AI provider to use with Claude Code SDK. | Dropdown |
| `sandbox` | **Sandbox** | Isolated environment for safe execution. | Toggle |
| `sandbox.scope` | **Sandbox scope** | What the agent can access. | Dropdown |
| `sandbox.workspaceAccess` | **Workspace access** | Files the agent can read/write. | Multiselect |

### Streaming & Output

| Technical Term | Friendly Label | Helper Text | Notes |
|---------------|----------------|-------------|-------|
| `blockStreamingDefault` | **Streaming replies** | Show responses as they're generated. | Toggle |
| `blockStreamingBoundary` | **Streaming boundary** | When to send partial responses. | Advanced dropdown |
| `blockStreamingChunkSize` | **Chunk size** | How much to send at once. | Advanced slider |
| `blockStreamingCoalesce` | **Combine chunks** | Merge small pieces into larger ones. | Advanced toggle |
| `humanDelay` | **Human-like delay** | Add pauses to feel more natural. | Advanced toggle |

### Tools & Permissions

| Technical Term | Friendly Label | Helper Text | Notes |
|---------------|----------------|-------------|-------|
| `tools.allow` | **Allowed tools** | Tools this agent can use. | Multiselect |
| `tools.deny` | **Blocked tools** | Tools this agent cannot use. | Multiselect |
| `tools.profile` | **Tool profile** | Preset permission level. | Chips |
| `elevated` | **Elevated mode** | Extra permissions for powerful actions. | Toggle with warning |
| `elevated.allowFrom` | **Elevated sources** | Who can trigger elevated mode. | Multiselect |
| `exec` | **System commands** | Run shell commands on your machine. | Toggle with warning |
| `exec.securityMode` | **Command safety** | How strictly to validate commands. | Dropdown |

### Scheduling & Availability

Note: `apps/web` currently has a **user settings** concept of quiet hours for notifications. Agent-level quiet hours policy is a planned feature and the exact config keys are still evolving; treat the entries marked “(proposed)” as design intent, not current source-of-truth keys.

| Technical Term | Friendly Label | Helper Text | Notes |
|---------------|----------------|-------------|-------|
| `heartbeat` | **Heartbeat** | Scheduled check-ins and background tasks. | Card |
| `heartbeat.schedule` | **Schedule** | How often to check in. | Cron-like picker |
| `heartbeat.target` | **Check-in target** | What to monitor during heartbeat. | Dropdown |
| `heartbeat.model` | **Heartbeat model** | AI model for background tasks. | Dropdown |
| `userSettings.notificationSettings.pauseDuringQuietHours` | **Pause during quiet hours** | Don't show notifications during quiet hours. | Exists today (UI-level settings) |
| `availability.quietHours` (proposed) | **Quiet hours** | Reduce interruptions and limit what agents can do during certain times. | Composition control + policy presets |
| `availability.quietHours.policy` (proposed) | **Quiet hours policy** | Choose what to limit during quiet hours. | Presets + Expert overrides |
| `availability.quietHours.schedule` (proposed) | **Quiet hours schedule** | When quiet hours apply. | Timezone-aware |
| `availability.quietHours.behaviorDuringQuietHours` (proposed) | **When quiet hours start** | Queue work, respond only when mentioned, or pause. | Depends on runtime semantics |

### System Components

| Technical Term | Friendly Label | Helper Text | Notes |
|---------------|----------------|-------------|-------|
| `agents.main` | **System Brain** | System-level intelligence for system tasks. | Card |
| `agents.defaults` | **System defaults** | Settings inherited by all agents. | Section |
| `model.primary` | **Default model** | Main AI model for text generation. | Dropdown |
| `model.fallbacks` | **Fallback models** | Backup models if primary is unavailable. | Drag list |
| `imageModel` | **Image model** | AI model for image generation. | Dropdown |

---

## Tool Profile Labels

| Profile ID | Label | Description | Risk Level |
|-----------|-------|-------------|------------|
| `minimal` | **Minimal** | Read-only tools only | Safe |
| `messaging` | **Messaging** | Send and respond to messages | Low |
| `coding` | **Coding** | Read/write files + dev tools | Medium |
| `full` | **Full Access** | Everything enabled | High |

---

## Tool Category Labels

| Category ID | Label | Icon Suggestion |
|------------|-------|-----------------|
| `files` | **Files & Documents** | 📄 |
| `code` | **Code & Development** | 💻 |
| `channels` | **Channels** | 💬 |
| `communication` | **Communication** | 📧 |
| `data` | **Data & Research** | 🔍 |
| `multimodal` | **Multi-Modality** | 🎨 |
| `other` | **Other Tools** | 🔧 |

---

## Status Labels

| Status Code | Label | Color | Description |
|------------|-------|-------|-------------|
| `connected` | **Connected** | Green | Provider is working |
| `missing_key` | **Missing key** | Yellow | API key not configured |
| `needs_signin` | **Needs sign-in** | Yellow | OAuth required |
| `error` | **Error** | Red | Connection failed |
| `active` | **Active** | Green | Agent is running |
| `paused` | **Paused** | Yellow | Agent is stopped |
| `suspended` | **Suspended** | Red | Agent is disabled |

---

## Warning & Risk Labels

| Situation | Label | Tone |
|-----------|-------|------|
| Elevated permissions enabled | **This allows powerful actions. Only enable for trusted agents.** | Cautionary |
| Exec tool enabled | **System commands can modify your machine. Use with care.** | Warning |
| Sandbox disabled | **Disabling the sandbox allows direct access to your workspace.** | Warning |
| Full tool profile | **This agent has access to all tools including system commands.** | Informational |

---

## Implementation Notes

### Creating a Label Utility

```typescript
// src/lib/terminology.ts

export const FRIENDLY_LABELS: Record<string, string> = {
  temperature: 'Creativity',
  maxTokens: 'Response length',
  contextPruning: 'Memory cleanup',
  // ... all mappings
};

export const HELPER_TEXT: Record<string, string> = {
  temperature: 'Lower is more precise. Higher is more creative.',
  maxTokens: 'Higher allows longer replies.',
  // ... all helper text
};

export function getFriendlyLabel(technicalTerm: string): string {
  return FRIENDLY_LABELS[technicalTerm] ?? technicalTerm;
}

export function getHelperText(technicalTerm: string): string | undefined {
  return HELPER_TEXT[technicalTerm];
}
```

### Usage in Components

```tsx
import { getFriendlyLabel, getHelperText } from '@/lib/terminology';

<FormField
  label={getFriendlyLabel('temperature')}
  helper={getHelperText('temperature')}
>
  <Slider min={0} max={1} step={0.1} />
</FormField>
```

---

## Localization Considerations

All labels should be extracted into a localization system for future i18n support. The mapping structure supports this:

```typescript
// Future: src/i18n/en/terminology.json
{
  "labels": {
    "temperature": "Creativity",
    "maxTokens": "Response length"
  },
  "helpers": {
    "temperature": "Lower is more precise. Higher is more creative."
  }
}
```

---

## Capability Gating (Required)

Power-user knobs must only appear when they are supported by the selected runtime and/or model provider/model.

Canonical requirement and approach:
- `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md` (Provider/Runtime Capability Gating)
