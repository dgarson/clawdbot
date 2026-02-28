import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerAdmissionHook } from "./src/admission.js";
import { resolveConfig } from "./src/config.js";
import { Ledger } from "./src/ledger.js";
import { registerMidRunGuardHook } from "./src/mid-run-guard.js";
import { loadPriceTable } from "./src/price-table.js";
import { registerReportingMethods } from "./src/reporting.js";
import { loadScopeResolver } from "./src/scope-resolver.js";
import { registerTrackerHook } from "./src/tracker.js";

export default function register(api: OpenClawPluginApi): void {
  const config = resolveConfig(api.pluginConfig);
  const stateDir = api.runtime.state.resolveStateDir();

  const ledger = new Ledger(stateDir, api.logger);

  // Async config loading is deferred to the service start hook where
  // Promise<void> is supported by the plugin lifecycle.
  api.registerService({
    id: "ocx-budget-manager",
    async start(ctx) {
      const [scopeResolver, priceTable] = await Promise.all([
        loadScopeResolver(stateDir, config.hierarchyFile, ctx.logger),
        loadPriceTable(stateDir, config.priceTableFile, ctx.logger),
      ]);

      // Register hooks now that async dependencies are ready
      registerAdmissionHook(api, scopeResolver, ledger, config);
      registerTrackerHook(api, scopeResolver, ledger, priceTable, config);
      registerMidRunGuardHook(api, scopeResolver, ledger, config);

      // Register gateway methods for reporting
      registerReportingMethods(api, scopeResolver, ledger, config, stateDir);

      ctx.logger.info(
        `budget-manager: initialized (enforcement=${config.enforcement}, window=${config.defaultWindow})`,
      );
    },
  });
}
