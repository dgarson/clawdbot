# Foundation Component Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all 400+ inline CSS-class patterns across 31 view files with the 13 new foundation Lit components, in five waves from lowest to highest risk.

**Architecture:** All views are plain `html`-returning functions rendered into `OpenClawApp`'s light DOM — they are not LitElements themselves. Foundation components register as custom elements via side-effect imports; no per-file class import is needed in view files. Verification for every task is `npm run build` (TypeScript + Vite) from the `ui/` directory since there are no UI unit tests.

**Tech Stack:** Lit 3.x, Vite 7, TypeScript, oxlint (`unbound-method` rule active), bash 5 (pre-commit hook requires `/opt/homebrew/bin/bash` on PATH)

---

## Prerequisite

### Task 0: Register the component bundle

All custom elements must be registered before any view uses them. One import in the application entry point covers everything.

**Files:**

- Modify: `ui/src/ui/app.ts` (after the last existing `import` statement, before the class declaration)

**Step 1: Add the side-effect import**

Open `ui/src/ui/app.ts`. Find the last `import` line (around line 60). Add immediately after it:

```ts
// Foundation UI components — registers all custom elements
import "./components/index.ts";
```

**Step 2: Build to verify registration compiles**

```bash
cd ui && npm run build
```

Expected: `✓ built in ~600ms` — no errors.

**Step 3: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/app.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "feat(ui): register foundation component bundle in app entry point"
```

---

## Wave 1 — Callouts, Status Dot, Pill (zero structural risk)

These are drop-in string replacements. No surrounding structure changes.

### Task 1: oc-callout — app-render.ts, sessions.ts, agents.ts, skills.ts, markdown-sidebar.ts

**Files:**

- Modify: `ui/src/ui/app-render.ts`
- Modify: `ui/src/ui/views/sessions.ts`
- Modify: `ui/src/ui/views/agents.ts`
- Modify: `ui/src/ui/views/skills.ts`
- Modify: `ui/src/ui/views/markdown-sidebar.ts`

**Step 1: Find all callout occurrences in these files**

```bash
grep -n 'class="callout' ui/src/ui/app-render.ts ui/src/ui/views/sessions.ts ui/src/ui/views/agents.ts ui/src/ui/views/skills.ts ui/src/ui/views/markdown-sidebar.ts
```

**Step 2: Apply replacements — exact patterns**

`app-render.ts` (~line 197):

```ts
// BEFORE
${state.lastError ? html`<div class="pill danger">${state.lastError}</div>` : nothing}

// AFTER — leave this for Task 4 (oc-pill wave); no callouts in app-render.ts
```

`sessions.ts` (~line 183):

```ts
// BEFORE
${props.error
  ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
  : nothing}

// AFTER
${props.error
  ? html`<oc-callout variant="danger">${props.error}</oc-callout>`
  : nothing}
```

`agents.ts` (~line 120):

```ts
// BEFORE
html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`;

// AFTER
html`<oc-callout variant="danger">${props.error}</oc-callout>`;
```

`skills.ts` (~line 64):

```ts
// BEFORE
html`<div class="callout danger" style="margin-top: 12px;">${error}</div>`;

// AFTER
html`<oc-callout variant="danger">${error}</oc-callout>`;
```

`markdown-sidebar.ts` (~line 26):

```ts
// BEFORE
html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`;

// AFTER
html`<oc-callout variant="danger">${props.error}</oc-callout>`;
```

**Step 3: Build**

```bash
cd ui && npm run build
```

Expected: `✓ built` — no errors.

**Step 4: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/app-render.ts ui/src/ui/views/sessions.ts ui/src/ui/views/agents.ts ui/src/ui/views/skills.ts ui/src/ui/views/markdown-sidebar.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace callout divs with oc-callout (sessions, agents, skills)"
```

---

### Task 2: oc-callout — all 7 channel view files

Each channel view is isomorphic: two callouts per file (danger + bare/neutral).

**Files:**

- Modify: `ui/src/ui/views/channels.discord.ts`
- Modify: `ui/src/ui/views/channels.slack.ts`
- Modify: `ui/src/ui/views/channels.signal.ts`
- Modify: `ui/src/ui/views/channels.telegram.ts`
- Modify: `ui/src/ui/views/channels.whatsapp.ts`
- Modify: `ui/src/ui/views/channels.googlechat.ts`
- Modify: `ui/src/ui/views/channels.imessage.ts`

**Step 1: Confirm occurrences**

```bash
grep -c 'class="callout' ui/src/ui/views/channels.discord.ts ui/src/ui/views/channels.slack.ts ui/src/ui/views/channels.signal.ts ui/src/ui/views/channels.telegram.ts ui/src/ui/views/channels.whatsapp.ts ui/src/ui/views/channels.googlechat.ts ui/src/ui/views/channels.imessage.ts
```

Expected: 2 per file (14 total).

**Step 2: Apply the same transformation in all 7 files**

The pattern in `channels.discord.ts` is representative of all 7 (exact code from source):

```ts
// BEFORE (danger callout)
${discord?.lastError
  ? html`<div class="callout danger" style="margin-top: 12px;">
    ${discord.lastError}
  </div>`
  : nothing}

// AFTER
${discord?.lastError
  ? html`<oc-callout variant="danger">${discord.lastError}</oc-callout>`
  : nothing}

// BEFORE (neutral/bare callout)
${discord?.probe
  ? html`<div class="callout" style="margin-top: 12px;">
    Probe ${discord.probe.ok ? "ok" : "failed"} ·
    ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
  </div>`
  : nothing}

// AFTER
${discord?.probe
  ? html`<oc-callout>
    Probe ${discord.probe.ok ? "ok" : "failed"} ·
    ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
  </oc-callout>`
  : nothing}
```

Apply same pattern in each channel file, substituting the correct status variable name (`slack`, `signal`, `telegram`, `whatsapp`, `googlechat`, `imessage`).

**Step 3: Build**

```bash
cd ui && npm run build
```

**Step 4: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/channels.discord.ts ui/src/ui/views/channels.slack.ts ui/src/ui/views/channels.signal.ts ui/src/ui/views/channels.telegram.ts ui/src/ui/views/channels.whatsapp.ts ui/src/ui/views/channels.googlechat.ts ui/src/ui/views/channels.imessage.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace callout divs with oc-callout in channel views"
```

---

### Task 3: oc-callout — remaining 18 files

**Files:**

- Modify: `ui/src/ui/views/config.ts`
- Modify: `ui/src/ui/views/debug.ts`
- Modify: `ui/src/ui/views/overview.ts`
- Modify: `ui/src/ui/views/nodes.ts`
- Modify: `ui/src/ui/views/usage.ts`
- Modify: `ui/src/ui/views/chat.ts`
- Modify: `ui/src/ui/views/sessions.ts` (any remaining)
- Modify: `ui/src/ui/views/cron.ts`
- Modify: `ui/src/ui/views/config-form.render.ts`
- Modify: `ui/src/ui/views/channels.config.ts`
- Modify: `ui/src/ui/views/channels.nostr.ts`
- Modify: `ui/src/ui/views/channels.nostr-profile-form.ts`
- Modify: `ui/src/ui/views/channels.ts`
- Modify: `ui/src/ui/views/instances.ts`
- Modify: `ui/src/ui/views/logs.ts`
- Modify: `ui/src/ui/views/gateway-url-confirmation.ts`
- Modify: `ui/src/ui/views/nodes-exec-approvals.ts`
- Modify: `ui/src/ui/views/agents-panels-tools-skills.ts`
- Modify: `ui/src/ui/views/agents-panels-status-files.ts`

**Step 1: Find all remaining callout sites**

```bash
grep -rn 'class="callout' ui/src/ui/views/ | grep -v 'channels\.discord\|channels\.slack\|channels\.signal\|channels\.telegram\|channels\.whatsapp\|channels\.googlechat\|channels\.imessage'
```

**Step 2: Apply the universal replacement rule**

Every match follows one of three shapes. Replace mechanically:

```ts
// Shape A — danger with margin
html`<div class="callout danger" style="margin-top: 12px;">${expr}</div>`
→ html`<oc-callout variant="danger">${expr}</oc-callout>`

// Shape B — other named variant with margin
html`<div class="callout info" style="margin-top: 12px;">${expr}</div>`
→ html`<oc-callout variant="info">${expr}</oc-callout>`

// Shape C — bare/neutral
html`<div class="callout" style="margin-top: 12px;">${expr}</div>`
→ html`<oc-callout>${expr}</oc-callout>`

// Shape D — warn (note: also handle "warning" → "warn" variant normalisation)
html`<div class="callout warning" ...>`
→ html`<oc-callout variant="warn">`
// (oc-callout uses "warn" not "warning")

// Shape E — success
html`<div class="callout success" ...>`
→ html`<oc-callout variant="success">`
```

Special case in `debug.ts` — dynamic variant from runtime value:

```ts
// BEFORE
html`<div class="callout ${securityTone}" style="margin-top: 12px;">${msg}</div>`;

// AFTER — map to oc-callout's accepted variants at call site
// Check what values securityTone can be (read debug.ts to confirm)
// If it's already "info"|"warn"|"danger"|"success"|"neutral", pass directly:
html`<oc-callout variant=${securityTone}>${msg}</oc-callout>`;
```

Special case in `channels.nostr-profile-form.ts` — success variant:

```ts
// BEFORE
html`<div class="callout success" style="margin-top: 12px;">${msg}</div>`;
// AFTER
html`<oc-callout variant="success">${msg}</oc-callout>`;
```

**Step 3: Verify no callout divs remain**

```bash
grep -rn 'class="callout' ui/src/ui/
```

Expected: zero matches.

**Step 4: Build**

```bash
cd ui && npm run build
```

**Step 5: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace remaining callout divs with oc-callout across all views"
```

---

### Task 4: oc-status-dot + oc-pill — app-render.ts

**Files:**

- Modify: `ui/src/ui/app-render.ts`

**Step 1: Find the topbar health pill (exact source at ~line 137)**

```bash
grep -n 'class="pill\|class="statusDot' ui/src/ui/app-render.ts
```

**Step 2: Replace topbar health indicator**

```ts
// BEFORE (lines ~137–143)
<div class="topbar-status">
  <div class="pill">
    <span class="statusDot ${state.connected ? "ok" : ""}"></span>
    <span>${t("common.health")}</span>
    <span class="mono">${state.connected ? t("common.ok") : t("common.offline")}</span>
  </div>
  ${renderThemeToggle(state)}
</div>

// AFTER
<div class="topbar-status">
  <oc-pill>
    <oc-status-dot .status=${state.connected ? "ok" : "offline"}></oc-status-dot>
    <span>${t("common.health")}</span>
    <span class="mono">${state.connected ? t("common.ok") : t("common.offline")}</span>
  </oc-pill>
  ${renderThemeToggle(state)}
</div>
```

**Step 3: Replace lastError pill (~line 197)**

```ts
// BEFORE
${state.lastError ? html`<div class="pill danger">${state.lastError}</div>` : nothing}

// AFTER
${state.lastError ? html`<oc-pill variant="danger">${state.lastError}</oc-pill>` : nothing}
```

**Step 4: Find any other pill/statusDot sites in app-render.ts**

```bash
grep -n 'class="pill\|class="statusDot' ui/src/ui/app-render.ts
```

Expected: zero matches.

**Step 5: Replace config.ts validity pill (~line 454–456)**

```bash
grep -n 'class="pill' ui/src/ui/views/config.ts
```

```ts
// BEFORE
<span class="pill pill--sm ${valid ? "pill--ok" : "pill--danger"}">${validity}</span>

// AFTER
<oc-pill size="sm" variant=${valid ? "ok" : "danger"}>${validity}</oc-pill>
```

**Step 6: Build**

```bash
cd ui && npm run build
```

**Step 7: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/app-render.ts ui/src/ui/views/config.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace pill/statusDot patterns with oc-pill + oc-status-dot"
```

---

## Wave 2 — Cards and Fields

### Task 5: oc-card — 7 channel view files (isomorphic pattern)

Each channel view has the same 3-card structure: one status card (no header row button), one config card.

**Files:**

- Modify: `ui/src/ui/views/channels.discord.ts` (and the 6 other channel files)

**Step 1: Understand the two card shapes present**

Shape A — title + subtitle only, no action button:

```ts
// BEFORE
<div class="card">
  <div class="card-title">Discord</div>
  <div class="card-sub">Bot status and channel configuration.</div>
  ${accountCountLabel}
  ...body content...
</div>

// AFTER
<oc-card title="Discord" subtitle="Bot status and channel configuration.">
  ${accountCountLabel}
  ...body content...
</oc-card>
```

Shape B — title + subtitle + refresh button:

```ts
// BEFORE
<div class="card">
  <div class="row" style="justify-content: space-between; align-items: center;">
    <div>
      <div class="card-title">Config</div>
      <div class="card-sub">Channel configuration.</div>
    </div>
    <button class="btn btn--sm" ?disabled=${props.loading} @click=${onRefresh}>
      ${props.loading ? "Refreshing…" : "Refresh"}
    </button>
  </div>
  ...body content...
</div>

// AFTER
<oc-card title="Config" subtitle="Channel configuration.">
  <oc-button slot="actions" size="sm" .loading=${props.loading} @click=${onRefresh}>
    Refresh
  </oc-button>
  ...body content...
</oc-card>
```

**Step 2: Apply to all 7 channel files**

Read each file, find all `class="card"` divs, apply the appropriate shape. The `<section class="card">` variant also becomes `<oc-card>`.

**Step 3: Verify no bare card divs remain in channel files**

```bash
grep -n 'class="card' ui/src/ui/views/channels.discord.ts ui/src/ui/views/channels.slack.ts ui/src/ui/views/channels.signal.ts ui/src/ui/views/channels.telegram.ts ui/src/ui/views/channels.whatsapp.ts ui/src/ui/views/channels.googlechat.ts ui/src/ui/views/channels.imessage.ts
```

Expected: zero matches.

**Step 4: Build**

```bash
cd ui && npm run build
```

**Step 5: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/channels.discord.ts ui/src/ui/views/channels.slack.ts ui/src/ui/views/channels.signal.ts ui/src/ui/views/channels.telegram.ts ui/src/ui/views/channels.whatsapp.ts ui/src/ui/views/channels.googlechat.ts ui/src/ui/views/channels.imessage.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace card divs with oc-card in channel views"
```

---

### Task 6: oc-card — sessions.ts, agents.ts, skills.ts, logs.ts, instances.ts

**Files:**

- Modify: `ui/src/ui/views/sessions.ts`
- Modify: `ui/src/ui/views/agents.ts`
- Modify: `ui/src/ui/views/skills.ts`
- Modify: `ui/src/ui/views/logs.ts`
- Modify: `ui/src/ui/views/instances.ts`

**Step 1: Find all card patterns**

```bash
grep -n 'class="card' ui/src/ui/views/sessions.ts ui/src/ui/views/agents.ts ui/src/ui/views/skills.ts ui/src/ui/views/logs.ts ui/src/ui/views/instances.ts
```

**Step 2: Apply card replacement — sessions.ts representative pattern (exact source)**

The `renderSessions` function has a header row with Refresh button:

```ts
// BEFORE (sessions.ts ~line 103)
<section class="card">
  <div class="row" style="justify-content: space-between;">
    <div>
      <div class="card-title">Sessions</div>
      <div class="card-sub">Active session keys and per-session overrides.</div>
    </div>
    <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
      ${props.loading ? "Loading…" : "Refresh"}
    </button>
  </div>
  ...body...
</section>

// AFTER
<oc-card title="Sessions" subtitle="Active session keys and per-session overrides.">
  <oc-button slot="actions" .loading=${props.loading} @click=${props.onRefresh}>
    Refresh
  </oc-button>
  ...body...
</oc-card>
```

**Step 3: Handle the agent header card (agents.ts ~line 297)**

The agent header uses `class="agent-header card"` — two classes. The extra class `agent-header` scopes CSS rules. After migration, keep the `agent-header` class on an inner div or use `part`:

```ts
// BEFORE
<section class="agent-header card">
  ...
</section>

// AFTER — wrap body in a div to preserve agent-header scoping
<oc-card>
  <div class="agent-header">
    ...
  </div>
</oc-card>
```

Check the CSS file to confirm which rules use `.agent-header`:

```bash
grep -n 'agent-header' ui/src/styles/components.css 2>/dev/null || grep -rn 'agent-header' ui/src/styles/
```

If `.agent-header` rules are independent of `.card`, wrapping in a div is correct.

**Step 4: Build**

```bash
cd ui && npm run build
```

**Step 5: Commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/sessions.ts ui/src/ui/views/agents.ts ui/src/ui/views/skills.ts ui/src/ui/views/logs.ts ui/src/ui/views/instances.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace card divs with oc-card (sessions, agents, skills, logs, instances)"
```

---

### Task 7: oc-card — nodes.ts, overview.ts, debug.ts, cron.ts, nodes-exec-approvals.ts

**Files:**

- Modify: `ui/src/ui/views/nodes.ts`
- Modify: `ui/src/ui/views/overview.ts`
- Modify: `ui/src/ui/views/debug.ts`
- Modify: `ui/src/ui/views/cron.ts`
- Modify: `ui/src/ui/views/nodes-exec-approvals.ts`

**Step 1: Find counts**

```bash
grep -c 'class="card' ui/src/ui/views/nodes.ts ui/src/ui/views/overview.ts ui/src/ui/views/debug.ts ui/src/ui/views/cron.ts ui/src/ui/views/nodes-exec-approvals.ts
```

**Step 2: Apply the same shapes from Task 5**

All sites use Shape A or Shape B. Apply mechanically.

**Step 3: Handle cron.ts "New Job" card with form-grid body**

The card body has `<div class="form-grid" style="margin-top: 16px;">`. After wrapping in `<oc-card>`, the `style="margin-top: 16px;"` on the form-grid stays as-is (it's inside the card body, not on the card itself):

```ts
// AFTER
<oc-card title="New Job" subtitle="Create a scheduled wakeup or agent run.">
  <div class="form-grid" style="margin-top: 16px;">
    ...fields...
  </div>
</oc-card>
```

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/nodes.ts ui/src/ui/views/overview.ts ui/src/ui/views/debug.ts ui/src/ui/views/cron.ts ui/src/ui/views/nodes-exec-approvals.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace card divs with oc-card (nodes, overview, debug, cron)"
```

---

### Task 8: oc-card — remaining files (agents-panels-_, usage-_, channels.ts, channels.nostr.ts, channels.config.ts, agents-panels-status-files.ts, agents-panels-tools-skills.ts)

**Step 1: Find all remaining card sites**

```bash
grep -rn 'class="card' ui/src/ui/views/ ui/src/ui/app-render.ts ui/src/ui/app-render.helpers.ts 2>/dev/null
```

**Step 2: Apply uniform Shape A / Shape B replacement to all remaining matches**

Special case — `class="card chat"` in `chat.ts` has a custom second class. Preserve it:

```ts
// BEFORE
<div class="card chat">...</div>

// AFTER — keep the chat class on the card's inner wrapper since oc-card uses Shadow DOM
// Option: add a wrapping div or use the card's part attribute
// Simplest: leave class="card chat" as-is in chat.ts and revisit if chat layout needs oc-card
// SKIP chat.ts for now — add to tech debt
```

**Step 3: Special case — usage views with `style="margin: 0;"` overrides**

In `usage.ts`, some cards have extra inline margin overrides. After migrating to `<oc-card>`, move the override to a wrapper div:

```ts
// BEFORE
<div class="card" style="margin: 0;">

// AFTER
<div style="margin: 0;">
  <oc-card>
    ...
  </oc-card>
</div>
```

**Step 4: Verify zero bare card divs remain (except chat.ts)**

```bash
grep -rn 'class="card' ui/src/ui/ | grep -v 'chat\.ts'
```

**Step 5: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace remaining card divs with oc-card across all views"
```

---

### Task 9: oc-field + oc-toggle — sessions.ts, logs.ts

Migrate the `<label class="field">` and `<label class="field checkbox">` patterns.

**Files:**

- Modify: `ui/src/ui/views/sessions.ts`
- Modify: `ui/src/ui/views/logs.ts`

**Step 1: Identify patterns**

```bash
grep -n 'class="field' ui/src/ui/views/sessions.ts ui/src/ui/views/logs.ts
```

**Step 2: Replace text input fields (sessions.ts exact source)**

```ts
// BEFORE
<label class="field">
  <span>Active within (minutes)</span>
  <input
    .value=${props.activeMinutes}
    @input=${(e: Event) =>
      props.onFiltersChange({
        activeMinutes: (e.target as HTMLInputElement).value,
        limit: props.limit,
        includeGlobal: props.includeGlobal,
        includeUnknown: props.includeUnknown,
      })}
  />
</label>

// AFTER
<oc-field label="Active within (minutes)">
  <input
    .value=${props.activeMinutes}
    @input=${(e: Event) =>
      props.onFiltersChange({
        activeMinutes: (e.target as HTMLInputElement).value,
        limit: props.limit,
        includeGlobal: props.includeGlobal,
        includeUnknown: props.includeUnknown,
      })}
  />
</oc-field>
```

**Step 3: Replace checkbox fields with oc-toggle (sessions.ts exact source)**

```ts
// BEFORE
<label class="field checkbox">
  <span>Include global</span>
  <input
    type="checkbox"
    .checked=${props.includeGlobal}
    @change=${(e: Event) =>
      props.onFiltersChange({
        activeMinutes: props.activeMinutes,
        limit: props.limit,
        includeGlobal: (e.target as HTMLInputElement).checked,
        includeUnknown: props.includeUnknown,
      })}
  />
</label>

// AFTER — NOTE: oc-toggle fires "oc-change" with detail.checked (not native "change")
<oc-toggle
  label="Include global"
  .checked=${props.includeGlobal}
  @oc-change=${(e: CustomEvent<{ checked: boolean }>) =>
    props.onFiltersChange({
      activeMinutes: props.activeMinutes,
      limit: props.limit,
      includeGlobal: e.detail.checked,
      includeUnknown: props.includeUnknown,
    })}
></oc-toggle>
```

Apply same pattern to "Include unknown" checkbox.

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/sessions.ts ui/src/ui/views/logs.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace field/checkbox labels with oc-field + oc-toggle (sessions, logs)"
```

---

### Task 10: oc-field + oc-select + oc-toggle — cron.ts (largest single file, 18 fields)

**Files:**

- Modify: `ui/src/ui/views/cron.ts`

**Step 1: Find all field and select patterns**

```bash
grep -n 'class="field\|<select' ui/src/ui/views/cron.ts
```

**Step 2: Replace text input fields**

Representative (Name field, from exact source):

```ts
// BEFORE
<label class="field">
  <span>Name</span>
  <input
    .value=${props.form.name}
    @input=${(e: Event) =>
      props.onFormChange({ name: (e.target as HTMLInputElement).value })}
  />
</label>

// AFTER
<oc-field label="Name">
  <input
    .value=${props.form.name}
    @input=${(e: Event) =>
      props.onFormChange({ name: (e.target as HTMLInputElement).value })}
  />
</oc-field>
```

Apply to: Name, Description, Agent ID, and all other text/textarea fields.

**Step 3: Replace checkbox field with oc-toggle**

```ts
// BEFORE
<label class="field checkbox">
  <span>Enabled</span>
  <input
    type="checkbox"
    .checked=${props.form.enabled}
    @change=${(e: Event) =>
      props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
  />
</label>

// AFTER
<oc-toggle
  label="Enabled"
  .checked=${props.form.enabled}
  @oc-change=${(e: CustomEvent<{ checked: boolean }>) =>
    props.onFormChange({ enabled: e.detail.checked })}
></oc-toggle>
```

**Step 4: Replace select fields with oc-field + oc-select**

The key change: options move from child `<option>` elements to the `.options` property array. Event handler changes from `@change` with `e.target as HTMLSelectElement` to `@oc-change` with `e.detail.value`.

```ts
// BEFORE (Schedule field, exact source)
<label class="field">
  <span>Schedule</span>
  <select
    .value=${props.form.scheduleKind}
    @change=${(e: Event) =>
      props.onFormChange({
        scheduleKind: (e.target as HTMLSelectElement)
          .value as CronFormState["scheduleKind"],
      })}
  >
    <option value="every">Every</option>
    <option value="at">At</option>
    <option value="cron">Cron</option>
  </select>
</label>

// AFTER
<oc-field label="Schedule">
  <oc-select
    .value=${props.form.scheduleKind}
    .options=${[
      { value: "every", label: "Every" },
      { value: "at", label: "At" },
      { value: "cron", label: "Cron" },
    ]}
    @oc-change=${(e: CustomEvent<{ value: string }>) =>
      props.onFormChange({
        scheduleKind: e.detail.value as CronFormState["scheduleKind"],
      })}
  ></oc-select>
</oc-field>
```

Apply to all select fields (Session, Wake mode, Payload, Schedule type, etc.).

**Step 5: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/cron.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace field/select/toggle patterns with oc-field + oc-select + oc-toggle in cron.ts"
```

---

### Task 11: oc-field + oc-select + oc-toggle — remaining files

**Files:**

- Modify: `ui/src/ui/views/overview.ts` (5 fields)
- Modify: `ui/src/ui/views/nodes-exec-approvals.ts` (7 fields, 5 selects)
- Modify: `ui/src/ui/views/agents.ts` (2 model selects)
- Modify: `ui/src/ui/views/nodes.ts` (2 selects)
- Modify: `ui/src/ui/views/config.ts` (1 textarea field)
- Modify: `ui/src/ui/views/debug.ts` (2 fields)
- Modify: `ui/src/ui/views/agents-panels-tools-skills.ts`
- Modify: `ui/src/ui/views/agents-panels-status-files.ts`
- Modify: `ui/src/ui/views/config-form.node.ts` (enum select field)
- Modify: `ui/src/ui/views/usage.ts` (select fields)
- Modify: `ui/src/ui/views/usage-render-details.ts`
- Modify: `ui/src/ui/views/usage-render-overview.ts`
- Modify: `ui/src/ui/app-render.helpers.ts` (1 session select)
- Modify: `ui/src/ui/views/channels.nostr.ts` (2 relay selects)

**Step 1: Find all remaining field and select patterns**

```bash
grep -rn 'class="field\|<select' ui/src/ui/views/ ui/src/ui/app-render.helpers.ts
```

**Step 2: Apply the three patterns from Tasks 9 and 10 uniformly**

- `<label class="field">` → `<oc-field label="...">`
- `<label class="field checkbox">` → `<oc-toggle label="..." ...>`
- `<select .value=... @change=...><option ...>` → `<oc-select .value=... .options=[...] @oc-change=...>`

**Step 3: Verify zero bare field/select patterns remain**

```bash
grep -rn 'class="field' ui/src/ui/
```

Expected: zero matches (except any inside oc-field's own source file).

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/ ui/src/ui/app-render.helpers.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace field/select patterns with oc-field + oc-select across remaining views"
```

---

## Wave 3 — Buttons and Toggles

### Task 12: oc-button — simple refresh buttons (all files)

These are the lowest-risk button replacements: disabled state only, no loading text change.

**Step 1: Find the "simple refresh" pattern across all files**

```bash
grep -rn 'class="btn"' ui/src/ui/views/ ui/src/ui/app-render.ts ui/src/ui/app-render.helpers.ts | grep -v 'btn--\|primary\|danger'
```

**Step 2: Apply the simple replacement**

```ts
// BEFORE
<button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
  ${props.loading ? "Refreshing…" : "Refresh"}
</button>

// AFTER — oc-button shows loadingText automatically when .loading is true
<oc-button .loading=${props.loading} @click=${props.onRefresh}>
  Refresh
</oc-button>

// BEFORE (disabled only, no loading text swap)
<button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
  Refresh
</button>

// AFTER
<oc-button ?disabled=${props.loading} @click=${props.onRefresh}>
  Refresh
</oc-button>
```

**Step 3: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/ ui/src/ui/app-render.ts ui/src/ui/app-render.helpers.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace simple refresh buttons with oc-button"
```

---

### Task 13: oc-button — variant buttons (primary, danger, btn--sm)

**Step 1: Find variant button patterns**

```bash
grep -rn 'class="btn primary\|class="btn danger\|class="btn btn--sm' ui/src/ui/
```

**Step 2: Apply variant replacements**

```ts
// primary variant
// BEFORE
<button class="btn primary" ?disabled=${busy} @click=${handler}>Label</button>
// AFTER
<oc-button variant="primary" ?disabled=${busy} @click=${handler}>Label</oc-button>

// danger variant
// BEFORE
<button class="btn danger" ?disabled=${busy} @click=${handler}>Delete</button>
// AFTER
<oc-button variant="danger" ?disabled=${busy} @click=${handler}>Delete</oc-button>

// small size
// BEFORE
<button class="btn btn--sm" ?disabled=${busy} @click=${handler}>Refresh</button>
// AFTER
<oc-button size="sm" ?disabled=${busy} @click=${handler}>Refresh</oc-button>

// small primary
// BEFORE
<button class="btn btn--sm primary" @click=${handler}>Save</button>
// AFTER
<oc-button size="sm" variant="primary" @click=${handler}>Save</oc-button>
```

**Step 3: Handle the exec-approval buttons (exact source)**

In `exec-approval.ts` (full file already known):

```ts
// BEFORE
<div class="exec-approval-actions">
  <button class="btn primary" ?disabled=${state.execApprovalBusy}
    @click=${() => state.handleExecApprovalDecision("allow-once")}>
    Allow once
  </button>
  <button class="btn" ?disabled=${state.execApprovalBusy}
    @click=${() => state.handleExecApprovalDecision("allow-always")}>
    Always allow
  </button>
  <button class="btn danger" ?disabled=${state.execApprovalBusy}
    @click=${() => state.handleExecApprovalDecision("deny")}>
    Deny
  </button>
</div>

// AFTER
<div class="exec-approval-actions">
  <oc-button variant="primary" ?disabled=${state.execApprovalBusy}
    @click=${() => state.handleExecApprovalDecision("allow-once")}>
    Allow once
  </oc-button>
  <oc-button ?disabled=${state.execApprovalBusy}
    @click=${() => state.handleExecApprovalDecision("allow-always")}>
    Always allow
  </oc-button>
  <oc-button variant="danger" ?disabled=${state.execApprovalBusy}
    @click=${() => state.handleExecApprovalDecision("deny")}>
    Deny
  </oc-button>
</div>
```

**Step 4: Handle icon buttons (app-render.helpers.ts)**

Icon-only buttons use `btn--icon`:

```ts
// BEFORE
<button class="btn btn--sm btn--icon ${active ? "active" : ""}" title="..." @click=${handler}>
  ${icons.brain}
</button>

// AFTER
<oc-button variant="icon" size="sm" ?active=${active} title="..." @click=${handler}>
  <oc-icon slot="icon" name="brain"></oc-icon>
</oc-button>
```

Note: This requires `<oc-icon>` to be available — either defer icon buttons to Wave 5 or ensure the component bundle import from Task 0 is in place (it is).

**Step 5: Skip — chat send button**

The chat compose send button (`chat.ts`) has a `<kbd>↵</kbd>` child element that doesn't fit cleanly into `oc-button`'s slot model. Leave as a raw `<button>` and add a comment:

```ts
// TODO: chat send button retains raw <button> — <kbd> child incompatible with oc-button slot
```

**Step 6: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/ ui/src/ui/app-render.ts ui/src/ui/app-render.helpers.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace variant buttons with oc-button (primary, danger, sm, icon)"
```

---

### Task 14: oc-toggle — remaining cfg-toggle patterns

The `cfg-toggle` pattern in agent views uses a custom span-based toggle:

**Files:**

- Modify: `ui/src/ui/views/agents-panels-tools-skills.ts`
- Modify: `ui/src/ui/views/config-form.node.ts`
- Modify: `ui/src/ui/views/nodes-exec-approvals.ts` (boolean policy fields)
- Modify: `ui/src/ui/views/usage.ts` (include-compacted checkbox)
- Modify: `ui/src/ui/views/usage-render-details.ts` (normalized checkbox)

**Step 1: Find cfg-toggle and remaining checkbox patterns**

```bash
grep -rn 'cfg-toggle\|type="checkbox"' ui/src/ui/views/
```

**Step 2: Replace cfg-toggle pattern**

```ts
// BEFORE (agents-panels-tools-skills.ts)
<label class="cfg-toggle">
  <input type="checkbox" .checked=${skill.enabled} @change=${handler} />
  <span class="cfg-toggle__track"></span>
  <span class="label">${skill.name}</span>
</label>

// AFTER
<oc-toggle
  label=${skill.name}
  .checked=${skill.enabled}
  @oc-change=${(e: CustomEvent<{ checked: boolean }>) => handler(e.detail.checked)}
></oc-toggle>
```

**Step 3: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/agents-panels-tools-skills.ts ui/src/ui/views/config-form.node.ts ui/src/ui/views/nodes-exec-approvals.ts ui/src/ui/views/usage.ts ui/src/ui/views/usage-render-details.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace cfg-toggle and checkbox patterns with oc-toggle"
```

---

## Wave 4 — Structural Components

### Task 15: oc-collapsible — skills groups (2 files, same pattern)

**Files:**

- Modify: `ui/src/ui/views/skills.ts`
- Modify: `ui/src/ui/views/agents-panels-tools-skills.ts`

**Step 1: Find details/summary patterns**

```bash
grep -n '<details\|<summary' ui/src/ui/views/skills.ts ui/src/ui/views/agents-panels-tools-skills.ts
```

**Step 2: Apply collapsible replacement**

```ts
// BEFORE
<details class="agent-skills-group" ?open=${!collapsedByDefault}>
  <summary class="agent-skills-header">${groupLabel}</summary>
  <div class="agent-skills-body">
    ...skill rows...
  </div>
</details>

// AFTER
<oc-collapsible label=${groupLabel} ?open=${!collapsedByDefault}>
  <div class="agent-skills-body">
    ...skill rows...
  </div>
</oc-collapsible>
```

**Step 3: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/skills.ts ui/src/ui/views/agents-panels-tools-skills.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace details/summary with oc-collapsible in skills views"
```

---

### Task 16: oc-collapsible — config-diff, usage panels, remaining details

**Files:**

- Modify: `ui/src/ui/views/config.ts`
- Modify: `ui/src/ui/views/usage.ts`
- Modify: `ui/src/ui/views/usage-render-details.ts`
- Modify: `ui/src/ui/views/config-form.node.ts`

**Step 1: Find remaining details/summary patterns**

```bash
grep -rn '<details\|<summary' ui/src/ui/
```

**Step 2: Apply replacements**

Config diff panel (`config.ts`):

```ts
// BEFORE
<details class="config-diff">
  <summary class="config-diff__summary">View diff</summary>
  <pre class="config-diff__body">...</pre>
</details>

// AFTER
<oc-collapsible label="View diff">
  <pre class="config-diff__body">...</pre>
</oc-collapsible>
```

Usage filter panel (`usage.ts`):

```ts
// BEFORE
<details>
  <summary>
    <button class="btn btn--sm">Filters</button>
  </summary>
  ...filter content...
</details>

// AFTER — complex summary (button inside), use header slot
<oc-collapsible>
  <oc-button slot="header" size="sm">Filters</oc-button>
  ...filter content...
</oc-collapsible>
```

Session log tools (`usage-render-details.ts`):

```ts
// BEFORE
<details class="session-log-tools">
  <summary>${toolInfo.summary}</summary>
  ...
</details>

// AFTER
<oc-collapsible label=${toolInfo.summary}>
  ...
</oc-collapsible>
```

**Step 3: Verify zero bare details elements remain**

```bash
grep -rn '<details' ui/src/ui/views/
```

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/config.ts ui/src/ui/views/usage.ts ui/src/ui/views/usage-render-details.ts ui/src/ui/views/config-form.node.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace remaining details/summary with oc-collapsible"
```

---

### Task 17: oc-empty-state — "no X found" and loading states

**Files:**

- Modify: `ui/src/ui/views/sessions.ts`
- Modify: `ui/src/ui/views/agents.ts`
- Modify: `ui/src/ui/views/agents-panels-status-files.ts`
- Modify: `ui/src/ui/views/agents-panels-tools-skills.ts`
- Modify: `ui/src/ui/views/skills.ts`
- Modify: `ui/src/ui/views/nodes.ts`
- Modify: `ui/src/ui/views/config.ts`
- Modify: `ui/src/ui/views/chat.ts`
- Modify: `ui/src/ui/views/usage-render-details.ts`
- Modify: `ui/src/ui/views/channels.config.ts`

**Step 1: Find all empty/muted/loading patterns**

```bash
grep -rn '"muted".*No \|class="muted">No \|class="muted">Load' ui/src/ui/views/
```

**Step 2: Apply empty-state replacement**

```ts
// BEFORE — "no X found" pattern
html`<div class="muted">No sessions found.</div>`;

// AFTER
html`<oc-empty-state title="No sessions found."></oc-empty-state>`;

// BEFORE — loading pattern
html`<div class="muted">Loading chat…</div>`;

// AFTER
html`<oc-empty-state variant="loading" title="Loading chat…"></oc-empty-state>`;
```

Config loading spinner (`config.ts` ~line 692) — custom multi-element spinner:

```ts
// BEFORE
html`
  <div class="config-loading">
    <div class="config-loading__spinner"></div>
    <div class="config-loading__text">Loading config…</div>
  </div>
`;

// AFTER
html`<oc-empty-state variant="loading" title="Loading config…"></oc-empty-state>`;
```

**Skip:** `usage.ts:47–90` skeleton loader — this is a full multi-column animated skeleton, not a standard loading state. Leave as-is with a comment.

**Step 3: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace empty/loading div patterns with oc-empty-state"
```

---

### Task 18: oc-tabs — agents.ts renderAgentTabs()

This is a structural change: the tab buttons and panel content must be colocated inside `<oc-tab>` elements. Currently, the tab buttons are rendered by `renderAgentTabs()` and the panel content is rendered separately by the calling code.

**Files:**

- Modify: `ui/src/ui/views/agents.ts`

**Step 1: Read the current tab + panel structure**

```bash
grep -n 'renderAgentTabs\|activePanel\|agent-tabs\|AgentsPanel' ui/src/ui/views/agents.ts | head -40
```

Find where `renderAgentTabs` is called and where `activePanel` is used to conditionally render panels.

**Step 2: Understand current pattern**

The current structure is likely:

```ts
${renderAgentTabs(activePanel, onSelectPanel)}
${activePanel === "overview" ? renderAgentOverview(...) : nothing}
${activePanel === "files" ? renderAgentFiles(...) : nothing}
${activePanel === "tools" ? renderAgentTools(...) : nothing}
// ...etc
```

**Step 3: Restructure to oc-tabs**

```ts
// AFTER — wrap the conditional panel renders inside oc-tab elements
<oc-tabs .active=${activePanel} @oc-tab-change=${(e: CustomEvent<{value: string}>) => onSelectPanel(e.detail.value as AgentsPanel)}>
  <oc-tab value="overview" label="Overview">
    ${renderAgentOverview(...)}
  </oc-tab>
  <oc-tab value="files" label="Files">
    ${renderAgentFiles(...)}
  </oc-tab>
  <oc-tab value="tools" label="Tools">
    ${renderAgentTools(...)}
  </oc-tab>
  <oc-tab value="skills" label="Skills">
    ${renderAgentSkills(...)}
  </oc-tab>
  <oc-tab value="channels" label="Channels">
    ${renderAgentChannels(...)}
  </oc-tab>
  <oc-tab value="cron" label="Cron Jobs">
    ${renderAgentCron(...)}
  </oc-tab>
</oc-tabs>
```

Delete the `renderAgentTabs()` function entirely.

Note: with `oc-tab`, all panels are always rendered in the DOM (panel visibility is CSS-driven). If any panel does expensive async loading on render, consider gating with `activePanel === "..."` inside the slot.

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/agents.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace manual agent tabs with oc-tabs + oc-tab"
```

---

### Task 19: oc-modal — exec-approval.ts + gateway-url-confirmation.ts

**Files:**

- Modify: `ui/src/ui/views/exec-approval.ts`
- Modify: `ui/src/ui/views/gateway-url-confirmation.ts`

**Step 1: Read gateway-url-confirmation.ts**

```bash
grep -n '' ui/src/ui/views/gateway-url-confirmation.ts
```

**Step 2: Replace exec-approval overlay (exact source known)**

```ts
// BEFORE
export function renderExecApprovalPrompt(state: AppViewState) {
  const active = state.execApprovalQueue[0];
  if (!active) return nothing;
  ...
  return html`
    <div class="exec-approval-overlay" role="dialog" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">...</div>
        <div class="exec-approval-command mono">${request.command}</div>
        <div class="exec-approval-meta">...</div>
        ${error ? html`<div class="exec-approval-error">${error}</div>` : nothing}
        <div class="exec-approval-actions">
          <button class="btn primary" ...>Allow once</button>
          <button class="btn" ...>Always allow</button>
          <button class="btn danger" ...>Deny</button>
        </div>
      </div>
    </div>
  `;
}

// AFTER — keep the early-return guard; always render the modal as open when active
export function renderExecApprovalPrompt(state: AppViewState) {
  const active = state.execApprovalQueue[0];
  if (!active) return nothing;
  const request = active.request;
  const remainingMs = active.expiresAtMs - Date.now();
  const remaining = remainingMs > 0 ? `expires in ${formatRemaining(remainingMs)}` : "expired";
  const queueCount = state.execApprovalQueue.length;

  return html`
    <oc-modal heading="Exec approval needed" open .dismissible=${false}>
      <div class="exec-approval-sub">${remaining}</div>
      ${queueCount > 1
        ? html`<div class="exec-approval-queue">${queueCount} pending</div>`
        : nothing}
      <div class="exec-approval-command mono">${request.command}</div>
      <div class="exec-approval-meta">
        ${renderMetaRow("Host", request.host)}
        ${renderMetaRow("Agent", request.agentId)}
        ${renderMetaRow("Session", request.sessionKey)}
        ${renderMetaRow("CWD", request.cwd)}
        ${renderMetaRow("Resolved", request.resolvedPath)}
        ${renderMetaRow("Security", request.security)}
        ${renderMetaRow("Ask", request.ask)}
      </div>
      ${state.execApprovalError
        ? html`<oc-callout variant="danger">${state.execApprovalError}</oc-callout>`
        : nothing}

      <oc-button slot="footer" variant="primary"
        ?disabled=${state.execApprovalBusy}
        @click=${() => state.handleExecApprovalDecision("allow-once")}>
        Allow once
      </oc-button>
      <oc-button slot="footer"
        ?disabled=${state.execApprovalBusy}
        @click=${() => state.handleExecApprovalDecision("allow-always")}>
        Always allow
      </oc-button>
      <oc-button slot="footer" variant="danger"
        ?disabled=${state.execApprovalBusy}
        @click=${() => state.handleExecApprovalDecision("deny")}>
        Deny
      </oc-button>
    </oc-modal>
  `;
}
```

**Step 3: Replace gateway-url-confirmation overlay (read file first, apply same shape)**

Same overlay/card structure → `<oc-modal heading="..." open .dismissible=${false}>`.

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/exec-approval.ts ui/src/ui/views/gateway-url-confirmation.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace exec-approval overlay with oc-modal"
```

---

## Wave 5 — Icon Consolidation (do last)

This wave eliminates the three icon registries and the `icons.ts` module entirely.

### Task 20: oc-icon — config-form.node.ts local icons

This file has 5 local SVG definitions and 5 call sites. Smallest scope, do first to confirm the pattern works.

**Files:**

- Modify: `ui/src/ui/views/config-form.node.ts`

**Step 1: Find the local SVG definitions and call sites**

```bash
grep -n 'const chevronDown\|const plus\|const minus\|const trash\|icons\.' ui/src/ui/views/config-form.node.ts | head -20
```

**Step 2: Remove local SVG variable declarations**

Delete the `const chevronDown = svg\`...\``, `const plus = svg\`...\``, `const minus = svg\`...\``, `const trash = svg\`...\`` declarations (~lines 36–95).

**Step 3: Replace call sites**

```ts
// BEFORE (wherever chevronDown, plus, trash etc. are used in the template)
${chevronDown}
${plus}
${trash}

// AFTER
<oc-icon name="chevron-right"></oc-icon>
<oc-icon name="plus"></oc-icon>
<oc-icon name="trash"></oc-icon>
```

Verify the icon names exist in `OC_ICON_NAMES` from `oc-icon.ts`:

```bash
grep -o '"[a-z-]*"' ui/src/ui/components/oc-icon.ts | sort -u | head -40
```

**Step 4: Remove the `svg` import if no longer used**

```ts
// BEFORE (top of file)
import { html, svg, nothing } from "lit";

// AFTER (if svg is no longer needed)
import { html, nothing } from "lit";
```

**Step 5: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/config-form.node.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace local SVG icons with oc-icon in config-form.node.ts"
```

---

### Task 21: oc-icon — app-render.helpers.ts inline SVGs + icons.ts call sites

**Files:**

- Modify: `ui/src/ui/app-render.helpers.ts`
- Modify: `ui/src/ui/views/chat.ts`
- Modify: `ui/src/ui/views/markdown-sidebar.ts`
- Modify: `ui/src/ui/chat/copy-as-markdown.ts`
- Modify: `ui/src/ui/chat/tool-cards.ts`
- Modify: `ui/src/ui/app-render.ts`

**Step 1: Find all icons.ts call sites**

```bash
grep -rn 'icons\.' ui/src/ui/ | grep -v 'node_modules\|components/'
```

**Step 2: Replace each icons.X reference**

```ts
// BEFORE (in template)
${icons.brain}
${icons.book}
${icons.loader}
${icons.check}
${icons.x}

// AFTER
<oc-icon name="brain"></oc-icon>
<oc-icon name="book"></oc-icon>
<oc-icon name="loader"></oc-icon>
<oc-icon name="check"></oc-icon>
<oc-icon name="x"></oc-icon>
```

Dynamic icon reference in `app-render.helpers.ts` (`iconForTab(tab)`):

```ts
// BEFORE
<span class="nav-item__icon">${icons[iconForTab(tab)]}</span>

// AFTER
<span class="nav-item__icon"><oc-icon .name=${iconForTab(tab)}></oc-icon></span>
```

Remove `import { icons } from "./icons.ts"` from each file after all call sites are replaced.

**Step 3: Replace inline SVGs in app-render.helpers.ts (renderSunIcon, renderMoonIcon, renderMonitorIcon)**

```bash
grep -n 'renderSunIcon\|renderMoonIcon\|renderMonitorIcon\|viewBox' ui/src/ui/app-render.helpers.ts | head -20
```

```ts
// BEFORE
function renderSunIcon() { return svg`<svg ...>...</svg>`; }

// AFTER — delete the function, replace call sites with
<oc-icon name="sun"></oc-icon>
```

**Step 4: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/app-render.helpers.ts ui/src/ui/views/chat.ts ui/src/ui/views/markdown-sidebar.ts ui/src/ui/chat/ ui/src/ui/app-render.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace icons.ts call sites with oc-icon in app-render and chat"
```

---

### Task 22: oc-icon — config.ts sidebarIcons (31 SVGs, ~220 lines deleted)

**Files:**

- Modify: `ui/src/ui/views/config.ts`

**Step 1: Read sidebarIcons block and call sites**

```bash
grep -n 'sidebarIcons\|sectionIcons' ui/src/ui/views/config.ts | head -20
```

The `sidebarIcons` object is ~lines 38–260. Each entry is `name: svg\`...\``.

**Step 2: Find every use of sidebarIcons in the file**

```bash
grep -n 'sidebarIcons\[' ui/src/ui/views/config.ts
```

**Step 3: Replace call sites**

```ts
// BEFORE (wherever sidebarIcons is indexed)
${sidebarIcons["env"]}
${sidebarIcons[tab.id]}   // dynamic case

// AFTER
<oc-icon name="env"></oc-icon>
<oc-icon .name=${tab.id}></oc-icon>
```

**Step 4: Delete the sidebarIcons object and svg import**

Delete lines ~38–260 (the entire `const sidebarIcons = { ... }` block).

Remove `svg` from the lit import if no longer used after this deletion:

```ts
// BEFORE
import { html, svg, nothing } from "lit";
// AFTER (if svg no longer used)
import { html, nothing } from "lit";
```

**Step 5: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/config.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace sidebarIcons SVG registry with oc-icon in config.ts (−220 lines)"
```

---

### Task 23: oc-icon — config-form.render.ts sectionIcons (28 SVGs, ~213 lines deleted)

**Files:**

- Modify: `ui/src/ui/views/config-form.render.ts`

**Step 1: Find sectionIcons block and call sites**

```bash
grep -n 'sectionIcons' ui/src/ui/views/config-form.render.ts | head -10
```

**Step 2: Replace all call sites then delete the sectionIcons block**

Same pattern as Task 22. The `weight="light"` prop distinguishes these icons (stroke-width 1.5) from sidebarIcons (stroke-width 2):

```ts
// AFTER — use weight="light" to match original stroke-width 1.5
<oc-icon name="env" weight="light"></oc-icon>
```

**Step 3: Build + commit**

```bash
cd ui && npm run build
PATH="/opt/homebrew/bin:$PATH" git add ui/src/ui/views/config-form.render.ts
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): replace sectionIcons SVG registry with oc-icon in config-form.render.ts (−213 lines)"
```

---

### Task 24: Delete icons.ts

After Tasks 20–23, `icons.ts` should have zero import references.

**Files:**

- Delete: `ui/src/ui/icons.ts`

**Step 1: Verify zero references remain**

```bash
grep -rn 'from.*icons\|import.*icons' ui/src/ui/ | grep -v 'oc-icon\|node_modules'
```

Expected: zero matches.

**Step 2: Delete the file**

```bash
git rm ui/src/ui/icons.ts
```

**Step 3: Build — this is the final proof of full integration**

```bash
cd ui && npm run build
```

Expected: `✓ built` with no errors and no references to deleted icons.ts.

**Step 4: Final commit**

```bash
PATH="/opt/homebrew/bin:$PATH" git commit -m "refactor(ui): delete icons.ts — fully replaced by oc-icon component

All three icon registries (icons.ts, sidebarIcons in config.ts, sectionIcons
in config-form.render.ts) are now consolidated in the oc-icon component.
Approximately 450 lines of duplicated SVG definitions removed."
```

---

## Post-Integration Cleanup

After all 24 tasks, run the following to confirm the integration is complete:

```bash
# No bare class="callout" left
grep -rn 'class="callout' ui/src/ui/views/

# No bare class="card" left (except chat.ts TODO)
grep -rn 'class="card' ui/src/ui/views/ | grep -v 'chat\.ts'

# No bare class="btn" left
grep -rn 'class="btn' ui/src/ui/views/

# No bare class="field" left
grep -rn 'class="field' ui/src/ui/views/

# No bare class="statusDot" left
grep -rn 'class="statusDot' ui/src/ui/

# No bare class="pill" left (except custom compound pills like agent-pill)
grep -rn '"pill"' ui/src/ui/views/ | grep -v 'agent-pill\|cron-job'

# No icons.ts references
grep -rn 'from.*icons\b' ui/src/ui/

# Build is green
cd ui && npm run build
```

---

## Summary: What This Achieves

| Metric                  | Before    | After          |
| ----------------------- | --------- | -------------- |
| Inline SVG definitions  | ~450      | 0              |
| Bare callout divs       | ~55       | 0              |
| Bare card divs/sections | ~135      | 0              |
| Bare btn buttons        | ~105      | ~1 (chat send) |
| Bare field labels       | ~52       | 0              |
| Bare select elements    | ~27       | 0              |
| files.ts module         | exists    | deleted        |
| sidebarIcons object     | 220 lines | deleted        |
| sectionIcons object     | 213 lines | deleted        |
