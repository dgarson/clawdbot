import { useState, useMemo } from 'react';
import { Search, Download, Settings, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { MOCK_SKILLS } from '../mock-data';
import type { Skill } from '../types';

type Tab = 'installed' | 'available' | 'featured';

const CATEGORIES = ['All', 'Research', 'Development', 'Messaging', 'Productivity', 'Voice', 'Finance', 'Automation', 'Email'] as const;

export default function SkillsMarketplace() {
  const [activeTab, setActiveTab] = useState<Tab>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const installedCount = MOCK_SKILLS.filter(s => s.status === 'installed').length;
  const availableCount = MOCK_SKILLS.filter(s => s.status === 'available').length;

  const filteredSkills = useMemo(() => {
    let skills = MOCK_SKILLS;

    // Filter by tab
    if (activeTab === 'installed') {
      skills = skills.filter(s => s.status === 'installed');
    } else if (activeTab === 'available') {
      skills = skills.filter(s => s.status === 'available' && !s.featured);
    } else if (activeTab === 'featured') {
      skills = skills.filter(s => s.featured);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (activeCategory !== 'All') {
      skills = skills.filter(s => s.category === activeCategory);
    }

    // Sort: popular first, then by name
    return [...skills].toSorted((a, b) => {
      if (a.popular && !b.popular) {return -1;}
      if (!a.popular && b.popular) {return 1;}
      return a.name.localeCompare(b.name);
    });
  }, [activeTab, searchQuery, activeCategory]);

  return (
    <div className="bg-[var(--color-surface-0)] min-h-screen p-6 text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Skills</h1>
          <div className="flex items-center gap-2">
            <span className="bg-violet-600 text-[var(--color-text-primary)] text-xs px-2 py-0.5 rounded-full">
              {installedCount} installed
            </span>
            <span className="bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-xs px-2 py-0.5 rounded-full">
              {availableCount} available
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
        <input
          type="text"
          aria-label="Search skills by name or category"
          placeholder="Search skills by name or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-600"
        />
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              activeCategory === cat
                ? 'bg-violet-600 text-[var(--color-text-primary)]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--color-surface-1)] p-1 rounded-xl w-fit">
        {(['installed', 'available', 'featured'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize',
              activeTab === tab
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSkills.map(skill => (
          <SkillCard key={skill.id} skill={skill} isInstalled={skill.status === 'installed'} />
        ))}
      </div>

      {filteredSkills.length === 0 && (
        <div className="text-center text-[var(--color-text-muted)] py-12">
          No skills found matching your criteria.
        </div>
      )}
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  isInstalled: boolean;
}

function SkillCard({ skill, isInstalled }: SkillCardProps) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-border)] transition-colors">
      <div className="flex items-start gap-3 mb-3">
        {/* Icon */}
        <div className="w-10 h-10 bg-[var(--color-surface-2)] rounded-lg flex items-center justify-center text-xl flex-shrink-0">
          {skill.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-[var(--color-text-primary)] truncate">{skill.name}</h3>
            {skill.featured && (
              <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          {skill.version && (
            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">
              v{skill.version}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">{skill.description}</p>

      {/* Category & Popular */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">
          {skill.category}
        </span>
        {skill.popular && (
          <span className="text-xs text-violet-400">Popular</span>
        )}
        {skill.featured && (
          <span className="text-xs text-yellow-500">Featured</span>
        )}
      </div>

      {/* Tools */}
      {skill.tools && skill.tools.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {skill.tools.map(tool => (
            <span
              key={tool}
              className="text-xs bg-[var(--color-surface-2)]/50 text-[var(--color-text-muted)] px-1.5 py-0.5 rounded font-mono"
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {/* Action Button */}
      {isInstalled ? (
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm rounded-lg transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Update
          </button>
          <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm rounded-lg transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] text-sm rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
      )}
    </div>
  );
}
