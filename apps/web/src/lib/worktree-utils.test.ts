import { describe, expect, it } from "vitest";
import { buildWorktreeTree, mapWorktreeError } from "./worktree-utils";
import type { WorktreeEntry } from "@/integrations/worktree";

describe("buildWorktreeTree", () => {
  it("builds nested folders and sorts folders before files", () => {
    const entries: WorktreeEntry[] = [
      { path: "/src", name: "src", kind: "dir" },
      { path: "/src/index.ts", name: "index.ts", kind: "file" },
      { path: "/README.md", name: "README.md", kind: "file" },
      { path: "/logs", name: "logs", kind: "dir" },
      { path: "/logs/app.log", name: "app.log", kind: "file" },
    ];

    const tree = buildWorktreeTree(entries);
    expect(tree.map((node) => node.name)).toEqual(["logs", "src", "README.md"]);
    const src = tree.find((node) => node.name === "src");
    expect(src?.children?.map((node) => node.name)).toEqual(["index.ts"]);
  });
});

describe("mapWorktreeError", () => {
  it("maps gateway disconnects to a clear message", () => {
    const info = mapWorktreeError(new Error("Not connected to gateway"));
    expect(info.title).toBe("Gateway disconnected");
  });

  it("maps known error codes", () => {
    const info = mapWorktreeError({ code: "FILE_NOT_FOUND", message: "File not found" });
    expect(info.title).toBe("File not found");
    expect(info.message).toContain("no longer exists");
  });
});
