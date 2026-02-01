# React UI Project Setup

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 19 | Modern hooks, concurrent features |
| Build | Vite | Fast dev, good production builds |
| Styling | Tailwind CSS 4 | Utility-first, design system integration |
| Components | Shadcn/ui | Accessible, customizable, not a npm dep |
| Primitives | Radix UI | Headless accessible components |
| State (server) | TanStack Query v5 | Caching, refetching, optimistic updates |
| State (client) | Zustand | Minimal, no boilerplate |
| Forms | React Hook Form + Zod | Type-safe validation |
| Routing | TanStack Router | Type-safe, file-based optional |
| Icons | Lucide React | Consistent, tree-shakeable |

---

## Project Structure

```
ui-next/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   └── routes/              # Route components
│   │       ├── _index.tsx       # Redirect to /chat
│   │       ├── chat.tsx
│   │       ├── overview.tsx
│   │       ├── channels/
│   │       │   ├── _index.tsx
│   │       │   └── $channelId.tsx
│   │       ├── sessions.tsx
│   │       ├── cron.tsx
│   │       ├── skills.tsx
│   │       ├── nodes.tsx
│   │       ├── config.tsx
│   │       ├── logs.tsx
│   │       └── debug.tsx
│   │
│   ├── components/
│   │   ├── ui/                  # Shadcn components (copied in)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── layout/              # App shell components
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   ├── nav-item.tsx
│   │   │   └── mobile-nav.tsx
│   │   ├── chat/                # Chat-specific components
│   │   │   ├── message-list.tsx
│   │   │   ├── message-input.tsx
│   │   │   ├── tool-inspector.tsx
│   │   │   └── attachment-preview.tsx
│   │   ├── channels/            # Channel-specific components
│   │   │   ├── channel-card.tsx
│   │   │   ├── whatsapp-setup.tsx
│   │   │   ├── telegram-setup.tsx
│   │   │   └── ...
│   │   └── shared/              # Reusable across views
│   │       ├── status-badge.tsx
│   │       ├── empty-state.tsx
│   │       ├── data-table.tsx
│   │       └── loading-skeleton.tsx
│   │
│   ├── hooks/
│   │   ├── use-gateway.ts       # WebSocket connection
│   │   ├── use-theme.ts         # Theme management
│   │   └── use-media-query.ts   # Responsive helpers
│   │
│   ├── lib/
│   │   ├── gateway-client.ts    # WebSocket protocol (port from current)
│   │   ├── utils.ts             # cn(), formatters
│   │   └── constants.ts         # Config defaults
│   │
│   ├── stores/
│   │   ├── ui-store.ts          # Sidebar, theme, etc.
│   │   └── connection-store.ts  # Gateway connection state
│   │
│   ├── api/
│   │   ├── queries/             # TanStack Query hooks
│   │   │   ├── use-channels.ts
│   │   │   ├── use-sessions.ts
│   │   │   ├── use-config.ts
│   │   │   └── ...
│   │   └── mutations/           # TanStack Mutation hooks
│   │       ├── use-save-config.ts
│   │       └── ...
│   │
│   ├── types/
│   │   ├── gateway.ts           # Gateway protocol types
│   │   ├── channels.ts          # Channel types
│   │   └── ...
│   │
│   ├── styles/
│   │   └── globals.css          # Tailwind imports, CSS vars
│   │
│   ├── main.tsx                 # Entry point
│   └── vite-env.d.ts
│
├── public/
│   └── favicon.ico
│
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── components.json              # Shadcn config
```

---

## Initial Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-router": "^1.90.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.24.0",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "class-variance-authority": "^0.7.0",
    "sonner": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## Shadcn Components to Install

Run after project setup:

```bash
# Core layout
npx shadcn@latest add button card dialog sheet

# Forms
npx shadcn@latest add input textarea select switch checkbox label form

# Data display
npx shadcn@latest add table badge avatar skeleton

# Navigation
npx shadcn@latest add tabs dropdown-menu command

# Feedback
npx shadcn@latest add toast alert

# Utilities
npx shadcn@latest add separator scroll-area tooltip
```

---

## Design Tokens (Tailwind Config)

Port the existing design tokens to Tailwind:

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## WebSocket Client (Port from Current)

The gateway client can be ported from `ui/src/ui/gateway.ts`:

```ts
// src/lib/gateway-client.ts
export interface GatewayFrame {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
  event?: string;
  data?: unknown;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: Function; reject: Function }>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(private url: string, private token?: string) {}

  async connect(): Promise<void> {
    // Implementation from current gateway.ts
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    // RPC call implementation
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    // Event subscription
  }

  disconnect(): void {
    // Cleanup
  }
}
```

---

## Key Patterns

### 1. Query Hook Pattern

```tsx
// src/api/queries/use-channels.ts
import { useQuery } from "@tanstack/react-query";
import { useGateway } from "@/hooks/use-gateway";

export function useChannels() {
  const { client } = useGateway();

  return useQuery({
    queryKey: ["channels"],
    queryFn: () => client.call<ChannelsSnapshot>("channels.status"),
    enabled: !!client,
    refetchInterval: 30000,
  });
}
```

### 2. Store Pattern (Zustand)

```tsx
// src/stores/ui-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "openclaw-ui" }
  )
);
```

### 3. Layout Component

```tsx
// src/components/layout/app-shell.tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUiStore();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} />
      <main className="flex-1 overflow-auto">
        <Topbar />
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
```

---

## Migration Strategy

### Phase 1: Parallel Development
- New UI runs on different port (e.g., 5173)
- Same gateway, different frontend
- Test with real gateway

### Phase 2: Feature Parity
- Implement all views
- Match functionality (not UI) of current
- Verify all gateway interactions work

### Phase 3: Cutover
- Replace old UI in dist/control-ui
- Update gateway to serve new UI
- Keep old UI as fallback initially

### Phase 4: Cleanup
- Remove old Lit-based UI
- Update docs
- Remove old dependencies
