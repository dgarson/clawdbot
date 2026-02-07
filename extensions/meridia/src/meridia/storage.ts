import fs from "node:fs/promises";
import path from "node:path";
import { dateKeyUtc } from "./paths.js";

export async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf-8");
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code) {
      if ((err as { code?: string }).code === "ENOENT") {
        return null;
      }
    }
    throw err;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export function resolveTraceJsonlPath(params: { meridiaDir: string; date?: Date }): string {
  const dateKey = dateKeyUtc(params.date ?? new Date());
  return path.join(params.meridiaDir, "trace", `${dateKey}.jsonl`);
}
