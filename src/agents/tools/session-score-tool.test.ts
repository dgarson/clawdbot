import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionScoreTool } from "./session-score-tool.js";

vi.mock("../../infra/diagnostic-events.js", () => ({
  emitDiagnosticEvent: vi.fn(),
}));

import { emitDiagnosticEvent } from "../../infra/diagnostic-events.js";

const mockedEmit = vi.mocked(emitDiagnosticEvent);

function firstTextContent(result: { content: { type: string; text?: string }[] }) {
  const item = result.content[0];
  return JSON.parse(item.text ?? "null");
}

describe("session_score tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has the correct tool name", () => {
    const tool = createSessionScoreTool({ agentId: "a1" });
    expect(tool.name).toBe("session_score");
  });

  it("emits diagnostic event with correct fields on valid score+rubric", async () => {
    const tool = createSessionScoreTool({
      agentId: "agent-1",
      sessionId: "sess-default",
    });

    await tool.execute("call-1", {
      score: 0.75,
      rubric: "task_completion",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit).toHaveBeenCalledWith({
      type: "session.score",
      sessionId: "sess-default",
      agentId: "agent-1",
      score: 0.75,
      rubric: "task_completion",
      tags: undefined,
      evaluatorId: "agent-1",
      data: undefined,
    });
  });

  it("clamps score > 1 to 1", async () => {
    const tool = createSessionScoreTool({ agentId: "a1", sessionId: "s1" });

    const result = await tool.execute("call-2", {
      score: 5.0,
      rubric: "quality",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({ score: 1 });

    const parsed = firstTextContent(result);
    expect(parsed.score).toBe(1);
  });

  it("clamps score < 0 to 0", async () => {
    const tool = createSessionScoreTool({ agentId: "a1", sessionId: "s1" });

    const result = await tool.execute("call-3", {
      score: -2.5,
      rubric: "quality",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({ score: 0 });

    const parsed = firstTextContent(result);
    expect(parsed.score).toBe(0);
  });

  it("returns error when rubric is empty string", async () => {
    const tool = createSessionScoreTool({ agentId: "a1" });

    const result = await tool.execute("call-4", {
      score: 0.5,
      rubric: "",
    });

    const parsed = firstTextContent(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("rubric is required");
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("returns error when rubric is whitespace-only", async () => {
    const tool = createSessionScoreTool({ agentId: "a1" });

    const result = await tool.execute("call-5", {
      score: 0.5,
      rubric: "   \t  ",
    });

    const parsed = firstTextContent(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("rubric is required");
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("uses param sessionId over default when provided", async () => {
    const tool = createSessionScoreTool({
      agentId: "a1",
      sessionId: "default-session",
    });

    await tool.execute("call-6", {
      score: 0.9,
      rubric: "code_correctness",
      sessionId: "override-session",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({
      sessionId: "override-session",
    });
  });

  it("uses default sessionId when param sessionId is omitted", async () => {
    const tool = createSessionScoreTool({
      agentId: "a1",
      sessionId: "default-session",
    });

    await tool.execute("call-7", {
      score: 0.6,
      rubric: "response_quality",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({
      sessionId: "default-session",
    });
  });

  it("passes tags to diagnostic event", async () => {
    const tool = createSessionScoreTool({ agentId: "a1", sessionId: "s1" });
    const tags = ["correct", "efficient", "no_hallucination"];

    await tool.execute("call-8", {
      score: 0.85,
      rubric: "tool_selection",
      tags,
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({ tags });

    const result = await tool.execute("call-8b", {
      score: 0.85,
      rubric: "tool_selection",
      tags,
    });
    const parsed = firstTextContent(result);
    expect(parsed.tags).toEqual(tags);
  });

  it("includes note in data field when provided", async () => {
    const tool = createSessionScoreTool({ agentId: "a1", sessionId: "s1" });

    await tool.execute("call-9", {
      score: 0.7,
      rubric: "response_quality",
      note: "Slightly verbose but accurate",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({
      data: { note: "Slightly verbose but accurate" },
    });
  });

  it("omits data field when note is not provided", async () => {
    const tool = createSessionScoreTool({ agentId: "a1", sessionId: "s1" });

    await tool.execute("call-10", {
      score: 0.8,
      rubric: "task_completion",
    });

    expect(mockedEmit).toHaveBeenCalledOnce();
    expect(mockedEmit.mock.calls[0][0]).toMatchObject({
      data: undefined,
    });
  });
});
