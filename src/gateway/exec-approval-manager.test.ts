import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecApprovalManager } from "./exec-approval-manager.js";

describe("exec-approval-manager", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("supports generic HITL payload fields", () => {
    const manager = new ExecApprovalManager();
    const record = manager.create(
      {
        tool: "nodes.run",
        category: "node",
        command: "echo hello",
        host: "node",
      },
      30_000,
      "approval-1",
    );

    expect(record.id).toBe("approval-1");
    expect(record.request.tool).toBe("nodes.run");
    expect(record.request.category).toBe("node");
  });

  it("resolves pending approvals", async () => {
    const manager = new ExecApprovalManager();
    const record = manager.create({ command: "echo ok" }, 30_000, "approval-2");

    const pending = manager.register(record, 30_000);
    const resolved = manager.resolve("approval-2", "allow-once", "operator-1");
    const decision = await pending;

    expect(resolved).toBe(true);
    expect(decision).toBe("allow-once");
    expect(manager.getSnapshot("approval-2")?.resolvedBy).toBe("operator-1");
  });

  it("returns null decision on timeout", async () => {
    vi.useFakeTimers();
    const manager = new ExecApprovalManager();
    const record = manager.create({ command: "echo timeout" }, 100, "approval-3");

    const pending = manager.register(record, 100);
    await vi.advanceTimersByTimeAsync(150);

    await expect(pending).resolves.toBeNull();
    expect(manager.getSnapshot("approval-3")?.resolvedAtMs).toBeTypeOf("number");
  });
});
