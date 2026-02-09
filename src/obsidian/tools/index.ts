import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { ObsidianConfig } from "../../config/types.obsidian.js";
import type { LinkIndex } from "../link-index.js";
import type { VaultSelfAuthoredFilter } from "../self-authored-filter.js";
import type { VaultAccessLayer } from "../vault-access.js";
import { createVaultDailyNoteTool } from "./daily-note-tool.js";
import { createVaultQueryTool } from "./query-tools.js";
import {
  createVaultGetBacklinksTool,
  createVaultGetFrontmatterTool,
  createVaultGetLinksTool,
  createVaultGetTagsTool,
  createVaultListNotesTool,
  createVaultReadNoteTool,
  createVaultSearchTool,
} from "./read-tools.js";
import {
  createVaultAppendToNoteTool,
  createVaultCreateNoteTool,
  createVaultDeleteNoteTool,
  createVaultMoveNoteTool,
  createVaultSetFrontmatterTool,
  createVaultUpdateNoteTool,
} from "./write-tools.js";

export type ObsidianToolsOptions = {
  vault: VaultAccessLayer;
  config?: ObsidianConfig;
  linkIndex?: LinkIndex | null;
  selfAuthoredFilter?: VaultSelfAuthoredFilter | null;
};

export function createVaultTools(options: ObsidianToolsOptions): AnyAgentTool[] {
  const deps = {
    vault: options.vault,
    config: options.config,
    linkIndex: options.linkIndex ?? null,
    selfAuthoredFilter: options.selfAuthoredFilter ?? null,
  };

  return [
    createVaultSearchTool(deps),
    createVaultReadNoteTool(deps),
    createVaultListNotesTool(deps),
    createVaultGetFrontmatterTool(deps),
    createVaultGetLinksTool(deps),
    createVaultGetBacklinksTool(deps),
    createVaultGetTagsTool(deps),
    createVaultQueryTool(deps),
    createVaultCreateNoteTool(deps),
    createVaultUpdateNoteTool(deps),
    createVaultAppendToNoteTool(deps),
    createVaultSetFrontmatterTool(deps),
    createVaultDeleteNoteTool(deps),
    createVaultMoveNoteTool(deps),
    createVaultDailyNoteTool(deps),
  ];
}
