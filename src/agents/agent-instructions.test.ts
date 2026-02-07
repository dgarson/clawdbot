import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { resolveAgentInstructions, buildAgentInstructionsSection } from "./agent-instructions.js";

describe("resolveAgentInstructions", () => {
  it("returns undefined when no instructions provided", () => {
    expect(resolveAgentInstructions(undefined, "/tmp")).toBeUndefined();
  });

  it("returns undefined when instructions are empty", () => {
    expect(resolveAgentInstructions({}, "/tmp")).toBeUndefined();
  });

  it("returns text from inline text", () => {
    const result = resolveAgentInstructions({ text: "Do the thing" }, "/tmp");
    expect(result).toBeDefined();
    expect(result!.text).toBe("Do the thing");
  });

  it("returns role from config", () => {
    const result = resolveAgentInstructions({ role: "Code reviewer" }, "/tmp");
    expect(result).toBeDefined();
    expect(result!.role).toBe("Code reviewer");
    expect(result!.text).toBe("");
  });

  it("returns constraints from config", () => {
    const result = resolveAgentInstructions(
      { constraints: ["No external APIs", "Max 100 lines"] },
      "/tmp",
    );
    expect(result).toBeDefined();
    expect(result!.constraints).toEqual(["No external APIs", "Max 100 lines"]);
  });

  it("returns outputFormat from config", () => {
    const result = resolveAgentInstructions({ outputFormat: "JSON only" }, "/tmp");
    expect(result).toBeDefined();
    expect(result!.outputFormat).toBe("JSON only");
  });

  it("loads file-based instructions", () => {
    const spy = vi.spyOn(fs, "readFileSync").mockReturnValue("File instructions here");
    const result = resolveAgentInstructions({ file: "instructions.md" }, "/tmp/agent");
    expect(result).toBeDefined();
    expect(result!.text).toBe("File instructions here");
    expect(spy).toHaveBeenCalledWith("/tmp/agent/instructions.md", "utf-8");
    spy.mockRestore();
  });

  it("merges file and inline text", () => {
    const spy = vi.spyOn(fs, "readFileSync").mockReturnValue("From file");
    const result = resolveAgentInstructions(
      { file: "instructions.md", text: "From config" },
      "/tmp/agent",
    );
    expect(result).toBeDefined();
    expect(result!.text).toBe("From file\n\nFrom config");
    spy.mockRestore();
  });

  it("ignores missing file gracefully", () => {
    const spy = vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const result = resolveAgentInstructions(
      { file: "missing.md", text: "Fallback text" },
      "/tmp/agent",
    );
    expect(result).toBeDefined();
    expect(result!.text).toBe("Fallback text");
    spy.mockRestore();
  });

  it("filters empty constraints", () => {
    const result = resolveAgentInstructions(
      { constraints: ["Valid", "", "  ", "Also valid"] },
      "/tmp",
    );
    expect(result!.constraints).toEqual(["Valid", "Also valid"]);
  });
});

describe("buildAgentInstructionsSection", () => {
  it("builds a section with all fields", () => {
    const section = buildAgentInstructionsSection({
      text: "Do the task",
      role: "Worker agent",
      constraints: ["No side effects", "Stay focused"],
      outputFormat: "JSON",
    });
    expect(section).toContain("## Instructions");
    expect(section).toContain("**Role:** Worker agent");
    expect(section).toContain("Do the task");
    expect(section).toContain("- No side effects");
    expect(section).toContain("- Stay focused");
    expect(section).toContain("**Output Format:** JSON");
  });

  it("builds a section with text only", () => {
    const section = buildAgentInstructionsSection({
      text: "Just do it",
    });
    expect(section).toContain("## Instructions");
    expect(section).toContain("Just do it");
    expect(section).not.toContain("**Role:**");
    expect(section).not.toContain("**Constraints:**");
    expect(section).not.toContain("**Output Format:**");
  });
});
