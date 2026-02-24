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
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models via API key',
    icon: '🤖',
    authKind: 'api_key',
    docsUrl: 'https://platform.openai.com/api-keys',
    popular: true,
  },
  {
    id: 'minimax-portal',
    name: 'MiniMax',
    description: 'MiniMax models via OAuth portal',
    icon: '⚡',
    authKind: 'oauth',
    popular: true,
  },
  {
    id: 'qwen-portal',
    name: 'Qwen',
    description: 'Alibaba Qwen models via device code',
    icon: '🌟',
    authKind: 'device_code',
  },
  {
    id: 'google-gemini-cli',
    name: 'Gemini CLI',
    description: 'Google Gemini via OAuth',
    icon: '💎',
    authKind: 'oauth',
    popular: true,
  },
  {
    id: 'google-antigravity',
    name: 'Antigravity',
    description: 'Google Antigravity via OAuth',
    icon: '🚀',
    authKind: 'oauth',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    description: 'Codex models via OAuth',
    icon: '💻',
    authKind: 'oauth',
  },
  {
    id: 'chutes',
    name: 'Chutes',
    description: 'Chutes models via OAuth',
    icon: '🎯',
    authKind: 'oauth',
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
}

function ProviderGridCard({
  provider,
  sparklineData,
  onConnect,
  onManage,
  usageStats,
}: ProviderGridCardProps) {
  const isConnected = provider.status === 'connected';
  const isExpired = provider.status === 'expired';
  const isError = provider.status === 'error';

  return (
    <div
      className={cn(
        'relative bg-gray-900 rounded-2xl border overflow-hidden',
        'transition-all duration-300',
        isConnected
          ? 'border-green-500/30 hover:border-green-500/50'
          : isExpired
          ? 'border-yellow-500/30 hover:border-yellow-500/50'
          : isError
          ? 'border-red-500/30 hover:border-red-500/50'
          : 'border-gray-800 hover:border-gray-700',
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
                  : 'bg-gray-800'
              )}
            >
              {provider.icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                {provider.name}
                {provider.popular && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-normal">
                    Popular
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
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
              <p className="text-lg font-bold text-white">
                <AnimatedCounter value={usageStats.requests} />
              </p>
              <p className="text-xs text-gray-500">Requests</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                <AnimatedCounter value={usageStats.tokens} formatter={(v) => 
                  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` :
                  v >= 1000 ? `${(v / 1000).toFixed(1)}K` :
                  v.toString()
                } />
              </p>
              <p className="text-xs text-gray-500">Tokens</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                ${(usageStats.cost / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">Cost</p>
            </div>
          </div>
        )}

        {/* Sparkline (if connected and has data) */}
        {isConnected && sparklineData && sparklineData.length > 0 && (
          <div className="mb-4 p-3 bg-gray-800/50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Usage (14 days)</span>
              <span className="text-xs text-gray-500">~{Math.round(sparklineData.reduce((a, b) => a + b, 0) / sparklineData.length)} avg/day</span>
            </div>
            <SparklineChart
              data={sparklineData}
              width={200}
              height={40}
              color="rgb(34, 197, 94)"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={onManage}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Manage
              </button>
              <button
                type="button"
                onClick={onConnect}
                className="py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors"
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
                  : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/30'
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

        {/* Auth kind badge */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            Auth: <span className="text-gray-400">{provider.authKind.replace('_', ' ')}</span>
          </span>
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
            >
              Docs <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
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

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTitle, setWizardTitle] = useState('Connect Provider');
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

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
   * Handle connect button click
   */
  const handleConnect = useCallback(async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {return;}

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
  }, [providers, wizard]);

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

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Key className="w-7 h-7 text-violet-400" />
              Provider Authentication
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Connect your AI model providers to enable agents
            </p>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 bg-gray-900 rounded-xl border border-gray-800 px-4 py-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                <AnimatedCounter value={summaryStats.connected} />
              </p>
              <p className="text-xs text-gray-500">Connected</p>
            </div>
            <div className="w-px h-8 bg-gray-800" />
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">
                {summaryStats.total}
              </p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="w-px h-8 bg-gray-800" />
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle
                  className="text-gray-800"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="transparent"
                  r="15.5"
                  cx="18"
                  cy="18"
                />
                <circle
                  className="text-violet-500 transition-all duration-1000"
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
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
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
              <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-sm text-gray-400">Loading provider status...</p>
            </div>
          </div>
        )}

        {/* Provider Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <ProviderGridCard
                key={provider.id}
                provider={provider}
                sparklineData={mockUsageData[provider.id]?.sparkline}
                usageStats={mockUsageData[provider.id]}
                onConnect={() => handleConnect(provider.id)}
                onManage={() => handleConnect(provider.id)}
              />
            ))}
          </div>
        )}

        {/* Getting Started Hint */}
        {summaryStats.connected === 0 && !loading && (
          <div className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-500/30 rounded-2xl p-6 text-center">
            <Sparkles className="w-10 h-10 text-violet-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Get Started with OpenClaw
            </h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
              Connect at least one AI provider to start creating agents.
              Anthropic (Claude) and OpenAI are the most popular choices.
            </p>
            <button
              type="button"
              onClick={() => {
                const anthropic = providers.find((p) => p.id === 'anthropic');
                if (anthropic) {void handleConnect('anthropic');}
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-500 transition-colors"
            >
              <Brain className="w-4 h-4" />
              Connect Claude (Anthropic)
            </button>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            About Authentication Methods
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                🔑
              </div>
              <div>
                <p className="text-white font-medium">API Key</p>
                <p className="text-gray-500 text-xs">
                  Paste your secret key from the provider dashboard
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                🔗
              </div>
              <div>
                <p className="text-white font-medium">OAuth</p>
                <p className="text-gray-500 text-xs">
                  Secure browser-based login with the provider
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                📱
              </div>
              <div>
                <p className="text-white font-medium">Device Code</p>
                <p className="text-gray-500 text-xs">
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
