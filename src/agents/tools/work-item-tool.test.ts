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

const loadConfigMock = vi.fn().mockReturnValue({});

vi.mock("../../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
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
    loadConfigMock.mockReset().mockReturnValue({});
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

  it("list enriches items with agentName from config", async () => {
    loadConfigMock.mockReturnValue({
      agents: {
        list: [
          { id: "agent-a", name: "Alice" },
          { id: "agent-b", name: "Bob" },
        ],
      },
    });
    listItemsMock.mockResolvedValue([
      { id: "item-1", title: "task 1", assignedTo: { agentId: "agent-a" } },
      { id: "item-2", title: "task 2", assignedTo: { agentId: "agent-b" } },
      { id: "item-3", title: "task 3" },
      { id: "item-4", title: "task 4", assignedTo: { agentId: "unknown-agent" } },
    ]);
    const tool = createWorkItemTool();
    const result = await tool.execute("call-names", { action: "list", includeCompleted: true });
    const textContent = result.content[0] as { type: "text"; text: string };
    const parsed = JSON.parse(textContent.text);
    expect(parsed.items[0].agentName).toBe("Alice");
    expect(parsed.items[1].agentName).toBe("Bob");
    expect(parsed.items[2].agentName).toBeUndefined();
    expect(parsed.items[3].agentName).toBeUndefined();
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
