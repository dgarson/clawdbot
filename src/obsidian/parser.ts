import { parseFrontmatter } from "./frontmatter.js";

export type ParsedHeading = {
  level: number;
  text: string;
  line: number;
};

export type WikiLink = {
  target: string;
  alias?: string;
  reference?: string;
  line: number;
  column: number;
};

export type ParsedNote = {
  frontmatter: Record<string, unknown>;
  body: string;
  wikiLinks: WikiLink[];
  tags: string[];
  blockReferences: string[];
  embeds: string[];
  headings: ParsedHeading[];
};

export function parseObsidianNote(content: string): ParsedNote {
  const parsed = parseFrontmatter(content);
  return {
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    wikiLinks: extractWikiLinks(parsed.body),
    tags: extractTags(parsed.body, parsed.frontmatter),
    blockReferences: extractBlockReferences(parsed.body),
    embeds: extractEmbeds(parsed.body),
    headings: extractHeadings(parsed.body),
  };
}

export function extractWikiLinks(content: string): WikiLink[] {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const [, targetRaw, alias] = match;
    const [target, reference] = targetRaw.split(/[#^]/, 2);
    const before = content.slice(0, match.index);
    const line = before.split("\n").length;
    const column = match.index - before.lastIndexOf("\n") - 1;

    links.push({
      target: target.trim(),
      alias: alias?.trim(),
      reference: reference?.trim(),
      line,
      column,
    });
  }

  return links;
}

export function extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
  const inlineTags = new Set<string>();
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(content)) !== null) {
    inlineTags.add(match[1]);
  }

  if (Array.isArray(frontmatter.tags)) {
    for (const tag of frontmatter.tags) {
      if (typeof tag === "string") {
        inlineTags.add(tag);
      }
    }
  }

  return [...inlineTags];
}

export function extractEmbeds(content: string): string[] {
  const regex = /!\[\[([^\]]+)\]\]/g;
  const embeds: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    embeds.push(match[1]);
  }

  return embeds;
}

export function extractBlockReferences(content: string): string[] {
  const regex = /\^([a-zA-Z0-9-]+)$/gm;
  const refs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

export function extractHeadings(content: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) {
      return;
    }
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      line: index + 1,
    });
  });

  return headings;
}
