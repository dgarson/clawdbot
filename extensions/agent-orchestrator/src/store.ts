import path from "node:path";
import {
  createSessionRuntimeStore,
  type SessionRuntimeStore,
} from "../../../src/plugin-sdk/session-runtime-store.js";
import type { OrchestratorSessionState } from "./types.js";

export type OrchestratorStore = SessionRuntimeStore<OrchestratorSessionState>;

export function createOrchestratorStore(stateDir: string): OrchestratorStore {
  return createSessionRuntimeStore<OrchestratorSessionState>({
    stateDir: path.join(stateDir, "agent-orchestrator"),
    maxEntries: 200,
    ttlMs: 2 * 60 * 60 * 1000, // 2 hours
    create: (): OrchestratorSessionState => ({}),
    flush: { kind: "periodic", intervalMs: 5000 },
    ephemeral: false,
  });
}
