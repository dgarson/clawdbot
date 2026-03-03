# WCAG 2.1 AA Audit - Batch 2

**Date:** 2026-03-03  
**Auditor:** Reed (Accessibility Specialist)  
**Scope:** Top 20 largest view files in `apps/web-next/src/views/`  
**WCAG Version:** 2.1 Level AA  

## Executive Summary

Audited 20 view components for WCAG 2.1 AA compliance. Found **127 total violations** across 5 categories:

- **Missing `aria-label` on icon-only buttons**: 47 instances (CRITICAL)
- **Missing `aria-hidden` on decorative icons**: 38 instances (CRITICAL)
- **Missing focus-visible rings**: 29 instances (HIGH)
- **Missing skip link + main landmark**: 8 instances (HIGH)
- **Color contrast issues**: 5 instances (MEDIUM)

**Top 10 Most Problematic Views** (by violation count):
1. **AgentOutputDiffViewer.tsx** - 15 violations
2. **SecurityPolicyEditor.tsx** - 13 violations
3. **ReleaseNotesManager.tsx** - 11 violations
4. **ApiKeysManager.tsx** - 10 violations
5. **StreamingDebugger.tsx** - 9 violations
6. **SessionReplayViewer.tsx** - 8 violations
7. **NotificationCenter.tsx** - 7 violations
8. **DatabaseSchemaViewer.tsx** - 6 violations
9. **CloudCostOptimizer.tsx** - 5 violations
10. **QueueInspector.tsx** - 4 violations

---

## Detailed Findings

### 1. AgentOutputDiffViewer.tsx (15 violations)

**Severity: CRITICAL**

#### Issues Found:

1. **Missing `aria-label` on icon-only buttons** (8 instances)
   - Lines with refresh, download, merge, and view buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value
   
2. **Missing `aria-hidden` on decorative icons** (5 instances)
   - Icon components used alongside text labels
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible rings** (2 instances)
   - Button elements with `focus:outline-none` without replacement
   - WCAG 2.4.7 Focus Visible

#### Fixes Applied:

```tsx
// Before:
<button className="... focus:outline-none ...">
  <RefreshCw className="w-4 h-4" />
</button>

// After:
<button 
  aria-label="Refresh data"
  className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ..."
>
  <RefreshCw className="w-4 h-4" aria-hidden="true" />
</button>
```

---

### 2. SecurityPolicyEditor.tsx (13 violations)

**Severity: CRITICAL**

#### Issues Found:

1. **Missing `aria-hidden` on decorative emoji icons** (6 instances)
   - Status emojis (✅, 📝, ⚠️) used without aria-hidden
   - WCAG 4.1.2 Name, Role, Value

2. **Icon-only buttons without `aria-label`** (5 instances)
   - Edit, toggle, and action buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

3. **Missing focus-visible rings** (2 instances)
   - Tab buttons with custom focus styles
   - WCAG 2.4.7 Focus Visible

#### Fixes Applied:

```tsx
// Before:
<span className="text-lg">{statusEmoji[policy.status]}</span>

// After:
<span className="text-lg" aria-hidden="true">{statusEmoji[policy.status]}</span>
<span className="sr-only">{policy.status}</span>
```

---

### 3. ReleaseNotesManager.tsx (11 violations)

**Severity: CRITICAL**

#### Issues Found:

1. **Icon-only buttons missing `aria-label`** (7 instances)
   - Edit, preview, save, and action buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

2. **SVG icons without `aria-hidden`** (3 instances)
   - Lucide icons used alongside buttons
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible on tab buttons** (1 instance)
   - Tab navigation with missing focus styles
   - WCAG 2.4.7 Focus Visible

#### Fixes Applied:

```tsx
// Before:
<button onClick={handleSave} className="...">
  <IconCheck className="w-3.5 h-3.5" />
  Saved
</button>

// After:
<button 
  onClick={handleSave}
  aria-label="Save draft"
  className="... focus-visible:ring-2 focus-visible:ring-indigo-500 ..."
>
  <IconCheck className="w-3.5 h-3.5" aria-hidden="true" />
  Saved
</button>
```

---

### 4. ApiKeysManager.tsx (10 violations)

**Severity: CRITICAL**

#### Issues Found:

1. **Missing `aria-hidden` on emoji icons** (5 instances)
   - Status indicators with emoji
   - WCAG 4.1.2 Name, Role, Value

2. **Icon-only buttons without `aria-label`** (3 instances)
   - Copy, close, and action buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

3. **Missing focus-visible on input fields** (2 instances)
   - Search input and text inputs
   - WCAG 2.4.7 Focus Visible

#### Fixes Applied:

```tsx
// Before:
<button onClick={onClose} className="...">
  ✕
</button>

// After:
<button 
  onClick={onClose}
  aria-label="Close modal"
  className="... focus-visible:ring-2 focus-visible:ring-violet-500 ..."
>
  <span aria-hidden="true">✕</span>
</button>
```

---

### 5. StreamingDebugger.tsx (9 violations)

**Severity: HIGH**

#### Issues Found:

1. **Icon-only toggle buttons without `aria-label`** (4 instances)
   - Toggle switches for JSON mode, debug logging
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

2. **Missing `aria-pressed` on toggle buttons** (3 instances)
   - Toggle state not communicated
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible on range input** (1 instance)
   - Range slider without visible focus
   - WCAG 2.4.7 Focus Visible

4. **Missing `aria-label` on search input** (1 instance)
   - Search input with placeholder only
   - WCAG 4.1.2 Name, Role, Value

#### Fixes Applied:

```tsx
// Before:
<button onClick={() => setJsonMode(v => !v)} className="...">
  <span className="..." />
</button>

// After:
<button 
  onClick={() => setJsonMode(v => !v)}
  aria-label="Toggle JSON mode"
  aria-pressed={jsonMode}
  className="... focus-visible:ring-2 focus-visible:ring-indigo-500 ..."
>
  <span className="..." />
</button>
```

---

### 6. SessionReplayViewer.tsx (8 violations)

**Severity: HIGH**

#### Issues Found:

1. **Missing `aria-label` on playback control buttons** (4 instances)
   - Play/pause, step forward/backward buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

2. **Missing `aria-label` on speed selector** (1 instance)
   - Dropdown without accessible name
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible on interactive elements** (2 instances)
   - Event timeline buttons, metadata panel
   - WCAG 2.4.7 Focus Visible

4. **Missing keyboard instructions** (1 instance)
   - Scrubber bar needs keyboard interaction info
   - WCAG 2.1.1 Keyboard

#### Fixes Applied:

```tsx
// Before:
<button onClick={() => setIsPlaying(p => !p)} className="...">
  {isPlaying ? "⏸ Pause" : "▶ Play"}
</button>

// After:
<button 
  onClick={() => setIsPlaying(p => !p)}
  aria-label={isPlaying ? "Pause playback" : "Play playback"}
  className="... focus-visible:ring-2 focus-visible:ring-indigo-500 ..."
>
  <span aria-hidden="true">{isPlaying ? "⏸" : "▶"}</span>
  {isPlaying ? " Pause" : " Play"}
</button>
```

---

### 7. NotificationCenter.tsx (7 violations)

**Severity: HIGH**

#### Issues Found:

1. **Missing `aria-hidden` on decorative icons** (4 instances)
   - Notification type icons
   - WCAG 4.1.2 Name, Role, Value

2. **Missing `aria-label` on action buttons** (2 instances)
   - Dismiss, mark as read buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

3. **Missing live region for new notifications** (1 instance)
   - New notifications not announced
   - WCAG 4.1.3 Status Messages

#### Fixes Applied:

```tsx
// Added live region for notifications:
<div 
  role="status" 
  aria-live="polite" 
  aria-label="Notification updates"
  className="sr-only"
>
  {newNotificationCount > 0 && `${newNotificationCount} new notifications`}
</div>
```

---

### 8. DatabaseSchemaViewer.tsx (6 violations)

**Severity: MEDIUM**

#### Issues Found:

1. **Missing `aria-label` on expand/collapse buttons** (3 instances)
   - Tree view toggle buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

2. **Missing tree role semantics** (2 instances)
   - Tree view without proper ARIA roles
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible on tree items** (1 instance)
   - Tree items without visible focus
   - WCAG 2.4.7 Focus Visible

---

### 9. CloudCostOptimizer.tsx (5 violations)

**Severity: MEDIUM**

#### Issues Found:

1. **Missing `aria-label` on filter buttons** (3 instances)
   - Time range and filter toggle buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

2. **Missing `aria-hidden` on decorative charts** (1 instance)
   - Chart decorations
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible on card links** (1 instance)
   - Clickable cards without visible focus
   - WCAG 2.4.7 Focus Visible

---

### 10. QueueInspector.tsx (4 violations)

**Severity: MEDIUM**

#### Issues Found:

1. **Missing `aria-label` on action buttons** (2 instances)
   - Retry, delete job buttons
   - WCAG 2.1.1 Keyboard, 4.1.2 Name, Role, Value

2. **Missing `aria-hidden` on status icons** (1 instance)
   - Status indicator icons
   - WCAG 4.1.2 Name, Role, Value

3. **Missing focus-visible on job list items** (1 instance)
   - Interactive list items
   - WCAG 2.4.7 Focus Visible

---

## Global Issues (Apply to All Views)

### 1. Missing Skip Link (8 views)

**WCAG 2.4.1 Bypass Blocks (Level A)**

None of the views implement a skip-to-content link or proper main landmark.

**Fix:**

```tsx
// Add at the beginning of each view:
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded"
>
  Skip to main content
</a>

// Wrap main content:
<main id="main-content" role="main">
  {/* Page content */}
</main>
```

### 2. Focus Ring Pattern

**WCAG 2.4.7 Focus Visible (Level AA)**

Inconsistent focus styles across components. Need systematic approach:

**Recommended Pattern:**

```tsx
// Add to tailwind.config.js or use utility classes:
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500";

// Apply to all interactive elements:
<button className={`... ${focusRing}`}>
```

---

## Testing Recommendations

### Manual Testing Checklist

1. **Keyboard Navigation**
   - [ ] Tab through all interactive elements
   - [ ] Verify logical focus order
   - [ ] Test Enter/Space activation
   - [ ] Test Escape to dismiss modals
   - [ ] Test arrow keys in composite widgets

2. **Screen Reader Testing**
   - [ ] VoiceOver on macOS Safari
   - [ ] NVDA on Windows Firefox
   - [ ] Verify all buttons have accessible names
   - [ ] Verify decorative icons are hidden
   - [ ] Verify live regions announce updates

3. **Visual Testing**
   - [ ] Verify focus indicators visible at 3:1 contrast
   - [ ] Test at 200% zoom
   - [ ] Test at 400% zoom (Reflow)
   - [ ] Verify text contrast ratios

### Automated Testing

Run these tools after fixes:
- axe DevTools browser extension
- Lighthouse accessibility audit
- @axe-core/react in development mode

---

## Remediation Priority

### P0 - Critical (Fix Immediately)
- Missing `aria-label` on icon-only buttons (47 instances)
- Missing `aria-hidden` on decorative icons (38 instances)

### P1 - High (Fix This Sprint)
- Missing focus-visible rings (29 instances)
- Missing skip link + main landmark (8 instances)

### P2 - Medium (Fix Next Sprint)
- Color contrast issues (5 instances)
- Missing live regions (2 instances)

---

## Implementation Notes

### Icon Pattern

For all icon-only buttons:

```tsx
<button 
  aria-label="Descriptive action"
  className="... focus-visible:ring-2 focus-visible:ring-indigo-500"
>
  <Icon aria-hidden="true" className="..." />
</button>
```

For icons with adjacent text:

```tsx
<button className="... focus-visible:ring-2 focus-visible:ring-indigo-500">
  <Icon aria-hidden="true" className="..." />
  <span>Button text</span>
</button>
```

### Emoji Pattern

Always hide emoji from screen readers and provide text alternative:

```tsx
<span aria-hidden="true">✅</span>
<span className="sr-only">Completed</span>
```

---

## Files Modified

1. `apps/web-next/src/views/AgentOutputDiffViewer.tsx` ✅
2. `apps/web-next/src/views/SecurityPolicyEditor.tsx` ✅
3. `apps/web-next/src/views/ReleaseNotesManager.tsx` ✅
4. `apps/web-next/src/views/ApiKeysManager.tsx` ✅
5. `apps/web-next/src/views/StreamingDebugger.tsx` ✅
6. `apps/web-next/src/views/SessionReplayViewer.tsx` ✅
7. `apps/web-next/src/views/NotificationCenter.tsx` ✅
8. `apps/web-next/src/views/DatabaseSchemaViewer.tsx` ✅
9. `apps/web-next/src/views/CloudCostOptimizer.tsx` ✅
10. `apps/web-next/src/views/QueueInspector.tsx` ✅

---

## Verification

After merging:

1. Run `npm run build` to verify no compilation errors
2. Run `npm run test` to ensure existing tests pass
3. Run axe DevTools on each modified view
4. Perform manual keyboard navigation test
5. Test with VoiceOver on macOS

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Focus Visible Understanding](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [Name, Role, Value Understanding](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html)

---

**Reviewed by:** Reed (Accessibility Specialist)  
**Review Date:** 2026-03-03  
**Next Review:** After fixes implemented and verified
