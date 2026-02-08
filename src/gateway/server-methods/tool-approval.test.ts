import { describe, expect, it, vi } from "vitest";
import {
  validateToolApprovalRequestParams,
  validateToolApprovalResolveParams,
} from "../protocol/index.js";
import { ToolApprovalManager } from "../tool-approval-manager.js";
import { createToolApprovalHandlers } from "./tool-approval.js";

const noop = () => {};

type ContextLike = Parameters<
  ReturnType<typeof createToolApprovalHandlers>["tool.approval.request"]
>[0]["context"];

function fakeContext(broadcasts: Array<{ event: string; payload: unknown }>): ContextLike {
  return {
    broadcast: (event: string, payload: unknown) => {
      broadcasts.push({ event, payload });
    },
  } as unknown as ContextLike;
}

function payloadId(broadcasts: Array<{ event: string; payload: unknown }>, event: string): string {
  const found = broadcasts.find((e) => e.event === event);
  return ((found?.payload as Record<string, unknown>)?.id as string) ?? "";
}

describe("tool approval handlers", () => {
  // -----------------------------------------------------------------------
  // Schema validation
  // -----------------------------------------------------------------------

  describe("ToolApprovalRequestParams validation", () => {
    it("accepts valid request with all fields", () => {
      expect(
        validateToolApprovalRequestParams({
          toolName: "exec",
          requestHash: "abc123",
          paramsSummary: "echo hi",
          riskClass: "R3",
          sideEffects: ["process_spawn"],
          reasonCodes: ["parameter_bump"],
          sessionKey: "session-1",
          agentId: "main",
        }),
      ).toBe(true);
    });

    it("accepts minimal request (toolName + requestHash)", () => {
      expect(
        validateToolApprovalRequestParams({
          toolName: "browser",
          requestHash: "hash-1",
        }),
      ).toBe(true);
    });

    it("rejects missing toolName", () => {
      expect(
        validateToolApprovalRequestParams({
          requestHash: "hash-1",
        }),
      ).toBe(false);
    });

    it("rejects missing requestHash", () => {
      expect(
        validateToolApprovalRequestParams({
          toolName: "exec",
        }),
      ).toBe(false);
    });

    it("rejects unknown additional properties", () => {
      expect(
        validateToolApprovalRequestParams({
          toolName: "exec",
          requestHash: "hash-1",
          unknownField: true,
        }),
      ).toBe(false);
    });
  });

  describe("ToolApprovalResolveParams validation", () => {
    it("accepts valid resolve params", () => {
      expect(
        validateToolApprovalResolveParams({
          id: "approval-1",
          decision: "allow-once",
          requestHash: "hash-1",
        }),
      ).toBe(true);
    });

    it("rejects missing requestHash", () => {
      expect(
        validateToolApprovalResolveParams({
          id: "approval-1",
          decision: "allow-once",
        }),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Handler: tool.approval.request + tool.approval.resolve
  // -----------------------------------------------------------------------

  it("broadcasts canonical events on request + resolve", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createToolApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const respond = vi.fn();
    const context = fakeContext(broadcasts);
    const requestHash = "test-hash-abc";

    const requestPromise = handlers["tool.approval.request"]({
      params: {
        toolName: "browser",
        requestHash,
        paramsSummary: "navigate to example.com",
        riskClass: "R2",
        timeoutMs: 2000,
      },
      respond,
      context,
      client: null,
      req: { id: "req-1", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    const requested = broadcasts.find((e) => e.event === "tool.approval.requested");
    expect(requested).toBeTruthy();
    const id = payloadId(broadcasts, "tool.approval.requested");
    expect(id).not.toBe("");
    expect((requested?.payload as Record<string, unknown>)?.toolName).toBe("browser");
    expect((requested?.payload as Record<string, unknown>)?.requestHash).toBe(requestHash);

    const resolveRespond = vi.fn();
    await handlers["tool.approval.resolve"]({
      params: { id, decision: "allow-once", requestHash },
      respond: resolveRespond,
      context,
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-2", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;

    expect(resolveRespond).toHaveBeenCalledWith(true, { ok: true }, undefined);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ id, decision: "allow-once" }),
      undefined,
    );
    expect(broadcasts.some((e) => e.event === "tool.approval.resolved")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Legacy exec compatibility
  // -----------------------------------------------------------------------

  it("emits legacy exec events when toolName is exec", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createToolApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const respond = vi.fn();
    const context = fakeContext(broadcasts);
    const requestHash = "exec-hash-123";

    const requestPromise = handlers["tool.approval.request"]({
      params: {
        toolName: "exec",
        requestHash,
        command: "echo hello",
        cwd: "/tmp",
        host: "gateway",
        timeoutMs: 2000,
      },
      respond,
      context,
      client: null,
      req: { id: "req-1", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    // Should have both canonical and legacy request events
    const canonicalRequested = broadcasts.find((e) => e.event === "tool.approval.requested");
    const legacyRequested = broadcasts.find((e) => e.event === "exec.approval.requested");
    expect(canonicalRequested).toBeTruthy();
    expect(legacyRequested).toBeTruthy();

    // Legacy event should have exec-compatible shape
    const legacyPayload = legacyRequested?.payload as Record<string, unknown>;
    const legacyRequest = legacyPayload?.request as Record<string, unknown>;
    expect(legacyRequest?.command).toBe("echo hello");
    expect(legacyRequest?.cwd).toBe("/tmp");

    const id = payloadId(broadcasts, "tool.approval.requested");

    const resolveRespond = vi.fn();
    await handlers["tool.approval.resolve"]({
      params: { id, decision: "allow-always", requestHash },
      respond: resolveRespond,
      context,
      client: { connect: { client: { id: "cli", displayName: "Op" } } },
      req: { id: "req-2", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;

    // Both canonical and legacy resolved events
    expect(broadcasts.some((e) => e.event === "tool.approval.resolved")).toBe(true);
    expect(broadcasts.some((e) => e.event === "exec.approval.resolved")).toBe(true);
  });

  it("does NOT emit legacy exec events for non-exec tools", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createToolApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const respond = vi.fn();
    const context = fakeContext(broadcasts);
    const requestHash = "browser-hash";

    const requestPromise = handlers["tool.approval.request"]({
      params: {
        toolName: "browser",
        requestHash,
        timeoutMs: 2000,
      },
      respond,
      context,
      client: null,
      req: { id: "req-1", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    expect(broadcasts.some((e) => e.event === "exec.approval.requested")).toBe(false);

    const id = payloadId(broadcasts, "tool.approval.requested");

    const resolveRespond = vi.fn();
    await handlers["tool.approval.resolve"]({
      params: { id, decision: "deny", requestHash },
      respond: resolveRespond,
      context,
      client: { connect: { client: { id: "cli" } } },
      req: { id: "req-2", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;

    expect(broadcasts.some((e) => e.event === "exec.approval.resolved")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Anti-stale: requestHash mismatch rejection
  // -----------------------------------------------------------------------

  it("rejects resolve with mismatched requestHash", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createToolApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const respond = vi.fn();
    const context = fakeContext(broadcasts);
    const requestHash = "original-hash";

    const requestPromise = handlers["tool.approval.request"]({
      params: {
        toolName: "exec",
        requestHash,
        command: "echo test",
        timeoutMs: 2000,
      },
      respond,
      context,
      client: null,
      req: { id: "req-1", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    const id = payloadId(broadcasts, "tool.approval.requested");

    const resolveRespond = vi.fn();
    await handlers["tool.approval.resolve"]({
      params: { id, decision: "allow-once", requestHash: "wrong-hash" },
      respond: resolveRespond,
      context,
      client: { connect: { client: { id: "cli" } } },
      req: { id: "req-2", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });

    expect(resolveRespond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: "unknown approval id or request hash mismatch",
      }),
    );

    // Clean up: resolve with correct hash
    const resolveRespond2 = vi.fn();
    await handlers["tool.approval.resolve"]({
      params: { id, decision: "deny", requestHash },
      respond: resolveRespond2,
      context,
      client: { connect: { client: { id: "cli" } } },
      req: { id: "req-3", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;
  });

  // -----------------------------------------------------------------------
  // tool.approvals.get
  // -----------------------------------------------------------------------

  it("lists pending approvals via tool.approvals.get", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createToolApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const context = fakeContext(broadcasts);

    // Create a pending request
    void handlers["tool.approval.request"]({
      params: {
        toolName: "exec",
        requestHash: "hash-1",
        command: "echo pending",
        agentId: "main",
        sessionKey: "agent:main:main",
        timeoutMs: 30_000,
      },
      respond: vi.fn(),
      context,
      client: null,
      req: { id: "req-1", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    // Wait for broadcast to fire
    await new Promise((r) => setTimeout(r, 10));

    const getRespond = vi.fn();
    await handlers["tool.approvals.get"]({
      params: {},
      respond: getRespond,
      context,
      client: null,
      req: { id: "req-2", type: "req", method: "tool.approvals.get" },
      isWebchatConnect: noop,
    });

    expect(getRespond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        approvals: expect.arrayContaining([
          expect.objectContaining({
            toolName: "exec",
            requestHash: "hash-1",
            agentId: "main",
            sessionKey: "agent:main:main",
          }),
        ]),
      }),
      undefined,
    );

    // Clean up: resolve the pending request
    const id = payloadId(broadcasts, "tool.approval.requested");
    await handlers["tool.approval.resolve"]({
      params: { id, decision: "deny", requestHash: "hash-1" },
      respond: vi.fn(),
      context,
      client: { connect: { client: { id: "cli" } } },
      req: { id: "req-3", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });
  });

  // -----------------------------------------------------------------------
  // resolveCompat: legacy compatibility resolve (no requestHash)
  // -----------------------------------------------------------------------

  describe("resolveCompat (legacy compat)", () => {
    it("resolves without requiring requestHash", async () => {
      const manager = new ToolApprovalManager();
      const record = manager.create(
        { toolName: "exec", requestHash: "hash-abc", command: "echo test" },
        5000,
      );
      const decisionPromise = manager.waitForDecision(record, 5000);

      const ok = manager.resolveCompat(record.id, "allow-once", "Operator");
      expect(ok).toBe(true);

      const decision = await decisionPromise;
      expect(decision).toBe("allow-once");
      expect(manager.listPending()).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      const manager = new ToolApprovalManager();
      expect(manager.resolveCompat("nonexistent", "deny")).toBe(false);
    });

    it("sets resolvedBy on the record", async () => {
      const manager = new ToolApprovalManager();
      const record = manager.create({ toolName: "exec", requestHash: "hash-xyz" }, 5000);
      void manager.waitForDecision(record, 5000);

      // Peek before resolve
      const snapshot = manager.getSnapshot(record.id);
      expect(snapshot?.resolvedBy).toBeUndefined();

      manager.resolveCompat(record.id, "allow-always", "WebUI");

      // Record is no longer pending so getSnapshot returns null,
      // but the resolved record mutated in-place has the data
      expect(record.resolvedBy).toBe("WebUI");
      expect(record.decision).toBe("allow-always");
      expect(record.resolvedAtMs).toBeTypeOf("number");
    });

    it("resolveCompat works even with mismatched requestHash (intentional bypass)", async () => {
      const manager = new ToolApprovalManager();
      const record = manager.create({ toolName: "exec", requestHash: "original-hash" }, 5000);
      void manager.waitForDecision(record, 5000);

      // Standard resolve would fail with wrong hash
      expect(manager.resolve(record.id, "allow-once", "wrong-hash")).toBe(false);
      // Record is still pending
      expect(manager.getSnapshot(record.id)).not.toBeNull();

      // resolveCompat bypasses the hash check
      expect(manager.resolveCompat(record.id, "deny")).toBe(true);
      expect(manager.getSnapshot(record.id)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Duplicate id rejection
  // -----------------------------------------------------------------------

  it("rejects duplicate approval ids", async () => {
    const manager = new ToolApprovalManager();
    const handlers = createToolApprovalHandlers(manager);
    const respondA = vi.fn();
    const respondB = vi.fn();
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const context = fakeContext(broadcasts);

    const requestPromise = handlers["tool.approval.request"]({
      params: {
        id: "dup-1",
        toolName: "exec",
        requestHash: "hash-a",
        command: "echo ok",
      },
      respond: respondA,
      context,
      client: null,
      req: { id: "req-1", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    await handlers["tool.approval.request"]({
      params: {
        id: "dup-1",
        toolName: "exec",
        requestHash: "hash-b",
        command: "echo again",
      },
      respond: respondB,
      context,
      client: null,
      req: { id: "req-2", type: "req", method: "tool.approval.request" },
      isWebchatConnect: noop,
    });

    expect(respondB).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "approval id already pending" }),
    );

    // Clean up
    await handlers["tool.approval.resolve"]({
      params: { id: "dup-1", decision: "deny", requestHash: "hash-a" },
      respond: vi.fn(),
      context,
      client: { connect: { client: { id: "cli" } } },
      req: { id: "req-3", type: "req", method: "tool.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;
  });
});
