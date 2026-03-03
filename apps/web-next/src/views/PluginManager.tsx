import React, { useState } from "react";
import { cn } from "../lib/utils";

type PluginStatus = 'enabled' | 'disabled' | 'error' | 'updating';
type PluginCategory = 'integration' | 'tool' | 'model' | 'storage' | 'notification' | 'security';

interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: PluginCategory;
  status: PluginStatus;
  installedAt: string;
  permissions: string[];
  size: string;
}

interface MarketplacePlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  category: PluginCategory;
  downloads: number;
  rating: number; // 1-5
  version: string;
  installed: boolean;
}

const INSTALLED_PLUGINS: Plugin[] = [
  {
    id: "slack-relay",
    name: "Slack Relay",
    category: "integration",
    status: "enabled",
    version: "1.4.2",
    author: "OpenClaw Labs",
    description: "Bidirectional Slack message sync. Connects your Slack workspace to OpenClaw for real-time communication and channel management.",
    permissions: ["messages:read", "messages:write", "channels:list"],
    installedAt: "2024-01-15",
    size: "2.4 MB"
  },
  {
    id: "github-connector",
    name: "GitHub Connector",
    category: "integration",
    status: "enabled",
    version: "2.1.0",
    author: "OpenClaw Labs",
    description: "PR reviews, issues, and branch management. Automate your development workflow directly from the dashboard.",
    permissions: ["repos:read", "repos:write", "webhooks:manage"],
    installedAt: "2024-01-16",
    size: "3.1 MB"
  },
  {
    id: "openai-tts",
    name: "OpenAI TTS",
    category: "model",
    status: "enabled",
    version: "1.0.1",
    author: "OpenAI",
    description: "High-quality text-to-speech via OpenAI TTS-1-HD model. Perfect for voice-enabled agents and accessibility.",
    permissions: ["audio:generate"],
    installedAt: "2024-02-01",
    size: "1.2 MB"
  },
  {
    id: "s3-storage",
    name: "S3 Storage",
    category: "storage",
    status: "disabled",
    version: "1.2.3",
    author: "AWS",
    description: "AWS S3 bucket integration for persistent file storage and retrieval.",
    permissions: ["storage:read", "storage:write"],
    installedAt: "2024-01-20",
    size: "4.5 MB"
  },
  {
    id: "pagerduty-alerts",
    name: "PagerDuty Alerts",
    category: "notification",
    status: "enabled",
    version: "1.1.0",
    author: "PagerDuty",
    description: "Critical alert escalation to PagerDuty services for incident response management.",
    permissions: ["alerts:read", "notifications:send"],
    installedAt: "2024-02-10",
    size: "0.8 MB"
  },
  {
    id: "vault-secrets",
    name: "Vault Secrets",
    category: "security",
    status: "enabled",
    version: "3.0.1",
    author: "HashiCorp",
    description: "Secure HashiCorp Vault secret injection for environment variables and API keys.",
    permissions: ["secrets:read"],
    installedAt: "2024-01-05",
    size: "5.2 MB"
  },
  {
    id: "web-scraper",
    name: "Web Scraper",
    category: "tool",
    status: "error",
    version: "0.9.5",
    author: "Community",
    description: "Headless browser scraping tool for extracting structured data from any website.",
    permissions: ["browser:control", "network:fetch"],
    installedAt: "2024-02-15",
    size: "12.4 MB"
  },
  {
    id: "prometheus-metrics",
    name: "Prometheus Metrics",
    category: "tool",
    status: "updating",
    version: "2.3.0",
    author: "CloudNative",
    description: "Export real-time system and agent metrics to a Prometheus-compatible endpoint.",
    permissions: ["metrics:export"],
    installedAt: "2024-02-18",
    size: "2.1 MB"
  }
];

const MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  { id: "notion-sync", name: "Notion Sync", author: "Notion", category: "integration", downloads: 45000, rating: 4.8, version: "2.0.1", description: "Keep your workspace and Notion pages in perfect sync.", installed: false },
  { id: "linear-app", name: "Linear", author: "Linear", category: "integration", downloads: 32000, rating: 4.9, version: "1.5.0", description: "The issue tracker you'll actually like using, integrated.", installed: false },
  { id: "jira-connect", name: "Jira Connector", author: "Atlassian", category: "integration", downloads: 85000, rating: 3.8, version: "4.2.1", description: "Enterprise-grade Jira issue and project management.", installed: false },
  { id: "discord-relay", name: "Discord Relay", author: "OpenClaw Labs", category: "integration", downloads: 12000, rating: 4.5, version: "1.2.0", description: "Bridge your Discord channels to OpenClaw agents.", installed: false },
  { id: "code-runner", name: "Code Runner", author: "DevTools Inc", category: "tool", downloads: 56000, rating: 4.7, version: "3.1.2", description: "Isolated environment for running untrusted code blocks.", installed: false },
  { id: "sql-explorer", name: "SQL Explorer", author: "DataFlow", category: "tool", downloads: 8000, rating: 4.2, version: "1.1.0", description: "Visual SQL query builder and explorer for multiple databases.", installed: false },
  { id: "pdf-parser", name: "PDF Parser", author: "DocuBot", category: "tool", downloads: 22000, rating: 4.4, version: "2.0.0", description: "Extract text and structured data from complex PDF files.", installed: false },
  { id: "anthropic-bedrock", name: "Anthropic Bedrock", author: "AWS", category: "model", downloads: 15000, rating: 4.6, version: "1.0.5", description: "Claude 3 models via Amazon Bedrock infrastructure.", installed: false },
  { id: "azure-openai", name: "Azure OpenAI", author: "Microsoft", category: "model", downloads: 67000, rating: 4.3, version: "2.4.0", description: "Enterprise OpenAI models hosted on Azure cloud.", installed: false },
  { id: "gcs-storage", name: "GCS Storage", author: "Google Cloud", category: "storage", downloads: 25000, rating: 4.5, version: "1.8.2", description: "Google Cloud Storage integration for your datasets.", installed: false },
  { id: "dropbox-link", name: "Dropbox", author: "Dropbox", category: "storage", downloads: 41000, rating: 4.1, version: "3.0.1", description: "Sync agent output directly to your Dropbox folders.", installed: false },
  { id: "twilio-sms", name: "Twilio SMS", author: "Twilio", category: "notification", downloads: 18000, rating: 4.7, version: "1.0.2", description: "Send and receive SMS notifications globally.", installed: false },
  { id: "slack-relay-m", name: "Slack Relay", author: "OpenClaw Labs", category: "integration", downloads: 92000, rating: 4.8, version: "1.4.2", description: "Bidirectional Slack message sync.", installed: true },
];

const CATEGORIES: PluginCategory[] = ['integration', 'tool', 'model', 'storage', 'notification', 'security'];

export default function PluginManager() {
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');
  const [selectedPluginId, setSelectedPluginId] = useState<string>(INSTALLED_PLUGINS[0].id);
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PluginCategory | 'all'>('all');
  const [viewingMarketplacePlugin, setViewingMarketplacePlugin] = useState<MarketplacePlugin | null>(null);

  const selectedPlugin = INSTALLED_PLUGINS.find(p => p.id === selectedPluginId) || INSTALLED_PLUGINS[0];

  const filteredMarketplace = MARKETPLACE_PLUGINS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(marketplaceSearch.toLowerCase()) || 
                          p.description.toLowerCase().includes(marketplaceSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar - Installed Plugins */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold tracking-tight">Plugins</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage your extensions</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <div role="listbox" aria-label="Installed plugins" className="space-y-1">
            {INSTALLED_PLUGINS.map((plugin) => (
              <button
                key={plugin.id}
                onClick={() => {
                  setSelectedPluginId(plugin.id);
                  setActiveTab('installed');
                }}
                aria-selected={selectedPluginId === plugin.id && activeTab === 'installed'}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  selectedPluginId === plugin.id && activeTab === 'installed'
                    ? "bg-zinc-900 border border-zinc-700 shadow-sm"
                    : "hover:bg-zinc-900/50 border border-transparent text-zinc-400 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{plugin.name}</span>
                  <StatusIndicator status={plugin.status} size="sm" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{plugin.category}</span>
                  <span className="text-[10px] text-zinc-600">•</span>
                  <span className="text-[10px] text-zinc-500">{plugin.version}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={() => setActiveTab('marketplace')}
            className={cn(
              "w-full py-2 px-4 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              activeTab === 'marketplace' 
                ? "bg-indigo-600 text-white" 
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
            )}
          >
            Browse Marketplace
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
        {/* Top Header / Tabs */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex gap-8 h-full">
            <button 
              onClick={() => setActiveTab('installed')}
              className={cn(
                "h-full px-1 border-b-2 transition-colors text-sm font-medium flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ring-offset-zinc-950",
                activeTab === 'installed' ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              Installed
            </button>
            <button 
              onClick={() => setActiveTab('marketplace')}
              className={cn(
                "h-full px-1 border-b-2 transition-colors text-sm font-medium flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ring-offset-zinc-950",
                activeTab === 'marketplace' ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              Marketplace
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'installed' ? (
            <InstalledTabView plugin={selectedPlugin} />
          ) : (
            <MarketplaceTabView 
              plugins={filteredMarketplace}
              search={marketplaceSearch}
              onSearchChange={setMarketplaceSearch}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              onViewPlugin={setViewingMarketplacePlugin}
            />
          )}
        </div>
      </main>

      {/* Marketplace Detail Modal */}
      {viewingMarketplacePlugin && (
        <MarketplaceModal 
          plugin={viewingMarketplacePlugin} 
          onClose={() => setViewingMarketplacePlugin(null)} 
        />
      )}
    </div>
  );
}

function InstalledTabView({ plugin }: { plugin: Plugin }) {
  return (
    <div className="p-8 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight text-white">{plugin.name}</h2>
            <span className="text-zinc-500 text-lg">v{plugin.version}</span>
          </div>
          <div className="flex items-center gap-3">
            <CategoryBadge category={plugin.category} />
            <StatusBadge status={plugin.status} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {plugin.status === 'disabled' ? (
            <button className="px-4 py-2 bg-zinc-100 text-zinc-950 rounded-md text-sm font-bold hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              Enable Plugin
            </button>
          ) : (
            <button className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-md text-sm font-bold hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              Disable
            </button>
          )}
          {plugin.id === 'prometheus-metrics' && (
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-500 transition-colors animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              Update Available
            </button>
          )}
          <button className="px-4 py-2 text-rose-400 hover:text-rose-300 rounded-md text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            Uninstall
          </button>
        </div>
      </div>

      {/* Special States */}
      {plugin.status === 'error' && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4 text-rose-400">
            <div className="p-2 bg-rose-500/20 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="font-bold">Plugin Error</p>
              <p className="text-sm opacity-80">The plugin failed to initialize. Check logs for details.</p>
            </div>
          </div>
          <button className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-md hover:bg-rose-400 transition-colors">
            Retry Initialization
          </button>
        </div>
      )}

      {plugin.status === 'updating' && (
        <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-bold text-zinc-200">Updating to v2.3.1...</span>
            </div>
            <span className="text-zinc-500 text-sm">65% complete</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-500 h-full w-[65%] rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <section>
            <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4">Description</h3>
            <p className="text-zinc-300 leading-relaxed text-lg">{plugin.description}</p>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4">Permissions</h3>
            <div className="flex flex-wrap gap-2">
              {plugin.permissions.map(p => (
                <span key={p} className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono rounded-full">
                  {p}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4">Metadata</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Author</p>
                <p className="text-zinc-200 font-medium">{plugin.author}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Installed At</p>
                <p className="text-zinc-200 font-medium">{plugin.installedAt}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Storage Size</p>
                <p className="text-zinc-200 font-medium">{plugin.size}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketplaceTabView({ 
  plugins, search, onSearchChange, categoryFilter, onCategoryChange, onViewPlugin 
}: { 
  plugins: MarketplacePlugin[], 
  search: string, 
  onSearchChange: (v: string) => void,
  categoryFilter: PluginCategory | 'all',
  onCategoryChange: (v: PluginCategory | 'all') => void,
  onViewPlugin: (p: MarketplacePlugin) => void
}) {
  return (
    <div className="p-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <FilterChip 
            label="All" 
            active={categoryFilter === 'all'} 
            onClick={() => onCategoryChange('all')} 
          />
          {CATEGORIES.map(cat => (
            <FilterChip 
              key={cat} 
              label={cat} 
              active={categoryFilter === cat} 
              onClick={() => onCategoryChange(cat)} 
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plugins.map(plugin => (
          <div 
            key={plugin.id} 
            onClick={() => onViewPlugin(plugin)}
            className="group p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all cursor-pointer flex flex-col h-full hover:shadow-xl hover:shadow-black/20"
          >
            <div className="flex justify-between items-start mb-3">
              <CategoryBadge category={plugin.category} />
              <div className="flex items-center text-amber-400 text-xs font-bold gap-1">
                <span>{plugin.rating}</span>
                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
            </div>
            <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{plugin.name}</h4>
            <p className="text-xs text-zinc-500 mb-3 font-medium">by {plugin.author}</p>
            <p className="text-sm text-zinc-400 line-clamp-2 mb-6 flex-1 leading-relaxed">{plugin.description}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50 mt-auto">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{plugin.downloads.toLocaleString()} DLs</span>
              {plugin.installed ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  Installed
                </div>
              ) : (
                <button 
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Install logic
                  }}
                >
                  Install
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketplaceModal({ plugin, onClose }: { plugin: MarketplacePlugin, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative h-32 bg-gradient-to-br from-indigo-900/40 to-zinc-950 border-b border-zinc-800">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-zinc-400 hover:text-white rounded-full transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-8 -mt-12">
          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 bg-zinc-900 border-4 border-zinc-950 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl font-bold text-indigo-500">{plugin.name.charAt(0)}</span>
                </div>
                <div className="pt-8">
                  <h2 className="text-2xl font-bold text-white">{plugin.name}</h2>
                  <p className="text-zinc-500 text-sm">v{plugin.version} by <span className="text-zinc-300">{plugin.author}</span></p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5 text-amber-400">
                <RatingStars rating={plugin.rating} />
                <span className="text-sm font-bold ml-1">{plugin.rating}</span>
              </div>
              <span className="text-xs text-zinc-500 font-bold uppercase">{plugin.downloads.toLocaleString()} downloads</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-2">
              <CategoryBadge category={plugin.category} />
              <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider rounded">verified</span>
            </div>

            <p className="text-zinc-300 leading-relaxed">{plugin.description}</p>

            <section>
              <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Required Permissions</h3>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
                {["identity:read", "workspace:write", "network:access"].map(perm => (
                  <div key={perm} className="flex items-center gap-2 text-sm text-zinc-400">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    {perm}
                  </div>
                ))}
              </div>
            </section>

            <div className="pt-4 flex gap-3">
              {plugin.installed ? (
                <button className="flex-1 py-3 bg-zinc-800 text-zinc-500 font-bold rounded-xl cursor-default flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  Plugin Installed
                </button>
              ) : (
                <button className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-2 ring-offset-zinc-950">
                  Install {plugin.name}
                </button>
              )}
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl border border-zinc-800 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Helper Components */

function StatusIndicator({ status, size = "md" }: { status: PluginStatus, size?: "sm" | "md" }) {
  const colors = {
    enabled: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]",
    disabled: "bg-zinc-600",
    error: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.4)]",
    updating: "bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.4)]"
  };
  const sizeClasses = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  return <div className={cn("rounded-full", sizeClasses, colors[status])} />;
}

function CategoryBadge({ category }: { category: PluginCategory }) {
  return (
    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-widest rounded">
      {category}
    </span>
  );
}

function StatusBadge({ status }: { status: PluginStatus }) {
  const styles = {
    enabled: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    disabled: "bg-zinc-800 text-zinc-500 border-zinc-700",
    error: "bg-rose-400/10 text-rose-400 border-rose-400/20",
    updating: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20"
  };
  return (
    <span className={cn("px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border", styles[status])}>
      {status}
    </span>
  );
}

function FilterChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
        active 
          ? "bg-indigo-600 border-indigo-500 text-white" 
          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
      )}
    >
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </button>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg 
          key={star}
          className={cn("w-3.5 h-3.5", star <= Math.floor(rating) ? "text-amber-400 fill-current" : "text-zinc-700 fill-current")}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}
