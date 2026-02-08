import { describe, expect, it, vi } from "vitest";
import { validateExecApprovalRequestParams } from "../protocol/index.js";
import { ToolApprovalManager } from "../tool-approval-manager.js";
import { createExecApprovalHandlers } from "./exec-approval.js";

const noop = () => {};

describe("exec approval handlers", () => {
  describe("ExecApprovalRequestParams validation", () => {
    it("accepts request with resolvedPath omitted", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });

    it("accepts request with resolvedPath as string", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
        resolvedPath: "/usr/bin/echo",
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });

    it("accepts request with resolvedPath as undefined", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
        resolvedPath: undefined,
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });

    // Fixed: null is now accepted (Type.Union([Type.String(), Type.Null()]))
    // This matches the calling code in bash-tools.exec.ts which passes null.
    it("accepts request with resolvedPath as null", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
        resolvedPath: null,
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });
  });

  it("broadcasts request + resolve", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];

    const respond = vi.fn();
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const requestPromise = handlers["exec.approval.request"]({
      params: {
        command: "echo ok",
        cwd: "/tmp",
        host: "node",
        timeoutMs: 2000,
      },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    const requested = broadcasts.find((entry) => entry.event === "exec.approval.requested");
    expect(requested).toBeTruthy();
    const id = (requested?.payload as { id?: string })?.id ?? "";
    expect(id).not.toBe("");

    // Canonical event should also be emitted
    expect(broadcasts.some((entry) => entry.event === "tool.approval.requested")).toBe(true);

    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "allow-once" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;

    expect(resolveRespond).toHaveBeenCalledWith(true, { ok: true }, undefined);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ id, decision: "allow-once" }),
      undefined,
    );
    expect(broadcasts.some((entry) => entry.event === "exec.approval.resolved")).toBe(true);
    // Canonical resolve event should also be emitted
    expect(broadcasts.some((entry) => entry.event === "tool.approval.resolved")).toBe(true);
  });

  it("accepts resolve during broadcast", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const respond = vi.fn();
    const resolveRespond = vi.fn();

    const resolveContext = {
      broadcast: () => {},
    };

    const context = {
      broadcast: (event: string, payload: unknown) => {
        if (event !== "exec.approval.requested") {
          return;
        }
        const id = (payload as { id?: string })?.id ?? "";
        void handlers["exec.approval.resolve"]({
          params: { id, decision: "allow-once" },
          respond: resolveRespond,
          context: resolveContext as unknown as Parameters<
            (typeof handlers)["exec.approval.resolve"]
          >[0]["context"],
          client: { connect: { client: { id: "cli", displayName: "CLI" } } },
          req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
          isWebchatConnect: noop,
        });
      },
    };

    await handlers["exec.approval.request"]({
      params: {
        command: "echo ok",
        cwd: "/tmp",
        host: "node",
        timeoutMs: 2000,
      },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    expect(resolveRespond).toHaveBeenCalledWith(true, { ok: true }, undefined);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ decision: "allow-once" }),
      undefined,
    );
  });

  it("accepts explicit approval ids", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];

    const respond = vi.fn();
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const requestPromise = handlers["exec.approval.request"]({
      params: {
        id: "approval-123",
        command: "echo ok",
        cwd: "/tmp",
        host: "gateway",
        timeoutMs: 2000,
      },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    const requested = broadcasts.find((entry) => entry.event === "exec.approval.requested");
    const id = (requested?.payload as { id?: string })?.id ?? "";
    expect(id).toBe("approval-123");

    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "allow-once" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ id: "approval-123", decision: "allow-once" }),
      undefined,
    );
  });

  it("rejects duplicate approval ids", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const respondA = vi.fn();
    const respondB = vi.fn();
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const requestPromise = handlers["exec.approval.request"]({
      params: {
        id: "dup-1",
        command: "echo ok",
      },
      respond: respondA,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    await handlers["exec.approval.request"]({
      params: {
        id: "dup-1",
        command: "echo again",
      },
      respond: respondB,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-2", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    expect(respondB).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "approval id already pending" }),
    );

    const requested = broadcasts.find((entry) => entry.event === "exec.approval.requested");
    const id = (requested?.payload as { id?: string })?.id ?? "";
    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "deny" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-3", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;
  });

  it("rejects resolving non-exec approvals via exec.approval.resolve", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createExecApprovalHandlers(manager);

    // Create a non-exec approval directly on the shared manager
    const hash = ToolApprovalManager.computeRequestHash({
      toolName: "browser.navigate",
      paramsSummary: "https://example.com",
    });
    const record = manager.create(
      { toolName: "browser.navigate", paramsSummary: "https://example.com", requestHash: hash },
      5000,
    );
    // Register in the pending map (don't await — it blocks until resolved)
    const waitPromise = manager.waitForDecision(record, 5000);

    const respond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id: record.id, decision: "allow-once" },
      respond,
      context: { broadcast: () => {} } as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-1", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    // Should reject — this is not an exec approval
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "unknown approval id" }),
    );

    // The non-exec approval should still be pending
    expect(manager.getSnapshot(record.id)).not.toBeNull();

    // Clean up
    manager.resolveCompat(record.id, "deny");
    await waitPromise;
  });

  it("shares pending state with tool.approval handlers (unified manager)", async () => {
    const manager = new ToolApprovalManager();
    const execHandlers = createExecApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    // Create an exec approval request
    const respond = vi.fn();
    void execHandlers["exec.approval.request"]({
      params: { command: "echo test", timeoutMs: 5000 },
      respond,
      context: context as unknown as Parameters<
        (typeof execHandlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    // The record should be visible via manager.listPending()
    const pending = manager.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].request.toolName).toBe("exec");

    // Resolve via resolveCompat to clean up
    manager.resolveCompat(pending[0].id, "deny");
  });
});
