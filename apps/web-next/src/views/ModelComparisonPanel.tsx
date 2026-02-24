import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart as BarChartIcon,
  CheckCircle,
  ChevronDown,
  Clock,
  DollarSign,
  Layers,
  PieChart as PieChartIcon,
  Plus,
  Radar,
  Sparkles,
  Trophy,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RadarComponent,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type ModelName = 'claude-sonnet-4-6' | 'grok-4' | 'MiniMax-M2.5' | 'glm-5' | 'gemini-3-flash' | 'qwen3-max';

interface ModelData {
  avgResponseTime: number; // ms
  responseTimes: number[]; // for sparkline
  tokensPerSecond: number;
  costInput: number; // per 1k
  costOutput: number; // per 1k
  successRate: number; // %
  rateLimitIncidents: number;
  contextWindow: number;
  maxOutput: number;
  reasoning: boolean;
  taskScores: {
    code: number;
    writing: number;
    analysis: number;
    toolUse: number;
  };
  usageShare: number; // %
}

type TimeRange = 'Last 24h' | 'Last week' | 'Last month';

// ============================================================================
// Mock Data
// ============================================================================

const AVAILABLE_MODELS: ModelName[] = [
  'claude-sonnet-4-6',
  'grok-4',
  'MiniMax-M2.5',
  'glm-5',
  'gemini-3-flash',
  'qwen3-max',
];

const MOCK_DATA: Record<ModelName, ModelData> = {
  'claude-sonnet-4-6': {
    avgResponseTime: 1200,
    responseTimes: [1100, 1150, 1300, 1250, 1200, 1180, 1220],
    tokensPerSecond: 45,
    costInput: 0.003,
    costOutput: 0.015,
    successRate: 98.5,
    rateLimitIncidents: 0,
    contextWindow: 200000,
    maxOutput: 4096,
    reasoning: true,
    taskScores: { code: 95, writing: 92, analysis: 98, toolUse: 90 },
    usageShare: 40,
  },
  'grok-4': {
    avgResponseTime: 800,
    responseTimes: [750, 820, 780, 810, 790, 800, 805],
    tokensPerSecond: 60,
    costInput: 0.005,
    costOutput: 0.01,
    successRate: 97.2,
    rateLimitIncidents: 2,
    contextWindow: 128000,
    maxOutput: 8192,
    reasoning: true,
    taskScores: { code: 98, writing: 85, analysis: 90, toolUse: 95 },
    usageShare: 25,
  },
  'MiniMax-M2.5': {
    avgResponseTime: 1500,
    responseTimes: [1400, 1450, 1550, 1520, 1480, 1500, 1490],
    tokensPerSecond: 35,
    costInput: 0.002,
    costOutput: 0.008,
    successRate: 96.8,
    rateLimitIncidents: 1,
    contextWindow: 96000,
    maxOutput: 2048,
    reasoning: false,
    taskScores: { code: 85, writing: 90, analysis: 88, toolUse: 80 },
    usageShare: 15,
  },
  'glm-5': {
    avgResponseTime: 1000,
    responseTimes: [950, 980, 1020, 990, 1010, 1000, 995],
    tokensPerSecond: 50,
    costInput: 0.001,
    costOutput: 0.005,
    successRate: 99.1,
    rateLimitIncidents: 0,
    contextWindow: 128000,
    maxOutput: 4096,
    reasoning: true,
    taskScores: { code: 90, writing: 88, analysis: 92, toolUse: 85 },
    usageShare: 20,
  },
  'gemini-3-flash': {
    avgResponseTime: 900,
    responseTimes: [850, 880, 920, 890, 910, 900, 895],
    tokensPerSecond: 55,
    costInput: 0.0005,
    costOutput: 0.002,
    successRate: 98.0,
    rateLimitIncidents: 0,
    contextWindow: 1048576,
    maxOutput: 8192,
    reasoning: true,
    taskScores: { code: 92, writing: 95, analysis: 93, toolUse: 88 },
    usageShare: 10,
  },
  'qwen3-max': {
    avgResponseTime: 1300,
    responseTimes: [1250, 1280, 1350, 1320, 1290, 1300, 1310],
    tokensPerSecond: 40,
    costInput: 0.004,
    costOutput: 0.012,
    successRate: 97.5,
    rateLimitIncidents: 3,
    contextWindow: 32768,
    maxOutput: 2048,
    reasoning: false,
    taskScores: { code: 88, writing: 90, analysis: 85, toolUse: 82 },
    usageShare: 5,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCost(input: number, output: number): string {
  return `$${input.toFixed(3)} / $${output.toFixed(3)}`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(1)}M`;}
  if (n >= 1000) {return `${(n / 1000).toFixed(0)}k`;}
  return n.toString();
}

function getWinner(models: ModelName[], key: keyof ModelData, max = true): ModelName {
  return models.reduce((prev, curr) =>
    (max ? MOCK_DATA[curr][key] > MOCK_DATA[prev][key] : MOCK_DATA[curr][key] < MOCK_DATA[prev][key]) ? curr : prev
  );
}

function getCheapest(models: ModelName[]): ModelName {
  return models.reduce((prev, curr) => {
    const prevCost = (MOCK_DATA[prev].costInput + MOCK_DATA[prev].costOutput) / 2;
    const currCost = (MOCK_DATA[curr].costInput + MOCK_DATA[curr].costOutput) / 2;
    return currCost < prevCost ? curr : prev;
  });
}

function getMostReliable(models: ModelName[]): ModelName {
  return getWinner(models, 'successRate');
}

function getBestForTask(models: ModelName[], task: keyof ModelData['taskScores']): ModelName {
  return models.reduce((prev, curr) =>
    MOCK_DATA[curr].taskScores[task] > MOCK_DATA[prev].taskScores[task] ? curr : prev
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ModelHeader({ model, onRemove }: { model: ModelName; onRemove?: () => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-violet-400" />
        <span className="text-lg font-semibold text-white">{model}</span>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-zinc-500 hover:text-red-400 transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

function MetricRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-4 py-3 border-b border-zinc-800 last:border-0" style={{ gridTemplateColumns: '200px auto' }}>
      <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="flex gap-4">{children}</div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const chartData = data.map((value, index) => ({ name: index, value }));
  return (
    <ResponsiveContainer width={80} height={30}>
      <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey="value" stroke="#violet-400" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ReasoningBadge({ hasReasoning }: { hasReasoning: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
        hasReasoning ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
      )}
    >
      {hasReasoning ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {hasReasoning ? 'Yes' : 'No'}
    </span>
  );
}

function TaskRadarChart({ data }: { data: ModelData['taskScores'] }) {
  const chartData = [
    { subject: 'Code', value: data.code },
    { subject: 'Writing', value: data.writing },
    { subject: 'Analysis', value: data.analysis },
    { subject: 'Tool Use', value: data.toolUse },
  ];
  return (
    <ResponsiveContainer width={200} height={200}>
      <RadarChart data={chartData} outerRadius={70} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <RadarComponent dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function UsagePieChart({ shares }: { shares: { name: string; value: number }[] }) {
  const COLORS = ['#8b5cf6', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'];
  return (
    <ResponsiveContainer width={200} height={200}>
      <PieChart>
        <Pie
          data={shares}
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {shares.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TrophyBadge({ winner }: { winner: boolean }) {
  return winner ? <Trophy className="w-5 h-5 text-yellow-400" /> : null;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ModelComparisonPanel() {
  const [selectedModels, setSelectedModels] = useState<ModelName[]>([
    'claude-sonnet-4-6',
    'grok-4',
    'glm-5',
    'gemini-3-flash',
  ]);
  const [timeRange, setTimeRange] = useState<TimeRange>('Last 24h');
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const availableToAdd = AVAILABLE_MODELS.filter((m) => !selectedModels.includes(m));

  const addModel = (model: ModelName) => {
    if (selectedModels.length < 4) {
      setSelectedModels([...selectedModels, model]);
    }
    setShowAddDropdown(false);
  };

  const removeModel = (model: ModelName) => {
    setSelectedModels(selectedModels.filter((m) => m !== model));
  };

  // Compute head-to-head winners
  const speedWinner = getWinner(selectedModels, 'tokensPerSecond');
  const costWinner = getCheapest(selectedModels);
  const qualityWinner = getWinner(selectedModels, 'successRate');

  // Recommendations
  const bestForCode = getBestForTask(selectedModels, 'code');
  const cheapest = getCheapest(selectedModels);
  const mostReliable = getMostReliable(selectedModels);

  // Usage pie data
  const totalUsage = selectedModels.reduce((sum, m) => sum + MOCK_DATA[m].usageShare, 0);
  const pieData = selectedModels.map((m) => ({
    name: m,
    value: (MOCK_DATA[m].usageShare / totalUsage) * 100,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChartIcon className="w-6 h-6 text-violet-400" />
            Model Comparison
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">Side-by-side AI model performance evaluation</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="appearance-none bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white flex items-center gap-2 pr-8"
            >
              <option>Last 24h</option>
              <option>Last week</option>
              <option>Last month</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
          {selectedModels.length < 4 && (
            <div className="relative">
              <button
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Model
              </button>
              {showAddDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10">
                  {availableToAdd.map((model) => (
                    <button
                      key={model}
                      onClick={() => addModel(model)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-800 transition-colors"
                    >
                      {model}
                    </button>
                  ))}
                  {availableToAdd.length === 0 && (
                    <p className="px-4 py-2 text-sm text-zinc-500">No more models to add</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${selectedModels.length}, minmax(0, 1fr))` }}>
          <div /> {/* Empty for label column */}
          {selectedModels.map((model) => (
            <ModelHeader key={model} model={model} onRemove={() => removeModel(model)} />
          ))}
        </div>

        <div className="divide-y divide-zinc-800">
          <MetricRow label="Avg Response Time (ms)" icon={Clock}>
            {selectedModels.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{formatNumber(MOCK_DATA[m].avgResponseTime)}</span>
                <Sparkline data={MOCK_DATA[m].responseTimes} />
              </div>
            ))}
          </MetricRow>

          <MetricRow label="Tokens/second" icon={ArrowUpRight}>
            {selectedModels.map((m) => (
              <span key={m} className="text-lg font-bold text-white">
                {formatNumber(MOCK_DATA[m].tokensPerSecond)}
              </span>
            ))}
          </MetricRow>

          <MetricRow label="Cost per 1k tokens (in/out)" icon={DollarSign}>
            {selectedModels.map((m) => (
              <span key={m} className="text-lg font-bold text-white">
                {formatCost(MOCK_DATA[m].costInput, MOCK_DATA[m].costOutput)}
              </span>
            ))}
          </MetricRow>

          <MetricRow label="Success Rate %" icon={CheckCircle}>
            {selectedModels.map((m) => (
              <span key={m} className="text-lg font-bold text-white">
                {MOCK_DATA[m].successRate.toFixed(1)}%
              </span>
            ))}
          </MetricRow>

          <MetricRow label="Rate Limit Incidents (24h)" icon={AlertCircle}>
            {selectedModels.map((m) => (
              <span key={m} className="text-lg font-bold text-white">
                {MOCK_DATA[m].rateLimitIncidents}
              </span>
            ))}
          </MetricRow>

          <MetricRow label="Context Window" icon={Layers}>
            {selectedModels.map((m) => (
              <span key={m} className="text-lg font-bold text-white">
                {formatTokens(MOCK_DATA[m].contextWindow)}
              </span>
            ))}
          </MetricRow>

          <MetricRow label="Max Output Tokens" icon={Activity}>
            {selectedModels.map((m) => (
              <span key={m} className="text-lg font-bold text-white">
                {formatTokens(MOCK_DATA[m].maxOutput)}
              </span>
            ))}
          </MetricRow>

          <MetricRow label="Reasoning Capability" icon={Sparkles}>
            {selectedModels.map((m) => (
              <ReasoningBadge key={m} hasReasoning={MOCK_DATA[m].reasoning} />
            ))}
          </MetricRow>
        </div>
      </div>

      {/* Task Performance Breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Radar className="w-5 h-5 text-violet-400" />
          Task Performance Breakdown
        </h2>
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${selectedModels.length}, minmax(0, 1fr))` }}>
          {selectedModels.map((m) => (
            <div key={m} className="flex flex-col items-center">
              <span className="text-sm font-medium text-zinc-400 mb-2">{m}</span>
              <TaskRadarChart data={MOCK_DATA[m].taskScores} />
            </div>
          ))}
        </div>
      </div>

      {/* Head-to-Head Win Rates */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Head-to-Head Wins
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-4 bg-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-400 mb-2">Speed</span>
            <span className="text-lg font-bold text-white">{speedWinner}</span>
            <TrophyBadge winner={true} />
          </div>
          <div className="flex flex-col items-center p-4 bg-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-400 mb-2">Cost</span>
            <span className="text-lg font-bold text-white">{costWinner}</span>
            <TrophyBadge winner={true} />
          </div>
          <div className="flex flex-col items-center p-4 bg-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-400 mb-2">Quality</span>
            <span className="text-lg font-bold text-white">{qualityWinner}</span>
            <TrophyBadge winner={true} />
          </div>
        </div>
      </div>

      {/* Usage Share */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-violet-400" />
          Usage Share This Month (% of total tokens)
        </h2>
        <div className="flex justify-center">
          <UsagePieChart shares={pieData} />
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          Recommendations
        </h2>
        <p className="text-sm text-zinc-300">
          Best for code tasks → {bestForCode} | Cheapest → {cheapest} | Most reliable → {mostReliable}
        </p>
      </div>
    </div>
  );
}
