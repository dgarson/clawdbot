import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Key,
  RefreshCw,
  Check,
  AlertTriangle,
  ExternalLink,
  Zap,
  Brain,
  Sparkles,
  MessageSquare,
  Bot,
  Cloud,
  Cpu,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGateway } from '../hooks/useGateway';
import { useWizard } from '../hooks/useWizard';
import WizardModal from '../components/WizardModal';
import {
  StatusBadge,
  AnimatedCounter,
  SparklineChart,
  ProviderCard,
} from '../components/ui/AnimatedComponents';
import type {
  AuthProvider,
  AuthProfileStatus,
  OpenClawConfig,
  ModelsListResponse,
  RuntimeId,
  WizardAnswer,
} from '../types';

// ============================================================================
// Provider Definitions
// ============================================================================

const PROVIDER_DEFINITIONS: Omit<AuthProvider, 'status' | 'profileId'>[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models via API key or token',
    icon: '🧠',
    authKind: 'token',
    docsUrl: 'https://console.anthropic.com/',
    popular: true,
    runtimes: ['pi', 'claude-sdk'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models via API key',
    icon: '🤖',
    authKind: 'api_key',
    docsUrl: 'https://platform.openai.com/api-keys',
    popular: true,
    runtimes: ['pi'],
  },
  {
    id: 'minimax-portal',
    name: 'MiniMax',
    description: 'MiniMax models via OAuth portal',
    icon: '⚡',
    authKind: 'oauth',
    popular: true,
    runtimes: ['pi', 'claude-sdk'],
  },
  {
    id: 'qwen-portal',
    name: 'Qwen',
    description: 'Alibaba Qwen models via device code',
    icon: '🌟',
    authKind: 'device_code',
    runtimes: ['pi'],
  },
  {
    id: 'google-gemini-cli',
    name: 'Gemini CLI',
    description: 'Google Gemini via OAuth',
    icon: '💎',
    authKind: 'oauth',
    popular: true,
    runtimes: ['pi'],
  },
  {
    id: 'google-antigravity',
    name: 'Antigravity',
    description: 'Google Antigravity via OAuth',
    icon: '🚀',
    authKind: 'oauth',
    runtimes: ['pi'],
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    description: 'Codex models via OAuth',
    icon: '💻',
    authKind: 'oauth',
    runtimes: ['pi'],
  },
  {
    id: 'chutes',
    name: 'Chutes',
    description: 'Chutes models via OAuth',
    icon: '🎯',
    authKind: 'oauth',
    runtimes: ['pi'],
  },
];

// ============================================================================
// Usage Sparkline Mock Data
// ============================================================================

function generateMockSparkline(length: number = 14): number[] {
  return Array.from({ length }, () => Math.random() * 100 + 20);
}

// ============================================================================
// Provider Grid Card with Animation
// ============================================================================

interface ProviderGridCardProps {
  provider: AuthProvider;
  sparklineData?: number[];
  onConnect: () => void;
  onManage: () => void;
  usageStats?: {
    requests: number;
    tokens: number;
    cost: number;
  };
  /** Inline editing state for api_key/token providers */
  isEditing?: boolean;
  editingValue?: string;
  onEditingValueChange?: (value: string) => void;
  onSaveKey?: () => void;
  onCancelEdit?: () => void;
  savingKey?: boolean;
  saveError?: string | null;
}

function ProviderGridCard({
  provider,
  sparklineData,
  onConnect,
  onManage,
  usageStats,
  isEditing,
  editingValue,
  onEditingValueChange,
  onSaveKey,
  onCancelEdit,
  savingKey,
  saveError,
}: ProviderGridCardProps) {
  const isConnected = provider.status === 'connected';
  const isExpired = provider.status === 'expired';
  const isError = provider.status === 'error';

  return (
    <div
      className={cn(
        'relative bg-[var(--color-surface-1)] rounded-2xl border overflow-hidden',
        'transition-all duration-300',
        isConnected
          ? 'border-green-500/30 hover:border-green-500/50'
          : isExpired
          ? 'border-yellow-500/30 hover:border-yellow-500/50'
          : isError
          ? 'border-red-500/30 hover:border-red-500/50'
          : 'border-[var(--color-border)] hover:border-[var(--color-surface-3)]',
        'group'
      )}
    >
      {/* Animated gradient background for connected */}
      {isConnected && (
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      )}

      {/* Animated glow effect on hover */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none',
          isConnected
            ? 'bg-gradient-to-br from-green-500/10 via-transparent to-emerald-500/10'
            : 'bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10'
        )}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                'transition-transform duration-300 group-hover:scale-110',
                isConnected
                  ? 'bg-green-500/20'
                  : 'bg-[var(--color-surface-2)]'
              )}
            >
              {provider.icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                {provider.name}
                {provider.popular && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-normal">
                    Popular
                  </span>
                )}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{provider.description}</p>
            </div>
          </div>
          <StatusBadge
            variant={provider.status}
            size="sm"
            animated={isConnected}
          />
        </div>

        {/* Usage Stats (if connected) */}
        {isConnected && usageStats && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                <AnimatedCounter value={usageStats.requests} />
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Requests</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                <AnimatedCounter value={usageStats.tokens} formatter={(v) => 
                  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` :
                  v >= 1000 ? `${(v / 1000).toFixed(1)}K` :
                  v.toString()
                } />
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Tokens</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                ${(usageStats.cost / 100).toFixed(2)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Cost</p>
            </div>
          </div>
        )}

        {/* Sparkline (if connected and has data) */}
        {isConnected && sparklineData && sparklineData.length > 0 && (
          <div className="mb-4 p-3 bg-[var(--color-surface-2)]/50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--color-text-secondary)]">Usage (14 days)</span>
              <span className="text-xs text-[var(--color-text-muted)]">~{Math.round(sparklineData.reduce((a, b) => a + b, 0) / sparklineData.length)} avg/day</span>
            </div>
            <SparklineChart
              data={sparklineData}
              width={200}
              height={40}
              color="rgb(34, 197, 94)"
            />
          </div>
        )}

        {/* Inline key/token editor for api_key and token providers */}
        {isEditing && (
          <div className="mb-3 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSaveKey?.();
              }}
              className="space-y-2"
            >
              <input
                type="password"
                value={editingValue ?? ''}
                onChange={(e) => onEditingValueChange?.(e.target.value)}
                placeholder={provider.authKind === 'api_key' ? 'Paste API key...' : 'Paste token...'}
                disabled={savingKey}
                autoFocus
                className={cn(
                  'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5',
                  'text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
                  'transition-all duration-200',
                  savingKey && 'opacity-50 cursor-not-allowed'
                )}
              />
              {saveError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {saveError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingKey || !(editingValue ?? '').trim()}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200',
                    'bg-primary hover:bg-primary text-[var(--color-text-primary)]',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {savingKey ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  disabled={savingKey}
                  className="py-2 px-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] text-sm transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Action Buttons */}
        {!isEditing && (
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={onManage}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Manage
              </button>
              <button
                type="button"
                onClick={onConnect}
                className="py-2.5 px-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] text-sm transition-colors"
                title="Refresh connection"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              className={cn(
                'w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200',
                'flex items-center justify-center gap-2',
                isExpired
                  ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-500/30'
                  : isError
                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
                  : 'bg-primary text-[var(--color-text-primary)] hover:bg-primary shadow-lg shadow-violet-900/30'
              )}
            >
              {isExpired ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Reconnect
                </>
              ) : isError ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Retry
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Connect
                </>
              )}
            </button>
          )}
        </div>
        )}

        {/* Auth kind badge */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            Auth: <span className="text-[var(--color-text-secondary)]">{provider.authKind.replace('_', ' ')}</span>
          </span>
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
            >
              Docs <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Runtime compatibility badges */}
        {provider.runtimes && provider.runtimes.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {provider.runtimes.map((rt) => (
              <span
                key={rt}
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  rt === 'claude-sdk'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                )}
              >
                {rt === 'claude-sdk' ? 'Claude SDK' : 'Pi Runtime'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProviderAuthManager() {
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [runtimeFilter, setRuntimeFilter] = useState<'all' | RuntimeId>('all');

  // Wizard state (for OAuth / device_code providers)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTitle, setWizardTitle] = useState('Connect Provider');
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // Inline editing state (for api_key / token providers)
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Gateway hook
  const gateway = useGateway();
  const wizard = useWizard(gateway);

  /**
   * Load provider status from config
   */
  const loadProviderStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch config
      const configResult = await gateway.call<OpenClawConfig>('config.get', {});
      setConfig(configResult);

      // Get auth profiles
      const profiles = configResult.auth?.profiles || {};

      // Map provider definitions with status
      const providersWithStatus: AuthProvider[] = PROVIDER_DEFINITIONS.map((def) => {
        const profileKey = Object.keys(profiles).find(
          (k) => k.startsWith(def.id + ':') || k === def.id
        );
        const profile = profileKey ? profiles[profileKey] : null;

        let status: AuthProfileStatus = 'not_connected';
        if (profile) {
          status = 'connected'; // Could be enhanced to check expiry
        }

        return {
          ...def,
          status,
          profileId: profileKey,
        };
      });

      // Sort: connected first, then popular, then alphabetically
      providersWithStatus.sort((a, b) => {
        if (a.status === 'connected' && b.status !== 'connected') {return -1;}
        if (a.status !== 'connected' && b.status === 'connected') {return 1;}
        if (a.popular && !b.popular) {return -1;}
        if (!a.popular && b.popular) {return 1;}
        return a.name.localeCompare(b.name);
      });

      setProviders(providersWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  /**
   * Handle connect button click.
   * Routes to the wizard flow for OAuth/device_code providers,
   * or shows an inline text input for api_key/token providers.
   */
  const handleConnect = useCallback(async (providerId: string) => {
    const def = PROVIDER_DEFINITIONS.find((d) => d.id === providerId);
    const provider = providers.find((p) => p.id === providerId);
    if (!def || !provider) {return;}

    if (def.authKind === 'oauth' || def.authKind === 'device_code') {
      // OAuth / device_code: open the wizard modal
      setConnectingProvider(providerId);
      setWizardTitle(`Connect ${provider.name}`);
      setWizardOpen(true);

      try {
        await wizard.start({
          mode: 'add-provider',
          provider: providerId,
        });
      } catch (err) {
        console.error('[ProviderAuth] Failed to start wizard:', err);
      }
    } else {
      // api_key / token: show inline text input on the card
      setEditingProvider(providerId);
      setEditingValue('');
      setSaveError(null);
    }
  }, [providers, wizard]);

  /**
   * Save an api_key or token entered via the inline editor.
   * Sends the credential to the gateway via config.set.
   */
  const handleSaveKey = useCallback(async () => {
    if (!editingProvider || !editingValue.trim()) {return;}

    setSavingKey(true);
    setSaveError(null);

    try {
      await gateway.call('config.set', {
        key: `auth.profiles.${editingProvider}`,
        value: { token: editingValue.trim() },
      });

      // Refresh provider list to reflect the new connection
      setEditingProvider(null);
      setEditingValue('');
      void loadProviderStatus();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSavingKey(false);
    }
  }, [editingProvider, editingValue, gateway, loadProviderStatus]);

  /**
   * Cancel inline editing without saving
   */
  const handleCancelEdit = useCallback(() => {
    setEditingProvider(null);
    setEditingValue('');
    setSaveError(null);
  }, []);

  /**
   * Handle wizard answer submission
   */
  const handleWizardSubmit = useCallback(async (answer: WizardAnswer) => {
    await wizard.submitAnswer(answer);
  }, [wizard]);

  /**
   * Handle wizard cancel
   */
  const handleWizardCancel = useCallback(async () => {
    await wizard.cancel();
    setWizardOpen(false);
    setConnectingProvider(null);
  }, [wizard]);

  /**
   * Handle wizard close (after completion)
   */
  useEffect(() => {
    if (wizard.done && wizardOpen) {
      // Refresh provider status after wizard completes
      setTimeout(() => {
        void loadProviderStatus();
        setWizardOpen(false);
        setConnectingProvider(null);
      }, 1500);
    }
  }, [wizard.done, wizardOpen, loadProviderStatus]);

  /**
   * Load providers on mount and when connection state changes
   */
  useEffect(() => {
    if (gateway.isConnected) {
      void loadProviderStatus();
    }
  }, [gateway.isConnected, loadProviderStatus]);

  // Mock usage data for demo
  const mockUsageData = useMemo(() => {
    const data: Record<string, { requests: number; tokens: number; cost: number; sparkline: number[] }> = {};
    providers.forEach((p) => {
      if (p.status === 'connected') {
        data[p.id] = {
          requests: Math.floor(Math.random() * 5000) + 500,
          tokens: Math.floor(Math.random() * 2000000) + 100000,
          cost: Math.floor(Math.random() * 5000) + 500,
          sparkline: generateMockSparkline(),
        };
      }
    });
    return data;
  }, [providers]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const connected = providers.filter((p) => p.status === 'connected').length;
    const total = providers.length;
    return { connected, total, percentage: total > 0 ? Math.round((connected / total) * 100) : 0 };
  }, [providers]);

  // Filter providers by selected runtime
  const filteredProviders = useMemo(() => {
    if (runtimeFilter === 'all') {return providers;}
    return providers.filter((p) => {
      const def = PROVIDER_DEFINITIONS.find((d) => d.id === p.id);
      return def?.runtimes?.includes(runtimeFilter);
    });
  }, [providers, runtimeFilter]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
              <Key className="w-7 h-7 text-primary" />
              Provider Authentication
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Connect your AI model providers to enable agents
            </p>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] px-4 py-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                <AnimatedCounter value={summaryStats.connected} />
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Connected</p>
            </div>
            <div className="w-px h-8 bg-[var(--color-surface-2)]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                {summaryStats.total}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Total</p>
            </div>
            <div className="w-px h-8 bg-[var(--color-surface-2)]" />
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle
                  className="text-[var(--color-surface-2)]"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="transparent"
                  r="15.5"
                  cx="18"
                  cy="18"
                />
                <circle
                  className="text-primary transition-all duration-1000"
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="15.5"
                  cx="18"
                  cy="18"
                  strokeDasharray={`${summaryStats.percentage} 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)]">
                {summaryStats.percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Connection Status Alert */}
        {!gateway.isConnected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium text-yellow-400">
                Gateway not connected
              </p>
              <p className="text-xs text-yellow-500/70">
                Connect to Gateway to manage providers
              </p>
            </div>
            <button
              type="button"
              onClick={gateway.reconnect}
              className="ml-auto px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-600/30 transition-colors"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={loadProviderStatus}
              className="ml-auto px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-[var(--color-text-secondary)]">Loading provider status...</p>
            </div>
          </div>
        )}

        {/* Runtime Filter Tabs */}
        {!loading && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Runtime:</span>
            {(['all', 'pi', 'claude-sdk'] as const).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setRuntimeFilter(rt)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  runtimeFilter === rt
                    ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-2)]/20 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                )}
              >
                {rt === 'all' ? 'All Providers' : rt === 'pi' ? 'Default (Pi)' : 'Claude SDK'}
              </button>
            ))}
          </div>
        )}

        {/* Provider Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProviders.map((provider) => (
              <ProviderGridCard
                key={provider.id}
                provider={provider}
                sparklineData={mockUsageData[provider.id]?.sparkline}
                usageStats={mockUsageData[provider.id]}
                onConnect={() => handleConnect(provider.id)}
                onManage={() => handleConnect(provider.id)}
                isEditing={editingProvider === provider.id}
                editingValue={editingProvider === provider.id ? editingValue : ''}
                onEditingValueChange={setEditingValue}
                onSaveKey={handleSaveKey}
                onCancelEdit={handleCancelEdit}
                savingKey={savingKey}
                saveError={editingProvider === provider.id ? saveError : null}
              />
            ))}
          </div>
        )}

        {/* Getting Started Hint */}
        {summaryStats.connected === 0 && !loading && (
          <div className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-primary/30 rounded-2xl p-6 text-center">
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Get Started with OpenClaw
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-4">
              Connect at least one AI provider to start creating agents.
              Anthropic (Claude) and OpenAI are the most popular choices.
            </p>
            <button
              type="button"
              onClick={() => {
                const anthropic = providers.find((p) => p.id === 'anthropic');
                if (anthropic) {void handleConnect('anthropic');}
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-[var(--color-text-primary)] rounded-xl font-medium hover:bg-primary transition-colors"
            >
              <Brain className="w-4 h-4" />
              Connect Claude (Anthropic)
            </button>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-[var(--color-surface-1)]/50 rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            About Authentication Methods
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-[var(--color-surface-2)] flex items-center justify-center flex-shrink-0 mt-0.5">
                🔑
              </div>
              <div>
                <p className="text-[var(--color-text-primary)] font-medium">API Key</p>
                <p className="text-[var(--color-text-muted)] text-xs">
                  Paste your secret key from the provider dashboard
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-[var(--color-surface-2)] flex items-center justify-center flex-shrink-0 mt-0.5">
                🔗
              </div>
              <div>
                <p className="text-[var(--color-text-primary)] font-medium">OAuth</p>
                <p className="text-[var(--color-text-muted)] text-xs">
                  Secure browser-based login with the provider
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-[var(--color-surface-2)] flex items-center justify-center flex-shrink-0 mt-0.5">
                📱
              </div>
              <div>
                <p className="text-[var(--color-text-primary)] font-medium">Device Code</p>
                <p className="text-[var(--color-text-muted)] text-xs">
                  Enter a code on the provider's website to link
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Modal */}
      <WizardModal
        open={wizardOpen}
        step={wizard.currentStep}
        loading={wizard.loading}
        error={wizard.error}
        title={wizardTitle}
        onSubmit={handleWizardSubmit}
        onCancel={handleWizardCancel}
        onDismiss={handleWizardCancel}
      />
    </div>
  );
}
