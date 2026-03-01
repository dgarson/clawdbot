import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import { registerCostCollector } from "./src/collector.js";
import { createCostTrackerStore, wireCostTrackerHooks } from "./src/store.js";

export default function register(api: OpenClawPluginApi) {
  const stateDir = api.runtime.state.resolveStateDir();
  const store = createCostTrackerStore(stateDir);
  wireCostTrackerHooks(api, store);
  registerCostCollector(api, store);
}
