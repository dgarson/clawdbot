# CRN (ClawdBrain Resource Name) v1 Design Proposal

## Status

- Date: 2026-02-08
- Author: Codex (draft based on design review)
- Scope: Internal identifier and policy matching format for ClawdBrain/OpenClaw resources
- Decision level: Proposed (ready for implementation planning)

## Executive Summary

This proposal keeps the six-segment CRN shape:

`crn:v1:{service}:{scope}:{resource-type}:{resource-id}`

with these important choices:

1. **Keep `crn` as the long-term prefix**.
2. **Use `global` (not empty, not `-`) for global scope**.
3. **Parse by splitting only the first five colons**; the remainder is greedy `resource-id`.
4. **Do not add a seventh structural segment for child resources**; model child/subresources inside `resource-id`.
5. **Separate concrete CRNs from wildcard patterns**: concrete CRN has no wildcards; CRN Pattern allows controlled wildcards in specific segments.
6. **Channel model**: keep `service=channel`, keep `resource-type` entity-oriented (`account`, `channel`, `thread`, `message`, etc.), and put provider/connector first inside `resource-id` (for example `slack/C0...`).

This preserves parser simplicity, avoids delimiter ambiguity, and scales to extension channels without making top-level service taxonomy unstable.

## Why This Direction

The repository already has:

- A fixed set of core chat channels and many extension channels.
- Dynamic plugin channel registration.
- Existing `sessionKey` and `sessionId` concepts.
- Existing route/session formats that already use nested delimiters.

So CRN design should optimize for:

- Stable top-level taxonomy (`service` should not churn when plugins are added).
- Easy parsing without backtracking.
- Safe policy matching.
- Compatibility with IDs that naturally include `:`, `/`, and URL syntax.

## Canonical Format

### Concrete CRN

`crn:v1:{service}:{scope}:{resource-type}:{resource-id}`

### Segment Rules

- Segment 1 (`crn`): literal `crn`
- Segment 2 (`version`): literal `v1` for this spec
- Segment 3 (`service`): token
- Segment 4 (`scope`): token, must be `global` for global resources
- Segment 5 (`resource-type`): token
- Segment 6 (`resource-id`): greedy string; may contain `:`, `/`, embedded URIs, and additional structure

### Structural Token Character Set

For `service`, `scope`, and `resource-type`:

- Allowed: `[a-z0-9._-]`
- Canonical: lowercase
- Length: `1..64`

### Parsing Algorithm (Normative)

1. Verify prefix starts with `crn:`.
2. Split on `:` **at most 5 times** (first five delimiters only).
3. Require exactly 6 parsed fields after that split.
4. Validate fields 1-5 against structural rules.
5. Require field 6 (`resource-id`) length between 1 and 8192 characters.
6. Treat field 6 as opaque/typed `resource-id` based on `service` + `resource-type`.

This avoids ambiguity for IDs like `https://github.com:443/org/repo`.

## Scope Sentinel: `global` vs `-`

Recommendation: **use `global`**.

Why:

- It is explicit in logs and policies.
- It is safer for humans and tools than punctuation-only placeholders.
- It avoids confusion with dash-containing real scope values.
- It leaves `-` available for real IDs if needed.

Compatibility option: parser may accept `-` as input alias and normalize to `global`, but canonical output should always emit `global`.

## Child/Subresource Modeling (No New Structural Segment)

Question: should CRN add an optional final segment for child resources (thread TS, reply IDs, etc.)?

Recommendation: **No**. Keep six structural segments and express hierarchy in `resource-id`.

Reasoning:

- Adding a seventh colon segment reintroduces ambiguity with greedy IDs.
- Current design already supports hierarchy naturally in `resource-id`.
- Path-like subresource encoding is easier to extend without version bumps.

### Recommended `resource-id` shape for hierarchical resources

- `{provider}/{primary-id}`
- `{provider}/{primary-id}/{child-type}/{child-id}`
- Repeat `/child-type/child-id` as needed

Examples:

- `crn:v1:channel:main:message:slack/C0AB5HFJQM7/message/1770517119.421689`
- `crn:v1:channel:main:thread:discord/1234567890/thread/9876543210`
- `crn:v1:file:main:path:local//home/user/project/src/index.ts`

## Wildcard Strategy

### Concrete identifiers

Concrete CRNs should be exact identifiers and **must not include wildcard characters**.

### CRN Patterns (for policy/query)

Define a separate concept: `CRN Pattern`, using same 6-segment frame.

Allowed wildcard placement:

- `service`: `*` allowed
- `scope`: `*` allowed
- `resource-type`: `*` allowed
- `resource-id`: optional terminal glob only (`*` at end), or exact match
- `version`: no wildcard
- `prefix`: always `crn`

Examples:

- `crn:v1:file:main:*:*`
- `crn:v1:*:main:*:*`
- `crn:v1:channel:*:message:slack/*`
- `crn:v1:channel:main:thread:discord/123/*`

Disallowed examples:

- `crn:*:channel:main:message:*` (version wildcard not allowed)
- `crn:v1:channel:ma*in:message:*` (infix wildcard in structural tokens)
- `crn:v1:channel:main:message:sl*ck/*` (infix wildcard in resource-id)

This keeps matching logic fast and predictable while still covering real policy needs.

## Channel Service Modeling

### Decision (Locked)

- **Use `service=channel`**, not per-provider service names.
- Put provider/connector identity at the start of `resource-id`.

### Why this is the long-term choice

1. Extension channels are dynamic; service taxonomy should remain stable.
2. Policy remains portable (`channel` resources share semantics).
3. You avoid exploding top-level service list with every integration.
4. It keeps future non-chat channel-like transports compatible.

### Rejected alternative

- `service=<provider>` (for example `service=slack`, `service=discord`) is rejected.

Reason for rejection:

1. It makes top-level CRN semantics plugin-dependent and unstable over time.
2. It increases migration churn whenever providers are added/renamed/removed.
3. It fragments cross-channel policy authoring and auditing.
4. It couples governance to integration inventory rather than resource semantics.

### Channel `resource-type` recommendations

- `account`
- `peer`
- `channel`
- `thread`
- `message`
- `attachment`

### Channel ID examples

- `crn:v1:channel:main:channel:slack/C0AB5HFJQM7`
- `crn:v1:channel:main:thread:discord/120001230012300123`
- `crn:v1:channel:main:message:telegram/123456789/message/8921`
- `crn:v1:channel:main:attachment:slack/F06ABC12345`

## Service and Resource-Type Registry (v1)

### `agent`

- `instance`
- `config`
- `workspace`

### `session`

- `key` (canonical for routing/authz)
- `id` (storage/runtime identity)
- `run`
- `spawn`

### `node`

- `device`
- `connection`
- `command`
- `invoke`

### `channel`

- `account`
- `peer`
- `channel`
- `thread`
- `message`
- `attachment`

### `memory`

- `entry`
- `artifact`
- `graphiti-node`
- `graphiti-edge`
- `graphiti-episode`
- `progressive`
- `experience`

### `queue`

- `queue`
- `item`
- `execution`

### `cron`

- `job`
- `run`

### `file`

- `path`
- `url`
- `sandbox`
- `node-local`

### `browser`

- `profile`
- `tab`
- `page`
- `download`

### `canvas`

- `instance`
- `element`

### `gateway`

- `config`
- `method`
- `event`
- `session`
- `node`
- `approval`
- `command`

### `plugin`

- `id`
- `slot`
- `config`

## Session `key` vs `id`: first-class guidance

Recommendation:

- Treat both as first-class.
- Make `session:key` the **authorization and routing canonical** identity.
- Keep `session:id` for storage references, API UX, and transcript linkage.

Why:

- `sessionKey` encodes functional routing context (agent/channel/peer/thread scope).
- `sessionId` is often a storage/runtime handle and may not carry route semantics.
- Policies usually care about route scope, not random IDs.

Examples:

- `crn:v1:session:main:key:agent:main:discord:channel:c1`
- `crn:v1:session:main:id:sess_01JABCDEF...`

## Canonicalization and Validation Rules

### General

- Trim leading/trailing whitespace.
- Lowercase segments 1-5.
- Preserve case in `resource-id` by default, except for typed canonicalizers.
- Reject control chars (`0x00-0x1F`, `0x7F`) anywhere.

### Typed `resource-id` canonicalization

- `file:path`: normalize separator style to `/` in canonical CRN output; keep OS-specific original elsewhere if needed.
- `file:url` and `browser:page`: parse as URL; normalize scheme/host lowercase; preserve path/query/fragment.
- `channel:*`: enforce `provider/...` prefix and lowercase provider.
- `session:key`: preserve exact key bytes after trimming (do not aggressively rewrite delimiters).

## Limits (Generous after `resource-type`)

- Segment 1-5 max: 64 chars each
- `resource-id` max: 8192 chars
- Total CRN max: 9216 chars

These limits are high enough for nested paths and embedded URLs while still protecting storage/indexing.

## Security and Authorization Notes

1. Parse first, canonicalize second, authorize third. Do not authorize raw input strings.
2. Use exact compare for concrete CRNs.
3. Use explicit CRN Pattern matcher (not ad-hoc regex).
4. Store both `raw` and `canonical` forms in audit logs when possible.
5. Avoid exposing full sensitive CRNs in public logs (especially file paths, URLs, tokens in queries).

## ABNF-like Grammar (v1)

```abnf
CRN           = "crn" ":" VERSION ":" SERVICE ":" SCOPE ":" RTYPE ":" RID
VERSION       = "v1"
SERVICE       = TOKEN
SCOPE         = TOKEN
RTYPE         = TOKEN
TOKEN         = 1*64(TCHAR)
TCHAR         = ALPHA / DIGIT / "." / "_" / "-"
RID           = 1*8192(RCHAR)
RCHAR         = %x20-7E ; visible ASCII, excluding control chars
```

Matcher grammar (pattern mode) can be defined separately, reusing this frame.

## Examples

### Concrete CRNs

- `crn:v1:agent:main:instance:abc-123`
- `crn:v1:session:main:key:agent:main:subagent:uuid-here`
- `crn:v1:node:main:device:davids-iphone`
- `crn:v1:channel:main:channel:slack/C0AB5HFJQM7`
- `crn:v1:channel:main:message:slack/C0AB5HFJQM7/message/1770517119.421689`
- `crn:v1:memory:main:graphiti-node:17df83ca-7afb-4e19-8732-862d7585c616`
- `crn:v1:file:main:path:local//home/user/src/index.ts`
- `crn:v1:queue:main:execution:exec_abc123`
- `crn:v1:cron:main:run:job-id-here/2026-02-08T19:20:00Z`
- `crn:v1:browser:main:page:https://github.com:443/org/repo`
- `crn:v1:gateway:global:config:agents.defaults.model`

### CRN patterns

- `crn:v1:file:main:*:*`
- `crn:v1:*:main:*:*`
- `crn:v1:channel:*:message:slack/*`
- `crn:v1:channel:main:thread:discord/*`

## Implementation Plan

1. Add `src/shared/crn.ts` with parser, validator, canonicalizer, formatter, and pattern matcher.
2. Add typed canonicalizers by service/type in dedicated modules.
3. Add conformance tests for parser behavior, canonicalization, matcher behavior, and security edge cases.
4. Introduce CRN fields in gateway/work-queue/cron APIs as additive metadata first.
5. Migrate internal policy checks to CRN matcher.
6. Add docs and examples for plugin authors.

## Concerns to Expand Later (Not blockers for v1)

1. Multi-tenant scope shape: current `scope` is a single token; SaaS may need org/workspace/agent hierarchy. Future option is keeping `scope` top-level and moving deeper tenancy into `resource-id`.
2. IANA registration: not needed for v1 internal rollout; revisit only if external protocol interop requires URI scheme registration.
3. Non-ASCII support: v1 recommends ASCII-safe transport; revisit internationalized IDs if real requirements emerge.
4. Redaction policy: define shared redaction rules for sensitive `resource-id` content.
5. Indexing strategy: decide how CRNs are indexed in SQL/search for high-cardinality resources.

## Final Recommendations to Lock

1. Prefix: `crn`.
2. Version: `v1`.
3. Scope sentinel: `global`.
4. Keep 6-segment structure, greedy `resource-id`.
5. No extra structural child segment.
6. Separate concrete CRN vs CRN Pattern semantics.
7. Keep `service=channel`; provider belongs in `resource-id`.
8. Treat `session:key` and `session:id` as first-class, with `session:key` canonical for authz/routing.
