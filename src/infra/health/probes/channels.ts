import type { OpenClawConfig } from "../../../config/config.js";
import type { DependencyHealthProbe, DependencyHealthStatus } from "../types.js";
import { listChannelPlugins } from "../../../channels/plugins/index.js";

/** Creates one probe per enabled/configured channel (Slack, Discord, etc.). */
export function createChannelProbes(cfg: OpenClawConfig): DependencyHealthProbe[] {
  const probes: DependencyHealthProbe[] = [];

  for (const plugin of listChannelPlugins()) {
    const accountIds = plugin.config.listAccountIds(cfg);
    if (accountIds.length === 0) {
      continue;
    }

    // Check if any account is enabled
    const hasEnabled = accountIds.some((accountId) => {
      const account = plugin.config.resolveAccount(cfg, accountId);
      return plugin.config.isEnabled ? plugin.config.isEnabled(account, cfg) : true;
    });
    if (!hasEnabled) {
      continue;
    }

    const channelId = plugin.id;
    const label = plugin.meta.label ?? channelId;
    let lastStatus: DependencyHealthStatus = {
      id: channelId,
      label,
      tier: "channel",
      probeMode: "active",
      enabled: true,
      status: "unknown",
      lastProbeAt: null,
      consecutiveFailures: 0,
    };

    probes.push({
      id: channelId,
      label,
      tier: "channel",
      probeMode: "active",
      getStatus: () => lastStatus,
      async refresh() {
        const defaultAccountId = accountIds[0];
        const account = plugin.config.resolveAccount(cfg, defaultAccountId);
        if (!plugin.status?.probeAccount) {
          lastStatus = {
            ...lastStatus,
            status: "unknown",
            message: "no probe available",
            lastProbeAt: Date.now(),
          };
          return lastStatus;
        }
        try {
          const probe = await plugin.status.probeAccount({
            account,
            timeoutMs: 10_000,
            cfg,
          });
          const probeRecord =
            probe && typeof probe === "object" ? (probe as Record<string, unknown>) : null;
          const ok = probeRecord?.ok !== false;
          lastStatus = {
            ...lastStatus,
            status: ok ? "ok" : "error",
            message: ok ? undefined : ((probeRecord?.error as string) ?? "probe failed"),
            lastProbeAt: Date.now(),
            consecutiveFailures: ok ? 0 : lastStatus.consecutiveFailures + 1,
            details: probeRecord ?? undefined,
          };
        } catch (err) {
          lastStatus = {
            ...lastStatus,
            status: "error",
            message: err instanceof Error ? err.message : String(err),
            lastProbeAt: Date.now(),
            consecutiveFailures: lastStatus.consecutiveFailures + 1,
          };
        }
        return lastStatus;
      },
    });
  }

  return probes;
}
