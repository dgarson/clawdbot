import type { OpenClawConfig } from "../config/config.js";
import type { AgentConfig } from "../config/types.agents.js";
import type { SqliteWorkQueueBackend } from "./backend/sqlite-backend.js";
import type { WorkerMetricsSnapshot } from "./worker-metrics.js";
import { readLatestAssistantReply } from "../agents/tools/agent-step.js";
import { callGateway } from "../gateway/call.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { LlmContextExtractor, TranscriptContextExtractor } from "./context-extractor.js";
import { recoverOrphanedWorkItems } from "./recovery.js";
import { getDefaultWorkQueueStore, type WorkQueueStore } from "./store.js";
import { DEFAULT_HEARTBEAT_TTL_MS, DEFAULT_RECOVERY_INTERVAL_MS } from "./worker-defaults.js";
import { WorkQueueWorker, type WorkerDeps } from "./worker.js";
import { WorkflowWorkerAdapter } from "./workflow/adapter.js";
import { WorkstreamNotesStore, SqliteWorkstreamNotesBackend } from "./workstream-notes.js";

export type WorkerManagerOptions = {
  config: OpenClawConfig;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
    trace: (msg: string) => void;
  };
};

/** Common interface between WorkQueueWorker and WorkflowWorkerAdapter. */
type AnyWorker = {
  readonly agentId: string;
  readonly isRunning: boolean;
  readonly currentWorkItemId: string | null;
  getConfig(): import("../config/types.agents.js").WorkerConfig;
  getMetrics(): WorkerMetricsSnapshot;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export class WorkQueueWorkerManager {
  private workers = new Map<string, AnyWorker>();
  private config: OpenClawConfig;
  private log: WorkerManagerOptions["log"];
  private notesStore: WorkstreamNotesStore | undefined;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private recoveryInFlight = false;
  private recoveryIntervalMs: number | null = null;

  constructor(opts: WorkerManagerOptions) {
    this.config = opts.config;
    this.log = opts.log ?? createSubsystemLogger("work-queue");
  }

  async start(): Promise<void> {
    const agents = this.config.agents?.list ?? [];
    const workerAgents = agents.filter((a) => a.worker?.enabled);

    if (workerAgents.length === 0) {
      this.log!.info("no worker agents configured");
      return;
    }

    const store = await getDefaultWorkQueueStore();

    // Try to set up the notes store from the SQLite backend's DB handle.
    this.notesStore = await this.createNotesStore();

    for (const agent of workerAgents) {
      await this.startWorker(agent, store);
    }

    this.startRecoveryLoop(store);

    this.log!.info(`started ${this.workers.size} worker(s)`);
  }

  async stop(): Promise<void> {
    this.stopRecoveryLoop();
    const stopPromises = Array.from(this.workers.values()).map((w) => w.stop());
    await Promise.allSettled(stopPromises);
    this.workers.clear();
    this.log!.info("all workers stopped");
  }

  getWorkers(): Array<{
    agentId: string;
    running: boolean;
    currentItemId: string | null;
  }> {
    return Array.from(this.workers.values()).map((w) => ({
      agentId: w.agentId,
      running: w.isRunning,
      currentItemId: w.currentWorkItemId,
    }));
  }

  getMetrics(): WorkerMetricsSnapshot[] {
    return Array.from(this.workers.values()).map((w) => w.getMetrics());
  }

  async reconcile(config: OpenClawConfig): Promise<void> {
    this.config = config;
    const desired = new Set(
      (config.agents?.list ?? []).filter((a) => a.worker?.enabled).map((a) => a.id),
    );

    // Stop removed workers.
    for (const [id, worker] of this.workers) {
      if (!desired.has(id)) {
        await worker.stop();
        this.workers.delete(id);
        this.log!.info(`reconcile: stopped worker ${id}`);
      }
    }

    // Start new / restart changed workers.
    const store = await getDefaultWorkQueueStore();
    for (const agent of (config.agents?.list ?? []).filter((a) => a.worker?.enabled)) {
      const existing = this.workers.get(agent.id);
      if (!existing) {
        await this.startWorker(agent, store);
        this.log!.info(`reconcile: started worker ${agent.id}`);
      } else if (this.configChanged(existing.getConfig(), agent.worker!)) {
        await existing.stop();
        this.workers.delete(agent.id);
        await this.startWorker(agent, store);
        this.log!.info(`reconcile: restarted worker ${agent.id}`);
      }
    }

    this.startRecoveryLoop(store);
  }

  private configChanged(
    a: import("../config/types.agents.js").WorkerConfig,
    b: import("../config/types.agents.js").WorkerConfig,
  ): boolean {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  private async startWorker(
    agent: AgentConfig,
    store: Awaited<ReturnType<typeof getDefaultWorkQueueStore>>,
  ): Promise<void> {
    const workerConfig = agent.worker!;
    const queueId = workerConfig.queueId?.trim() || agent.id;
    const workstreams = workerConfig.workstreams?.join(", ") || "(all)";
    const mode = workerConfig.workflow?.enabled ? "workflow" : "classic";
    this.log!.info(
      `worker config: agent=${agent.id} queue=${queueId} mode=${mode} workstreams=${workstreams}`,
    );
    const gwCall = <T = Record<string, unknown>>(opts: {
      method: string;
      params?: unknown;
      timeoutMs?: number;
    }) => callGateway<T>({ ...opts, config: this.config });

    // Route to workflow engine if workflow is enabled.
    if (workerConfig.workflow?.enabled) {
      const adapter = new WorkflowWorkerAdapter({
        agentId: agent.id,
        config: workerConfig,
        deps: {
          store,
          callGateway: gwCall,
          log: this.log!,
          notesStore: this.notesStore,
        },
      });
      this.workers.set(agent.id, adapter);
      await adapter.start();
      return;
    }

    const extractor =
      workerConfig.contextExtractor === "llm"
        ? new LlmContextExtractor({
            callGateway: gwCall,
            readFullTranscript: async (params) => {
              const result = await gwCall<{ messages?: unknown[] }>({
                method: "chat.history",
                params: { sessionKey: params.sessionKey, limit: params.limit },
                timeoutMs: 10_000,
              });
              return result?.messages ?? [];
            },
            log: this.log!,
          })
        : new TranscriptContextExtractor({ readLatestAssistantReply });

    const deps: WorkerDeps = {
      store,
      extractor,
      notesStore: this.notesStore,
      callGateway: gwCall,
      log: this.log!,
    };

    const worker = new WorkQueueWorker({
      agentId: agent.id,
      config: workerConfig,
      deps,
    });

    this.workers.set(agent.id, worker);
    await worker.start();
  }

  private async createNotesStore(): Promise<WorkstreamNotesStore | undefined> {
    try {
      const store = await getDefaultWorkQueueStore();
      const backend = store.backend;
      if (
        backend &&
        "getDb" in backend &&
        typeof (backend as SqliteWorkQueueBackend).getDb === "function"
      ) {
        const db = (backend as SqliteWorkQueueBackend).getDb();
        if (db) {
          return new WorkstreamNotesStore(new SqliteWorkstreamNotesBackend(db));
        }
      }
    } catch {
      this.log!.debug("workstream notes store not available (non-sqlite backend)");
    }
    return undefined;
  }

  private startRecoveryLoop(store: WorkQueueStore): void {
    const intervalMs = this.resolveRecoveryIntervalMs();
    if (!intervalMs || intervalMs <= 0) {
      this.stopRecoveryLoop();
      return;
    }

    if (this.recoveryTimer && this.recoveryIntervalMs === intervalMs) {
      return;
    }

    this.stopRecoveryLoop();
    this.recoveryIntervalMs = intervalMs;
    this.recoveryTimer = setInterval(() => {
      void this.runRecovery(store);
    }, intervalMs);
    this.log!.info(`recovery loop enabled (interval=${intervalMs}ms)`);
  }

  private stopRecoveryLoop(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
      this.recoveryIntervalMs = null;
    }
  }

  private resolveRecoveryIntervalMs(): number {
    const configured = this.config.gateway?.workQueue?.recoveryIntervalMs;
    if (typeof configured === "number" && Number.isFinite(configured)) {
      return Math.max(1_000, Math.floor(configured));
    }
    return DEFAULT_RECOVERY_INTERVAL_MS;
  }

  private resolveRecoveryHeartbeatTtlMs(): number {
    const configured = this.config.gateway?.workQueue?.heartbeatTtlMs;
    if (typeof configured === "number" && Number.isFinite(configured)) {
      return Math.max(1_000, Math.floor(configured));
    }
    const workerTtls = (this.config.agents?.list ?? [])
      .map((agent) => agent.worker?.heartbeatTtlMs)
      .filter((ttl): ttl is number => typeof ttl === "number" && Number.isFinite(ttl));
    if (workerTtls.length > 0) {
      return Math.min(...workerTtls);
    }
    return DEFAULT_HEARTBEAT_TTL_MS;
  }

  private async runRecovery(store: WorkQueueStore): Promise<void> {
    if (this.recoveryInFlight) {
      return;
    }
    this.recoveryInFlight = true;
    try {
      const heartbeatTtlMs = this.resolveRecoveryHeartbeatTtlMs();
      const result = await recoverOrphanedWorkItems(store, { heartbeatTtlMs });
      if (result.recovered.length > 0) {
        this.log!.warn(`recovered ${result.recovered.length} orphaned item(s)`);
      }
      if (result.failed.length > 0) {
        this.log!.warn(`failed to recover ${result.failed.length} orphaned item(s)`);
      }
    } catch (err) {
      this.log!.warn(`recovery loop failed: ${String(err)}`);
    } finally {
      this.recoveryInFlight = false;
    }
  }
}
