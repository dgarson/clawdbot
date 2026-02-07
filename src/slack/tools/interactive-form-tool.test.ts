import { describe, expect, it } from "vitest";
import { createSlackInteractiveFormTool } from "./interactive-form-tool.js";

describe("createSlackInteractiveFormTool", () => {
  it("creates a tool with correct name and description", () => {
    const tool = createSlackInteractiveFormTool();

    expect(tool.name).toBe("AskSlackForm");
    expect(tool.label).toBe("Ask Slack Form");
    expect(tool.description).toContain("Collect structured data");
    expect(tool.description).toContain("WAIT");
    expect(tool.description).toContain("BLOCKS");
  });

  it("has correct parameter schema", () => {
    const tool = createSlackInteractiveFormTool();
    const params = tool.parameters as { properties: Record<string, unknown> };

    expect(params.properties).toHaveProperty("to");
    expect(params.properties).toHaveProperty("title");
    expect(params.properties).toHaveProperty("description");
    expect(params.properties).toHaveProperty("fields");
    expect(params.properties).toHaveProperty("submitLabel");
    expect(params.properties).toHaveProperty("timeoutSeconds");
    expect(params.properties).toHaveProperty("threadTs");
  });
});
