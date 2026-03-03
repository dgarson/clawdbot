import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { writeBase64ToFile } from "../../cli/nodes-camera.js";
import { canvasSnapshotTempPath, parseCanvasSnapshotPayload } from "../../cli/nodes-canvas.js";
import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose, shouldLogVerbose } from "../../globals.js";
import { isInboundPathAllowed } from "../../media/inbound-path-policy.js";
import { getDefaultMediaLocalRoots } from "../../media/local-roots.js";
import { imageMimeFromFormat } from "../../media/mime.js";
import { resolveImageSanitizationLimits } from "../image-sanitization.js";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, imageResult, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, readGatewayCallOptions } from "./gateway.js";
import { resolveNodeId } from "./nodes-utils.js";

const CANVAS_ACTIONS = [
  "present",
  "hide",
  "navigate",
  "eval",
  "snapshot",
  "a2ui_push",
  "a2ui_reset",
] as const;

const CANVAS_SNAPSHOT_FORMATS = ["png", "jpg", "jpeg"] as const;

async function readJsonlFromPath(jsonlPath: string): Promise<string> {
  const trimmed = jsonlPath.trim();
  if (!trimmed) {
    return "";
  }
  const resolved = path.resolve(trimmed);
  const roots = getDefaultMediaLocalRoots();
  if (!isInboundPathAllowed({ filePath: resolved, roots })) {
    if (shouldLogVerbose()) {
      logVerbose(`Blocked canvas jsonlPath outside allowed roots: ${resolved}`);
    }
    throw new Error("jsonlPath outside allowed roots");
  }
  const canonical = await fs.realpath(resolved).catch(() => resolved);
  if (!isInboundPathAllowed({ filePath: canonical, roots })) {
    if (shouldLogVerbose()) {
      logVerbose(`Blocked canvas jsonlPath outside allowed roots: ${canonical}`);
    }
    throw new Error("jsonlPath outside allowed roots");
  }
  return await fs.readFile(canonical, "utf8");
}

// Flattened schema: runtime validates per-action requirements.
const CanvasToolSchema = Type.Object({
  action: stringEnum(CANVAS_ACTIONS, {
    description:
      "'present' (show canvas), 'hide' (hide), 'navigate' (load URL/HTML), 'eval' (run JS), 'snapshot' (capture), 'a2ui_push' (update A2UI model), 'a2ui_reset' (reset A2UI).",
  }),
  gatewayUrl: Type.Optional(Type.String({ description: "Custom gateway URL override." })),
  gatewayToken: Type.Optional(Type.String({ description: "Custom gateway auth token override." })),
  timeoutMs: Type.Optional(
    Type.Number({ description: "Request timeout in milliseconds (default: 30000)." }),
  ),
  node: Type.Optional(
    Type.String({
      description:
        "Node ID or name to target (use 'status' or 'describe' to list available nodes).",
    }),
  ),
  // present
  target: Type.Optional(Type.String({ description: "Target canvas element identifier." })),
  x: Type.Optional(Type.Number({ description: "Canvas window X position in pixels." })),
  y: Type.Optional(Type.Number({ description: "Canvas window Y position in pixels." })),
  width: Type.Optional(Type.Number({ description: "Canvas window width in pixels." })),
  height: Type.Optional(Type.Number({ description: "Canvas window height in pixels." })),
  // navigate
  url: Type.Optional(
    Type.String({
      description: "URL or HTML string to load in canvas (action='navigate').",
    }),
  ),
  // eval
  javaScript: Type.Optional(
    Type.String({
      description: "JavaScript code to execute in canvas window context (action='eval').",
    }),
  ),
  // snapshot
  outputFormat: optionalStringEnum(CANVAS_SNAPSHOT_FORMATS, {
    description: "Image format for snapshot: 'png', 'jpg', 'jpeg' (action='snapshot').",
  }),
  maxWidth: Type.Optional(
    Type.Number({
      description:
        "Max snapshot image width in pixels; aspect ratio preserved (action='snapshot').",
    }),
  ),
  quality: Type.Optional(
    Type.Number({
      description: "JPEG quality 0-100 (default 80; action='snapshot' with JPEG format).",
    }),
  ),
  delayMs: Type.Optional(
    Type.Number({
      description:
        "Milliseconds to wait before capturing snapshot (allows animations to complete; action='snapshot').",
    }),
  ),
  // a2ui_push
  jsonl: Type.Optional(
    Type.String({
      description:
        "JSONL model data to push to A2UI (each line is a JSON object; action='a2ui_push').",
    }),
  ),
  jsonlPath: Type.Optional(
    Type.String({
      description:
        "File path to JSONL model data (alternative to inline 'jsonl'; action='a2ui_push').",
    }),
  ),
});

export function createCanvasTool(options?: { config?: OpenClawConfig }): AnyAgentTool {
  const imageSanitization = resolveImageSanitizationLimits(options?.config);
  return {
    label: "Canvas",
    name: "canvas",
    description:
      "Control node canvases (present/hide/navigate/eval/snapshot/A2UI). Use snapshot to capture the rendered UI.",
    parameters: CanvasToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts = readGatewayCallOptions(params);

      const nodeId = await resolveNodeId(
        gatewayOpts,
        readStringParam(params, "node", { trim: true }),
        true,
      );

      const invoke = async (command: string, invokeParams?: Record<string, unknown>) =>
        await callGatewayTool("node.invoke", gatewayOpts, {
          nodeId,
          command,
          params: invokeParams,
          idempotencyKey: crypto.randomUUID(),
        });

      switch (action) {
        case "present": {
          const placement = {
            x: typeof params.x === "number" ? params.x : undefined,
            y: typeof params.y === "number" ? params.y : undefined,
            width: typeof params.width === "number" ? params.width : undefined,
            height: typeof params.height === "number" ? params.height : undefined,
          };
          const invokeParams: Record<string, unknown> = {};
          // Accept both `target` and `url` for present to match common caller expectations.
          // `target` remains the canonical field for CLI compatibility.
          const presentTarget =
            readStringParam(params, "target", { trim: true }) ??
            readStringParam(params, "url", { trim: true });
          if (presentTarget) {
            invokeParams.url = presentTarget;
          }
          if (
            Number.isFinite(placement.x) ||
            Number.isFinite(placement.y) ||
            Number.isFinite(placement.width) ||
            Number.isFinite(placement.height)
          ) {
            invokeParams.placement = placement;
          }
          await invoke("canvas.present", invokeParams);
          return jsonResult({ ok: true });
        }
        case "hide":
          await invoke("canvas.hide", undefined);
          return jsonResult({ ok: true });
        case "navigate": {
          // Support `target` as an alias so callers can reuse the same field across present/navigate.
          const url =
            readStringParam(params, "url", { trim: true }) ??
            readStringParam(params, "target", { required: true, trim: true, label: "url" });
          await invoke("canvas.navigate", { url });
          return jsonResult({ ok: true });
        }
        case "eval": {
          const javaScript = readStringParam(params, "javaScript", {
            required: true,
          });
          const raw = (await invoke("canvas.eval", { javaScript })) as {
            payload?: { result?: string };
          };
          const result = raw?.payload?.result;
          if (result) {
            return {
              content: [{ type: "text", text: result }],
              details: { result },
            };
          }
          return jsonResult({ ok: true });
        }
        case "snapshot": {
          const formatRaw =
            typeof params.outputFormat === "string" ? params.outputFormat.toLowerCase() : "png";
          const format = formatRaw === "jpg" || formatRaw === "jpeg" ? "jpeg" : "png";
          const maxWidth =
            typeof params.maxWidth === "number" && Number.isFinite(params.maxWidth)
              ? params.maxWidth
              : undefined;
          const quality =
            typeof params.quality === "number" && Number.isFinite(params.quality)
              ? params.quality
              : undefined;
          const raw = (await invoke("canvas.snapshot", {
            format,
            maxWidth,
            quality,
          })) as { payload?: unknown };
          const payload = parseCanvasSnapshotPayload(raw?.payload);
          const filePath = canvasSnapshotTempPath({
            ext: payload.format === "jpeg" ? "jpg" : payload.format,
          });
          await writeBase64ToFile(filePath, payload.base64);
          const mimeType = imageMimeFromFormat(payload.format) ?? "image/png";
          return await imageResult({
            label: "canvas:snapshot",
            path: filePath,
            base64: payload.base64,
            mimeType,
            details: { format: payload.format },
            imageSanitization,
          });
        }
        case "a2ui_push": {
          const jsonl =
            typeof params.jsonl === "string" && params.jsonl.trim()
              ? params.jsonl
              : typeof params.jsonlPath === "string" && params.jsonlPath.trim()
                ? await readJsonlFromPath(params.jsonlPath)
                : "";
          if (!jsonl.trim()) {
            throw new Error("jsonl or jsonlPath required");
          }
          await invoke("canvas.a2ui.pushJSONL", { jsonl });
          return jsonResult({ ok: true });
        }
        case "a2ui_reset":
          await invoke("canvas.a2ui.reset", undefined);
          return jsonResult({ ok: true });
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
