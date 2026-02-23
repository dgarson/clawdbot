import type { RuntimeStatus } from "@openclaw/sdk";

export interface SandboxHealth {
  healthy: boolean;
  state: RuntimeStatus["state"];
  checks: {
    workspace: boolean;
    transport: boolean;
  };
}

export const inspectHealth = (status: RuntimeStatus): SandboxHealth => {
  return {
    healthy: status.state === "ready",
    state: status.state,
    checks: {
      workspace: Boolean(status.rootDir),
      transport: status.runtime?.pid !== undefined,
    },
  };
};
