import { useState, useEffect } from 'react';
import {
  Clock,
  Edit,
  Eye,
  MessageSquare,
  Plus,
  RefreshCcw,
  Send,
  Trash,
  Users,
  Zap,
  Globe,
  BarChart,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type ChannelStatus = 'connected' | 'disconnected' | 'degraded';

interface Channel {
  id: string;
  name: string;
  icon: React.ElementType;
  status: ChannelStatus;
  lastMessage: Date | null;
  countToday: number;
  latencyMs: number;
}

type BroadcastStatus = 'delivered' | 'failed' | 'pending';

interface Broadcast {
  id: string;
  timestamp: Date;
  message: string;
  channels: string[];
  status: { [channelId: string]: BroadcastStatus };
}

interface ScheduledBroadcast extends Broadcast {
  scheduledTime: Date;
}

interface FailedDelivery {
  id: string;
  broadcastId: string;
  channelId: string;
  error: string;
  attempts: number;
  lastAttempt: Date;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_CHANNELS: Channel[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    status: 'connected',
    lastMessage: new Date(Date.now() - 120000),
    countToday: 45,
    latencyMs: 120,
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: Users,
    status: 'connected',
    lastMessage: new Date(Date.now() - 300000),
    countToday: 28,
    latencyMs: 85,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    status: 'degraded',
    lastMessage: new Date(Date.now() - 60000),
    countToday: 62,
    latencyMs: 450,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: Globe,
    status: 'disconnected',
    lastMessage: null,
    countToday: 0,
    latencyMs: 0,
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: Zap,
    status: 'connected',
    lastMessage: new Date(Date.now() - 1800000),
    countToday: 15,
    latencyMs: 200,
  },
  {
    id: 'sms',
    name: 'SMS',
    icon: MessageSquare,
    status: 'connected',
    lastMessage: new Date(Date.now() - 360000),
    countToday: 8,
    latencyMs: 150,
  },
];

const MOCK_HISTORY: Broadcast[] = Array.from({ length: 12 }, (_, i) => ({
  id: `bc${i + 1}`,
  timestamp: new Date(Date.now() - i * 3600000),
  message: `Broadcast message #${i + 1} - Important update for all users.`,
  channels: MOCK_CHANNELS.slice(0, (i % 5) + 2).map((c) => c.id),
  status: MOCK_CHANNELS.reduce((acc, c) => {
    acc[c.id] = Math.random() > 0.1 ? 'delivered' : 'failed';
    return acc;
  }, {} as { [key: string]: BroadcastStatus }),
}));

const MOCK_SCHEDULED: ScheduledBroadcast[] = [
  {
    id: 'sc1',
    timestamp: new Date(),
    message: 'Scheduled maintenance notice',
    channels: ['slack', 'discord', 'telegram'],
    status: {},
    scheduledTime: new Date(Date.now() + 3600000),
  },
  {
    id: 'sc2',
    timestamp: new Date(),
    message: 'Weekly update broadcast',
    channels: ['whatsapp', 'twitter', 'sms'],
    status: {},
    scheduledTime: new Date(Date.now() + 7200000),
  },
];

const MOCK_FAILED: FailedDelivery[] = [
  {
    id: 'fd1',
    broadcastId: 'bc3',
    channelId: 'telegram',
    error: 'Rate limit exceeded',
    attempts: 2,
    lastAttempt: new Date(Date.now() - 120000),
  },
  {
    id: 'fd2',
    broadcastId: 'bc5',
    channelId: 'whatsapp',
    error: 'Authentication failed',
    attempts: 1,
    lastAttempt: new Date(Date.now() - 300000),
  },
];

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(date: Date | null): string {
  return date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
}

function formatDuration(ms: number): string {
  if (ms < 0) {return 'Overdue';}
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatLatency(ms: number): string {
  return ms > 0 ? `${ms}ms` : 'N/A';
}

function getStatusColor(status: ChannelStatus): string {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'degraded': return 'bg-amber-500';
    case 'disconnected': return 'bg-red-500';
  }
}

function getBroadcastStatusColor(status: BroadcastStatus): string {
  switch (status) {
    case 'delivered': return 'text-green-400';
    case 'failed': return 'text-red-400';
    case 'pending': return 'text-amber-400';
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status, className }: { status: ChannelStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize', className,
      status === 'connected' && 'bg-green-500/10 text-green-400',
      status === 'degraded' && 'bg-amber-500/10 text-amber-400',
      status === 'disconnected' && 'bg-red-500/10 text-red-400'
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', getStatusColor(status))} />
      {status}
    </span>
  );
}

function LatencyBadge({ ms }: { ms: number }) {
  const color = ms < 200 ? 'bg-green-500/10 text-green-400' : ms < 500 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', color)}>
      <Zap className="w-3 h-3" />
      {formatLatency(ms)}
    </span>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  const Icon = channel.icon;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-zinc-400" />
          <span className="font-medium text-white">{channel.name}</span>
        </div>
        <StatusBadge status={channel.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-zinc-500">
          Last Msg
          <div className="text-white mt-0.5">{formatTimestamp(channel.lastMessage)}</div>
        </div>
        <div className="text-zinc-500">
          Today
          <div className="text-white mt-0.5">{channel.countToday} msgs</div>
        </div>
      </div>
      <LatencyBadge ms={channel.latencyMs} />
    </div>
  );
}

function BroadcastComposer({
  channels,
  onSend,
  onSchedule,
}: {
  channels: Channel[];
  onSend: (data: { message: string; channels: string[]; schedule?: Date }) => void;
  onSchedule: (data: { message: string; channels: string[]; schedule: Date }) => void;
}) {
  const [message, setMessage] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<Date | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    if (!message || selectedChannels.length === 0) {return;}
    if (scheduleMode && scheduleTime) {
      onSchedule({ message, channels: selectedChannels, schedule: scheduleTime });
    } else {
      onSend({ message, channels: selectedChannels });
    }
    setMessage('');
    setSelectedChannels([]);
    setScheduleMode(false);
    setScheduleTime(null);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">New Broadcast</h3>
        <button onClick={() => setShowPreview(!showPreview)} className="text-zinc-400 hover:text-white">
          <Eye className="w-5 h-5" />
        </button>
      </div>

      {/* Target Selector */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400">Target Channels</label>
        <div className="grid grid-cols-3 gap-2">
          {channels.map((ch) => (
            <label key={ch.id} className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={selectedChannels.includes(ch.id)}
                onChange={() => toggleChannel(ch.id)}
                className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              {ch.name}
            </label>
          ))}
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-violet-500"
          placeholder="Type your broadcast message..."
        />
        <div className="text-xs text-zinc-500 text-right">{message.length} characters</div>
      </div>

      {/* Schedule */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={scheduleMode}
            onChange={(e) => setScheduleMode(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
          />
          Schedule for later
        </label>
        {scheduleMode && (
          <input
            type="datetime-local"
            onChange={(e) => setScheduleTime(e.target.value ? new Date(e.target.value) : null)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        )}
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Preview</label>
          <div className="grid grid-cols-2 gap-2">
            {selectedChannels.map((id) => {
              const ch = channels.find((c) => c.id === id);
              return (
                <div key={id} className="bg-zinc-800 p-2 rounded-lg text-xs">
                  <div className="font-medium mb-1">{ch?.name} Preview</div>
                  <p className="text-zinc-300">{message} {ch?.id === 'twitter' ? '(truncated to 280 chars)' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!message || selectedChannels.length === 0}
          className="flex-1 bg-violet-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scheduleMode ? 'Schedule' : 'Send Now'}
        </button>
      </div>
    </div>
  );
}

function HistoryTable({ history }: { history: Broadcast[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <BarChart className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Broadcast History</span>
      </div>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="text-left text-zinc-400">
              <th className="p-3">Time</th>
              <th className="p-3">Message</th>
              <th className="p-3">Channels</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {history.map((bc) => (
              <tr key={bc.id} className="hover:bg-zinc-800">
                <td className="p-3">{formatTimestamp(bc.timestamp)}</td>
                <td className="p-3 truncate max-w-xs">{bc.message}</td>
                <td className="p-3">{bc.channels.length}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {bc.channels.map((ch) => (
                      <span key={ch} className={cn('text-xs', getBroadcastStatusColor(bc.status[ch]))}>
                        {ch[0].toUpperCase()}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingBroadcasts({ scheduled, onCancel, onEdit }: { scheduled: ScheduledBroadcast[]; onCancel: (id: string) => void; onEdit: (id: string) => void }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Pending Scheduled</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {scheduled.map((sc) => {
          const remaining = sc.scheduledTime.getTime() - now;
          return (
            <div key={sc.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Send in {formatDuration(remaining)}</span>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(sc.id)} className="text-zinc-400 hover:text-white">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => onCancel(sc.id)} className="text-zinc-400 hover:text-red-400">
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-400">{sc.message}</p>
              <div className="flex gap-1">
                {sc.channels.map((ch) => <span key={ch} className="text-xs text-zinc-500">{ch}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FailedLog({ failed, onRetry }: { failed: FailedDelivery[]; onRetry: (id: string) => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-white">Failed Deliveries</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {failed.map((fd) => (
          <div key={fd.id} className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{fd.channelId} (Broadcast {fd.broadcastId})</span>
              <button onClick={() => onRetry(fd.id)} className="text-zinc-400 hover:text-green-400">
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-red-400">{fd.error}</p>
            <div className="text-xs text-zinc-500">Attempts: {fd.attempts} · Last: {formatTimestamp(fd.lastAttempt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsRow({
  messagesToday,
  activeChannels,
  scheduled,
  deliveryRate,
}: {
  messagesToday: number;
  activeChannels: number;
  scheduled: number;
  deliveryRate: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-400 uppercase">Messages Today</div>
        <div className="text-xl font-bold text-white mt-1">{messagesToday}</div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-400 uppercase">Active Channels</div>
        <div className="text-xl font-bold text-white mt-1">{activeChannels}/6</div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-400 uppercase">Scheduled</div>
        <div className="text-xl font-bold text-white mt-1">{scheduled}</div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-400 uppercase">Delivery Rate</div>
        <div className="text-xl font-bold text-white mt-1">{deliveryRate}%</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ChannelBroadcastCenter() {
  const [channels] = useState(MOCK_CHANNELS);
  const [history] = useState(MOCK_HISTORY);
  const [scheduled, setScheduled] = useState(MOCK_SCHEDULED);
  const [failed, setFailed] = useState(MOCK_FAILED);

  const activeChannels = channels.filter((c) => c.status === 'connected').length;
  const messagesToday = channels.reduce((sum, c) => sum + c.countToday, 0);
  const deliveryRate = 98; // mock
  const scheduledCount = scheduled.length;

  const handleSend = (data: { message: string; channels: string[] }) => {
    console.log('Sending broadcast:', data);
    // In real app, add to history
  };

  const handleSchedule = (data: { message: string; channels: string[]; schedule: Date }) => {
    console.log('Scheduling broadcast:', data);
    setScheduled((prev) => [...prev, { ...data, id: `sc${prev.length + 1}`, timestamp: new Date(), status: {} }]);
  };

  const handleCancel = (id: string) => {
    setScheduled((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEdit = (id: string) => {
    console.log('Edit scheduled:', id);
    // Implement edit logic
  };

  const handleRetry = (id: string) => {
    console.log('Retry failed:', id);
    setFailed((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-violet-400" />
            Broadcast Center
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">Unified channel management & messaging</p>
        </div>
        <button className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-500">
          <Plus className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* Stats Row */}
      <StatsRow
        messagesToday={messagesToday}
        activeChannels={activeChannels}
        scheduled={scheduledCount}
        deliveryRate={deliveryRate}
      />

      {/* Channel Grid */}
      <div className="grid grid-cols-3 gap-4">
        {channels.map((ch) => <ChannelCard key={ch.id} channel={ch} />)}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Composer */}
        <div className="col-span-1">
          <BroadcastComposer channels={channels} onSend={handleSend} onSchedule={handleSchedule} />
        </div>

        {/* History */}
        <div className="col-span-2">
          <HistoryTable history={history} />
        </div>
      </div>

      {/* Pending & Failed */}
      <div className="grid grid-cols-2 gap-4">
        <PendingBroadcasts scheduled={scheduled} onCancel={handleCancel} onEdit={handleEdit} />
        <FailedLog failed={failed} onRetry={handleRetry} />
      </div>
    </div>
  );
}
