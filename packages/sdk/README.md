# @openclaw/sdk

Typed TypeScript SDK for OpenClaw APIs and local tooling surfaces.

## Install

```bash
pnpm add @openclaw/sdk
```

## Quickstart

```ts
import { createClient } from "@openclaw/sdk";

const client = createClient({
  baseUrl: "http://127.0.0.1:3939",
  apiKey: process.env.OPENCLAW_API_KEY,
});

const health = await client.health();
if (!health.ok) {
  console.error("gateway unavailable", health.error.message);
} else {
  console.log("gateway", health.data.version);
}

const toolResult = await client.tools.invoke({
  name: "echo",
  input: { value: "hello-openclaw" },
});

if (toolResult.ok) {
  console.log(toolResult.data.output);
}
```

## Runtime config

- `baseUrl` defaults to `http://127.0.0.1:3939`
- `timeoutMs` defaults to `10000`
- `userAgent` defaults to `@openclaw/sdk/1`
