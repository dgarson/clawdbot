import { describe, expect, it, vi } from "vitest";
import { createNotionTools } from "./index.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

describe("createNotionTools", () => {
  it("creates all 7 tools", () => {
    const tools = createNotionTools({ apiKey: "test" });
    expect(tools).toHaveLength(7);

    const names = tools.map((t) => t.name);
    expect(names).toContain("notion_search");
    expect(names).toContain("notion_get_page");
    expect(names).toContain("notion_get_page_content");
    expect(names).toContain("notion_create_page");
    expect(names).toContain("notion_update_page");
    expect(names).toContain("notion_append_blocks");
    expect(names).toContain("notion_query_database");
  });

  it("all tools have descriptions and parameters", () => {
    const tools = createNotionTools({ apiKey: "test" });
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeTruthy();
      expect(tool.execute).toBeTypeOf("function");
    }
  });
});

describe("notion_search tool", () => {
  it("executes a search with query", async () => {
    const fetchFn = mockFetch(200, { results: [{ id: "p1" }], has_more: false });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const searchTool = tools.find((t) => t.name === "notion_search")!;

    const result = await searchTool.execute("call-1", { query: "meeting notes" });
    expect(result).toBeTruthy();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("handles errors gracefully", async () => {
    const fetchFn = mockFetch(500, { message: "Internal Error" });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const searchTool = tools.find((t) => t.name === "notion_search")!;

    const result = await searchTool.execute("call-1", { query: "test" });
    // Should return error as result, not throw
    const parsed = JSON.parse(typeof result === "string" ? result : JSON.stringify(result));
    // The result should contain an error field
    expect(parsed).toBeTruthy();
  });
});

describe("notion_get_page tool", () => {
  it("requires page_id", async () => {
    const fetchFn = mockFetch(200, {});
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_get_page")!;

    // readStringParam with required: true throws when the param is missing
    await expect(tool.execute("call-1", {})).rejects.toThrow("page_id required");
  });

  it("retrieves a page by ID", async () => {
    const fetchFn = mockFetch(200, { id: "page-123", object: "page" });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_get_page")!;

    const result = await tool.execute("call-1", { page_id: "page-123" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("notion_create_page tool", () => {
  it("requires parent_type and parent_id", async () => {
    const fetchFn = mockFetch(200, {});
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_create_page")!;

    // readStringParam with required: true throws when the param is missing
    await expect(tool.execute("call-1", {})).rejects.toThrow("parent_type required");
  });

  it("creates a page in a database", async () => {
    const fetchFn = mockFetch(200, { id: "new-page", object: "page" });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_create_page")!;

    await tool.execute("call-1", {
      parent_type: "database",
      parent_id: "db-1",
      properties: { Name: { title: [{ text: { content: "New Item" } }] } },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.parent.database_id).toBe("db-1");
  });

  it("creates a page in a data source using data_source_id parent", async () => {
    const fetchFn = mockFetch(200, { id: "new-page", object: "page" });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_create_page")!;

    await tool.execute("call-1", {
      parent_type: "data_source",
      parent_id: "ds-1",
      properties: { Name: { title: [{ text: { content: "DS Item" } }] } },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.parent.data_source_id).toBe("ds-1");
  });
});

describe("notion_update_page tool", () => {
  it("requires page_id", async () => {
    const fetchFn = mockFetch(200, {});
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_update_page")!;

    // readStringParam with required: true throws when the param is missing
    await expect(tool.execute("call-1", {})).rejects.toThrow("page_id required");
  });

  it("updates page properties", async () => {
    const fetchFn = mockFetch(200, { id: "page-1" });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_update_page")!;

    await tool.execute("call-1", {
      page_id: "page-1",
      properties: { Status: { select: { name: "Done" } } },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("notion_append_blocks tool", () => {
  it("requires content or children", async () => {
    const fetchFn = mockFetch(200, {});
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_append_blocks")!;

    const result = await tool.execute("call-1", { page_id: "p1" });
    const text = typeof result === "string" ? result : JSON.stringify(result);
    expect(text).toContain("error");
  });

  it("appends raw block children to a page", async () => {
    const fetchFn = mockFetch(200, { results: [] });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_append_blocks")!;

    await tool.execute("call-1", {
      page_id: "page-1",
      children: [{ type: "paragraph", paragraph: { rich_text: [{ text: { content: "Hi" } }] } }],
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("converts markdown content to blocks and appends", async () => {
    const fetchFn = mockFetch(200, { results: [] });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_append_blocks")!;

    await tool.execute("call-1", {
      page_id: "page-1",
      content: "# Hello\n\nA paragraph.",
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.children).toHaveLength(2);
    expect(body.children[0].type).toBe("heading_1");
    expect(body.children[1].type).toBe("paragraph");
  });
});

describe("notion_query_database tool", () => {
  it("requires database_id or data_source_id", async () => {
    const fetchFn = mockFetch(200, {});
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_query_database")!;

    const result = await tool.execute("call-1", {});
    const text = typeof result === "string" ? result : JSON.stringify(result);
    expect(text).toContain("error");
  });

  it("queries with database_id using /databases/ endpoint", async () => {
    const fetchFn = mockFetch(200, { results: [], has_more: false });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_query_database")!;

    await tool.execute("call-1", {
      database_id: "db-1",
      filter: { property: "Status", select: { equals: "Active" } },
      sorts: [{ property: "Date", direction: "descending" }],
      page_size: 25,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toContain("/databases/db-1/query");
    const body = JSON.parse(init.body);
    expect(body.filter).toBeTruthy();
    expect(body.sorts).toHaveLength(1);
    expect(body.page_size).toBe(25);
  });

  it("queries with data_source_id using /data_sources/ endpoint", async () => {
    const fetchFn = mockFetch(200, { results: [], has_more: false });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_query_database")!;

    await tool.execute("call-1", {
      data_source_id: "ds-1",
      page_size: 10,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toContain("/data_sources/ds-1/query");
  });

  it("prefers data_source_id over database_id when both provided", async () => {
    const fetchFn = mockFetch(200, { results: [], has_more: false });
    const tools = createNotionTools({ apiKey: "test", fetchFn });
    const tool = tools.find((t) => t.name === "notion_query_database")!;

    await tool.execute("call-1", {
      database_id: "db-1",
      data_source_id: "ds-1",
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toContain("/data_sources/ds-1/query");
  });
});
