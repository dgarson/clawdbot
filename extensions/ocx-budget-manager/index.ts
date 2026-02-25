import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerAdmissionHook } from "./src/admission.js";
import { resolveConfig } from "./src/config.js";
import { Ledger } from "./src/ledger.js";
import { registerMidRunGuardHook } from "./src/mid-run-guard.js";
import { loadPriceTable } from "./src/price-table.js";
import { registerReportingMethods } from "./src/reporting.js";
import { loadScopeResolver } from "./src/scope-resolver.js";
import { registerTrackerHook } from "./src/tracker.js";

export default async function register(api: OpenClawPluginApi): Promise<void> {
  const config = resolveConfig(api.pluginConfig);
  const stateDir = api.runtime.state.resolveStateDir();

  // Load configuration files from state directory
  const [scopeResolver, priceTable] = await Promise.all([
    loadScopeResolver(stateDir, config.hierarchyFile, api.logger),
    loadPriceTable(stateDir, config.priceTableFile, api.logger),
  ]);

  const ledger = new Ledger(stateDir, api.logger);

  api.logger.info(
    `budget-manager: initialized (enforcement=${config.enforcement}, window=${config.defaultWindow})`,
  );

  // Register hooks
  registerAdmissionHook(api, scopeResolver, ledger, config);
  registerTrackerHook(api, scopeResolver, ledger, priceTable, config);
  registerMidRunGuardHook(api, scopeResolver, ledger, config);

  // Register gateway methods for reporting
  registerReportingMethods(api, scopeResolver, ledger, config, stateDir);
}
