import React, { useState, useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Calendar,
  Activity,
  Target,
  BarChart3,
} from "lucide-react";

interface FindingRun {
  id: string;
  date: Date;
  label: string;
  total: number;
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  category: {
    security: number;
    performance: number;
    accessibility: number;
    compliance: number;
  };
}

interface TooltipData {
  run: FindingRun;
  x: number;
  y: number;
}

const generateMockData = (): FindingRun[] => {
  const runs: FindingRun[] = [];
  const now = new Date("2026-02-22");

  const severitySeed = [3, 1, 5, 2, 8, 4, 2, 6, 3, 1, 7, 2, 4, 5, 3, 2, 9, 1, 4, 6, 2, 5, 3, 7, 1, 4, 2, 6, 3, 5];
  const categorySeed = [2, 1, 3, 2, 5, 3, 1, 4, 2, 1, 5, 2, 3, 3, 2, 1, 6, 1, 3, 4, 2, 3, 2, 5, 1, 3, 2, 4, 2, 3];

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (29 - i));
    
    const baseFindings = severitySeed[i] || 3;
    const categoryFindings = categorySeed[i] || 2;
    
    const critical = Math.max(0, Math.floor(baseFindings * (0.1 + Math.random() * 0.2)));
    const high = Math.max(0, Math.floor(baseFindings * (0.2 + Math.random() * 0.3)));
    const medium = Math.max(0, Math.floor(baseFindings * (0.3 + Math.random() * 0.3)));
    const low = Math.max(0, baseFindings - critical - high - medium);
    const total = critical + high + medium + low;

    const security = Math.floor(categoryFindings * (0.3 + Math.random() * 0.3));
    const performance = Math.floor(categoryFindings * (0.2 + Math.random() * 0.2));
    const accessibility = Math.floor(categoryFindings * (0.2 + Math.random() * 0.2));
    const compliance = categoryFindings - security - performance - accessibility;

    runs.push({
      id: `run-${i + 1}`,
      date,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total,
      severity: {
        critical,
        high,
        medium,
        low,
      },
      category: {
        security: Math.max(0, security),
        performance: Math.max(0, performance),
        accessibility: Math.max(0, accessibility),
        compliance: Math.max(0, compliance),
      },
    });
  }

  runs[29].total += 8;
  runs[29].severity.critical += 4;
  runs[29].severity.high += 3;
  runs[29].severity.medium += 1;

  return runs;
};

const MOCK_DATA = generateMockData();

type ViewMode = "total" | "severity" | "category";
type TimeRange = 7 | 14 | 30 | 90;

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const CATEGORY_COLORS = {
  security: "#8b5cf6",
  performance: "#06b6d4",
  accessibility: "#ec4899",
  compliance: "#f59e0b",
};

export default function FindingTrendChart() {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const filteredData = useMemo(() => {
    return MOCK_DATA.slice(-timeRange);
  }, [timeRange]);

  const stats = useMemo(() => {
    const totals = filteredData.map((d) => d.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const peak = Math.max(...totals);
    const lowest = Math.min(...totals);
    const peakRun = filteredData.find((d) => d.total === peak);
    const lowestRun = filteredData.find((d) => d.total === lowest);

    const recentRuns = filteredData.slice(-7);
    const recentAvg = recentRuns.reduce((a, b) => a + b.total, 0) / recentRuns.length;
    const prevRuns = filteredData.slice(-14, -7);
    const prevAvg = prevRuns.length > 0 ? prevRuns.reduce((a, b) => a + b.total, 0) / prevRuns.length : recentAvg;

    const trendChange = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
    const trendDirection = trendChange > 5 ? "up" : trendChange < -5 ? "down" : "stable";

    const baseline = filteredData.slice(-7).reduce((a, b) => a + b.total, 0) / 7;

    const latestRun = filteredData[filteredData.length - 1];
    const isRegression = latestRun && latestRun.total > avg * 1.2;

    return {
      avg: avg.toFixed(1),
      peak,
      lowest,
      peakRun: peakRun?.label || "N/A",
      lowestRun: lowestRun?.label || "N/A",
      trendChange: trendChange.toFixed(1),
      trendDirection,
      baseline: baseline.toFixed(1),
      isRegression,
      latestTotal: latestRun?.total || 0,
    };
  }, [filteredData]);

  const chartDimensions = {
    width: 800,
    height: 320,
    padding: { top: 20, right: 20, bottom: 40, left: 50 },
  };

  const chartArea = {
    x: chartDimensions.padding.left,
    y: chartDimensions.padding.top,
    width: chartDimensions.width - chartDimensions.padding.left - chartDimensions.padding.right,
    height: chartDimensions.height - chartDimensions.padding.top - chartDimensions.padding.bottom,
  };

  const yScale = useCallback(
    (value: number) => {
      const maxValue = Math.max(
        ...filteredData.map((d) =>
          viewMode === "severity"
            ? d.severity.critical + d.severity.high + d.severity.medium + d.severity.low
            : viewMode === "category"
            ? d.category.security + d.category.performance + d.category.accessibility + d.category.compliance
            : d.total
        )
      );
      return chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
    },
    [filteredData, viewMode, chartArea]
  );

  const xScale = useCallback(
    (index: number) => {
      return chartArea.x + (index / (filteredData.length - 1)) * chartArea.width;
    },
    [filteredData, chartArea]
  );

  const getBarWidth = () => {
    const barCount = filteredData.length;
    const spacing = chartArea.width / barCount;
    return Math.max(spacing * 0.7, 8);
  };

  const getBarX = (index: number) => {
    const spacing = chartArea.width / filteredData.length;
    return chartArea.x + index * spacing + (spacing - getBarWidth()) / 2;
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>, run: FindingRun) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTooltip({ run, x, y });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const renderYAxis = () => {
    const maxValue = Math.max(
      ...filteredData.map((d) =>
        viewMode === "severity"
          ? d.severity.critical + d.severity.high + d.severity.medium + d.severity.low
          : viewMode === "category"
          ? d.category.security + d.category.performance + d.category.accessibility + d.category.compliance
          : d.total
      )
    );
    const ticks = 5;
    const tickValues = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxValue / ticks) * i));

    return (
      <g>
        {tickValues.map((value, i) => (
          <g key={i}>
            <line
              x1={chartArea.x}
              y1={yScale(value)}
              x2={chartArea.x + chartArea.width}
              y2={yScale(value)}
              stroke="#3f3f46"
              strokeDasharray="2,2"
              opacity={0.5}
            />
            <text
              x={chartArea.x - 10}
              y={yScale(value)}
              fill="#71717a"
              fontSize={11}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {value}
            </text>
          </g>
        ))}
      </g>
    );
  };

  const renderXAxis = () => {
    const step = Math.ceil(filteredData.length / 10);
    return (
      <g>
        {filteredData.map((run, i) =>
          i % step === 0 ? (
            <text
              key={i}
              x={xScale(i)}
              y={chartArea.y + chartArea.height + 20}
              fill="#71717a"
              fontSize={11}
              textAnchor="middle"
            >
              {run.label}
            </text>
          ) : null
        )}
      </g>
    );
  };

  const renderBaseline = () => {
    const baselineY = yScale(parseFloat(stats.baseline));
    return (
      <g>
        <line
          x1={chartArea.x}
          y1={baselineY}
          x2={chartArea.x + chartArea.width}
          y2={baselineY}
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="6,4"
          opacity={0.8}
        />
        <text
          x={chartArea.x + chartArea.width + 5}
          y={baselineY}
          fill="#6366f1"
          fontSize={10}
          dominantBaseline="middle"
        >
          7-day avg
        </text>
      </g>
    );
  };

  const renderTotalChart = () => {
    const barWidth = getBarWidth();

    return (
      <g>
        {filteredData.map((run, i) => {
          const x = getBarX(i);
          const height = chartArea.y + chartArea.height - yScale(run.total);
          const y = yScale(run.total);

          return (
            <rect
              key={run.id}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              fill="#6366f1"
              rx={3}
              className="transition-all duration-150"
              style={{ cursor: "pointer" }}
              onMouseMove={(e) => handleMouseMove(e, run)}
              onMouseLeave={handleMouseLeave}
            />
          );
        })}
      </g>
    );
  };

  const renderSeverityChart = () => {
    const barWidth = getBarWidth();
    const stackedData = filteredData.map((run) => ({
      run,
      stacked: [
        { key: "critical", value: run.severity.critical, color: SEVERITY_COLORS.critical },
        { key: "high", value: run.severity.high, color: SEVERITY_COLORS.high },
        { key: "medium", value: run.severity.medium, color: SEVERITY_COLORS.medium },
        { key: "low", value: run.severity.low, color: SEVERITY_COLORS.low },
      ],
    }));

    return (
      <g>
        {stackedData.map(({ run, stacked }, idx) => {
          let currentY = chartArea.y + chartArea.height;

          return (
            <g key={run.id}>
              {stacked.map((segment, segIdx) => {
                if (segment.value === 0) return null;
                const height = (segment.value / (run.total || 1)) * chartArea.height;
                const y = currentY - height;
                currentY -= height;

                return (
                  <rect
                    key={segIdx}
                    x={getBarX(idx)}
                    y={y}
                    width={barWidth}
                    height={height}
                    fill={segment.color}
                    rx={segIdx === stacked.length - 1 ? 3 : 0}
                    className="transition-all duration-150"
                    style={{ cursor: "pointer" }}
                    onMouseMove={(e) => handleMouseMove(e, run)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    );
  };

  const renderCategoryChart = () => {
    const barWidth = getBarWidth();
    const stackedData = filteredData.map((run) => ({
      run,
      stacked: [
        { key: "security", value: run.category.security, color: CATEGORY_COLORS.security },
        { key: "performance", value: run.category.performance, color: CATEGORY_COLORS.performance },
        { key: "accessibility", value: run.category.accessibility, color: CATEGORY_COLORS.accessibility },
        { key: "compliance", value: run.category.compliance, color: CATEGORY_COLORS.compliance },
      ],
    }));

    return (
      <g>
        {stackedData.map(({ run, stacked }, idx) => {
          let currentY = chartArea.y + chartArea.height;

          return (
            <g key={run.id}>
              {stacked.map((segment, segIdx) => {
                if (segment.value === 0) return null;
                const totalCategory =
                  run.category.security +
                  run.category.performance +
                  run.category.accessibility +
                  run.category.compliance;
                const height = (segment.value / (totalCategory || 1)) * chartArea.height;
                const y = currentY - height;
                currentY -= height;

                return (
                  <rect
                    key={segIdx}
                    x={getBarX(idx)}
                    y={y}
                    width={barWidth}
                    height={height}
                    fill={segment.color}
                    rx={segIdx === stacked.length - 1 ? 3 : 0}
                    className="transition-all duration-150"
                    style={{ cursor: "pointer" }}
                    onMouseMove={(e) => handleMouseMove(e, run)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    );
  };

  const renderLine = () => {
    if (filteredData.length < 2) return null;

    const points = filteredData.map((run, i) => `${xScale(i)},${yScale(run.total)}`).join(" ");

    return (
      <g>
        <polyline
          points={points}
          fill="none"
          stroke="#a5b4fc"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        {filteredData.map((run, i) => (
          <circle
            key={run.id}
            cx={xScale(i)}
            cy={yScale(run.total)}
            r={4}
            fill="#6366f1"
            stroke="#1e1b4b"
            strokeWidth={2}
            className="transition-all duration-150"
            style={{ cursor: "pointer" }}
            onMouseMove={(e) => handleMouseMove(e, run)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </g>
    );
  };

  const renderTooltip = () => {
    if (!tooltip) return null;

    const { run, x, y } = tooltip;
    const tooltipWidth = 220;
    const tooltipHeight = viewMode === "total" ? 80 : 160;
    const adjustedX = Math.min(x + 15, chartDimensions.width - tooltipWidth - 10);
    const adjustedY = Math.min(y - tooltipHeight - 10, chartDimensions.height - tooltipHeight - 10);

    return (
      <foreignObject x={adjustedX} y={adjustedY} width={tooltipWidth} height={tooltipHeight}>
        <div className="bg-gray-800 border border-zinc-600 rounded-lg p-3 shadow-xl text-sm">
          <div className="font-semibold text-gray-100 mb-2">{run.label}</div>
          <div className="text-gray-300 mb-1">Total: {run.total} findings</div>
          {viewMode !== "total" && (
            <div className="mt-2 pt-2 border-t border-zinc-600">
              {viewMode === "severity" && (
                <>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS.critical }} />
                    Critical: {run.severity.critical}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS.high }} />
                    High: {run.severity.high}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS.medium }} />
                    Medium: {run.severity.medium}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS.low }} />
                    Low: {run.severity.low}
                  </div>
                </>
              )}
              {viewMode === "category" && (
                <>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.security }} />
                    Security: {run.category.security}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.performance }} />
                    Performance: {run.category.performance}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.accessibility }} />
                    Accessibility: {run.category.accessibility}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.compliance }} />
                    Compliance: {run.category.compliance}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </foreignObject>
    );
  };

  const renderLegend = () => {
    if (viewMode === "total") return null;

    const items =
      viewMode === "severity"
        ? [
            { label: "Critical", color: SEVERITY_COLORS.critical },
            { label: "High", color: SEVERITY_COLORS.high },
            { label: "Medium", color: SEVERITY_COLORS.medium },
            { label: "Low", color: SEVERITY_COLORS.low },
          ]
        : [
            { label: "Security", color: CATEGORY_COLORS.security },
            { label: "Performance", color: CATEGORY_COLORS.performance },
            { label: "Accessibility", color: CATEGORY_COLORS.accessibility },
            { label: "Compliance", color: CATEGORY_COLORS.compliance },
          ];

    return (
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-gray-400 text-sm">{item.label}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-zinc-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Finding Trend Analysis
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Discovery run findings over time with severity breakdown
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1 border border-zinc-700">
            {(["total", "severity", "category"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  viewMode === mode
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex bg-gray-800 rounded-lg p-1 border border-zinc-700">
            {([7, 14, 30, 90] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  timeRange === range
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {stats.isRegression && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm font-medium">
            Regression detected: Latest run has {stats.latestTotal} findings ({stats.trendChange}% above average)
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Activity className="w-4 h-4" />
            Avg Findings/Run
          </div>
          <div className="text-2xl font-bold text-gray-100">{stats.avg}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Target className="w-4 h-4" />
            Peak Run
          </div>
          <div className="text-2xl font-bold text-gray-100">
            {stats.peak} <span className="text-sm font-normal text-gray-500">({stats.peakRun})</span>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <TrendingDown className="w-4 h-4" />
            Lowest Run
          </div>
          <div className="text-2xl font-bold text-gray-100">
            {stats.lowest} <span className="text-sm font-normal text-gray-500">({stats.lowestRun})</span>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            {stats.trendDirection === "up" ? (
              <TrendingUp className="w-4 h-4" />
            ) : stats.trendDirection === "down" ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            Trend (7-day)
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${
                stats.trendDirection === "up"
                  ? "text-red-400"
                  : stats.trendDirection === "down"
                  ? "text-green-400"
                  : "text-gray-400"
              }`}
            >
              {stats.trendChange}%
            </span>
            {stats.trendDirection === "up" ? (
              <TrendingUp className="w-5 h-5 text-red-400" />
            ) : stats.trendDirection === "down" ? (
              <TrendingDown className="w-5 h-5 text-green-400" />
            ) : (
              <Minus className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-800/30 rounded-lg p-4 border border-zinc-700">
        <svg
          width="100%"
          height={chartDimensions.height}
          viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
          className="overflow-visible"
        >
          {renderYAxis()}
          {renderXAxis()}
          {renderBaseline()}

          {viewMode === "total" && (
            <>
              {renderTotalChart()}
              {renderLine()}
            </>
          )}
          {viewMode === "severity" && renderSeverityChart()}
          {viewMode === "category" && renderCategoryChart()}

          {renderTooltip()}
        </svg>

        {renderLegend()}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>
            Showing {filteredData.length} runs over last {timeRange} days
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-indigo-500" />
            <span>Total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-indigo-400 opacity-80" />
            <span>Trend Line</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-cyan-500" style={{ borderStyle: "dashed" }} />
            <span>Baseline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
