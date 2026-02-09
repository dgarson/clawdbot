import type { ObsidianConfig } from "../../config/types.obsidian.js";
import type { LinkIndex } from "../link-index.js";
import type { VaultSelfAuthoredFilter } from "../self-authored-filter.js";
import type { VaultAccessLayer } from "../vault-access.js";

export type VaultToolsDeps = {
  vault: VaultAccessLayer;
  config?: ObsidianConfig;
  linkIndex?: LinkIndex | null;
  selfAuthoredFilter?: VaultSelfAuthoredFilter | null;
};
