# @openclaw/cli

Developer CLI entrypoints for Openclaw local tooling.

## Quickstart

Use the library runner for deterministic local smoke checks:

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sdk', 'doctor']);"
```

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'verify', '--root', process.cwd()]);"
```

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'exec', '--root', process.cwd(), '--input', '{\"value\":\"hello\"}']);"
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'exec', '--root', process.cwd(), '--input', '{\"value\":\"keep-alive\"}', '--keep-alive']);"
```

`--keep-alive` skips sandbox teardown for `exec` and `verify`, useful when chaining multiple local checks.

### Example quickstart scenario

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['new', 'plugin', 'quickstart-plugin', '--root', process.cwd(), '--description', 'Demo plugin']);"
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['new', 'agent', 'quickstart-agent', '--root', process.cwd(), '--description', 'Demo agent']);"
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'verify', '--root', process.cwd()]);"
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'exec', '--root', process.cwd(), '--input', '{\"value\":\"hello-cli\"}']);"
```

## Local templates and one-command scaffolding

Scaffold local plugin or agent skeletons in one command:

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['new', 'plugin', 'my-plugin', '--root', process.cwd()]);"
```

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['new', 'agent', 'my-agent', '--root', process.cwd(), '--description', 'Domain-specific agent']);"
```

The scaffolder creates a small starter set:

- a manifest (`openclaw.plugin.json` or `openclaw.agent.json`)
- `src/index.ts`
- `README.md`

## Hot reload local sandbox

Local sandboxes can be started with file watching enabled. The runtime will automatically restart on file changes under the watched root:

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'start', '--root', process.cwd(), '--watch']);"
```

Optionally control debounce:

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'start', '--root', process.cwd(), '--watch', '--watch-debounce-ms', '250']);"
```

## Verify in local and CI paths

- Local package checks: `pnpm --dir packages/cli test`
- CI-equivalent package path: `pnpm --dir packages/cli exec vitest run src/run.test.ts`
- Paired sandbox assertions: `pnpm --dir packages/sandbox test`
