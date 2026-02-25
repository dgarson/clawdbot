import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

type ReleaseType = "major" | "minor" | "patch" | "beta";

interface ChangelogItem {
  title: string;
  description?: string;
}

interface Release {
  version: string;
  date: string;
  type: ReleaseType;
  tagline: string;
  newFeatures?: ChangelogItem[];
  improvements?: ChangelogItem[];
  bugFixes?: ChangelogItem[];
  breakingChanges?: ChangelogItem[];
  dependencies?: ChangelogItem[];
}

const RELEASES: Release[] = [
  {
    version: "2.4.1",
    date: "Feb 22, 2026",
    type: "patch",
    tagline: "Stability improvements and bug fixes for the Horizon UI launch.",
    bugFixes: [
      {
        title: "Cron data-sync timeout",
        description: "Resolved an issue where large data synchronizations would time out during cron executions.",
      },
      {
        title: "Email SMTP authentication",
        description: "Fixed a regression in SMTP auth handshake for certain mail providers.",
      },
    ],
  },
  {
    version: "2.4.0",
    date: "Feb 21, 2026",
    type: "minor",
    tagline: "The Horizon UI update. A completely reimagined interface for OpenClaw.",
    newFeatures: [
      {
        title: "Horizon UI (19 views)",
        description: "A comprehensive design overhaul featuring 19 dedicated views for management, monitoring, and creation.",
      },
      {
        title: "Command Palette",
        description: "Quick access to any action or view with Cmd+K.",
      },
      {
        title: "Keyboard Shortcuts",
        description: "Extensive keyboard navigation support across the entire application.",
      },
      {
        title: "Skeleton Loaders",
        description: "Improved perceived performance with beautiful skeleton states.",
      },
      {
        title: "Toast System",
        description: "Non-intrusive notification system for real-time feedback.",
      },
      {
        title: "Adaptive UX / Proficiency System",
        description: "Interface that adapts based on agent proficiency and user behavior.",
      },
    ],
  },
  {
    version: "2.3.0",
    date: "Feb 15, 2026",
    type: "minor",
    tagline: "Enhanced relay capabilities and expanded voice options.",
    newFeatures: [
      {
        title: "Node Relay Improvements",
        description: "Increased throughput and reduced latency for remote node connections.",
      },
      {
        title: "Browser Relay Chrome Extension",
        description: "Control your browser directly from OpenClaw with our new official extension.",
      },
      {
        title: "TTS Voice Switching",
        description: "Switch between multiple high-quality voices on the fly.",
      },
    ],
  },
  {
    version: "2.2.0",
    date: "Feb 1, 2026",
    type: "minor",
    tagline: "Advanced collaboration and reliability features.",
    newFeatures: [
      {
        title: "Session Branching",
        description: "Fork any session to explore alternative agent paths without losing history.",
      },
      {
        title: "Agent Collaboration Channels",
        description: "Dedicated communication paths for multi-agent workflows.",
      },
      {
        title: "Cron Heartbeats",
        description: "Monitor the health of scheduled tasks with real-time heartbeat tracking.",
      },
    ],
  },
  {
    version: "2.0.0",
    date: "Jan 15, 2026",
    type: "major",
    tagline: "Gateway v2. The foundation for the future of multi-agent orchestration.",
    newFeatures: [
      {
        title: "Gateway v2 Protocol",
        description: "A complete rewrite of the communication layer for better stability and speed.",
      },
      {
        title: "Multi-Agent Orchestration",
        description: "Seamless coordination between specialized agents.",
      },
      {
        title: "Full Agent Soul System",
        description: "Enhanced personality and behavioral modeling for agents.",
      },
    ],
    breakingChanges: [
      {
        title: "Old session format removed",
        description: "Sessions created before v2.0.0 are no longer compatible.",
      },
      {
        title: "API v1 Deprecated",
        description: "Legacy API endpoints have been removed in favor of v2.",
      },
    ],
  },
];

const TypeBadge = ({ type, latest }: { type: ReleaseType; latest?: boolean }) => {
  const colors = {
    major: "bg-primary/10 text-primary border-primary/20",
    minor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    patch: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]/20",
    beta: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="flex gap-2">
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider", colors[type])}>
        {type}
      </span>
      {latest && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-primary/50 bg-primary text-[var(--color-text-primary)] uppercase tracking-wider">
          Latest
        </span>
      )}
    </div>
  );
};

const Section = ({ title, icon, items, colorClass, iconColor }: { 
  title: string; 
  icon: string; 
  items?: ChangelogItem[]; 
  colorClass: string;
  iconColor: string;
}) => {
  if (!items || items.length === 0) {return null;}

  return (
    <div className="mb-8">
      <h3 className={cn("flex items-center gap-2 text-sm font-semibold mb-4 uppercase tracking-wider", colorClass)}>
        <span className={cn("text-lg", iconColor)}>{icon}</span>
        {title}
      </h3>
      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={i} className="group">
            <h4 className="text-[var(--color-text-primary)] font-medium group-hover:text-[var(--color-text-primary)] transition-colors">
              {item.title}
            </h4>
            {item.description && (
              <p className="text-[var(--color-text-secondary)] text-sm mt-1 leading-relaxed">
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function ChangelogView() {
  const [selectedVersion, setSelectedVersion] = useState(RELEASES[0].version);
  const [searchQuery, setSearchQuery] = useState("");
  const [depsOpen, setDepsOpen] = useState(false);

  const filteredReleases = useMemo(() => {
    return RELEASES.filter(r => 
      r.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tagline.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const currentRelease = RELEASES.find(r => r.version === selectedVersion) || RELEASES[0];
  const currentIndex = RELEASES.findIndex(r => r.version === selectedVersion);

  const goToNext = () => {
    if (currentIndex > 0) {setSelectedVersion(RELEASES[currentIndex - 1].version);}
  };

  const goToPrev = () => {
    if (currentIndex < RELEASES.length - 1) {setSelectedVersion(RELEASES[currentIndex + 1].version);}
  };

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] font-sans selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-80 border-r border-[var(--color-border)] flex flex-col shrink-0">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">Changelog</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search versions..."
              className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <nav 
          className="flex-1 overflow-y-auto p-3 space-y-1"
          role="listbox"
          aria-label="Version history"
        >
          {filteredReleases.map((release, idx) => (
            <button
              key={release.version}
              role="option"
              aria-selected={selectedVersion === release.version}
              onClick={() => setSelectedVersion(release.version)}
              className={cn(
                "w-full text-left p-4 rounded-lg transition-all duration-200 group relative",
                selectedVersion === release.version 
                  ? "bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-xl" 
                  : "hover:bg-[var(--color-surface-1)]/50 border border-transparent"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "font-mono font-bold text-lg transition-colors",
                  selectedVersion === release.version ? "text-primary" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
                )}>
                  v{release.version}
                </span>
                <TypeBadge type={release.type} latest={idx === 0 && release.version === RELEASES[0].version} />
              </div>
              <div className="text-xs text-[var(--color-text-muted)] font-medium">
                {release.date}
              </div>
              {selectedVersion === release.version && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]/20">
          <button className="w-full py-3 px-4 bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-500/10">
            Subscribe to updates
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-12 px-8">
          {/* Version Header */}
          <header className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-5xl font-black text-[var(--color-text-primary)] tracking-tight">
                v{currentRelease.version}
              </h1>
              <TypeBadge type={currentRelease.type} latest={currentRelease.version === RELEASES[0].version} />
            </div>
            <div className="text-[var(--color-text-secondary)] font-medium mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-surface-3)]" />
              Released on {currentRelease.date}
            </div>
            <p className="text-xl text-[var(--color-text-primary)] leading-relaxed border-l-4 border-primary pl-6 py-2 bg-primary/5 rounded-r-lg">
              {currentRelease.tagline}
            </p>
          </header>

          {/* Release Sections */}
          <div className="space-y-2">
            <Section 
              title="New Features" 
              icon="✨" 
              items={currentRelease.newFeatures} 
              colorClass="text-emerald-400"
              iconColor="text-emerald-500"
            />
            <Section 
              title="Improvements" 
              icon="🛠️" 
              items={currentRelease.improvements} 
              colorClass="text-primary"
              iconColor="text-primary"
            />
            <Section 
              title="Bug Fixes" 
              icon="🐛" 
              items={currentRelease.bugFixes} 
              colorClass="text-[var(--color-text-secondary)]"
              iconColor="text-[var(--color-text-muted)]"
            />
            
            {currentRelease.type === "major" && currentRelease.breakingChanges && (
              <Section 
                title="Breaking Changes" 
                icon="⚠️" 
                items={currentRelease.breakingChanges} 
                colorClass="text-amber-400"
                iconColor="text-amber-500"
              />
            )}

            {currentRelease.dependencies && (
              <div className="pt-4">
                <button 
                  onClick={() => setDepsOpen(!depsOpen)}
                  className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs font-bold uppercase tracking-widest hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <span className="text-sm">📦</span>
                  Dependencies
                  <span className={cn("ml-1 transition-transform", depsOpen ? "rotate-180" : "")}>↓</span>
                </button>
                {depsOpen && (
                  <div className="mt-4 p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                    <ul className="space-y-2">
                      {currentRelease.dependencies.map((dep, i) => (
                        <li key={i} className="text-[var(--color-text-secondary)] text-xs flex justify-between">
                          <span className="font-mono">{dep.title}</span>
                          <span className="text-[var(--color-text-muted)]">{dep.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Footer */}
          <footer className="mt-20 pt-8 border-t border-[var(--color-border)] flex justify-between">
            <button
              onClick={goToPrev}
              disabled={currentIndex === RELEASES.length - 1}
              className="group flex flex-col items-start disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">
                ← Previous
              </span>
              <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                {currentIndex === RELEASES.length - 1 ? "End of history" : `v${RELEASES[currentIndex + 1].version}`}
              </span>
            </button>

            <button
              onClick={goToNext}
              disabled={currentIndex === 0}
              className="group flex flex-col items-end disabled:opacity-30 disabled:cursor-not-allowed text-right"
            >
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">
                Next →
              </span>
              <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                {currentIndex === 0 ? "Latest Version" : `v${RELEASES[currentIndex - 1].version}`}
              </span>
            </button>
          </footer>
        </div>
      </main>
    </div>
  );
}
