# Onboarding Tour: Wireframes & Interactive Prototype

> **Target Implementation:** `apps/web/src/components/domain/onboarding/`
>
> **Last Updated:** 2026-02-24
>
> **Status:** Active Design Phase - Wireframes & Prototype Specification

---

## Overview

This document provides wireframes and interactive prototype specifications for the Clawdbrain onboarding tour. The onboarding tour guides new users through essential setup steps to get started with their AI-powered assistant.

### Related Documentation

- **UX Spec:** `18-ONBOARDING-AND-WIZARDS.md`
- **Implementation:** `apps/web/src/components/domain/onboarding/`
- **Route:** `apps/web/src/routes/onboarding/index.tsx`
- **Components:** `apps/web/src/components/domain/onboarding/steps/`

---

## Design System

### Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Primary | `hsl(var(--primary))` | Main CTA buttons, icons, accents |
| Primary Foreground | `hsl(var(--primary-foreground))` | Text on primary color |
| Background | `hsl(var(--background))` | Page background |
| Foreground | `hsl(var(--foreground))` | Primary text |
| Muted | `hsl(var(--muted))` | Secondary backgrounds, cards |
| Muted Foreground | `hsl(var(--muted-foreground))` | Secondary text |
| Border | `hsl(var(--border))` | Borders, dividers |
| Success | `hsl(142, 71%, 45%)` | Success states, completion |

### Typography

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| H1 | `text-3xl sm:text-4xl` | `bold` | Step titles |
| H2 | `text-2xl` | `semibold` | Section headers |
| H3 | `text-lg` | `medium` | Feature titles |
| Body | `text-base` | `normal` | Descriptions |
| Small | `text-sm` | `normal` | Helper text |
| XSmall | `text-xs` | `normal` | Labels, tips |

### Spacing

- **Page padding:** `px-4` (1rem)
- **Section spacing:** `mb-8` to `mb-10` (2rem to 2.5rem)
- **Card padding:** `p-4` (1rem)
- **Button padding:** `px-6` to `px-8` (1.5rem to 2rem)

### Animation

Using **Framer Motion** for smooth transitions:

- **Entrance:** Fade in + slide up (duration: 0.2-0.4s, staggered)
- **Exit:** Fade out + slide down
- **Icon animations:** Spring animations (duration: 0.6-0.8s)
- **Progress:** Smooth width transitions
- **Confetti:** Particle system with gravity

---

## Wireframes

### Step 0: Welcome

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        [X] (close button)                      │
│                                                                 │
│                                                                 │
│                        ┌─────────┐                             │
│                        │  ✨   │  ← Animated icon              │
│                        │       │    with glow effect           │
│                        └─────────┘                             │
│                                                                 │
│              Welcome to Clawdbrain                             │
│         Your personal AI-powered second brain                  │
│                                                                 │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│    │   🧠         │  │   ⚡         │  │   🛡️        │      │
│    │Smart Agents  │  │Powerful      │  │Secure by     │      │
│    │              │  │Workflows     │  │Design        │      │
│    └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                                 │
│                                                                 │
│              [ Get Started ✨ ]  ← Large primary button        │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- **Icon:** 96x96px (24x24 Tailwind), rounded corners (3xl), gradient background (primary to primary/60), shadow-xl
- **Glow effect:** Pulsing background blur with primary/20 color
- **Feature cards:** Grid layout, muted/30 background, icon + title + description
- **CTA button:** Size lg, primary color, icon on right

### Step 1: Identity Setup

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                    Step 1 of 5           [X]         │
│                                                                 │
│  [━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░]  Progress bar (20%)    │
│                                                                 │
│                        ┌─────────┐                             │
│                        │   👤   │                             │
│                        └─────────┘                             │
│                                                                 │
│                   Tell Us About Yourself                        │
│         Help your AI assistant know how to address you         │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐    │
│    │  Display Name                                        │    │
│    │  ┌─────────────────────────────────────────────┐   │    │
│    │  │ What should we call you?                    │   │    │
│    │  └─────────────────────────────────────────────┘   │    │
│    └─────────────────────────────────────────────────────┘    │
│                                                                 │
│    [Optional] How will you use Clawdbrain?                     │
│    ┌─────────────────────────────────────────────────────┐    │
│    │  ○ Personal productivity                            │    │
│    │  ○ Software development                             │    │
│    │  ○ Research & learning                              │    │
│    │  ○ Business operations                              │    │
│    │  ○ Other                                           │    │
│    └─────────────────────────────────────────────────────┘    │
│                                                                 │
│                                                                 │
│                      [ Continue → ]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- **Progress bar:** Top of content area, shows completion status
- **Icon:** User icon in circle, primary/10 background
- **Form fields:** Clean input with placeholder text
- **Radio buttons:** Custom styled, smooth selection animation
- **Optional label:** Muted foreground color, smaller text

### Step 2: Channel Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                    Step 2 of 5           [X]         │
│                                                                 │
│  [━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░]  Progress (40%)   │
│                                                                 │
│                        ┌─────────┐                             │
│                        │   📻   │                             │
│                        └─────────┘                             │
│                                                                 │
│                  Connect Your Channels                         │
│       Choose how you want to interact with your assistant      │
│                                                                 │
│    ┌──────────────────────────────────────────────────────┐   │
│    │  Slack                                    [Configure]│   │
│    │  Chat with your assistant in Slack                    │   │
│    │  Status: Not connected                     [●] [○]   │   │
│    └──────────────────────────────────────────────────────┘   │
│                                                                 │
│    ┌──────────────────────────────────────────────────────┐   │
│    │  Discord                                  [Configure]│   │
│    │  Interact through Discord servers                      │   │
│    │  Status: Not connected                     [●] [○]   │   │
│    └──────────────────────────────────────────────────────┘   │
│                                                                 │
│    ┌──────────────────────────────────────────────────────┐   │
│    │  iMessage                                [Configure]│   │
│    │  Text your assistant from your iPhone                 │   │
│    │  Status: Not connected                     [●] [○]   │   │
│    └──────────────────────────────────────────────────────┘   │
│                                                                 │
│    ℹ️ You can skip this step and configure channels later      │
│                                                                 │
│                    [ Skip ]  [ Continue → ]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- **Channel cards:** Card layout with channel icon, name, description, status
- **Status indicators:** Colored dots (green = connected, gray = not connected)
- **Configure buttons:** Outline style, opens auth flow
- **Toggle switches:** Smooth animation between on/off states
- **Skip option:** Secondary button, muted styling

### Step 3: Create First Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                    Step 3 of 5           [X]         │
│                                                                 │
│  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░]  Progress (60%)  │
│                                                                 │
│                        ┌─────────┐                             │
│                        │   🤖   │                             │
│                        └─────────┘                             │
│                                                                 │
│                  Create Your First Agent                       │
│        Set up an AI assistant tailored to your needs          │
│                                                                 │
│    Choose a template:                                          │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│    │ [selected]   │  │              │  │              │      │
│    │  💬         │  │  💻         │  │  📊         │      │
│    │  General    │  │  Developer   │  │  Analyst    │      │
│    │  Assistant  │  │  Helper      │  │  Agent      │      │
│    │             │  │              │  │              │      │
│    │ ○ Standard  │  │ ○ Standard   │  │ ○ Standard   │      │
│    └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                                 │
│    Agent Name (optional)                                       │
│    ┌─────────────────────────────────────────────────────┐    │
│    │  My Assistant                                       │    │
│    └─────────────────────────────────────────────────────┘    │
│                                                                 │
│    Capabilities                                                │
│    [Minimal] [Standard] [Full]                                │
│                                                                 │
│                    [ Continue → ]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- **Template cards:** Grid layout, hover effects, selection indicator (border + background)
- **Template icons:** Large icons (48x48), colored backgrounds
- **Capability selector:** Button group, single selection
- **Form inputs:** Clean, accessible labels
- **Preview section:** Shows what will be created

### Step 4: First Chat

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                    Step 4 of 5           [X]         │
│                                                                 │
│  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░]  Progress (80%)│
│                                                                 │
│                        ┌─────────┐                             │
│                        │   💬   │                             │
│                        └─────────┘                             │
│                                                                 │
│                    Try Your First Chat                         │
│         Send a message to see your agent in action            │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐    │
│    │                                                     │    │
│    │  🤖 Assistant: Hello! I'm ready to help you.       │    │
│    │                What would you like to work on?      │    │
│    │                                                     │    │
│    │                                                     │    │
│    │                                                     │    │
│    │                                                     │    │
│    │                                                     │    │
│    │  Suggested prompts:                                 │    │
│    │  [Help me write an email]  [Explain a concept]    │    │
│    │  [Plan my day]             [Create a summary]     │    │
│    │                                                     │    │
│    └─────────────────────────────────────────────────────┘    │
│                                                                 │
│    ┌──────────────────────────────────────────────┐ [Send]   │
│    │  Type your message here...                    │          │
│    └──────────────────────────────────────────────┘          │
│                                                                 │
│                    [ Skip ]  [ Continue → ]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- **Chat interface:** Clean message bubbles, timestamp
- **Agent avatar:** Small icon with agent name
- **Suggested prompts:** Chip buttons, easy to tap/click
- **Input field:** Full-width with send button
- **Typing indicator:** Optional, shows agent is responding

### Step 5: Success

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        🎉 (confetti)                           │
│                        ┌─────────┐                             │
│                        │   🎉   │  ← Animated celebration     │
│                        └─────────┘                             │
│                                                                 │
│                   You're All Set!                              │
│       Clawdbrain is ready to help you be more productive      │
│                                                                 │
│    ┌────────────────────┐  ┌────────────────────┐            │
│    │        1           │  │    Unlimited       │            │
│    │   Agent Ready      │  │   Possibilities    │            │
│    └────────────────────┘  └────────────────────┘            │
│                                                                 │
│                                                                 │
│         [ 🚀 Go to Dashboard → ]  [ 💬 Start Chatting ]       │
│                                                                 │
│                                                                 │
│    💡 Tip: Use Cmd+K to quickly access commands                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- **Confetti animation:** Particle system, multiple colors, gravity effect
- **Success icon:** Large celebratory icon with glow
- **Stats cards:** Quick summary of what was accomplished
- **Action buttons:** Primary and outline options
- **Keyboard shortcut tip:** Muted text, kbd styling

---

## Interactive Prototype Specifications

### Navigation & Flow

```
[Welcome] → [Identity] → [Channels] → [Agent] → [Chat] → [Success]
    ↓           ↓           ↓           ↓         ↓
  (skip)     (skip)     (skip)     (auto)    (skip)
```

#### Navigation Rules

1. **Back button:**
   - Visible on all steps except Welcome
   - Returns to previous step
   - Preserves entered data

2. **Skip button:**
   - Available on Channels and Chat steps
   - Shows confirmation dialog
   - Skips to next step without saving

3. **Close button (X):**
   - Available on all steps
   - Shows confirmation: "Are you sure you want to exit setup?"
   - Option to save progress and exit

4. **Continue button:**
   - Validates current step
   - Shows error states if validation fails
   - Advances to next step on success

### Animation Specifications

#### Page Transitions

```typescript
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: "tween",
  duration: 0.3,
  ease: "easeInOut"
};
```

#### Icon Animations

```typescript
// Welcome icon
const iconVariants = {
  initial: { scale: 0 },
  animate: { 
    scale: 1,
    transition: { type: "spring", duration: 0.6 }
  }
};

// Glow pulse
const glowVariants = {
  animate: {
    scale: [1, 1.2, 1],
    transition: { repeat: Infinity, duration: 2 }
  }
};
```

#### Confetti System

```typescript
// Confetti particle
interface ConfettiParticle {
  id: number;
  delay: number;
  x: number;          // Initial x offset
  drift: number;      // Horizontal drift
  color: string;      // Random from palette
}

// Animation
const particleVariants = {
  initial: { y: -20, x, opacity: 1, rotate: 0 },
  animate: {
    y: 400,
    opacity: 0,
    rotate: 360,
    x: x + drift
  },
  transition: {
    duration: 2.5,
    delay: stagger * index,
    ease: "easeOut"
  }
};
```

### State Management

#### Local Storage

```typescript
// Persist current step
const STORAGE_KEY = "openclaw:onboarding:step";

function saveStep(step: number) {
  localStorage.setItem(STORAGE_KEY, String(step));
}

function getSavedStep(): number {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseInt(saved, 10) : 0;
}

// Mark onboarding complete
function markOnboardingComplete() {
  localStorage.setItem("openclaw:onboarding:complete", "true");
}
```

#### Step Data

```typescript
interface OnboardingData {
  step: number;
  identity?: {
    displayName?: string;
    useCase?: string;
  };
  channels?: string[];
  agent?: {
    template?: string;
    name?: string;
    capabilities?: 'minimal' | 'standard' | 'full';
  };
  firstMessage?: string;
}
```

### Validation Rules

| Step | Required Fields | Validation |
|------|----------------|------------|
| Welcome | None | N/A |
| Identity | None (optional) | DisplayName max 50 chars |
| Channels | None (optional) | At least one channel to continue |
| Agent | Template selection | Must select template |
| Chat | None (optional) | Message max 1000 chars |
| Success | None | N/A |

### Error States

#### Connection Error

```
┌──────────────────────────────────────┐
│  ⚠️  Connection Error                │
│                                      │
│  Unable to connect to the gateway.  │
│  Please check your connection.       │
│                                      │
│  [Retry]  [Skip for Now]            │
└──────────────────────────────────────┘
```

#### Validation Error

```
┌──────────────────────────────────────┐
│  ⚠️  Please fix the following:      │
│                                      │
│  • Display name is too long         │
│  • Please select at least one       │
│    channel to continue               │
│                                      │
│  [OK]                                │
└──────────────────────────────────────┘
```

### Responsive Design

#### Breakpoints

| Size | Width | Layout Changes |
|------|-------|----------------|
| Mobile | < 640px | Single column, stacked cards |
| Tablet | 640-1024px | 2-column grids |
| Desktop | > 1024px | 3-column grids, wider cards |

#### Mobile Considerations

- **Navigation:** Fixed bottom bar with back/next
- **Cards:** Full-width, touch-friendly tap targets
- **Typography:** Slightly smaller on mobile
- **Spacing:** Reduced padding on smaller screens

---

## Component Structure

### File Organization

```
apps/web/src/components/domain/onboarding/
├── OnboardingWizard.tsx         # Main container
├── index.ts                     # Exports
└── steps/
    ├── WelcomeStep.tsx          # Step 0
    ├── GatewaySetupStep.tsx     # Gateway connection
    ├── ModelProviderStep.tsx    # Model provider setup
    ├── RiskAcknowledgementStep.tsx  # Risk acknowledgment
    ├── SuccessStep.tsx          # Step 5
    └── index.ts                 # Step exports
```

### Component Props

```typescript
interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface StepProps {
  onContinue: () => void;
  onBack?: () => void;
  data?: OnboardingData;
  onDataChange?: (data: Partial<OnboardingData>) => void;
}
```

### Shared Components

- **Progress indicator:** Shows current step and completion
- **Navigation buttons:** Back, Skip, Continue
- **Step container:** Wrapper with consistent padding/margins
- **Icon container:** Circular background with icon
- **Form field wrapper:** Label, input, error message

---

## Accessibility

### Keyboard Navigation

- **Tab:** Move through interactive elements
- **Enter/Space:** Activate buttons
- **Escape:** Close modal/dialog
- **Arrow keys:** Navigate template selection

### Screen Reader Support

- **ARIA labels:** All interactive elements labeled
- **Live regions:** Announce step changes
- **Focus management:** Focus moves to step title on transition
- **Descriptive text:** Clear instructions for each step

### Color Contrast

- **Text:** Minimum 4.5:1 contrast ratio
- **Icons:** Minimum 3:1 contrast ratio
- **Interactive elements:** Clear focus indicators

---

## Testing Checklist

### Functional Tests

- [ ] Each step renders correctly
- [ ] Navigation works (back, continue, skip)
- [ ] Data persists across steps
- [ ] Validation works correctly
- [ ] Can complete full flow
- [ ] Can skip optional steps
- [ ] Can cancel and resume later

### Visual Tests

- [ ] Animations play smoothly
- [ ] Responsive layout works on all sizes
- [ ] Colors match design system
- [ ] Typography scales correctly
- [ ] Icons render correctly
- [ ] Progress bar updates accurately

### Accessibility Tests

- [ ] Keyboard navigation works
- [ ] Screen reader announces content
- [ ] Focus visible on all elements
- [ ] Color contrast meets WCAG AA
- [ ] No keyboard traps

### Integration Tests

- [ ] Saves to local storage
- [ ] Marks onboarding complete
- [ ] Creates agent successfully
- [ ] Navigates to correct page on completion
- [ ] Handles gateway errors gracefully

---

## Future Enhancements

### Phase 2 Features

1. **Progressive profiling:** Ask for more info over time
2. **Video tutorials:** Embedded help videos
3. **Guided tour:** Interactive product walkthrough
4. **Achievement system:** Badges for completing tasks
5. **Personalization:** Adapt flow based on use case

### Analytics Events

```typescript
// Track onboarding progress
analytics.track('onboarding_step_viewed', { step: 'identity' });
analytics.track('onboarding_step_completed', { step: 'channels', skipped: false });
analytics.track('onboarding_completed', { totalSteps: 5, duration: 180 });
```

---

## Implementation Notes

### Current Status

- ✅ Basic wizard structure implemented
- ✅ Welcome step complete
- ✅ Identity step complete
- ✅ Channels step complete
- ✅ Agent creation step complete
- ✅ Chat step complete
- ✅ Success step complete with confetti
- ⏳ Animation refinements in progress
- ⏳ Accessibility improvements needed
- ⏳ Mobile responsive adjustments needed

### Known Issues

1. **Animation performance:** Confetti can be heavy on low-end devices
2. **Form validation:** Need better error messaging
3. **Mobile layout:** Some cards overflow on small screens
4. **Skip flow:** Need clearer indication of what will be skipped

### Technical Debt

- Refactor step components for consistency
- Extract shared animation variants
- Add comprehensive error handling
- Improve TypeScript types
- Add unit tests for each step

---

## Resources

### Design Files

- **Figma:** [Link to Figma file] (if available)
- **Sketch:** [Link to Sketch file] (if available)

### Code References

- **Wizard implementation:** `apps/web/src/components/domain/onboarding/OnboardingWizard.tsx`
- **Step components:** `apps/web/src/components/domain/onboarding/steps/`
- **Route:** `apps/web/src/routes/onboarding/index.tsx`
- **Hook:** `apps/web/src/hooks/useOnboardingCheck.ts`

### External Libraries

- **Framer Motion:** Animation library
- **Lucide React:** Icon library
- **Tailwind CSS:** Styling
- **Radix UI:** Accessible component primitives

---

## Conclusion

This wireframes and prototype specification provides a comprehensive guide for implementing the Clawdbrain onboarding tour. The design focuses on:

1. **Progressive disclosure:** Show only what's needed at each step
2. **Friendly tone:** Approachable language and visuals
3. **Smooth interactions:** Delightful animations and transitions
4. **Accessibility:** Inclusive design for all users
5. **Flexibility:** Allow skipping non-essential steps

The implementation should follow these specifications while remaining adaptable to user feedback and analytics data.
