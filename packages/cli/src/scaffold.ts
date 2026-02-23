import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type TemplateKind = "plugin" | "agent";

export interface ScaffoldOptions {
  template: TemplateKind;
  baseDir: string;
  name: string;
  description?: string;
  force?: boolean;
}

export interface ScaffoldResult {
  targetDir: string;
  files: string[];
}

const sanitizeName = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const dashed = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return dashed.length > 0 ? dashed : "openclaw-template";
};

const pluginManifest = (name: string, description: string): string =>
  JSON.stringify(
    {
      id: sanitizeName(name),
      kind: "plugin",
      name,
      description,
      version: "0.0.1",
    },
    null,
    2,
  ) + "\n";

const pluginReadme = (name: string, description: string): string => `# ${name}

${description}

This is a generated plugin scaffold for local OpenClaw development.
`;

const pluginSource = (name: string): string => `export const metadata = {
  id: "${sanitizeName(name)}",
  name: "${name}",
};

export const run = async (input: unknown): Promise<{ status: string; input: unknown }> => ({
  status: "ok",
  input,
});
`;

const agentManifest = (name: string, description: string): string =>
  JSON.stringify(
    {
      id: sanitizeName(name),
      kind: "agent",
      name,
      description,
      version: "0.0.1",
    },
    null,
    2,
  ) + "\n";

const agentReadme = (name: string, description: string): string => `# ${name}

${description}

This is a generated agent scaffold for local OpenClaw development.
`;

const agentSource = (name: string): string => `export const metadata = {
  id: "${sanitizeName(name)}",
  name: "${name}",
};

export const run = async (input: unknown): Promise<{ status: string; input: unknown }> => ({
  status: "ok",
  input,
});
`;

const buildTemplateFiles = (
  kind: TemplateKind,
  name: string,
  description: string,
): Record<string, string> => {
  if (kind === "plugin") {
    return {
      "openclaw.plugin.json": pluginManifest(name, description),
      "README.md": pluginReadme(name, description),
      "src/index.ts": pluginSource(name),
    };
  }

  return {
    "openclaw.agent.json": agentManifest(name, description),
    "README.md": agentReadme(name, description),
    "src/index.ts": agentSource(name),
  };
};

const isDirectoryEmpty = async (directory: string): Promise<boolean> => {
  try {
    const entries = await readdir(directory);
    return entries.length === 0;
  } catch {
    return true;
  }
};

export const scaffoldTemplate = async (options: ScaffoldOptions): Promise<ScaffoldResult> => {
  const baseDir = options.baseDir.trim();
  const name = options.name.trim();

  if (!baseDir) {
    throw new Error("--root is required");
  }

  if (!name) {
    throw new Error("template name is required");
  }

  const targetDir = join(baseDir, sanitizeName(name));
  const isEmpty = await isDirectoryEmpty(targetDir);

  if (!isEmpty && options.force !== true) {
    throw new Error(`target directory already exists: ${targetDir}`);
  }

  await mkdir(targetDir, { recursive: true });

  const files = buildTemplateFiles(
    options.template,
    options.name,
    options.description ?? `Generated ${options.template} scaffold`,
  );

  const written: string[] = [];
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(targetDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
    written.push(relativePath);
  }

  return {
    targetDir,
    files: written,
  };
};

export const resolveTemplateKind = (value: string | undefined): TemplateKind => {
  if (value === "plugin" || value === "agent") {
    return value;
  }

  throw new Error(`Unknown template: ${value ?? ""}`);
};

export const resolveTemplateName = (args: string[], fallback: string | undefined): string => {
  const name = args.find(
    (value) => value !== undefined && value.trim().length > 0 && !value.startsWith("--"),
  );

  if (name !== undefined) {
    return name;
  }

  if (fallback) {
    return fallback;
  }

  throw new Error("template name is required");
};
