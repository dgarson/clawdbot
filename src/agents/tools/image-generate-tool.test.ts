import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createImageGenerateTool } from "./image-generate-tool.js";

describe("image-generate-tool", () => {
  const tool = createImageGenerateTool();

  it("has correct metadata", () => {
    expect(tool.name).toBe("image_generate");
    expect(tool.label).toBe("ImageGenerate");
    expect(tool.description).toContain("Generate an image");
    expect(tool.description).toContain("Gemini");
  });

  it("requires a prompt parameter", async () => {
    await expect(tool.execute("test-call", {})).rejects.toThrow("prompt required");
  });

  it("rejects empty prompt", async () => {
    await expect(tool.execute("test-call", { prompt: "   " })).rejects.toThrow("prompt required");
  });

  it("returns error for unsupported provider", async () => {
    const result = await tool.execute("test-call", {
      prompt: "A cat",
      provider: "dall-e",
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
    expect(text).toContain("Unsupported image generation provider");
    expect(text).toContain("dall-e");
  });

  it("returns error when GEMINI_API_KEY is not set", async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const result = await tool.execute("test-call", {
        prompt: "A cat",
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain("GEMINI_API_KEY");
    } finally {
      if (original) {
        process.env.GEMINI_API_KEY = original;
      }
    }
  });

  describe("with mocked fetch", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("successfully generates an image", async () => {
      // Mock a successful Gemini response with a small 1x1 pixel JPEG
      const tinyJpeg = Buffer.from(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM" +
          "DhEQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQU" +
          "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/" +
          "EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
        "base64",
      );

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: tinyJpeg.toString("base64"),
                    },
                  },
                  {
                    text: "Here is your cat image",
                  },
                ],
              },
            },
          ],
        }),
      } as Response);

      const result = await tool.execute("test-call", {
        prompt: "A fluffy cat",
        style: "watercolor",
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain("MEDIA:");
      expect(text).toContain(".jpg");
      expect(text).toContain("Generated image");
      expect(text).toContain("Here is your cat image");

      // Verify the file was created
      const mediaPath = text.split("\n")[0]?.replace("MEDIA:", "");
      if (mediaPath) {
        const exists = await fs
          .access(mediaPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
        // Clean up
        await fs.rm(mediaPath).catch(() => {});
      }

      // Verify fetch was called with correct URL
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("gemini-3-pro-image-preview");
      expect(fetchCall[0]).toContain("generateContent");

      // Verify prompt includes style
      const body = JSON.parse(fetchCall[1].body);
      expect(body.contents[0].parts[0].text).toContain("A fluffy cat");
      expect(body.contents[0].parts[0].text).toContain("watercolor");
    });

    it("handles Gemini API error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      } as Response);

      const result = await tool.execute("test-call", {
        prompt: "A cat",
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain("Image generation failed");
      expect(text).toContain("429");
    });

    it("handles Gemini response with no image", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "I cannot generate that image",
                  },
                ],
              },
            },
          ],
        }),
      } as Response);

      const result = await tool.execute("test-call", {
        prompt: "Something inappropriate",
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain("Image generation failed");
      expect(text).toContain("did not return an image");
    });

    it("saves to custom output path", async () => {
      const tinyPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: tinyPng.toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      } as Response);

      const outputPath = path.join("/tmp", `test-image-gen-${Date.now()}.png`);
      const result = await tool.execute("test-call", {
        prompt: "A dot",
        outputPath,
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain(`MEDIA:${outputPath}`);

      // Verify file exists at custom path
      const exists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Clean up
      await fs.rm(outputPath).catch(() => {});
    });

    it("includes aspect ratio in prompt", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: Buffer.from("fake").toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      } as Response);

      await tool.execute("test-call", {
        prompt: "A landscape",
        aspectRatio: "16:9",
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.contents[0].parts[0].text).toContain("16:9");
    });
  });
});
