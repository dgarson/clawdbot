# Claude SDK Provider Env Notes

This file documents the env contract used by `provider-env.ts` for Claude Code
subprocess launches in OpenClaw.

## Current Mapping

- Claude SDK runner inherits process env.
- The launcher strips inherited Anthropic credential env vars so Claude Code
  keychain auth remains authoritative:
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_AUTH_TOKEN`
  - `ANTHROPIC_OAUTH_TOKEN`
- Runtime selection is keyed off system-keychain providers only.

## Telemetry / OTEL Decision (Current)

OpenClaw now hard-sets the following env flags for wrapped Claude SDK launches:

- `CLAUDE_CODE_ENABLE_TELEMETRY=0`
- `DISABLE_TELEMETRY=1`
- `DISABLE_BUG_COMMAND=1`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

If we add OpenTelemetry support later, keep it explicit opt-in (for example via
config or explicit env override), and avoid silently enabling outbound
telemetry for existing users.

Reference:

- https://code.claude.com/docs/en/monitoring-usage
