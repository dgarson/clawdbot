import { useState } from 'react';
import {
  Eye,
  EyeOff,
  RotateCcw,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Clock,
  Users,
  Copy,
  Shield,
  AlertTriangle,
  CheckCircle,
  FileLock,
  X,
  BarChart2,
  History,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';
import { Skeleton } from '../components/ui/Skeleton';

// ============================================================================
// Types
// ============================================================================

type SecretType = 'API Key' | 'OAuth' | 'Webhook' | 'Certificate' | 'Password';

interface Secret {
  id: string;
  name: string;
  type: SecretType;
  agents: string[];
  created: Date;
  lastUsed: Date | null;
  expiry: Date | null;
  value: string;
  usageCount: number;
}

type AuditEventAction = 'read' | 'write' | 'rotate';

interface AuditEvent {
  id: string;
  timestamp: Date;
  agent: string;
  action: AuditEventAction;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_SECRETS: Secret[] = [
  {
    id: 'sec1',
    name: 'OpenAI API Key',
    type: 'API Key',
    agents: ['Luis', 'Quinn'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45), // 45 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25), // 25 days from now
    value: 'sk-abc123def456ghi789',
    usageCount: 142,
  },
  {
    id: 'sec2',
    name: 'GitHub OAuth Token',
    type: 'OAuth',
    agents: ['Xavier'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120), // 120 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    expiry: null,
    value: 'gho_zyx987wvu654tsr321',
    usageCount: 89,
  },
  {
    id: 'sec3',
    name: 'Slack Webhook',
    type: 'Webhook',
    agents: ['Stephan'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 1), // 1 hour ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // 5 days from now
    value: 'https://hooks.slack.com/services/T000/B000/XXX',
    usageCount: 56,
  },
  {
    id: 'sec4',
    name: 'SSL Certificate',
    type: 'Certificate',
    agents: ['Reed', 'Piper'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200), // 200 days ago
    lastUsed: null,
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40), // 40 days from now
    value: '-----BEGIN CERTIFICATE-----MII...',
    usageCount: 12,
  },
  {
    id: 'sec5',
    name: 'Database Password',
    type: 'Password',
    agents: ['Luis'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 95), // 95 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
    expiry: null,
    value: 'p@ssw0rd123!',
    usageCount: 203,
  },
  {
    id: 'sec6',
    name: 'AWS Access Key',
    type: 'API Key',
    agents: ['Quinn', 'Xavier'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6), // 6 days from now
    value: 'AKIAIOSFODNN7EXAMPLE',
    usageCount: 78,
  },
  {
    id: 'sec7',
    name: 'Google OAuth',
    type: 'OAuth',
    agents: ['Stephan'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 150), // 150 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
    value: 'ya29.a0AfH6SMC...',
    usageCount: 34,
  },
  {
    id: 'sec8',
    name: 'Discord Webhook',
    type: 'Webhook',
    agents: ['Reed'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 0.5), // 30 min ago
    expiry: null,
    value: 'https://discord.com/api/webhooks/123/abc',
    usageCount: 112,
  },
  {
    id: 'sec9',
    name: 'Root CA Cert',
    type: 'Certificate',
    agents: ['Piper'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 300), // 300 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
    value: '-----BEGIN CERTIFICATE-----ABC...',
    usageCount: 8,
  },
  {
    id: 'sec10',
    name: 'Admin Password',
    type: 'Password',
    agents: ['Luis', 'Quinn'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 0.5), // 12 hours ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 90 days
    value: 'secureAdminPass456',
    usageCount: 167,
  },
  {
    id: 'sec11',
    name: 'Stripe API Key',
    type: 'API Key',
    agents: ['Xavier'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100), // 100 days ago
    lastUsed: null,
    expiry: null,
    value: 'sk_test_12345',
    usageCount: 0,
  },
  {
    id: 'sec12',
    name: 'Twitter OAuth',
    type: 'OAuth',
    agents: ['Stephan', 'Reed'],
    created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20), // 20 days ago
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15), // 15 days
    value: 'oauth_token=abc-oauth',
    usageCount: 45,
  },
];

const MOCK_AUDIT_EVENTS: AuditEvent[] = Array.from({ length: 20 }, (_, i) => ({
  id: `evt${i + 1}`,
  timestamp: new Date(Date.now() - 1000 * 60 * (i * 5 + Math.random() * 30)),
  agent: ['Luis', 'Quinn', 'Xavier', 'Stephan', 'Reed', 'Piper'][Math.floor(Math.random() * 6)],
  action: ['read', 'write', 'rotate'][Math.floor(Math.random() * 3)] as AuditEventAction,
}));

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: Date | null): string {
  if (!date) {return 'Never';}
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function daysBetween(now: Date, date: Date | null): number | null {
  if (!date) {return null;}
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function maskValue(value: string, partial: boolean = false): string {
  if (partial) {
    return '****' + value.slice(-4);
  }
  return '********************';
}

function isDueForRotation(created: Date): boolean {
  const ageDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > 90;
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-zinc-400',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5 p-2 bg-zinc-800 rounded-lg">
        <Icon aria-hidden="true" className={cn('w-4 h-4', color)} />
      </div>
      <div>
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <span className="text-xl font-bold text-white">{value}</span>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: SecretType }) {
  const styles: Record<SecretType, string> = {
    'API Key': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'OAuth': 'bg-green-500/15 text-green-400 border-green-500/30',
    'Webhook': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'Certificate': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    'Password': 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium border', styles[type])}>
      {type}
    </span>
  );
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) {return null;}
  let color = 'bg-green-500/15 text-green-400';
  if (days < 30) {color = 'bg-amber-500/15 text-amber-400';}
  if (days < 7) {color = 'bg-red-500/15 text-red-400';}
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs', color)}>
      <Clock aria-hidden="true" className="w-3 h-3" />
      {days} days left
    </span>
  );
}

function UsageBadge({ count }: { count: number }) {
  return (
    <span className="px-2 py-0.5 rounded-md text-xs bg-zinc-700/50 text-zinc-300">
      {count} uses
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  color = 'text-zinc-400 hover:text-white',
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors bg-zinc-800 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none', color)}
    >
      <Icon aria-hidden="true" className="w-3 h-3" />
      {label}
    </button>
  );
}

function SecretCard({
  secret,
  revealed,
  onToggleReveal,
  onCopy,
  onRotate,
  onEdit,
  onRevoke,
}: {
  secret: Secret;
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onRotate: () => void;
  onEdit: () => void;
  onRevoke: () => void;
}) {
  const now = new Date();
  const daysLeft = daysBetween(now, secret.expiry);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">{secret.name}</span>
            <TypeBadge type={secret.type} />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Users aria-hidden="true" className="w-3 h-3" />
            {secret.agents.join(', ')}
          </div>
        </div>
        <UsageBadge count={secret.usageCount} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div>
          <span className="block text-zinc-500 mb-0.5">Created</span>
          {formatDate(secret.created)}
        </div>
        <div>
          <span className="block text-zinc-500 mb-0.5">Last Used</span>
          {formatDate(secret.lastUsed)}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <ExpiryBadge days={daysLeft} />
        <div className="flex gap-1">
          <button onClick={onToggleReveal} aria-label={revealed ? "Hide secret value" : "Show secret value"} className="p-1 rounded hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            {revealed ? <EyeOff aria-hidden="true" className="w-4 h-4 text-zinc-400" /> : <Eye aria-hidden="true" className="w-4 h-4 text-zinc-400" />}
          </button>
        </div>
      </div>

      <div className="font-mono text-sm text-zinc-300 bg-zinc-800 rounded p-2 flex items-center justify-between">
        <span>{revealed ? maskValue(secret.value, true) : maskValue(secret.value)}</span>
      </div>

      <div className="flex gap-2">
        <ActionButton icon={Copy} label="Copy" onClick={onCopy} />
        <ActionButton icon={RotateCcw} label="Rotate" onClick={onRotate} color="text-blue-400 hover:text-blue-300" />
        <ActionButton icon={Edit} label="Edit" onClick={onEdit} color="text-green-400 hover:text-green-300" />
        <ActionButton icon={Trash2} label="Revoke" onClick={onRevoke} color="text-red-400 hover:text-red-300" />
      </div>
    </div>
  );
}

function RotationPanel({
  dueSecrets,
  onBulkRotate,
}: {
  dueSecrets: Secret[];
  onBulkRotate: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw aria-hidden="true" className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Rotation Queue</span>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">
          {dueSecrets.length} due
        </span>
      </div>
      {dueSecrets.length === 0 ? (
        <div className="text-center text-zinc-500 py-4">
          <CheckCircle aria-hidden="true" className="w-6 h-6 mx-auto mb-1 opacity-50" />
          <p className="text-sm">All secrets up to date</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {dueSecrets.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <TypeBadge type={s.type} />
                <span className="text-white">{s.name}</span>
                <span className="ml-auto text-zinc-500">
                  {Math.floor((Date.now() - s.created.getTime()) / (1000 * 60 * 60 * 24))} days old
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onBulkRotate}
            className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <RotateCcw aria-hidden="true" className="w-4 h-4" />
            Rotate All
          </button>
        </>
      )}
    </div>
  );
}

function AuditLogDrawer({
  events,
  open,
  onClose,
}: {
  events: AuditEvent[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {return null;}

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History aria-hidden="true" className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Audit Log</span>
        </div>
        <button onClick={onClose} aria-label="Close audit log" className="p-1 rounded hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
          <X aria-hidden="true" className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
      <div className="space-y-2">
        {events.map((evt) => (
          <div key={evt.id} className="bg-zinc-800 rounded p-2 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-zinc-500">{formatTimestamp(evt.timestamp)}</span>
              <span className="text-white">{evt.agent}</span>
              <span className={cn('px-1 rounded text-xs', 
                evt.action === 'read' ? 'bg-blue-500/20 text-blue-400' :
                evt.action === 'write' ? 'bg-green-500/20 text-green-400' :
                'bg-amber-500/20 text-amber-400'
              )}>
                {evt.action}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddSecretModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (newSecret: Omit<Secret, 'id' | 'created' | 'lastUsed' | 'usageCount'>) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SecretType>('API Key');
  const [value, setValue] = useState('');
  const [expiry, setExpiry] = useState<string>('');
  const [agents, setAgents] = useState<string[]>([]);

  const handleSubmit = () => {
    onAdd({
      name,
      type,
      agents,
      expiry: expiry ? new Date(expiry) : null,
      value,
    });
    onClose();
  };

  if (!open) {return null;}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-zinc-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add New Secret</h2>
          <button onClick={onClose} aria-label="Close modal" className="p-1 rounded hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <X aria-hidden="true" className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SecretType)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              <option>API Key</option>
              <option>OAuth</option>
              <option>Webhook</option>
              <option>Certificate</option>
              <option>Password</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Value</label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white font-mono text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Expiry Date (optional)</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Agent Scope (comma-separated)</label>
            <input
              value={agents.join(', ')}
              onChange={(e) => setAgents(e.target.value.split(', ').filter(Boolean))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            Add Secret
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SecretVaultManager({ isLoading = false }: { isLoading?: boolean }) {
  const [secrets, setSecrets] = useState<Secret[]>(MOCK_SECRETS);
  const [auditEvents] = useState<AuditEvent[]>(MOCK_AUDIT_EVENTS);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<SecretType | ''>('');
  const [filterAgent, setFilterAgent] = useState('');
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);

  const toggleReveal = (id: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);}
      else {next.add(id);}
      return next;
    });
  };

  const handleCopy = (value: string) => {
    void navigator.clipboard.writeText(value);
    // TODO: Toast notification
  };

  const handleRotate = (id: string) => {
    console.log('Rotate', id);
    // TODO: Implement rotation logic
  };

  const handleEdit = (id: string) => {
    console.log('Edit', id);
    // TODO: Open edit modal
  };

  const handleRevoke = (id: string) => {
    setSecrets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleBulkRotate = () => {
    console.log('Bulk rotate');
    // TODO: Implement bulk rotation
  };

  const handleAdd = (newSecret: Omit<Secret, 'id' | 'created' | 'lastUsed' | 'usageCount'>) => {
    const id = `sec${secrets.length + 1}`;
    setSecrets((prev) => [
      ...prev,
      {
        ...newSecret,
        id,
        created: new Date(),
        lastUsed: null,
        usageCount: 0,
      },
    ]);
  };

  const filteredSecrets = secrets.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || s.type === filterType;
    const matchesAgent = !filterAgent || s.agents.some((a) => a.toLowerCase().includes(filterAgent.toLowerCase()));
    return matchesSearch && matchesType && matchesAgent;
  });

  const dueForRotation = secrets.filter((s) => isDueForRotation(s.created));

  const totalSecrets = secrets.length;
  const expiringSoon = secrets.filter((s) => {
    const days = daysBetween(new Date(), s.expiry);
    return days !== null && days < 30;
  }).length;
  const rotatedThisMonth = 5; // Mock
  const accessToday = auditEvents.filter((e) => daysBetween(new Date(), e.timestamp) === 0).length;

  return (
    <>
      <a href="#svm-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-md">Skip to main content</a>
      <main id="svm-main" className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileLock aria-hidden="true" className="w-6 h-6 text-violet-400" />
            Secret Vault
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">Credentials & secrets management</p>
        </div>
        <div className="flex items-center gap-3">
          <span role="status" className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium">
            {totalSecrets} secrets
          </span>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <Plus aria-hidden="true" className="w-4 h-4" />
            Add Secret
          </button>
          <button
            onClick={() => setAuditDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <History aria-hidden="true" className="w-4 h-4" />
            Audit Log
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Secrets" value={totalSecrets} icon={Shield} color="text-violet-400" />
        <StatCard label="Expiring Soon" value={expiringSoon} icon={AlertTriangle} color="text-amber-400" />
        <StatCard label="Rotated This Month" value={rotatedThisMonth} icon={RotateCcw} color="text-green-400" />
        <StatCard label="Access Today" value={accessToday} icon={BarChart2} color="text-blue-400" />
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search aria-hidden="true" className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search secrets..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-9 py-2 text-sm text-white placeholder-zinc-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as SecretType)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
        >
          <option value="">All Types</option>
          <option>API Key</option>
          <option>OAuth</option>
          <option>Webhook</option>
          <option>Certificate</option>
          <option>Password</option>
        </select>
        <div className="relative">
          <Filter aria-hidden="true" className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            placeholder="Filter by agent"
            className="bg-zinc-800 border border-zinc-700 rounded px-9 py-2 text-sm text-white placeholder-zinc-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          />
        </div>
      </div>

      {/* Main Content: Secrets List + Rotation Panel */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton variant="text" className="w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-14" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-6 w-10" />
                    <Skeleton className="h-6 w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : secrets.length === 0 ? (
            <ContextualEmptyState
              icon={FileLock}
              title="No secrets stored"
              description="Credentials and API keys you add will appear here."
              primaryAction={{ label: 'Add your first secret', onClick: () => setAddModalOpen(true) }}
            />
          ) : filteredSecrets.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              <Shield aria-hidden="true" className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No secrets match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSecrets.map((s) => (
                <SecretCard
                  key={s.id}
                  secret={s}
                  revealed={revealedSecrets.has(s.id)}
                  onToggleReveal={() => toggleReveal(s.id)}
                  onCopy={() => handleCopy(s.value)}
                  onRotate={() => handleRotate(s.id)}
                  onEdit={() => handleEdit(s.id)}
                  onRevoke={() => handleRevoke(s.id)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="col-span-1">
          <RotationPanel dueSecrets={dueForRotation} onBulkRotate={handleBulkRotate} />
        </div>
      </div>

      {/* Modals and Drawers */}
      <AddSecretModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdd={handleAdd} />
      <AuditLogDrawer events={auditEvents} open={auditDrawerOpen} onClose={() => setAuditDrawerOpen(false)} />
      </main>
    </>
  );
}
