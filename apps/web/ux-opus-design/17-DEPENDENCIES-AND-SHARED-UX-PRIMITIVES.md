# Dependencies + Shared UX Primitives (apps/web)

This document lists the intended third-party libraries for common UX needs (drag-and-drop, editors, diffs), and defines a shared validation/error display spec. It exists to minimize reinventing the wheel and to keep UX quality high.

**Note:** This is a design/engineering planning doc. It does not add dependencies by itself.

## 0) Already in apps/web (Do Not Re-Introduce)

The following foundational UX libraries already exist in `apps/web/package.json` and should be reused:
- **Radix UI** primitives (via shadcn-style components)
- **TanStack Router** (URL state + routing)
- **TanStack Query** (data fetching + caching)
- **react-hook-form + zod** (form state + validation)
- **cmdk** (command palette primitives)
- **sonner** (toasts)
- **framer-motion** (animations)

## 1) Dependency Decisions (Proposed)

### 1.1 Drag-and-drop (fallback ordering, reorder lists)

Primary use cases:
- Reordering model fallback chains.
- Reordering lists in advanced configuration (future).

Options (ranked):

1) **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`)
   - Maturity: High
   - UX quality: High (requires intentional a11y work, but flexible)
   - Fit: Strong for modern React + custom UIs
   - Notes: Best default choice; composable primitives

2) **@hello-pangea/dnd** (react-beautiful-dnd successor)
   - Maturity: Medium-High
   - UX quality: High for list DnD with minimal effort
   - Fit: Good if React compatibility is confirmed for our stack
   - Notes: Great ergonomics; less flexible than dnd-kit

3) **SortableJS wrappers**
   - Maturity: High (SortableJS), but wrappers vary
   - UX quality: Medium
   - Fit: Risky for strict React patterns and a11y

Recommendation: **dnd-kit** unless the team prioritizes “fast list DnD” over flexibility and a11y control.

### 1.2 JSON editor + validation (Raw Config)

Primary use cases:
- Read-only JSON viewer with copy/download.
- Edit mode with JSON validation and clear error display.
- Optional: show config path breadcrumbs and inline errors.

Options (ranked):

1) **CodeMirror 6** (via a React wrapper)
   - Maturity: High
   - UX quality: High (fast, customizable, good for modern stacks)
   - Notes: Combine with a JSON parser for precise error locations.

2) **Monaco Editor**
   - Maturity: High
   - UX quality: Very high
   - Notes: Heavy bundle; best if we need diff editor and advanced language tooling.

3) **Textarea + formatter**
   - Maturity: N/A
   - UX quality: Low
   - Notes: Not acceptable for power users long-term.

Recommendation: **CodeMirror 6** unless the roadmap requires Monaco’s diff editor soon.

### 1.3 Diff viewer (agent vs defaults, overrides)

Primary use cases:
- Diff: system defaults vs agent overrides.
- Diff: “before” vs “after” when a user edits.

Options (ranked):

1) **Monaco diff editor**
   - UX quality: Very high
   - Cost: high (bundle + complexity)
   - Best for: deep power-user tooling

2) **React diff viewer components** (line-based)
   - UX quality: Medium-High
   - Cost: low-medium
   - Best for: quick readable diffs without heavy editor tooling

3) **Custom diff rendering**
   - UX quality: variable
   - Cost: high (reinventing)

Recommendation: start with a **lightweight diff viewer**; keep Monaco as an optional future upgrade if the product becomes “config heavy”.

## 2) SystemDefaultToggle Variants (Known UX States)

This component is central to “inherit vs override” UX. Variants to support:

1) **Inherited**
   - Toggle state: ON (“Use system default”)
   - Controls: disabled
   - Display: show current inherited value + source (“from system defaults”)

2) **Overridden**
   - Toggle state: OFF
   - Controls: enabled
   - Display: show reset-to-default affordance

3) **Group override (multi-field section)**
   - A top-level toggle controls whether the section inherits defaults.
   - When inheriting: show a short summary of current inherited values.
   - When overridden: show individual controls + per-field reset where practical.

4) **Unsupported (capability-gated)**
   - If a user attempts to override a field not supported by the current provider/runtime:
     - show disabled control with explanation, and/or hide it consistently.
   - This is a variant of error/disabled state, not a separate “toggle type”.

## 3) Validation + Error Display Spec (Canonical)

This is the shared UX contract for all configuration forms.

### 3.1 Principles
- Prefer **inline** errors for field-level issues.
- Use **section-level** banners for save failures affecting multiple fields.
- Use **toasts** only for transient, non-blocking feedback (e.g. “Saved”).
- Always preserve user input on failure (no silent resets).

### 3.2 Field-level validation

Required behaviors:
- Errors appear directly under the field.
- Use `aria-describedby` to connect input → helper text → error message.
- Inputs with errors must have:
  - visual error state
  - accessible error text
- On submit (or “save”), focus the first invalid field.

### 3.3 Autosave / persistence errors

If a PATCH/save fails:
- Show a persistent banner at the top of the section:
  - “Failed to save changes”
  - Retry / Undo / Copy changes
- Inline, mark which fields are “unsaved” if known.
- Provide a clear statement: “Your edits are still visible locally.”

### 3.4 Provider test errors

Connection tests must show:
- success/failure state
- safe error message (no secret leakage)
- “Test again” CTA
- “Edit credentials” CTA

### 3.5 Models list fetch failure

Must distinguish:
- “No models available for this provider”
- “Unable to load models (network/auth)”

Provide Retry and allow unrelated saves.
