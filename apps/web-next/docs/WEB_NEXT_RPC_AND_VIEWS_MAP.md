# Web Next RPC and Related Views Map

Last verified: 2026-02-24

## Direct answer

No. Before this update, `apps/web-next` did not have complete md docs mapping RPC usage to the revamped views and backend method coverage.

This file now maps every RPC-linked surface in `apps/web-next`.

## Scope and source of truth

- Routed view source: `apps/web-next/src/App.tsx` (`navItems` + `renderView` switch).
- RPC usage source: `apps/web-next/src/**` call sites (`call(...)` and `gateway.call(...)`), including hook-derived usage.
- Backend implementation source: `src/gateway/server-methods/**` and `src/gateway/server-methods-list.ts`.
- Scope classification source: `src/gateway/method-scopes.ts`.

## Coverage summary

- Routed views total: `285`
- Routed views with RPC usage: `5`
- Routed views gateway-aware only (no RPC call): `1`
- Routed views UI-only: `279`
- Non-routed components with RPC usage: `1`
- RPC methods referenced from web-next: `16`
- Referenced methods with backend handlers: `8`
- Referenced methods missing backend handlers: `8`

## Routed RPC-linked views

| Route ID | View file | RPC hook/entrypoint | RPC methods |
| --- | --- | --- | --- |
| `today-command` | `apps/web-next/src/views/TodayCommandCenter.tsx` | `useHorizonOps` | `horizon.brief.compose` |
| `context-budget` | `apps/web-next/src/views/ContextBudgetInspector.tsx` | `useHorizonOps` | `horizon.context.budgets` |
| `providers` | `apps/web-next/src/views/ProviderAuthManager.tsx` | `useGateway`, `useWizard` | `config.get`, `wizard.start`, `wizard.next`, `wizard.cancel`, `wizard.status` |
| `settings` | `apps/web-next/src/views/SettingsDashboard.tsx` | `useGateway` | `config.get` |
| `mission-control` | `apps/web-next/src/views/MissionControlDashboard.tsx` | `useMissionControl` | `sessions.list`, `tools.history`, `approvals.list`, `approvals.approve`, `approvals.deny`, `alerts.list`, `alerts.dismiss` |

## Routed gateway-aware view (no RPC calls)

| Route ID | View file | Hook | Notes |
| --- | --- | --- | --- |
| `dashboard` | `apps/web-next/src/views/AgentDashboard.tsx` | `useGateway` | Uses connection state only; no RPC call issued from this view. |

## Non-routed RPC-linked component

| Component file | RPC methods | Notes |
| --- | --- | --- |
| `apps/web-next/src/components/WhatsAppQrLogin.tsx` | `web.login.start`, `web.login.wait` | Invoked from auth/channel flows, not directly from route switch. |

## RPC method inventory and backend coverage

| Method | Frontend usage | Backend status | Scope status |
| --- | --- | --- | --- |
| `config.get` | Providers, Settings | Implemented (`src/gateway/server-methods/config.ts`) | Classified (`operator.read`) |
| `wizard.start` | Providers (`useWizard`) | Implemented (`src/gateway/server-methods/wizard.ts`) | Classified (admin via `wizard.` prefix) |
| `wizard.next` | Providers (`useWizard`) | Implemented (`src/gateway/server-methods/wizard.ts`) | Classified (admin via `wizard.` prefix) |
| `wizard.cancel` | Providers (`useWizard`) | Implemented (`src/gateway/server-methods/wizard.ts`) | Classified (admin via `wizard.` prefix) |
| `wizard.status` | Providers (`useWizard`) | Implemented (`src/gateway/server-methods/wizard.ts`) | Classified (admin via `wizard.` prefix) |
| `sessions.list` | Mission Control (`useMissionControl`) | Implemented (`src/gateway/server-methods/sessions.ts`) | Classified (`operator.read`) |
| `web.login.start` | WhatsApp QR component | Implemented (`src/gateway/server-methods/web.ts`) | Classified (`operator.admin`) |
| `web.login.wait` | WhatsApp QR component | Implemented (`src/gateway/server-methods/web.ts`) | Classified (`operator.admin`) |
| `tools.history` | Mission Control (`useMissionControl`) | Missing handler | Unclassified |
| `approvals.list` | Mission Control (`useMissionControl`) | Missing handler | Unclassified |
| `approvals.approve` | Mission Control (`useMissionControl`) | Missing handler | Unclassified |
| `approvals.deny` | Mission Control (`useMissionControl`) | Missing handler | Unclassified |
| `alerts.list` | Mission Control (`useMissionControl`) | Missing handler | Unclassified |
| `alerts.dismiss` | Mission Control (`useMissionControl`) | Missing handler | Unclassified |
| `horizon.brief.compose` | Today Command Center (`useHorizonOps`) | Missing handler | Unclassified |
| `horizon.context.budgets` | Context Budget Inspector (`useHorizonOps`) | Missing handler | Unclassified |

## Related docs

- Detailed contracts and gap analysis: `apps/web-next/docs/WEB_NEXT_RPC_METHOD_CONTRACTS.md`
- Existing gateway RPC reference (generic adapter/protocol docs, not web-next mapping): `docs/reference/rpc.md`
