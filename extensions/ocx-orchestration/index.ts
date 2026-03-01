// ---------------------------------------------------------------------------
// Orchestration plugin entry point
//
// Registers:
//   - Agent tool: "orchestration" (list_items, update_item, request_review,
//     report_blocked, sprint_status)
//   - Hook: subagent_ended (detect delegation completion)
//   - HTTP route: /plugin/orchestration/webhook/git
//   - Gateway methods: orchestration.orgs.*, orchestration.teams.*,
//     orchestration.sprints.*, orchestration.items.*,
//     orchestration.escalations.*
//   - Background service: escalation monitor
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import type {
  AnyAgentTool,
  GatewayRequestHandlerOptions,
  OpenClawPluginApi,
} from "openclaw/plugin-sdk";
import { emitAgentEvent, stringEnum } from "openclaw/plugin-sdk";
import { resolveOrchestrationConfig } from "./src/config.js";
import {
  addDelegation,
  completeDelegation,
  findActiveDelegationBySessionKey,
} from "./src/domain/delegation.js";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
} from "./src/domain/organization.js";
import { recordVerdict, requestReview } from "./src/domain/review.js";
import {
  createSprint,
  getSprintReport,
  listSprints,
  transitionSprint,
} from "./src/domain/sprint.js";
import { addMember, createTeam, listMembers, listTeams } from "./src/domain/team.js";
import {
  createWorkItem,
  findByExternalRef,
  listWorkItems,
  updateWorkItem,
  updateWorkItemState,
} from "./src/domain/work-item.js";
import { listOpenEscalations, resolveEscalation } from "./src/escalation.js";
import { startMonitor } from "./src/monitor.js";
import { OrchestrationStore } from "./src/storage.js";
import type { ReviewVerdict, SprintState, WorkItemState } from "./src/types.js";

// ---------------------------------------------------------------------------
// Tool schema
// ---------------------------------------------------------------------------

const TOOL_ACTIONS = [
  "list_items",
  "update_item",
  "request_review",
  "report_blocked",
  "sprint_status",
] as const;

const OrchestrationToolSchema = Type.Object({
  action: stringEnum(TOOL_ACTIONS, {
    description: "The orchestration action to perform.",
  }),
  workItemId: Type.Optional(
    Type.String({
      description: "Work item ID (required for update_item, request_review, report_blocked).",
    }),
  ),
  sprintId: Type.Optional(
    Type.String({
      description: "Sprint ID (required for sprint_status, optional filter for list_items).",
    }),
  ),
  state: Type.Optional(Type.String({ description: "New state for update_item." })),
  title: Type.Optional(Type.String({ description: "Updated title for update_item." })),
  description: Type.Optional(Type.String({ description: "Updated description for update_item." })),
  reviewerAgentId: Type.Optional(
    Type.String({ description: "Reviewer agent ID for request_review." }),
  ),
  reason: Type.Optional(Type.String({ description: "Reason text (used with report_blocked)." })),
});

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

export default function register(api: OpenClawPluginApi) {
  const config = resolveOrchestrationConfig(
    api.pluginConfig as Record<string, unknown> | undefined,
  );
  const logger = api.logger;

  // We lazily create the store when the service starts (once stateDir is known).
  // For gateway methods / hooks that fire before the service, use a fallback
  // pointing to the workspace .openclaw dir.
  let store: OrchestrationStore | null = null;

  function ensureStore(): OrchestrationStore {
    if (!store) {
      // Fallback: use api.config stateDir or cwd
      const fallbackDir = (api.config as Record<string, unknown>).stateDir as string | undefined;
      store = new OrchestrationStore(fallbackDir ?? process.cwd());
    }
    return store;
  }

  // -----------------------------------------------------------------------
  // Helper: JSON tool result
  // -----------------------------------------------------------------------

  function json(payload: unknown) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    };
  }

  // -----------------------------------------------------------------------
  // Helper: emit orchestration domain events
  // -----------------------------------------------------------------------

  function emitOrchEvent(type: string, data: Record<string, unknown>, runId?: string) {
    emitAgentEvent({
      runId: runId ?? `orch-${crypto.randomUUID().slice(0, 8)}`,
      stream: "orchestration",
      data: { family: "orchestration", type, ...data },
    });
  }

  // -----------------------------------------------------------------------
  // Agent tool
  // -----------------------------------------------------------------------

  api.registerTool(
    {
      name: "orchestration",
      label: "Orchestration",
      description:
        "Manage team work items, sprints, and reviews. Actions: list_items, update_item, request_review, report_blocked, sprint_status.",
      parameters: OrchestrationToolSchema,
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        const s = ensureStore();
        const action = params.action as (typeof TOOL_ACTIONS)[number];

        try {
          switch (action) {
            case "list_items": {
              const items = await listWorkItems(s, {
                sprintId: params.sprintId as string | undefined,
              });
              return json({ items });
            }
            case "update_item": {
              const id = params.workItemId as string;
              if (!id) return json({ error: "workItemId required" });
              const updated = await updateWorkItem(s, id, {
                title: params.title as string | undefined,
                description: params.description as string | undefined,
                state: params.state as WorkItemState | undefined,
              });
              if (!updated) return json({ error: `Work item ${id} not found` });
              return json({ item: updated });
            }
            case "request_review": {
              const id = params.workItemId as string;
              const reviewer = params.reviewerAgentId as string;
              if (!id || !reviewer)
                return json({ error: "workItemId and reviewerAgentId required" });
              const review = await requestReview(s, id, reviewer);
              if (!review) return json({ error: `Work item ${id} not found` });
              return json({ review });
            }
            case "report_blocked": {
              const id = params.workItemId as string;
              if (!id) return json({ error: "workItemId required" });
              const updated = await updateWorkItemState(s, id, "blocked");
              if (!updated) return json({ error: `Work item ${id} not found` });
              return json({ item: updated, blocked: true });
            }
            case "sprint_status": {
              const sprintId = params.sprintId as string;
              if (!sprintId) return json({ error: "sprintId required" });
              const report = await getSprintReport(s, sprintId);
              if (!report) return json({ error: `Sprint ${sprintId} not found` });
              return json(report);
            }
            default:
              return json({ error: `Unknown action: ${action}` });
          }
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    } as unknown as AnyAgentTool,
    { optional: true },
  );

  // -----------------------------------------------------------------------
  // Hook: subagent_ended -- detect delegation completion
  // -----------------------------------------------------------------------

  api.on("subagent_ended", async (event) => {
    const s = ensureStore();
    const match = await findActiveDelegationBySessionKey(s, event.targetSessionKey);
    if (!match) return;

    const status = event.outcome === "ok" ? "completed" : "failed";
    const outcome =
      event.outcome === "ok"
        ? "Delegation completed successfully."
        : `Delegation ended: ${event.reason ?? event.outcome ?? "unknown"}`;

    await completeDelegation(s, match.workItemId, event.targetSessionKey, status, outcome);

    logger.info(
      `[orchestration] Delegation for ${match.workItemId} (session ${event.targetSessionKey}) -> ${status}`,
    );
  });

  // -----------------------------------------------------------------------
  // HTTP route: Git webhook
  // -----------------------------------------------------------------------

  api.registerHttpRoute({
    path: "/plugin/orchestration/webhook/git",
    handler: async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end("Method Not Allowed");
        return;
      }

      try {
        // Read request body
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        const rawBody = Buffer.concat(chunks);

        // Verify HMAC signature when a webhook secret is configured
        if (config.gitWebhookSecret) {
          const expected =
            "sha256=" +
            crypto.createHmac("sha256", config.gitWebhookSecret).update(rawBody).digest("hex");
          const actual = req.headers["x-hub-signature-256"];
          if (typeof actual !== "string" || actual !== expected) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
          }
        }

        const body = JSON.parse(rawBody.toString("utf8"));

        const s = ensureStore();

        // Detect PR merged events (GitHub-style)
        if (
          body.action === "closed" &&
          body.pull_request?.merged === true &&
          typeof body.pull_request?.html_url === "string"
        ) {
          const prUrl = body.pull_request.html_url as string;
          const item = await findByExternalRef(s, prUrl);
          if (item) {
            await updateWorkItemState(s, item.id, "done");
            logger.info(`[orchestration] PR merged -> work item ${item.id} marked done (${prUrl})`);
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        logger.error(
          `[orchestration] Git webhook error: ${err instanceof Error ? err.message : String(err)}`,
        );
        res.writeHead(400);
        res.end("Bad Request");
      }
    },
  });

  // -----------------------------------------------------------------------
  // Gateway methods
  // -----------------------------------------------------------------------

  const sendError = (respond: (ok: boolean, payload?: unknown) => void, err: unknown) => {
    respond(false, { error: err instanceof Error ? err.message : String(err) });
  };

  // -- Organizations -------------------------------------------------------

  api.registerGatewayMethod(
    "orchestration.orgs.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const s = ensureStore();
        const orgs = await listOrganizations(s);
        respond(true, { organizations: orgs });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.orgs.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const name = typeof params?.name === "string" ? params.name.trim() : "";
        if (!name) {
          respond(false, { error: "name required" });
          return;
        }
        const s = ensureStore();
        const org = await createOrganization(s, { name });
        respond(true, { organization: org });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.orgs.get",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const id = typeof params?.id === "string" ? params.id : "";
        if (!id) {
          respond(false, { error: "id required" });
          return;
        }
        const s = ensureStore();
        const org = await getOrganization(s, id);
        if (!org) {
          respond(false, { error: `Organization ${id} not found` });
          return;
        }
        respond(true, { organization: org });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  // -- Teams ---------------------------------------------------------------

  api.registerGatewayMethod(
    "orchestration.teams.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const s = ensureStore();
        const teams = await listTeams(s, {
          organizationId:
            typeof params?.organizationId === "string" ? params.organizationId : undefined,
        });
        respond(true, { teams });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.teams.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const name = typeof params?.name === "string" ? params.name.trim() : "";
        const organizationId =
          typeof params?.organizationId === "string" ? params.organizationId : "";
        if (!name || !organizationId) {
          respond(false, { error: "name and organizationId required" });
          return;
        }
        const s = ensureStore();
        const team = await createTeam(s, {
          name,
          organizationId,
          members: Array.isArray(params?.members) ? params.members : undefined,
        });
        respond(true, { team });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.teams.members",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const teamId = typeof params?.teamId === "string" ? params.teamId : "";
        if (!teamId) {
          respond(false, { error: "teamId required" });
          return;
        }
        const s = ensureStore();

        // Add member if agentId + role provided
        if (typeof params?.agentId === "string" && typeof params?.role === "string") {
          const team = await addMember(s, teamId, {
            agentId: params.agentId,
            role: params.role as import("./src/types.js").AgentRole,
          });
          if (!team) {
            respond(false, { error: `Team ${teamId} not found` });
            return;
          }
          respond(true, { members: team.members });
          return;
        }

        // Otherwise list members
        const members = await listMembers(s, teamId);
        respond(true, { members });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  // -- Sprints -------------------------------------------------------------

  api.registerGatewayMethod(
    "orchestration.sprints.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const s = ensureStore();
        const sprints = await listSprints(s, {
          teamId: typeof params?.teamId === "string" ? params.teamId : undefined,
          state: typeof params?.state === "string" ? (params.state as SprintState) : undefined,
        });
        respond(true, { sprints });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.sprints.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const teamId = typeof params?.teamId === "string" ? params.teamId : "";
        const name = typeof params?.name === "string" ? params.name.trim() : "";
        if (!teamId || !name) {
          respond(false, { error: "teamId and name required" });
          return;
        }
        const s = ensureStore();
        const sprint = await createSprint(s, {
          teamId,
          name,
          budgetScopeId:
            typeof params?.budgetScopeId === "string" ? params.budgetScopeId : undefined,
        });
        respond(true, { sprint });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.sprints.transition",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const sprintId = typeof params?.sprintId === "string" ? params.sprintId : "";
        const targetState = typeof params?.targetState === "string" ? params.targetState : "";
        if (!sprintId || !targetState) {
          respond(false, { error: "sprintId and targetState required" });
          return;
        }
        const s = ensureStore();
        const prevState = (await s.getSprint(sprintId))?.state;
        const sprint = await transitionSprint(s, sprintId, targetState as SprintState);
        emitOrchEvent("sprint.transition", {
          sprintId,
          from: prevState,
          to: targetState,
        });
        respond(true, { sprint });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.sprints.report",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const sprintId = typeof params?.sprintId === "string" ? params.sprintId : "";
        if (!sprintId) {
          respond(false, { error: "sprintId required" });
          return;
        }
        const s = ensureStore();
        const report = await getSprintReport(s, sprintId);
        if (!report) {
          respond(false, { error: `Sprint ${sprintId} not found` });
          return;
        }
        respond(true, report);
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.sprints.retrospective",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const sprintId = typeof params?.sprintId === "string" ? params.sprintId : "";
        if (!sprintId) {
          respond(false, { error: "sprintId required" });
          return;
        }
        const s = ensureStore();
        const report = await getSprintReport(s, sprintId);
        if (!report) {
          respond(false, { error: `Sprint ${sprintId} not found` });
          return;
        }
        // Retrospective returns the same report data; the coordinator agent
        // analyzes it to produce the narrative retrospective.
        respond(true, { ...report, type: "retrospective" });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  // -- Work Items ----------------------------------------------------------

  api.registerGatewayMethod(
    "orchestration.items.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const s = ensureStore();
        const items = await listWorkItems(s, {
          sprintId: typeof params?.sprintId === "string" ? params.sprintId : undefined,
          state: typeof params?.state === "string" ? (params.state as WorkItemState) : undefined,
          assigneeAgentId:
            typeof params?.assigneeAgentId === "string" ? params.assigneeAgentId : undefined,
        });
        respond(true, { items });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.items.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const sprintId = typeof params?.sprintId === "string" ? params.sprintId : "";
        const title = typeof params?.title === "string" ? params.title.trim() : "";
        const description = typeof params?.description === "string" ? params.description : "";
        if (!sprintId || !title) {
          respond(false, { error: "sprintId and title required" });
          return;
        }
        const s = ensureStore();
        const item = await createWorkItem(s, {
          sprintId,
          title,
          description,
          assigneeAgentId:
            typeof params?.assigneeAgentId === "string" ? params.assigneeAgentId : undefined,
          acceptanceCriteria: Array.isArray(params?.acceptanceCriteria)
            ? params.acceptanceCriteria.filter((c): c is string => typeof c === "string")
            : undefined,
          externalRefs: Array.isArray(params?.externalRefs)
            ? params.externalRefs.filter((r): r is string => typeof r === "string")
            : undefined,
        });
        respond(true, { item });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.items.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const id = typeof params?.workItemId === "string" ? params.workItemId : "";
        if (!id) {
          respond(false, { error: "workItemId required" });
          return;
        }
        const s = ensureStore();
        const prevState = (await s.getWorkItem(id))?.state;
        const item = await updateWorkItem(s, id, {
          title: typeof params?.title === "string" ? params.title : undefined,
          description: typeof params?.description === "string" ? params.description : undefined,
          state: typeof params?.state === "string" ? (params.state as WorkItemState) : undefined,
          assigneeAgentId:
            typeof params?.assigneeAgentId === "string" ? params.assigneeAgentId : undefined,
        });
        if (!item) {
          respond(false, { error: `Work item ${id} not found` });
          return;
        }
        // Emit event when state changed
        if (typeof params?.state === "string" && prevState && prevState !== item.state) {
          emitOrchEvent("item.state_changed", {
            workItemId: id,
            from: prevState,
            to: item.state,
          });
        }
        respond(true, { item });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.items.delegate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const workItemId = typeof params?.workItemId === "string" ? params.workItemId : "";
        const fromAgentId = typeof params?.fromAgentId === "string" ? params.fromAgentId : "";
        const toAgentId = typeof params?.toAgentId === "string" ? params.toAgentId : "";
        const sessionKey = typeof params?.sessionKey === "string" ? params.sessionKey : "";
        if (!workItemId || !fromAgentId || !toAgentId || !sessionKey) {
          respond(false, {
            error: "workItemId, fromAgentId, toAgentId, and sessionKey required",
          });
          return;
        }
        const s = ensureStore();
        const delegation = await addDelegation(s, workItemId, {
          fromAgentId,
          toAgentId,
          delegatedAt: new Date().toISOString(),
          sessionKey,
          isolated: params?.isolated === true,
          status: "active",
        });
        if (!delegation) {
          respond(false, { error: `Work item ${workItemId} not found` });
          return;
        }
        emitOrchEvent(
          "delegation.started",
          {
            workItemId,
            fromAgentId,
            toAgentId,
          },
          sessionKey,
        );
        respond(true, { delegation });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.items.review",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const workItemId = typeof params?.workItemId === "string" ? params.workItemId : "";
        const reviewerAgentId =
          typeof params?.reviewerAgentId === "string" ? params.reviewerAgentId : "";
        if (!workItemId || !reviewerAgentId) {
          respond(false, { error: "workItemId and reviewerAgentId required" });
          return;
        }
        const s = ensureStore();

        // If a verdict is provided, record it; otherwise create a review request
        if (typeof params?.verdict === "string") {
          const review = await recordVerdict(
            s,
            workItemId,
            reviewerAgentId,
            params.verdict as ReviewVerdict,
            typeof params?.feedback === "string" ? params.feedback : undefined,
          );
          if (!review) {
            respond(false, { error: "Pending review not found" });
            return;
          }
          respond(true, { review });
          return;
        }

        const review = await requestReview(s, workItemId, reviewerAgentId);
        if (!review) {
          respond(false, { error: `Work item ${workItemId} not found` });
          return;
        }
        respond(true, { review });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  // -- Escalations ---------------------------------------------------------

  api.registerGatewayMethod(
    "orchestration.escalations.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const s = ensureStore();
        const escalations = await listOpenEscalations(s, {
          teamId: typeof params?.teamId === "string" ? params.teamId : undefined,
          sprintId: typeof params?.sprintId === "string" ? params.sprintId : undefined,
        });
        respond(true, { escalations });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  api.registerGatewayMethod(
    "orchestration.escalations.resolve",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const escalationId = typeof params?.escalationId === "string" ? params.escalationId : "";
        const resolution = typeof params?.resolution === "string" ? params.resolution : "";
        if (!escalationId || !resolution) {
          respond(false, { error: "escalationId and resolution required" });
          return;
        }
        const s = ensureStore();
        const record = await resolveEscalation(s, escalationId, resolution);
        if (!record) {
          respond(false, { error: `Escalation ${escalationId} not found` });
          return;
        }
        respond(true, { escalation: record });
      } catch (err) {
        sendError(respond, err);
      }
    },
  );

  // -----------------------------------------------------------------------
  // Background service: escalation monitor
  // -----------------------------------------------------------------------

  api.registerService({
    id: "orchestration-monitor",
    start: async (ctx) => {
      store = new OrchestrationStore(ctx.stateDir);
      await store.ensureDir();

      const monitor = startMonitor({
        store,
        config,
        logger: ctx.logger,
      });

      // Stash the stop fn on the context for the stop handler
      (ctx as Record<string, unknown>).__monitorStop = monitor.stop;

      ctx.logger.info("[orchestration] Monitor service started.");
    },
    stop: async (ctx) => {
      const stopFn = (ctx as Record<string, unknown>).__monitorStop as (() => void) | undefined;
      if (stopFn) stopFn();
      ctx.logger.info("[orchestration] Monitor service stopped.");
    },
  });
}
