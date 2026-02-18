import { describe, expect, it } from "vitest";
import { button, plainText, mrkdwn, section, actions } from "./builders.js";

describe("Block Kit builders", () => {
  it("creates a plainText object", () => {
    const result = plainText("Hello");
    expect(result).toMatchObject({ type: "plain_text", text: "Hello" });
  });

  it("creates a mrkdwn object", () => {
    const result = mrkdwn("*bold*");
    expect(result).toMatchObject({ type: "mrkdwn", text: "*bold*" });
  });

  it("normalizes escaped newlines from LLM output", () => {
    const result = plainText("line1\\nline2");
    expect(result.text).toBe("line1\nline2");
  });

  it("creates a button element", () => {
    const result = button({ text: "Click", actionId: "btn_1", value: "clicked" });
    expect(result.type).toBe("button");
    expect(result.action_id).toBe("btn_1");
    expect(result.text).toMatchObject({ type: "plain_text", text: "Click" });
  });

  it("creates a section block", () => {
    const result = section({ text: mrkdwn("Hello") });
    expect(result.type).toBe("section");
  });

  it("creates an actions block", () => {
    const btn = button({ text: "Go", actionId: "go" });
    const result = actions({ elements: [btn] });
    expect(result.type).toBe("actions");
    expect(result.elements).toHaveLength(1);
  });
});
