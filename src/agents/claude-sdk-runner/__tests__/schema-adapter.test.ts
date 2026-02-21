/**
 * Schema Adapter Contract Tests
 *
 * Derived from: implementation-plan.md Section 4.3.1 (TypeBox → Zod conversion, supported types list),
 * pi-runtime-baseline.md Section 4.3 (all OpenClaw tools use TypeBox schemas with standard JSON Schema types).
 *
 * These tests verify TypeBox → Zod conversion for every type used by OpenClaw tools.
 * Tests are written before implementation (contract-first).
 */

import { Type } from "@sinclair/typebox";
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { typeboxPropertyToZod, typeboxToZod } from "../schema-adapter.js";

describe("typeboxPropertyToZod", () => {
  it("converts Type.String() to z.string()", () => {
    const schema = Type.String();
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse("hello")).toBe("hello");
    expect(() => zodType.parse(42)).toThrow();
  });

  it("converts Type.Number() to z.number()", () => {
    const schema = Type.Number();
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse(42)).toBe(42);
    expect(() => zodType.parse("hello")).toThrow();
  });

  it("converts Type.Boolean() to z.boolean()", () => {
    const schema = Type.Boolean();
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse(true)).toBe(true);
    expect(() => zodType.parse("true")).toThrow();
  });

  it("converts Type.Optional(Type.String()) to z.string().optional()", () => {
    const schema = Type.Optional(Type.String());
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse("hello")).toBe("hello");
    expect(zodType.parse(undefined)).toBeUndefined();
    expect(() => zodType.parse(42)).toThrow();
  });

  it("converts Type.Array(Type.String()) to z.array(z.string())", () => {
    const schema = Type.Array(Type.String());
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse(["a", "b"])).toEqual(["a", "b"]);
    expect(() => zodType.parse([1, 2])).toThrow();
  });

  it("converts Type.Literal to z.literal()", () => {
    const schema = Type.Literal("specific_value");
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse("specific_value")).toBe("specific_value");
    expect(() => zodType.parse("other_value")).toThrow();
  });

  it("converts Type.Union([Type.String(), Type.Number()]) to z.union()", () => {
    const schema = Type.Union([Type.String(), Type.Number()]);
    const zodType = typeboxPropertyToZod(schema);
    expect(zodType.parse("hello")).toBe("hello");
    expect(zodType.parse(42)).toBe(42);
    expect(() => zodType.parse(true)).toThrow();
  });

  it("preserves description annotations", () => {
    const schema = Type.String({ description: "File path" });
    const zodType = typeboxPropertyToZod(schema);
    // Description should be attached — z.ZodType has a .description property
    expect(zodType.description).toBe("File path");
  });

  it("converts nested Type.Object", () => {
    const innerSchema = Type.Object({ x: Type.Number(), y: Type.Number() });
    const zodType = typeboxPropertyToZod(innerSchema);
    expect(zodType.parse({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => zodType.parse({ x: "a", y: 2 } as any)).toThrow();
  });
});

describe("typeboxToZod", () => {
  it("converts Type.Object with multiple properties to Zod shape", () => {
    const schema = Type.Object({
      name: Type.String(),
      age: Type.Number(),
    });
    const shape = typeboxToZod(schema);
    const zodObj = z.object(shape);
    expect(zodObj.parse({ name: "Alice", age: 30 })).toEqual({ name: "Alice", age: 30 });
    expect(() => zodObj.parse({ name: 42, age: "thirty" })).toThrow();
  });

  it("converts Type.Object with required and optional fields", () => {
    const schema = Type.Object({
      path: Type.String(),
      line: Type.Optional(Type.Number()),
    });
    const shape = typeboxToZod(schema);
    const zodObj = z.object(shape);
    // Required field only
    expect(zodObj.parse({ path: "foo.ts" })).toMatchObject({ path: "foo.ts" });
    // With optional field
    expect(zodObj.parse({ path: "foo.ts", line: 42 })).toEqual({ path: "foo.ts", line: 42 });
  });

  it("preserves description annotations on properties", () => {
    const schema = Type.Object({
      path: Type.String({ description: "File path to read" }),
    });
    const shape = typeboxToZod(schema);
    expect((shape.path as { description?: string }).description).toBe("File path to read");
  });

  it("returns a valid Zod shape for empty object", () => {
    const schema = Type.Object({});
    const shape = typeboxToZod(schema);
    expect(shape).toBeDefined();
    expect(typeof shape).toBe("object");
  });

  it("falls back gracefully for non-object schemas", () => {
    // Should not throw — returns a fallback shape
    const schema = Type.String(); // Not a TObject
    const shape = typeboxToZod(schema);
    expect(shape).toBeDefined();
  });
});
