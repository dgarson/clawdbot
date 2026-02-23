# @openclaw/cli

Developer CLI entrypoints for OpenClaw local tooling.

## Quickstart

Run against the local workspace packages using Node ESM:

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sdk', 'doctor']);"
```

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'verify', '--root', process.cwd()]);"
```

```bash
node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'exec', '--root', process.cwd(), '--input', '{\"value\":\"hello\"}']);"
```
