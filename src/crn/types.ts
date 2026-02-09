/**
 * CRN — ClawdBrain Resource Name
 *
 * A compact, canonical identifier for resources across the OpenClaw ecosystem.
 * Modeled after AWS ARNs but tailored for agent infrastructure.
 *
 * Format: crn:{version}:{service}:{scope}:{resource-type}:{resource-id}
 *
 * - version: Schema version (currently "1")
 * - service: The service/platform that owns the resource
 * - scope: Scoping qualifier (e.g. agent ID, org, or "*" for global)
 * - resource-type: Type of resource within the service
 * - resource-id: Unique identifier (greedy — 6th colon onward, so embedded ":" is safe)
 *
 * Examples:
 *   crn:1:codex-web:*:task:task_e_69897ce1fef0832e900b408fb5e79043
 *   crn:1:claude-web:*:project:proj_abc123
 *   crn:1:github:dgarson/clawdbrain:pr:347
 *   crn:1:work:main:item:550e8400-e29b-41d4-a716-446655440000
 *   crn:1:graphiti:main:node:c9f3f845-3c3f-4a6c-a356-802b14eb7704
 */

// ---------------------------------------------------------------------------
// CRN version
// ---------------------------------------------------------------------------
export const CRN_VERSION = "1";

// ---------------------------------------------------------------------------
// Well-known services
// ---------------------------------------------------------------------------

/**
 * Services that can appear in a CRN. Divided into:
 * - Internal services (OpenClaw infrastructure)
 * - External services (third-party platforms with known URL patterns)
 */
export const CRN_SERVICES = [
  // Internal OpenClaw services
  "agent",
  "session",
  "node",
  "channel",
  "memory",
  "work",
  "cron",
  "file",
  "browser",
  "canvas",
  "gateway",
  "graphiti",
  "experience",

  // External platform services
  "codex-web",
  "claude-web",
  "github",
  "slack",
  "notion",
] as const;

export type CrnService = (typeof CRN_SERVICES)[number];

// ---------------------------------------------------------------------------
// Ref kinds — flat string enum for cross-entity references
// ---------------------------------------------------------------------------

/**
 * Well-known ref kinds used in work items, memory entries, and other
 * entities that maintain cross-references.
 *
 * Format: `{service}:{resource-type}` for namespaced kinds,
 * or just `{type}` for top-level OpenClaw entities.
 */
export const REF_KINDS = [
  // Internal OpenClaw entities (top-level)
  "agent",
  "session",
  "conversation",
  "node",
  "experience",
  "document",

  // Namespaced internal kinds
  "graphiti:node",
  "graphiti:edge",
  "graphiti:episode",
  "memory:entry",
  "memory:legacy",
  "work:queue",
  "work:item",
  "cron:job",
  "embedding:chunk",

  // External platform kinds
  "codex-web:task",
  "claude-web:project",
  "github:pr",
  "github:issue",
  "github:repo",
  "github:commit",
  "slack:channel",
  "slack:message",
  "notion:page",
  "notion:database",
] as const;

export type RefKind = (typeof REF_KINDS)[number];

// ---------------------------------------------------------------------------
// Parsed CRN structure
// ---------------------------------------------------------------------------

export type ParsedCrn = {
  /** Always "crn" */
  scheme: "crn";
  /** Schema version (e.g. "1") */
  version: string;
  /** Service name */
  service: CrnService;
  /** Scope qualifier (agent ID, org, or "*" for global) */
  scope: string;
  /** Resource type within the service */
  resourceType: string;
  /** Resource identifier (greedy — may contain ":") */
  resourceId: string;
};

// ---------------------------------------------------------------------------
// Cross-entity reference
// ---------------------------------------------------------------------------

/**
 * A cross-entity reference that can be attached to work items, memory entries,
 * or other entities. Contains either a CRN or a raw URI for external resources.
 */
export type EntityRef = {
  /** The kind of reference (determines how to interpret id) */
  kind: RefKind;
  /** The resource identifier — either a raw ID or a CRN string */
  id: string;
  /** Optional human-readable label */
  label?: string;
  /** Optional fully-qualified URI (resolved from CRN or raw URL) */
  uri?: string;
  /** Optional CRN string (canonical form). May be set by canonicalization. */
  crn?: string;
};
