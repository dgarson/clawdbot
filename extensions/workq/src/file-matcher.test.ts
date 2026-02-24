import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalizeAbsolutePath,
  canonicalizeAbsolutePaths,
  matchingPaths,
  pathsOverlap,
} from "./file-matcher.js";

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

describe("file-matcher", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workq-file-matcher-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("canonicalizes to absolute paths, normalizes segments, and strips trailing slashes", () => {
    const existingDir = path.join(tempDir, "repo", "src");
    fs.mkdirSync(existingDir, { recursive: true });

    const fromRelative = canonicalizeAbsolutePath("./src/../src/", path.join(tempDir, "repo"));
    expect(fromRelative).toBe(toPosix(fs.realpathSync.native(existingDir)));

    const nonExistingAbsolute = `${path.join(tempDir, "repo", "pkg", "..", "docs")}//`;
    expect(canonicalizeAbsolutePath(nonExistingAbsolute)).toBe(
      toPosix(path.join(tempDir, "repo", "docs")),
    );
  });

  it("throws when canonicalizing empty input", () => {
    expect(() => canonicalizeAbsolutePath("   ")).toThrowError("path is required");
  });

  it("dedupes canonical absolute paths and returns stable lexicographic order", () => {
    const repo = path.join(tempDir, "repo");
    const src = path.join(repo, "src");
    const index = path.join(src, "index.ts");
    const utils = path.join(src, "utils.ts");

    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(index, "");
    fs.writeFileSync(utils, "");

    const result = canonicalizeAbsolutePaths([
      utils,
      `${src}/../src/index.ts`,
      index,
      `${src}/utils.ts`,
    ]);

    const expected = [canonicalizeAbsolutePath(index), canonicalizeAbsolutePath(utils)].sort(
      (a, b) => a.localeCompare(b),
    );
    expect(result).toEqual(expected);
  });

  it("detects overlap for same file, parent/child paths, and excludes siblings", () => {
    const repo = path.join(tempDir, "repo");
    const srcDir = path.join(repo, "src");
    const sameFile = path.join(srcDir, "index.ts");
    const childFile = path.join(srcDir, "nested", "view.ts");
    const siblingFile = path.join(repo, "tests", "index.test.ts");

    expect(pathsOverlap(sameFile, sameFile)).toBe(true);
    expect(pathsOverlap(srcDir, childFile)).toBe(true);
    expect(pathsOverlap(childFile, srcDir)).toBe(true);
    expect(pathsOverlap(sameFile, siblingFile)).toBe(false);
  });

  it("returns all overlapping matches in input order and preserves duplicates", () => {
    const repo = path.join(tempDir, "repo");
    const query = path.join(repo, "src");
    const srcDir = path.join(repo, "src");
    const srcIndex = path.join(repo, "src", "index.ts");
    const srcNested = path.join(repo, "src", "nested", "deep.ts");
    const docs = path.join(repo, "docs", "readme.md");

    const result = matchingPaths(query, [docs, srcIndex, srcDir, srcNested, srcIndex]);

    expect(result).toEqual([
      toPosix(srcIndex),
      toPosix(srcDir),
      toPosix(srcNested),
      toPosix(srcIndex),
    ]);
  });

  it("handles empty file lists and rejects empty query paths", () => {
    const query = path.join(tempDir, "repo", "src", "index.ts");
    expect(matchingPaths(query, [])).toEqual([]);
    expect(() => matchingPaths("", [query])).toThrowError("path is required");
  });
});
