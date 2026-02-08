import type { ToolApprovalForwarder } from "../../infra/tool-approval-forwarder.js";
import type { ToolApprovalDecision, ToolApprovalManager } from "../tool-approval-manager.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateToolApprovalRequestParams,
  validateToolApprovalResolveParams,
} from "../protocol/index.js";

// ---------------------------------------------------------------------------
// Helpers for legacy exec.approval.* compatibility
// ---------------------------------------------------------------------------

/** True when the approval record is an exec-originated request. */
function isExecRecord(request: { toolName: string }): boolean {
  return request.toolName === "exec";
}

/** Map canonical tool.approval.request payload to legacy exec event shape. */
function toExecRequestedEvent(record: {
  id: string;
  request: {
    command?: string | null;
    cwd?: string | null;
    host?: string | null;
    security?: string | null;
    ask?: string | null;
    agentId?: string | null;
    resolvedPath?: string | null;
    sessionKey?: string | null;
  };
  createdAtMs: number;
  expiresAtMs: number;
}) {
  return {
    id: record.id,
    request: {
      command: record.request.command ?? "",
      cwd: record.request.cwd ?? null,
      host: record.request.host ?? null,
      security: record.request.security ?? null,
      ask: record.request.ask ?? null,
      agentId: record.request.agentId ?? null,
      resolvedPath: record.request.resolvedPath ?? null,
      sessionKey: record.request.sessionKey ?? null,
    },
    createdAtMs: record.createdAtMs,
    expiresAtMs: record.expiresAtMs,
  };
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

export function createToolApprovalHandlers(
  manager: ToolApprovalManager,
  opts?: { forwarder?: ToolApprovalForwarder },
): GatewayRequestHandlers {
  return {
    // =====================================================================
    // tool.approval.request — canonical entry point
    // =====================================================================
    "tool.approval.request": async ({ params, respond, context }) => {
      if (!validateToolApprovalRequestParams(params)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid tool.approval.request params: ${formatValidationErrors(
              validateToolApprovalRequestParams.errors,
            )}`,
          ),
        );
        return;
      }
      const p = params as {
        id?: string;
        toolName: string;
        paramsSummary?: string;
        riskClass?: string;
        sideEffects?: string[];
        reasonCodes?: string[];
        sessionKey?: string;
        agentId?: string;
        expiresAtMs?: number;
        requestHash: string;
        timeoutMs?: number;
        command?: string;
        cwd?: string;
        host?: string;
        security?: string;
        ask?: string;
        resolvedPath?: string;
      };

      const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 120_000;
      const explicitId = typeof p.id === "string" && p.id.trim().length > 0 ? p.id.trim() : null;

      if (explicitId && manager.getSnapshot(explicitId)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "approval id already pending"),
        );
        return;
      }

      const request = {
        toolName: p.toolName,
        paramsSummary: p.paramsSummary ?? null,
        riskClass: p.riskClass ?? null,
        sideEffects: p.sideEffects ?? null,
        reasonCodes: p.reasonCodes ?? null,
        sessionKey: p.sessionKey ?? null,
        agentId: p.agentId ?? null,
        expiresAtMs: p.expiresAtMs ?? null,
        requestHash: p.requestHash,
        command: p.command ?? null,
        cwd: p.cwd ?? null,
        host: p.host ?? null,
        security: p.security ?? null,
        ask: p.ask ?? null,
        resolvedPath: p.resolvedPath ?? null,
      };

      const record = manager.create(request, timeoutMs, explicitId);
      const decisionPromise = manager.waitForDecision(record, timeoutMs);

      // Canonical event
      context.broadcast(
        "tool.approval.requested",
        {
          id: record.id,
          toolName: record.request.toolName,
          paramsSummary: record.request.paramsSummary,
          riskClass: record.request.riskClass,
          sideEffects: record.request.sideEffects,
          reasonCodes: record.request.reasonCodes,
          sessionKey: record.request.sessionKey,
          agentId: record.request.agentId,
          requestHash: record.request.requestHash,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        },
        { dropIfSlow: true },
      );

      // Legacy exec mirror event
      if (isExecRecord(record.request)) {
        context.broadcast("exec.approval.requested", toExecRequestedEvent(record), {
          dropIfSlow: true,
        });
      }

      // Forward to messaging channels
      void opts?.forwarder
        ?.handleRequested({
          id: record.id,
          request: record.request,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        })
        .catch((err) => {
          context.logGateway?.error?.(`tool approvals: forward request failed: ${String(err)}`);
        });

      const decision = await decisionPromise;

      respond(
        true,
        {
          id: record.id,
          decision,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        },
        undefined,
      );
    },

    // =====================================================================
    // tool.approval.resolve — canonical entry point
    // =====================================================================
    "tool.approval.resolve": async ({ params, respond, client, context }) => {
      if (!validateToolApprovalResolveParams(params)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid tool.approval.resolve params: ${formatValidationErrors(
              validateToolApprovalResolveParams.errors,
            )}`,
          ),
        );
        return;
      }
      const p = params as { id: string; decision: string; requestHash: string };
      const decision = p.decision as ToolApprovalDecision;
      if (decision !== "allow-once" && decision !== "allow-always" && decision !== "deny") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid decision"));
        return;
      }

      // Peek at the pending record before resolving (for legacy event emit)
      const snapshot = manager.getSnapshot(p.id);
      const resolvedBy = client?.connect?.client?.displayName ?? client?.connect?.client?.id;

      const ok = manager.resolve(p.id, decision, p.requestHash, resolvedBy ?? null);
      if (!ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id or request hash mismatch"),
        );
        return;
      }

      // Canonical event
      context.broadcast(
        "tool.approval.resolved",
        { id: p.id, decision, resolvedBy, ts: Date.now() },
        { dropIfSlow: true },
      );

      // Legacy exec mirror event
      if (snapshot && isExecRecord(snapshot.request)) {
        context.broadcast(
          "exec.approval.resolved",
          { id: p.id, decision, resolvedBy, ts: Date.now() },
          { dropIfSlow: true },
        );
      }

      // Forward to messaging channels
      void opts?.forwarder
        ?.handleResolved({ id: p.id, decision, resolvedBy, ts: Date.now() })
        .catch((err) => {
          context.logGateway?.error?.(`tool approvals: forward resolve failed: ${String(err)}`);
        });

      respond(true, { ok: true }, undefined);
    },

    // =====================================================================
    // tool.approvals.get — list pending approvals
    // =====================================================================
    "tool.approvals.get": async ({ respond }) => {
      const pending = manager.listPending().map((r) => ({
        id: r.id,
        toolName: r.request.toolName,
        paramsSummary: r.request.paramsSummary,
        riskClass: r.request.riskClass,
        requestHash: r.request.requestHash,
        createdAtMs: r.createdAtMs,
        expiresAtMs: r.expiresAtMs,
      }));
      respond(true, { approvals: pending }, undefined);
    },
  };
}
