import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
import type { BudgetAllocation, BudgetScope, BudgetWindow } from "./types.js";

/**
 * Raw hierarchy file schema — matches the JSON structure from the plan doc.
 */
type HierarchyFile = {
  system?: ScopeConfig;
  organizations?: Record<string, ScopeConfig>;
  teams?: Record<string, ScopeConfig & { organization?: string }>;
  agents?: Record<string, ScopeConfig & { organization?: string; team?: string }>;
};

type ScopeConfig = {
  limits?: BudgetAllocation["limits"];
  window?: BudgetWindow;
  breachAction?: BudgetAllocation["breachAction"];
  degradeModel?: string;
  alertAt?: number[];
};

const DEFAULT_ALERT_THRESHOLDS = [0.5, 0.8, 0.95];
const DEFAULT_WINDOW: BudgetWindow = { kind: "daily" };

/**
 * Resolves agent IDs to their full hierarchy of budget scopes and allocations.
 */
export class ScopeResolver {
  private hierarchy: HierarchyFile;

  constructor(hierarchy: HierarchyFile) {
    this.hierarchy = hierarchy;
  }

  /**
   * Resolve the full chain of budget scopes for an agent, from agent up to system.
   * Returns allocations bottom-up: [session?, agent, team, org, system].
   * Only scopes with configured allocations are included.
   * When `sessionKey` is provided, a transient session-level scope is prepended
   * that inherits the agent's allocation limits but tracks usage independently.
   */
  resolveScopes(agentId: string, sessionKey?: string): BudgetAllocation[] {
    const allocations: BudgetAllocation[] = [];

    // Agent scope
    const agentCfg = this.hierarchy.agents?.[agentId];
    if (agentCfg) {
      const orgId = agentCfg.organization ?? "default";
      const teamId = agentCfg.team;

      const agentAllocation = this.buildAllocation(
        { level: "agent", id: agentId, parentId: teamId ?? orgId },
        agentCfg,
      );

      // Session scope: transient innermost scope that inherits agent limits
      if (sessionKey) {
        allocations.push(
          this.buildAllocation({ level: "session", id: sessionKey, parentId: agentId }, agentCfg),
        );
      }

      allocations.push(agentAllocation);

      // Team scope
      if (teamId) {
        const teamCfg = this.hierarchy.teams?.[teamId];
        if (teamCfg) {
          allocations.push(
            this.buildAllocation({ level: "team", id: teamId, parentId: orgId }, teamCfg),
          );
        }
      }

      // Organization scope
      const orgCfg = this.hierarchy.organizations?.[orgId];
      if (orgCfg) {
        allocations.push(
          this.buildAllocation({ level: "organization", id: orgId, parentId: "system" }, orgCfg),
        );
      }
    }

    // System scope (always included if configured)
    if (this.hierarchy.system) {
      allocations.push(
        this.buildAllocation(
          { level: "system", id: "system", parentId: null },
          this.hierarchy.system,
        ),
      );
    }

    return allocations;
  }

  /** List all configured scopes. */
  listScopes(): BudgetScope[] {
    const scopes: BudgetScope[] = [];

    if (this.hierarchy.system) {
      scopes.push({ level: "system", id: "system", parentId: null });
    }

    for (const orgId of Object.keys(this.hierarchy.organizations ?? {})) {
      scopes.push({ level: "organization", id: orgId, parentId: "system" });
    }

    for (const [teamId, teamCfg] of Object.entries(this.hierarchy.teams ?? {})) {
      scopes.push({ level: "team", id: teamId, parentId: teamCfg.organization ?? "default" });
    }

    for (const [agentId, agentCfg] of Object.entries(this.hierarchy.agents ?? {})) {
      scopes.push({
        level: "agent",
        id: agentId,
        parentId: agentCfg.team ?? agentCfg.organization ?? "default",
      });
    }

    return scopes;
  }

  /** Get a single allocation by scope level and ID. */
  getAllocation(level: BudgetScope["level"], id: string): BudgetAllocation | undefined {
    let cfg: ScopeConfig | undefined;
    let scope: BudgetScope;

    switch (level) {
      case "system":
        cfg = this.hierarchy.system;
        scope = { level: "system", id: "system", parentId: null };
        break;
      case "organization":
        cfg = this.hierarchy.organizations?.[id];
        scope = { level: "organization", id, parentId: "system" };
        break;
      case "team": {
        const teamCfg = this.hierarchy.teams?.[id];
        cfg = teamCfg;
        scope = { level: "team", id, parentId: teamCfg?.organization ?? "default" };
        break;
      }
      case "agent": {
        const agentCfg = this.hierarchy.agents?.[id];
        cfg = agentCfg;
        scope = {
          level: "agent",
          id,
          parentId: agentCfg?.team ?? agentCfg?.organization ?? "default",
        };
        break;
      }
      default:
        return undefined;
    }

    if (!cfg) return undefined;
    return this.buildAllocation(scope, cfg);
  }

  /**
   * Update or create an allocation for a given scope level and id.
   * Only the provided fields are merged; unset fields keep their prior values.
   */
  setAllocation(level: BudgetScope["level"], id: string, update: Partial<ScopeConfig>): void {
    switch (level) {
      case "system":
        this.hierarchy.system = { ...this.hierarchy.system, ...update };
        break;
      case "organization":
        if (!this.hierarchy.organizations) this.hierarchy.organizations = {};
        this.hierarchy.organizations[id] = { ...this.hierarchy.organizations[id], ...update };
        break;
      case "team":
        if (!this.hierarchy.teams) this.hierarchy.teams = {};
        this.hierarchy.teams[id] = { ...this.hierarchy.teams[id], ...update };
        break;
      case "agent":
        if (!this.hierarchy.agents) this.hierarchy.agents = {};
        this.hierarchy.agents[id] = { ...this.hierarchy.agents[id], ...update };
        break;
      case "session":
        // Sessions are transient and not persisted in hierarchy
        break;
    }
  }

  /** Serialize the current hierarchy to JSON for disk persistence. */
  toJSON(): string {
    return JSON.stringify(this.hierarchy, null, 2);
  }

  private buildAllocation(scope: BudgetScope, cfg: ScopeConfig): BudgetAllocation {
    return {
      scope,
      window: cfg.window ?? DEFAULT_WINDOW,
      limits: cfg.limits ?? {},
      breachAction: cfg.breachAction ?? "warn",
      degradeModel: cfg.degradeModel,
      alertAt: cfg.alertAt ?? DEFAULT_ALERT_THRESHOLDS,
    };
  }
}

/** Load hierarchy file from disk. Returns an empty resolver if the file is missing. */
export async function loadScopeResolver(
  stateDir: string,
  filename: string,
  logger: Logger,
): Promise<ScopeResolver> {
  const filePath = join(stateDir, filename);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as HierarchyFile;
    logger.info(`budget-manager: loaded hierarchy from ${filePath}`);
    return new ScopeResolver(parsed);
  } catch {
    logger.info("budget-manager: no hierarchy file found, starting with empty hierarchy");
    return new ScopeResolver({});
  }
}

/** Persist the current hierarchy to the state directory. */
export async function persistHierarchy(
  scopeResolver: ScopeResolver,
  stateDir: string,
  filename: string,
  logger: Logger,
): Promise<void> {
  const filePath = join(stateDir, filename);
  try {
    await writeFile(filePath, scopeResolver.toJSON(), "utf-8");
    logger.info(`budget-manager: persisted hierarchy to ${filePath}`);
  } catch (err) {
    logger.warn(`budget-manager: failed to persist hierarchy: ${String(err)}`);
  }
}
