import type { ExecApprovalForwarder } from "../../infra/exec-approval-forwarder.js";
import type { ExecApprovalDecision } from "../../infra/exec-approvals.js";
import type { ToolApprovalManager } from "../tool-approval-manager.js";
import type { GatewayRequestHandlers } from "./types.js";
import { computeToolApprovalRequestHash } from "../../infra/tool-approval-hash.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateExecApprovalRequestParams,
  validateExecApprovalResolveParams,
} from "../protocol/index.js";

/**
 * Legacy exec.approval.request/resolve handlers.
 * Thin adapters that delegate to the canonical ToolApprovalManager,
 * preserving the legacy param/response shapes for backward compatibility.
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
        agentId: p.agentId ?? null,
        resolvedPath: p.resolvedPath ?? null,
        sessionKey: p.sessionKey ?? null,
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
      void opts?.forwarder
        ?.handleRequested({
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

      // Legacy callers don't supply requestHash — retrieve it from the pending record.
      const snapshot = manager.getSnapshot(p.id);
      if (!snapshot) {
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
      context.broadcast(
        "exec.approval.resolved",
        { id: p.id, decision, resolvedBy, ts: Date.now() },
        { dropIfSlow: true },
      );
      void opts?.forwarder
        ?.handleResolved({ id: p.id, decision, resolvedBy, ts: Date.now() })
        .catch((err) => {
          context.logGateway?.error?.(`exec approvals: forward resolve failed: ${String(err)}`);
        });
      respond(true, { ok: true }, undefined);
    },
  };
}
