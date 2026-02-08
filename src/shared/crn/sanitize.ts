import { CONTROL_CHAR_RE } from "./constants.js";
import { CrnError } from "./errors.js";

export function trimCrnInput(input: string): string {
  return input.trim();
}

export function assertNoControlChars(value: string, label: string): void {
  if (CONTROL_CHAR_RE.test(value)) {
    throw new CrnError("invalid_format", `${label} contains control characters`, { value });
  }
}
