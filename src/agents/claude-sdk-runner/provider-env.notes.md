# Claude SDK Provider Env Notes

This file documents the current subprocess env contract used by
`provider-env.ts` and `config.ts` for Claude SDK launches in OpenClaw.

## Runtime scope

- Claude SDK runtime is used for system-keychain providers (`claude-pro`,
  `claude-max`) when the selected model ID starts with `claude-`.
- Runtime selection happens in `src/agents/pi-embedded-runner/run/attempt.ts`.

## Supported config surface

`claudeSdk` config is options-only (no provider/baseUrl/authHeader schema):

- `thinkingDefault`: default SDK thinking level when user did not override.
- `configDir`: optional Claude CLI config directory override.

Schema source: `src/config/zod-schema.agent-runtime.ts`.

## Provider env contract (`provider-env.ts`)

`buildProviderEnv()` starts from inherited parent env and then:

- Removes credential env vars that can conflict with Claude Code keychain auth:
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_AUTH_TOKEN`
  - `ANTHROPIC_OAUTH_TOKEN`
- Applies outbound-traffic guardrails:
  - `CLAUDE_CODE_ENABLE_TELEMETRY=0`
  - `DISABLE_TELEMETRY=1`
  - `DISABLE_BUG_COMMAND=1`
  - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

## Config dir propagation (`config.ts`)

`CLAUDE_CONFIG_DIR` resolution is centralized in `resolveClaudeConfigDir()`:

1. `claudeSdk.configDir` (if set)
2. parent process `CLAUDE_CONFIG_DIR` (fallback)

`resolveClaudeSubprocessEnv()` then normalizes child env so
`CLAUDE_CONFIG_DIR` is either explicitly set to the resolved value or removed.

If `providerEnv` is provided, it is used as the base env and then normalized
for `CLAUDE_CONFIG_DIR`.

## Notes

- OpenClaw does not use provider-specific `ANTHROPIC_BASE_URL` remapping in the
  Claude SDK path.
- Custom endpoint/header strategies documented in earlier revisions of this file
  were removed with the options-only Claude SDK config simplification.
