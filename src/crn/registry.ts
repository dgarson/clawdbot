/**
 * Service Registry — maps CRN services to URL patterns.
 *
 * Each service defines:
 * - baseUrl: The root URL for the service
 * - urlPattern: A template for constructing full URLs from CRN components
 * - parseUrl: A function to extract CRN components from a raw URL
 */

import type { CrnService, ParsedCrn, RefKind } from "./types.js";
import { CRN_VERSION } from "./types.js";

// ---------------------------------------------------------------------------
// Service URL pattern definition
// ---------------------------------------------------------------------------

export type ServiceUrlPattern = {
  /** Base URL for the service (e.g. "https://chatgpt.com/codex") */
  baseUrl: string;
  /** Resource type → URL template map. Template vars: {scope}, {resourceId} */
  resourceUrls: Record<string, string>;
  /**
   * Given a full URL, attempt to extract CRN components.
   * Returns null if the URL doesn't match this service.
   */
  parseUrl(url: string): {
    service: CrnService;
    scope: string;
    resourceType: string;
    resourceId: string;
  } | null;
  /** Map from resource type to the RefKind it corresponds to */
  refKindMap?: Record<string, RefKind>;
};

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

const CODEX_WEB: ServiceUrlPattern = {
  baseUrl: "https://chatgpt.com/codex",
  resourceUrls: {
    task: "https://chatgpt.com/codex/tasks/{resourceId}",
  },
  refKindMap: {
    task: "codex-web:task",
  },
  parseUrl(url: string) {
    // https://chatgpt.com/codex/tasks/task_e_69897ce1fef0832e900b408fb5e79043
    const match = url.match(/^https?:\/\/(?:www\.)?chatgpt\.com\/codex\/tasks\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return null;
    }
    return {
      service: "codex-web" as CrnService,
      scope: "*",
      resourceType: "task",
      resourceId: match[1],
    };
  },
};

const CLAUDE_WEB: ServiceUrlPattern = {
  baseUrl: "https://claude.ai",
  resourceUrls: {
    project: "https://claude.ai/project/{resourceId}",
  },
  refKindMap: {
    project: "claude-web:project",
  },
  parseUrl(url: string) {
    // https://claude.ai/project/abc123-def456
    const projectMatch = url.match(/^https?:\/\/(?:www\.)?claude\.ai\/project\/([a-zA-Z0-9_-]+)/);
    if (projectMatch) {
      return {
        service: "claude-web" as CrnService,
        scope: "*",
        resourceType: "project",
        resourceId: projectMatch[1],
      };
    }
    return null;
  },
};

const GITHUB: ServiceUrlPattern = {
  baseUrl: "https://github.com",
  resourceUrls: {
    pr: "https://github.com/{scope}/pull/{resourceId}",
    issue: "https://github.com/{scope}/issues/{resourceId}",
    repo: "https://github.com/{scope}",
    commit: "https://github.com/{scope}/commit/{resourceId}",
  },
  refKindMap: {
    pr: "github:pr",
    issue: "github:issue",
    repo: "github:repo",
    commit: "github:commit",
  },
  parseUrl(url: string) {
    // https://github.com/owner/repo/pull/123
    const prMatch = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (prMatch) {
      return {
        service: "github" as CrnService,
        scope: prMatch[1],
        resourceType: "pr",
        resourceId: prMatch[2],
      };
    }

    // https://github.com/owner/repo/issues/123
    const issueMatch = url.match(
      /^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/,
    );
    if (issueMatch) {
      return {
        service: "github" as CrnService,
        scope: issueMatch[1],
        resourceType: "issue",
        resourceId: issueMatch[2],
      };
    }

    // https://github.com/owner/repo/commit/sha
    const commitMatch = url.match(
      /^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/commit\/([a-f0-9]+)/,
    );
    if (commitMatch) {
      return {
        service: "github" as CrnService,
        scope: commitMatch[1],
        resourceType: "commit",
        resourceId: commitMatch[2],
      };
    }

    // https://github.com/owner/repo (bare repo)
    const repoMatch = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/?$/);
    if (repoMatch) {
      return {
        service: "github" as CrnService,
        scope: repoMatch[1],
        resourceType: "repo",
        resourceId: repoMatch[1],
      };
    }

    return null;
  },
};

const SLACK: ServiceUrlPattern = {
  baseUrl: "https://slack.com",
  resourceUrls: {
    channel: "slack://channel/{resourceId}",
    message: "slack://channel/{scope}/message/{resourceId}",
  },
  refKindMap: {
    channel: "slack:channel",
    message: "slack:message",
  },
  parseUrl(_url: string) {
    // Slack URLs are complex and workspace-specific; we rely on CRN for these
    return null;
  },
};

const NOTION: ServiceUrlPattern = {
  baseUrl: "https://notion.so",
  resourceUrls: {
    page: "https://notion.so/{resourceId}",
    database: "https://notion.so/{resourceId}",
  },
  refKindMap: {
    page: "notion:page",
    database: "notion:database",
  },
  parseUrl(url: string) {
    // https://www.notion.so/workspace/Page-Title-abc123def456
    const match = url.match(
      /^https?:\/\/(?:www\.)?notion\.so\/(?:[^/]+\/)?([a-f0-9]{32}|[a-f0-9-]{36})/,
    );
    if (match) {
      return {
        service: "notion" as CrnService,
        scope: "*",
        resourceType: "page",
        resourceId: match[1],
      };
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const SERVICE_REGISTRY: Partial<Record<CrnService, ServiceUrlPattern>> = {
  "codex-web": CODEX_WEB,
  "claude-web": CLAUDE_WEB,
  github: GITHUB,
  slack: SLACK,
  notion: NOTION,
};

/**
 * Get the URL pattern definition for a given service.
 */
export function getServicePattern(service: CrnService): ServiceUrlPattern | undefined {
  return SERVICE_REGISTRY[service];
}

/**
 * Get all registered external service patterns.
 */
export function getAllServicePatterns(): Array<[CrnService, ServiceUrlPattern]> {
  return Object.entries(SERVICE_REGISTRY) as Array<[CrnService, ServiceUrlPattern]>;
}

/**
 * Resolve a parsed CRN to a fully-qualified URL.
 * Returns undefined if the service or resource type is not in the registry.
 */
export function resolveUrl(crn: ParsedCrn): string | undefined {
  const pattern = SERVICE_REGISTRY[crn.service];
  if (!pattern) {
    return undefined;
  }

  const template = pattern.resourceUrls[crn.resourceType];
  if (!template) {
    return undefined;
  }
  // Some services (e.g. GitHub) require concrete scope to build a valid URL.
  // Keep URL unset when scope is unknown rather than emitting placeholders.
  if (template.includes("{scope}") && crn.scope === "*") {
    return undefined;
  }

  return template.replace("{scope}", crn.scope).replace("{resourceId}", crn.resourceId);
}

/**
 * Given a ref kind, resolve it to the corresponding CRN service and resource type.
 * This is the inverse of the refKindMap in each service pattern.
 */
export function refKindToCrnParts(
  kind: RefKind,
): { service: CrnService; resourceType: string } | undefined {
  // Check namespaced kinds (e.g. "codex-web:task")
  const colonIdx = kind.indexOf(":");
  if (colonIdx > 0) {
    const service = kind.slice(0, colonIdx) as CrnService;
    const resourceType = kind.slice(colonIdx + 1);
    // Validate the service exists in the registry
    const servicePattern = SERVICE_REGISTRY[service];
    if (servicePattern?.refKindMap?.[resourceType]) {
      return { service, resourceType };
    }
    // Registered external services must declare supported ref kinds explicitly.
    if (servicePattern) {
      return undefined;
    }
    // For internal services like "graphiti:node", "work:item", etc.
    return { service, resourceType };
  }
  return undefined;
}

/**
 * Build a CRN string from its components.
 */
export function buildCrn(
  service: CrnService,
  scope: string,
  resourceType: string,
  resourceId: string,
  version: string = CRN_VERSION,
): string {
  return `crn:${version}:${service}:${scope}:${resourceType}:${resourceId}`;
}
