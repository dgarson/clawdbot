---
summary: "Source-of-truth copy deck for the guided onboarding tour"
read_when:
  - Writing onboarding UI text or microcopy
  - Implementing onboarding steps in web or desktop clients
  - Reviewing onboarding voice and tone

title: "Onboarding Tour Copy Deck"
sidebarTitle: "Onboarding Tour Copy"
---

# Onboarding Tour Copy Deck

**Work Item:** `dgarson/clawdbot#bs-ux-1-copy`  
**Audience:** First-time OpenClaw users (beginner → advanced)  
**Voice:** Calm, direct, confident, privacy-first

This document is the canonical text spec for the guided onboarding tour.
Design and implementation should treat this as the source of truth for:

- Step titles and body text
- CTA labels
- Empty, loading, and error states
- Permission explanations and reassurance text

## Copy Principles

1. **Lead with trust.** Mention local-first behavior and user control early.
2. **Reduce anxiety.** Explain why permissions are requested and that they can be changed later.
3. **Keep momentum.** Prefer short, action-oriented CTA labels.
4. **Avoid jargon first.** Use plain language, with technical terms in secondary text.
5. **Respect attention.** Body copy should usually stay under 2 sentences per panel.

## Global UI Copy

- App title: `OpenClaw`
- Primary skip action: `Skip setup`
- Help action: `Need help?`
- Progress format: `Step {current} of {total}`
- Back action: `Back`
- Generic continue action: `Continue`

## Step 1 — Welcome

### Primary copy

- **Title:** `Welcome to OpenClaw`
- **Subtitle:** `Set up takes about 3 minutes.`
- **Body:** `OpenClaw runs locally on your machine. You stay in control of your data, permissions, and automations.`
- **Checklist heading:** `What we'll do now`
- **Checklist items:**
  - `Choose where your Gateway runs`
  - `Review permissions`
  - `Optionally install the CLI`
  - `Start your first onboarding chat`
- **Primary CTA:** `Get started`

### Secondary states

- **Resume banner (if interrupted):** `Welcome back — we saved your progress.`
- **Resume CTA:** `Continue setup`

## Step 2 — Gateway Setup

### Gateway copy

- **Title:** `Where should your Gateway run?`
- **Subtitle:** `Pick the setup that matches how you work.`

#### Option A: Local

- **Card title:** `This Mac (recommended)`
- **Card body:** `Best for first-time setup. OAuth and local app integrations work out of the box.`
- **Selected badge:** `Recommended`

#### Option B: Remote

- **Card title:** `Remote host`
- **Card body:** `Use SSH or tailnet when your Gateway runs elsewhere. Requires credentials on the remote machine.`

### Authentication copy

- **Section title:** `Authentication`
- **Recommended option:** `Generate a secure token (recommended)`
- **Fallback option:** `Disable auth (development only)`
- **Warning helper (shown when auth is disabled):** `Anyone with network access to this Gateway can control it.`

### Gateway CTA

- **Primary CTA:** `Save and continue`

## Step 3 — Permissions

### Permissions copy

- **Title:** `Review permissions`
- **Subtitle:** `OpenClaw only asks for what you enable.`
- **Helper text:** `You can change these anytime in System Settings.`

### Permission labels + helper text

- `Automation` — `Control supported apps on your behalf`
- `Notifications` — `Send reminders and status updates`
- `Accessibility` — `Read UI context to complete tasks`
- `Screen Recording (optional)` — `Capture or stream screen context when needed`
- `Microphone (optional)` — `Enable voice input and calls`
- `Location (optional)` — `Use location-aware automations`

### Permissions CTA

- **Primary CTA:** `Continue`

## Step 4 — CLI Installation (Optional)

### CLI step copy

- **Title:** `Install the CLI (optional)`
- **Subtitle:** `Use terminal commands for automation, debugging, and scripts.`
- **Body:** `You can skip this now and install later.`

### Options

- `Skip for now`
- `Install with detected package manager`

### Environment states

- **Detected:** `Detected: {manager}`
- **Not detected:** `No package manager detected. We'll show manual install steps.`
- **Installing:** `Installing OpenClaw CLI…`
- **Install success:** `CLI installed successfully.`
- **Install failed:** `Install failed. You can continue and install from docs later.`

### CLI CTA

- **Primary CTA (default):** `Continue`
- **Primary CTA (during install):** `Installing…`

## Step 5 — Onboarding Chat

### Chat step copy

- **Title:** `You're all set`
- **Subtitle:** `Let's run your first task together.`

### Assistant opener

`Hey — I’m your OpenClaw assistant. Want to connect a channel, build an automation, or do a quick system check first?`

### Suggested prompts

- `Connect Slack`
- `Set up my first daily summary`
- `Show what you can automate`
- `Run a quick health check`

### Input placeholder

- `Type a message…`

### Chat CTA

- **Primary CTA:** `Finish setup`

## Confirmation + Exit Copy

### Completed state

- **Title:** `Setup complete`
- **Body:** `Your OpenClaw workspace is ready.`
- **Primary CTA:** `Open dashboard`
- **Secondary CTA:** `Start chatting`

### Skip confirmation modal

- **Title:** `Skip guided setup?`
- **Body:** `You can finish setup later from Settings → Onboarding.`
- **Primary CTA:** `Skip setup`
- **Secondary CTA:** `Continue setup`

## Error Copy

- **Network:** `Couldn't reach the Gateway. Check your connection and try again.`
- **Permissions read failure:** `We couldn't verify permissions yet. You can continue and review again later.`
- **Token generation failure:** `Couldn't generate a token. Retry, or continue with manual setup.`
- **Unexpected:** `Something went wrong. Your progress is saved — try again.`

## Accessibility + Localization Notes

- Avoid directional text like “click here”; use action labels.
- Keep CTA labels <= 24 characters where possible.
- Prefer sentence case across headings and buttons.
- Avoid idioms and region-specific phrasing to simplify localization.
- Keep emoji decorative; never rely on emoji for meaning.

## Change Management

When updating onboarding copy:

1. Update this document first.
2. Sync product surfaces (web, macOS app, docs, tests).
3. Record major voice/tone changes in the PR description.
