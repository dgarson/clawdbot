# @openclaw/issue-tracking

This package is an **OpenClaw extension**.

## Extension vs plugin in this repo

- **Extension**: a distributable package under `extensions/*` that users can enable/disable.
- **Plugin API**: the runtime API surface (`OpenClawPluginApi`) used by extensions to register tools/services/channels.

So in practice: this should live as an **extension package** (opt-in), while internally it still uses the plugin API hooks.

## What this extension provides

- local markdown ticket tracking (`.openclaw/issues`)
- optional GitHub Issues provider (when `githubOwner`, `githubRepo`, `githubToken` are configured)
- optional agent tools:
  - `issue_tracking_create`
  - `issue_tracking_query`
  - `issue_tracking_link`
