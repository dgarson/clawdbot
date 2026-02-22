# OAuth Integration Spec — New UI Frontend

**Author:** Merlin (Main Agent)
**Date:** 2026-02-21
**Priority:** HIGH — David explicitly requested this
**Context:** The CLI already has full OAuth flows for model providers. The new UI must expose them via the Gateway WebSocket RPC.

---

## Overview

OpenClaw supports multiple model providers that authenticate via OAuth. The CLI handles these flows interactively (browser redirect + localhost callback), but the new web UI needs to drive the same flows via Gateway RPC methods.

There are **two distinct auth systems** to wire in:

### 1. Provider Auth (Model API OAuth) — via `wizard.*` Gateway RPC
These are OAuth flows for authenticating with AI model providers. They use the **wizard** subsystem which provides a step-by-step interactive flow over WebSocket.

**Providers with OAuth:**
| Provider | Plugin ID | Auth Kind | Flow |
|----------|-----------|-----------|------|
| **MiniMax** | `minimax-portal-auth` | `device_code` | Browser opens MiniMax portal → user signs in → tokens returned |
| **Qwen** | `qwen-portal-auth` | `device_code` | Device code flow → user opens URL, enters code |
| **Google Gemini CLI** | `google-gemini-cli-auth` | `oauth` | PKCE + localhost:51121 callback |
| **Google Antigravity** | `google-antigravity-auth` | `oauth` | PKCE + localhost:51121 callback |
| **OpenAI Codex** | (built-in) | `oauth` | Browser opens OpenAI → localhost:1455 callback |
| **Chutes** | (built-in) | `oauth` | Browser opens Chutes → localhost:1456 callback |

**Other auth methods (non-OAuth):**
| Provider | Method | How |
|----------|--------|-----|
| **Anthropic** | `token` | User runs `claude setup-token`, pastes token |
| **OpenAI** | `api_key` | User pastes `OPENAI_API_KEY` |
| **Copilot Proxy** | `custom` | User enters base URL + model IDs |

### 2. Channel Auth (WhatsApp QR Login) — via `web.login.start/wait`
This is specifically for linking WhatsApp Web via QR code scanning.

**Gateway Methods:**
- `web.login.start` → Returns `{ qrDataUrl, message }` — a base64 PNG of the QR
- `web.login.wait` → Polls until scan completes → Returns `{ connected, message }`

---

## Gateway RPC Methods for Provider Auth

### The Wizard System (`wizard.*` — ADMIN scope)

The wizard is the correct mechanism for driving provider auth from the UI. It wraps the CLI's interactive onboarding into a WebSocket-driven step-by-step protocol.

**Methods:**
1. **`wizard.start`** — Start a wizard session
   - Params: `{ mode: "add-provider" | "onboard" | ..., workspace?: string }`
   - Returns: `{ sessionId, done, step?, status?, error? }`
   - The `step` object contains the current prompt (text input, select, confirm, note, etc.)

2. **`wizard.next`** — Submit answer and get next step
   - Params: `{ sessionId, answer?: { stepId, value } }`
   - Returns: `{ done, step?, status?, error? }`
   - Keep calling until `done: true`

3. **`wizard.cancel`** — Cancel an in-progress wizard
   - Params: `{ sessionId }`

4. **`wizard.status`** — Check wizard session status
   - Params: `{ sessionId }`

### Wizard Step Types (from WizardPrompter)
The wizard renders these step types that the UI must handle:
- **`text`** — Text input (API keys, tokens, URLs)
- **`select`** — Single selection from options (provider choice, auth method)
- **`confirm`** — Yes/no confirmation
- **`note`** — Informational message (show to user, no input needed)
- **`progress`** — Loading/progress indicator

### Auth Profile Config (`config.*` — ADMIN scope)
- **`config.get`** (READ scope) — Read current config including `auth.profiles`
- **`config.set`** (ADMIN scope) — Update config (the wizard does this automatically)

### Model Provider Info (`models.list` — READ scope)
- Returns available models with provider info — use to show which providers are configured

---

## UI Implementation Plan

### New View: Provider Auth Manager (`src/views/ProviderAuthManager.tsx`)

**What it does:**
1. Shows a grid of available model providers with their auth status
2. "Connect" button launches the wizard flow for that provider
3. Renders wizard steps as a modal/dialog (text inputs, selects, confirms, progress)
4. Shows success/error on completion
5. Displays connected providers with refresh status

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Model Providers                                  │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Anthropic │ │ MiniMax  │ │ OpenAI   │         │
│ │ ✅ Token  │ │ ✅ OAuth │ │ 🔑 Key   │         │
│ │ [Manage]  │ │ [Manage] │ │ [Setup]  │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Gemini   │ │ Qwen     │ │ Chutes   │         │
│ │ ⚪ None  │ │ ⚪ None  │ │ ⚪ None  │         │
│ │ [Connect]│ │ [Connect]│ │ [Connect]│         │
│ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────┘
```

**Wizard Modal:**
```
┌─────────────────────────────────────────┐
│ Connect MiniMax                    [X]  │
│                                         │
│ Step 2 of 4                            │
│ ━━━━━━━━━━━━━○○                        │
│                                         │
│ Select authentication method:           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ○ MiniMax OAuth (Global)            │ │
│ │   Global endpoint - api.minimax.io  │ │
│ ├─────────────────────────────────────┤ │
│ │ ○ MiniMax OAuth (CN)                │ │
│ │   CN endpoint - api.minimaxi.com    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│              [Back]  [Continue]          │
└─────────────────────────────────────────┘
```

### Update: Onboarding Flow (`src/views/OnboardingFlow.tsx`)

The existing onboarding flow (step 2: "Connect Channel") should also include a step for connecting a model provider. This uses the same wizard protocol.

### Update: Settings Dashboard (`src/views/SettingsDashboard.tsx`)

Add a "Providers" or "Authentication" section that shows:
- Connected auth profiles from `config.get` → `auth.profiles`
- Status of each (active/expired/error)
- Re-authenticate button (launches wizard)
- Remove button

### WhatsApp QR Login (for Onboarding + Channel Settings)

Wire into the onboarding channel connection step and settings:

```typescript
// Start WhatsApp login
const startResult = await gateway.call('web.login.start', { 
  force: false,
  timeoutMs: 30000 
});
// startResult.qrDataUrl → render as <img src={qrDataUrl} />
// startResult.message → show instruction text

// Wait for scan
const waitResult = await gateway.call('web.login.wait', { 
  timeoutMs: 120000 
});
// waitResult.connected → true = success
// waitResult.message → show status
```

---

## Gateway WebSocket Client Usage

The existing `ui/src/ui/gateway.ts` already has the WebSocket client. The new UI needs a similar client. Key pattern:

```typescript
// Send RPC call
function callGateway(method: string, params: object): Promise<any> {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pendingCalls.set(id, { resolve, reject });
  });
}

// Usage for wizard:
const { sessionId, step } = await callGateway('wizard.start', { 
  mode: 'add-provider' 
});

// Render step, collect answer, then:
const next = await callGateway('wizard.next', { 
  sessionId, 
  answer: { stepId: step.id, value: userInput } 
});
```

---

## Auth Profile Data Shape

From `config.get`, the `auth.profiles` section looks like:

```json
{
  "minimax-portal:default": {
    "provider": "minimax-portal",
    "mode": "oauth"
  },
  "openai-codex:default": {
    "provider": "openai-codex",
    "mode": "oauth"  
  },
  "anthropic:default": {
    "provider": "anthropic",
    "mode": "token"
  }
}
```

The actual credentials (tokens, access keys) are stored separately in `auth-profiles.json` and are NOT exposed via config.get (security). The UI only sees the profile ID, provider, and mode.

---

## Files to Create/Modify

1. **CREATE** `src/views/ProviderAuthManager.tsx` — New provider auth management view
2. **CREATE** `src/hooks/useWizard.ts` — React hook for wizard step-through protocol
3. **CREATE** `src/hooks/useGateway.ts` — React hook for Gateway WebSocket RPC calls
4. **CREATE** `src/components/WizardModal.tsx` — Reusable wizard step renderer modal
5. **CREATE** `src/components/WhatsAppQrLogin.tsx` — WhatsApp QR code login component
6. **MODIFY** `src/views/OnboardingFlow.tsx` — Add provider auth step + WhatsApp QR
7. **MODIFY** `src/views/SettingsDashboard.tsx` — Add provider auth section
8. **MODIFY** `src/App.tsx` — Add ProviderAuthManager route
9. **MODIFY** `src/types/index.ts` — Add wizard/auth types

---

## Implementation Priority

1. `useGateway` hook + Gateway WS client (foundation for everything)
2. `useWizard` hook (drives all wizard flows)
3. `WizardModal` component (renders any wizard step)
4. `ProviderAuthManager` view (main auth management)
5. `WhatsAppQrLogin` component
6. Update OnboardingFlow + SettingsDashboard
