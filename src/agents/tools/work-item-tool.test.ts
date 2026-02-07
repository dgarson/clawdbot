import { beforeEach, describe, expect, it, vi } from "vitest";

const createItemMock = vi.fn();
const claimNextItemMock = vi.fn();
const updateItemMock = vi.fn();
const listItemsMock = vi.fn();
const getItemMock = vi.fn();
const ensureQueueForAgentMock = vi.fn();
const getQueueMock = vi.fn();

const storeMock = {
  createItem: (...args: unknown[]) => createItemMock(...args),
  claimNextItem: (...args: unknown[]) => claimNextItemMock(...args),
  updateItem: (...args: unknown[]) => updateItemMock(...args),
  listItems: (...args: unknown[]) => listItemsMock(...args),
  getItem: (...args: unknown[]) => getItemMock(...args),
  ensureQueueForAgent: (...args: unknown[]) => ensureQueueForAgentMock(...args),
  getQueue: (...args: unknown[]) => getQueueMock(...args),
};

vi.mock("../../work-queue/index.js", () => ({
  getDefaultWorkQueueStore: async () => storeMock,
}));

vi.mock("../agent-scope.js", () => ({
  resolveSessionAgentId: () => "main",
}));

import { createWorkItemTool } from "./work-item-tool.js";

describe("work_item tool", () => {
  beforeEach(() => {
    createItemMock.mockReset();
    claimNextItemMock.mockReset();
    updateItemMock.mockReset();
    listItemsMock.mockReset();
    getItemMock.mockReset();
    ensureQueueForAgentMock.mockReset();
    getQueueMock.mockReset();
  });

  it("update action only forwards explicitly provided fields", async () => {
    updateItemMock.mockResolvedValue({ id: "item-1", status: "blocked" });
    const tool = createWorkItemTool();

    await tool.execute("call-1", {
      action: "update",
      itemId: "item-1",
      status: "blocked",
    });

    expect(updateItemMock).toHaveBeenCalledTimes(1);
    expect(updateItemMock).toHaveBeenCalledWith("item-1", { status: "blocked" });
  });

  it("update action rejects empty patches", async () => {
    const tool = createWorkItemTool();
    await expect(tool.execute("call-2", { action: "update", itemId: "item-1" })).rejects.toThrow(
      "No update fields provided",
    );
    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it("reassign requires explicit queueId or agentId", async () => {
    const tool = createWorkItemTool();
    await expect(
      tool.execute("call-3", {
        action: "reassign",
        itemId: "item-1",
      }),
    ).rejects.toThrow("queueId or agentId required");
    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it("reassign with agentId ensures queue and updates queueId", async () => {
    ensureQueueForAgentMock.mockResolvedValue({ id: "agent-b" });
    updateItemMock.mockResolvedValue({ id: "item-1", queueId: "agent-b" });
    const tool = createWorkItemTool();

    await tool.execute("call-4", {
      action: "reassign",
      itemId: "item-1",
      agentId: "agent-b",
    });

    expect(ensureQueueForAgentMock).toHaveBeenCalledWith("agent-b");
    expect(updateItemMock).toHaveBeenCalledWith("item-1", { queueId: "agent-b" });
  });

  it("reassign with queueId fails when queue is missing", async () => {
    getQueueMock.mockResolvedValue(null);
    const tool = createWorkItemTool();

    await expect(
      tool.execute("call-5", {
        action: "reassign",
        itemId: "item-1",
        queueId: "missing-queue",
      }),
    ).rejects.toThrow("Queue not found: missing-queue");
    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it("list treats non-boolean includeCompleted values as false", async () => {
    listItemsMock.mockResolvedValue([]);
    const tool = createWorkItemTool();

    await tool.execute("call-6", {
      action: "list",
      includeCompleted: "false",
    });

    expect(listItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ["pending", "in_progress", "blocked"],
      }),
    );
  });
});
