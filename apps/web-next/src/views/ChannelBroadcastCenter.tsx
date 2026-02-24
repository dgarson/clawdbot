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

/** Returns a proper capitalised visible label for channel status. */
function getStatusLabel(status: ChannelStatus): string {
  switch (status) {
    case 'connected': return 'Connected';
    case 'degraded': return 'Degraded';
    case 'disconnected': return 'Disconnected';
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status, className }: { status: ChannelStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        className,
        status === 'connected' && 'bg-green-500/10 text-green-400',
        status === 'degraded' && 'bg-amber-500/10 text-amber-400',
        status === 'disconnected' && 'bg-red-500/10 text-red-400',
      )}
    >
      {/* Decorative colour dot — meaning conveyed by the text label */}
      <span aria-hidden="true" className={cn('w-1.5 h-1.5 rounded-full', getStatusColor(status))} />
      {getStatusLabel(status)}
    </span>
  );
}

function LatencyBadge({ ms }: { ms: number }) {
  const color = ms < 200 ? 'bg-green-500/10 text-green-400' : ms < 500 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', color)}>
      <Zap aria-hidden="true" className="w-3 h-3" />
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
          {/* Icon is decorative: channel name provides the label */}
          <Icon aria-hidden="true" className="w-5 h-5 text-zinc-400" />
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
        {/* Eye: icon-only button — must have accessible label and pressed state */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          aria-label={showPreview ? 'Hide message preview' : 'Show message preview'}
          aria-pressed={showPreview}
          className="text-zinc-400 hover:text-white rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
        >
          <Eye aria-hidden="true" className="w-5 h-5" />
        </button>
      </div>

      {/* Target Channels — fieldset/legend for checkbox group */}
      <fieldset className="space-y-2">
        <legend className="text-sm text-zinc-400">Target Channels</legend>
        <div className="grid grid-cols-3 gap-2">
          {channels.map((ch) => (
            <label key={ch.id} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedChannels.includes(ch.id)}
                onChange={() => toggleChannel(ch.id)}
                className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              />
              {ch.name}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Message */}
      <div className="space-y-2">
        {/* htmlFor links label to textarea */}
        <label htmlFor="broadcast-message" className="text-sm text-zinc-400">
          Message
        </label>
        <textarea
          id="broadcast-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          placeholder="Type your broadcast message..."
        />
        <div className="text-xs text-zinc-500 text-right">{message.length} characters</div>
      </div>

      {/* Schedule — fieldset/legend for the schedule option group */}
      <fieldset className="space-y-2">
        <legend className="sr-only">Scheduling options</legend>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleMode}
            onChange={(e) => setScheduleMode(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          />
          Schedule for later
        </label>
        {scheduleMode && (
          <>
            {/* htmlFor links label to datetime input */}
            <label htmlFor="broadcast-schedule-time" className="sr-only">
              Schedule date and time
            </label>
            <input
              id="broadcast-schedule-time"
              type="datetime-local"
              onChange={(e) => setScheduleTime(e.target.value ? new Date(e.target.value) : null)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            />
          </>
        )}
      </fieldset>

      {/* Preview */}
      {showPreview && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Preview</p>
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
          className="flex-1 bg-violet-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
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
        {/* Decorative icon — heading text provides the label */}
        <BarChart aria-hidden="true" className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Broadcast History</span>
      </div>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-sm" aria-label="Broadcast history">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="text-left text-zinc-400">
              {/* scope="col" on every column header */}
              <th scope="col" className="p-3">Time</th>
              <th scope="col" className="p-3">Message</th>
              <th scope="col" className="p-3">Channels</th>
              <th scope="col" className="p-3">Status</th>
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
                      /* aria-label carries full meaning; visual letter is aria-hidden */
                      <span
                        key={ch}
                        aria-label={`${ch}: ${bc.status[ch] ?? 'unknown'}`}
                        className={cn('text-xs', getBroadcastStatusColor(bc.status[ch]))}
                      >
                        <span aria-hidden="true">{ch[0].toUpperCase()}</span>
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

function PendingBroadcasts({
  scheduled,
  onCancel,
  onEdit,
}: {
  scheduled: ScheduledBroadcast[];
  onCancel: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section aria-label="Pending scheduled broadcasts" className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {/* Decorative icon */}
        <Clock aria-hidden="true" className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Pending Scheduled</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {scheduled.map((sc) => {
          const remaining = sc.scheduledTime.getTime() - now;
          const shortMsg = sc.message.length > 40 ? sc.message.slice(0, 40) + '\u2026' : sc.message;
          return (
            <div key={sc.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                {/* aria-live="polite" on the countdown so updates are announced */}
                <span aria-live="polite" aria-atomic="true" className="text-sm font-medium text-white">
                  Send in {formatDuration(remaining)}
                </span>
                <div className="flex gap-2">
                  {/* Edit: context-rich aria-label */}
                  <button
                    onClick={() => onEdit(sc.id)}
                    aria-label={`Edit scheduled broadcast: ${shortMsg}`}
                    className="text-zinc-400 hover:text-white rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                  >
                    <Edit aria-hidden="true" className="w-4 h-4" />
                  </button>
                  {/* Trash: context-rich aria-label */}
                  <button
                    onClick={() => onCancel(sc.id)}
                    aria-label={`Cancel scheduled broadcast: ${shortMsg}`}
                    className="text-zinc-400 hover:text-red-400 rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                  >
                    <Trash aria-hidden="true" className="w-4 h-4" />
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
    </section>
  );
}

function FailedLog({ failed, onRetry }: { failed: FailedDelivery[]; onRetry: (id: string) => void }) {
  return (
    /* aria-live="polite" so newly retried / removed items are announced */
    <section
      aria-label="Failed deliveries"
      aria-live="polite"
      className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col"
    >
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {/* Decorative icon */}
        <AlertTriangle aria-hidden="true" className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-white">Failed Deliveries</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {failed.map((fd) => (
          <div key={fd.id} className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{fd.channelId} (Broadcast {fd.broadcastId})</span>
              {/* RefreshCcw: context-rich aria-label */}
              <button
                onClick={() => onRetry(fd.id)}
                aria-label={`Retry failed delivery to ${fd.channelId}`}
                className="text-zinc-400 hover:text-green-400 rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                <RefreshCcw aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-red-400">{fd.error}</p>
            <div className="text-xs text-zinc-500">Attempts: {fd.attempts} · Last: {formatTimestamp(fd.lastAttempt)}</div>
          </div>
        ))}
      </div>
    </section>
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
    setScheduled((prev) => [
      ...prev,
      {
        id: `sc${prev.length + 1}`,
        timestamp: new Date(),
        message: data.message,
        channels: data.channels,
        scheduledTime: data.schedule,
        status: {},
      },
    ]);
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
    <>
      {/* Skip navigation link — visually hidden until focused */}
      <a
        href="#broadcast-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Polite live region for general status announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

      <main id="broadcast-main" className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {/* Decorative icon — h1 text labels it */}
              <MessageSquare aria-hidden="true" className="w-6 h-6 text-violet-400" />
              Broadcast Center
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">Unified channel management & messaging</p>
          </div>
          <button className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            {/* Decorative icon — button text "New Broadcast" labels the action */}
            <Plus aria-hidden="true" className="w-4 h-4" />
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
        <section aria-label="Channel status overview">
          <div className="grid grid-cols-3 gap-4">
            {channels.map((ch) => <ChannelCard key={ch.id} channel={ch} />)}
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Composer */}
          <section aria-label="Broadcast composer" className="col-span-1">
            <BroadcastComposer channels={channels} onSend={handleSend} onSchedule={handleSchedule} />
          </section>

          {/* History */}
          <section aria-label="Broadcast history" className="col-span-2">
            <HistoryTable history={history} />
          </section>
        </div>

        {/* Pending & Failed */}
        <div className="grid grid-cols-2 gap-4">
          <PendingBroadcasts scheduled={scheduled} onCancel={handleCancel} onEdit={handleEdit} />
          <FailedLog failed={failed} onRetry={handleRetry} />
        </div>
      </main>
    </>
  );
}
