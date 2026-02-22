import React, { useState } from 'react';
import { cn } from '../lib/utils';
import {
  Smartphone, Monitor, Server, Wifi, WifiOff, Camera,
  MapPin, Bell, Play, ChevronRight, Plus, RefreshCw,
  Check, X, AlertTriangle, Globe, Cpu, Battery
} from 'lucide-react';
import { MOCK_NODES, formatRelativeTime } from '../mock-data';
import type { Node, NodeStatus } from '../types';

function getPlatformIcon(platform: string) {
  if (platform === 'ios' || platform === 'android') return Smartphone;
  if (platform === 'darwin') return Monitor;
  return Server;
}

function getPlatformLabel(platform: string) {
  const labels: Record<string, string> = {
    ios: 'iOS',
    android: 'Android',
    darwin: 'macOS',
    linux: 'Linux',
    windows: 'Windows',
  };
  return labels[platform] ?? platform;
}

function getStatusConfig(status: NodeStatus) {
  const configs = {
    online: { color: 'text-green-400', dot: 'bg-green-500', pulse: true, label: 'Online' },
    offline: { color: 'text-gray-500', dot: 'bg-gray-600', pulse: false, label: 'Offline' },
    pairing: { color: 'text-amber-400', dot: 'bg-amber-500', pulse: true, label: 'Pairing' },
    error: { color: 'text-red-400', dot: 'bg-red-500', pulse: false, label: 'Error' },
  };
  return configs[status];
}

const CAPABILITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  screen: Monitor,
  camera: Camera,
  location: MapPin,
  notifications: Bell,
  voice: Play,
  exec: Play,
  storage: Server,
};

interface NodeCardProps {
  node: Node;
  selected: boolean;
  onSelect: () => void;
}

function NodeCard({ node, selected, onSelect }: NodeCardProps) {
  const PlatformIcon = getPlatformIcon(node.platform);
  const statusConfig = getStatusConfig(node.status);
  const isOnline = node.status === 'online';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full p-5 rounded-2xl border text-left transition-all duration-200 group',
        selected
          ? 'bg-violet-600/10 border-violet-500 ring-2 ring-violet-500/20'
          : isOnline
          ? 'bg-gray-900 border-gray-800 hover:border-green-500/40'
          : 'bg-gray-900/50 border-gray-800/60 hover:border-gray-700'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Platform icon */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
          isOnline ? 'bg-green-500/10' : 'bg-gray-800'
        )}>
          <PlatformIcon className={cn('w-6 h-6', isOnline ? 'text-green-400' : 'text-gray-500')} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-white truncate">{node.name}</h3>
            {/* Status dot */}
            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
              <div className={cn('w-2 h-2 rounded-full', statusConfig.dot, statusConfig.pulse && 'animate-pulse')} />
              <span className={cn('text-xs', statusConfig.color)}>{statusConfig.label}</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-3">{getPlatformLabel(node.platform)} · {node.version}</p>

          {/* Capabilities */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {node.capabilities.map((cap) => {
              const CapIcon = CAPABILITY_ICONS[cap] ?? Globe;
              return (
                <div key={cap} className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                  isOnline ? 'bg-gray-800 text-gray-300' : 'bg-gray-800/50 text-gray-600'
                )}>
                  <CapIcon className="w-3 h-3" />
                  {cap}
                </div>
              );
            })}
          </div>

          {/* Last seen */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {isOnline ? 'Active now' : `Last seen ${formatRelativeTime(node.lastSeen)}`}
            </p>
            {node.ipAddress && (
              <p className="text-xs font-mono text-gray-600">{node.ipAddress}</p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

interface PendingPairingProps {
  onApprove: () => void;
  onReject: () => void;
}

function PendingPairingCard({ onApprove, onReject }: PendingPairingProps) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white mb-0.5">New pairing request</p>
          <p className="text-xs text-amber-400/80 mb-1">iPhone 15 Pro — iOS 17.4</p>
          <p className="text-xs text-gray-500 font-mono">Pair code: <span className="text-amber-300">4821</span></p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReject}
            className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-red-600/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="w-9 h-9 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 flex items-center justify-center transition-all"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NodeDetailPanel({ node, onClose }: { node: Node; onClose: () => void }) {
  const PlatformIcon = getPlatformIcon(node.platform);
  const statusConfig = getStatusConfig(node.status);
  const isOnline = node.status === 'online';

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 h-fit sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Node Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5">
        {/* Identity */}
        <div className="flex items-center gap-3 mb-5">
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', isOnline ? 'bg-green-500/10' : 'bg-gray-800')}>
            <PlatformIcon className={cn('w-7 h-7', isOnline ? 'text-green-400' : 'text-gray-500')} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{node.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn('w-2 h-2 rounded-full', statusConfig.dot, statusConfig.pulse && 'animate-pulse')} />
              <span className={cn('text-xs', statusConfig.color)}>{statusConfig.label}</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Platform', value: getPlatformLabel(node.platform), icon: Cpu },
            { label: 'Version', value: node.version ?? 'Unknown', icon: Globe },
            { label: 'Last Seen', value: isOnline ? 'Now' : formatRelativeTime(node.lastSeen), icon: Wifi },
            { label: 'Capabilities', value: `${node.capabilities.length} features`, icon: Play },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-gray-800/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-gray-500" />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className="text-sm font-medium text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* IP */}
        {node.ipAddress && (
          <div className="bg-gray-800/50 rounded-xl p-3 mb-5">
            <p className="text-xs text-gray-500 mb-1">IP Address</p>
            <p className="text-sm font-mono text-gray-300">{node.ipAddress}</p>
          </div>
        )}

        {/* Capabilities detail */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">Capabilities</p>
          <div className="space-y-2">
            {node.capabilities.map((cap) => {
              const CapIcon = CAPABILITY_ICONS[cap] ?? Globe;
              return (
                <div key={cap} className="flex items-center gap-2 py-1.5 px-3 bg-gray-800/40 rounded-lg">
                  <CapIcon className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-sm text-gray-300 capitalize">{cap}</span>
                  <Check className="w-3 h-3 text-green-500 ml-auto" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Node ID */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-1">Node ID</p>
          <p className="text-xs font-mono text-gray-400 bg-gray-800 rounded-lg px-2 py-1.5 break-all">{node.id}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isOnline && (
            <>
              <button type="button" className="w-full py-2 px-4 bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Bell className="w-4 h-4" />
                Send Notification
              </button>
              <button type="button" className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                Run Command
              </button>
            </>
          )}
          <button type="button" className="w-full py-2 px-4 bg-red-600/10 hover:bg-red-600/15 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-red-600/20">
            <X className="w-4 h-4" />
            Unpair Device
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function NodeManager() {
  const [nodes, setNodes] = useState(MOCK_NODES);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const selected = nodes.find(n => n.id === selectedNode) ?? null;

  const filteredNodes = nodes.filter(n => {
    if (filter === 'online') return n.status === 'online';
    if (filter === 'offline') return n.status !== 'online';
    return true;
  });

  const onlineCount = nodes.filter(n => n.status === 'online').length;

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Smartphone className="w-6 h-6 text-violet-400" />
              Nodes
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {onlineCount} of {nodes.length} device{nodes.length !== 1 ? 's' : ''} online
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-400 rounded-xl text-sm border border-gray-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Pair Device
            </button>
          </div>
        </div>

        {/* Pending pairing */}
        {showPending && (
          <div className="mb-6">
            <PendingPairingCard
              onApprove={() => setShowPending(false)}
              onReject={() => setShowPending(false)}
            />
          </div>
        )}

        <div className="flex gap-6">
          {/* Left: node list */}
          <div className="flex-1">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 mb-4 bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
              {(['all', 'online', 'offline'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all',
                    filter === f ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Node cards */}
            <div className="space-y-3">
              {filteredNodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={selectedNode === node.id}
                  onSelect={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                />
              ))}

              {filteredNodes.length === 0 && (
                <div className="text-center py-16">
                  <WifiOff className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No {filter} devices</h3>
                  <p className="text-sm text-gray-700">
                    {filter === 'online' ? 'All your devices are currently offline.' : 'All devices are online.'}
                  </p>
                </div>
              )}
            </div>

            {/* Stats bar */}
            <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-white">{nodes.length}</p>
                  <p className="text-xs text-gray-500">Total Devices</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-400">{onlineCount}</p>
                  <p className="text-xs text-gray-500">Online</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-500">{nodes.length - onlineCount}</p>
                  <p className="text-xs text-gray-500">Offline</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: detail panel */}
          {selected && (
            <div className="w-72 flex-shrink-0">
              <NodeDetailPanel node={selected} onClose={() => setSelectedNode(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
