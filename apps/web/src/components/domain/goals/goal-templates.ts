/**
 * Goal Templates — predefined workflow presets for common autonomous goals.
 * These populate the Create Goal form with sensible defaults.
 */

export interface GoalTemplate {
  id: string;
  name: string;
  icon: string; // emoji
  category: GoalTemplateCategory;
  description: string;
  /** Pre-filled title (with placeholder brackets) */
  title: string;
  /** Pre-filled milestones */
  milestones: string[];
}

export type GoalTemplateCategory =
  | "development"
  | "operations"
  | "research"
  | "maintenance";

export const GOAL_TEMPLATE_CATEGORIES: {
  id: GoalTemplateCategory;
  label: string;
  icon: string;
}[] = [
  { id: "development", label: "Development", icon: "💻" },
  { id: "operations", label: "Operations", icon: "⚙️" },
  { id: "research", label: "Research", icon: "🔬" },
  { id: "maintenance", label: "Maintenance", icon: "🔧" },
];

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // --- Development ---
  {
    id: "feature-implementation",
    name: "Feature Implementation",
    icon: "🚀",
    category: "development",
    description: "Build a new feature end-to-end with tests and docs",
    title: "Implement [Feature Name]",
    milestones: [
      "Design and plan approach",
      "Implement core functionality",
      "Add unit and integration tests",
      "Update documentation",
      "Build passes cleanly",
    ],
  },
  {
    id: "bug-fix",
    name: "Bug Fix",
    icon: "🐛",
    category: "development",
    description: "Investigate, reproduce, and fix a bug",
    title: "Fix: [Bug Description]",
    milestones: [
      "Reproduce the bug reliably",
      "Identify root cause",
      "Implement fix",
      "Add regression test",
      "Verify no side effects",
    ],
  },
  {
    id: "refactor",
    name: "Code Refactor",
    icon: "♻️",
    category: "development",
    description: "Improve code quality without changing behavior",
    title: "Refactor: [Component/Module]",
    milestones: [
      "Audit current implementation",
      "Plan refactor approach",
      "Implement changes incrementally",
      "Verify all existing tests pass",
      "Clean up and document",
    ],
  },
  {
    id: "api-endpoint",
    name: "New API Endpoint",
    icon: "🔌",
    category: "development",
    description: "Design and implement a new API endpoint",
    title: "API: Add [Endpoint Name] endpoint",
    milestones: [
      "Define request/response types",
      "Implement endpoint handler",
      "Add validation and error handling",
      "Write API tests",
      "Update API documentation",
    ],
  },

  // --- Operations ---
  {
    id: "deploy-and-verify",
    name: "Deploy & Verify",
    icon: "📦",
    category: "operations",
    description: "Deploy changes and verify they work in production",
    title: "Deploy [Version/Feature] to production",
    milestones: [
      "Prepare deployment checklist",
      "Deploy to staging and verify",
      "Deploy to production",
      "Run health checks",
      "Monitor for issues",
    ],
  },
  {
    id: "ci-optimization",
    name: "CI/CD Optimization",
    icon: "⚡",
    category: "operations",
    description: "Speed up or improve the CI/CD pipeline",
    title: "Optimize CI/CD: [Area]",
    milestones: [
      "Benchmark current pipeline times",
      "Identify bottlenecks",
      "Implement optimizations",
      "Verify all checks still pass",
      "Document improvements with metrics",
    ],
  },
  {
    id: "monitoring-setup",
    name: "Monitoring & Alerts",
    icon: "📊",
    category: "operations",
    description: "Set up monitoring and alerting for a service",
    title: "Set up monitoring for [Service]",
    milestones: [
      "Define key metrics and SLAs",
      "Configure monitoring dashboards",
      "Set up alert thresholds",
      "Test alert delivery",
      "Document runbook for common alerts",
    ],
  },

  // --- Research ---
  {
    id: "spike-investigation",
    name: "Technical Spike",
    icon: "🔍",
    category: "research",
    description: "Time-boxed investigation of a technical approach",
    title: "Spike: Evaluate [Technology/Approach]",
    milestones: [
      "Define key questions to answer",
      "Research and prototype",
      "Evaluate trade-offs",
      "Write recommendation",
      "Identify next steps",
    ],
  },
  {
    id: "architecture-design",
    name: "Architecture Design",
    icon: "🏗️",
    category: "research",
    description: "Design a system component or major feature",
    title: "Design: [System/Component] Architecture",
    milestones: [
      "Gather requirements and constraints",
      "Draft architecture design",
      "Define key interfaces and data models",
      "Evaluate alternatives",
      "Create implementation plan",
    ],
  },
  {
    id: "competitive-analysis",
    name: "Competitive Analysis",
    icon: "📋",
    category: "research",
    description: "Analyze competing solutions and approaches",
    title: "Analysis: [Topic/Product Area]",
    milestones: [
      "Identify competitors and alternatives",
      "Define evaluation criteria",
      "Conduct analysis",
      "Summarize findings",
      "Make recommendations",
    ],
  },

  // --- Maintenance ---
  {
    id: "dependency-update",
    name: "Dependency Update",
    icon: "📦",
    category: "maintenance",
    description: "Update dependencies and verify nothing breaks",
    title: "Update [Package/All] dependencies",
    milestones: [
      "Audit outdated dependencies",
      "Update incrementally by group",
      "Run full test suite",
      "Check for runtime regressions",
      "Update lock file and commit",
    ],
  },
  {
    id: "cleanup-tech-debt",
    name: "Tech Debt Cleanup",
    icon: "🧹",
    category: "maintenance",
    description: "Address accumulated technical debt",
    title: "Cleanup: [Area of Tech Debt]",
    milestones: [
      "Identify and prioritize debt items",
      "Implement highest-impact fixes",
      "Verify tests pass",
      "Improve code quality metrics",
      "Document changes",
    ],
  },
  {
    id: "documentation",
    name: "Documentation",
    icon: "📝",
    category: "maintenance",
    description: "Create or update documentation",
    title: "Docs: [Documentation Topic]",
    milestones: [
      "Outline documentation structure",
      "Write initial draft",
      "Add examples and code snippets",
      "Review for clarity",
      "Publish and link from README",
    ],
  },
];

/** Get templates filtered by category */
export function getTemplatesByCategory(
  category: GoalTemplateCategory
): GoalTemplate[] {
  return GOAL_TEMPLATES.filter((t) => t.category === category);
}

/** Get a template by ID */
export function getTemplateById(id: string): GoalTemplate | undefined {
  return GOAL_TEMPLATES.find((t) => t.id === id);
}
