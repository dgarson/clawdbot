# @openclaw/cli

Developer CLI entrypoints for OpenClaw local tooling.

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
```

## Verify in local and CI paths

- Local package checks: `pnpm --dir packages/cli test`
- CI-equivalent package path: `pnpm --dir packages/cli exec vitest run src/run.test.ts`
- Paired sandbox assertions: `pnpm --dir packages/sandbox test`
