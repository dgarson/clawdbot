# WORKSTREAM.md — Horizon UI v2 (Production Build)

_Mega-branch:_ `luis/ui-redesign`
_Owner:_ **Luis** (Principal UX Engineer)
_Created:_ 2026-02-21
_Last updated:_ 2026-02-21

> ⚠️ **Owner's responsibility:** Keep this file updated as design evolves, decisions are made, and task status changes. Delete this entire directory (`_shared/workstreams/horizon-ui-v2/`) ONLY after `luis/ui-redesign` is confirmed merged into `dgarson/fork` — NOT when the PR is opened or when David begins review.

---

## Deliverable

A complete production-grade frontend rebuild for OpenClaw. Replaces the Horizon prototype (`apps/web-next/`) with a fully implemented, production-ready application: Vite 7.3 + React 19 + TanStack Router (file-based, 29 routes) + Radix UI/Shadcn design system + Zustand state management + Framer Motion + TanStack Query. 424 source files, real gateway RPC integration, zero build errors.

**App location:** `/Users/openclaw/openclaw-ui-redesign/apps/web/`

---

## Design

Key decisions:

- **Vite over Next.js** — eliminates SSR complexity, faster builds (3,358 modules, 7s)
- **TanStack Router** — file-based routing, 29 routes, type-safe
- **Radix UI + Shadcn** — accessible primitives + styled components; no bespoke component invention unless necessary
- **Zustand** — lightweight state management over Redux or Context API
- **Real gateway RPC** — no mock API layer; all data through gateway integration
- **Framer Motion** — animation layer for transitions and micro-interactions

---

## Strategy

Full production rebuild completed in a single intensive workstream. Squad (Luis + Piper + Wes) built all 29 routes and 424 source files. Now in final PR-to-merge phase.

---

## Tasks & Status

See workboard: `/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md` (Project: OpenClaw Horizon UI — Production Build v2)

| Task ID                 | Description                                                     | Status                     |
| ----------------------- | --------------------------------------------------------------- | -------------------------- |
| HRZ2-01 through HRZ2-11 | Full production build (all routes, components, RPC integration) | ✅ Done                    |
| HRZ2-PR                 | Open mega-branch PR: `luis/ui-redesign` → `dgarson/fork`        | 🟠 Unclaimed — Luis to own |

**Next action:** Luis opens PR from `luis/ui-redesign` → `dgarson/fork`, notifies Xavier for final review.

---

## Squad

| Agent | Role             | Owns                                                                             |
| ----- | ---------------- | -------------------------------------------------------------------------------- |
| Luis  | Lead / Owner     | Architecture decisions, all PR review into mega-branch, final PR to dgarson/fork |
| Piper | Fast implementer | Heatmap and interaction components                                               |
| Wes   | Fast implementer | Monaco editor integration, component work                                        |

---

## Open Questions / Blockers

- HRZ2-PR must be opened by Luis — currently unclaimed on the workboard
- Xavier must review before merge to `dgarson/fork`
