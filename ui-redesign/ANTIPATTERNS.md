# Current UI Antipatterns

This document captures the issues with the current Lit-based UI that the redesign should avoid.

---

## 1. God Object State Management

**Current:** `app.ts` has 100+ `@state()` decorators in a single class.

```typescript
// Current: Everything in one place
@state() chatLoading = false;
@state() chatSending = false;
@state() chatMessage = "";
@state() chatMessages: unknown[] = [];
@state() chatToolMessages: unknown[] = [];
@state() chatStream: string | null = null;
@state() channelsLoading = false;
@state() channelsSnapshot: ChannelsStatusSnapshot | null = null;
// ... 80+ more state properties
```

**Problem:**
- Impossible to reason about state changes
- Every render re-evaluates all state
- No isolation between concerns
- Testing requires mocking everything

**Fix:**
- Split into domain-specific stores (chat, channels, config, etc.)
- Use React Query for server state (auto-handles loading/error/data)
- Use Zustand for UI state (theme, sidebar, etc.)

---

## 2. Inline Styles Everywhere

**Current:**
```typescript
html`
  <div class="muted" style="margin-top: 8px">
    This gateway requires auth.
    <div style="margin-top: 6px">
      <span class="mono">openclaw dashboard</span>
    </div>
  </div>
`
```

**Problem:**
- Inconsistent spacing throughout
- No design system enforcement
- Hard to update globally
- Mixing concerns in templates

**Fix:**
- Use Tailwind utilities with consistent spacing scale
- `mt-2` instead of `style="margin-top: 8px"`
- Component variants for common patterns

---

## 3. Type Casting Hacks

**Current:**
```typescript
handleConnected(this as unknown as Parameters<typeof handleConnected>[0]);
handleChatScrollInternal(
  this as unknown as Parameters<typeof handleChatScrollInternal>[0],
  event,
);
```

**Problem:**
- Bypasses TypeScript's type safety
- Indicates architecture issues
- Error-prone refactoring

**Fix:**
- Proper typing from the start
- React's props system naturally solves this
- Use generics where needed

---

## 4. Massive Prop Objects

**Current:**
```typescript
export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
};
```

**Problem:**
- Views coupled to parent's state shape
- Adding features requires modifying prop types all the way up
- Tedious testing

**Fix:**
- Components fetch their own data via hooks
- Only pass props that are truly component-specific
- Context for cross-cutting concerns (theme, user, gateway)

---

## 5. Mixed Concerns in Views

**Current:** Views contain formatting logic, business logic, and rendering:

```typescript
export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | { uptimeMs?: number; policy?: { tickIntervalMs?: number } }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationMs(snapshot.uptimeMs) : "n/a";
  const tick = snapshot?.policy?.tickIntervalMs ? `${snapshot.policy.tickIntervalMs}ms` : "n/a";
  const authHint = (() => {
    // 30 lines of conditional logic...
  })();
  // ... more inline logic
  return html`...`;
}
```

**Problem:**
- Views are hard to test
- Logic is duplicated
- Hard to reuse formatting

**Fix:**
- Extract formatters to utilities
- Business logic in hooks or stores
- Views are pure presentation
- Test logic separately from rendering

---

## 6. CSS Class Soup

**Current:** Mix of utility classes, BEM-ish classes, and semantic classes:

```html
<section class="grid grid-cols-2">
  <div class="card">
    <div class="card-title">Gateway Access</div>
    <div class="card-sub">...</div>
    <div class="form-grid" style="margin-top: 16px;">
      <label class="field">
```

**Problem:**
- Inconsistent naming conventions
- Some utilities (`grid-cols-2`), some components (`.card`)
- Hard to know what's available

**Fix:**
- Consistent Tailwind utilities for layout/spacing
- Shadcn components for semantic elements
- No custom CSS classes unless necessary

---

## 7. Manual Event Handlers with Inline Functions

**Current:**
```typescript
@input=${(e: Event) => {
  const v = (e.target as HTMLInputElement).value;
  props.onSettingsChange({ ...props.settings, gatewayUrl: v });
}}
```

**Problem:**
- Creates new function every render
- Type casting required
- Verbose

**Fix:**
- React's controlled inputs
- React Hook Form for forms
- Named handlers when needed

---

## 8. No Component Isolation

**Current:** All styles are global, components share CSS:

```typescript
createRenderRoot() {
  return this;  // Disables Shadow DOM
}
```

All CSS files are imported globally and share a namespace.

**Problem:**
- Style collisions
- Hard to reason about what styles apply
- Can't safely delete CSS

**Fix:**
- Tailwind scopes by class usage
- Shadcn components are self-contained
- CSS Modules if custom styles needed

---

## 9. Lit-Specific Patterns That Don't Translate

**Current:**
```typescript
@customElement("openclaw-app")
export class OpenClawApp extends LitElement {
  @state() tab: Tab = "chat";
  // ...
}
```

**Problem:**
- Web Components have different lifecycle
- Decorators are non-standard
- Template syntax (`html``) is Lit-specific
- Not as widely supported in tooling

**Fix:**
- Standard React components
- Hooks for lifecycle
- JSX for templates
- Better IDE/tooling support

---

## 10. Fragmented File Organization

**Current:**
```
ui/src/ui/
├── app.ts              # Main component + all state
├── app-chat.ts         # Chat handlers (extracted)
├── app-channels.ts     # Channel handlers (extracted)
├── app-gateway.ts      # Gateway handlers (extracted)
├── app-lifecycle.ts    # Lifecycle handlers (extracted)
├── app-render.ts       # Render function (extracted)
├── app-scroll.ts       # Scroll handlers (extracted)
├── app-settings.ts     # Settings handlers (extracted)
├── app-tool-stream.ts  # Tool stream handlers (extracted)
└── ...
```

**Problem:**
- State is in `app.ts`, handlers elsewhere
- Have to jump between files to understand flow
- Not organized by feature

**Fix:**
- Feature-based organization
- Co-locate components, hooks, types by feature
- Clear module boundaries

---

## Summary Table

| Issue | Current | Target |
|-------|---------|--------|
| State management | 100+ @state in one class | React Query + Zustand |
| Styling | Inline styles + class soup | Tailwind + Shadcn |
| Type safety | `as unknown as` casts | Proper generics |
| Data flow | Props drilling | Hooks + context |
| Concerns | Mixed in views | Separated layers |
| Components | Global CSS, no isolation | Scoped, composable |
| Event handling | Inline functions | Controlled + RHF |
| Organization | State/handlers split | Feature-based |
