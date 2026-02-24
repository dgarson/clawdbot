import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import {
  Settings, User, Palette, Bell, Shield, Zap, Database,
  ChevronRight, Check, AlertTriangle, RefreshCw, Monitor,
  Moon, Sun, Globe, Key, Trash2, Download, Upload, ToggleLeft, ToggleRight,
  Plug, ExternalLink,
} from 'lucide-react';
import { useGateway } from '../hooks/useGateway';
import type { OpenClawConfig } from '../types';

type SettingsSection =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'performance'
  | 'data'
  | 'providers'
  | 'advanced';

interface SettingsSectionDef {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const SECTIONS: SettingsSectionDef[] = [
  { id: 'general', label: 'General', icon: Settings, description: 'Basic settings and preferences' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and display options' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert and sound preferences' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Auth tokens and device management' },
  { id: 'providers', label: 'Providers', icon: Plug, description: 'Model provider authentication' },
  { id: 'performance', label: 'Performance', icon: Zap, description: 'Speed and caching options' },
  { id: 'data', label: 'Data & Privacy', icon: Database, description: 'Export, import, and deletion' },
  { id: 'advanced', label: 'Advanced', icon: Monitor, description: 'Debug, logs, and dev tools' },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
        value ? 'bg-violet-600' : 'bg-surface-3'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
        value ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
  danger,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between py-4 border-b border-tok-border last:border-0',
      danger && 'py-3'
    )}>
      <div className="flex-1 mr-8">
        <p className={cn('text-sm font-medium', danger ? 'text-red-400' : 'text-fg-primary')}>{label}</p>
        {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SelectInput({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-2 border border-tok-border text-fg-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 min-w-32"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ============================================================================
// Section content components
// ============================================================================

function GeneralSettings() {
  const [gatewayUrl, setGatewayUrl] = useState('ws://localhost:18789');
  const [autoConnect, setAutoConnect] = useState(true);
  const [timezone, setTimezone] = useState('America/Denver');
  const [language, setLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <SettingRow label="Gateway URL" description="WebSocket URL for the OpenClaw Gateway">
        <input
          type="text"
          aria-label="Gateway URL"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          className="bg-surface-2 border border-tok-border text-fg-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 w-64 font-mono"
        />
      </SettingRow>
      <SettingRow label="Auto-connect" description="Automatically connect to Gateway on startup">
        <Toggle value={autoConnect} onChange={setAutoConnect} />
      </SettingRow>
      <SettingRow label="Timezone" description="Used for displaying dates and scheduling">
        <SelectInput
          value={timezone}
          onChange={setTimezone}
          options={[
            { value: 'America/Denver', label: 'Mountain Time' },
            { value: 'America/New_York', label: 'Eastern Time' },
            { value: 'America/Los_Angeles', label: 'Pacific Time' },
            { value: 'Europe/London', label: 'London' },
            { value: 'Asia/Tokyo', label: 'Tokyo' },
          ]}
        />
      </SettingRow>
      <SettingRow label="Language">
        <SelectInput
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' },
            { value: 'de', label: 'German' },
            { value: 'ja', label: 'Japanese' },
          ]}
        />
      </SettingRow>
      <div className="pt-4">
        <button
          type="button"
          onClick={handleSave}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            saved
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-violet-600 hover:bg-violet-500 text-fg-primary'
          )}
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [accentColor, setAccentColor] = useState('violet');
  const [fontSize, setFontSize] = useState('medium');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [animations, setAnimations] = useState(true);

  const THEMES = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'system', label: 'System', icon: Monitor },
  ] as const;

  const ACCENTS = [
    { id: 'violet', color: 'bg-violet-500' },
    { id: 'blue', color: 'bg-blue-500' },
    { id: 'green', color: 'bg-green-500' },
    { id: 'orange', color: 'bg-orange-500' },
    { id: 'pink', color: 'bg-pink-500' },
  ];

  return (
    <div>
      <SettingRow label="Theme" description="Choose your color scheme">
        <div className="flex gap-2">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all',
                theme === id
                  ? 'bg-violet-600/20 text-violet-400 border border-violet-500/50'
                  : 'bg-surface-2 text-fg-secondary border border-tok-border hover:border-tok-border'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Accent Color" description="Primary action and highlight color">
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccentColor(a.id)}
              className={cn(
                'w-7 h-7 rounded-full transition-all',
                a.color,
                accentColor === a.id ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950 scale-110' : 'hover:scale-105'
              )}
            />
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Font Size">
        <SelectInput
          value={fontSize}
          onChange={setFontSize}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
        />
      </SettingRow>
      <SettingRow label="Compact Mode" description="Reduce padding for higher information density">
        <Toggle value={compactMode} onChange={setCompactMode} />
      </SettingRow>
      <SettingRow label="Sidebar collapsed by default">
        <Toggle value={sidebarCollapsed} onChange={setSidebarCollapsed} />
      </SettingRow>
      <SettingRow label="Animations" description="Enable motion effects and transitions">
        <Toggle value={animations} onChange={setAnimations} />
      </SettingRow>
    </div>
  );
}

function NotificationSettings() {
  const [desktopNotif, setDesktopNotif] = useState(true);
  const [agentComplete, setAgentComplete] = useState(true);
  const [cronFailure, setCronFailure] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [quietHours, setQuietHours] = useState(true);

  return (
    <div>
      <SettingRow label="Desktop Notifications" description="Show system notifications for important events">
        <Toggle value={desktopNotif} onChange={setDesktopNotif} />
      </SettingRow>
      <SettingRow label="Agent task complete" description="Notify when a long-running agent task finishes">
        <Toggle value={agentComplete} onChange={setAgentComplete} />
      </SettingRow>
      <SettingRow label="Cron job failures" description="Alert when an automation fails">
        <Toggle value={cronFailure} onChange={setCronFailure} />
      </SettingRow>
      <SettingRow label="Daily digest" description="Morning summary of activity">
        <Toggle value={dailyDigest} onChange={setDailyDigest} />
      </SettingRow>
      <SettingRow label="Sound effects">
        <Toggle value={soundEnabled} onChange={setSoundEnabled} />
      </SettingRow>
      <SettingRow label="Quiet hours (10 PM – 8 AM)" description="Suppress non-urgent notifications">
        <Toggle value={quietHours} onChange={setQuietHours} />
      </SettingRow>
    </div>
  );
}

function SecuritySettings() {
  const [sessionTimeout, setSessionTimeout] = useState('never');
  const [requireConfirm, setRequireConfirm] = useState(true);
  const [logAccess, setLogAccess] = useState(false);

  return (
    <div>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-400">
          Device tokens are stored in IndexedDB and never sent to third parties. Rotate tokens periodically for best security.
        </p>
      </div>
      <SettingRow label="Session timeout">
        <SelectInput
          value={sessionTimeout}
          onChange={setSessionTimeout}
          options={[
            { value: 'never', label: 'Never' },
            { value: '1h', label: '1 hour' },
            { value: '8h', label: '8 hours' },
            { value: '24h', label: '24 hours' },
          ]}
        />
      </SettingRow>
      <SettingRow label="Confirm destructive actions" description="Require confirmation before delete/reset">
        <Toggle value={requireConfirm} onChange={setRequireConfirm} />
      </SettingRow>
      <SettingRow label="Log access events" description="Record reads/writes to audit log">
        <Toggle value={logAccess} onChange={setLogAccess} />
      </SettingRow>
      <SettingRow label="Device Token" description="Your current authentication token">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary text-sm rounded-lg transition-colors border border-tok-border"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Rotate Token
        </button>
      </SettingRow>
      <SettingRow label="API Keys" description="Manage API keys for programmatic access">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary text-sm rounded-lg transition-colors border border-tok-border"
        >
          <Key className="w-3.5 h-3.5" />
          Manage Keys
        </button>
      </SettingRow>
    </div>
  );
}

function DataSettings() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          className="flex items-center gap-3 p-4 bg-surface-2 hover:bg-surface-3 rounded-xl border border-tok-border transition-all"
        >
          <Download className="w-5 h-5 text-violet-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-fg-primary">Export All Data</p>
            <p className="text-xs text-fg-muted">JSON backup of all agents, sessions, config</p>
          </div>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 p-4 bg-surface-2 hover:bg-surface-3 rounded-xl border border-tok-border transition-all"
        >
          <Upload className="w-5 h-5 text-green-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-fg-primary">Import Backup</p>
            <p className="text-xs text-fg-muted">Restore from a previous export</p>
          </div>
        </button>
      </div>

      <div className="bg-surface-1 rounded-xl border border-tok-border p-4">
        <h4 className="text-sm font-semibold text-fg-secondary mb-4">Danger Zone</h4>
        <div className="space-y-3">
          <SettingRow label="Clear session history" description="Delete all conversation history" danger>
            <button type="button" className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm rounded-lg border border-red-600/30 transition-colors">
              Clear
            </button>
          </SettingRow>
          <SettingRow label="Clear analytics data" description="Reset all usage and cost data" danger>
            <button type="button" className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm rounded-lg border border-red-600/30 transition-colors">
              Clear
            </button>
          </SettingRow>
          <SettingRow label="Factory reset" description="Delete all data and return to setup" danger>
            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm rounded-lg border border-red-600/30 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function AdvancedSettings() {
  const [devMode, setDevMode] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [logLevel, setLogLevel] = useState('info');
  const [streamDebug, setStreamDebug] = useState(false);

  return (
    <div>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-400">
          ⚙️ Advanced settings are for power users. Incorrect configuration may affect stability.
        </p>
      </div>
      <SettingRow label="Developer Mode" description="Enable additional debug UI elements">
        <Toggle value={devMode} onChange={setDevMode} />
      </SettingRow>
      <SettingRow label="Verbose logging" description="Log all WebSocket messages to console">
        <Toggle value={verbose} onChange={setVerbose} />
      </SettingRow>
      <SettingRow label="Log Level">
        <SelectInput
          value={logLevel}
          onChange={setLogLevel}
          options={[
            { value: 'error', label: 'Error' },
            { value: 'warn', label: 'Warning' },
            { value: 'info', label: 'Info' },
            { value: 'debug', label: 'Debug' },
          ]}
        />
      </SettingRow>
      <SettingRow label="Stream debug overlay" description="Show streaming event overlay in chat">
        <Toggle value={streamDebug} onChange={setStreamDebug} />
      </SettingRow>
      <SettingRow label="Gateway version" description="Currently connected">
        <span className="text-sm font-mono text-fg-secondary bg-surface-2 px-2 py-1 rounded">v1.2.0</span>
      </SettingRow>
      <SettingRow label="UI version">
        <span className="text-sm font-mono text-fg-secondary bg-surface-2 px-2 py-1 rounded">0.1.0</span>
      </SettingRow>
    </div>
  );
}

// ============================================================================
// Providers Settings Section
// ============================================================================

function ProvidersSettings() {
  const gateway = useGateway();
  const [profiles, setProfiles] = useState<Record<string, { provider: string; mode: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!gateway.isConnected) {return;}
    setLoading(true);
    setError(null);
    try {
      const config = await gateway.call<OpenClawConfig>('config.get', {});
      const rawProfiles = (config.auth?.profiles ?? {});
      const parsed: Record<string, { provider: string; mode: string }> = {};
      for (const [k, v] of Object.entries(rawProfiles)) {
        if (v && typeof v === 'object') {
          const obj = v as Record<string, unknown>;
          parsed[k] = {
            provider: typeof obj.provider === "string" ? obj.provider : k,
            mode: typeof obj.mode === "string" ? obj.mode : "unknown",
          };
        }
      }
      setProfiles(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider profiles');
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    if (gateway.isConnected) {
      void loadProfiles();
    }
  }, [gateway.isConnected, loadProfiles]);

  const profileKeys = Object.keys(profiles);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-fg-secondary">
          Manage AI model provider authentication. Connect providers to enable agents.
        </p>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); /* navigate handled at App level via URL or hash */ }}
          className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Open Provider Manager
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {!gateway.isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-400">Gateway not connected</p>
            <p className="text-xs text-yellow-500/70">Start Gateway to manage providers</p>
          </div>
          <button
            type="button"
            onClick={gateway.reconnect}
            className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-xs hover:bg-yellow-600/30 transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button type="button" onClick={loadProfiles} className="text-xs text-red-400 hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <RefreshCw className="w-5 h-5 text-violet-500 animate-spin" />
        </div>
      ) : profileKeys.length === 0 ? (
        <div className="bg-surface-1 rounded-xl border border-tok-border p-6 text-center">
          <Plug className="w-8 h-8 text-fg-muted mx-auto mb-3" />
          <p className="text-sm text-fg-secondary">No providers connected</p>
          <p className="text-xs text-fg-muted mt-1">
            Use the Provider Manager to connect AI model providers
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {profileKeys.map((profileId) => {
            const profile = profiles[profileId];
            return (
              <div
                key={profileId}
                className="flex items-center justify-between p-4 bg-surface-1 rounded-xl border border-tok-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-primary">{profile.provider}</p>
                    <p className="text-xs text-fg-muted">
                      {profileId} · {profile.mode}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Connected
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-tok-border">
        <p className="text-xs text-fg-muted">
          Credentials are stored securely in <code className="text-fg-muted">auth-profiles.json</code> and never exposed in the UI.
          Use the Provider Manager to add, remove, or re-authenticate providers.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SettingsDashboard() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  function renderSection() {
    switch (activeSection) {
      case 'general': return <GeneralSettings />;
      case 'appearance': return <AppearanceSettings />;
      case 'notifications': return <NotificationSettings />;
      case 'security': return <SecuritySettings />;
      case 'providers': return <ProvidersSettings />;
      case 'data': return <DataSettings />;
      case 'advanced': return <AdvancedSettings />;
      default: return (
        <div className="flex items-center justify-center h-40 text-fg-muted">
          <p>Select a section</p>
        </div>
      );
    }
  }

  const active = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-surface-0 p-3 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg-primary flex items-center gap-3">
            <Settings className="w-6 h-6 text-violet-400" />
            Settings
          </h1>
          <p className="text-sm text-fg-secondary mt-1">Manage your OpenClaw preferences and configuration</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar nav */}
          <div className="sm:w-56 flex-shrink-0">
            <nav className="space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-left',
                      isActive
                        ? 'bg-violet-600/15 text-violet-300 border border-violet-500/30'
                        : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-2/50'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive ? 'text-violet-400' : 'text-fg-muted')} />
                    <span>{section.label}</span>
                    {isActive && <ChevronRight className="w-3 h-3 ml-auto text-violet-500" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content area */}
          <div className="flex-1">
            <div className="bg-surface-1 rounded-2xl border border-tok-border p-3 sm:p-4 md:p-6">
              <div className="mb-5 pb-4 border-b border-tok-border">
                <h2 className="text-lg font-semibold text-fg-primary">{active?.label}</h2>
                <p className="text-sm text-fg-muted">{active?.description}</p>
              </div>
              {renderSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
