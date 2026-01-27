/**
 * Core type definitions for the Automations feature.
 *
 * This module defines all TypeScript types used throughout the automations system,
 * including schedules, automation configs, runtime state, and history tracking.
 */

/**
 * Schedule types for automations.
 * - "at": One-time execution at a specific timestamp
 * - "every": Repeating execution at a fixed interval
 * - "cron": Repeating execution based on a cron expression
 */
export type AutomationSchedule =
  | { kind: "at"; atMs: number }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

/**
 * Supported automation types.
 * - "smart-sync-fork": Automated fork synchronization
 * - "custom-script": User-defined script execution
 * - "webhook": HTTP webhook automation
 */
export type AutomationTypeKind = "smart-sync-fork" | "custom-script" | "webhook";

/**
 * Runtime status of an automation.
 * - "active": Automation is running normally
 * - "suspended": Automation is temporarily paused
 * - "error": Automation encountered an error
 */
export type AutomationStatus = "active" | "suspended" | "error";

/**
 * Base automation properties shared across all types.
 */
export interface AutomationBase {
  /** Unique identifier for the automation */
  id: string;
  /** Optional agent ID to associate with this automation */
  agentId?: string;
  /** Human-readable name */
  name: string;
  /** Optional description of what this automation does */
  description?: string;
  /** Whether the automation is enabled for execution */
  enabled: boolean;
  /** Current runtime status */
  status: AutomationStatus;
  /** Creation timestamp in milliseconds */
  createdAtMs: number;
  /** Last update timestamp in milliseconds */
  updatedAtMs: number;
  /** Schedule definition */
  schedule: AutomationSchedule;
  /** Type of automation */
  type: AutomationTypeKind;
  /** User-defined tags for organization */
  tags: string[];
}

/**
 * Configuration for smart-sync-fork automations.
 * Synchronizes a fork branch with its upstream repository.
 */
export interface SmartSyncForkConfig {
  type: "smart-sync-fork";
  /** URL of the fork repository */
  forkRepoUrl: string;
  /** URL of the upstream repository */
  upstreamRepoUrl: string;
  /** Branch name in the fork */
  forkBranch: string;
  /** Branch name in the upstream */
  upstreamBranch: string;
  /** Sync strategy: merge, rebase, or cherry-pick */
  strategy: "merge" | "rebase" | "cherry-pick";
  /** Conflict resolution strategy: fail, prefer-theirs, prefer-ours */
  conflictResolution: "fail" | "prefer-theirs" | "prefer-ours";
  /** Whether to create a pull request after sync */
  createPullRequest?: boolean;
  /** Pull request configuration */
  pullRequest?: {
    /** Title template for PR (supports: {upstreamBranch}, {forkBranch}, {upstreamRepoUrl}, {forkRepoUrl}, {strategy}, {conflictResolution}) */
    titleTemplate?: string;
    /** Body template for PR (same variables as titleTemplate) */
    bodyTemplate?: string;
    /** Create PR as draft */
    draft?: boolean;
    /** Assignees to add to PR */
    assignees?: string[];
    /** Labels to add to PR */
    labels?: string[];
    /** Reviewers to request */
    reviewers?: string[];
  };
  /** Optional GitHub auth token for PR creation */
  authToken?: string;
  /** Optional committer info */
  committer?: {
    /** Committer name */
    name?: string;
    /** Committer email */
    email?: string;
  };
}

/**
 * Configuration for custom-script automations.
 * Executes user-defined scripts with specified parameters.
 */
export interface CustomScriptConfig {
  type: "custom-script";
  /** File path to the script (not inline content) */
  script: string;
  /** Optional command-line arguments */
  args?: string[];
  /** Environment variables to pass to the script */
  environment?: Record<string, string>;
  /** Working directory for script execution */
  workingDirectory?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Configuration for webhook automations.
 * Makes HTTP requests to specified endpoints.
 */
export interface WebhookConfig {
  type: "webhook";
  /** HTTP method to use */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** URL to send the request to */
  url: string;
  /** Optional request headers */
  headers?: Record<string, string>;
  /** Optional request body (for POST/PUT/PATCH) */
  body?: string;
  /** Content type of the request */
  contentType?: string;
  /** Whether to follow redirects */
  followRedirects?: boolean;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Retry policy configuration */
  retryPolicy?: {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Initial delay in milliseconds (default: 1000) */
    initialDelayMs?: number;
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelayMs?: number;
    /** Backoff multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number;
    /** Whether to retry on 5xx errors (default: true) */
    retryOn5xx?: boolean;
    /** Custom status codes to retry (default: none) */
    retryStatusCodes?: number[];
    /** Status codes considered successful (default: [200, 201, 202, 204]) */
    successStatusCodes?: number[];
  };
  /** TLS configuration */
  tls?: {
    /** Whether to reject unauthorized certificates (default: true) */
    rejectUnauthorized?: boolean;
  };
}

/**
 * Union type of all automation configurations.
 */
export type AutomationConfig = SmartSyncForkConfig | CustomScriptConfig | WebhookConfig;

/**
 * Full automation type combining base properties with config and state.
 * The state property is added by the store layer.
 */
export type Automation = AutomationBase & {
  config: AutomationConfig;
  state: AutomationState;
};

/**
 * Runtime state of an automation (tracked alongside the automation).
 */
export interface AutomationState {
  /** Next scheduled run time in milliseconds */
  nextRunAtMs?: number;
  /** Timestamp when automation started running */
  runningAtMs?: number;
  /** Timestamp of the last run */
  lastRunAtMs?: number;
  /** Status of the last run */
  lastStatus?: "success" | "error" | "cancelled" | "blocked";
  /** Error message from the last run if it failed */
  lastError?: string;
  /** Duration of the last run in milliseconds */
  lastDurationMs?: number;
  /** ID of the last run */
  lastRunId?: string;
}

/**
 * Milestone status within a run timeline.
 */
export type AutomationMilestoneStatus = "completed" | "current" | "pending";

/**
 * A milestone in the automation run timeline.
 */
export interface AutomationMilestone {
  /** Unique identifier for this milestone */
  id: string;
  /** Human-readable title */
  title: string;
  /** Current status of this milestone */
  status: AutomationMilestoneStatus;
  /** ISO timestamp of when this milestone was reached */
  timestamp?: string;
}

/**
 * An artifact produced by an automation run.
 */
export interface AutomationArtifact {
  /** Unique identifier for this artifact */
  id: string;
  /** Human-readable name */
  name: string;
  /** Type/category of the artifact */
  type: string;
  /** Human-readable size (e.g., "1.2 MB") */
  size: string;
  /** URL to download or access the artifact */
  url: string;
}

/**
 * A conflict detected during automation execution.
 */
export interface AutomationConflict {
  /** Type/category of the conflict */
  type: string;
  /** Human-readable description */
  description: string;
  /** Suggested or applied resolution */
  resolution: string;
}

/**
 * Trigger mechanism for an automation run.
 */
export type AutomationTrigger = "schedule" | "manual" | "api";

/**
 * Status of an automation run.
 */
export type AutomationRunStatus = "running" | "success" | "error" | "cancelled" | "blocked";

/**
 * AI model information for an automation run.
 */
export interface AutomationAiModel {
  /** Model name */
  name: string;
  /** Model version */
  version: string;
  /** Number of tokens used */
  tokensUsed: number;
  /** Cost of the run */
  cost: string;
}

/**
 * A single automation run record.
 */
export interface AutomationRun {
  /** Unique identifier for this run */
  id: string;
  /** ID of the automation that was run */
  automationId: string;
  /** Name of the automation (snapshotted at run time) */
  automationName: string;
  /** When the run started */
  startedAt: Date;
  /** When the run completed (undefined if still running) */
  completedAt?: Date;
  /** Current status of the run */
  status: AutomationRunStatus;
  /** Timeline of milestones */
  milestones: AutomationMilestone[];
  /** Artifacts produced during the run */
  artifacts: AutomationArtifact[];
  /** Conflicts detected during the run */
  conflicts: AutomationConflict[];
  /** Error message if the run failed */
  error?: string;
  /** How this run was triggered */
  triggeredBy: AutomationTrigger;
  /** AI model info if AI was used */
  aiModel?: AutomationAiModel;
}

/**
 * Store file structure for persisting automations.
 */
export interface AutomationStoreFile {
  /** Store format version */
  version: 1;
  /** All automations with their runtime state */
  automations: Automation[];
  /** Historical run records */
  runHistory: AutomationRun[];
  /** Number of days to retain history */
  historyRetentionDays: number;
  /** Maximum runs to keep per automation */
  historyMaxRunsPerAutomation: number;
}

/**
 * Input for creating a new automation.
 */
export type AutomationCreate = Omit<Automation, "id" | "createdAtMs" | "updatedAtMs"> & {
  state?: Partial<AutomationState>;
};

/**
 * Input for patching an existing automation.
 */
export type AutomationPatch = Partial<Omit<Automation, "id" | "createdAtMs" | "state">> & {
  state?: Partial<AutomationState>;
};

/**
 * Result type for automation get operations.
 */
export type AutomationGetResult = Automation | null;

/**
 * Result type for automation delete operations.
 */
export type AutomationDeleteResult = { ok: true; deleted: boolean } | { ok: false; deleted: false };

/**
 * Result type for automation run operations.
 */
export type AutomationRunResult =
  | { ok: true; runId: string }
  | { ok: true; ran: false; reason: "not-due" | "disabled" | "not-found" };

/**
 * Result type for automation cancel operations.
 */
export type AutomationCancelResult =
  | { ok: true; cancelled: boolean }
  | { ok: false; cancelled: false };

/**
 * Result type for history query operations.
 */
export type AutomationHistoryResult = {
  runs: AutomationRun[];
};

/**
 * SSE event types for automation lifecycle.
 */
export type AutomationEventType =
  | "automation.started"
  | "automation.progress"
  | "automation.completed"
  | "automation.failed"
  | "automation.cancelled"
  | "automation.blocked";

/**
 * Base SSE event structure for automations.
 */
export interface AutomationEvent {
  /** ID of the automation */
  automationId: string;
  /** ID of the run */
  runId: string;
  /** Event type */
  type: AutomationEventType;
  /** When the event occurred */
  timestamp: Date;
  /** Event-specific data */
  data: {
    /** Optional milestone title for progress events */
    milestone?: string;
    /** Optional percentage complete (0-100) */
    percentage?: number;
    /** Optional status message */
    status?: string;
    /** Optional error message */
    error?: string;
    /** Optional artifacts produced */
    artifacts?: AutomationArtifact[];
    /** Optional conflicts detected */
    conflicts?: AutomationConflict[];
  };
}

/**
 * Service dependencies for AutomationService.
 */
export interface AutomationServiceDeps {
  /** Optional custom time function (defaults to Date.now) */
  nowMs?: () => number;
  /** Logger instance */
  log: Logger;
  /** Path to the automations store file */
  storePath: string;
  /** Whether automations are enabled */
  automationsEnabled: boolean;
  /** Callback for emitting SSE events */
  emitAutomationEvent: (event: AutomationEvent) => void;
  /** Callback for running isolated agent jobs */
  runIsolatedAgentJob: (params: { automation: Automation; message: string }) => Promise<{
    status: "ok" | "error" | "skipped";
    summary?: string;
    outputText?: string;
    error?: string;
    artifacts?: AutomationArtifact[];
    conflicts?: AutomationConflict[];
    aiModel?: AutomationAiModel;
  }>;
  /** Optional callback for all events */
  onEvent?: (event: AutomationEvent) => void;
}

/**
 * Logger interface required by the automations service.
 */
export type Logger = {
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

/**
 * Service status summary.
 */
export interface AutomationStatusSummary {
  /** Whether automations are enabled */
  enabled: boolean;
  /** Path to the store file */
  storePath: string;
  /** Number of automations */
  automations: number;
  /** Next scheduled wake time in milliseconds */
  nextWakeAtMs: number | null;
}
