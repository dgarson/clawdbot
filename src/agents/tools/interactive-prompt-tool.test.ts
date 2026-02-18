import { describe, expect, it } from "vitest";
import { createInteractivePromptTool } from "./interactive-prompt-tool.js";

describe("Interactive prompt tool", () => {
  it("creates a tool with correct name and schema", () => {
    const tool = createInteractivePromptTool();
    expect(tool.name).toBe("ask_question");
    expect(tool.label).toBe("Ask Question");
    expect(tool.parameters).toBeDefined();
  });
});
