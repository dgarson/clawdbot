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
  opts?: { forwarder?: ToolApprovalForwarder },
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

      // Build a canonical ToolApprovalRequestPayload from legacy exec params.
      const requestHash = computeToolApprovalRequestHash({
        toolName: "exec",
        paramsSummary: p.command,
        sessionKey: p.sessionKey,
        agentId: p.agentId,
      });
      const request = {
        toolName: "exec" as const,
        paramsSummary: p.command,
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

      // Emit the legacy event shape for backward-compatible listeners.
      context.broadcast(
        "exec.approval.requested",
        {
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
          request: {
            toolName: record.request.toolName,
            paramsSummary: record.request.paramsSummary,
            requestHash: record.request.requestHash,
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
      const p = params as { id: string; decision: string };
      const decision = p.decision as ExecApprovalDecision;
      if (decision !== "allow-once" && decision !== "allow-always" && decision !== "deny") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid decision"));
        return;
      }

      // Guard: legacy exec.approval.resolve must only touch exec approvals.
      // Legacy callers don't supply requestHash — retrieve it from the pending record.
      const snapshot = manager.getSnapshot(p.id);
      if (!snapshot || snapshot.request.toolName !== "exec") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id"));
        return;
      }
      const requestHash = snapshot.request.requestHash;
      const resolvedBy = client?.connect?.client?.displayName ?? client?.connect?.client?.id;

      const ok = manager.resolve(p.id, decision, requestHash, resolvedBy ?? null);
      if (!ok) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id"));
        return;
      }

      // Legacy event
      context.broadcast(
        "exec.approval.resolved",
        { id: p.id, decision, resolvedBy, ts: Date.now() },
        { dropIfSlow: true },
      );

      // Canonical event
      context.broadcast(
        "tool.approval.resolved",
        { id: p.id, decision, resolvedBy, ts: Date.now() },
        { dropIfSlow: true },
      );

      // Forward to messaging channels
      void opts?.forwarder
        ?.handleResolved({ id: p.id, decision, resolvedBy, ts: Date.now() })
        .catch((err) => {
          context.logGateway?.error?.(`exec approvals: forward resolve failed: ${String(err)}`);
        });
      respond(true, { ok: true }, undefined);
    },
  };
}
