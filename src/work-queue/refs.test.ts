/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import {
  formatRef,
  hasExternalTaskRef,
  isExternalTaskRefKind,
  parseRef,
  readRefs,
  resolveRef,
  validateRef,
} from "./refs.js";

const sampleRef = { kind: "work:item", id: "item-123" } as const;

describe("work queue refs", () => {
  it("formats and parses refs", () => {
    const uri = formatRef(sampleRef);
    expect(uri).toBe("oc://work:item/item-123");

    const parsed = parseRef(uri);
    expect(parsed).toEqual({ ...sampleRef, uri });
  });

  it("identifies external task ref kinds", () => {
    expect(isExternalTaskRefKind("external:codex-task")).toBe(true);
    expect(isExternalTaskRefKind("external:claude-task")).toBe(true);
    expect(isExternalTaskRefKind("work:item")).toBe(false);
    expect(isExternalTaskRefKind("codex-web:task")).toBe(false);
  });

  it("detects external task refs in payload", () => {
    expect(
      hasExternalTaskRef({
        refs: [
          {
            kind: "external:codex-task",
            id: "crn:v1:codex-web:global:task:task_abc",
            uri: "https://chatgpt.com/codex/tasks/task_abc",
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasExternalTaskRef({
        refs: [
          {
            kind: "external:claude-task",
            id: "crn:v1:claude-web:global:task:conv_123",
            uri: "https://claude.ai/chat/conv_123",
          },
        ],
      }),
    ).toBe(true);

    // Non-external refs should not be detected
    expect(
      hasExternalTaskRef({
        refs: [{ kind: "work:item", id: "item-1" }],
      }),
    ).toBe(false);

    // No refs at all
    expect(hasExternalTaskRef({})).toBe(false);
    expect(hasExternalTaskRef(undefined)).toBe(false);
  });

  it("validates external refs with external URLs", () => {
    expect(
      validateRef({
        kind: "external:codex-task",
        id: "crn:v1:codex-web:global:task:task_abc",
        uri: "https://chatgpt.com/codex/tasks/task_abc",
      }),
    ).toBe(true);

    expect(
      validateRef({
        kind: "external:claude-task",
        id: "crn:v1:claude-web:global:task:conv_123",
        uri: "https://claude.ai/chat/conv_123",
      }),
    ).toBe(true);
  });

  it("validates refs and rejects bad input", () => {
    expect(validateRef({ kind: "work:queue", id: "queue-1" })).toBe(true);
    expect(validateRef({ kind: "unknown", id: "x" } as any)).toBe(false);
    expect(() => parseRef("not-a-uri")).toThrow("Invalid ref URI");
    expect(validateRef({ kind: "work:item", id: "item", uri: "oc://work:item/other" })).toBe(false);
  });

  it("reads refs from payload", () => {
    const payload = {
      refs: [
        { kind: "work:item", id: "item-1" },
        { kind: "unknown", id: "bad" },
      ],
    };
    const refs = readRefs(payload);
    expect(refs).toEqual([{ kind: "work:item", id: "item-1" }]);
  });

  it("resolves refs via context and fallbacks", async () => {
    const workQueueStore = {
      getItem: vi.fn().mockResolvedValue({ id: "item-1" }),
      getQueue: vi.fn().mockResolvedValue({ id: "queue-1" }),
    };
    const memoryStore = {
      getById: vi.fn().mockReturnValue({ id: "mem-1" }),
    };

    const itemResult = await resolveRef({ kind: "work:item", id: "item-1" }, { workQueueStore });
    expect(itemResult).toEqual({ id: "item-1" });

    const queueResult = await resolveRef({ kind: "work:queue", id: "queue-1" }, { workQueueStore });
    expect(queueResult).toEqual({ id: "queue-1" });

    const memoryResult = await resolveRef(
      { kind: "memory:entry", id: "mem-1" },
      { progressiveMemoryStore: memoryStore },
    );
    expect(memoryResult).toEqual({ id: "mem-1" });

    const customResolver = vi.fn().mockResolvedValue({ ok: true });
    const customResult = await resolveRef(
      { kind: "session", id: "session-1" },
      { resolvers: { session: customResolver } },
    );
    expect(customResolver).toHaveBeenCalled();
    expect(customResult).toEqual({ ok: true });
  });
});
