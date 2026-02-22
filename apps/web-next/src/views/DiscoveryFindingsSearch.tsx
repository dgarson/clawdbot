import React, { useState, useEffect, useMemo } from "react";
import { cn } from "../lib/utils";
import { FINDINGS, type Severity, type Wave } from "./DiscoveryFindings.data";

// Constants
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const WAVES: Wave[] = [1, 2, 3];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const AGENTS = [...new Set(FINDINGS.map((f) => f.agentName))];
const DOMAINS = [...new Set(FINDINGS.map((f) => f.domain))];

// Helper functions
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) {return text;}
  
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseMarkdown(line: string, key: number): React.ReactNode {
  if (line.startsWith("## ")) {
    return (
      <h4 key={key} className="text-lg font-semibold text-gray-100 mt-4 mb-2">
        {line.replace("## ", "")}
      </h4>
    );
  }
  if (line.startsWith("### ")) {
    return (
      <h5 key={key} className="text-sm font-medium text-gray-300 mt-3 mb-1">
        {line.replace("### ", "")}
      </h5>
    );
  }
  if (line.trim().startsWith("- ")) {
    return (
      <li key={key} className="text-gray-400 ml-4">
        {line.trim().substring(2)}
      </li>
    );
  }
  if (line.includes("`") && !line.startsWith("```")) {
    const parts = line.split(/(`[^`]+`)/g);
    return (
      <p key={key} className="text-gray-400 my-1">
        {parts.map((part, j) =>
          part.startsWith("`") && part.endsWith("`") ? (
            <code key={j} className="bg-gray-800 px-1.5 py-0.5 rounded text-blue-300 text-xs">
              {part.slice(1, -1)}
            </code>
          ) : (
            part
          )
        )}
      </p>
    );
  }
  if (line.trim()) {
    return <p key={key} className="text-gray-400 my-1">{line}</p>;
  }
  return null;
}

export default function DiscoveryFindingsSearch() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedWaves, setSelectedWaves] = useState<Wave[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [sortBy, setSortBy] = useState<"relevance" | "newest" | "severity">("relevance");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("findings-search-input")?.focus();
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        document.getElementById("findings-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter and sort findings
  const filteredFindings = useMemo(() => {
    let results = [...FINDINGS];

    // Search filter
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      results = results.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.excerpt.toLowerCase().includes(query) ||
          f.agentName.toLowerCase().includes(query) ||
          f.domain.toLowerCase().includes(query) ||
          f.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Wave filter
    if (selectedWaves.length > 0) {
      results = results.filter((f) => selectedWaves.includes(f.wave));
    }

    // Agent filter
    if (selectedAgents.length > 0) {
      results = results.filter((f) => selectedAgents.includes(f.agentName));
    }

    // Domain filter
    if (selectedDomains.length > 0) {
      results = results.filter((f) => selectedDomains.includes(f.domain));
    }

    // Severity filter
    if (selectedSeverities.length > 0) {
      results = results.filter((f) => selectedSeverities.includes(f.severity));
    }

    // Date range filter
    if (dateRange.start) {
      results = results.filter((f) => f.timestamp >= dateRange.start);
    }
    if (dateRange.end) {
      results = results.filter((f) => f.timestamp <= dateRange.end + "T23:59:59");
    }

    // Sort
    switch (sortBy) {
      case "newest":
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case "severity":
        results.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
        break;
      case "relevance":
      default:
        if (debouncedQuery.trim()) {
          const query = debouncedQuery.toLowerCase();
          results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(query) ? 1 : 0;
            const bTitle = b.title.toLowerCase().includes(query) ? 1 : 0;
            if (aTitle !== bTitle) {return bTitle - aTitle;}
            return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
          });
        }
        break;
    }

    return results;
  }, [debouncedQuery, selectedWaves, selectedAgents, selectedDomains, selectedSeverities, dateRange, sortBy]);

  // Toggle filter helpers
  const toggleWave = (wave: Wave) => {
    setSelectedWaves((prev) =>
      prev.includes(wave) ? prev.filter((w) => w !== wave) : [...prev, wave]
    );
  };

  const toggleAgent = (agent: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const toggleSeverity = (severity: Severity) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  };

  const clearAllFilters = () => {
    setSelectedWaves([]);
    setSelectedAgents([]);
    setSelectedDomains([]);
    setSelectedSeverities([]);
    setDateRange({ start: "", end: "" });
  };

  const hasActiveFilters =
    selectedWaves.length > 0 ||
    selectedAgents.length > 0 ||
    selectedDomains.length > 0 ||
    selectedSeverities.length > 0 ||
    dateRange.start ||
    dateRange.end;

  // Severity badge colors
  const severityColors: Record<Severity, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-100 mb-4">
            Discovery Findings Search
          </h1>
          
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="findings-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings across all waves..."
              className="block w-full pl-10 pr-12 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0 space-y-6">
            {/* Filters */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-100">Filters</h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Wave Filter */}
              <div className="mb-5">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Wave</h3>
                <div className="flex gap-2">
                  {WAVES.map((wave) => (
                    <button
                      key={wave}
                      onClick={() => toggleWave(wave)}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md border transition-colors",
                        selectedWaves.includes(wave)
                          ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {wave}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Filter */}
              <div className="mb-5">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Agent</h3>
                <div className="flex flex-wrap gap-2">
                  {AGENTS.map((agent) => (
                    <button
                      key={agent}
                      onClick={() => toggleAgent(agent)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md border transition-colors",
                        selectedAgents.includes(agent)
                          ? "bg-purple-500/20 border-purple-500/30 text-purple-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {agent}
                    </button>
                  ))}
                </div>
              </div>

              {/* Domain Filter */}
              <div className="mb-5">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Domain</h3>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      onClick={() => toggleDomain(domain)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md border transition-colors",
                        selectedDomains.includes(domain)
                          ? "bg-green-500/20 border-green-500/30 text-green-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Filter */}
              <div className="mb-5">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Severity</h3>
                <div className="flex flex-wrap gap-2">
                  {SEVERITIES.map((severity) => (
                    <button
                      key={severity}
                      onClick={() => toggleSeverity(severity)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md border capitalize transition-colors",
                        selectedSeverities.includes(severity)
                          ? severityColors[severity]
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {severity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Date Range</h3>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="End date"
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Sort and Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">
                Showing <span className="text-gray-200 font-medium">{filteredFindings.length}</span> of{" "}
                <span className="text-gray-200 font-medium">{FINDINGS.length}</span> findings
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-sm text-gray-400">
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="severity">Severity</option>
                </select>
              </div>
            </div>

            {/* Results List */}
            {filteredFindings.length === 0 ? (
              <div className="text-center py-16 bg-gray-900/30 border border-gray-800 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No findings match your search</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    clearAllFilters();
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFindings.map((finding) => (
                  <article
                    key={finding.id}
                    className={cn(
                      "bg-gray-900/50 border rounded-lg overflow-hidden transition-colors",
                      expandedFindingId === finding.id
                        ? "border-blue-500/30"
                        : "border-gray-800 hover:border-gray-700"
                    )}
                  >
                    {/* Finding Summary - Always Visible */}
                    <button
                      onClick={() =>
                        setExpandedFindingId((prev) => (prev === finding.id ? null : finding.id))
                      }
                      className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                      aria-expanded={expandedFindingId === finding.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm text-gray-500">{finding.agentName}</span>
                            <span className="text-gray-700">•</span>
                            <span className="text-sm text-gray-500">{finding.domain}</span>
                            <span className="text-gray-700">•</span>
                            <span className="text-sm text-gray-500">Wave {finding.wave}</span>
                          </div>
                          <h3 className="text-base font-medium text-gray-100 mb-1">
                            {highlightMatch(finding.title, debouncedQuery)}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {highlightMatch(finding.excerpt, debouncedQuery)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span
                            className={cn(
                              "px-2.5 py-1 text-xs font-medium rounded-md border capitalize",
                              severityColors[finding.severity]
                            )}
                          >
                            {finding.severity}
                          </span>
                          <time className="text-xs text-gray-500" dateTime={finding.timestamp}>
                            {formatDate(finding.timestamp)}
                          </time>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Detail View */}
                    {expandedFindingId === finding.id && (
                      <div className="border-t border-gray-800 p-4 bg-gray-900/30">
                        <div className="prose prose-invert prose-sm max-w-none">
                          {finding.content.split("\n").map((line, i) => parseMarkdown(line, i))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                          {finding.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
