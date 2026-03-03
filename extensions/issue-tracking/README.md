# @openclaw/issue-tracking

This package is an **OpenClaw extension**.

## Extension vs plugin in this repo

- **Extension**: a distributable package under `extensions/*` that users can enable/disable.
- **Plugin API**: the runtime API surface (`OpenClawPluginApi`) used by extensions to register tools/services/channels.

So in practice: this should live as an **extension package** (opt-in), while internally it still uses the plugin API hooks.

## Shared backlog behavior for multi-agent work

- local markdown state is stored under the shared OpenClaw state dir, at `~/.openclaw/issue-tracking/<workstream-key>` by default
- all agents on the same machine and workstream read/write the same issue files (not per-agent workspace copies)
- set `workstreamId` in plugin config to force multiple agents/processes onto a single logical backlog
- when GitHub config is present (`githubOwner` + `githubRepo`), that repo pair is used as the default workstream key

## What this extension provides

- local markdown ticket tracking (shared state dir)
- optional GitHub Issues provider (when `githubOwner`, `githubRepo`, `githubToken` are configured)
- dependency graph/DAG queries over ticket relationships (`blocks`, `blocked_by`, `duplicates`, `related`)
- optional agent tools:
  - `issue_tracking_create`
  - `issue_tracking_query`
  - `issue_tracking_query_dag`
  - `issue_tracking_link`

## Brainstorm (not implemented)

A future optional groomer could run on a timer (agent/cron style) using a low-thinking model like Sonnet 4.6 to:

- find orphan tickets (no links/dependencies)
- propose likely links to related/dependency tickets
- flag priority and risk concerns for supervising agents
- post suggestions as non-destructive comments/metadata for human review
