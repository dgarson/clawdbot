# Agent Config UX - Wireframes (Text)

These wireframes are text-first layouts that map directly to the structure in `DESIGN.md` and to config fields defined in:
- `src/config/types.agents.ts`
- `src/config/types.agent-defaults.ts`
- `src/config/types.tools.ts`
- `src/config/types.models.ts`

Use these as layout blueprints for implementation.

---

## A) Settings -> Model & Provider (System-Wide)

### Page Layout

[Header]
- Title: "Model & Provider"
- Subtitle: "Set the default runtime and model providers for all agents"
- Actions: "Save", "Test all connections"

[Section 1: Runtime]
- Card: Default Agent Runtime
  - Toggle radio: Pi (recommended) | Claude Code SDK (advanced)
  - Helper text

[Section 2: System Brain]
- Card: System Brain (advanced, but visible)
  - Runtime override (Pi vs SDK)
  - Model/provider override
  - CCSDK provider override (if runtime is SDK)
  - Helper: "Used for always-on replies and system tasks."

[Section 3: Providers & Auth]
- Grid of provider cards
  - Each card shows:
    - Provider name
    - Status (Connected / Missing key)
    - Default model (if set)
    - Actions: Connect / Edit / Test
  - Card expanded state contains:
    - Auth mode selector (API key / OAuth / token / AWS SDK)
    - Input field or OAuth flow CTA
    - One-time pairing (CLI) option (copy command + code)
    - Advanced (collapsed): base URL, headers, max concurrent

[Section 4: Default Models & Fallbacks]
- Card: "Default text model"
  - Provider dropdown -> model dropdown
  - Fallbacks (collapsed by default): drag list
- Card: "Default image model"
  - Provider dropdown -> model dropdown
  - Fallbacks (collapsed by default): drag list
- Advanced (collapsed):
  - Model alias table
  - Model routing presets
  - Provider-specific params

[Section 5: Global Behavior]
- Streaming replies toggle
- Creativity slider (temperature)
- Response length slider (max tokens)
- Advanced:
  - Streaming boundary (text end / message end)
  - Chunking and coalescing settings
  - Human delay settings

---

## B) Agents List -> Agent Detail (Per-Agent)

### Agent Detail Top

[Header]
- Agent name + avatar
- Status badge
- Actions: Pause/Resume, Duplicate, Delete

[Tabs]
- Overview | Behavior | Tools | Memory | Availability | Advanced

---

### Overview Tab

[Identity Card]
- Name
- Role
- Avatar
- Short description

[Purpose Card]
- "What should this agent be good at?"
- Tag-style multi-select

[Defaults Summary]
- Shows which settings are using system defaults vs overrides

---

### Behavior Tab

[Behavior Card]
- Creativity slider
- Response length slider
- Streaming toggle
- "Speed vs Depth" toggle (simple thinking level control)
- Per-setting "Use system default" toggles

[Advanced Accordion]
- Model override + fallbacks
- Runtime override (Pi vs SDK)
- CCSDK provider override (if runtime is SDK)

---

### Tools Tab

[Tool Profile Card]
- Chips: Minimal | Messaging | Coding | Full
- Helper text describing each

[Capabilities Card]
- Toggle rows with clear labels:
  - Messages
  - Web research
  - Files
  - Calendar
  - System commands
- Each row includes a short risk note

[Advanced Accordion]
- Allowlist / denylist (tokenized input)
- Provider-specific tool policies
- Elevated mode gate (allowFrom)
- Exec configuration (host, security mode)

---

### Memory Tab

[Memory Card]
- Memory toggle On/Off
- Memory depth slider (Short / Balanced / Deep)

[Advanced Accordion]
- Context pruning mode + TTL
- Compaction mode + thresholds
- Memory search provider + store

---

### Availability Tab

[Quiet Hours Card]
- Time blocks (drag + click)
- Time zone selector / display
- "Auto-pause outside quiet hours" toggle

[Advanced Accordion]
- Heartbeat schedule (every, target, model)
- Heartbeat prompt overrides

---

### Advanced Tab

[Advanced Summary]
- Exposes everything not visible elsewhere
- Raw config editor (power-user)
- Sandbox settings: scope, workspace access
- Group chat config
- Sub-agent settings (model override, max concurrent)

---

## C) Provider Card Expanded State

[Provider Card]
- Name + status
- Auth section
  - Auth mode dropdown
  - If API key: input field + Test button
  - If OAuth: "Sign in" button + device code flow
  - If CLI pairing: show command + copy buttons
- Default model selection (optional)
- Advanced (collapsed): base URL, headers, max concurrent

---

## D) Empty / First-Time States

- No providers connected: show a banner at top of Model & Provider page with 2 buttons:
  - "Connect a provider"
  - "Learn about models"

- No agents: Agents page shows "Create your first agent" CTA

---

## E) Error States

- Invalid API key: inline error under input + "Try again"
- Provider unavailable: status banner + link to status page
- Advanced setting invalid: inline error + reset to default
- Streaming replies toggle
- Creativity slider
- Response length slider
- Advanced controls (chunking, boundary, human delay)

[Section 6: Heartbeat]
- Card: Heartbeat process
  - Schedule (every, active hours)
  - Model/provider selector (cheaper allowed)
  - Experimental accordion:
    - Escalation toggle: "Escalate low-confidence items to System Brain"
  - Helper: "Runs scheduled check-ins and can ask System Brain to continue work."
