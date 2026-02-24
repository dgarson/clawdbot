import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { RouterFeedbackLoopStore } from "./feedback-loop.js";

const storeCache = new Map<string, RouterFeedbackLoopStore>();

export function resolveDefaultRouterFeedbackStoreDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "router-feedback");
}

export function getRouterFeedbackLoopStore(baseDir?: string): RouterFeedbackLoopStore {
  const resolvedDir = path.resolve(baseDir ?? resolveDefaultRouterFeedbackStoreDir());
  const existing = storeCache.get(resolvedDir);
  if (existing) {
    return existing;
  }
  const store = new RouterFeedbackLoopStore(resolvedDir);
  storeCache.set(resolvedDir, store);
  return store;
}

export function resetRouterFeedbackLoopStoreForTest(): void {
  storeCache.clear();
}
