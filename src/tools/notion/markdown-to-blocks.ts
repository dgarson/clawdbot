/**
 * Markdown → Notion block converter.
 *
 * Converts a markdown string into an array of Notion block objects
 * suitable for the `children` parameter of the create-page and
 * append-blocks API calls.
 *
 * Supported markdown constructs:
 *   # / ## / ### headings          → heading_1 / heading_2 / heading_3
 *   Plain paragraphs               → paragraph
 *   - / * unordered list items     → bulleted_list_item
 *   1. ordered list items          → numbered_list_item
 *   - [x] / - [ ] checkboxes      → to_do
 *   > blockquotes                  → quote
 *   ``` code fences                → code
 *   ---                            → divider
 *   **bold**, *italic*, `code`     → rich_text annotations
 *   [text](url) links              → rich_text links
 */

export type NotionRichText = {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
};

export type NotionBlock = {
  object: "block";
  type: string;
  [key: string]: unknown;
};

/**
 * Convert a markdown string to an array of Notion block objects.
 */
export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split("\n");
  const blocks: NotionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(makeCodeBlock(codeLines.join("\n"), lang));
      continue;
    }

    // Divider
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line) || /^___+\s*$/.test(line)) {
      blocks.push({ object: "block", type: "divider", divider: {} });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const text = headingMatch[2];
      const type = `heading_${level}`;
      blocks.push({
        object: "block",
        type,
        [type]: { rich_text: parseInlineMarkdown(text) },
      });
      i++;
      continue;
    }

    // To-do items
    const todoMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
    if (todoMatch) {
      const checked = todoMatch[1].toLowerCase() === "x";
      const text = todoMatch[2];
      blocks.push({
        object: "block",
        type: "to_do",
        to_do: { rich_text: parseInlineMarkdown(text), checked },
      });
      i++;
      continue;
    }

    // Bulleted list items
    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: parseInlineMarkdown(bulletMatch[1]) },
      });
      i++;
      continue;
    }

    // Numbered list items
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)/);
    if (numberedMatch) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: parseInlineMarkdown(numberedMatch[1]) },
      });
      i++;
      continue;
    }

    // Block quotes
    const quoteMatch = line.match(/^>\s?(.*)/);
    if (quoteMatch) {
      // Collect consecutive quote lines
      const quoteLines: string[] = [quoteMatch[1]];
      i++;
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        object: "block",
        type: "quote",
        quote: { rich_text: parseInlineMarkdown(quoteLines.join("\n")) },
      });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Default: paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith(">") &&
      !lines[i].match(/^[-*]\s/) &&
      !lines[i].match(/^\d+[.)]\s/) &&
      !lines[i].match(/^---+\s*$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: parseInlineMarkdown(paraLines.join("\n")) },
    });
  }

  return blocks;
}

function makeCodeBlock(code: string, language: string): NotionBlock {
  // Notion requires known language identifiers; default to "plain text"
  const lang = language || "plain text";
  return {
    object: "block",
    type: "code",
    code: {
      rich_text: [{ type: "text", text: { content: code } }],
      language: lang,
    },
  };
}

/**
 * Parse inline markdown (bold, italic, code, strikethrough, links) into
 * Notion rich_text segments.
 */
export function parseInlineMarkdown(text: string): NotionRichText[] {
  const segments: NotionRichText[] = [];

  // Regex for inline patterns in priority order:
  //   [text](url)     — link
  //   **text**        — bold
  //   *text*          — italic (but not **)
  //   ~~text~~        — strikethrough
  //   `text`          — inline code
  const inlineRegex =
    /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|(?<!\*)\*([^*]+)\*(?!\*)|~~(.+?)~~|`([^`]+)`/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) {
        segments.push({ type: "text", text: { content: plain } });
      }
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Link: [text](url)
      segments.push({
        type: "text",
        text: { content: match[1], link: { url: match[2] } },
      });
    } else if (match[3] !== undefined) {
      // Bold: **text**
      segments.push({
        type: "text",
        text: { content: match[3] },
        annotations: { bold: true },
      });
    } else if (match[4] !== undefined) {
      // Italic: *text*
      segments.push({
        type: "text",
        text: { content: match[4] },
        annotations: { italic: true },
      });
    } else if (match[5] !== undefined) {
      // Strikethrough: ~~text~~
      segments.push({
        type: "text",
        text: { content: match[5] },
        annotations: { strikethrough: true },
      });
    } else if (match[6] !== undefined) {
      // Inline code: `text`
      segments.push({
        type: "text",
        text: { content: match[6] },
        annotations: { code: true },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      segments.push({ type: "text", text: { content: remaining } });
    }
  }

  // If no segments were produced, return a single plain text segment
  if (segments.length === 0) {
    segments.push({ type: "text", text: { content: text } });
  }

  return segments;
}
