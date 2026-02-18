import { describe, expect, it } from "vitest";
import { createInteractiveConfirmationTool } from "./interactive-confirmation-tool.js";

describe("Interactive confirmation tool", () => {
  it("creates a tool with correct name and schema", () => {
    const tool = createInteractiveConfirmationTool();
    expect(tool.name).toBe("ask_confirmation");
    expect(tool.label).toBe("Ask Confirmation");
    expect(tool.parameters).toBeDefined();
  });
});
