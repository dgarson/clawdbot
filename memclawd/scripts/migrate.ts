import { createHash } from "node:crypto";

const fingerprint = createHash("sha256").update(new Date().toISOString()).digest("hex");

console.log(`MemClawd migrate stub: ${fingerprint}`);
