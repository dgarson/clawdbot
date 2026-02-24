# Agent Topology: Spec & Data Model

**Issue:** bs-ux-2-spec  
**Status:** Draft  
**Squad:** UX  
**Priority:** High  
**Date:** 2026-02-24

---

## Overview

Agent Topology is the visual representation of relationships between agents, their configurations, and their interactions within the OpenClaw ecosystem. This spec defines the data model and schema requirements for rendering agent relationship graphs.

---

## Use Cases

1. **Visualizing agent hierarchies** — Parent/child agent relationships, agent spawns
2. **Understanding agent interactions** — Which agents communicate with which
3. **Dependency mapping** — What agents depend on what tools/skills
4. **Collaboration visualization** — How multiple agents work together on goals

---

## Data Model

### Core Entities

```typescript
interface AgentNode {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  persona?: string;
  avatar?: string;
  
  // Topology-specific
  parentId?: string;           // Parent agent (if spawned/subagent)
  childIds: string[];         // Subagents spawned from this agent
  collaboratorIds: string[];  // Agents this agent works with
  toolIds: string[];          // Tools/skills this agent uses
  goalIds: string[];         // Goals this agent is working toward
  ritualIds: string[];       // Rituals this agent executes
  
  // Metadata
  createdAt: string;
  lastActiveAt: string;
}

type AgentType = 'primary' | 'subagent' | 'ephemeral' | 'system';
type AgentStatus = 'active' | 'idle' | 'busy' | 'error';
```

### Relationship Types

```typescript
interface AgentRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  strength: number;           // 0-1 weight for visualization
  metadata?: Record<string, unknown>;
}

type RelationshipType = 
  | 'parent-child'          // Agent spawned this subagent
  | 'collaborator'          // Working together on goals
  | 'communication'         // Messages passed between agents
  | 'tool-dependency'       // Agent uses this tool
  | 'goal-owner'            // Agent owns this goal
  | 'ritual-executor';      // Agent runs this ritual
```

---

## Graph Schema

### Node Properties (for visualization)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| label | string | Yes | Display name |
| type | enum | Yes | Agent type affecting icon/color |
| status | enum | Yes | Affects node border/glow |
| size | number | No | Based on activity/importance |
| x, y | number | No | Position (if pre-computed) |

### Edge Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| source | string | Yes | Source agent ID |
| target | string | Yes | Target agent ID |
| type | enum | Yes | Relationship type |
| label | string | No | Short description |
| strength | number | No | 0-1, affects line thickness |
| animated | boolean | No | Show flow direction |

---

## API Requirements

### Queries Needed

```typescript
// Get all agents with topology data
GET /api/agents/topology

// Get single agent's direct relationships
GET /api/agents/:id/relationships

// Get agent's full network (recursive)
GET /api/agents/:id/network?depth=3
```

### Response Shape

```typescript
interface TopologyResponse {
  nodes: AgentNode[];
  edges: AgentRelationship[];
  meta: {
    totalAgents: number;
    totalRelationships: number;
    generatedAt: string;
  };
}
```

---

## UI/UX Requirements

### Layout

- **Default:** Force-directed graph layout
- **Alternative:** Hierarchical (tree) view for parent-child
- **Alternative:** Radial view for collaboration networks

### Interactions

- **Zoom/pan** — Standard graph navigation
- **Click node** — Show agent detail panel
- **Hover** — Tooltip with quick stats
- **Drag** — Reposition nodes (persist optional)
- **Double-click** — Focus/center on node
- **Edge click** — Show relationship details

### Visual Encoding

| Attribute | Visual Channel |
|-----------|-----------------|
| Agent type | Icon shape + color |
| Agent status | Border style + glow |
| Relationship type | Line style (solid/dashed/dotted) |
| Relationship strength | Line thickness |
| Activity level | Node size |

---

## Acceptance Criteria

1. [ ] Data model supports all relationship types defined above
2. [ ] API returns topology data in specified format
3. [ ] Graph renders with force-directed layout by default
4. [ ] All relationship types are visually distinguishable
5. [ ] Node interactions (click, hover, drag) work as specified
6. [ ] Performance acceptable for 100+ nodes
7. [ ] Responsive layout adapts to container size

---

## Dependencies

- `bs-ux-2-design` — Visual design specifications
- `bs-ux-2-impl` — React graph implementation
- `bs-ux-2-perf` — Performance optimization

---

## Related Issues

- `bs-ux-1` — Onboarding Tour (may need topology demo)
- `bs-ux-3` — Command Palette (filter by agent)
- `bs-ux-7` — Session Replay (timeline of agent interactions)
