import { Type } from "@sinclair/typebox";

import { optionalStringEnum, stringEnum } from "../schema/typebox.js";

const BROWSER_ACT_KINDS = [
  "click",
  "type",
  "press",
  "hover",
  "drag",
  "select",
  "fill",
  "resize",
  "wait",
  "evaluate",
  "close",
] as const;

const BROWSER_TOOL_ACTIONS = [
  "status",
  "start",
  "stop",
  "profiles",
  "tabs",
  "open",
  "focus",
  "close",
  "snapshot",
  "screenshot",
  "navigate",
  "console",
  "pdf",
  "upload",
  "dialog",
  "act",
] as const;

const BROWSER_TARGETS = ["sandbox", "host", "node"] as const;

const BROWSER_SNAPSHOT_FORMATS = ["aria", "ai"] as const;
const BROWSER_SNAPSHOT_MODES = ["efficient"] as const;
const BROWSER_SNAPSHOT_REFS = ["role", "aria"] as const;

const BROWSER_IMAGE_TYPES = ["png", "jpeg"] as const;

// NOTE: Using a flattened object schema instead of Type.Union([Type.Object(...), ...])
// because Claude API on Vertex AI rejects nested anyOf schemas as invalid JSON Schema.
// The discriminator (kind) determines which properties are relevant; runtime validates.
const BrowserActSchema = Type.Object({
  kind: stringEnum(BROWSER_ACT_KINDS, { description: "Type of browser action to perform" }),
  // Common fields
  targetId: Type.Optional(Type.String({ description: "Target element identifier" })),
  ref: Type.Optional(Type.String({ description: "Element reference from snapshot" })),
  // click
  doubleClick: Type.Optional(
    Type.Boolean({ description: "Perform double-click instead of single click" }),
  ),
  button: Type.Optional(Type.String({ description: "Mouse button to use (left, right, middle)" })),
  modifiers: Type.Optional(
    Type.Array(Type.String(), {
      description: "Keyboard modifiers to hold (ctrl, shift, alt, meta)",
    }),
  ),
  // type
  text: Type.Optional(Type.String({ description: "Text to type into the element" })),
  submit: Type.Optional(Type.Boolean({ description: "Submit form after typing" })),
  slowly: Type.Optional(Type.Boolean({ description: "Type with delay between keystrokes" })),
  // press
  key: Type.Optional(Type.String({ description: "Key to press (e.g., Enter, Escape, Tab)" })),
  // drag
  startRef: Type.Optional(Type.String({ description: "Drag start element reference" })),
  endRef: Type.Optional(Type.String({ description: "Drag end element reference" })),
  // select
  values: Type.Optional(
    Type.Array(Type.String(), { description: "Values to select in a dropdown" }),
  ),
  // fill - use permissive array of objects
  fields: Type.Optional(
    Type.Array(Type.Object({}, { additionalProperties: true }), {
      description: "Form fields to fill with values",
    }),
  ),
  // resize
  width: Type.Optional(Type.Number({ description: "New window/element width in pixels" })),
  height: Type.Optional(Type.Number({ description: "New window/element height in pixels" })),
  // wait
  timeMs: Type.Optional(Type.Number({ description: "Wait duration in milliseconds" })),
  textGone: Type.Optional(
    Type.String({ description: "Wait until this text disappears from the page" }),
  ),
  // evaluate
  fn: Type.Optional(Type.String({ description: "JavaScript function to evaluate in the browser" })),
});

// IMPORTANT: OpenAI function tool schemas must have a top-level `type: "object"`.
// A root-level `Type.Union([...])` compiles to `{ anyOf: [...] }` (no `type`),
// which OpenAI rejects ("Invalid schema ... type: None"). Keep this schema an object.
export const BrowserToolSchema = Type.Object({
  action: stringEnum(BROWSER_TOOL_ACTIONS, { description: "Browser action to perform" }),
  target: optionalStringEnum(BROWSER_TARGETS, {
    description: "Target browser environment (sandbox, host, or node)",
  }),
  node: Type.Optional(
    Type.String({ description: "Target device node identifier for remote browsers" }),
  ),
  profile: Type.Optional(Type.String({ description: "Browser profile name to use" })),
  targetUrl: Type.Optional(Type.String({ description: "URL to navigate the browser to" })),
  targetId: Type.Optional(Type.String({ description: "Target tab/page identifier" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of results to return" })),
  maxChars: Type.Optional(Type.Number({ description: "Maximum characters in snapshot content" })),
  mode: optionalStringEnum(BROWSER_SNAPSHOT_MODES, {
    description: "Snapshot mode for page capture",
  }),
  snapshotFormat: optionalStringEnum(BROWSER_SNAPSHOT_FORMATS, {
    description: "Snapshot format (aria for accessibility tree, ai for AI-optimized)",
  }),
  refs: optionalStringEnum(BROWSER_SNAPSHOT_REFS, {
    description: "Reference format for elements (role or aria)",
  }),
  interactive: Type.Optional(
    Type.Boolean({ description: "Include only interactive elements in snapshot" }),
  ),
  compact: Type.Optional(Type.Boolean({ description: "Use compact snapshot format" })),
  depth: Type.Optional(Type.Number({ description: "Maximum DOM tree depth to traverse" })),
  selector: Type.Optional(Type.String({ description: "CSS selector for element targeting" })),
  frame: Type.Optional(Type.String({ description: "Target frame name or index" })),
  labels: Type.Optional(Type.Boolean({ description: "Include element labels in snapshot" })),
  fullPage: Type.Optional(
    Type.Boolean({ description: "Capture full page screenshot (not just viewport)" }),
  ),
  ref: Type.Optional(Type.String({ description: "Element reference for action" })),
  element: Type.Optional(Type.String({ description: "Element selector for targeting" })),
  type: optionalStringEnum(BROWSER_IMAGE_TYPES, {
    description: "Image format for screenshots (png or jpeg)",
  }),
  level: Type.Optional(Type.String({ description: "Console log level filter (log, warn, error)" })),
  paths: Type.Optional(
    Type.Array(Type.String(), { description: "File paths for upload operation" }),
  ),
  inputRef: Type.Optional(Type.String({ description: "Input element reference for file upload" })),
  timeoutMs: Type.Optional(Type.Number({ description: "Operation timeout in milliseconds" })),
  accept: Type.Optional(Type.Boolean({ description: "Accept or dismiss dialog (true to accept)" })),
  promptText: Type.Optional(Type.String({ description: "Text to enter for prompt dialogs" })),
  request: Type.Optional(BrowserActSchema),
});
