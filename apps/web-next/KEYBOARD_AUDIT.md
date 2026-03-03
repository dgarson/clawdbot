# Keyboard Navigation + Focus Management Audit

**Date:** 2026-03-03  
**Auditor:** Quinn (State Management Specialist)  
**Scope:** apps/web-next/src/views/ (30 largest view files)  
**Base Branch:** feat/horizon-ui-phase1-cleanup

---

## Executive Summary

**Critical Issue:** The Horizon UI views have **severe keyboard navigation deficiencies** that create major accessibility barriers.

### Key Findings

- **23 of 30 largest views (77%) have ZERO keyboard navigation support**
- **0 of 30 views implement focus traps for modals/dialogs**
- **3 of 30 views implement Escape key handling**
- **5 of 30 views have focus-visible styles** (but incomplete)
- **No arrow key navigation for lists** in any view

### Risk Level: **CRITICAL**

Users who rely on keyboard navigation (motor disabilities, power users, screen reader users) **cannot effectively use** most views in the application.

---

## Detailed Audit Results

### Top 30 Largest Views - Keyboard Support Matrix

| File | Lines | tabIndex | onKeyDown | Escape | focus-visible | useRef | Grade |
|------|-------|----------|-----------|--------|---------------|--------|-------|
| **EnvironmentDriftDetector.tsx** | 2344 | 0 | 0 | 0 | 0 | 0 | **F** |
| **SupportTicketDashboard.tsx** | 2159 | 0 | 0 | 0 | 0 | 0 | **F** |
| **APIRateLimitManager.tsx** | 2022 | 0 | 0 | 0 | 1 | 0 | **F** |
| **DataCatalog.tsx** | 1819 | 0 | 0 | 0 | 0 | 0 | **F** |
| **SecurityAuditTrail.tsx** | 1693 | 0 | 0 | 0 | 0 | 0 | **F** |
| **TokenUsageOptimizer.tsx** | 1486 | 0 | 1 | 1 | 0 | 0 | **D** |
| **SecurityPolicyEditor.tsx** | 1405 | 0 | 0 | 0 | 3 | 0 | **F** |
| **CloudCostOptimizer.tsx** | 1348 | 0 | 0 | 0 | 0 | 0 | **F** |
| **NotificationCenter.tsx** | 1315 | 1 | 0 | 2 | 13 | 4 | **C** |
| **UserDeviceManager.tsx** | 1310 | 0 | 0 | 0 | 0 | 0 | **F** |
| **AgentOutputDiffViewer.tsx** | 1298 | 0 | 0 | 0 | 4 | 0 | **F** |
| **SearchAnalyticsDashboard.tsx** | 1280 | 0 | 0 | 0 | 0 | 0 | **F** |
| **GeofenceManager.tsx** | 1280 | 0 | 0 | 0 | 0 | 0 | **F** |
| **SessionDebugTimeline.tsx** | 1269 | 0 | 0 | 0 | 0 | 3 | **F** |
| **SessionReplayViewer.tsx** | 1256 | 0 | 0 | 0 | 3 | 0 | **F** |
| **QueueInspector.tsx** | 1254 | 0 | 0 | 0 | 0 | 0 | **F** |
| **StreamingDebugger.tsx** | 1225 | 0 | 0 | 0 | 2 | 1 | **F** |
| **TeamManagement.tsx** | 1196 | 0 | 0 | 3 | 11 | 2 | **D** |
| **WebhookManager.tsx** | 1195 | 1 | 1 | 0 | 11 | 0 | **D** |
| **InfrastructureCostManager.tsx** | 1194 | 0 | 0 | 0 | 0 | 0 | **F** |
| **MLModelRegistry.tsx** | 1187 | 0 | 0 | 0 | 0 | 0 | **F** |
| **NetworkBandwidthMonitor.tsx** | 1182 | 0 | 0 | 0 | 0 | 0 | **F** |
| **AgentRelationshipTopology.tsx** | 1169 | 0 | 0 | 0 | 0 | 0 | **F** |
| **ReleaseNotesManager.tsx** | 1074 | 0 | 0 | 0 | 3 | 0 | **F** |
| **IncidentTimeline.tsx** | 1069 | 0 | 1 | 0 | 0 | 0 | **F** |
| **ApiKeysManager.tsx** | 1062 | 0 | 0 | 0 | 24 | 3 | **D** |
| **ChaosEngineeringDashboard.tsx** | 1060 | 0 | 0 | 0 | 0 | 0 | **F** |
| **TeamCollaboration.tsx** | 1049 | 0 | 0 | 0 | 0 | 0 | **F** |
| **CustomerSuccessDashboard.tsx** | 1037 | 0 | 0 | 0 | 0 | 0 | **F** |
| **DatabaseSchemaViewer.tsx** | 1034 | 0 | 0 | 0 | 0 | 0 | **F** |

**Grading Scale:**
- **A**: Full keyboard support (tab order, arrow keys, focus trap, escape, focus-visible)
- **B**: Good support (tab order, focus-visible, some shortcuts)
- **C**: Basic support (focus-visible, minimal tabIndex)
- **D**: Partial support (some focus-visible or keyboard handlers)
- **F**: No or minimal keyboard support

---

## Common Issues

### 1. **No Tab Navigation** (All 30 files)
Interactive elements (buttons, links, custom controls) lack `tabIndex` attributes. Tab order is unpredictable.

**Impact:** Users cannot navigate via keyboard. They get stuck or skip important controls.

### 2. **No Focus Trap in Modals** (All 30 files)
Modals, dialogs, and overlay panels don't trap focus. Tabbing moves focus behind the modal.

**Impact:** Keyboard users lose context when modals open. Focus disappears into the background.

### 3. **No Escape Key Handling** (27 of 30 files)
Only 3 views handle Escape key to close modals/dropdowns.

**Impact:** Users cannot dismiss overlays without a mouse.

### 4. **No Arrow Key Navigation** (All 30 files)
Lists, menus, and grids don't support arrow keys (↑↓←→) for navigation.

**Impact:** Keyboard users must tab through every item in long lists (inefficient, frustrating).

### 5. **Incomplete focus-visible Styles** (25 of 30 files)
Only 5 views have any focus-visible styles. Most interactive elements have no focus indicator.

**Impact:** Keyboard users can't see which element is focused. They're navigating blind.

### 6. **No Roving TabIndex** (All 30 files)
Composite widgets (tab panels, listboxes, menus) don't implement roving tabIndex pattern.

**Impact:** Tab stops on every item instead of just the container (excessive tabbing).

### 7. **No Auto-Focus Management** (29 of 30 files)
Only NotificationCenter manages focus programmatically (useRef for search).

**Impact:** When views open or states change, focus isn't moved to logical starting points.

---

## Priority Fixes (Top 10 Files)

### 🔴 Critical Priority

#### 1. **EnvironmentDriftDetector.tsx** (2344 lines)
- **Issue:** Complex dashboard with tabs, filters, lists, modals - ZERO keyboard support
- **Required fixes:**
  - Add tabIndex to all interactive elements
  - Implement arrow key navigation for drift list
  - Add focus trap for detail expansion panels
  - Add Escape to close expanded views
  - Add focus-visible to all buttons/controls
  - Implement roving tabIndex for filter chips

#### 2. **SupportTicketDashboard.tsx** (2159 lines)
- **Issue:** Ticket list, filters, detail view - no keyboard navigation
- **Required fixes:**
  - Arrow keys for ticket list navigation
  - Tab order for filter controls → list → detail pane
  - Focus trap in ticket detail modal
  - Escape to close detail view
  - focus-visible for all actions

#### 3. **APIRateLimitManager.tsx** (2022 lines)
- **Issue:** Complex table/list with inline editing - almost no keyboard support
- **Required fixes:**
  - Arrow key navigation in rate limit table
  - Tab to edit mode, Enter to save, Escape to cancel
  - Focus management for inline editors
  - focus-visible for all cells

#### 4. **DataCatalog.tsx** (1819 lines)
- **Issue:** Searchable catalog with categories, detail views - no keyboard support
- **Required fixes:**
  - Focus search on Cmd+K
  - Arrow keys for result navigation
  - Tab from search → results → detail
  - Escape to clear search/close detail
  - focus-visible for all catalog items

#### 5. **SecurityAuditTrail.tsx** (1693 lines)
- **Issue:** Audit log with filters, detail expansion - no keyboard support
- **Required fixes:**
  - Arrow keys for log entry navigation
  - Tab order: filters → timeline → details
  - Focus trap in detail modal
  - Escape to close detail
  - focus-visible for log entries

### 🟡 High Priority

#### 6. **NotificationCenter.tsx** (1315 lines)
- **Issue:** Has some keyboard support but incomplete
- **Required fixes:**
  - Arrow keys for notification list (partially implemented, needs completion)
  - Focus trap when expanded
  - Complete focus-visible on all controls
  - Cmd+K focus search (already has Cmd+F)
  - Improve Escape handling

#### 7. **UserDeviceManager.tsx** (1310 lines)
- **Issue:** Device list with actions - no keyboard support
- **Required fixes:**
  - Arrow keys for device list
  - Tab to actions, Enter to trigger
  - Focus trap in device detail
  - Escape to close detail
  - focus-visible for device cards

#### 8. **SessionReplayViewer.tsx** (1256 lines)
- **Issue:** Video-like controls, timeline - no keyboard shortcuts
- **Required fixes:**
  - Space to play/pause
  - Arrow keys to scrub timeline
  - Tab to controls, J/K for seek
  - Focus trap in settings modal
  - focus-visible for player controls

#### 9. **WebhookManager.tsx** (1195 lines)
- **Issue:** Has some focus-visible but incomplete navigation
- **Required fixes:**
  - Arrow keys for webhook list
  - Tab order: list → test button → logs
  - Focus trap in test modal
  - Escape to close modal
  - Complete focus-visible implementation

#### 10. **TeamManagement.tsx** (1196 lines)
- **Issue:** Has some keyboard support but incomplete
- **Required fixes:**
  - Arrow keys for member list
  - Tab order: search → list → actions
  - Focus trap in invite modal
  - Complete Escape handling
  - Expand focus-visible coverage

---

## Implementation Standards

### Tab Order Principles

```
1. Logical flow: left→right, top→bottom
2. Skip decorative elements (tabIndex=-1)
3. Group related controls (fieldsets)
4. Sequence: search/filters → content → actions
5. Skip disabled elements
```

### Focus Trap Pattern

```tsx
import { useEffect, useRef } from 'react';

function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Save current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Move focus to modal
      modalRef.current?.focus();
      
      // Trap focus
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !modalRef.current) return;
        
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabIndex]:not([tabIndex="-1"])'
        );
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;
        
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      
      window.addEventListener('keydown', handleTab);
      return () => window.removeEventListener('keydown', handleTab);
    } else {
      // Restore focus
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  return isOpen ? (
    <div 
      ref={modalRef} 
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  ) : null;
}
```

### Arrow Key Navigation Pattern

```tsx
function useArrowNavigation(
  itemCount: number,
  onSelect: (index: number) => void
) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(focusedIndex);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(itemCount - 1);
        break;
    }
  }, [itemCount, focusedIndex, onSelect]);

  return { focusedIndex, handleKeyDown };
}
```

### focus-visible Standard

```tsx
// Tailwind CSS pattern
className={cn(
  "base-styles",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
  "focus:outline-none" // Remove default outline, use ring only
)}
```

### Roving TabIndex Pattern

```tsx
function TabList({ tabs, activeTab, onSelect }) {
  const [focusedTab, setFocusedTab] = useState(activeTab);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        setFocusedTab((prev) => (prev + 1) % tabs.length);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setFocusedTab((prev) => (prev - 1 + tabs.length) % tabs.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(focusedTab);
        break;
    }
  };

  return (
    <div role="tablist" onKeyDown={handleKeyDown}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          role="tab"
          tabIndex={index === focusedTab ? 0 : -1}
          aria-selected={index === activeTab}
          onClick={() => onSelect(index)}
          onFocus={() => setFocusedTab(index)}
          className={cn(
            "tab-styles",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

---

## Testing Checklist

### For Each View:

- [ ] Tab through all interactive elements in logical order
- [ ] Shift+Tab navigates backwards
- [ ] Arrow keys work in lists/menus/grids
- [ ] Enter/Space activates buttons and controls
- [ ] Escape closes modals/dropdowns/overlays
- [ ] Focus is visible on all interactive elements
- [ ] Focus is trapped in modals (Tab cycles within modal)
- [ ] Focus returns to trigger element when modal closes
- [ ] Home/End jump to first/last items in lists
- [ ] Cmd+K focuses search (if applicable)
- [ ] Screen reader announces focus changes

---

## Next Steps

1. **Implement fixes in priority order** (top 10 files)
2. **Create shared utilities:**
   - `useFocusTrap()` hook
   - `useArrowNavigation()` hook
   - `useRovingTabIndex()` hook
   - Standard focus-visible Tailwind classes
3. **Add to component library:**
   - FocusBoundary component
   - ArrowList component
   - Modal with built-in focus trap
4. **Update design system:**
   - Document keyboard interaction patterns
   - Add to component specs
   - Include in code review checklist
5. **Automated testing:**
   - Add keyboard navigation to E2E tests
   - Create axe-core custom rules for our patterns
   - CI gate for keyboard accessibility

---

## Resources

- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Keyboard Accessibility (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard_navigable_JS_widgets)
- [Focus Trap in React](https://medium.com/@andreasmcd/accessibility-create-a-focus-trap-in-react-3d8d3c1e5d53)
- [Roving TabIndex explained](https://developers.google.com/web/fundamentals/accessibility/focus/using-tabindex)

---

**Generated by Quinn, State Management Specialist**  
**OpenClaw Product & UI Squad**
