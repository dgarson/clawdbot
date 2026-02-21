# Agent Config UX - Copy, Labels, Tooltips

This document provides user-facing text for the new configuration UX. Use these strings directly or adapt slightly for final UI.

---

## Global Terms and Mappings

- Creativity = Temperature
- Response length = Max tokens
- Memory cleanup = Context pruning
- Summarize long chats = Compaction
- Streaming replies = Block streaming
- Agent runtime = Pi or Claude Code SDK

---

## Model & Provider Page

### Page Title + Subtitle
- Title: "Model & Provider"
- Subtitle: "Set the default runtime and model providers for all agents."

### Runtime Card
- Title: "Default Agent Runtime"
- Helper: "Pi keeps conversation memory. Claude Code SDK is stateless but fast."
- Option label: "Pi (recommended)"
- Option label: "Claude Code SDK (advanced)"

### System Brain Card
- Title: "System Brain"
- Helper: "Used for always-on replies and system tasks when no specific agent is chosen."
- Fields:
  - "Runtime"
  - "Model / Provider"
  - "CCSDK provider" (only when runtime is SDK)

### Heartbeat Card
- Title: "Heartbeat"
- Helper: "Scheduled check-ins that keep an eye on ongoing work."
- Fields:
  - "Schedule"
  - "Active hours"
  - "Heartbeat model"
- Experimental:
  - "Escalate low-confidence items to System Brain" (future)

### Providers & Auth
- Section title: "Providers & Auth"
- Section helper: "Connect providers once. Agents can use them immediately."

Provider card labels:
- Status: "Connected" / "Missing key" / "Needs sign-in"
- Button: "Connect" / "Edit" / "Test"
- Auth mode label: "Authentication"
- Auth options:
  - "API key"
  - "OAuth sign-in"
  - "Token"
  - "AWS SDK"

API key fields:
- Label: "API key"
- Placeholder: "Paste your key"
- Button: "Test connection"
- Error: "This key is invalid or expired."

OAuth flow:
- Button: "Sign in"
- Helper: "Open the link and enter the code to finish connecting."

CLI pairing:
- Title: "Connect from your local machine"
- Helper: "Use this if your Clawdbrain server cannot open a browser."
- Command label: "Run this command"
- Pairing code label: "Pairing code"

Advanced provider options:
- "Base URL"
- "Headers"
- "Max concurrent requests"

### Default Models & Fallbacks
- Section title: "Default Models"
- Text model label: "Default text model"
- Image model label: "Default image model"
- Fallbacks label: "Fallbacks"
- Fallbacks helper: "Used in order if the default model is unavailable."

### Global Behavior
- Section title: "Global Behavior"
- Streaming toggle label: "Streaming replies"
- Creativity label: "Creativity"
- Creativity helper: "Lower is more precise. Higher is more creative."
- Response length label: "Response length"
- Response length helper: "Higher allows longer replies."

Advanced behavior:
- "Streaming boundary"
- "Chunk size"
- "Coalesce streamed replies"
- "Human-like delay"

---

## Agent Detail Pages

### Overview
- Section title: "Identity"
- Name label: "Agent name"
- Role label: "Role"
- Description label: "Short description"
- Purpose label: "What should this agent be good at?"

### Behavior
- Section title: "Behavior"
- Creativity label: "Creativity"
- Response length label: "Response length"
- Streaming label: "Streaming replies"
- Speed vs Depth label: "Speed vs depth"
- Speed vs Depth helper: "Faster replies or deeper reasoning."
- Use default toggle: "Use system default"

Advanced behavior:
- "Model override"
- "Runtime override"
- "CCSDK provider override"

### Tools & Permissions
- Section title: "Tools"
- Tool profile label: "Tool profile"
- Tool profiles:
  - "Minimal" (read-only, safest)
  - "Messaging" (send/respond only)
  - "Coding" (read/write + dev tools)
  - "Full" (everything allowed)

Capability toggles:
- "Messages" - "Send messages on your behalf"
- "Web research" - "Search and fetch from the web"
- "Files" - "Read and edit local files"
- "Calendar" - "Create or edit events"
- "System commands" - "Run shell commands"

Advanced tools:
- "Allow list"
- "Deny list"
- "Elevated mode approvals"
- "Exec settings"

### Memory
- Section title: "Memory"
- Toggle label: "Memory"
- Memory depth label: "Memory depth"
- Memory depth helper: "Controls how much past context is kept."

Advanced memory:
- "Memory cleanup"
- "Summarize long chats"
- "Memory search provider"

### Availability
- Section title: "Availability"
- Quiet hours label: "Quiet hours"
- Toggle label: "Auto-pause outside quiet hours"
- Time zone label: "Time zone"

Advanced availability:
- "Heartbeat schedule"
- "Heartbeat target"
- "Heartbeat prompt"

### Advanced Tab
- "Raw config"
- "Sandbox controls"
- "Group chat settings"
- "Sub-agent defaults"

---

## Error / Empty States

- No providers connected:
  - Title: "Connect a model provider"
  - Helper: "You need at least one provider before agents can respond."
  - Buttons: "Connect provider" / "Learn about models"

- Invalid setting:
  - "This setting is invalid. Reset to default?"

- Provider offline:
  - "Provider is unreachable. Check your network or try again later."

---

## Warnings / Risk Copy

- Elevated tools:
  - "This allows powerful actions. Only enable for trusted agents."

- Exec tool:
  - "System commands can modify your machine. Use with care."

- Sandbox disabled:
  - "Disabling the sandbox allows direct access to your workspace."
