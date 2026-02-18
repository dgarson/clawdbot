import { describe, expect, it } from "vitest";
import type {
  InteractivePromptQuestion,
  InteractivePromptConfirmation,
  InteractivePromptResponse,
} from "./types.interactive.js";

describe("Interactive prompt types", () => {
  it("InteractivePromptQuestion is structurally valid", () => {
    const question: InteractivePromptQuestion = {
      id: "q1",
      text: "Pick one",
      options: [{ value: "a", label: "Option A" }],
    };
    expect(question.id).toBe("q1");
    expect(question.options).toHaveLength(1);
  });

  it("InteractivePromptConfirmation is structurally valid", () => {
    const confirmation: InteractivePromptConfirmation = {
      id: "c1",
      title: "Approve?",
      message: "Deploy to production?",
    };
    expect(confirmation.id).toBe("c1");
  });

  it("InteractivePromptResponse has expected shape", () => {
    const response: InteractivePromptResponse = {
      answered: true,
      timedOut: false,
      selectedValues: ["approve"],
      respondedBy: { id: "U123", name: "alice" },
      timestamp: Date.now(),
    };
    expect(response.answered).toBe(true);
    expect(response.selectedValues).toContain("approve");
  });
});
