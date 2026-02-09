import path from "node:path";

export function normalizeVaultPath(input: string): string {
  return input.replace(/^\/+/, "");
}

export function ensureMarkdownExtension(input: string): string {
  if (!input.endsWith(".md")) {
    return `${input}.md`;
  }
  return input;
}

export function getNoteNameFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
