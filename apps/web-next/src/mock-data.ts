import type { Agent, Session, CronJob, Skill, Node, UsageSummary, ChatMessage } from './types';

// ============================================================================
// Mock Agents
// ============================================================================

export const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Xavier',
    emoji: '🧠',
    role: 'CTO',
    status: 'active',
    health: 'healthy',
    lastActive: new Date(Date.now() - 120000).toISOString(),
    model: 'claude-opus-4-6',
    description: 'Chief Technology Officer — owns technical architecture and engineering',
    personality: { formality: 70, humor: 30, verbosity: 50, empathy: 60, tone: 'technical' },
    tools: ['exec', 'read', 'write', 'web_search'],
    skills: ['coding', 'architecture'],
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: '2',
    name: 'Stephan',
    emoji: '📣',
    role: 'CMO',
    status: 'idle',
    health: 'healthy',
    lastActive: new Date(Date.now() - 3600000).toISOString(),
    model: 'claude-opus-4-6',
    description: 'Chief Marketing Officer — brand, content, and growth',
    personality: { formality: 40, humor: 70, verbosity: 60, empathy: 80, tone: 'casual' },
    tools: ['web_search', 'web_fetch', 'message'],
    skills: ['marketing', 'writing'],
    createdAt: '2026-01-16T00:00:00Z',
  },
  {
    id: '3',
    name: 'Luis',
    emoji: '🎨',
    role: 'Principal UX Engineer',
    status: 'active',
    health: 'healthy',
    lastActive: new Date().toISOString(),
    model: 'claude-opus-4-6',
    description: 'UX/UI lead — design systems, frontend implementation, user experience',
    personality: { formality: 50, humor: 50, verbosity: 40, empathy: 90, tone: 'friendly' },
    tools: ['exec', 'read', 'write', 'browser'],
    skills: ['design', 'frontend', 'ux-research'],
    createdAt: '2026-01-17T00:00:00Z',
  },
  {
    id: '4',
    name: 'Tim',
    emoji: '🏗️',
    role: 'VP Architecture',
    status: 'offline',
    health: 'degraded',
    lastActive: new Date(Date.now() - 86400000).toISOString(),
    model: 'claude-sonnet-4-6',
    description: 'VP of Architecture — system design, scalability, technical strategy',
    personality: { formality: 80, humor: 20, verbosity: 70, empathy: 40, tone: 'professional' },
    tools: ['exec', 'read', 'write'],
    skills: ['architecture', 'systems-design'],
    createdAt: '2026-01-18T00:00:00Z',
  },
  {
    id: '5',
    name: 'Harry',
    emoji: '⚡',
    role: 'Senior Engineer',
    status: 'active',
    health: 'healthy',
    lastActive: new Date(Date.now() - 300000).toISOString(),
    model: 'claude-sonnet-4-6',
    description: 'Senior Engineer — fast execution, component implementation',
    personality: { formality: 50, humor: 40, verbosity: 30, empathy: 50, tone: 'efficient' },
    tools: ['exec', 'read', 'write', 'web_search'],
    skills: ['coding', 'devops'],
    createdAt: '2026-01-19T00:00:00Z',
  },
];

// ============================================================================
// Mock Sessions
// ============================================================================

export const MOCK_SESSIONS: Session[] = [
  {
    key: 'agent:luis:main',
    agentId: '3',
    agentName: 'Luis',
    agentEmoji: '🎨',
    status: 'active',
    messageCount: 47,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    lastActivity: new Date(Date.now() - 120000).toISOString(),
    tokenUsage: { input: 45000, output: 12000, total: 57000 },
    cost: 1.24,
    label: 'UI Work Session',
  },
  {
    key: 'agent:xavier:main',
    agentId: '1',
    agentName: 'Xavier',
    agentEmoji: '🧠',
    status: 'idle',
    messageCount: 23,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    lastActivity: new Date(Date.now() - 3600000).toISOString(),
    tokenUsage: { input: 32000, output: 8000, total: 40000 },
    cost: 0.87,
    label: 'Architecture Review',
  },
  {
    key: 'agent:harry:cron:daily-standup',
    agentId: '5',
    agentName: 'Harry',
    agentEmoji: '⚡',
    status: 'completed',
    messageCount: 5,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    lastActivity: new Date(Date.now() - 43000000).toISOString(),
    tokenUsage: { input: 5000, output: 2000, total: 7000 },
    cost: 0.14,
    label: 'Daily Standup',
    parentKey: 'cron:daily-standup',
  },
];

// ============================================================================
// Mock Cron Jobs
// ============================================================================

export const MOCK_CRON_JOBS: CronJob[] = [
  {
    id: 'daily-briefing',
    name: 'Daily Briefing',
    schedule: '0 7 * * *',
    agentId: '3',
    agentName: 'Luis',
    agentEmoji: '🎨',
    prompt: 'Good morning! Summarize key tasks and priorities for today.',
    status: 'enabled',
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    lastRunStatus: 'ok',
    lastRunDuration: 12300,
    nextRun: new Date(Date.now() + 82800000).toISOString(),
    createdAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    schedule: '0 9 * * 1',
    agentId: '1',
    agentName: 'Xavier',
    agentEmoji: '🧠',
    prompt: 'Generate a weekly engineering progress report.',
    status: 'enabled',
    lastRun: new Date(Date.now() - 259200000).toISOString(),
    lastRunStatus: 'ok',
    lastRunDuration: 45600,
    nextRun: new Date(Date.now() + 518400000).toISOString(),
    createdAt: '2026-01-21T00:00:00Z',
  },
  {
    id: 'hourly-ux-check',
    name: 'UX Work Check',
    schedule: '0 * * * *',
    agentId: '3',
    agentName: 'Luis',
    agentEmoji: '🎨',
    prompt: 'Check active work queue and continue UX improvements.',
    status: 'running',
    lastRun: new Date(Date.now() - 3540000).toISOString(),
    lastRunStatus: 'ok',
    lastRunDuration: 8900,
    nextRun: new Date(Date.now() + 60000).toISOString(),
    createdAt: '2026-02-21T00:00:00Z',
  },
  {
    id: 'daily-backup',
    name: 'Daily Backup',
    schedule: '0 23 * * *',
    agentId: '5',
    agentName: 'Harry',
    agentEmoji: '⚡',
    prompt: 'Run system backup and verify integrity.',
    status: 'disabled',
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    lastRunStatus: 'error',
    lastRunDuration: 300,
    nextRun: undefined,
    createdAt: '2026-01-22T00:00:00Z',
  },
];

// ============================================================================
// Mock Skills
// ============================================================================

export const MOCK_SKILLS: Skill[] = [
  { id: 'web-search', name: 'Web Search', description: 'Search the web with Brave API', icon: '🔍', category: 'Research', status: 'installed', version: '2.1.0', tools: ['web_search', 'web_fetch'], popular: true, featured: true },
  { id: 'exec', name: 'Code Execution', description: 'Run shell commands and scripts', icon: '⚡', category: 'Development', status: 'installed', version: '3.0.1', tools: ['exec', 'process'], popular: true },
  { id: 'browser', name: 'Browser Control', description: 'Automate web browsers with Playwright', icon: '🌐', category: 'Automation', status: 'installed', version: '1.5.0', tools: ['browser'], popular: true, featured: true },
  { id: 'tts', name: 'Text to Speech', description: 'Convert text to natural speech via ElevenLabs', icon: '🎙️', category: 'Voice', status: 'installed', version: '1.2.0', tools: ['tts'] },
  { id: 'slack', name: 'Slack Integration', description: 'Send and receive Slack messages', icon: '💬', category: 'Messaging', status: 'installed', version: '4.0.0', tools: ['message'], popular: true },
  { id: 'calendar', name: 'Google Calendar', description: 'Read and manage calendar events', icon: '📅', category: 'Productivity', status: 'available', version: '2.0.0', popular: true, featured: true },
  { id: 'gmail', name: 'Gmail', description: 'Read, compose, and send emails', icon: '📧', category: 'Email', status: 'available', version: '3.1.0', popular: true },
  { id: 'github', name: 'GitHub', description: 'Manage repos, PRs, and issues', icon: '🐙', category: 'Development', status: 'available', version: '2.2.0', featured: true },
  { id: 'notion', name: 'Notion', description: 'Read and write to Notion databases', icon: '📝', category: 'Productivity', status: 'available', version: '1.0.0' },
  { id: 'stripe', name: 'Stripe', description: 'Payment processing and analytics', icon: '💳', category: 'Finance', status: 'available', version: '2.0.0' },
  { id: 'discord', name: 'Discord', description: 'Discord bot messaging and events', icon: '🎮', category: 'Messaging', status: 'available', version: '3.0.0', popular: true },
  { id: 'linear', name: 'Linear', description: 'Issue tracking and project management', icon: '📋', category: 'Productivity', status: 'available', version: '1.5.0', featured: true },
];

// ============================================================================
// Mock Nodes
// ============================================================================

export const MOCK_NODES: Node[] = [
  {
    id: 'macbook-pro',
    name: "David's MacBook Pro",
    platform: 'darwin',
    status: 'online',
    lastSeen: new Date().toISOString(),
    capabilities: ['screen', 'camera', 'location', 'notifications'],
    paired: true,
    ipAddress: '192.168.1.100',
    version: '1.2.0',
  },
  {
    id: 'iphone-15',
    name: "David's iPhone 15",
    platform: 'ios',
    status: 'online',
    lastSeen: new Date(Date.now() - 60000).toISOString(),
    capabilities: ['camera', 'location', 'notifications', 'voice'],
    paired: true,
    version: '1.1.0',
  },
  {
    id: 'server-01',
    name: 'Home Server',
    platform: 'linux',
    status: 'offline',
    lastSeen: new Date(Date.now() - 7200000).toISOString(),
    capabilities: ['exec', 'storage'],
    paired: true,
    ipAddress: '192.168.1.50',
    version: '1.0.0',
  },
];

// ============================================================================
// Mock Usage Data
// ============================================================================

export const MOCK_USAGE: UsageSummary = {
  totalTokens: 2847392,
  totalCost: 47.82,
  totalRequests: 1423,
  byModel: {
    'claude-opus-4-6': { tokens: 1800000, cost: 31.50, requests: 820 },
    'claude-sonnet-4-6': { tokens: 900000, cost: 12.42, requests: 480 },
    'claude-haiku-3': { tokens: 147392, cost: 3.90, requests: 123 },
  },
  byAgent: {
    'Luis': { tokens: 987000, cost: 16.22, requests: 512 },
    'Xavier': { tokens: 756000, cost: 13.45, requests: 380 },
    'Harry': { tokens: 534000, cost: 9.81, requests: 310 },
    'Stephan': { tokens: 421000, cost: 6.18, requests: 148 },
    'Tim': { tokens: 149392, cost: 2.16, requests: 73 },
  },
  dailyUsage: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    tokens: Math.floor(Math.random() * 150000 + 50000),
    cost: Math.random() * 3 + 0.5,
    requests: Math.floor(Math.random() * 80 + 20),
  })),
};

// ============================================================================
// Mock Chat Messages
// ============================================================================

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Can you summarize the UI spec and tell me what views we need to build?',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: '2',
    role: 'assistant',
    content: "I've reviewed the UI spec. Here's what we need to build:\n\n**15 Views:**\n- AgentDashboard — system overview with stats\n- AgentBuilderWizard — multi-step agent creation\n- ChatInterface — real-time chat with agents\n- CronScheduleBuilder — automation management\n- And 11 more...\n\nI'll start with the high-priority views and delegate to sub-agents for parallel development.",
    timestamp: new Date(Date.now() - 1790000).toISOString(),
    toolCalls: [
      { id: 'tc1', name: 'read', input: { path: 'UI_SPEC.md' }, output: '...spec content...', status: 'done' },
    ],
  },
  {
    id: '3',
    role: 'user',
    content: 'Great! Start with AgentDashboard first.',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: '4',
    role: 'assistant',
    content: 'On it! Building the AgentDashboard now with:\n- Live agent status cards\n- Quick action buttons\n- Activity feed\n- Usage metrics\n\nBuilding and will have it ready shortly...',
    timestamp: new Date(Date.now() - 1190000).toISOString(),
  },
];

// ============================================================================
// Helper: format relative time
// ============================================================================

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatCronSchedule(cron: string): string {
  const presets: Record<string, string> = {
    '0 7 * * *': 'Every day at 7:00 AM',
    '0 9 * * 1': 'Every Monday at 9:00 AM',
    '0 * * * *': 'Every hour',
    '0 23 * * *': 'Every day at 11:00 PM',
    '*/30 * * * *': 'Every 30 minutes',
    '0 0 * * *': 'Every day at midnight',
    '0 8 * * 1-5': 'Weekdays at 8:00 AM',
  };
  return presets[cron] || cron;
}
