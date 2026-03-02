import node_crypto from "node:crypto";
import node_fs from "node:fs";
import node_path from "node:path";
import type { BlobRef } from "./types.js";

/**
 * Writes large content to blob files in the telemetry blobs/ directory and
 * returns a BlobRef that can be embedded in a TelemetryEvent.
 *
 * Blob files are named `<id>.blob` and live under `<baseDir>/blobs/`.
 */
export class BlobWriter {
  private readonly blobsDir: string;

  constructor(baseDir: string) {
    this.blobsDir = node_path.join(baseDir, "blobs");
  }

  /**
   * Ensure the blobs directory exists. Call once during plugin start.
   */
  ensureDir(): void {
    node_fs.mkdirSync(this.blobsDir, { recursive: true });
  }

  /**
   * Serialize `content` and write it to a blob file.
   * Returns a BlobRef describing the stored blob.
   *
   * @param content - the value to externalize (serialized to JSON if not a string)
   * @param role - optional label ("input" | "result") for human-readability
   */
  write(content: unknown, role?: string): BlobRef {
    const id = `blob_${node_crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const filePath = node_path.join(this.blobsDir, `${id}.blob`);

    const serialized = typeof content === "string" ? content : JSON.stringify(content, null, 0);
    const buffer = Buffer.from(serialized, "utf8");
    const hash = node_crypto.createHash("sha256").update(buffer).digest("hex");

    node_fs.writeFileSync(filePath, buffer);

    const ref: BlobRef = {
      id,
      path: filePath,
      size: buffer.byteLength,
      hash,
    };
    if (role) {
      ref.role = role;
    }
    return ref;
  }
}
