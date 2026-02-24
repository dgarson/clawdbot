import React, { useState } from 'react';
import { cn } from '../lib/utils';

// --- Mock Data Types ---

interface Finding {
  id: string;
  text: string;
}

interface Agent {
  name: string;
  domain: string;
  status: 'completed' | 'failed';
  tokensUsed: number;
  tokenLimit: number;
  findings: Finding[];
}

interface Wave {
  id: number;
  agents: Agent[];
}

// --- Mock Data ---

const MOCK_WAVES: Wave[] = [
  {
    id: 1,
    agents: [
      {
        name: 'Atlas',
        domain: 'AI Infrastructure',
        status: 'completed',
        tokensUsed: 145000,
        tokenLimit: 200000,
        findings: [
          { id: 'a1', text: 'Nvidia H200 allocation wait times reduced by 15% in Q1.' },
          { id: 'a2', text: 'Rise of "Small Language Models" (SLMs) driving edge deployment growth.' },
          { id: 'a3', text: 'New vector database startup "Z-Scale" claiming 10x throughput over Pinecone.' },
        ],
      },
      {
        name: 'Beacon',
        domain: 'Developer Tooling',
        status: 'completed',
        tokensUsed: 182000,
        tokenLimit: 200000,
        findings: [
          { id: 'b1', text: '72% of surveyed devs prefer CLI-first integration for CI/CD tools.' },
          { id: 'b2', text: 'Standardization of OpenTelemetry reaching critical mass in mid-market.' },
          { id: 'b3', text: 'Emerging trend: "AI-native IDEs" replacing plugin-based setups.' },
        ],
      },
      {
        name: 'Carta',
        domain: 'Workflow Automation',
        status: 'completed',
        tokensUsed: 120000,
        tokenLimit: 200000,
        findings: [
          { id: 'c1', text: 'Enterprise shift from RPA to Agentic workflows accelerating.' },
          { id: 'c2', text: 'Cost per automated task dropped by 40% since GPT-4o release.' },
          { id: 'c3', text: 'Multi-agent orchestration becoming a top-3 priority for COOs.' },
        ],
      },
      {
        name: 'Delphi',
        domain: 'Observability',
        status: 'completed',
        tokensUsed: 195000,
        tokenLimit: 200000,
        findings: [
          { id: 'd1', text: 'Log-less observability patterns gaining traction to reduce egress costs.' },
          { id: 'd2', text: 'Real-time trace analysis becoming standard for LLM application debugging.' },
          { id: 'd3', text: 'Incident response times reduced by 30% using automated root cause analysis.' },
        ],
      },
      {
        name: 'Echo',
        domain: 'Security',
        status: 'failed',
        tokensUsed: 55000,
        tokenLimit: 200000,
        findings: [],
      },
    ],
  },
  {
    id: 2,
    agents: [
      {
        name: 'Fenix',
        domain: 'Data Platforms',
        status: 'completed',
        tokensUsed: 130000,
        tokenLimit: 200000,
        findings: [
          { id: 'f1', text: 'Iceberg/Tabular acquisition causing shift in open table format preferences.' },
          { id: 'f2', text: 'Zero-ETL architecture adoption grew 50% YoY among Snowflake users.' },
          { id: 'f3', text: 'Privacy-preserving computation becoming a requirement for health-tech data.' },
        ],
      },
      {
        name: 'Gust',
        domain: 'Cost Optimization',
        status: 'completed',
        tokensUsed: 110000,
        tokenLimit: 200000,
        findings: [
          { id: 'g1', text: 'FinOps teams moving from "visibility" to "automated remediation".' },
          { id: 'g2', text: 'Idle resource waste still accounts for 30% of average cloud spend.' },
          { id: 'g3', text: 'GPU spot instance marketplaces stabilizing prices for training runs.' },
        ],
      },
      {
        name: 'Helix',
        domain: 'ML Platform',
        status: 'completed',
        tokensUsed: 160000,
        tokenLimit: 200000,
        findings: [
          { id: 'h1', text: 'PyTorch 2.5 optimizations leading to 20% faster training on AMD hardware.' },
          { id: 'h2', text: 'Model evaluation frameworks becoming a mandatory part of the ML lifecycle.' },
          { id: 'h3', text: 'Synthetic data generation tools seeing massive uptake for edge-case training.' },
        ],
      },
      {
        name: 'Iris',
        domain: 'Product Analytics',
        status: 'completed',
        tokensUsed: 140000,
        tokenLimit: 200000,
        findings: [
          { id: 'i1', text: 'Product-led growth (PLG) strategies shifting focus to "Active User Value".' },
          { id: 'i2', text: 'Real-time session replay integration becoming a standard for UI/UX teams.' },
          { id: 'i3', text: 'Self-serve data exploration usage increased by 25% in enterprise segments.' },
        ],
      },
      {
        name: 'Jade',
        domain: 'API Design',
        status: 'completed',
        tokensUsed: 95000,
        tokenLimit: 200000,
        findings: [
          { id: 'j1', text: 'GraphQL adoption plateauing; REST with Type-safe contracts on the rise.' },
          { id: 'j2', text: 'AI-generated API documentation accuracy improved by 60%.' },
          { id: 'j3', text: 'API security gateways moving towards identity-centric models.' },
        ],
      },
    ],
  },
  {
    id: 3,
    agents: [
      {
        name: 'Kilo',
        domain: 'Enterprise Sales',
        status: 'completed',
        tokensUsed: 175000,
        tokenLimit: 200000,
        findings: [
          { id: 'k1', text: 'Sales cycles for AI platforms lengthening as legal/compliance reviews tighten.' },
          { id: 'k2', text: '"Land and Expand" model becoming the dominant strategy for SaaS.' },
          { id: 'k3', text: 'Personalized outbound at scale using LLMs showing 2x higher conversion.' },
        ],
      },
      {
        name: 'Luna',
        domain: 'Open Source',
        status: 'completed',
        tokensUsed: 155000,
        tokenLimit: 200000,
        findings: [
          { id: 'l1', text: 'OSS licensing landscape shifting as companies protect AI training data.' },
          { id: 'l2', text: 'Community-led growth becoming a key metric for developer marketing.' },
          { id: 'l3', text: 'Sustainability of core OSS projects remains a critical risk factor.' },
        ],
      },
      {
        name: 'Mosaic',
        domain: 'No-Code',
        status: 'completed',
        tokensUsed: 115000,
        tokenLimit: 200000,
        findings: [
          { id: 'm1', text: 'Internal tool building shifted heavily towards AI-assisted no-code platforms.' },
          { id: 'm2', text: '"Shadow IT" concerns rising as ease of app creation increases.' },
          { id: 'm3', text: 'Citizen developers driving 40% of digital transformation initiatives.' },
        ],
      },
      {
        name: 'Nova',
        domain: 'Developer Experience',
        status: 'completed',
        tokensUsed: 135000,
        tokenLimit: 200000,
        findings: [
          { id: 'n1', text: 'Developer portals (Backstage, etc.) becoming the "hub" for platform engineering.' },
          { id: 'n2', text: 'Onboarding time for new hires reduced from 4 weeks to 1 week via LLM guides.' },
          { id: 'n3', text: 'Focus on "Joy of Work" as a key metric for retaining top talent.' },
        ],
      },
      {
        name: 'Orbit',
        domain: 'Integration Platforms',
        status: 'completed',
        tokensUsed: 148000,
        tokenLimit: 200000,
        findings: [
          { id: 'o1', text: 'iPaaS market consolidating as players add native AI capabilities.' },
          { id: 'o2', text: 'Event-driven architectures becoming the backbone of real-time integrations.' },
          { id: 'o3', text: 'API-first approach enabling faster ecosystem expansion for legacy players.' },
        ],
      },
    ],
  },
];

// --- Sub-components ---

const Badge = ({ children, variant }: { children: React.ReactNode; variant: 'success' | 'danger' | 'neutral' }) => {
  const variants = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    neutral: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', variants[variant])}>
      {children}
    </span>
  );
};

const AgentCard = ({ agent }: { agent: Agent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tokenPercentage = Math.min((agent.tokensUsed / agent.tokenLimit) * 100, 100);

  return (
    <div className="border border-gray-800 bg-gray-900/50 rounded-lg overflow-hidden transition-all duration-200 hover:border-gray-700">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-100">{agent.name}</h3>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{agent.domain}</span>
            <Badge variant={agent.status === 'completed' ? 'success' : 'danger'}>
              {agent.status}
            </Badge>
          </div>
          
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1 max-w-[120px]">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Tokens</span>
                <span>{Math.round(agent.tokensUsed / 1000)}k</span>
              </div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    tokenPercentage > 90 ? "bg-amber-500" : "bg-blue-500"
                  )} 
                  style={{ width: `${tokenPercentage}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Findings:</span>
              <Badge variant="neutral">{agent.findings.length}</Badge>
            </div>
          </div>
        </div>
        
        <div className={cn("text-gray-500 transition-transform duration-200", isExpanded ? "rotate-180" : "")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-800/50">
          {agent.findings.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {agent.findings.map((finding) => (
                <li key={finding.id} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {finding.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-gray-500 italic">No findings available for this agent.</p>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main View ---

export default function DiscoveryWaveResults() {
  const [activeWave, setActiveWave] = useState(1);
  const [showCopied, setShowCopied] = useState(false);

  const handleExport = () => {
    // Mock export to clipboard
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const currentWave = MOCK_WAVES.find(w => w.id === activeWave);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Discovery Run Results</h1>
              <p className="text-gray-400 text-sm">Feb 23, 2026 — Aggregate Report</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 p-4 border border-gray-800 bg-gray-900/30 rounded-xl">
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Findings</p>
              <p className="text-xl font-mono font-bold text-emerald-400">47</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Agents</p>
              <p className="text-xl font-mono font-bold">15</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Waves</p>
              <p className="text-xl font-mono font-bold">3 <span className="text-[10px] text-gray-500">/ 3</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Tokens Used</p>
              <p className="text-xl font-mono font-bold">2.8M</p>
            </div>
          </div>
        </div>

        {/* Wave Tabs */}
        <div className="border-b border-gray-800">
          <div className="flex gap-8">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setActiveWave(num)}
                className={cn(
                  "pb-4 text-sm font-medium transition-all relative",
                  activeWave === num ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Wave {num}
                {activeWave === num && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Agent List */}
        <div className="space-y-4">
          {currentWave?.agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>

        {/* Footer / Export */}
        <div className="pt-8 flex items-center gap-4">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-100 text-gray-950 text-sm font-semibold rounded-lg hover:bg-white transition-colors"
          >
            Export to Markdown
          </button>
          {showCopied && (
            <span className="text-emerald-400 text-sm animate-in fade-in slide-in-from-left-2">
              ✓ Copied to clipboard!
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
