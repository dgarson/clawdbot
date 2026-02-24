import React, { useState } from "react";
import { cn } from "../lib/utils";

type DeviceStatus = "online" | "offline" | "warning" | "updating" | "provisioning";
type DeviceType = "sensor" | "gateway" | "controller" | "edge-compute" | "tracker";

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  firmware: string;
  location: string;
  group: string;
  ipAddress: string;
  lastSeen: string;
  uptime: number; // hours
  batteryPct: number | null;
  signalStrength: number | null; // 0-100
  cpuPct: number;
  memPct: number;
  pendingUpdates: boolean;
  tags: string[];
}

interface OTAUpdate {
  id: string;
  version: string;
  releaseDate: string;
  type: "security" | "feature" | "bugfix";
  deviceGroups: string[];
  progress: number;
  totalDevices: number;
  completedDevices: number;
  failedDevices: number;
  status: "scheduled" | "in_progress" | "completed" | "failed";
}

interface DeviceGroup {
  id: string;
  name: string;
  deviceCount: number;
  onlineCount: number;
  firmware: string;
  autoUpdate: boolean;
}

const DEVICES: Device[] = [
  {
    id: "d1", name: "Gateway-SF-01", type: "gateway", status: "online",
    firmware: "2.4.1", location: "San Francisco, CA", group: "west-coast",
    ipAddress: "10.10.1.5", lastSeen: "2026-02-22T14:31:55Z",
    uptime: 2184, batteryPct: null, signalStrength: 92,
    cpuPct: 34, memPct: 62, pendingUpdates: false, tags: ["production", "critical"],
  },
  {
    id: "d2", name: "Sensor-SF-112", type: "sensor", status: "online",
    firmware: "1.9.3", location: "San Francisco, CA", group: "west-coast",
    ipAddress: "10.10.1.112", lastSeen: "2026-02-22T14:31:40Z",
    uptime: 840, batteryPct: 67, signalStrength: 78,
    cpuPct: 8, memPct: 22, pendingUpdates: true, tags: ["production"],
  },
  {
    id: "d3", name: "EdgeComp-NYC-03", type: "edge-compute", status: "warning",
    firmware: "3.1.0", location: "New York, NY", group: "east-coast",
    ipAddress: "10.20.1.3", lastSeen: "2026-02-22T14:30:12Z",
    uptime: 672, batteryPct: null, signalStrength: 55,
    cpuPct: 87, memPct: 91, pendingUpdates: true, tags: ["production", "high-load"],
  },
  {
    id: "d4", name: "Tracker-CHI-028", type: "tracker", status: "online",
    firmware: "1.9.3", location: "Chicago, IL", group: "midwest",
    ipAddress: "10.30.1.28", lastSeen: "2026-02-22T14:31:50Z",
    uptime: 420, batteryPct: 45, signalStrength: 83,
    cpuPct: 12, memPct: 31, pendingUpdates: false, tags: ["fleet"],
  },
  {
    id: "d5", name: "Controller-LA-07", type: "controller", status: "updating",
    firmware: "2.4.1", location: "Los Angeles, CA", group: "west-coast",
    ipAddress: "10.10.2.7", lastSeen: "2026-02-22T14:28:00Z",
    uptime: 0, batteryPct: null, signalStrength: 71,
    cpuPct: 45, memPct: 48, pendingUpdates: false, tags: ["production"],
  },
  {
    id: "d6", name: "Sensor-NYC-084", type: "sensor", status: "offline",
    firmware: "1.8.9", location: "New York, NY", group: "east-coast",
    ipAddress: "10.20.1.84", lastSeen: "2026-02-22T10:15:00Z",
    uptime: 0, batteryPct: 12, signalStrength: 0,
    cpuPct: 0, memPct: 0, pendingUpdates: true, tags: ["production"],
  },
  {
    id: "d7", name: "Gateway-SEA-01", type: "gateway", status: "online",
    firmware: "2.4.1", location: "Seattle, WA", group: "west-coast",
    ipAddress: "10.10.3.1", lastSeen: "2026-02-22T14:31:55Z",
    uptime: 1440, batteryPct: null, signalStrength: 98,
    cpuPct: 28, memPct: 54, pendingUpdates: false, tags: ["production", "critical"],
  },
  {
    id: "d8", name: "Tracker-DEN-015", type: "tracker", status: "provisioning",
    firmware: "1.9.3", location: "Denver, CO", group: "midwest",
    ipAddress: "10.30.2.15", lastSeen: "2026-02-22T14:29:00Z",
    uptime: 0, batteryPct: 89, signalStrength: 66,
    cpuPct: 5, memPct: 18, pendingUpdates: false, tags: ["fleet", "new"],
  },
];

const OTA_UPDATES: OTAUpdate[] = [
  {
    id: "u1", version: "2.4.2", releaseDate: "2026-02-20", type: "security",
    deviceGroups: ["west-coast", "east-coast"], progress: 68,
    totalDevices: 142, completedDevices: 97, failedDevices: 3,
    status: "in_progress",
  },
  {
    id: "u2", version: "1.9.4", releaseDate: "2026-02-18", type: "bugfix",
    deviceGroups: ["midwest"], progress: 100,
    totalDevices: 58, completedDevices: 58, failedDevices: 0,
    status: "completed",
  },
  {
    id: "u3", version: "3.2.0", releaseDate: "2026-03-01", type: "feature",
    deviceGroups: ["west-coast"], progress: 0,
    totalDevices: 89, completedDevices: 0, failedDevices: 0,
    status: "scheduled",
  },
];

const DEVICE_GROUPS: DeviceGroup[] = [
  { id: "g1", name: "west-coast", deviceCount: 89, onlineCount: 82, firmware: "2.4.1", autoUpdate: true },
  { id: "g2", name: "east-coast", deviceCount: 67, onlineCount: 61, firmware: "3.1.0", autoUpdate: true },
  { id: "g3", name: "midwest", deviceCount: 58, onlineCount: 53, firmware: "1.9.3", autoUpdate: false },
];

const TABS = ["Fleet", "Updates", "Groups", "Diagnostics"] as const;
type Tab = typeof TABS[number];

const statusColor: Record<DeviceStatus, string> = {
  online:       "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  offline:      "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/30",
  warning:      "text-amber-400 bg-amber-400/10 border-amber-400/30",
  updating:     "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  provisioning: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const deviceTypeEmoji: Record<DeviceType, string> = {
  sensor:       "📡",
  gateway:      "🔗",
  controller:   "🎛️",
  "edge-compute": "💻",
  tracker:      "📍",
};

const updateTypeColor: Record<OTAUpdate["type"], string> = {
  security: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  feature:  "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  bugfix:   "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

export default function FleetDeviceManager(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Fleet");
  const [selectedDevice, setSelectedDevice] = useState<Device>(DEVICES[0]);
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const filteredDevices = DEVICES.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) {return false;}
    if (groupFilter !== "all" && d.group !== groupFilter) {return false;}
    return true;
  });

  const onlineCount = DEVICES.filter(d => d.status === "online").length;
  const offlineCount = DEVICES.filter(d => d.status === "offline").length;
  const warningCount = DEVICES.filter(d => d.status === "warning").length;
  const updatingCount = DEVICES.filter(d => d.status === "updating").length;

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Fleet Device Manager</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">IoT device fleet management — monitoring, OTA updates, and diagnostics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-400">{onlineCount} online</span>
            <span className="text-amber-400">{warningCount} warning</span>
            <span className="text-[var(--color-text-secondary)]">{offlineCount} offline</span>
          </div>
          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">
            + Provision Device
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-indigo-400 border-indigo-500"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── FLEET ── */}
        {tab === "Fleet" && (
          <div className="h-full flex">
            {/* Filter + list */}
            <div className="w-72 border-r border-[var(--color-border)] flex flex-col">
              <div className="p-3 space-y-2 border-b border-[var(--color-border)]">
                <div className="flex flex-wrap gap-1">
                  {(["all", "online", "offline", "warning", "updating"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded border transition-colors",
                        statusFilter === s ? "bg-indigo-600/20 border-indigo-500 text-indigo-300" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none"
                >
                  <option value="all">All groups</option>
                  {DEVICE_GROUPS.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]/50">
                {filteredDevices.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDevice(d)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors",
                      selectedDevice.id === d.id ? "bg-indigo-600/10" : "hover:bg-[var(--color-surface-2)]/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{deviceTypeEmoji[d.type]}</span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)] truncate max-w-[110px]">{d.name}</span>
                      </div>
                      <span className={cn("text-[10px] px-1 py-0.5 rounded border shrink-0", statusColor[d.status])}>{d.status}</span>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{d.location} · fw {d.firmware}</div>
                    {d.batteryPct !== null && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-16 h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", d.batteryPct > 50 ? "bg-emerald-500" : d.batteryPct > 20 ? "bg-amber-500" : "bg-rose-500")}
                            style={{ width: `${d.batteryPct}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{d.batteryPct}%</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Device detail */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{deviceTypeEmoji[selectedDevice.type]}</span>
                  <div>
                    <h2 className="text-lg font-bold">{selectedDevice.name}</h2>
                    <div className="text-xs text-[var(--color-text-secondary)]">{selectedDevice.location} · {selectedDevice.group}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", statusColor[selectedDevice.status])}>{selectedDevice.status}</span>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] rounded-md transition-colors">Reboot</button>
                  <button className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] rounded-md transition-colors">SSH</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Firmware", value: `v${selectedDevice.firmware}`, warn: selectedDevice.pendingUpdates },
                  { label: "IP Address", value: selectedDevice.ipAddress },
                  { label: "Uptime", value: selectedDevice.uptime > 0 ? `${selectedDevice.uptime}h` : "—" },
                  { label: "Last Seen", value: selectedDevice.lastSeen.slice(11, 19) },
                ].map((m) => (
                  <div key={m.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3">
                    <div className="text-xs text-[var(--color-text-muted)]">{m.label}</div>
                    <div className={cn("text-sm font-medium mt-1", m.warn ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
                      {m.value} {m.warn && <span className="text-[10px]">⚠ update available</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Resource meters */}
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <h3 className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-4">Resources</h3>
                <div className="space-y-4">
                  {[
                    { label: "CPU", value: selectedDevice.cpuPct },
                    { label: "Memory", value: selectedDevice.memPct },
                    ...(selectedDevice.signalStrength !== null ? [{ label: "Signal", value: selectedDevice.signalStrength }] : []),
                    ...(selectedDevice.batteryPct !== null ? [{ label: "Battery", value: selectedDevice.batteryPct }] : []),
                  ].map((r) => (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-[var(--color-text-secondary)]">{r.label}</span>
                        <span className={cn("font-mono", r.value > 80 ? "text-rose-400" : r.value > 60 ? "text-amber-400" : "text-emerald-400")}>
                          {r.value}%
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", r.value > 80 ? "bg-rose-500" : r.value > 60 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${r.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {selectedDevice.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)]">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UPDATES ── */}
        {tab === "Updates" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {OTA_UPDATES.map((update) => (
              <div key={update.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold font-mono">v{update.version}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", updateTypeColor[update.type])}>{update.type}</span>
                      <span className={cn("text-xs",
                        update.status === "completed" ? "text-emerald-400" :
                        update.status === "failed" ? "text-rose-400" :
                        update.status === "in_progress" ? "text-indigo-400" : "text-[var(--color-text-secondary)]"
                      )}>{update.status.replace("_", " ")}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">Released {update.releaseDate} · Groups: {update.deviceGroups.join(", ")}</div>
                  </div>
                </div>
                {update.status === "in_progress" && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1.5">
                      <span>Deployment Progress</span>
                      <span>{update.completedDevices}/{update.totalDevices} devices</span>
                    </div>
                    <div className="h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${update.progress}%` }} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">{update.totalDevices}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">{update.completedDevices}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-rose-400">{update.failedDevices}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Failed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab === "Groups" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {DEVICE_GROUPS.map((g) => (
              <div key={g.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold">{g.name}</h3>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">Firmware: v{g.firmware} · Auto-update: {g.autoUpdate ? "enabled" : "disabled"}</div>
                  </div>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300">Configure</button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1.5">
                      <span>Online</span>
                      <span>{g.onlineCount}/{g.deviceCount}</span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(g.onlineCount / g.deviceCount) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {Math.round((g.onlineCount / g.deviceCount) * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DIAGNOSTICS ── */}
        {tab === "Diagnostics" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-medium">Device Health Overview</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {["Device", "Status", "CPU", "Memory", "Battery", "Signal", "FW"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-[var(--color-text-muted)] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {DEVICES.map((d) => (
                      <tr key={d.id} className="hover:bg-[var(--color-surface-2)]/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{deviceTypeEmoji[d.type]}</span>
                            <div>
                              <div className="text-sm">{d.name}</div>
                              <div className="text-[10px] text-[var(--color-text-muted)]">{d.group}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs", statusColor[d.status].split(" ")[0])}>{d.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-mono", d.cpuPct > 80 ? "text-rose-400" : d.cpuPct > 60 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
                            {d.cpuPct}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-mono", d.memPct > 80 ? "text-rose-400" : d.memPct > 60 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
                            {d.memPct}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-[var(--color-text-secondary)]">{d.batteryPct !== null ? `${d.batteryPct}%` : "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-[var(--color-text-secondary)]">{d.signalStrength !== null ? `${d.signalStrength}%` : "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs", d.pendingUpdates ? "text-amber-400" : "text-[var(--color-text-secondary)]")}>
                            {d.firmware} {d.pendingUpdates && "⚠"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
