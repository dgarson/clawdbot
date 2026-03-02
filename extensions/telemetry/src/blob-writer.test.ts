import node_crypto from "node:crypto";
import node_fs from "node:fs";
import node_os from "node:os";
import node_path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BlobWriter } from "./blob-writer.js";

describe("BlobWriter", () => {
  let tmpDir: string;
  let blobWriter: BlobWriter;

  beforeEach(() => {
    tmpDir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), "telemetry-blobs-"));
    blobWriter = new BlobWriter(tmpDir);
    blobWriter.ensureDir();
  });

  afterEach(() => {
    node_fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the blobs/ directory via ensureDir", () => {
    const blobsDir = node_path.join(tmpDir, "blobs");
    expect(node_fs.existsSync(blobsDir)).toBe(true);
  });

  it("writes a string blob and returns a BlobRef", () => {
    const ref = blobWriter.write("hello world", "result");

    expect(ref.id).toMatch(/^blob_[0-9a-f]{16}$/);
    expect(node_fs.existsSync(ref.path)).toBe(true);
    expect(ref.size).toBe(Buffer.byteLength("hello world", "utf8"));
    expect(ref.role).toBe("result");
    expect(typeof ref.hash).toBe("string");
    expect(ref.hash).toHaveLength(64); // sha256 hex
  });

  it("writes an object blob (serialized to JSON)", () => {
    const obj = { toolName: "read", filePath: "/src/foo.ts" };
    const ref = blobWriter.write(obj, "input");

    const content = node_fs.readFileSync(ref.path, "utf8");
    expect(JSON.parse(content)).toEqual(obj);
  });

  it("produces a correct sha256 hash", () => {
    const content = "deterministic content for hashing";
    const ref = blobWriter.write(content);

    const expected = node_crypto
      .createHash("sha256")
      .update(Buffer.from(content, "utf8"))
      .digest("hex");
    expect(ref.hash).toBe(expected);
  });

  it("generates unique IDs for each blob", () => {
    const refs = Array.from({ length: 20 }, (_, i) => blobWriter.write(`data-${i}`));
    const ids = new Set(refs.map((r) => r.id));
    expect(ids.size).toBe(20);
  });

  it("file path ends with .blob", () => {
    const ref = blobWriter.write("test");
    expect(ref.path.endsWith(".blob")).toBe(true);
  });

  it("omits role when not provided", () => {
    const ref = blobWriter.write("test");
    expect(ref.role).toBeUndefined();
  });
});
