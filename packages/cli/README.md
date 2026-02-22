# @openclaw/cli

Developer CLI entrypoints for OpenClaw local tooling.

## Quickstart

```bash
node -e "import { run } from '@openclaw/cli';
await run(['sdk','doctor']);"
```

```bash
node -e "import { run } from '@openclaw/cli';
await run(['sandbox','start','--root',process.cwd()]);"
```
