import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock,
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Edit2,
  Shield,
  AlertTriangle,
  Key,
  Tag,
  X,
  Database,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type SecretCategory = 'api-key' | 'password' | 'certificate' | 'token' | 'database';
type SecretStatus = 'active' | 'expiring-soon' | 'expired' | 'revoked';

interface Secret {
  id: string;
  name: string;
  category: SecretCategory;
  status: SecretStatus;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsed: Date | null;
  tags: string[];
  description: string;
  masked: string;
}

// ============================================================================
// Config
// ============================================================================

const CATEGORY_CONFIG: Record<SecretCategory, { label: string; icon: React.ElementType; color: string }> = {
  'api-key': { label: 'API Key', icon: Key, color: 'text-violet-400' },
  'password': { label: 'Password', icon: Lock, color: 'text-blue-400' },
  'certificate': { label: 'Certificate', icon: Shield, color: 'text-green-400' },
  'token': { label: 'Token', icon: Tag, color: 'text-amber-400' },
  'database': { label: 'Database', icon: Database, color: 'text-orange-400' },
};

const STATUS_CONFIG: Record<SecretStatus, { label: string; color: string; bg: string; dot: string }> = {
  'active': { label: 'Active', color: 'text-green-400', bg: 'bg-green-400/10', dot: 'bg-green-400' },
  'expiring-soon': { label: 'Expiring Soon', color: 'text-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400' },
  'expired': { label: 'Expired', color: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400' },
  'revoked': { label: 'Revoked', color: 'text-[var(--color-text-secondary)]', bg: 'bg-[var(--color-surface-3)]/30', dot: 'bg-[var(--color-surface-3)]' },
};

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_SECRETS: Secret[] = [
  {
    id: 's1', name: 'OpenAI Production Key', category: 'api-key', status: 'active',
    createdAt: new Date('2025-01-15'), expiresAt: new Date('2027-01-15'),
    lastUsed: new Date(Date.now() - 3600000), tags: ['production', 'ai'],
    description: 'Primary OpenAI API key for production environment',
    masked: 'sk-prod-****************************3f2a',
  },
  {
    id: 's2', name: 'Anthropic API Token', category: 'token', status: 'active',
    createdAt: new Date('2025-03-10'), expiresAt: null,
    lastUsed: new Date(Date.now() - 7200000), tags: ['production', 'ai'],
    description: 'Anthropic Claude API token',
    masked: 'ant-****************************9b1c',
  },
  {
    id: 's3', name: 'PostgreSQL Main DB', category: 'database', status: 'active',
    createdAt: new Date('2024-11-01'), expiresAt: null,
    lastUsed: new Date(Date.now() - 1800000), tags: ['database', 'production'],
    description: 'Main PostgreSQL production database credentials',
    masked: 'postgres://admin:****@db.prod.internal:5432/main',
  },
  {
    id: 's4', name: 'SSL Certificate (*.clawdbot.io)', category: 'certificate', status: 'expiring-soon',
    createdAt: new Date('2025-01-01'), expiresAt: new Date('2026-04-01'),
    lastUsed: null, tags: ['ssl', 'certificate'],
    description: 'Wildcard SSL certificate for clawdbot.io',
    masked: '-----BEGIN CERTIFICATE----- (expires Apr 1, 2026)',
  },
  {
    id: 's5', name: 'GitHub Deploy Token', category: 'token', status: 'expired',
    createdAt: new Date('2024-06-01'), expiresAt: new Date('2025-06-01'),
    lastUsed: new Date('2025-05-30'), tags: ['github', 'deploy'],
    description: 'GitHub personal access token for CI deployments',
    masked: 'ghp_****************************7d9e',
  },
  {
    id: 's6', name: 'Stripe Webhook Secret', category: 'api-key', status: 'active',
    createdAt: new Date('2025-02-01'), expiresAt: null,
    lastUsed: new Date(Date.now() - 600000), tags: ['payments', 'webhook'],
    description: 'Stripe webhook signing secret for payment events',
    masked: 'whsec_****************************2a4f',
  },
  {
    id: 's7', name: 'Legacy Admin Password', category: 'password', status: 'revoked',
    createdAt: new Date('2023-01-01'), expiresAt: null,
    lastUsed: new Date('2024-01-01'), tags: ['legacy', 'admin'],
    description: 'Legacy admin portal password – REVOKED',
    masked: '********************',
  },
  {
    id: 's8', name: 'Redis Cache Password', category: 'password', status: 'active',
    createdAt: new Date('2025-04-01'), expiresAt: null,
    lastUsed: new Date(Date.now() - 300000), tags: ['cache', 'redis'],
    description: 'Redis cluster authentication password',
    masked: '********************',
  },
];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: Date | null): string {
  if (!date) { return 'N/A'; }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================================
// StatusBadge — includes text label (not color-only)
// ============================================================================

function StatusBadge({ status }: { status: SecretStatus }) {
  const { label, color, bg, dot } = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', bg, color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

// ============================================================================
// SecretDialog — role="dialog", aria-labelledby, Escape key, focus trap
// ============================================================================

interface SecretDialogProps {
  isOpen: boolean;
  editingSecret: Secret | null;
  onClose: () => void;
  onSave: (data: Partial<Secret>) => void;
}

function SecretDialog({ isOpen, editingSecret, onClose, onSave }: SecretDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = 'secret-dialog-title';
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SecretCategory>('api-key');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);

  useEffect(() => {
    if (isOpen && editingSecret) {
      setName(editingSecret.name);
      setCategory(editingSecret.category);
      setDescription(editingSecret.description);
      setValue('');
    } else if (isOpen) {
      setName(''); setCategory('api-key'); setDescription(''); setValue('');
    }
  }, [isOpen, editingSecret]);

  // Focus trap + Escape
  useEffect(() => {
    if (!isOpen) { return; }
    const dialog = dialogRef.current;
    if (!dialog) { return; }
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    const first = getFocusable()[0];
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const els = getFocusable();
        const firstEl = els[0];
        const lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault(); lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault(); firstEl?.focus();
        }
      }
    }
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) { return null; }

  const handleSave = () => {
    onSave({ name, category, description });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary)]">
            {editingSecret ? 'Edit Secret' : 'Add New Secret'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div>
            <label htmlFor="secret-name" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Name <span aria-hidden="true" className="text-red-400">*</span>
            </label>
            <input
              id="secret-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OpenAI Production Key"
              required
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            />
          </div>

          <div>
            <label htmlFor="secret-category" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Category
            </label>
            <select
              id="secret-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SecretCategory)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="secret-value" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Secret Value
            </label>
            <div className="relative">
              <input
                id="secret-value"
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={editingSecret ? 'Leave blank to keep existing value' : 'Paste your secret here'}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 pr-10 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                aria-label={showValue ? 'Hide secret value' : 'Show secret value'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                {showValue
                  ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                  : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="secret-description" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Description
            </label>
            <textarea
              id="secret-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of this secret…"
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)] text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              {editingSecret ? 'Save Changes' : 'Add Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SecretVaultManager() {
  const [secrets, setSecrets] = useState(MOCK_SECRETS);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<SecretCategory | 'all'>('all');
  const [activeStatus, setActiveStatus] = useState<SecretStatus | 'all'>('all');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = secrets.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = activeCategory === 'all' || s.category === activeCategory;
    const matchStatus = activeStatus === 'all' || s.status === activeStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const statusCounts = {
    all: secrets.length,
    active: secrets.filter((s) => s.status === 'active').length,
    'expiring-soon': secrets.filter((s) => s.status === 'expiring-soon').length,
    expired: secrets.filter((s) => s.status === 'expired').length,
    revoked: secrets.filter((s) => s.status === 'revoked').length,
  };

  const notify = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleCopy = useCallback((secret: Secret) => {
    navigator.clipboard.writeText(secret.masked).catch(() => {});
    setCopiedId(secret.id);
    notify(`Copied masked value for "${secret.name}"`);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleToggleReveal = useCallback((id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const handleDelete = useCallback((secret: Secret) => {
    setSecrets((prev) => prev.filter((s) => s.id !== secret.id));
    notify(`Deleted secret "${secret.name}"`);
  }, []);

  const handleEdit = useCallback((secret: Secret) => {
    setEditingSecret(secret);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback((data: Partial<Secret>) => {
    if (editingSecret) {
      setSecrets((prev) => prev.map((s) => s.id === editingSecret.id ? { ...s, ...data } : s));
      notify(`Updated secret "${data.name ?? editingSecret.name}"`);
    } else {
      const newSecret: Secret = {
        id: `s${Date.now()}`,
        name: data.name ?? 'Unnamed',
        category: data.category ?? 'api-key',
        status: 'active',
        createdAt: new Date(),
        expiresAt: null,
        lastUsed: null,
        tags: [],
        description: data.description ?? '',
        masked: '****************************',
      };
      setSecrets((prev) => [newSecret, ...prev]);
      notify(`Added new secret "${newSecret.name}"`);
    }
    setEditingSecret(null);
  }, [editingSecret]);

  const expiringCount = statusCounts['expiring-soon'];

  return (
    <>
      {/* Skip link — WCAG 2.4.1 */}
      <a
        href="#vault-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
        <main id="vault-main" className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* Live status announcements — WCAG 4.1.3 */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {statusMessage}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Lock className="w-6 h-6 text-violet-400" aria-hidden="true" />
                Secret Vault Manager
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Manage credentials, API keys, and sensitive configuration</p>
            </div>
            <button
              onClick={() => { setEditingSecret(null); setDialogOpen(true); }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] px-4 py-2 rounded-lg font-medium text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Secret
            </button>
          </div>

          {/* Expiring-soon alert */}
          {expiringCount > 0 && (
            <div role="alert" className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-amber-300 text-sm">
                <strong>{expiringCount} secret{expiringCount > 1 ? 's' : ''}</strong> expiring soon. Rotate them before they expire.
              </p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Secrets', value: statusCounts.all, icon: Lock, color: 'text-violet-400' },
              { label: 'Active', value: statusCounts.active, icon: CheckCircle, color: 'text-green-400' },
              { label: 'Expiring Soon', value: statusCounts['expiring-soon'], icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Expired / Revoked', value: statusCounts.expired + statusCounts.revoked, icon: Shield, color: 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', color)} aria-hidden="true" />
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wide">{label}</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-6">
            {/* Sidebar filters */}
            <aside>
              <nav aria-label="Filter secrets by status and category">
                {/* Status filter */}
                <section aria-label="Filter by status" className="mb-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Status</h2>
                  <ul className="space-y-1" role="list">
                    {(['all', 'active', 'expiring-soon', 'expired', 'revoked'] as const).map((s) => (
                      <li key={s}>
                        <button
                          onClick={() => setActiveStatus(s)}
                          aria-pressed={activeStatus === s}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                            activeStatus === s
                              ? 'bg-violet-600/20 text-violet-300'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                          )}
                        >
                          <span>{s === 'all' ? 'All Secrets' : STATUS_CONFIG[s].label}</span>
                          <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded">
                            {s === 'all' ? statusCounts.all : statusCounts[s]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Category filter */}
                <section aria-label="Filter by category">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Category</h2>
                  <ul className="space-y-1" role="list">
                    <li>
                      <button
                        onClick={() => setActiveCategory('all')}
                        aria-pressed={activeCategory === 'all'}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                          activeCategory === 'all'
                            ? 'bg-violet-600/20 text-violet-300'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                        )}
                      >
                        All Categories
                      </button>
                    </li>
                    {Object.entries(CATEGORY_CONFIG).map(([key, { label, icon: Icon, color }]) => (
                      <li key={key}>
                        <button
                          onClick={() => setActiveCategory(key as SecretCategory)}
                          aria-pressed={activeCategory === key}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                            activeCategory === key
                              ? 'bg-violet-600/20 text-violet-300'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                          )}
                        >
                          <Icon className={cn('w-4 h-4', color)} aria-hidden="true" />
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </nav>
            </aside>

            {/* Main table area */}
            <div className="col-span-3 space-y-4">
              {/* Search */}
              <div className="relative">
                <label htmlFor="secret-search" className="sr-only">Search secrets</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" aria-hidden="true" />
                <input
                  id="secret-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search secrets by name, description, or tag…"
                  className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg pl-10 pr-4 py-2.5 text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                />
              </div>

              {/* Secrets table */}
              <section aria-label="Secrets list">
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        Secrets — {filtered.length} of {secrets.length} shown
                      </caption>
                      <thead className="bg-[var(--color-surface-2)]/50">
                        <tr>
                          <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Name</th>
                          <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Category</th>
                          <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Status</th>
                          <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Value</th>
                          <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Last Used</th>
                          <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Expires</th>
                          <th scope="col" className="text-right text-[var(--color-text-secondary)] font-medium px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]/60">
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                              No secrets match your current filters.
                            </td>
                          </tr>
                        ) : (
                          filtered.map((secret) => {
                            const CategoryIcon = CATEGORY_CONFIG[secret.category].icon;
                            const revealed = revealedIds.has(secret.id);
                            return (
                              <tr key={secret.id} className="hover:bg-[var(--color-surface-2)]/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-[var(--color-text-primary)]">{secret.name}</div>
                                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{secret.description}</div>
                                  {secret.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {secret.tags.map((tag) => (
                                        <span key={tag} className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="flex items-center gap-1.5 text-[var(--color-text-primary)] text-xs">
                                    <CategoryIcon
                                      className={cn('w-4 h-4 flex-shrink-0', CATEGORY_CONFIG[secret.category].color)}
                                      aria-hidden="true"
                                    />
                                    {CATEGORY_CONFIG[secret.category].label}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={secret.status} />
                                </td>
                                <td className="px-4 py-3">
                                  <code className="text-xs text-[var(--color-text-secondary)] font-mono break-all">
                                    {revealed ? secret.masked : '••••••••••••••••'}
                                  </code>
                                </td>
                                <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{formatDate(secret.lastUsed)}</td>
                                <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{formatDate(secret.expiresAt)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleToggleReveal(secret.id)}
                                      aria-label={revealed ? `Hide value for ${secret.name}` : `Reveal value for ${secret.name}`}
                                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                                    >
                                      {revealed
                                        ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                                        : <Eye className="w-4 h-4" aria-hidden="true" />}
                                    </button>
                                    <button
                                      onClick={() => handleCopy(secret)}
                                      aria-label={copiedId === secret.id ? 'Copied!' : `Copy value for ${secret.name}`}
                                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                                    >
                                      <Copy className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                    <button
                                      onClick={() => handleEdit(secret)}
                                      aria-label={`Edit ${secret.name}`}
                                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                                    >
                                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(secret)}
                                      aria-label={`Delete ${secret.name}`}
                                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-red-400 rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                                    >
                                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filtered.length > 0 && (
                    <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                      Showing {filtered.length} of {secrets.length} secrets
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Add/Edit dialog */}
      <SecretDialog
        isOpen={dialogOpen}
        editingSecret={editingSecret}
        onClose={() => { setDialogOpen(false); setEditingSecret(null); }}
        onSave={handleSave}
      />
    </>
  );
}
