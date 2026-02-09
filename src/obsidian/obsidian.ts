export { DirectVaultAccess } from "./backends/direct.js";
export { RestApiVaultAccess } from "./backends/rest-api.js";
export { NodeBridgeVaultAccess } from "./backends/node-bridge.js";
export { parseObsidianNote } from "./parser.js";
export { composeNote, mergeFrontmatter, parseFrontmatter } from "./frontmatter.js";
export { createVaultWatcher } from "./watcher.js";
export { createVaultEventRouter } from "./event-router.js";
export { buildLinkIndex, updateLinkIndex } from "./link-index.js";
export { createVaultSyncState } from "./sync-state.js";
export { safeWrite } from "./conflict-resolver.js";
export { createVaultTools } from "./tools/index.js";
export { getObsidianHealthSnapshot } from "./health.js";
export {
  startObsidianIntegration,
  stopObsidianIntegration,
  getObsidianRuntime,
} from "./startup.js";
