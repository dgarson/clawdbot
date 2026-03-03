/**
 * Policy CRUD: load/save routing policies and prompt contributors from JSON in stateDir.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PromptContributor, RoutingPolicy } from "./types.js";

// ---------------------------------------------------------------------------
// Routing Policies
// ---------------------------------------------------------------------------

export function loadPolicies(filePath: string): RoutingPolicy[] {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidPolicy);
  } catch {
    return [];
  }
}

export function savePolicies(filePath: string, policies: RoutingPolicy[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(policies, null, 2), "utf-8");
}

function isValidPolicy(value: unknown): value is RoutingPolicy {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    Array.isArray(obj.conditions) &&
    typeof obj.priority === "number" &&
    typeof obj.target === "object" &&
    obj.target !== null
  );
}

// ---------------------------------------------------------------------------
// Prompt Contributors
// ---------------------------------------------------------------------------

export function loadContributors(filePath: string): PromptContributor[] {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidContributor);
  } catch {
    return [];
  }
}

export function saveContributors(filePath: string, contributors: PromptContributor[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(contributors, null, 2), "utf-8");
}

function isValidContributor(value: unknown): value is PromptContributor {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.priority === "number" &&
    Array.isArray(obj.conditions) &&
    typeof obj.optional === "boolean" &&
    typeof obj.content === "string"
  );
}
