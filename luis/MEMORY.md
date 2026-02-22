# MEMORY.md — Luis's Long-Term Memory

*Created: 2026-02-20*

---

## Company Context

- Building OpenClaw — AI-native multi-agent orchestration platform
- David is CEO/Founder. Denver, CO.
- Team: Merlin (main), Xavier (CTO), Amadeus (CAIO), Stephan (CMO), Drew (CDO), Robert (CFO), Tim (VP Arch), + engineering team

---

## UI Architecture (Updated 2026-02-22)

Codebase is at `git/clawdbot/` (workspace-relative). Two UI projects:

1. **Original Control UI** (`git/clawdbot/apps/web/`) — Vite + Lit Web Components. Hash-based routing. i18n support (en, pt-BR, zh-CN, zh-TW). ~100 source files. Currently deployed UI.

2. **Horizon Redesign** (`git/clawdbot/apps/web-next/`) — Vite + React 19 + TanStack Router + TanStack Query + Radix/Shadcn + Zustand. Active branch: `feat/horizon-post-merge`. **287 views shipped.** This is where all new UI work goes.

**NOT Next.js.** The project uses Vite with TanStack Router (file-based routing under `src/routes/`).

The old `luis/ui-redesign` branch (PR #44) was superseded by the Horizon work.

## Horizon UI Sprint (2026-02-21 → 2026-02-22)

Major UX build push across two PRs:

- **PR #61** (`feat/horizon-ui → dgarson/fork`) — **MERGED 2026-02-22** — 267 views, clean build, 0 TS errors.
- **PR #72** (`feat/horizon-post-merge → dgarson/fork`) — OPEN — Views #268–287, waiting on Tim/Xavier review.

Views include: API key management, audit log, billing, system health, integrations, team management, voice interface, agent insights, developer console, discovery tools, and 270+ more. Built with a mix of direct work and parallel subagent spawning (Quinn, Piper, Reed, Wes, etc.).

## Lessons Learned

- **2026-02-21:** Work queue had 43 phantom items referencing Next.js paths that never existed. Always verify file paths against disk before marking work done. Build verification must come from actual tool output.
- **2026-02-22:** Workspace restructured — codebase moved to `git/clawdbot/` to fix git repo hygiene. All future path references should use this workspace-relative path.

---

*Update this file with significant events, lessons, and curated knowledge.*
