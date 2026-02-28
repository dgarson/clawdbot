import { createHash } from "node:crypto";
import path from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { SessionSystemPromptReport } from "../config/sessions/types.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";

function extractBetween(
  input: string,
  startMarker: string,
  endMarker: string,
): { text: string; found: boolean } {
  const start = input.indexOf(startMarker);
  if (start === -1) {
    return { text: "", found: false };
  }
  const end = input.indexOf(endMarker, start + startMarker.length);
  if (end === -1) {
    return { text: input.slice(start), found: true };
  }
  return { text: input.slice(start, end), found: true };
}

function parseSkillBlocks(skillsPrompt: string): Array<{ name: string; blockChars: number }> {
  const prompt = skillsPrompt.trim();
  if (!prompt) {
    return [];
  }
  const blocks = Array.from(prompt.matchAll(/<skill>[\s\S]*?<\/skill>/gi)).map(
    (match) => match[0] ?? "",
  );
  return blocks
    .map((block) => {
      const name = block.match(/<name>\s*([^<]+?)\s*<\/name>/i)?.[1]?.trim() || "(unknown)";
      return { name, blockChars: block.length };
    })
    .filter((b) => b.blockChars > 0);
}

function buildInjectedWorkspaceFiles(params: {
  bootstrapFiles: WorkspaceBootstrapFile[];
  injectedFiles: EmbeddedContextFile[];
}): SessionSystemPromptReport["injectedWorkspaceFiles"] {
  const injectedByPath = new Map<string, string>();
  const injectedByBaseName = new Map<string, string>();
  for (const file of params.injectedFiles) {
    const pathValue = typeof file.path === "string" ? file.path.trim() : "";
    if (!pathValue) {
      continue;
    }
    if (!injectedByPath.has(pathValue)) {
      injectedByPath.set(pathValue, file.content);
    }
    const normalizedPath = pathValue.replace(/\\/g, "/");
    const baseName = path.posix.basename(normalizedPath);
    if (!injectedByBaseName.has(baseName)) {
      injectedByBaseName.set(baseName, file.content);
    }
  }
  return params.bootstrapFiles.map((file) => {
    const pathValue = typeof file.path === "string" ? file.path.trim() : "";
    const rawChars = file.missing ? 0 : (file.content ?? "").trimEnd().length;
    const injected =
      (pathValue ? injectedByPath.get(pathValue) : undefined) ??
      injectedByPath.get(file.name) ??
      injectedByBaseName.get(file.name);
    const injectedChars = injected ? injected.length : 0;
    const truncated = !file.missing && injectedChars < rawChars;
    return {
      name: file.name,
      path: pathValue || file.name,
      missing: file.missing,
      rawChars,
      injectedChars,
      truncated,
    };
  });
}

function buildToolsEntries(tools: AgentTool[]): SessionSystemPromptReport["tools"]["entries"] {
  return tools.map((tool) => {
    const name = tool.name;
    const summary = tool.description?.trim() || tool.label?.trim() || "";
    const summaryChars = summary.length;
    const schemaChars = (() => {
      if (!tool.parameters || typeof tool.parameters !== "object") {
        return 0;
      }
      try {
        return JSON.stringify(tool.parameters).length;
      } catch {
        return 0;
      }
    })();
    const propertiesCount = (() => {
      const schema =
        tool.parameters && typeof tool.parameters === "object"
          ? (tool.parameters as Record<string, unknown>)
          : null;
      const props = schema && typeof schema.properties === "object" ? schema.properties : null;
      if (!props || typeof props !== "object") {
        return null;
      }
      return Object.keys(props as Record<string, unknown>).length;
    })();
    return { name, summaryChars, schemaChars, propertiesCount };
  });
}

function extractToolListText(systemPrompt: string): string {
  const markerA = "Tool names are case-sensitive. Call tools exactly as listed.\n";
  const markerB =
    "\nTOOLS.md does not control tool availability; it is user guidance for how to use external tools.";
  const extracted = extractBetween(systemPrompt, markerA, markerB);
  if (!extracted.found) {
    return "";
  }
  return extracted.text.replace(markerA, "").trim();
}

/**
 * Parse a built system prompt into per-section character counts.
 * Sections are delimited by Markdown headings (`## Name` or `# Name`).
 * Characters that appear before the first heading are attributed to "(preamble)".
 */
export function buildSectionStats(systemPrompt: string): Record<string, number> {
  const stats: Record<string, number> = {};
  const lines = systemPrompt.split("\n");
  let currentSection = "(preamble)";
  let currentChars = 0;
  for (const line of lines) {
    const heading = /^(#{1,2}) (.+)/.exec(line);
    if (heading) {
      if (currentChars > 0) {
        stats[currentSection] = (stats[currentSection] ?? 0) + currentChars;
      }
      currentSection = heading[2].trim();
      currentChars = line.length + 1; // +1 for the newline
    } else {
      currentChars += line.length + 1;
    }
  }
  if (currentChars > 0) {
    stats[currentSection] = (stats[currentSection] ?? 0) + currentChars;
  }
  return stats;
}

export function buildSystemPromptReport(params: {
  source: SessionSystemPromptReport["source"];
  generatedAt: number;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  workspaceDir?: string;
  bootstrapMaxChars: number;
  bootstrapTotalMaxChars?: number;
  sandbox?: SessionSystemPromptReport["sandbox"];
  systemPrompt: string;
  bootstrapFiles: WorkspaceBootstrapFile[];
  injectedFiles: EmbeddedContextFile[];
  skillsPrompt: string;
  tools: AgentTool[];
  pluginSections?: import("./system-prompt.plugin-sections.js").PluginPromptSection[];
  previousSystemPromptReport?: SessionSystemPromptReport;
}): SessionSystemPromptReport {
  const systemPrompt = params.systemPrompt.trim();
  const projectContext = extractBetween(
    systemPrompt,
    "\n# Project Context\n",
    "\n## Silent Replies\n",
  );
  const projectContextChars = projectContext.text.length;
  const toolListText = extractToolListText(systemPrompt);
  const toolListChars = toolListText.length;
  const toolsEntries = buildToolsEntries(params.tools);
  const toolsSchemaChars = toolsEntries.reduce((sum, t) => sum + (t.schemaChars ?? 0), 0);
  const skillsEntries = parseSkillBlocks(params.skillsPrompt);

  const cacheDiagnostics = buildCacheDiagnostics({
    systemPrompt: params.systemPrompt,
    previousReport: params.previousSystemPromptReport,
  });

  return {
    source: params.source,
    generatedAt: params.generatedAt,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    provider: params.provider,
    model: params.model,
    workspaceDir: params.workspaceDir,
    bootstrapMaxChars: params.bootstrapMaxChars,
    bootstrapTotalMaxChars: params.bootstrapTotalMaxChars,
    sandbox: params.sandbox,
    systemPrompt: {
      chars: systemPrompt.length,
      projectContextChars,
      nonProjectContextChars: Math.max(0, systemPrompt.length - projectContextChars),
    },
    injectedWorkspaceFiles: buildInjectedWorkspaceFiles({
      bootstrapFiles: params.bootstrapFiles,
      injectedFiles: params.injectedFiles,
    }),
    skills: {
      promptChars: params.skillsPrompt.length,
      entries: skillsEntries,
    },
    tools: {
      listChars: toolListChars,
      schemaChars: toolsSchemaChars,
      entries: toolsEntries,
    },
    cacheDiagnostics,
  };
}

function buildCacheDiagnostics(params: {
  systemPrompt: string;
  previousReport?: SessionSystemPromptReport;
}): SessionSystemPromptReport["cacheDiagnostics"] {
  const sequence: import("../config/sessions/types.js").PromptSectionHash[] = [];
  const lines = params.systemPrompt.split("\n");
  let currentSection = "(preamble)";
  let currentChars = 0;
  let currentContent = "";

  const isVolatile = (name: string) =>
    name.toLowerCase().includes("time") || name.toLowerCase().includes("date");

  for (const line of lines) {
    const heading = /^(#{1,2}) (.+)/.exec(line);
    if (heading) {
      if (currentChars > 0) {
        sequence.push({
          name: currentSection,
          source: "(unknown)",
          contentLength: currentChars,
          contentHash: createHash("md5").update(currentContent).digest("hex").substring(0, 8),
          volatile: isVolatile(currentSection),
        });
      }
      currentSection = heading[2].trim();
      currentChars = line.length + 1;
      currentContent = line + "\n";
    } else {
      currentChars += line.length + 1;
      currentContent += line + "\n";
    }
  }
  if (currentChars > 0) {
    sequence.push({
      name: currentSection,
      source: "(unknown)",
      contentLength: currentChars,
      contentHash: createHash("md5").update(currentContent).digest("hex").substring(0, 8),
      volatile: isVolatile(currentSection),
    });
  }

  const currentPromptHash = createHash("md5")
    .update(params.systemPrompt)
    .digest("hex")
    .substring(0, 8);
  const previousReport = params.previousReport;
  const previousPromptHash = previousReport?.cacheDiagnostics?.currentPromptHash ?? "";

  if (!previousReport?.cacheDiagnostics?.sequence) {
    return { currentPromptHash, previousPromptHash, sequence };
  }

  let invalidatorBlock: import("../config/sessions/types.js").CacheDiagnostics["invalidatorBlock"] =
    undefined;
  let byteOffset = 0;
  let foundInvalidator = false;

  const prevSequence = previousReport.cacheDiagnostics.sequence;

  for (let i = 0; i < sequence.length; i++) {
    const current = sequence[i];
    const prev = prevSequence[i];

    if (!foundInvalidator && (!prev || current.contentHash !== prev.contentHash)) {
      foundInvalidator = true;
      current.status = "invalidated_changed";
      invalidatorBlock = {
        name: current.name,
        source: current.source,
        byteOffset,
        wastedTokensEstimated: Math.floor((params.systemPrompt.length - byteOffset) / 4),
      };
    } else if (foundInvalidator) {
      current.status = "invalidated_downstream";
    } else {
      current.status = "retained";
    }

    byteOffset += current.contentLength;
  }

  return {
    previousPromptHash,
    currentPromptHash,
    sequence,
    invalidatorBlock,
  };
}
