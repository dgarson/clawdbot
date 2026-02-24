# Mission Control — Alert & Notification Flows Specification

> **Work Item:** `dgarson/clawdbot#bs-ux-4-alerts`  
> **Squad:** UX  
> **Priority:** High  
> **Status:** In Progress

---

## Overview

This document specifies the alert and notification user experience for the Mission Control dashboard, providing operators with real-time awareness of system health, agent activities, and critical events requiring attention.

## Design Principles

1. **Signal Over Noise**: Minimize alert fatigue through intelligent grouping and prioritization
2. **Action-Oriented**: Every alert should offer clear, actionable paths
3. **Contextual**: Provide relevant context without overwhelming the operator
4. **Accessible**: Support visual, auditory, and haptic feedback channels
5. **Progressive Disclosure**: Show summary first, details on demand

---

## Alert Priority Levels

### Critical (P0)

**Definition:** Immediate system failure or security incident requiring instant attention

**Visual Treatment:**

- Color: `#DC2626` (red-600)
- Icon: `alert-octagon` with pulse animation
- Badge: Exclamation mark in circle
- Background: Subtle red tint (`bg-red-50`)

**Behavior:**

- Auto-expand in notification center
- Override "Do Not Disturb" mode
- Require explicit acknowledgment
- Sound: Urgent triple-chime (if enabled)
- Haptic: Strong vibration pattern (mobile)

**Examples:**

- Gateway process crashed
- Authentication failure spike
- Data loss detected
- Security breach attempt

### High (P1)

**Definition:** Significant degradation or failure affecting users

**Visual Treatment:**

- Color: `#EA580C` (orange-600)
- Icon: `alert-triangle` with subtle pulse
- Badge: Exclamation mark
- Background: Light orange tint (`bg-orange-50`)

**Behavior:**

- Prominent placement in notification center
- Sound: Double-chime (if enabled)
- Auto-dismiss after 5 minutes if not acknowledged
- Snooze available (5/15/30 minutes)

**Examples:**

- Channel connection lost (WhatsApp/Telegram/Discord/Slack)
- Agent timeout exceeded
- Rate limit approaching
- Memory usage > 85%

### Medium (P2)

**Definition:** Important event requiring awareness but not immediate action

**Visual Treatment:**

- Color: `#CA8A04` (yellow-600)
- Icon: `alert-circle`
- Badge: Filled circle
- Background: Light yellow tint (`bg-yellow-50`)

**Behavior:**

- Standard notification center placement
- Sound: Single chime (if enabled)
- Auto-dismiss after 10 minutes
- Snooze available (15/30/60 minutes)

**Examples:**

- New device paired
- Skill installed successfully
- Configuration drift detected
- Non-critical tool failure

### Low (P3)

**Definition:** Informational events for awareness

**Visual Treatment:**

- Color: `#3B82F6` (blue-500)
- Icon: `info`
- Badge: Unfilled circle
- Background: Transparent or light blue tint (`bg-blue-50`)

**Behavior:**

- Lower placement in notification center
- Silent by default
- Auto-dismiss after 30 minutes
- Grouped in daily digest option

**Examples:**

- Session started/ended
- Cron job completed
- Model fallback activated
- Cache cleared

### Info (P4)

**Definition:** Debugging and trace information

**Visual Treatment:**

- Color: `#6B7280` (gray-500)
- Icon: `minus-circle` or no icon
- Badge: None
- Background: Transparent

**Behavior:**

- Only visible in "Verbose" mode
- Silent
- Auto-dismiss after 1 hour
- Exportable to logs

**Examples:**

- Debug logs
- Performance metrics
- Internal state changes

---

## Notification Grouping & Deduplication

### Grouping Strategy

**Time-Window Grouping:**

- Group similar alerts within 60-second windows
- Display count badge: "3 similar alerts"
- Expand to show all instances on click

**Semantic Grouping:**

- Group by source (channel, agent, system)
- Group by category (connectivity, performance, security)
- Group by affected entity (session ID, channel name)

**Example Groups:**

```
┌─────────────────────────────────────────────────────────┐
│ 📡 Connection Issues (3)                          2m ago │
│    • WhatsApp disconnected                             │
│    • Telegram reconnected                              │
│    • Discord rate limited                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ⚡ Agent Performance (5)                          5m ago │
│    • Session abc123: timeout exceeded                  │
│    • Session def456: timeout exceeded                  │
│    • ... 3 more                                        │
└─────────────────────────────────────────────────────────┘
```

### Deduplication Rules

1. **Exact Match:** Suppress identical alerts within 5 minutes
2. **Fuzzy Match:** Aggregate similar error messages with variable parts
3. **Rate Limiting:** Max 10 alerts per source per minute, then group
4. **Cooldown:** After acknowledgment, suppress for 15 minutes

**Deduplication Key Format:**

```typescript
type DedupeKey = {
  source: string; // e.g., "channel:whatsapp"
  category: string; // e.g., "connectivity"
  fingerprint: string; // hash of normalized message
};
```

---

## Actionable Alerts

### Alert Actions Framework

Every alert supports standard actions plus custom actions:

**Standard Actions:**

- **Dismiss**: Remove from notification center
- **Snooze**: Temporarily hide (configurable duration)
- **View Details**: Open drill-down panel
- **Mark as Read**: Clear badge without dismissing

**Custom Actions (Context-Specific):**

```typescript
type AlertAction = {
  id: string;
  label: string;
  icon?: string;
  variant: "primary" | "secondary" | "danger";
  handler: (alert: Alert) => void | Promise<void>;
  confirm?: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  };
};
```

**Examples:**

| Alert Type           | Custom Actions                                      |
| -------------------- | --------------------------------------------------- |
| Channel disconnected | `Retry Connection`, `View Logs`, `Disable Channel`  |
| Agent timeout        | `Restart Session`, `Adjust Timeout`, `View Session` |
| Rate limit           | `Throttle Requests`, `View Usage`, `Upgrade Plan`   |
| Security event       | `Block IP`, `View Audit Log`, `Report Incident`     |

### Action Execution

- **Immediate**: Action executes without confirmation (low-risk)
- **Confirmed**: Show confirmation dialog (destructive actions)
- **Async**: Show progress indicator for long-running actions
- **Feedback**: Toast notification on success/failure

---

## Sound & Haptic Feedback

### Sound Configuration

```typescript
type SoundConfig = {
  enabled: boolean;
  volume: number; // 0-100
  prioritySounds: {
    [Priority.S0]: Sound | null;
    [Priority.P1]: Sound | null;
    [Priority.P2]: Sound | null;
    [Priority.P3]: Sound | null;
  };
  quietHours?: {
    start: string; // "22:00"
    end: string; // "07:00"
    timezone: string;
    allowCriticalOverride: boolean;
  };
};

type Sound = {
  id: string;
  name: string;
  url: string;
  duration: number; // milliseconds
};
```

**Default Sounds:**

- P0 (Critical): `urgent-triple-chime.wav` (1.2s)
- P1 (High): `alert-double-chime.wav` (0.8s)
- P2 (Medium): `notification-chime.wav` (0.5s)
- P3 (Low): `subtle-ping.wav` (0.3s)

### Haptic Feedback (Mobile)

```typescript
type HapticConfig = {
  enabled: boolean;
  priorityPatterns: {
    [Priority.P0]: HapticPattern;
    [Priority.P1]: HapticPattern;
    [Priority.P2]: HapticPattern;
    [Priority.P3]: null; // No haptic for low priority
  };
};

type HapticPattern = {
  type: "heavy" | "medium" | "light" | "selection";
  repeat: number;
  interval: number; // milliseconds
};
```

**Default Patterns:**

- P0 (Critical): Heavy, 3 repeats, 200ms interval
- P1 (High): Medium, 2 repeats, 150ms interval
- P2 (Medium): Light, 1 repeat, 0ms interval

---

## Integration with Existing Notification System

### Notification Channels

Mission Control alerts integrate with:

1. **In-App Notifications** (Control UI)
   - Real-time via WebSocket
   - Notification center panel
   - Badge counts in navigation

2. **Push Notifications** (Mobile Apps)
   - iOS/Android native push
   - Deep links to relevant screens
   - Respect system Do Not Disturb

3. **External Channels**
   - Slack webhook (optional)
   - Email digest (optional)
   - SMS for P0 (optional, requires config)

### Event Flow

```
Event Occurs
     ↓
Alert Engine
     ├─ Classify Priority
     ├─ Apply Deduplication
     ├─ Generate Actions
     └─ Route to Channels
          ↓
     Notification Delivery
          ├─ In-App (WebSocket)
          ├─ Push (APNs/FCM)
          ├─ Webhook (HTTP)
          └─ Email (SMTP)
```

### Configuration Schema

```json5
{
  notifications: {
    enabled: true,
    channels: {
      inApp: {
        enabled: true,
        showBadge: true,
        autoDismiss: {
          [Priority.P0]: false,
          [Priority.P1]: 300000,  // 5 minutes
          [Priority.P2]: 600000,  // 10 minutes
          [Priority.P3]: 1800000, // 30 minutes
        },
      },
      push: {
        enabled: true,
        minPriority: Priority.P1,
        quietHours: {
          start: "22:00",
          end: "07:00",
          timezone: "America/Denver",
          allowCriticalOverride: true,
        },
      },
      slack: {
        enabled: false,
        webhookUrl: "https://hooks.slack.com/...",
        minPriority: Priority.P2,
        channel: "#ops-alerts",
      },
      email: {
        enabled: false,
        minPriority: Priority.P1,
        recipients: ["ops@example.com"],
        digest: "hourly", // or "immediate", "daily"
      },
      sms: {
        enabled: false,
        minPriority: Priority.P0,
        recipients: ["+15550001234"],
      },
    },
    sounds: {
      enabled: true,
      volume: 70,
      quietHours: {
        start: "22:00",
        end: "07:00",
        timezone: "America/Denver",
      },
    },
    haptics: {
      enabled: true,
    },
  },
}
```

---

## UI Components

See `mission-control-alerts-components.md` for detailed component specifications.

## Interaction Patterns

See `mission-control-alerts-interactions.md` for user flow diagrams and interaction details.

---

## Implementation Notes

### Performance Considerations

- Notification center virtualizes long lists (react-window)
- Deduplication runs in Web Worker to avoid UI jank
- Sound preloading on app init
- Lazy-load alert details on drill-down

### Accessibility

- All alerts screen-reader compatible
- High contrast mode support
- Keyboard navigation (Tab, Enter, Escape)
- ARIA labels for all interactive elements
- Sound alternatives: visual flash option

### Testing Strategy

- Unit tests for priority classification
- Integration tests for deduplication
- E2E tests for notification flows
- A11y tests for screen readers
- Performance benchmarks for high-volume scenarios

---

## Success Metrics

1. **Alert Fatigue Reduction**: < 10% of alerts dismissed without action
2. **Response Time**: P0 alerts acknowledged within 2 minutes (avg)
3. **False Positive Rate**: < 5% of alerts marked as "not actionable"
4. **User Satisfaction**: > 4.0/5.0 rating in feedback survey
5. **System Reliability**: Alert system uptime > 99.9%

---

## Appendix: Alert Category Taxonomy

| Category   | Description                   | Example Events                    |
| ---------- | ----------------------------- | --------------------------------- |
| `system`   | Gateway/infrastructure events | Process crash, memory warning     |
| `channel`  | Messaging channel events      | Connection lost, rate limit       |
| `agent`    | Agent runtime events          | Timeout, tool failure, fallback   |
| `session`  | Session lifecycle events      | Start, end, reset                 |
| `security` | Security-related events       | Auth failure, suspicious activity |
| `config`   | Configuration events          | Drift, validation error           |
| `cron`     | Scheduled job events          | Failure, completion               |
| `skill`    | Skill management events       | Install, update, error            |
| `node`     | Device node events            | Pairing, disconnect               |

---

## Revision History

| Date       | Version | Author            | Changes               |
| ---------- | ------- | ----------------- | --------------------- |
| 2026-02-23 | 1.0     | Claire (UX Squad) | Initial specification |
