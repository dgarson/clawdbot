import fs from "node:fs/promises";
import path from "node:path";
import {
  listAgentIds,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
} from "../../agents/agent-scope.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_MEMORY_ALT_FILENAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  ensureAgentWorkspace,
  isWorkspaceOnboardingCompleted,
} from "../../agents/workspace.js";
import { movePathToTrash } from "../../browser/trash.js";
import {
  applyAgentConfig,
  findAgentEntryIndex,
  listAgentEntries,
  pruneAgentConfig,
} from "../../commands/agents.config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { collectConfigRuntimeEnvVars } from "../../config/env-vars.js";
import { resolveSessionTranscriptsDirForAgent } from "../../config/sessions/paths.js";
import { appendChangeAuditRecord, readFileAuditSnapshot } from "../../infra/change-audit.js";
import { parseGeminiAuth } from "../../infra/gemini-auth.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../routing/session-key.js";
import { resolveUserPath } from "../../utils.js";
import { formatControlPlaneActor, resolveControlPlaneActor } from "../control-plane-audit.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentsCreateParams,
  validateAgentsDeleteParams,
  validateAgentsAvatarCapabilitiesParams,
  validateAgentsAvatarGenerateParams,
  validateAgentsFilesGetParams,
  validateAgentsFilesListParams,
  validateAgentsFilesSetParams,
  validateAgentsListParams,
  validateAgentsUpdateParams,
} from "../protocol/index.js";
import { listAgentsForGateway } from "../session-utils.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";

const BOOTSTRAP_FILE_NAMES = [
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
] as const;
const BOOTSTRAP_FILE_NAMES_POST_ONBOARDING = BOOTSTRAP_FILE_NAMES.filter(
  (name) => name !== DEFAULT_BOOTSTRAP_FILENAME,
);

const MEMORY_FILE_NAMES = [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME] as const;

const ALLOWED_FILE_NAMES = new Set<string>([...BOOTSTRAP_FILE_NAMES, ...MEMORY_FILE_NAMES]);
const GEMINI_AVATAR_MODEL = "gemini-2.5-flash-image-preview";
const GEMINI_AVATAR_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_AVATAR_TIMEOUT_MS = 60_000;
const GENERATED_AVATAR_FILENAME_DEFAULT = "avatars/generated-avatar.png";
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i;
const IMAGE_MIME_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function resolveAgentWorkspaceFileOrRespondError(
  params: Record<string, unknown>,
  respond: RespondFn,
): {
  cfg: ReturnType<typeof loadConfig>;
  agentId: string;
  workspaceDir: string;
  name: string;
} | null {
  const cfg = loadConfig();
  const rawAgentId = params.agentId;
  const agentId = resolveAgentIdOrError(
    typeof rawAgentId === "string" || typeof rawAgentId === "number" ? String(rawAgentId) : "",
    cfg,
  );
  if (!agentId) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
    return null;
  }
  const rawName = params.name;
  const name = (
    typeof rawName === "string" || typeof rawName === "number" ? String(rawName) : ""
  ).trim();
  if (!ALLOWED_FILE_NAMES.has(name)) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `unsupported file "${name}"`));
    return null;
  }
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  return { cfg, agentId, workspaceDir, name };
}

type FileMeta = {
  size: number;
  updatedAtMs: number;
};

async function statFile(filePath: string): Promise<FileMeta | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return {
      size: stat.size,
      updatedAtMs: Math.floor(stat.mtimeMs),
    };
  } catch {
    return null;
  }
}

async function listAgentFiles(workspaceDir: string, options?: { hideBootstrap?: boolean }) {
  const files: Array<{
    name: string;
    path: string;
    missing: boolean;
    size?: number;
    updatedAtMs?: number;
  }> = [];

  const bootstrapFileNames = options?.hideBootstrap
    ? BOOTSTRAP_FILE_NAMES_POST_ONBOARDING
    : BOOTSTRAP_FILE_NAMES;
  for (const name of bootstrapFileNames) {
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (meta) {
      files.push({
        name,
        path: filePath,
        missing: false,
        size: meta.size,
        updatedAtMs: meta.updatedAtMs,
      });
    } else {
      files.push({ name, path: filePath, missing: true });
    }
  }

  const primaryMemoryPath = path.join(workspaceDir, DEFAULT_MEMORY_FILENAME);
  const primaryMeta = await statFile(primaryMemoryPath);
  if (primaryMeta) {
    files.push({
      name: DEFAULT_MEMORY_FILENAME,
      path: primaryMemoryPath,
      missing: false,
      size: primaryMeta.size,
      updatedAtMs: primaryMeta.updatedAtMs,
    });
  } else {
    const altMemoryPath = path.join(workspaceDir, DEFAULT_MEMORY_ALT_FILENAME);
    const altMeta = await statFile(altMemoryPath);
    if (altMeta) {
      files.push({
        name: DEFAULT_MEMORY_ALT_FILENAME,
        path: altMemoryPath,
        missing: false,
        size: altMeta.size,
        updatedAtMs: altMeta.updatedAtMs,
      });
    } else {
      files.push({ name: DEFAULT_MEMORY_FILENAME, path: primaryMemoryPath, missing: true });
    }
  }

  return files;
}

function resolveAgentIdOrError(agentIdRaw: string, cfg: ReturnType<typeof loadConfig>) {
  const agentId = normalizeAgentId(agentIdRaw);
  const allowed = new Set(listAgentIds(cfg));
  if (!allowed.has(agentId)) {
    return null;
  }
  return agentId;
}

function sanitizeIdentityLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolveOptionalStringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveGeminiAvatarCapability(cfg: ReturnType<typeof loadConfig>): {
  supported: boolean;
  provider: "gemini";
  model: string;
  reason?: string;
  apiKey?: string;
} {
  const envApiKey = process.env.GEMINI_API_KEY?.trim();
  if (envApiKey) {
    return {
      supported: true,
      provider: "gemini",
      model: GEMINI_AVATAR_MODEL,
      apiKey: envApiKey,
    };
  }

  const configApiKey = collectConfigRuntimeEnvVars(cfg).GEMINI_API_KEY?.trim();
  if (configApiKey) {
    return {
      supported: true,
      provider: "gemini",
      model: GEMINI_AVATAR_MODEL,
      apiKey: configApiKey,
    };
  }

  return {
    supported: false,
    provider: "gemini",
    model: GEMINI_AVATAR_MODEL,
    reason:
      "Gemini must be configured to use avatar generation (set GEMINI_API_KEY in env or config.env).",
  };
}

function pickFallbackEmoji(name: string, description: string): string {
  const combined = `${name} ${description}`.toLowerCase();
  if (combined.includes("code") || combined.includes("dev")) {
    return "💻";
  }
  if (combined.includes("design") || combined.includes("creative")) {
    return "🎨";
  }
  if (combined.includes("data") || combined.includes("analytics")) {
    return "📊";
  }
  if (combined.includes("support") || combined.includes("help")) {
    return "🤝";
  }
  if (combined.includes("security") || combined.includes("safe")) {
    return "🛡️";
  }
  if (combined.includes("research") || combined.includes("analysis")) {
    return "🔍";
  }
  return "🤖";
}

function extractEmojiCandidate(text: string): string | undefined {
  for (const character of Array.from(text)) {
    if (/\p{Extended_Pictographic}/u.test(character)) {
      return character;
    }
  }
  return undefined;
}

function buildGeminiAvatarPrompt(name: string, description: string): string {
  return [
    "Create a polished profile avatar for an AI agent.",
    "Style: clean, modern illustration, centered subject, strong contrast, no text or letters.",
    "Return one short text line in the format: EMOJI: <single emoji>",
    "",
    `Agent name: ${name}`,
    `Agent role: ${description}`,
  ].join("\n");
}

function truncateErrorBody(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

async function generateGeminiAvatar(params: {
  apiKey: string;
  name: string;
  description: string;
}): Promise<{ provider: "gemini"; model: string; emoji: string; imageDataUrl: string }> {
  const headers = new Headers(parseGeminiAuth(params.apiKey).headers);
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildGeminiAvatarPrompt(params.name, params.description) }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_AVATAR_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(
      `${GEMINI_AVATAR_BASE_URL}/models/${GEMINI_AVATAR_MODEL}:generateContent`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = truncateErrorBody(await response.text());
    const suffix = errorText ? `: ${errorText}` : "";
    throw new Error(`Gemini avatar generation failed (HTTP ${response.status})${suffix}`);
  }

  const body = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
  };

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const combinedText = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n");

  let mimeType: string | undefined;
  let imageData: string | undefined;
  for (const part of parts) {
    const inlineData = part.inlineData;
    const inlineDataSnake = part.inline_data;
    const mime = inlineData?.mimeType ?? inlineDataSnake?.mime_type;
    const data = inlineData?.data ?? inlineDataSnake?.data;
    if (typeof mime === "string" && typeof data === "string" && mime.startsWith("image/")) {
      mimeType = mime;
      imageData = data;
      break;
    }
  }

  if (!mimeType || !imageData) {
    throw new Error("Gemini avatar generation response did not include an image.");
  }

  const emoji =
    extractEmojiCandidate(combinedText) ?? pickFallbackEmoji(params.name, params.description);

  return {
    provider: "gemini",
    model: GEMINI_AVATAR_MODEL,
    emoji,
    imageDataUrl: `data:${mimeType};base64,${imageData}`,
  };
}

function decodeAvatarImageDataUrl(dataUrl: string): { buffer: Buffer; extension: string } {
  const match = dataUrl.match(IMAGE_DATA_URL_PATTERN);
  if (!match) {
    throw new Error("avatarDataUrl must be a base64 image data URL (png/jpeg/webp).");
  }
  const mime = match[1].toLowerCase();
  const base64Data = match[2];
  const extension = IMAGE_MIME_EXTENSION[mime];
  if (!extension) {
    throw new Error("avatarDataUrl mime type is not supported.");
  }
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    throw new Error("avatarDataUrl decoded to an empty image.");
  }
  return { buffer, extension };
}

function resolveGeneratedAvatarRelativePath(
  rawPath: string | undefined,
  extension: string,
): string {
  const fallback = GENERATED_AVATAR_FILENAME_DEFAULT.replace(/\.png$/i, `.${extension}`);
  if (!rawPath) {
    return fallback;
  }
  const normalized = rawPath
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\.?\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    normalized.includes(":")
  ) {
    return fallback;
  }
  if (!/\.[a-z0-9]+$/i.test(normalized)) {
    return `${normalized}.${extension}`;
  }
  return normalized;
}

async function moveToTrashBestEffort(pathname: string): Promise<void> {
  if (!pathname) {
    return;
  }
  try {
    await fs.access(pathname);
  } catch {
    return;
  }
  try {
    await movePathToTrash(pathname);
  } catch {
    // Best-effort: path may already be gone or trash unavailable.
  }
}

export const agentsHandlers: GatewayRequestHandlers = {
  "agents.list": ({ params, respond }) => {
    if (!validateAgentsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.list params: ${formatValidationErrors(validateAgentsListParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const result = listAgentsForGateway(cfg);
    respond(true, result, undefined);
  },
  "agents.avatar.capabilities": ({ params, respond }) => {
    if (!validateAgentsAvatarCapabilitiesParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.avatar.capabilities params: ${formatValidationErrors(
            validateAgentsAvatarCapabilitiesParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const capability = resolveGeminiAvatarCapability(cfg);
    respond(
      true,
      {
        supported: capability.supported,
        provider: capability.provider,
        model: capability.model,
        ...(capability.reason ? { reason: capability.reason } : {}),
      },
      undefined,
    );
  },
  "agents.avatar.generate": async ({ params, respond }) => {
    if (!validateAgentsAvatarGenerateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.avatar.generate params: ${formatValidationErrors(
            validateAgentsAvatarGenerateParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const capability = resolveGeminiAvatarCapability(cfg);
    if (!capability.supported || !capability.apiKey) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          capability.reason ??
            "Gemini must be configured to use avatar generation (set GEMINI_API_KEY in env or config.env).",
        ),
      );
      return;
    }

    try {
      const generated = await generateGeminiAvatar({
        apiKey: capability.apiKey,
        name: String(params.name),
        description: String(params.description),
      });
      respond(true, generated, undefined);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          error instanceof Error ? error.message : "Gemini avatar generation failed.",
        ),
      );
    }
  },
  "agents.create": async ({ params, respond }) => {
    if (!validateAgentsCreateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.create params: ${formatValidationErrors(
            validateAgentsCreateParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const rawName = String(params.name ?? "").trim();
    const agentId = normalizeAgentId(rawName);
    if (agentId === DEFAULT_AGENT_ID) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `"${DEFAULT_AGENT_ID}" is reserved`),
      );
      return;
    }

    if (findAgentEntryIndex(listAgentEntries(cfg), agentId) >= 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `agent "${agentId}" already exists`),
      );
      return;
    }

    const workspaceDir = resolveUserPath(String(params.workspace ?? "").trim());

    // Resolve agentDir against the config we're about to persist (vs the pre-write config),
    // so subsequent resolutions can't disagree about the agent's directory.
    let nextConfig = applyAgentConfig(cfg, {
      agentId,
      name: rawName,
      workspace: workspaceDir,
    });
    const agentDir = resolveAgentDir(nextConfig, agentId);
    nextConfig = applyAgentConfig(nextConfig, { agentId, agentDir });

    // Ensure workspace & transcripts exist BEFORE writing config so a failure
    // here does not leave a broken config entry behind.
    const skipBootstrap = Boolean(nextConfig.agents?.defaults?.skipBootstrap);
    await ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: !skipBootstrap });
    await fs.mkdir(resolveSessionTranscriptsDirForAgent(agentId), { recursive: true });

    await writeConfigFile(nextConfig);

    // Always write Name to IDENTITY.md; optionally include emoji/avatar.
    const safeName = sanitizeIdentityLine(rawName);
    const emoji = resolveOptionalStringParam(params.emoji);
    const avatarDataUrl = resolveOptionalStringParam(params.avatarDataUrl);
    const avatarFilename = resolveOptionalStringParam(params.avatarFilename);
    let avatar = resolveOptionalStringParam(params.avatar);
    if (avatarDataUrl) {
      try {
        const decoded = decodeAvatarImageDataUrl(avatarDataUrl);
        const relativePath = resolveGeneratedAvatarRelativePath(avatarFilename, decoded.extension);
        const absolutePath = path.resolve(workspaceDir, relativePath);
        const workspaceRoot = path.resolve(workspaceDir);
        if (
          !absolutePath.startsWith(`${workspaceRoot}${path.sep}`) &&
          absolutePath !== workspaceRoot
        ) {
          throw new Error("generated avatar path must stay within workspace.");
        }
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, decoded.buffer);
        avatar = relativePath;
      } catch (error) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            error instanceof Error ? error.message : "invalid avatarDataUrl",
          ),
        );
        return;
      }
    }
    const identityPath = path.join(workspaceDir, DEFAULT_IDENTITY_FILENAME);
    const lines = [
      "",
      `- Name: ${safeName}`,
      ...(emoji ? [`- Emoji: ${sanitizeIdentityLine(emoji)}`] : []),
      ...(avatar ? [`- Avatar: ${sanitizeIdentityLine(avatar)}`] : []),
      "",
    ];
    await fs.appendFile(identityPath, lines.join("\n"), "utf-8");

    respond(true, { ok: true, agentId, name: rawName, workspace: workspaceDir }, undefined);
  },
  "agents.update": async ({ params, respond }) => {
    if (!validateAgentsUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.update params: ${formatValidationErrors(
            validateAgentsUpdateParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = normalizeAgentId(String(params.agentId ?? ""));
    if (findAgentEntryIndex(listAgentEntries(cfg), agentId) < 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `agent "${agentId}" not found`),
      );
      return;
    }

    const workspaceDir =
      typeof params.workspace === "string" && params.workspace.trim()
        ? resolveUserPath(params.workspace.trim())
        : undefined;

    const model = resolveOptionalStringParam(params.model);
    const avatar = resolveOptionalStringParam(params.avatar);

    const nextConfig = applyAgentConfig(cfg, {
      agentId,
      ...(typeof params.name === "string" && params.name.trim()
        ? { name: params.name.trim() }
        : {}),
      ...(workspaceDir ? { workspace: workspaceDir } : {}),
      ...(model ? { model } : {}),
    });

    await writeConfigFile(nextConfig);

    if (workspaceDir) {
      const skipBootstrap = Boolean(nextConfig.agents?.defaults?.skipBootstrap);
      await ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: !skipBootstrap });
    }

    if (avatar) {
      const workspace = workspaceDir ?? resolveAgentWorkspaceDir(nextConfig, agentId);
      await fs.mkdir(workspace, { recursive: true });
      const identityPath = path.join(workspace, DEFAULT_IDENTITY_FILENAME);
      await fs.appendFile(identityPath, `\n- Avatar: ${sanitizeIdentityLine(avatar)}\n`, "utf-8");
    }

    respond(true, { ok: true, agentId }, undefined);
  },
  "agents.delete": async ({ params, respond }) => {
    if (!validateAgentsDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.delete params: ${formatValidationErrors(
            validateAgentsDeleteParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = normalizeAgentId(String(params.agentId ?? ""));
    if (agentId === DEFAULT_AGENT_ID) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `"${DEFAULT_AGENT_ID}" cannot be deleted`),
      );
      return;
    }
    if (findAgentEntryIndex(listAgentEntries(cfg), agentId) < 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `agent "${agentId}" not found`),
      );
      return;
    }

    const deleteFiles = typeof params.deleteFiles === "boolean" ? params.deleteFiles : true;
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const agentDir = resolveAgentDir(cfg, agentId);
    const sessionsDir = resolveSessionTranscriptsDirForAgent(agentId);

    const result = pruneAgentConfig(cfg, agentId);
    await writeConfigFile(result.config);

    if (deleteFiles) {
      await Promise.all([
        moveToTrashBestEffort(workspaceDir),
        moveToTrashBestEffort(agentDir),
        moveToTrashBestEffort(sessionsDir),
      ]);
    }

    respond(true, { ok: true, agentId, removedBindings: result.removedBindings }, undefined);
  },
  "agents.files.list": async ({ params, respond }) => {
    if (!validateAgentsFilesListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.list params: ${formatValidationErrors(
            validateAgentsFilesListParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    let hideBootstrap = false;
    try {
      hideBootstrap = await isWorkspaceOnboardingCompleted(workspaceDir);
    } catch {
      // Fall back to showing BOOTSTRAP if workspace state cannot be read.
    }
    const files = await listAgentFiles(workspaceDir, { hideBootstrap });
    respond(true, { agentId, workspace: workspaceDir, files }, undefined);
  },
  "agents.files.get": async ({ params, respond }) => {
    if (!validateAgentsFilesGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.get params: ${formatValidationErrors(
            validateAgentsFilesGetParams.errors,
          )}`,
        ),
      );
      return;
    }
    const resolved = resolveAgentWorkspaceFileOrRespondError(params, respond);
    if (!resolved) {
      return;
    }
    const { agentId, workspaceDir, name } = resolved;
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (!meta) {
      respond(
        true,
        {
          agentId,
          workspace: workspaceDir,
          file: { name, path: filePath, missing: true },
        },
        undefined,
      );
      return;
    }
    const content = await fs.readFile(filePath, "utf-8");
    respond(
      true,
      {
        agentId,
        workspace: workspaceDir,
        file: {
          name,
          path: filePath,
          missing: false,
          size: meta.size,
          updatedAtMs: meta.updatedAtMs,
          content,
        },
      },
      undefined,
    );
  },
  "agents.files.set": async ({ params, respond, client }) => {
    if (!validateAgentsFilesSetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.set params: ${formatValidationErrors(
            validateAgentsFilesSetParams.errors,
          )}`,
        ),
      );
      return;
    }
    const resolved = resolveAgentWorkspaceFileOrRespondError(params, respond);
    if (!resolved) {
      return;
    }
    const { agentId, workspaceDir, name } = resolved;
    await fs.mkdir(workspaceDir, { recursive: true });
    const filePath = path.join(workspaceDir, name);
    const content = String(params.content ?? "");
    const before = await readFileAuditSnapshot(filePath);
    const actor = resolveControlPlaneActor(client);
    try {
      await fs.writeFile(filePath, content, "utf-8");
      const after = await readFileAuditSnapshot(filePath);
      await appendChangeAuditRecord({
        source: "gateway.agents",
        eventType: "agents.files.set",
        op: "write",
        targetPath: filePath,
        beforeHash: before.hash,
        afterHash: after.hash,
        beforeBytes: before.bytes,
        afterBytes: after.bytes,
        agentId,
        actor,
        result: "ok",
        details: {
          workspace: workspaceDir,
          fileName: name,
        },
      });
    } catch (error) {
      await appendChangeAuditRecord({
        source: "gateway.agents",
        eventType: "agents.files.set",
        op: "write",
        targetPath: filePath,
        beforeHash: before.hash,
        afterHash: null,
        beforeBytes: before.bytes,
        afterBytes: null,
        agentId,
        actor,
        result: "error",
        error: error instanceof Error ? error.message : String(error),
        details: {
          workspace: workspaceDir,
          fileName: name,
          actorSummary: formatControlPlaneActor(actor),
        },
      });
      throw error;
    }
    const meta = await statFile(filePath);
    respond(
      true,
      {
        ok: true,
        agentId,
        workspace: workspaceDir,
        file: {
          name,
          path: filePath,
          missing: false,
          size: meta?.size,
          updatedAtMs: meta?.updatedAtMs,
          content,
        },
      },
      undefined,
    );
  },
};
