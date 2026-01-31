/**
 * Tests for JSON Schema to Zod conversion.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { jsonSchemaToZod, jsonSchemaToZodRawShape } from "./schema.js";

describe("jsonSchemaToZod", () => {
  describe("basic types", () => {
    it("converts string type", () => {
      const schema = { type: "string" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("hello")).toBe("hello");
      expect(() => zod.parse(123)).toThrow();
    });

    it("converts number type", () => {
      const schema = { type: "number" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(42)).toBe(42);
      expect(zod.parse(3.14)).toBe(3.14);
      expect(() => zod.parse("not a number")).toThrow();
    });

    it("converts integer type", () => {
      const schema = { type: "integer" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(42)).toBe(42);
      expect(() => zod.parse(3.14)).toThrow(); // Not an integer
      expect(() => zod.parse("42")).toThrow();
    });

    it("converts boolean type", () => {
      const schema = { type: "boolean" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(true)).toBe(true);
      expect(zod.parse(false)).toBe(false);
      expect(() => zod.parse("true")).toThrow();
    });

    it("converts null type", () => {
      const schema = { type: "null" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(null)).toBe(null);
      expect(() => zod.parse(undefined)).toThrow();
    });

    it("returns z.any() for undefined schema", () => {
      const zod = jsonSchemaToZod(undefined);
      expect(zod.parse("anything")).toBe("anything");
      expect(zod.parse(123)).toBe(123);
      expect(zod.parse({ foo: "bar" })).toEqual({ foo: "bar" });
    });

    it("returns z.any() for unknown type", () => {
      const schema = { type: "unknown_type" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("anything")).toBe("anything");
    });
  });

  describe("string constraints", () => {
    it("applies minLength constraint", () => {
      const schema = { type: "string", minLength: 3 };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("abc")).toBe("abc");
      expect(() => zod.parse("ab")).toThrow();
    });

    it("applies maxLength constraint", () => {
      const schema = { type: "string", maxLength: 5 };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("hello")).toBe("hello");
      expect(() => zod.parse("toolong")).toThrow();
    });

    it("applies both min and max length", () => {
      const schema = { type: "string", minLength: 2, maxLength: 4 };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("abc")).toBe("abc");
      expect(() => zod.parse("a")).toThrow();
      expect(() => zod.parse("abcde")).toThrow();
    });

    it("preserves description on string", () => {
      const schema = { type: "string", description: "A test string" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.description).toBe("A test string");
    });
  });

  describe("array type", () => {
    it("converts array with items schema", () => {
      const schema = { type: "array", items: { type: "string" } };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
      expect(() => zod.parse([1, 2, 3])).toThrow();
    });

    it("converts array with nested object items", () => {
      const schema = {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse([{ name: "Alice" }, { name: "Bob" }])).toEqual([
        { name: "Alice" },
        { name: "Bob" },
      ]);
    });

    it("uses z.any() for array without items", () => {
      const schema = { type: "array" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse([1, "two", { three: 3 }])).toEqual([1, "two", { three: 3 }]);
    });
  });

  describe("object type", () => {
    it("converts simple object schema", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name"],
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse({ name: "Alice", age: 30 })).toEqual({ name: "Alice", age: 30 });
      expect(zod.parse({ name: "Bob" })).toEqual({ name: "Bob" });
      expect(() => zod.parse({ age: 25 })).toThrow(); // Missing required name
    });

    it("infers object type from properties without explicit type", () => {
      const schema = {
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse({ id: "123" })).toEqual({ id: "123" });
    });

    it("handles nested objects", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
        required: ["user"],
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse({ user: { name: "Alice" } })).toEqual({ user: { name: "Alice" } });
    });

    it("applies strict mode when additionalProperties is false", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: false,
      };
      const zod = jsonSchemaToZod(schema);
      expect(() => zod.parse({ name: "Alice", extra: "field" })).toThrow();
    });

    it("allows additional properties by default (passthrough)", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse({ name: "Alice", extra: "field" })).toEqual({
        name: "Alice",
        extra: "field",
      });
    });
  });

  describe("enum and const", () => {
    it("converts string enum", () => {
      const schema = { enum: ["red", "green", "blue"] };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("red")).toBe("red");
      expect(zod.parse("green")).toBe("green");
      expect(() => zod.parse("yellow")).toThrow();
    });

    it("converts mixed enum with literals", () => {
      const schema = { enum: ["auto", 0, 1, 2] };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("auto")).toBe("auto");
      expect(zod.parse(0)).toBe(0);
      expect(zod.parse(2)).toBe(2);
      expect(() => zod.parse(3)).toThrow();
    });

    it("converts single-value enum", () => {
      const schema = { enum: ["only"] };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("only")).toBe("only");
      expect(() => zod.parse("other")).toThrow();
    });

    it("converts const value", () => {
      const schema = { const: "fixed" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("fixed")).toBe("fixed");
      expect(() => zod.parse("other")).toThrow();
    });

    it("converts numeric const", () => {
      const schema = { const: 42 };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(42)).toBe(42);
      expect(() => zod.parse(43)).toThrow();
    });

    it("returns z.any() for empty enum", () => {
      const schema = { enum: [] };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("anything")).toBe("anything");
    });
  });

  describe("nullable types", () => {
    it("handles anyOf with null", () => {
      const schema = {
        anyOf: [{ type: "string" }, { type: "null" }],
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("hello")).toBe("hello");
      expect(zod.parse(null)).toBe(null);
    });

    it("handles oneOf with null", () => {
      const schema = {
        oneOf: [{ type: "number" }, { type: "null" }],
      };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse(42)).toBe(42);
      expect(zod.parse(null)).toBe(null);
    });

    it("handles type array with null", () => {
      const schema = { type: ["string", "null"] };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("hello")).toBe("hello");
      expect(zod.parse(null)).toBe(null);
    });

    it("returns z.any() for type array with multiple non-null types", () => {
      const schema = { type: ["string", "number"] };
      const zod = jsonSchemaToZod(schema);
      expect(zod.parse("hello")).toBe("hello");
      expect(zod.parse(42)).toBe(42);
    });
  });

  describe("descriptions", () => {
    it("preserves description on number", () => {
      const schema = { type: "number", description: "A count" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.description).toBe("A count");
    });

    it("preserves description on integer", () => {
      const schema = { type: "integer", description: "An ID" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.description).toBe("An ID");
    });

    it("preserves description on boolean", () => {
      const schema = { type: "boolean", description: "A flag" };
      const zod = jsonSchemaToZod(schema);
      expect(zod.description).toBe("A flag");
    });
  });
});

describe("jsonSchemaToZodRawShape", () => {
  it("returns empty shape for undefined schema", () => {
    const shape = jsonSchemaToZodRawShape(undefined);
    expect(shape).toEqual({});
  });

  it("returns empty shape for non-object schema", () => {
    const shape = jsonSchemaToZodRawShape({ type: "string" } as Record<string, unknown>);
    expect(shape).toEqual({});
  });

  it("converts object properties to Zod shape", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "integer" },
      },
      required: ["name"],
    };
    const shape = jsonSchemaToZodRawShape(schema);

    // name should be required (not optional)
    const nameResult = shape.name.safeParse("Alice");
    expect(nameResult.success).toBe(true);
    if (nameResult.success) {
      expect(nameResult.data).toBe("Alice");
    }

    // count should be optional
    const countResult = shape.count.safeParse(undefined);
    expect(countResult.success).toBe(true);
  });

  it("makes non-required properties optional", () => {
    const schema = {
      properties: {
        optional: { type: "string" },
      },
    };
    const shape = jsonSchemaToZodRawShape(schema);

    // Should accept undefined
    const result = shape.optional.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("can be used to create z.object()", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "string" },
        value: { type: "number" },
      },
      required: ["id"],
    };
    const shape = jsonSchemaToZodRawShape(schema);
    const zod = z.object(shape);

    expect(zod.parse({ id: "abc", value: 42 })).toEqual({ id: "abc", value: 42 });
    expect(zod.parse({ id: "abc" })).toEqual({ id: "abc" });
    expect(() => zod.parse({ value: 42 })).toThrow(); // Missing required id
  });
});
