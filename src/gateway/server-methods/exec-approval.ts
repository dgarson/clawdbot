import type { ExecApprovalDecision } from "../../infra/exec-approvals.js";
import type { ToolApprovalForwarder } from "../../infra/tool-approval-forwarder.js";
import type { GatewayRequestHandlers } from "./types.js";
import { computeToolApprovalRequestHash } from "../../infra/tool-approval-hash.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateExecApprovalRequestParams,
  validateExecApprovalResolveParams,
} from "../protocol/index.js";
import { ToolApprovalManager } from "../tool-approval-manager.js";

/**
 * Legacy exec.approval.* handlers that delegate to the canonical
 * ToolApprovalManager so there is one pending-approval state machine.
 */
export function createExecApprovalHandlers(
  manager: ToolApprovalManager,
  opts?: { forwarder?: ExecApprovalForwarder },
): GatewayRequestHandlers {
  return {
    "exec.approval.request": async ({ params, respond, context }) => {
      if (!validateExecApprovalRequestParams(params)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid exec.approval.request params: ${formatValidationErrors(
              validateExecApprovalRequestParams.errors,
            )}`,
          ),
        );
        return;
      }
      const p = params as {
        id?: string;
        command: string;
        cwd?: string;
        host?: string;
        security?: string;
        ask?: string;
        agentId?: string;
        resolvedPath?: string;
        sessionKey?: string;
        timeoutMs?: number;
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
      const paramsSummary = p.command;
      const requestHash = ToolApprovalManager.computeRequestHash({
        toolName: "exec",
        paramsSummary,
        sessionKey: p.sessionKey ?? null,
        agentId: p.agentId ?? null,
      });
      const request = {
        toolName: "exec",
        source: "exec-legacy",
        paramsSummary,
        riskClass: null,
        sideEffects: null,
        reasonCodes: null,
        sessionKey: p.sessionKey ?? null,
        agentId: p.agentId ?? null,
        expiresAtMs: null,
        requestHash,
        command: p.command,
        cwd: p.cwd ?? null,
        host: p.host ?? null,
        security: p.security ?? null,
        ask: p.ask ?? null,
        resolvedPath: p.resolvedPath ?? null,
      };

      const record = manager.create(request, timeoutMs, explicitId);
      const decisionPromise = manager.waitForDecision(record, timeoutMs);
      const execRequest = {
        command: record.request.command ?? "",
        cwd: record.request.cwd ?? null,
        host: record.request.host ?? null,
        security: record.request.security ?? null,
        ask: record.request.ask ?? null,
        agentId: record.request.agentId ?? null,
        resolvedPath: record.request.resolvedPath ?? null,
        sessionKey: record.request.sessionKey ?? null,
      };
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
      context.broadcast(
        "exec.approval.requested",
        {
          id: record.id,
          request: execRequest,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        },
        { dropIfSlow: true },
      );

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

      // Forward to messaging channels via the unified tool forwarder
      void opts?.forwarder
        ?.handleRequested({
          id: record.id,
          request: execRequest,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        })
        .catch((err) => {
          context.logGateway?.error?.(`exec approvals: forward request failed: ${String(err)}`);
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
    "exec.approval.resolve": async ({ params, respond, client, context }) => {
      if (!validateExecApprovalResolveParams(params)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid exec.approval.resolve params: ${formatValidationErrors(
              validateExecApprovalResolveParams.errors,
            )}`,
          ),
        );
        return;
      }
      const p = params as { id: string; decision: string; requestHash?: string };
      const decision = p.decision as ExecApprovalDecision;
      if (decision !== "allow-once" && decision !== "allow-always" && decision !== "deny") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid decision"));
        return;
      }

      const resolvedBy = client?.connect?.client?.displayName ?? client?.connect?.client?.id;
      const snapshot = manager.getSnapshot(p.id);
      if (!snapshot || snapshot.request.toolName !== "exec") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id"));
        return;
      }
      const requestHash = typeof p.requestHash === "string" ? p.requestHash : null;
      const isLegacyExec = snapshot.request.source === "exec-legacy";
      if (!requestHash && !isLegacyExec) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "request hash required for tool-origin exec approvals",
          ),
        );
        return;
      }
      const ok = manager.resolve(
        p.id,
        decision,
        requestHash ?? snapshot.request.requestHash,
        resolvedBy ?? null,
      );
      if (!ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id or request hash mismatch"),
        );
        return;
      }
      const ts = Date.now();
      context.broadcast(
        "tool.approval.resolved",
        { id: p.id, decision, resolvedBy, ts },
        { dropIfSlow: true },
      );
      context.broadcast(
        "exec.approval.resolved",
        { id: p.id, decision, resolvedBy, ts },
        { dropIfSlow: true },
      );
      void opts?.forwarder?.handleResolved({ id: p.id, decision, resolvedBy, ts }).catch((err) => {
        context.logGateway?.error?.(`exec approvals: forward resolve failed: ${String(err)}`);
      });
      respond(true, { ok: true }, undefined);
    },
  };
}
