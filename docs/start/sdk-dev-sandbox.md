---
summary: "Build, verify, and run local SDK + sandbox workflows from a clean checkout."
read_when:
  - You want a deterministic developer smoke flow for OpenClaw plugins/agents
  - You want a small local workflow to validate SDK + sandbox changes
title: "SDK + Sandbox development quickstart"
---

# SDK + Sandbox development quickstart

Use this flow to validate a local sandbox project without touching production gateway or external services.

<Steps>
  <Step title="1) Scaffold local templates">
    ```bash
    node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['new', 'plugin', 'hello-plugin', '--root', process.cwd(), '--description', 'Demo plugin']);"

    node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['new', 'agent', 'hello-agent', '--root', process.cwd(), '--description', 'Demo agent']);"
    ```

    This creates:

    - `hello-plugin/openclaw.plugin.json`
    - `hello-agent/openclaw.agent.json`
    - `README.md` and `src/index.ts` in both folders

  </Step>

  <Step title="2) Verify sandbox runtime and exec path">
    ```bash
    node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'verify', '--root', process.cwd()]);"

    node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'exec', '--root', process.cwd(), '--input', '{\"value\":\"hello-world\"}']);"
    node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sandbox', 'exec', '--root', process.cwd(), '--input', '{\"value\":\"hello-world\"}', '--keep-alive']);"
    ```

    `--keep-alive` keeps the runtime alive after verify/exec when you want to run several local checks in one session.

    `sandbox verify` checks lifecycle readiness and executes a single probe input.

  </Step>

  <Step title="3) Optional SDK connectivity check">
    ```bash
    node --input-type=module -e "import { run } from '@openclaw/cli'; await run(['sdk', 'doctor']);"
    ```

    `sdk doctor` confirms that the CLI wiring for SDK calls is functioning and returns health metadata.

  </Step>
</Steps>

## Why this is useful

- It mirrors the package-level smoke path used in automated tests.
- Keeps plugin and agent scaffolding, sandbox verification, and SDK checks in one deterministic loop.
- No external tools beyond Node.js are required.

## Run from tests

- CLI package tests: `pnpm --dir packages/cli test`
- Focused run: `pnpm --dir packages/cli exec vitest run src/run.test.ts`
- Full package verification: `pnpm --dir packages/cli exec vitest run src/run.test.ts && pnpm --dir packages/sandbox test`
