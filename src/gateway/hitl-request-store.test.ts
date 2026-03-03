import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HitlRequestStore,
  resolveDefaultHitlRequestStorePath,
  type HitlRequestStatus,
} from "./hitl-request-store.js";

describe("hitl-request-store", () => {
  let tmpDir = "";
  let nowMs = 1_700_000_000_000;
  let store: HitlRequestStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hitl-request-store-"));
    store = new HitlRequestStore({
      dbPath: path.join(tmpDir, "hitl-requests.sqlite"),
      now: () => nowMs,
    });
  });

  afterEach(async () => {
    store.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates, fetches, lists, and updates request rows", () => {
    const created = store.createRequest({
      id: "req-1",
      tool: "file.write",
      arguments: { path: "/tmp/a.txt", content: "hello" },
      requesterSession: "session-1",
      requesterRole: "user",
      policyId: "policy-file-write",
      expiresAtMs: nowMs + 60_000,
    });

    expect(created.id).toBe("req-1");
    expect(created.status).toBe("pending");
    expect(created.arguments).toEqual({ path: "/tmp/a.txt", content: "hello" });

    const fetched = store.getRequest("req-1");
    expect(fetched).not.toBeNull();
    expect(fetched?.tool).toBe("file.write");

    const listed = store.listRequests();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe("req-1");

    nowMs += 1_000;
    const updated = store.updateRequestStatus({
      requestId: "req-1",
      status: "approved" satisfies HitlRequestStatus,
    });
    expect(updated?.status).toBe("approved");
    expect(updated?.updatedAtMs).toBe(nowMs);
  });

  it("records decisions and audit rows, and returns request timeline", () => {
    store.createRequest({
      id: "req-2",
      tool: "nodes.run",
      arguments: { command: ["echo", "ok"] },
      requesterSession: "session-2",
      requesterRole: "user",
      policyId: "policy-nodes-run",
      expiresAtMs: nowMs + 120_000,
    });

    nowMs += 2_000;
    const decision = store.recordDecision({
      id: "decision-1",
      requestId: "req-2",
      actorSession: "operator-1",
      actorRole: "operator",
      decision: "approve",
      reason: "looks safe",
    });
    expect(decision.requestId).toBe("req-2");
    expect(decision.type).toBe("explicit");

    nowMs += 1_000;
    const audit = store.recordAudit({
      id: "audit-1",
      requestId: "req-2",
      event: "decision.approved",
      actorSession: "operator-1",
      actorRole: "operator",
      data: { reason: "looks safe" },
    });
    expect(audit.hash).toMatch(/^[a-f0-9]{64}$/);

    const timeline = store.getRequestWithTimeline("req-2");
    expect(timeline).not.toBeNull();
    expect(timeline?.request.id).toBe("req-2");
    expect(timeline?.decisions).toHaveLength(1);
    expect(timeline?.audit).toHaveLength(1);
    expect(timeline?.audit[0]?.event).toBe("decision.approved");
  });

  it("resolves default path from OPENCLAW_STATE_DIR", () => {
    const resolved = resolveDefaultHitlRequestStorePath({ OPENCLAW_STATE_DIR: "/tmp/openclaw" });
    expect(resolved).toBe(path.join("/tmp/openclaw", "hitl-requests.sqlite"));
  });
});
