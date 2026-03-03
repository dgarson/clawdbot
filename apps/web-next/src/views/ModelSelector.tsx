import React, { useState } from 'react';
import { 
  Zap, 
  Brain, 
  Rocket, 
  Check, 
  Info, 
  ChevronDown, 
  Filter, 
  Star,
  Activity,
  Coins,
  Cpu,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';

const PROVIDERS = ['All', 'Anthropic', 'OpenAI', 'Google', 'Meta', 'Mistral', 'MiniMax'];

interface ModelData {
  id: string;
  name: string;
  provider: string;
  context: string;
  costIn: string;
  costOut: string;
  speed: number; // 1-3
  description: string;
  badge?: string;
  isDefault?: boolean;
}

const MODELS: ModelData[] = [
  { 
    id: 'opus-4', 
    name: 'Claude Opus 4', 
    provider: 'Anthropic', 
    context: '200K', 
    costIn: '$15.00', 
    costOut: '$75.00', 
    speed: 1, 
    badge: 'Most powerful',
    description: 'Complex reasoning, long documents, and deep research tasks.'
  },
  { 
    id: 'sonnet-4', 
    name: 'Claude Sonnet 4', 
    provider: 'Anthropic', 
    context: '200K', 
    costIn: '$3.00', 
    costOut: '$15.00', 
    speed: 2, 
    badge: 'Recommended',
    isDefault: true,
    description: 'Balanced performance and speed for daily developer tasks.'
  },
  { 
    id: 'haiku-3', 
    name: 'Claude Haiku 3', 
    provider: 'Anthropic', 
    context: '200K', 
    costIn: '$0.25', 
    costOut: '$1.25', 
    speed: 3, 
    badge: 'Fastest',
    description: 'Quick tasks, high volume processing, and simple classification.'
  },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K', costIn: '$5.00', costOut: '$15.00', speed: 2, description: 'Versatile and fast with great multimodal capabilities.' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', context: '128K', costIn: '$10.00', costOut: '$30.00', speed: 1, description: 'Classic power for logic and instruction following.' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', context: '2M', costIn: '$3.50', costOut: '$10.50', speed: 2, description: 'Enormous context window for entire codebases.' },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta', context: '8K', costIn: '$0.60', costOut: '$0.60', speed: 3, description: 'Open source excellence for general purpose use.' },
  { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral', context: '32K', costIn: '$4.00', costOut: '$12.00', speed: 2, description: 'European powerhouse with strong multilingual support.' },
  { id: 'abab-6.5', name: 'MiniMax Abab 6.5', provider: 'MiniMax', context: '128K', costIn: '$1.00', costOut: '$1.00', speed: 2, description: 'Great for creative writing and conversational nuances.' },
];

export default function ModelSelector() {
  const [filter, setFilter] = useState('All');
  const [defaultModelId, setDefaultModelId] = useState('sonnet-4');

  const filteredModels = MODELS.filter(m => filter === 'All' || m.provider === filter);
  
  const featured = MODELS.filter(m => m.badge);

  const SpeedDots = ({ level }: { level: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(i => (
        <div 
          key={i} 
          className={cn("w-1.5 h-1.5 rounded-full", i <= level ? "bg-violet-500" : "bg-gray-800")} 
        />
      ))}
    </div>
  );

  const CostDots = ({ level }: { level: number }) => (
    <div className="flex gap-0.5 text-xs">
      {[1, 2, 3].map(i => (
        <span key={i} className={cn(i <= level ? "text-amber-500" : "text-gray-800")}>●</span>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-10 font-sans selection:bg-violet-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Model Library</h1>
          <p className="text-gray-400 mt-2 flex items-center gap-2">
            <Activity size={16} className="text-violet-500" />
            {MODELS.length} models available across {PROVIDERS.length - 1} providers
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Settings size={18} /> API Keys
          </button>
        </div>
      </div>

      {/* Featured Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {featured.map((model) => (
          <div key={model.id} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-3xl">
                  {model.id === 'opus-4' ? '🧠' : model.id === 'sonnet-4' ? '⚡' : '🚀'}
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  model.id === 'sonnet-4' ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400"
                )}>
                  {model.badge}
                </span>
              </div>
              
              <h3 className="text-xl font-bold mb-1">{model.name}</h3>
              <p className="text-gray-400 text-sm mb-6 flex-1">{model.description}</p>
              
              <div className="space-y-3 pt-4 border-t border-gray-800/50">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Context</span>
                  <span className="font-mono text-gray-200">{model.context}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-gray-500">Cost</span>
                  <CostDots level={model.id === 'opus-4' ? 3 : model.id === 'sonnet-4' ? 2 : 1} />
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-gray-500">Speed</span>
                  <SpeedDots level={model.speed} />
                </div>
              </div>

              <button 
                onClick={() => setDefaultModelId(model.id)}
                className={cn(
                  "mt-6 w-full py-2.5 rounded-xl font-semibold text-sm transition-all",
                  defaultModelId === model.id 
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" 
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                )}
              >
                {defaultModelId === model.id ? 'Current Default' : 'Select Model'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 no-scrollbar">
        <div className="p-2 bg-gray-900 rounded-lg border border-gray-800 text-gray-500">
          <Filter size={18} />
        </div>
        {PROVIDERS.map(p => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              filter === p 
                ? "bg-white text-black" 
                : "bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-600"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800/50 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-800">
              <th className="px-6 py-4">Model</th>
              <th className="px-6 py-4">Provider</th>
              <th className="px-6 py-4">Context</th>
              <th className="px-6 py-4">Cost (In/Out)</th>
              <th className="px-6 py-4 text-center">Speed</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredModels.map((model) => (
              <tr 
                key={model.id}
                className={cn(
                  "hover:bg-gray-800/30 transition-colors group",
                  defaultModelId === model.id ? "bg-violet-600/5" : ""
                )}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-200">{model.name}</span>
                    {defaultModelId === model.id && (
                      <span className="p-1 bg-violet-600/20 text-violet-400 rounded">
                        <Star size={10} fill="currentColor" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">{model.provider}</td>
                <td className="px-6 py-4 font-mono text-xs text-gray-400">{model.context}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-300">{model.costIn} <span className="text-[10px] text-gray-600">/1K</span></span>
                    <span className="text-xs text-gray-500">{model.costOut} <span className="text-[10px] text-gray-600">/1K</span></span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <SpeedDots level={model.speed} />
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => setDefaultModelId(model.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100",
                      defaultModelId === model.id
                        ? "bg-violet-600 text-white opacity-100"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    )}
                  >
                    {defaultModelId === model.id ? 'Default' : 'Set Default'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Table Footer */}
      <div className="mt-4 flex items-center justify-between px-2">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Info size={14} />
          Cost is estimated per 1K tokens based on provider pricing.
        </div>
        <div className="flex items-center gap-4">
           <button className="text-gray-500 hover:text-white transition-colors">
              <ChevronDown size={20} />
           </button>
        </div>
      </div>
    </div>
  );
}
