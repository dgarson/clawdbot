import { describe, expect, it } from "vitest";
import { createSlackInteractiveConfirmationTool } from "./interactive-confirmation-tool.js";

describe("createSlackInteractiveConfirmationTool", () => {
  it("creates a tool with correct name and description", () => {
    const tool = createSlackInteractiveConfirmationTool();

    expect(tool.name).toBe("AskSlackConfirmation");
    expect(tool.label).toBe("Ask Slack Confirmation");
    expect(tool.description).toContain("Yes/No confirmation");
    expect(tool.description).toContain("WAIT");
    expect(tool.description).toContain("BLOCKS");
  });

  it("has correct parameter schema", () => {
    const tool = createSlackInteractiveConfirmationTool();
    const params = tool.parameters as { properties: Record<string, unknown> };

    expect(params.properties).toHaveProperty("to");
    expect(params.properties).toHaveProperty("title");
    expect(params.properties).toHaveProperty("message");
    expect(params.properties).toHaveProperty("confirmLabel");
    expect(params.properties).toHaveProperty("cancelLabel");
    expect(params.properties).toHaveProperty("style");
    expect(params.properties).toHaveProperty("timeoutSeconds");
    expect(params.properties).toHaveProperty("threadTs");
  });
});
