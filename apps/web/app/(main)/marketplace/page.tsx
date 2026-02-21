"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import { cn } from "@/lib/utils/cn";
import {
  Search,
  Package,
  Download,
  Star,
  ExternalLink,
  Sparkles,
  Zap,
  Bot,
  Globe,
  Code2,
  FileText,
  Palette,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MarketplaceSkill = {
  id: string;
  name: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  category: string;
  tags: string[];
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
};

// ---------------------------------------------------------------------------
// Mock Data (will be replaced with ClawhHub API)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "web", label: "Web & Browser", icon: Globe },
  { id: "code", label: "Code & Dev", icon: Code2 },
  { id: "writing", label: "Writing", icon: FileText },
  { id: "design", label: "Design", icon: Palette },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
];

const FEATURED_SKILLS: MarketplaceSkill[] = [
  {
    id: "browser-control",
    name: "Browser Control",
    description: "Full web browser automation — navigate, click, type, screenshot, and extract content from any webpage.",
    author: "OpenClaw",
    downloads: 12400,
    rating: 4.8,
    category: "web",
    tags: ["browser", "automation", "web"],
    icon: Globe,
    featured: true,
  },
  {
    id: "code-review",
    name: "Code Review Pro",
    description: "Deep code review with security scanning, style checking, and improvement suggestions.",
    author: "OpenClaw",
    downloads: 8200,
    rating: 4.7,
    category: "code",
    tags: ["code", "review", "security"],
    icon: Code2,
    featured: true,
  },
  {
    id: "document-writer",
    name: "Document Writer",
    description: "Generate polished documents — reports, proposals, specs, and READMEs with proper formatting.",
    author: "Community",
    downloads: 6100,
    rating: 4.5,
    category: "writing",
    tags: ["writing", "docs", "markdown"],
    icon: FileText,
  },
  {
    id: "api-tester",
    name: "API Tester",
    description: "Test REST and GraphQL APIs with automatic request generation and response validation.",
    author: "Community",
    downloads: 4300,
    rating: 4.4,
    category: "code",
    tags: ["api", "testing", "http"],
    icon: Zap,
  },
  {
    id: "design-system",
    name: "Design System Helper",
    description: "Analyze and generate design system components — tokens, patterns, and documentation.",
    author: "Community",
    downloads: 3200,
    rating: 4.3,
    category: "design",
    tags: ["design", "ui", "components"],
    icon: Palette,
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description: "Scan codebases for vulnerabilities, misconfigurations, and dependency issues.",
    author: "OpenClaw",
    downloads: 5800,
    rating: 4.6,
    category: "security",
    tags: ["security", "audit", "vulnerabilities"],
    icon: Shield,
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SkillCard({ skill }: { skill: MarketplaceSkill }) {
  const Icon = skill.icon;
  return (
    <Card className="group hover:shadow-md transition-all hover:border-primary/30">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shrink-0">
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                {skill.name}
              </h3>
              {skill.featured && (
                <Badge variant="default" className="text-[9px] h-4">
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {skill.description}
            </p>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {skill.downloads >= 1000
                  ? `${(skill.downloads / 1000).toFixed(1)}k`
                  : skill.downloads}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-warning text-warning" />
                {skill.rating}
              </span>
              <span>{skill.author}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" className="h-7 text-xs flex-1">
            <Download className="h-3 w-3 mr-1" />
            Install
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MarketplacePage() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");

  const filteredSkills = React.useMemo(() => {
    return FEATURED_SKILLS.filter((skill) => {
      if (category !== "all" && skill.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q) ||
          skill.tags.some((t) => t.includes(q))
        );
      }
      return true;
    });
  }, [search, category]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Skill Store"
              standard="Marketplace"
              expert="ClawhHub Marketplace"
            />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="Add new abilities to your agents."
              standard="Discover and install skills for your agents."
              expert="Browse, install, and manage ClawhHub skill packages."
            />
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="https://clawhub.com" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            ClawhHub
          </a>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              )}
            >
              <CatIcon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filteredSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No skills found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Try adjusting your search or category filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {/* Coming soon note */}
      <Card className="bg-accent/30 border-primary/20">
        <CardContent className="flex items-center gap-3 py-4">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">More skills coming soon</p>
            <p className="text-xs text-muted-foreground">
              ClawhHub is growing. Check back often or{" "}
              <a
                href="https://clawhub.com/publish"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                publish your own skills
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
