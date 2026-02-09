import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function wipeDir(dirPath: string): void {
  const resolved = path.resolve(dirPath);
  const root = path.parse(resolved).root;
  const home = path.resolve(os.homedir());

  if (!resolved || resolved === root) {
    throw new Error(`Refusing to wipe unsafe path: ${JSON.stringify(dirPath)}`);
  }
  if (resolved === home) {
    throw new Error(`Refusing to wipe home directory: ${JSON.stringify(dirPath)}`);
  }

  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
}
