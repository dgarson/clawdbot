# COPY (Canonical UI Text) - apps/web Agent Configuration

This document is the canonical source for user-facing copy used in the Agent Configuration MVP. It exists to:
- keep terminology consistent across UI surfaces
- keep tone consistent across personas
- prevent “drift” between docs and implementation

Canonical terms + style rules:
- `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

## Voice and Tone

- Friendly, calm, and direct.
- Prefer “what happens” over “what it is”.
- Avoid absolutes (“always”, “never”, “only”) except in safety warnings.
- Explain consequences for risky actions without fear-mongering.

## UI Label Style Guide

These rules keep labels consistent across providers, pages, and components.

### Capitalization
- **Field labels and toggle labels:** sentence case (capitalize first word only).
  - Good: `Response length`, `Quiet hours`, `Streaming replies`
  - Avoid: `Response Length`, `Quiet Hours`, `Streaming Replies`
- **Section headings / page titles:** Title Case is allowed.
  - Example: `Model & Provider`, `Agent Configuration`

### Noun vs Verb
- **Settings labels:** prefer nouns / noun phrases (what the thing is).
  - Examples: `Creativity`, `Response length`, `Sandbox scope`
- **Actions:** verbs (what the user does).
  - Examples: `Connect provider`, `Test connection`, `Clone agent`

### Provider/Runtime Specificity
- Primary UI labels must **not** use provider API field names (`max_tokens`, `max_completion_tokens`, etc.).
- Technical terms belong in Expert Mode tooltips and raw config surfaces.

## Universal UI Strings

### Save status
- Saving: `Saving…`
- Saved: `All changes saved`
- Save failed: `Failed to save changes`
- Retry: `Try again`
- Undo: `Undo`
- Copy changes: `Copy changes`

### Empty states
- No agents:
  - Title: `Create your first agent`
  - Body: `Agents are assistants you can chat with and give tools to. Start simple, customize later.`
  - CTA: `Create Agent`
- No providers:
  - Title: `Connect a model provider`
  - Body: `You need at least one provider before agents can respond.`
  - CTA: `Connect Provider`

## Agent Concepts

### Basics tab
- Title: `Basics`
- Subtitle: `The controls most people change. Everything else inherits system defaults.`

### Quiet hours
- Title: `Quiet hours`
- Helper: `Reduce interruptions and limit what this agent can do during certain times.`
- Policy presets:
  - `Respond only when mentioned (recommended)`
  - `Mute outbound messages`
  - `Pause agent`

### More tab
- Title: `More`
- Subtitle: `Detailed settings and logs. Use Expert Mode to see everything at once.`

### View mode override (per-agent)
- Label: `View`
- Options: `Simple` / `Full`
- Helper: `This changes the layout for this agent only.`

## Providers and Auth

### Provider card states
- Connected: `Connected`
- Missing key: `Missing key`
- Needs sign-in: `Needs sign-in`
- Error: `Error`

### Auth method selection
- Title: `Choose a sign-in method`
- API key helper: `Paste a key. You can test it immediately.`
- OAuth helper: `Sign in in your browser and return here when finished.`
- Pairing helper: `Use this when the gateway can’t open a browser.`

### Pairing (headless fallback)
- Title: `Pair from your local machine`
- Body: `Use this if your gateway is running in the cloud or can’t open a browser.`
- CTA: `Copy pairing command`

## Safety and Risk Copy

### Elevated mode
- Warning: `This allows powerful actions. Only enable for trusted agents.`

### System commands / execution
- Warning: `System commands can modify your machine. Use with care.`

### Sandbox disabled
- Warning: `Disabling the sandbox allows direct access to your workspace and system. Only do this if you trust this agent completely.`

## Tooltips (Templates)

Short tooltip template:
- `{Friendly label}: {One sentence describing the outcome}.`

Expert Mode tooltip template:
- `{Friendly label} (config: {path}): {Outcome}.`
