import { describe, expect, it, vi } from "vitest";
import {
  notionSearch,
  notionGetPage,
  notionGetBlocks,
  notionCreatePage,
  notionUpdatePage,
  notionAppendBlocks,
  notionQueryDatabase,
  fetchPageContentAsText,
  NotionApiError,
  NOTION_API_VERSION,
  NOTION_BASE_URL,
} from "./api.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

const API_KEY = "ntn_test_key";

describe("Notion API client", () => {
  describe("notionSearch", () => {
    it("sends POST to /search with auth headers", async () => {
      const fetchFn = mockFetch(200, { results: [] });
      await notionSearch({ apiKey: API_KEY, fetchFn }, { query: "hello" });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/search`);
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
      expect(init.headers["Notion-Version"]).toBe(NOTION_API_VERSION);
      expect(JSON.parse(init.body)).toEqual({ query: "hello" });
    });
  });

  describe("notionGetPage", () => {
    it("sends GET to /pages/{id}", async () => {
      const fetchFn = mockFetch(200, { id: "page-1" });
      const result = await notionGetPage({ apiKey: API_KEY, fetchFn }, "page-1");

      expect(result).toEqual({ id: "page-1" });
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/pages/page-1`);
      expect(init.method).toBe("GET");
    });
  });

  describe("notionGetBlocks", () => {
    it("sends GET to /blocks/{id}/children with pagination", async () => {
      const fetchFn = mockFetch(200, { results: [] });
      await notionGetBlocks({ apiKey: API_KEY, fetchFn }, "block-1", {
        page_size: 50,
        start_cursor: "cursor-1",
      });

      const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toContain("/blocks/block-1/children?");
      expect(url).toContain("page_size=50");
      expect(url).toContain("start_cursor=cursor-1");
    });
  });

  describe("notionCreatePage", () => {
    it("sends POST to /pages", async () => {
      const fetchFn = mockFetch(200, { id: "new-page" });
      await notionCreatePage(
        { apiKey: API_KEY, fetchFn },
        {
          parent: { database_id: "db-1" },
          properties: { Name: { title: [{ text: { content: "Test" } }] } },
        },
      );

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/pages`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.parent.database_id).toBe("db-1");
    });
  });

  describe("notionUpdatePage", () => {
    it("sends PATCH to /pages/{id}", async () => {
      const fetchFn = mockFetch(200, { id: "page-1" });
      await notionUpdatePage({ apiKey: API_KEY, fetchFn }, "page-1", {
        properties: { Status: { select: { name: "Done" } } },
      });

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/pages/page-1`);
      expect(init.method).toBe("PATCH");
    });
  });

  describe("notionAppendBlocks", () => {
    it("sends PATCH to /blocks/{id}/children", async () => {
      const fetchFn = mockFetch(200, { results: [] });
      await notionAppendBlocks({ apiKey: API_KEY, fetchFn }, "page-1", [
        { type: "paragraph", paragraph: { rich_text: [{ text: { content: "Hi" } }] } },
      ]);

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/blocks/page-1/children`);
      expect(init.method).toBe("PATCH");
    });
  });

  describe("notionQueryDatabase", () => {
    it("sends POST to /databases/{id}/query by default", async () => {
      const fetchFn = mockFetch(200, { results: [] });
      await notionQueryDatabase({ apiKey: API_KEY, fetchFn }, "db-1", {
        filter: { property: "Status", select: { equals: "Active" } },
        sorts: [{ property: "Date", direction: "descending" }],
        page_size: 10,
      });

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/databases/db-1/query`);
      expect(init.method).toBe("POST");
    });

    it("sends POST to /data_sources/{id}/query when useDataSourceEndpoint is true", async () => {
      const fetchFn = mockFetch(200, { results: [] });
      await notionQueryDatabase({ apiKey: API_KEY, fetchFn }, "ds-1", { page_size: 10 }, true);

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe(`${NOTION_BASE_URL}/data_sources/ds-1/query`);
      expect(init.method).toBe("POST");
    });
  });

  describe("error handling", () => {
    it("throws NotionApiError on non-ok responses", async () => {
      const fetchFn = mockFetch(404, { message: "Not Found" });
      await expect(notionGetPage({ apiKey: API_KEY, fetchFn }, "bad-id")).rejects.toThrow(
        NotionApiError,
      );
    });

    it("includes status and path in error", async () => {
      const fetchFn = mockFetch(401, { message: "Unauthorized" });
      try {
        await notionGetPage({ apiKey: API_KEY, fetchFn }, "page-1");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NotionApiError);
        expect((err as NotionApiError).status).toBe(401);
        expect((err as NotionApiError).path).toBe("/pages/page-1");
      }
    });
  });

  describe("fetchPageContentAsText", () => {
    it("combines page title and block content", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // Page properties
          return {
            ok: true,
            status: 200,
            json: async () => ({
              properties: {
                Name: { type: "title", title: [{ plain_text: "Test Page" }] },
              },
            }),
            text: async () => "{}",
          };
        }
        // Block children
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Hello world" }] } },
              { type: "heading_2", heading_2: { rich_text: [{ plain_text: "Section" }] } },
              {
                type: "bulleted_list_item",
                bulleted_list_item: { rich_text: [{ plain_text: "Item 1" }] },
              },
            ],
            has_more: false,
          }),
          text: async () => "{}",
        };
      }) as unknown as typeof fetch;

      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1");
      expect(text).toContain("# Test Page");
      expect(text).toContain("Hello world");
      expect(text).toContain("## Section");
      expect(text).toContain("- Item 1");
    });

    it("paginates through all blocks when has_more is true", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async (url: string) => {
        callCount++;
        if (callCount === 1) {
          // Page properties
          return {
            ok: true,
            status: 200,
            json: async () => ({
              properties: {
                Name: { type: "title", title: [{ plain_text: "Long Page" }] },
              },
            }),
            text: async () => "{}",
          };
        }
        if (callCount === 2) {
          // First page of blocks
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Block page 1" }] } },
              ],
              has_more: true,
              next_cursor: "cursor-2",
            }),
            text: async () => "{}",
          };
        }
        if (callCount === 3) {
          // Verify cursor is passed
          expect(url).toContain("start_cursor=cursor-2");
          // Second page of blocks
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Block page 2" }] } },
              ],
              has_more: false,
            }),
            text: async () => "{}",
          };
        }
        throw new Error("Unexpected call");
      }) as unknown as typeof fetch;

      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1");
      expect(text).toContain("# Long Page");
      expect(text).toContain("Block page 1");
      expect(text).toContain("Block page 2");
      expect(callCount).toBe(3); // 1 page fetch + 2 block fetches
    });

    it("respects maxPages limit to prevent runaway pagination", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ properties: {} }),
            text: async () => "{}",
          };
        }
        // Always return has_more: true to simulate infinite pagination
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                type: "paragraph",
                paragraph: { rich_text: [{ plain_text: `Block ${callCount}` }] },
              },
            ],
            has_more: true,
            next_cursor: `cursor-${callCount}`,
          }),
          text: async () => "{}",
        };
      }) as unknown as typeof fetch;

      // maxPages=2 means at most 2 block fetches
      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1", 2);
      // 1 page fetch + 2 block fetches = 3 total calls
      expect(callCount).toBe(3);
      expect(text).toContain("Block 2");
      expect(text).toContain("Block 3");
    });

    it("extracts divider blocks correctly", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ properties: {} }),
            text: async () => "{}",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Before" }] } },
              { type: "divider", divider: {} },
              { type: "paragraph", paragraph: { rich_text: [{ plain_text: "After" }] } },
            ],
            has_more: false,
          }),
          text: async () => "{}",
        };
      }) as unknown as typeof fetch;

      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1");
      expect(text).toContain("Before");
      expect(text).toContain("---");
      expect(text).toContain("After");
    });

    it("extracts image blocks with captions", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ properties: {} }),
            text: async () => "{}",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                type: "image",
                image: {
                  type: "external",
                  external: { url: "https://example.com/img.png" },
                  caption: [{ plain_text: "My image" }],
                },
              },
            ],
            has_more: false,
          }),
          text: async () => "{}",
        };
      }) as unknown as typeof fetch;

      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1");
      expect(text).toContain("![My image](https://example.com/img.png)");
    });

    it("extracts child_page and child_database blocks", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ properties: {} }),
            text: async () => "{}",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              { type: "child_page", child_page: { title: "Sub Page" } },
              { type: "child_database", child_database: { title: "Sub DB" } },
            ],
            has_more: false,
          }),
          text: async () => "{}",
        };
      }) as unknown as typeof fetch;

      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1");
      expect(text).toContain("📄 Sub Page");
      expect(text).toContain("🗄️ Sub DB");
    });

    it("recursively fetches child blocks", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async (url: string) => {
        callCount++;
        if (callCount === 1) {
          // Page properties
          return {
            ok: true,
            status: 200,
            json: async () => ({
              properties: {
                Name: { type: "title", title: [{ plain_text: "Nested Page" }] },
              },
            }),
            text: async () => "{}",
          };
        }
        if (callCount === 2) {
          // Top-level blocks — one toggle with has_children
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  id: "toggle-1",
                  type: "toggle",
                  toggle: { rich_text: [{ plain_text: "Toggle header" }] },
                  has_children: true,
                },
              ],
              has_more: false,
            }),
            text: async () => "{}",
          };
        }
        if (callCount === 3) {
          // Child blocks of toggle-1
          expect(url).toContain("/blocks/toggle-1/children");
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  id: "child-1",
                  type: "paragraph",
                  paragraph: { rich_text: [{ plain_text: "Nested child content" }] },
                  has_children: false,
                },
              ],
              has_more: false,
            }),
            text: async () => "{}",
          };
        }
        throw new Error("Unexpected call");
      }) as unknown as typeof fetch;

      const text = await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1", {
        maxDepth: 3,
        maxPages: 10,
      });
      expect(text).toContain("# Nested Page");
      expect(text).toContain("Toggle header");
      expect(text).toContain("Nested child content");
      // Child content should be indented
      expect(text).toContain("  Nested child content");
      expect(callCount).toBe(3);
    });

    it("respects maxDepth limit for recursive fetching", async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ properties: {} }),
            text: async () => "{}",
          };
        }
        // Always return blocks with has_children: true
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                id: `block-${callCount}`,
                type: "paragraph",
                paragraph: { rich_text: [{ plain_text: `Level ${callCount - 1}` }] },
                has_children: true,
              },
            ],
            has_more: false,
          }),
          text: async () => "{}",
        };
      }) as unknown as typeof fetch;

      // maxDepth=1 means: top-level + 1 level of children
      await fetchPageContentAsText({ apiKey: API_KEY, fetchFn }, "page-1", {
        maxDepth: 1,
        maxPages: 10,
      });
      // 1 page fetch + 1 top-level blocks + 1 child blocks = 3 fetches
      // (the child at depth=1 has has_children but depth=1 >= maxDepth so no further recursion)
      expect(callCount).toBe(3);
    });
  });
});
