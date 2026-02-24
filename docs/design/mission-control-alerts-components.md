# Mission Control — Alert UI Component Designs

> **Work Item:** `dgarson/clawdbot#bs-ux-4-alerts`  
> **Related:** `mission-control-alerts-spec.md`

---

## Component Architecture

```
AlertsProvider (Context)
├── NotificationCenter (Container)
│   ├── AlertHeader (Filters & Controls)
│   ├── AlertList (Virtualized List)
│   │   └── AlertGroup
│   │       └── AlertItem
│   │           ├── AlertBadge
│   │           ├── AlertIcon
│   │           ├── AlertContent
│   │           ├── AlertTimestamp
│   │           └── AlertActions
│   └── AlertDetails (Drill-Down Panel)
├── AlertToast (Transient Notifications)
└── AlertSettings (Configuration Panel)
```

---

## Core Components

### 1. NotificationCenter

**Purpose:** Main container for all alert-related UI

**Props:**

```typescript
interface NotificationCenterProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
  filter?: AlertPriority | "all";
  groupBy?: "time" | "category" | "source" | "none";
}
```

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Notifications                                    [Mark All] │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ [All] [Critical] [High] [Medium] [Low]           [⚙ Settings]│
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔴 CRITICAL                          2 minutes ago      │ │
│ │ Gateway process crashed                                 │ │
│ │ Process exited with code 1 at 14:23:05                 │ │
│ │                                                         │ │
│ │ [View Logs] [Restart Gateway] [Dismiss]                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟡 Connection Issues (3)                     5 min ago  │ │
│ │   • WhatsApp disconnected                               │ │
│ │   • Telegram reconnected                                │ │
│ │   • Discord rate limited                                │ │
│ │                          [Expand] [Dismiss All]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔵 Session Started                             12:34 PM │ │
│ │ Agent session abc123 initialized                       │ │
│ │ Model: claude-opus-4.6 | Tools: 15 active              │ │
│ │                                      [View Session] [✕] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│              [Show More (47 additional alerts)]             │
└─────────────────────────────────────────────────────────────┘
```

**States:**

- **Empty State**: "No notifications" with icon
- **Loading State**: Skeleton loaders
- **Error State**: "Failed to load notifications" with retry
- **Offline State**: "Connection lost" indicator

---

### 2. AlertItem

**Purpose:** Individual alert display with actions

**Props:**

```typescript
interface AlertItemProps {
  alert: Alert;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onDismiss?: () => void;
  onSnooze?: (duration: number) => void;
  onAction?: (actionId: string) => void;
  showActions?: boolean;
}

interface Alert {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  message: string;
  details?: string;
  timestamp: Date;
  source: string;
  isRead: boolean;
  isAcknowledged: boolean;
  actions: AlertAction[];
  metadata?: Record<string, unknown>;
}

type AlertPriority = "critical" | "high" | "medium" | "low" | "info";
type AlertCategory =
  | "system"
  | "channel"
  | "agent"
  | "session"
  | "security"
  | "config"
  | "cron"
  | "skill"
  | "node";
```

**Visual Design:**

**Critical Alert:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 CRITICAL                           ⚡ 2 minutes ago      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Gateway process crashed                                     │
│ Process exited with code 1 at 14:23:05. Last log:          │
│ "FATAL: Unhandled promise rejection..."                    │
│                                                            │
│ [👁 View Logs] [🔄 Restart Gateway] [⏰ Snooze] [✕ Dismiss]│
└─────────────────────────────────────────────────────────────┘
```

**High Alert:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🟠 HIGH                                        5 minutes ago│
│ WhatsApp connection lost                                    │
│ Failed to maintain WebSocket connection after 3 retries.   │
│ Last successful message: 14:18:32                          │
│                                                            │
│ [🔄 Retry Connection] [📊 View Logs] [✕ Dismiss]          │
└─────────────────────────────────────────────────────────────┘
```

**Medium Alert:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🟡 MEDIUM                                      10 minutes ago│
│ New device paired                                           │
│ Device "iPhone 15 Pro" paired successfully                 │
│ ID: device_abc123 | Platform: iOS 17.2                     │
│                                                            │
│ [👁 View Device] [✕ Dismiss]                               │
└─────────────────────────────────────────────────────────────┘
```

**Low Alert:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔵 Session Started                               12:34 PM   │
│ Agent session abc123 initialized                           │
│                                                            │
│ [👁 View Session] [✕ Dismiss]                              │
└─────────────────────────────────────────────────────────────┘
```

**Accessibility:**

```html
<div
  role="alert"
  aria-live="polite"
  aria-atomic="true"
  aria-label="${priority} alert: ${title}"
  className="alert-item"
>
  <span className="sr-only">${priority} priority</span>
  <!-- ... -->
</div>
```

---

### 3. AlertGroup

**Purpose:** Aggregate similar alerts

**Props:**

```typescript
interface AlertGroupProps {
  title: string;
  count: number;
  priority: AlertPriority;
  summary: string;
  timestamp: Date;
  isExpanded: boolean;
  onToggle: () => void;
  onDismissAll: () => void;
  children: React.ReactNode;
}
```

**Visual Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🟡 Connection Issues (3)                          5 min ago │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Multiple connectivity events detected                       │
│                                                            │
│ [▶ Expand] [✕ Dismiss All]                                │
└─────────────────────────────────────────────────────────────┘

                    ↓ Expanded

┌─────────────────────────────────────────────────────────────┐
│ 🟡 Connection Issues (3)                          5 min ago │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Multiple connectivity events detected                       │
│                                                            │
│   • WhatsApp disconnected (2 min ago)                      │
│   • Telegram reconnected (4 min ago)                       │
│   • Discord rate limited (5 min ago)                       │
│                                                            │
│ [▼ Collapse] [✕ Dismiss All]                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. AlertBadge

**Purpose:** Visual priority indicator

**Props:**

```typescript
interface AlertBadgeProps {
  priority: AlertPriority;
  count?: number;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}
```

**Variants:**

```
Critical:  🔴 (pulse animation)
High:      🟠
Medium:    🟡
Low:       🔵
Info:      ⚪

With Count:
🔴 3   (red badge with count)
```

**CSS Animation (Critical):**

```css
@keyframes alert-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
  }
}

.alert-badge-critical {
  animation: alert-pulse 2s ease-in-out infinite;
}
```

---

### 5. AlertActions

**Purpose:** Context-specific action buttons

**Props:**

```typescript
interface AlertActionsProps {
  actions: AlertAction[];
  alertId: string;
  onAction: (actionId: string) => void;
  layout?: "horizontal" | "dropdown";
}

interface AlertAction {
  id: string;
  label: string;
  icon?: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
  confirm?: ConfirmationDialog;
  loading?: boolean;
  disabled?: boolean;
}
```

**Layouts:**

**Horizontal (Default):**

```
[👁 View Logs] [🔄 Retry] [⏰ Snooze] [✕ Dismiss]
```

**Dropdown (Many Actions):**

```
[👁 View Details] [⋯ More ▼]
                  ├─ 🔄 Retry Connection
                  ├─ 📊 View Logs
                  ├─ ⏰ Snooze
                  └─ ✕ Dismiss
```

**Confirmation Dialog:**

```
┌─────────────────────────────────────────┐
│ ⚠️  Confirm Action                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                         │
│ Are you sure you want to restart the   │
│ gateway? This will disconnect all      │
│ active sessions.                        │
│                                         │
│         [Cancel]  [Restart Gateway]    │
└─────────────────────────────────────────┘
```

---

### 6. AlertToast

**Purpose:** Transient notification for new alerts

**Props:**

```typescript
interface AlertToastProps {
  alert: Alert;
  duration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  onDismiss: () => void;
  onExpand: () => void;
}
```

**Visual Design:**

```
┌─────────────────────────────────────────┐
│ 🔴 Gateway process crashed              │
│ Process exited with code 1              │
│                          [View] [✕]     │
└─────────────────────────────────────────┘
```

**Auto-Dismiss:**

- P0 (Critical): Never (requires manual dismiss)
- P1 (High): 10 seconds
- P2 (Medium): 7 seconds
- P3 (Low): 5 seconds

**Stack Behavior:**

```
┌────────────────────────────────┐
│ 🔴 Critical Alert 1       [✕] │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🟠 High Alert 2           [✕] │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🔵 Low Alert 3            [✕] │
└────────────────────────────────┘
```

---

### 7. AlertDetails

**Purpose:** Drill-down panel for detailed information

**Props:**

```typescript
interface AlertDetailsProps {
  alert: Alert;
  isOpen: boolean;
  onClose: () => void;
  position?: "modal" | "drawer" | "inline";
}
```

**Layout (Drawer):**

```
┌───────────────────────────────────────────────────────────┐
│ Alert Details                                        [✕] │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                           │
│ 🔴 CRITICAL                          2 minutes ago        │
│                                                           │
│ Gateway process crashed                                   │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Details                                                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Process exited with code 1 at 14:23:05                   │
│                                                           │
│ Last log entries:                                         │
│ [14:23:04] WARN: Memory usage at 92%                     │
│ [14:23:05] ERROR: Unhandled promise rejection            │
│ [14:23:05] FATAL: Process exiting...                     │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Context                                                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Source: Gateway                                           │
│ PID: 45678                                                │
│ Uptime: 3h 24m                                            │
│ Memory: 1.8 GB / 2.0 GB                                   │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Related Events                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ • Memory warning (5 min ago)                              │
│ • Session timeout (8 min ago)                             │
│ • Channel disconnected (10 min ago)                       │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Actions                                                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ [👁 View Full Logs]                                       │
│ [🔄 Restart Gateway]                                      │
│ [📧 Send Report]                                          │
│ [✕ Dismiss Alert]                                         │
└───────────────────────────────────────────────────────────┘
```

---

### 8. AlertSettings

**Purpose:** Configuration panel for notification preferences

**Props:**

```typescript
interface AlertSettingsProps {
  config: NotificationConfig;
  onUpdate: (config: NotificationConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
┌───────────────────────────────────────────────────────────┐
│ Notification Settings                                [✕] │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Channels                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                           │
│ In-App Notifications                       [Toggle: ON]   │
│ └─ Show badge counts                        [Toggle: ON]   │
│                                                           │
│ Push Notifications                         [Toggle: OFF]  │
│ └─ Minimum priority: [High ▼]                            │
│                                                           │
│ Slack Webhook                              [Toggle: OFF]  │
│ └─ Webhook URL: [________________________]                │
│ └─ Minimum priority: [Medium ▼]                          │
│                                                           │
│ Email Digest                               [Toggle: OFF]  │
│ └─ Frequency: [Hourly ▼]                                 │
│ └─ Recipients: [ops@example.com]                         │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Sounds & Haptics                                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                           │
│ Sound Notifications                        [Toggle: ON]   │
│ └─ Volume: [════════●───────────────] 70%                │
│                                                           │
│ Test Sound: [Critical] [High] [Medium] [Low]             │
│                                                           │
│ Quiet Hours                                [Toggle: ON]   │
│ └─ Start time: [22:00]                                   │
│ └─ End time: [07:00]                                     │
│ └─ Timezone: [America/Denver ▼]                          │
│ └─ Allow critical override: [Toggle: ON]                 │
│                                                           │
│ Haptic Feedback (Mobile)                   [Toggle: ON]   │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Priority Rules                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                           │
│ Auto-dismiss timing:                                      │
│ • Critical: Never                                         │
│ • High: [5 minutes ▼]                                    │
│ • Medium: [10 minutes ▼]                                 │
│ • Low: [30 minutes ▼]                                    │
│                                                           │
│ Snooze durations:                                         │
│ • High: [5, 15, 30 minutes]                              │
│ • Medium: [15, 30, 60 minutes]                           │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                           │
│                              [Cancel]  [Save Changes]     │
└───────────────────────────────────────────────────────────┘
```

---

## Responsive Design

### Mobile (< 768px)

- Notification center: Full-screen modal
- Alert actions: Collapse to dropdown
- Details panel: Full-screen slide-up
- Toasts: Full-width bottom position

### Tablet (768px - 1024px)

- Notification center: 50% width drawer
- Alert actions: Horizontal with overflow dropdown
- Details panel: Side drawer (75% width)

### Desktop (> 1024px)

- Notification center: 400px width drawer
- Alert actions: Horizontal layout
- Details panel: Side drawer (500px width)
- Toasts: Top-right corner (360px width)

---

## Theming

### CSS Custom Properties

```css
:root {
  /* Priority Colors */
  --alert-color-critical: #dc2626;
  --alert-color-high: #ea580c;
  --alert-color-medium: #ca8a04;
  --alert-color-low: #3b82f6;
  --alert-color-info: #6b7280;

  /* Background Colors */
  --alert-bg-critical: rgba(220, 38, 38, 0.1);
  --alert-bg-high: rgba(234, 88, 12, 0.1);
  --alert-bg-medium: rgba(202, 138, 4, 0.1);
  --alert-bg-low: rgba(59, 130, 246, 0.1);

  /* Spacing */
  --alert-padding: 16px;
  --alert-border-radius: 8px;
  --alert-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

  /* Typography */
  --alert-font-size-title: 14px;
  --alert-font-size-message: 13px;
  --alert-font-size-meta: 12px;

  /* Animation */
  --alert-transition: 200ms ease-in-out;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --alert-bg-critical: rgba(220, 38, 38, 0.2);
    --alert-bg-high: rgba(234, 88, 12, 0.2);
    --alert-bg-medium: rgba(202, 138, 4, 0.2);
    --alert-bg-low: rgba(59, 130, 246, 0.2);
  }
}
```

---

## Implementation Checklist

- [ ] NotificationCenter container with context provider
- [ ] AlertItem component with all priority variants
- [ ] AlertGroup with expand/collapse functionality
- [ ] AlertBadge with pulse animation
- [ ] AlertActions with confirmation dialogs
- [ ] AlertToast with auto-dismiss and stacking
- [ ] AlertDetails drawer with full context
- [ ] AlertSettings panel with form controls
- [ ] Responsive layouts for mobile/tablet/desktop
- [ ] Dark mode support
- [ ] Accessibility features (ARIA, keyboard nav, screen reader)
- [ ] Sound playback integration
- [ ] Haptic feedback (mobile)
- [ ] Virtualized list for performance
- [ ] Unit tests for all components
- [ ] Integration tests for alert flows
- [ ] E2E tests for critical paths

---

## Revision History

| Date       | Version | Author            | Changes                   |
| ---------- | ------- | ----------------- | ------------------------- |
| 2026-02-23 | 1.0     | Claire (UX Squad) | Initial component designs |
