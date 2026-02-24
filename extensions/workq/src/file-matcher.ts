import fs from "node:fs";
import path from "node:path";

export function canonicalizeAbsolutePath(inputPath: string, cwd: string = process.cwd()): string {
  const raw = String(inputPath ?? "").trim();
  if (!raw) {
    throw new Error("path is required");
  }

  const absolute = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(cwd, raw);
  const realized = tryRealpath(absolute);
  return normalizeSeparators(stripTrailingSlash(realized));
}

export function canonicalizeAbsolutePaths(paths: string[], cwd?: string): string[] {
  const deduped = new Set<string>();
  for (const candidate of paths) {
    deduped.add(canonicalizeAbsolutePath(candidate, cwd));
  }
  return [...deduped].sort();
}

export function pathsOverlap(pathA: string, pathB: string): boolean {
  const a = canonicalizeAbsolutePath(pathA);
  const b = canonicalizeAbsolutePath(pathB);
  return isPrefixOrEqual(a, b) || isPrefixOrEqual(b, a);
}

export function matchingPaths(queryPath: string, filePaths: string[]): string[] {
  const query = canonicalizeAbsolutePath(queryPath);
  return filePaths
    .map((filePath) => canonicalizeAbsolutePath(filePath))
    .filter((filePath) => isPrefixOrEqual(filePath, query) || isPrefixOrEqual(query, filePath));
}

function tryRealpath(absolutePath: string): string {
  try {
    return fs.realpathSync.native(absolutePath);
  } catch {
    return absolutePath;
  }
}

function stripTrailingSlash(value: string): string {
  if (value === "/") {
    return value;
  }
  return value.replace(/\/+$/, "");
}

function normalizeSeparators(value: string): string {
  return value.replace(/\\/g, "/");
}

function isPrefixOrEqual(candidate: string, base: string): boolean {
  if (candidate === base) {
    return true;
  }
  if (base === "/") {
    return candidate.startsWith("/");
  }
  return candidate.startsWith(`${base}/`);
}
