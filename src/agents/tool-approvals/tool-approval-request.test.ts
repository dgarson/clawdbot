import { describe, expect, it } from "vitest";
import { summarizeToolParams, __testing } from "./tool-approval-request.js";

const { shouldRedactKey, redactSensitiveValues } = __testing;

describe("shouldRedactKey", () => {
  it.each([
    "token",
    "apiToken",
    "password",
    "secret",
    "api_key",
    "apiKey",
    "auth",
    "cookie",
    "credential",
    "private_key",
    "access_key",
    "session_id",
    "bearer",
    "Authorization",
    "COOKIE",
    "API_KEY",
  ])("redacts key: %s", (key) => {
    expect(shouldRedactKey(key)).toBe(true);
  });

  it.each(["command", "path", "mode", "name", "description", "url", "cwd"])(
    "does not redact key: %s",
    (key) => {
      expect(shouldRedactKey(key)).toBe(false);
    },
  );
});

describe("redactSensitiveValues", () => {
  it("redacts sensitive values in flat object", () => {
    const result = redactSensitiveValues({
      command: "ls",
      token: "secret-value",
      path: "/tmp",
    });
    expect(result).toEqual({
      command: "ls",
      path: "/tmp",
      token: "[REDACTED]",
    });
  });

  it("redacts nested sensitive values", () => {
    const result = redactSensitiveValues({
      config: { password: "hunter2", host: "localhost" },
      name: "test",
    });
    expect(result).toEqual({
      config: { host: "localhost", password: "[REDACTED]" },
      name: "test",
    });
  });

  it("produces sorted keys", () => {
    const result = redactSensitiveValues({ z: 1, a: 2, m: 3 });
    expect(Object.keys(result)).toEqual(["a", "m", "z"]);
  });

  it("handles max depth", () => {
    const deep: Record<string, unknown> = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    const result = redactSensitiveValues(deep);
    // Should not throw, should truncate at depth 5
    expect(result).toBeDefined();
  });
});

describe("summarizeToolParams", () => {
  it("produces valid JSON", () => {
    const result = summarizeToolParams({ command: "ls -la", cwd: "/tmp" });
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.command).toBe("ls -la");
    expect(parsed.cwd).toBe("/tmp");
  });

  it("redacts sensitive params", () => {
    const result = summarizeToolParams({
      command: "curl",
      token: "abc123",
    });
    const parsed = JSON.parse(result);
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.command).toBe("curl");
  });

  it("truncates long output", () => {
    const longValue = "x".repeat(2000);
    const result = summarizeToolParams({ data: longValue }, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith("...")).toBe(true);
  });

  it("preserves output under the limit", () => {
    const result = summarizeToolParams({ a: "b" }, 1000);
    expect(result).toBe('{"a":"b"}');
  });
});
