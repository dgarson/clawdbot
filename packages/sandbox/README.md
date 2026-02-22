# @openclaw/sandbox

Local development sandbox shim for OpenClaw SDK flows.

## Quickstart

```ts
import { createLocalSandbox } from "@openclaw/sandbox";

const sandbox = createLocalSandbox({
  rootDir: process.cwd(),
});

await sandbox.start();
await sandbox.status();
await sandbox.exec({ input: { command: "hello" } });
await sandbox.stop();
```
