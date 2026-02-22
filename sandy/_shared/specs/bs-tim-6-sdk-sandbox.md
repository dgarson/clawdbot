# BS-TIM-6: OpenClaw SDK + Local Dev Sandbox

**Status:** Proposed design (non-breaking)  
**Owner:** `openclaw/openclaw#bs-tim-6`  
**Scope:** architecture + delivery plan for a public SDK surface and a local sandbox runtime developers can run offline in CI and dev.

## 1) Goals and non-goals

### Goals
- Ship a stable SDK package boundary that wraps existing OpenClaw capabilities behind a typed, ergonomic API.
- Enable a local sandbox runtime model for deterministic development and testing of tool workflows.
- Keep changes **additive** (no breaking changes to current runtime contracts unless explicitly versioned).
- Provide strong quickstart and testing guidance to reduce onboarding friction.

### Non-goals (phase 1)
- Full protocol redesign of the existing OpenClaw gateway.
- Migration to a new plugin/runtime architecture beyond local sandbox bootstrapping.
- Replacing cloud-hosted runtime behavior or introducing remote control planes.

## 2) Proposed package boundaries

### 2.1 Monorepo layout

```text
packages/
  sdk/
    package.json
    src/
      index.ts
      client.ts
      types.ts
      errors.ts
      plugins/
      transport/
      sandbox/
  sandbox/
    package.json
    src/
      runtime.ts
      process-manager.ts
      workspace.ts
      protocol.ts
      health.ts
  cli/
    package.json
    src/
      index.ts
      run.ts
      bootstrap.ts
```

> If repo topology changes, we can collapse to a single package initially; boundaries above intentionally preserve future split points.

### 2.2 `@openclaw/sdk` responsibilities
- Typed client, request/response models, domain errors, and helpers.
- Transport-agnostic API contracts (HTTP first; extensible to WS later).
- Lightweight plugin/feature modules for common operations (tool calls, sessions, resources).
- No process lifecycle assumptions (pure library).

### 2.3 `@openclaw/sandbox` responsibilities
- Local sandbox runtime lifecycle (bootstrap, state, cleanup).
- Process / container / subprocess abstraction that can run:
  - pure JS execution sandbox
  - dockerized runtime (future)
  - in-proc mock runtime (tests)
- Artifact and permission boundaries for project/workspace state.

### 2.4 `@openclaw/cli` responsibilities
- Developer-facing commands:
  - `openclaw sandbox start|stop|status|logs|exec`
  - `openclaw sdk doctor` (checks env + compatibility)
  - `openclaw sdk login` (future)
- Thin wrapper over SDK + sandbox packages.

### 2.5 Dependency rules
- `sdk` must not depend on `sandbox`.
- `cli` depends on `sdk` + `sandbox`.
- `sandbox` depends on `sdk` only for shared protocol types (no CLI-only behavior).

## 3) API ergonomics (SDK)

### 3.1 Core client entrypoint
```ts
export interface OpenClawClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  logger?: OpenClawLogger;
}

export interface OpenClawClient {
  tools: ToolClient;
  sessions: SessionClient;
  resources: ResourceClient;
  sandbox: SandboxController;
  health(): Promise<HealthResult>;
  close(): Promise<void>;
}

export function createClient(config?: OpenClawClientConfig): OpenClawClient;
```

### 3.2 Ergonomic call patterns
- **Method-per-entity** over raw route maps.
  - `client.tools.list()`
  - `client.tools.invoke({ name, input })`
  - `client.tools.stream({ ... }, onEvent)`
- **Structured result envelope**
  - `{ ok: true, data }` on success
  - `{ ok: false, error }` on failure
- **Typed async iterables** for streams to support `for await` and event replay.

### 3.3 Runtime config in config object, not globals
- No hidden global state.
- Optional named instances support concurrency and test isolation.

### 3.4 Error model
- `OpenClawError` base + families:
  - `ValidationError`
  - `TransportError`
  - `AuthError`
  - `ToolRuntimeError`
  - `SandboxUnavailableError`
- Attach `requestId`, `spanId`, and `statusCode` for observability.

### 3.5 Discovery and introspection
- `client.getSchema()` returning stable contract descriptors used by tooling and CLI autocomplete.
- Add `client.withRetries(fn)` helper with bounded exponential defaults to avoid repeated boilerplate.

## 4) Local sandbox runtime model

### 4.1 Runtime state machine

```text
idle -> starting -> ready -> busy -> (ready | terminating)
                                ↘
                                 failed -> ready_retry | terminal
```

- `idle`: no sandbox process.
- `starting`: launching process, loading image/config, waiting on readiness probe.
- `ready`: accepts run requests.
- `busy`: one active execution slot for phase 1.
- `terminating`: draining active calls, then shutdown.
- `failed`: terminal error; exposes restart and diagnostics.

### 4.2 Runtime interface
```ts
export interface LocalSandboxOptions {
  rootDir: string;                // project root
  command?: string;                // default: openclaw-runtime
  mode?: 'memory' | 'persist';
  timeoutMs?: number;
  env?: Record<string, string>;
  mounts?: Array<{ from: string; to: string; readOnly: boolean }>;
}

export interface LocalSandboxRuntime {
  start(): Promise<void>;
  stop({force?: boolean}): Promise<void>;
  status(): Promise<RuntimeStatus>;
  exec<TInput, TOutput>(payload: RuntimeExecRequest<TInput>): Promise<TOutput>;
  streamEvents(handler: (event: RuntimeEvent)=>void): void;
}
```

### 4.3 Data paths
1. `start()` validates configuration and resolves runtime binary/transport.
2. `sdk.client.tools.invoke(...)` can send to:
   - local runtime transport (`stdio` / local socket) in dev mode
   - remote gateway transport in production mode
3. Sandbox output is normalized via the same envelopes used by SDK (`Ok/Err`), preserving consistency.

### 4.4 Isolation and safety boundaries
- Temporary workspace for each run in `mode='memory'` (default), auto-clean on stop.
- Optional `persist` mode for debug with controlled retention TTL.
- Explicit allowlist of executable permissions and network restrictions.
- Event logs stored per-run with redaction hooks (secrets/env scrub).

### 4.5 Host compatibility layer
- First pass: cross-platform Node implementation (macOS/Linux/Windows via child_process or equivalent).
- Future: swap transport adapter to Docker/podman without changing SDK method signatures.

## 5) Quickstart flow (developer)

### 5.1 Install + run
```bash
pnpm add @openclaw/sdk @openclaw/sandbox @openclaw/cli
```

### 5.2 Minimal 30-second bootstrap
```ts
import { createClient } from '@openclaw/sdk';
import { createLocalSandbox } from '@openclaw/sandbox';

const sandbox = createLocalSandbox({ rootDir: process.cwd() });
await sandbox.start();

const client = createClient({
  sandbox: { runtime: sandbox },
  baseUrl: 'http://127.0.0.1:3939',
});

const result = await client.tools.invoke({
  name: 'echo',
  input: { value: 'hello-openclaw' },
});

if (result.ok) {
  console.log(result.data);
}

await sandbox.stop();
await client.close();
```

### 5.3 Local troubleshooting flow
1. `openclaw sandbox status` shows process + readiness.
2. `openclaw sandbox logs` streams startup and runtime logs.
3. `openclaw sandbox stop --force` to unblock stuck states.
4. `openclaw sdk doctor` validates env vars + versions.

### 5.4 CI/automation sample
- Add job step to run `openclaw sandbox start --ready-timeout 30s`.
- Execute integration tests with `OPENCLAW_SANDBOX=local`.
- Stop sandbox in `finally` block.

## 6) Test strategy

### 6.1 Unit (new package foundations)
- `sdk`:
  - request serialization/deserialization
  - typed validators and error mapping
  - retry helper logic
  - transport URL/path builder
- `sandbox`:
  - state transitions
  - launch command argument sanitation
  - timeout and cleanup flows
  - event emission ordering

### 6.2 Integration
- Contract tests using in-memory fake gateway + real sandbox process shim.
- Matrix:
  - Node versions supported
  - OS runners where available (CI can gate at least linux first)
  - `mode=memory` and `mode=persist`
- Assertions:
  - create session, invoke tool, stream events, stop cleanly
  - health check + reconnect after transient crash

### 6.3 E2E
- CLI scenario from install to invoke to teardown.
- Golden-output snapshots for quickstart command output.
- Negative cases:
  - invalid tool input
  - runtime startup timeout
  - sudden process death and restart recovery

### 6.4 Compatibility and contract checks
- Golden JSON schema snapshots for API envelopes.
- `@openclaw/sdk` semver boundary tests to avoid accidental breaking fields.
- Backward-compat compatibility-mode test: existing clients using default config still work with no sandbox config.

## 7) Delivery plan

### Phase 1 (1–2 weeks): API and scaffolding
- Add package shells and exports.
- Publish minimal `sdk` + `sandbox` type definitions.
- Add local sandbox state machine + fake transport for tests.
- Deliver docs + quickstart.

### Phase 2 (2–3 weeks): Runtime implementation
- Replace sandbox fake transport with working local runtime bootstrap.
- Implement CLI commands and health/status endpoints.
- Add failure recovery and structured diagnostics.

### Phase 3 (1 week): Hardening + rollout
- Integration test hardening and CI matrix expansion.
- Public docs site updates and migration notes.
- Versioned release + deprecation policy for optional API fields.

## 8) Risks and mitigations

- **Process lifecycle complexity:** Mitigate with strict state machine + tests for each transition.
- **Platform variance:** keep runtime launch abstraction thin and adapter-based.
- **Protocol drift:** generate schema from shared types to keep SDK/runtime synced.
- **Developer friction:** enforce one-command quickstart and actionable CLI diagnostics.

## 9) Open questions (for mainline design review)

1. Should `LocalSandboxRuntime` enforce single-flight execution only, or allow bounded parallelism in phase 1?
2. Where should auth/session credential exchange happen (SDK vs sandbox startup hook)?
3. Should persisted mode store logs/artifacts under user home cache or repo-local `.openclaw`?
4. Do we need signed runtime manifest validation at process startup?

---

## 10) Minimal next-step recommendations

1. Confirm final package names/namespaces (`@openclaw/sdk`, `@openclaw/sandbox`, `@openclaw/cli`).
2. Assign owners for each package boundary + test owners.
3. Approve phase-1 interface lock so implementation can proceed without API churn.
4. Add acceptance criteria for quickstart and one end-to-end local execution path.
