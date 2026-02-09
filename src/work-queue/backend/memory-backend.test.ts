import { describe, expect, it } from "vitest";
import { MemoryWorkQueueBackend } from "./memory-backend.js";

describe("MemoryWorkQueueBackend", () => {
  it("creates queues and items, then claims in priority order", async () => {
    const backend = new MemoryWorkQueueBackend();
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "main",
      agentId: "main",
      name: "Main",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    const low = await backend.createItem({
      queueId: queue.id,
      title: "Low",
      status: "pending",
      priority: "low",
    });
    const high = await backend.createItem({
      queueId: queue.id,
      title: "High",
      status: "pending",
      priority: "high",
      tags: ["urgent"],
    });

    const listed = await backend.listItems({ queueId: queue.id, tags: ["urgent"] });
    expect(listed.map((item) => item.id)).toEqual([high.id]);

    const claimed = await backend.claimNextItem(queue.id, { agentId: "main" });
    expect(claimed?.id).toBe(high.id);

    const denied = await backend.claimNextItem(queue.id, { agentId: "main" });
    expect(denied).toBeNull();

    const stats = await backend.getQueueStats(queue.id);
    expect(stats.pending).toBe(1);
    expect(stats.inProgress).toBe(1);

    await backend.updateItem(low.id, { status: "completed" });
    const updatedStats = await backend.getQueueStats(queue.id);
    expect(updatedStats.completed).toBe(1);

    await backend.close();
  });

  it("ignores undefined required patch values while clearing optional fields", async () => {
    const backend = new MemoryWorkQueueBackend();
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "agent-2",
      agentId: "agent-2",
      name: "Agent 2",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    const item = await backend.createItem({
      queueId: queue.id,
      title: "Keep me",
      status: "in_progress",
      priority: "medium",
      statusReason: "running",
      assignedTo: { agentId: "agent-2" },
    });

    const updated = await backend.updateItem(item.id, {
      title: undefined,
      status: "pending",
      statusReason: undefined,
      assignedTo: undefined,
    });

    expect(updated.title).toBe("Keep me");
    expect(updated.status).toBe("pending");
    expect(updated.statusReason).toBeUndefined();
    expect(updated.assignedTo).toBeUndefined();
  });

  it("does not count external-ref items against concurrency limit", async () => {
    const backend = new MemoryWorkQueueBackend();
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "ext",
      agentId: "ext",
      name: "External",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    // Create an external task item (Codex) and mark it in_progress
    await backend.createItem({
      queueId: queue.id,
      title: "Codex task",
      status: "in_progress",
      priority: "medium",
      payload: {
        refs: [
          {
            kind: "external:codex-task",
            id: "crn:v1:codex-web:global:task:task_abc123",
            uri: "https://chatgpt.com/codex/tasks/task_abc123",
          },
        ],
      },
    });

    // Even though there's an in_progress item, a local item should still be claimable
    // because the external task doesn't count against the concurrency limit.
    const localItem = await backend.createItem({
      queueId: queue.id,
      title: "Local task",
      status: "pending",
      priority: "medium",
    });

    const claimed = await backend.claimNextItem(queue.id, { agentId: "ext" });
    expect(claimed?.id).toBe(localItem.id);

    // Now that a LOCAL item is in_progress, the next claim should be denied
    const denied = await backend.claimNextItem(queue.id, { agentId: "ext" });
    expect(denied).toBeNull();
  });

  it("does not count claude-web external-ref items against concurrency", async () => {
    const backend = new MemoryWorkQueueBackend();
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "claude-ext",
      agentId: "claude-ext",
      name: "Claude External",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    // Claude.ai/Code task in_progress
    await backend.createItem({
      queueId: queue.id,
      title: "Claude task",
      status: "in_progress",
      priority: "medium",
      payload: {
        refs: [
          {
            kind: "external:claude-task",
            id: "crn:v1:claude-web:global:task:conv_456",
            uri: "https://claude.ai/chat/conv_456",
          },
        ],
      },
    });

    // Should still be able to claim because the Claude task is external
    const localItem = await backend.createItem({
      queueId: queue.id,
      title: "Local task",
      status: "pending",
      priority: "medium",
    });

    const claimed = await backend.claimNextItem(queue.id, { agentId: "claude-ext" });
    expect(claimed?.id).toBe(localItem.id);
  });

  it("lists items by refs", async () => {
    const backend = new MemoryWorkQueueBackend();
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "refs",
      agentId: "refs",
      name: "Refs",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    const item = await backend.createItem({
      queueId: queue.id,
      title: "With refs",
      status: "pending",
      priority: "medium",
      payload: {
        refs: [{ kind: "work:queue", id: "queue-123", label: "Queue" }],
      },
    });

    const matches = await backend.listItemsByRef({ kind: "work:queue", id: "queue-123" });
    expect(matches.map((match) => match.id)).toEqual([item.id]);
  });
});
