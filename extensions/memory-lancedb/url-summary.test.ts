import { beforeEach, describe, expect, it, vi } from "vitest";

const tableAddMock = vi.fn(async () => undefined);
const tableDeleteMock = vi.fn(async () => undefined);
const tableCountRowsMock = vi.fn(async () => 0);
const tableToArrayMock = vi.fn(async () => []);
const tableLimitMock = vi.fn(() => ({ toArray: tableToArrayMock }));
const tableVectorSearchMock = vi.fn(() => ({ limit: tableLimitMock }));

const tableMock = {
  add: tableAddMock,
  delete: tableDeleteMock,
  countRows: tableCountRowsMock,
  vectorSearch: tableVectorSearchMock,
};

const dbTableNamesMock = vi.fn(async () => ["memories"]);
const dbOpenTableMock = vi.fn(async () => tableMock);
const dbCreateTableMock = vi.fn(async () => tableMock);

vi.mock("@lancedb/lancedb", () => ({
  connect: vi.fn(async () => ({
    tableNames: dbTableNamesMock,
    openTable: dbOpenTableMock,
    createTable: dbCreateTableMock,
  })),
}));

const embeddingsCreateMock = vi.fn(async () => ({
  data: [{ embedding: [0.1, 0.2, 0.3] }],
}));

vi.mock("openai", () => ({
  default: class {
    embeddings = {
      create: embeddingsCreateMock,
    };
  },
}));

describe("memory-lancedb agent_end auto-capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockApi() {
    const hooks: Record<string, (event: unknown) => Promise<unknown> | unknown> = {};
    return {
      hooks,
      api: {
        pluginConfig: {
          embedding: { apiKey: "sk-test", model: "text-embedding-3-small" },
          dbPath: "/tmp/memory-lancedb-test",
          autoCapture: true,
          autoRecall: false,
        },
        resolvePath: (p: string) => p,
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
        },
        registerTool: vi.fn(),
        registerCli: vi.fn(),
        registerService: vi.fn(),
        registerCron: vi.fn(),
        on: vi.fn((event: string, handler: (event: unknown) => Promise<unknown> | unknown) => {
          hooks[event] = handler;
        }),
      },
    };
  }

  it("captures durable DM-like content on agent_end", async () => {
    const { default: memoryPlugin } = await import("./index.js");
    const { api, hooks } = createMockApi();
    memoryPlugin.register(api as never);

    const agentEnd = hooks["agent_end"];
    expect(agentEnd).toBeDefined();

    await agentEnd?.({
      success: true,
      channelType: "dm",
      channelId: "test-dm",
      messages: [
        { role: "user", content: "Remember that I prefer dark mode in every editor." },
        { role: "assistant", content: "Saved." },
      ],
    });

    expect(embeddingsCreateMock).toHaveBeenCalled();
    expect(tableAddMock).toHaveBeenCalledTimes(1);
    expect(tableAddMock.mock.calls[0]?.[0]?.[0]).toMatchObject({
      text: expect.stringContaining("prefer dark mode"),
      category: "preference",
    });
  });

  it("does not capture non-trigger text (e.g. plain URL share)", async () => {
    const { default: memoryPlugin } = await import("./index.js");
    const { api, hooks } = createMockApi();
    memoryPlugin.register(api as never);

    const agentEnd = hooks["agent_end"];
    expect(agentEnd).toBeDefined();

    await agentEnd?.({
      success: true,
      channelType: "group",
      channelId: "test-group",
      messages: [
        { role: "user", content: "Check this out https://example.com/article" },
        { role: "assistant", content: "Looks useful." },
      ],
    });

    expect(tableAddMock).not.toHaveBeenCalled();
  });
});
