import { describe, expect, it } from "vitest";
import { markdownToNotionBlocks, parseInlineMarkdown } from "./markdown-to-blocks.js";

describe("markdownToNotionBlocks", () => {
  it("converts headings", () => {
    const blocks = markdownToNotionBlocks("# Title\n## Subtitle\n### Section");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("heading_1");
    expect(blocks[1].type).toBe("heading_2");
    expect(blocks[2].type).toBe("heading_3");
  });

  it("converts paragraphs", () => {
    const blocks = markdownToNotionBlocks("Hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const para = blocks[0].paragraph as { rich_text: Array<{ text: { content: string } }> };
    expect(para.rich_text[0].text.content).toBe("Hello world");
  });

  it("converts bulleted list items", () => {
    const blocks = markdownToNotionBlocks("- Item 1\n- Item 2\n* Item 3");
    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      expect(block.type).toBe("bulleted_list_item");
    }
  });

  it("converts numbered list items", () => {
    const blocks = markdownToNotionBlocks("1. First\n2. Second");
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.type).toBe("numbered_list_item");
    }
  });

  it("converts to-do items", () => {
    const blocks = markdownToNotionBlocks("- [x] Done\n- [ ] Not done");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("to_do");
    expect((blocks[0].to_do as { checked: boolean }).checked).toBe(true);
    expect(blocks[1].type).toBe("to_do");
    expect((blocks[1].to_do as { checked: boolean }).checked).toBe(false);
  });

  it("converts block quotes", () => {
    const blocks = markdownToNotionBlocks("> Quote line 1\n> Quote line 2");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
  });

  it("converts code blocks", () => {
    const blocks = markdownToNotionBlocks("```typescript\nconst x = 1;\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("code");
    const code = blocks[0].code as {
      language: string;
      rich_text: Array<{ text: { content: string } }>;
    };
    expect(code.language).toBe("typescript");
    expect(code.rich_text[0].text.content).toBe("const x = 1;");
  });

  it("converts dividers", () => {
    const blocks = markdownToNotionBlocks("---");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("divider");
  });

  it("handles mixed content", () => {
    const md = [
      "# My Page",
      "",
      "A paragraph.",
      "",
      "- Item 1",
      "- Item 2",
      "",
      "```js",
      "console.log('hi');",
      "```",
      "",
      "---",
      "",
      "> A quote",
    ].join("\n");

    const blocks = markdownToNotionBlocks(md);
    const types = blocks.map((b) => b.type);
    expect(types).toEqual([
      "heading_1",
      "paragraph",
      "bulleted_list_item",
      "bulleted_list_item",
      "code",
      "divider",
      "quote",
    ]);
  });

  it("handles empty input", () => {
    const blocks = markdownToNotionBlocks("");
    expect(blocks).toHaveLength(0);
  });
});

describe("parseInlineMarkdown", () => {
  it("parses plain text", () => {
    const result = parseInlineMarkdown("Hello world");
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe("Hello world");
  });

  it("parses bold text", () => {
    const result = parseInlineMarkdown("Hello **bold** world");
    expect(result).toHaveLength(3);
    expect(result[0].text.content).toBe("Hello ");
    expect(result[1].text.content).toBe("bold");
    expect(result[1].annotations?.bold).toBe(true);
    expect(result[2].text.content).toBe(" world");
  });

  it("parses italic text", () => {
    const result = parseInlineMarkdown("Hello *italic* world");
    expect(result).toHaveLength(3);
    expect(result[1].text.content).toBe("italic");
    expect(result[1].annotations?.italic).toBe(true);
  });

  it("parses inline code", () => {
    const result = parseInlineMarkdown("Use `code` here");
    expect(result).toHaveLength(3);
    expect(result[1].text.content).toBe("code");
    expect(result[1].annotations?.code).toBe(true);
  });

  it("parses strikethrough", () => {
    const result = parseInlineMarkdown("~~deleted~~ text");
    expect(result).toHaveLength(2);
    expect(result[0].text.content).toBe("deleted");
    expect(result[0].annotations?.strikethrough).toBe(true);
  });

  it("parses links", () => {
    const result = parseInlineMarkdown("Visit [Google](https://google.com) now");
    expect(result).toHaveLength(3);
    expect(result[1].text.content).toBe("Google");
    expect(result[1].text.link?.url).toBe("https://google.com");
  });

  it("handles text with no inline formatting", () => {
    const result = parseInlineMarkdown("Just plain text here");
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe("Just plain text here");
  });
});
