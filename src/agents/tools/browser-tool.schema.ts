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
  kind: stringEnum(BROWSER_ACT_KINDS, {
    description:
      "Action to perform: 'click', 'type', 'press', 'hover', 'drag', 'select', 'fill', 'resize', 'wait', 'evaluate', 'close', 'navigate'.",
  }),
  // Common fields
  targetId: Type.Optional(Type.String({ description: "Target element node ID from snapshot." })),
  ref: Type.Optional(
    Type.String({
      description:
        "Exact element reference from accessibility snapshot (use snapshot action first to get refs).",
    }),
  ),
  // click
  doubleClick: Type.Optional(
    Type.Boolean({ description: "If true, perform double-click (kind='click')." }),
  ),
  button: Type.Optional(
    Type.String({
      description: "Mouse button: 'left' (default), 'right', or 'middle' (kind='click').",
    }),
  ),
  modifiers: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Keyboard modifiers: 'Alt', 'Control', 'Meta', 'Shift' (combinable; kind='click').",
    }),
  ),
  // type
  text: Type.Optional(Type.String({ description: "Text to type into element (kind='type')." })),
  submit: Type.Optional(
    Type.Boolean({ description: "If true, press Enter after typing (kind='type')." }),
  ),
  slowly: Type.Optional(
    Type.Boolean({
      description: "If true, type character-by-character to trigger key handlers (kind='type').",
    }),
  ),
  // press
  key: Type.Optional(
    Type.String({
      description:
        "Keyboard key name to press (e.g. 'Enter', 'Escape', 'ArrowLeft'; kind='press').",
    }),
  ),
  // drag
  startRef: Type.Optional(
    Type.String({
      description: "Snapshot reference for drag source element (kind='drag').",
    }),
  ),
  endRef: Type.Optional(
    Type.String({
      description: "Snapshot reference for drag drop-target element (kind='drag').",
    }),
  ),
  // select
  values: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Option values to select in dropdown (kind='select'; multiple values for multi-select).",
    }),
  ),
  // fill - use permissive array of objects
  fields: Type.Optional(
    Type.Array(Type.Object({}, { additionalProperties: true }), {
      description: "Form fields to fill: [{name, type, ref, value}] (kind='fill').",
    }),
  ),
  // resize
  width: Type.Optional(
    Type.Number({ description: "Browser window width in pixels (kind='resize')." }),
  ),
  height: Type.Optional(
    Type.Number({ description: "Browser window height in pixels (kind='resize')." }),
  ),
  // wait
  timeMs: Type.Optional(Type.Number({ description: "Milliseconds to wait (kind='wait')." })),
  textGone: Type.Optional(
    Type.String({
      description: "Text to wait for to disappear from page (kind='wait').",
    }),
  ),
  // evaluate
  fn: Type.Optional(
    Type.String({
      description:
        "JavaScript function body to evaluate on page: '() => { return result; }' (kind='evaluate').",
    }),
  ),
});

// IMPORTANT: OpenAI function tool schemas must have a top-level `type: "object"`.
// A root-level `Type.Union([...])` compiles to `{ anyOf: [...] }` (no `type`),
// which OpenAI rejects ("Invalid schema ... type: None"). Keep this schema an object.
export const BrowserToolSchema = Type.Object({
  action: stringEnum(BROWSER_TOOL_ACTIONS, {
    description:
      "Browser action: 'status', 'start', 'stop', 'profiles', 'tabs', 'open', 'focus', 'close', 'snapshot', 'screenshot', 'navigate', 'console', 'pdf', 'upload', 'dialog', 'act'.",
  }),
  target: optionalStringEnum(BROWSER_TARGETS, {
    description:
      "Browser target: 'sandbox' (in-process), 'host' (system browser), 'node' (remote node).",
  }),
  node: Type.Optional(Type.String({ description: "Remote node ID (when target='node')." })),
  profile: Type.Optional(
    Type.String({ description: "Browser profile name for persistent sessions." }),
  ),
  targetUrl: Type.Optional(Type.String({ description: "URL to navigate to (action='navigate')." })),
  targetId: Type.Optional(
    Type.String({ description: "Tab ID to operate on (from 'tabs' action)." }),
  ),
  limit: Type.Optional(Type.Number({ description: "Max elements/tabs to return in results." })),
  maxChars: Type.Optional(
    Type.Number({ description: "Max characters in snapshot output (default: 50000)." }),
  ),
  mode: optionalStringEnum(BROWSER_SNAPSHOT_MODES, {
    description: "Snapshot mode: 'efficient' for AI-optimised output.",
  }),
  snapshotFormat: optionalStringEnum(BROWSER_SNAPSHOT_FORMATS, {
    description: "Snapshot format: 'aria' (accessibility tree) or 'ai' (optimised for agents).",
  }),
  refs: optionalStringEnum(BROWSER_SNAPSHOT_REFS, {
    description: "Reference style for elements: 'role' or 'aria'.",
  }),
  interactive: Type.Optional(
    Type.Boolean({
      description: "If true, include only interactive elements in snapshot.",
    }),
  ),
  compact: Type.Optional(
    Type.Boolean({
      description: "If true, minimise whitespace in snapshot output.",
    }),
  ),
  depth: Type.Optional(Type.Number({ description: "Max DOM depth to include in snapshot." })),
  selector: Type.Optional(
    Type.String({
      description: "CSS selector to filter snapshot to matching elements only.",
    }),
  ),
  frame: Type.Optional(Type.String({ description: "Frame/iframe name or index to snapshot." })),
  labels: Type.Optional(
    Type.Boolean({
      description: "If true, include element labels and alt text in snapshot.",
    }),
  ),
  fullPage: Type.Optional(
    Type.Boolean({
      description:
        "If true, screenshot full scrollable page instead of just the viewport (action='screenshot').",
    }),
  ),
  ref: Type.Optional(Type.String()),
  element: Type.Optional(Type.String()),
  type: optionalStringEnum(BROWSER_IMAGE_TYPES, {
    description: "Image format: 'png' (lossless) or 'jpeg' (compressed; action='screenshot').",
  }),
  level: Type.Optional(Type.String()),
  paths: Type.Optional(
    Type.Array(Type.String(), {
      description: "File paths to upload (action='upload').",
    }),
  ),
  inputRef: Type.Optional(
    Type.String({
      description: "File input element reference for upload (from snapshot; action='upload').",
    }),
  ),
  timeoutMs: Type.Optional(
    Type.Number({
      description: "Operation timeout in milliseconds (default: 30000).",
    }),
  ),
  accept: Type.Optional(
    Type.Boolean({
      description: "If true, accept dialog; if false, dismiss (action='dialog').",
    }),
  ),
  promptText: Type.Optional(
    Type.String({
      description: "Text to enter in prompt dialog (action='dialog').",
    }),
  ),
  request: Type.Optional(BrowserActSchema),
});
