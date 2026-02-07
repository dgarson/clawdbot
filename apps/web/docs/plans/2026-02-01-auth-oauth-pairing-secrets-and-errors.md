# Auth UX: OAuth, Pairing, Secrets, and Error States (apps/web)

**Date:** 2026-02-01
**Status:** Draft (Design Requirements)
**Applies to:** Model Providers, Channels, and Connections in `apps/web/`

This document defines the **canonical auth UX** and the supporting UX requirements for:
- OAuth flows (browser + device code where applicable)
- Pairing flows for headless gateways (“pair from local machine”)
- Secrets handling (mask/reveal/copy/audit)
- Explicit error states (save/test/models list failures)

Canonical keys/terms: `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`.

## 1) Auth Method Families (Canonical)

All integrations must map onto one or more of these auth families:

1) **API key**
   - A single secret string used for service authentication.

2) **Token(s)**
   - Bot/app tokens or multiple related secrets (e.g. Slack bot token + app token).
   - Also covers cloud credential pairs where applicable (e.g. AWS access key + secret).

3) **OAuth (browser)**
   - Web UI initiates OAuth in the user’s browser (redirect/popup), then returns with a success/failure result.

4) **OAuth (device code)**
   - Web UI displays a code + URL; user completes auth in another device/browser.

5) **QR / Device link**
   - Web UI shows a QR code the user scans (e.g. WhatsApp web-style).

6) **Pair from local machine** (required fallback)
   - Web UI displays a pairing code and a CLI command; user completes auth on a machine that can open a browser.

7) **Service account / JSON credential**
   - A structured credential blob (e.g. Google service account JSON) uploaded/pasted into the UI.

## 2) MVP Support Matrix (Integration x Auth x Platform)

Legend:
- ✅ = supported in MVP
- 🔶 = phased (UI present but may be backend-limited)
- ❌ = not supported

Platforms:
- **Browser UI + local gateway**: user runs gateway locally; browser can open OAuth.
- **Browser UI + remote/headless gateway**: gateway cannot open a browser; pairing required.

### 2.1 Model Providers (MVP subset)

MVP provider set includes:
- OpenAI, Anthropic, Gemini
- OpenRouter, Z.AI
- Azure OpenAI, Bedrock, Vertex AI

| Provider | API key | Token(s) / Cloud creds | Service account JSON | OAuth (browser) | OAuth (device code) | Pair from local machine | Platforms |
|----------|---------|------------------------|----------------------|----------------|----------------------|-------------------------|----------|
| OpenAI | ✅ | ❌ | ❌ | ✅ | 🔶 | ✅ | local + headless via pairing |
| Anthropic | ✅ | ❌ | ❌ | ✅ | 🔶 | ✅ | local + headless via pairing |
| Gemini | ✅ | ❌ | ❌ | ✅ | 🔶 | ✅ | local + headless via pairing |
| OpenRouter | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | local + headless via pairing |
| Z.AI | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | local + headless via pairing |
| Azure OpenAI | ✅ | 🔶 | ❌ | ❌ | ❌ | ✅ | local + headless via pairing |
| Bedrock | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | local + headless via pairing |
| Vertex AI | ❌ | 🔶 | ✅ | ✅ | 🔶 | ✅ | local + headless via pairing |

Notes:
- OAuth (browser) is the target MVP for OpenAI/Anthropic/Gemini when possible.
- If Vertex OAuth (browser) is supported, it should follow the same gateway-terminated callback pattern as other OAuth providers (no special “headless” complexity beyond callback reachability).
- “Headless gateway” is not inherently a blocker for OAuth (browser) because OAuth occurs in the user’s browser; the key requirements are correct callback hosting and secure server-side token storage (see Section 6).
- Azure OpenAI and Bedrock often authenticate via cloud credentials rather than consumer OAuth; ship with keys/creds first.

### 2.2 Channels (current `apps/web` surfaces)

| Channel | Token | OAuth (browser) | QR / device link | Pair from local machine | Notes |
|---------|-------|------------------|------------------|-------------------------|------|
| Telegram | ✅ | ❌ | ❌ | ❌ | bot token flow |
| Discord | ✅ | 🔶 | ❌ | ✅ | OAuth install flow optional; token supported |
| Slack | ✅ | ✅ | ❌ | ✅ | OAuth install recommended; tokens as fallback |
| WhatsApp (web) | ❌ | ❌ | ✅ | ❌ | QR scan flow |

### 2.3 Connections (current `apps/web` surfaces)

| Connection | OAuth (browser) | API key / token fallback | Pair from local machine | Notes |
|------------|------------------|--------------------------|-------------------------|------|
| GitHub | ✅ | ✅ (PAT) | ✅ | OAuth recommended; PAT supported |
| Google | ✅ | ✅ (service account JSON) | ✅ | OAuth recommended; service account supported |
| Slack | ✅ | ✅ (tokens) | ✅ | OAuth recommended; tokens supported |
| Notion | ✅ | ✅ (integration token) | ✅ | OAuth recommended |
| Linear | ✅ | ✅ (API key) | ✅ | OAuth recommended |
| Discord | ✅ | ✅ (bot token) | ✅ | OAuth install flow optional |

## 3) Canonical UX Flows

### 3.1 Connect (happy path)
- User clicks **Connect**.
- User selects auth method (default to recommended).
- User completes auth (OAuth/token/api key/QR).
- UI shows:
  - Connected status
  - “Last tested” timestamp (if test exists)
  - What capabilities are now enabled (models list available, channel routing enabled, etc.)

### 3.2 Headless fallback: Pair from local machine

When the gateway cannot open a browser, the UI must provide:
- A pairing code
- A short explanation of when/why this is needed
- A copyable CLI command

Example command shape (illustrative):
```bash
clawdbrain auth pair --provider <providerId>
```

### 3.3 Re-auth / token rotation
- Provide “Re-authenticate” / “Replace token” action.
- Never require the user to disconnect first.

### 3.4 Disconnect
- Confirmation dialog with consequences:
  - Which features will stop working
  - Whether the system will fallback to another provider

### 3.5 Test connection
- Test is explicit (button) or implicit (on blur), but must show:
  - Success/failure
  - Safe error message (no secret leakage)
  - Retry

## 4) Secrets Handling (MVP Requirements)

### 4.1 Secret Field UX (canonical behavior)
- Mask secrets by default.
- Provide explicit “reveal” affordance; default to reveal-on-hold when possible.
- Provide explicit “copy secret” action with warning text.
- Never include secrets in logs, screenshots, or diagnostic exports.

### 4.2 Audit Events (design requirement)
At minimum, record events for:
- secret updated (provider/channel/connection id + field id)
- connection established
- connection disconnected

Whether to record “reveal” and “copy” events is a security posture decision; if recorded, it must be communicated to users.

## 5) Explicit Error States (MVP Requirements)

These must be designed and implemented consistently across all config surfaces:

1) **Save failed**
   - UI must indicate whether the displayed value is saved or only local.
   - Provide: Retry, Undo, Copy changes to clipboard.

2) **Test failed**
   - Show safe error message + next steps.
   - Provide: Retry test, Edit credentials.

3) **Models list fetch failed**
   - Distinguish “cannot load” from “none available”.
   - Provide: Retry, and allow saving unrelated fields.

Integration with edge case inventory:
- `apps/web/ux-opus-design/EDGE-CASES.md`

---

## 6) Headless Cloud Deployments (Non-Optimistic)

Scenario: the gateway runs in a containerized, headless environment in the cloud. The user interacts via the web UI in their browser.

Key clarification: **OAuth “headless” is mostly a non-issue when the user has a browser**, because OAuth happens in the user’s browser, not in the server container. The real constraints are:
- Where the OAuth redirect/callback endpoint lives
- How tokens are securely stored and associated to the correct gateway/workspace
- How we handle failures, pop-up blocking, and misconfiguration

### 6.1 Recommended Architecture (canonical)

OAuth should terminate on the **gateway** (not the web UI) whenever secrets/tokens must be stored server-side.

Flow (browser UI + cloud gateway):
1) User clicks “Continue with <Provider>” in the web UI.
2) The web UI opens the gateway’s OAuth start endpoint (same origin as gateway API).
3) Provider redirects the user back to the gateway’s OAuth callback URL.
4) Gateway exchanges code for token and stores it securely.
5) Gateway returns a success result to the web UI (polling or redirect back to web UI route).

This keeps client secrets out of the web UI and avoids “tokens in the browser” as a primary storage model.

### 6.2 When Pairing Is Still Required

Pairing (“pair from local machine”) is required when either:
- The gateway is not reachable from the user’s browser for callbacks (private network), OR
- The provider requires a local sign-in path that cannot be completed against the deployed gateway environment, OR
- The OAuth redirect cannot be configured for the gateway domain (misconfigured provider app).

In those cases:
- The web UI must provide a pairing code + CLI command.
- The local CLI completes OAuth in a local browser and transfers tokens to the gateway using the pairing code.

### 6.3 Unhappy Cases (must be handled explicitly)

1) **Pop-up blocked**
   - Offer “Open in a new tab” fallback.
   - Offer device code flow when supported.

2) **Redirect URI mismatch**
   - Show a friendly error explaining that the provider app is misconfigured.
   - Provide the exact redirect URI that must be added (copyable).

3) **Gateway not publicly reachable**
   - Detect callback failures/timeouts and present Pairing fallback.

4) **Token storage fails**
   - Show save failure UI + retry.
   - Ensure partial tokens are not left in an inconsistent state.

5) **State/CSRF mismatch**
   - Abort and require restart; explain possible causes (multiple tabs, stale session).

6) **Scopes insufficient**
   - Test should fail with a clear “missing scope” message + re-auth CTA.

7) **Clock skew / expired device code**
   - Show “expired, request a new code” UI.
