/**
 * @openclaw/sandbox - Local Sandbox Runtime
 *
 * A local development sandbox for OpenClaw that enables offline testing
 * and deterministic execution of tool workflows.
 */

// State machine
export {
  type RuntimeState,
  type RuntimeStateTerminal,
  RUNTIME_STATE_TRANSITIONS,
  isValidTransition,
  getStateDescription,
} from "./state-machine.js";

// Core types
export {
  type LocalSandboxOptions,
  type RuntimeStatus,
  type RuntimeExecRequest,
  type RuntimeExecResult,
  type RuntimeExecError,
  type RuntimeExecResponse,
  type RuntimeEvent,
  type RuntimeEventType,
  type EventHandler,
  type SandboxLifecycleCallbacks,
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  DEFAULT_EXECUTION_TIMEOUT_MS,
} from "./types.js";

// Runtime implementation
export { LocalSandboxRuntime, createLocalSandbox } from "./runtime.js";
