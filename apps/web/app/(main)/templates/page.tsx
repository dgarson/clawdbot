"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import {
  Search,
  ArrowRight,
  Star,
  Grid3X3,
  List,
  Sparkles,
  Bot,
  Code,
  Palette,
  BookOpen,
  Mail,
  Briefcase,
  GraduationCap,
  Target,
} from "lucide-react";

// ─── Template Data ───────────────────────────────────────
type Template = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  popularity: number; // 1-5 stars
  complexity: "beginner" | "standard" | "expert";
  soul: string;
  featured?: boolean;
};

const CATEGORIES = [
  { id: "all", label: "All Templates", icon: Grid3X3 },
  { id: "productivity", label: "Productivity", icon: Target },
  { id: "development", label: "Development", icon: Code },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "communication", label: "Communication", icon: Mail },
  { id: "learning", label: "Learning", icon: GraduationCap },
];

const TEMPLATES: Template[] = [
  {
    id: "personal-assistant",
    emoji: "🧑‍💼",
    name: "Personal Assistant",
    description: "Manages tasks, schedules, and daily routines.",
    longDescription: "A versatile assistant that helps manage your day-to-day tasks, scheduling, reminders, and organization. Proactive about suggesting improvements to your workflow.",
    category: "productivity",
    tags: ["productivity", "tasks", "calendar", "reminders"],
    popularity: 5,
    complexity: "beginner",
    featured: true,
    soul: "You are a personal assistant. You're organized, proactive, and always helpful.\n\n## Communication Style\n- Friendly but professional\n- Use bullet points for clarity\n- Confirm before taking actions\n- Proactively suggest improvements",
  },
  {
    id: "code-reviewer",
    emoji: "💻",
    name: "Code Reviewer",
    description: "Reviews code, catches bugs, suggests improvements.",
    longDescription: "A senior engineer perspective on your code. Reviews for bugs, performance, security, style, and maintainability. Provides concrete fixes, not just problems.",
    category: "development",
    tags: ["code", "review", "bugs", "security"],
    popularity: 5,
    complexity: "standard",
    featured: true,
    soul: "You are a senior code reviewer. You analyze code for bugs, performance issues, security vulnerabilities, and style.\n\n## Communication Style\n- Technical and precise\n- Always explain the 'why'\n- Prioritize by severity\n- Suggest concrete fixes",
  },
  {
    id: "creative-writer",
    emoji: "🎨",
    name: "Creative Writer",
    description: "Content creation, brainstorming, storytelling.",
    longDescription: "An experienced writer and content strategist who helps generate ideas, draft content, refine writing, and adapt tone for different audiences and formats.",
    category: "creative",
    tags: ["writing", "content", "brainstorming", "storytelling"],
    popularity: 4,
    complexity: "beginner",
    featured: true,
    soul: "You are a creative writer and content strategist.\n\n## Communication Style\n- Creative and inspiring\n- Adapt tone to the content type\n- Offer multiple options when brainstorming\n- Balance creativity with clarity",
  },
  {
    id: "data-analyst",
    emoji: "📊",
    name: "Data Analyst",
    description: "Analyzes data, creates reports, finds insights.",
    longDescription: "Processes and interprets data to surface actionable insights. Skilled at creating summaries, identifying trends, and presenting findings clearly.",
    category: "research",
    tags: ["data", "analytics", "reports", "insights"],
    popularity: 4,
    complexity: "standard",
    soul: "You are a data analyst. You help interpret data, create summaries, and surface actionable insights.\n\n## Communication Style\n- Analytical and data-driven\n- Use tables and structured formats\n- Highlight key findings\n- Quantify whenever possible",
  },
  {
    id: "project-manager",
    emoji: "📋",
    name: "Project Manager",
    description: "Tracks progress, coordinates tasks, manages timelines.",
    longDescription: "Keeps projects on track by managing tasks, timelines, dependencies, and team coordination. Excels at breaking down complex projects into manageable steps.",
    category: "business",
    tags: ["project", "management", "timeline", "coordination"],
    popularity: 4,
    complexity: "standard",
    soul: "You are a project manager. You break down complex projects, track progress, and keep things moving.\n\n## Communication Style\n- Structured and clear\n- Status updates with action items\n- Flag risks early\n- Celebrate milestones",
  },
  {
    id: "research-assistant",
    emoji: "🔬",
    name: "Research Assistant",
    description: "Deep research, source synthesis, fact-checking.",
    longDescription: "Conducts thorough research on any topic, synthesizes multiple sources, and presents findings with proper attribution. Excellent for literature reviews and due diligence.",
    category: "research",
    tags: ["research", "synthesis", "facts", "academic"],
    popularity: 5,
    complexity: "standard",
    featured: true,
    soul: "You are a research assistant. You conduct thorough, methodical research and present findings clearly.\n\n## Communication Style\n- Evidence-based and thorough\n- Cite sources when possible\n- Distinguish facts from opinions\n- Present multiple perspectives",
  },
  {
    id: "devops-engineer",
    emoji: "🔧",
    name: "DevOps Engineer",
    description: "Infrastructure, CI/CD, deployment, monitoring.",
    longDescription: "Helps with infrastructure as code, CI/CD pipelines, Docker/Kubernetes, monitoring, and deployment strategies. Security-conscious and automation-focused.",
    category: "development",
    tags: ["devops", "infrastructure", "ci-cd", "docker"],
    popularity: 3,
    complexity: "expert",
    soul: "You are a DevOps engineer. You help with infrastructure, deployments, and operational excellence.\n\n## Communication Style\n- Precise and operational\n- Include commands and config examples\n- Consider security implications\n- Document everything",
  },
  {
    id: "email-drafter",
    emoji: "✉️",
    name: "Email Composer",
    description: "Professional emails, follow-ups, and outreach.",
    longDescription: "Crafts professional emails for any context — from cold outreach to follow-ups to internal communications. Adapts tone and formality to the audience.",
    category: "communication",
    tags: ["email", "communication", "outreach", "professional"],
    popularity: 4,
    complexity: "beginner",
    soul: "You are an email composition specialist. You help draft clear, effective, professional emails.\n\n## Communication Style\n- Match formality to the context\n- Be concise — respect the reader's time\n- Include clear calls to action\n- Offer draft options with different tones",
  },
  {
    id: "tutor",
    emoji: "📚",
    name: "Learning Tutor",
    description: "Explains concepts, creates exercises, tracks progress.",
    longDescription: "A patient teacher who explains complex concepts in simple terms, creates practice exercises, and adapts teaching style to the learner's level.",
    category: "learning",
    tags: ["learning", "teaching", "exercises", "education"],
    popularity: 4,
    complexity: "beginner",
    soul: "You are a learning tutor. You explain concepts clearly and adapt to the learner's level.\n\n## Communication Style\n- Patient and encouraging\n- Use analogies and examples\n- Check understanding frequently\n- Break complex topics into steps",
  },
  {
    id: "security-auditor",
    emoji: "🛡️",
    name: "Security Auditor",
    description: "Security reviews, vulnerability assessment, compliance.",
    longDescription: "Reviews systems, code, and configurations for security vulnerabilities. Provides actionable remediation steps and helps with compliance requirements.",
    category: "development",
    tags: ["security", "audit", "compliance", "vulnerability"],
    popularity: 3,
    complexity: "expert",
    soul: "You are a security auditor. You identify vulnerabilities and recommend mitigations.\n\n## Communication Style\n- Precise and risk-focused\n- Classify by severity (Critical/High/Medium/Low)\n- Provide specific remediation steps\n- Reference CVEs and best practices",
  },
  {
    id: "meeting-summarizer",
    emoji: "📝",
    name: "Meeting Summarizer",
    description: "Summarizes conversations, extracts action items.",
    longDescription: "Takes meeting notes, conversation transcripts, or discussion threads and produces clear summaries with action items, decisions, and follow-ups.",
    category: "productivity",
    tags: ["meetings", "summary", "action-items", "notes"],
    popularity: 4,
    complexity: "beginner",
    soul: "You are a meeting summarizer. You extract key information from conversations.\n\n## Communication Style\n- Concise and structured\n- Separate decisions, action items, and discussions\n- Tag owners for action items\n- Highlight unresolved questions",
  },
  {
    id: "social-media",
    emoji: "📱",
    name: "Social Media Manager",
    description: "Content planning, post creation, engagement strategy.",
    longDescription: "Plans and creates social media content across platforms. Understands platform-specific best practices, hashtag strategy, and audience engagement.",
    category: "communication",
    tags: ["social", "content", "marketing", "engagement"],
    popularity: 3,
    complexity: "standard",
    soul: "You are a social media manager. You create engaging content for various platforms.\n\n## Communication Style\n- Platform-aware (different tone for LinkedIn vs Twitter)\n- Creative with hooks and CTAs\n- Use data to inform strategy\n- Stay current with trends",
  },
];

// ─── Star Rating ─────────────────────────────────────────
function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < count ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

// ─── Complexity Badge ────────────────────────────────────
function ComplexityBadge({ level }: { level: Template["complexity"] }) {
  const config = {
    beginner: { label: "Easy", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    standard: { label: "Medium", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    expert: { label: "Advanced", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  }[level];

  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      {config.label}
    </Badge>
  );
}

// ─── Template Card ───────────────────────────────────────
function TemplateCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: (template: Template) => void;
}) {
  return (
    <Card className="group hover:shadow-md transition-all hover:border-primary/30 relative overflow-hidden">
      {template.featured && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/10 text-primary text-[10px]">
            <Sparkles className="h-3 w-3 mr-1" />
            Featured
          </Badge>
        </div>
      )}
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{template.emoji}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
            <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
            <div className="flex items-center gap-2 mb-3">
              <StarRating count={template.popularity} />
              <ComplexityBadge level={template.complexity} />
            </div>
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{template.tags.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground line-clamp-1 flex-1 mr-3">
            {template.longDescription}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onUse(template)}
          >
            Use
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function TemplatesPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  const filtered = React.useMemo(() => {
    let result = [...TEMPLATES];

    if (category !== "all") {
      result = result.filter((t) => t.category === category);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }

    // Featured first, then by popularity
    result.sort((a, b) => {
      if (a.featured && !b.featured) {return -1;}
      if (!a.featured && b.featured) {return 1;}
      return b.popularity - a.popularity;
    });

    return result;
  }, [search, category]);

  const handleUseTemplate = (template: Template) => {
    // Navigate to agent builder with template pre-selected
    // Store template in sessionStorage for the builder to pick up
    sessionStorage.setItem("openclaw:agent-template", JSON.stringify(template));
    router.push("/agents/new");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Agent Templates"
              standard="Agent Templates"
              expert="Templates"
            />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="Choose a pre-built agent to get started quickly"
              standard="Browse and use pre-configured agent templates"
              expert="Template gallery — select and customize"
            />
          </p>
        </div>
        <Button onClick={() => router.push("/agents/new")}>
          <Bot className="h-4 w-4 mr-2" />
          Build from Scratch
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 border border-border rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded ${viewMode === "grid" ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded ${viewMode === "list" ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = cat.id === "all"
            ? TEMPLATES.length
            : TEMPLATES.filter((t) => t.category === cat.id).length;

          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No templates found</p>
          <p className="text-sm mt-1">Try a different search or category</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUseTemplate}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="hover:border-primary/30 transition-all cursor-pointer"
              onClick={() => handleUseTemplate(template)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-2xl">{template.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{template.name}</h3>
                    {template.featured && (
                      <Badge className="bg-primary/10 text-primary text-[10px]">Featured</Badge>
                    )}
                    <ComplexityBadge level={template.complexity} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                </div>
                <StarRating count={template.popularity} />
                <Button size="sm" variant="outline">
                  Use <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        {filtered.length} template{filtered.length !== 1 ? "s" : ""} available
        {category !== "all" && ` in ${CATEGORIES.find(c => c.id === category)?.label}`}
      </div>
    </div>
  );
}
