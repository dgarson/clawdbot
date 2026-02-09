import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const raw = match[1] ?? "";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (parseYaml(raw) as Record<string, unknown> | null) ?? {};
  } catch {
    parsed = {};
  }
  const body = content.slice(match[0].length);
  return { frontmatter: parsed, body };
}

export function composeNote(body: string, frontmatter?: Record<string, unknown>): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }
  const yaml = stringifyYaml(frontmatter).trim();
  return `---\n${yaml}\n---\n\n${body}`;
}

export function mergeFrontmatter(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
