# Graph Database Integration Design

> Knowledge Graph, Entity-Relationship Management, and UX Considerations

---

## Overview

This document outlines the integration of a Graph Database (Neo4j, Memgraph, or Graphiti) into Clawdbrain for managing:

1. **Knowledge Graph** — Structured knowledge extracted from conversations and documents
2. **Entity-Relationship Graph** — Connections between people, concepts, projects, and resources

---

## Why Graph Database?

### Current Limitations

Clawdbrain currently stores:
- Conversations in sessions (JSONL)
- Memory in SQLite with vector embeddings
- Agent configuration in JSON files

**Problems:**
- No relationship modeling between entities
- No way to answer "Who worked on project X?"
- Memory search is keyword/vector only, no reasoning over structure
- No persistent knowledge that grows over time

### Graph Database Benefits

```
┌─────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE GRAPH VALUE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  "What projects has Alice worked on?"                           │
│                                                                 │
│  Without Graph:                                                  │
│  - Search all conversations for "Alice"                         │
│  - Hope project mentions are nearby                             │
│  - Manual correlation required                                   │
│                                                                 │
│  With Graph:                                                     │
│  - MATCH (p:Person {name: "Alice"})-[:WORKED_ON]->(proj:Project)│
│  - Instant, structured answer                                    │
│  - Confidence from explicit relationships                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Options

### Option A: Neo4j (Recommended for Production)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Neo4j Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Clawdbrain Gateway                                              │
│       │                                                         │
│       ├── Neo4j Driver (bolt://)                                │
│       │      │                                                  │
│       │      └── Neo4j Database                                 │
│       │           ├── Knowledge nodes                           │
│       │           ├── Entity nodes                              │
│       │           └── Relationships                             │
│       │                                                         │
│       └── Existing Storage                                      │
│            ├── Sessions (JSONL)                                 │
│            ├── Memory (SQLite + vectors)                        │
│            └── Config (JSON)                                    │
│                                                                 │
│  Pros: Mature, scalable, excellent Cypher query language        │
│  Cons: External service, operational complexity                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Option B: Graphiti (Zep's Graph Memory)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Graphiti Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Clawdbrain Gateway                                              │
│       │                                                         │
│       ├── Graphiti Client                                       │
│       │      │                                                  │
│       │      └── Graphiti Service                               │
│       │           ├── Automatic entity extraction               │
│       │           ├── Relationship inference                    │
│       │           ├── Temporal awareness                        │
│       │           └── Neo4j backend                             │
│       │                                                         │
│       └── Existing Storage                                      │
│                                                                 │
│  Pros: AI-native, automatic extraction, temporal support        │
│  Cons: Additional service, less control over schema             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Option C: Embedded (SQLite + Custom Graph)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Embedded Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Clawdbrain Gateway                                              │
│       │                                                         │
│       └── SQLite Database                                       │
│            ├── entities (id, type, name, properties)            │
│            ├── relationships (from, to, type, properties)       │
│            ├── memory (existing)                                │
│            └── vectors (existing)                               │
│                                                                 │
│  Pros: No external dependencies, simple deployment              │
│  Cons: Limited graph query capabilities, scale limits           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Recommendation:** Start with Graphiti for automatic extraction, plan migration path to direct Neo4j for advanced use cases.

---

## Data Model

### Core Entity Types

```typescript
// Entity categories for the graph

type EntityType =
  | 'Person'           // People mentioned in conversations
  | 'Organization'     // Companies, teams, groups
  | 'Project'          // Work items, initiatives
  | 'Concept'          // Ideas, topics, domains
  | 'Document'         // Files, articles, resources
  | 'Event'            // Meetings, milestones, incidents
  | 'Location'         // Physical or virtual places
  | 'Tool'             // Software, services, APIs
  | 'Agent'            // Clawdbrain agents
  | 'Session'          // Conversation sessions
  | 'Memory'           // Stored memories/facts

interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];         // Alternative names
  properties: Record<string, unknown>;
  confidence: number;        // Extraction confidence
  source: EntitySource;      // Where it came from
  createdAt: Date;
  updatedAt: Date;
}

interface EntitySource {
  type: 'conversation' | 'document' | 'manual' | 'inference';
  sessionId?: string;
  messageId?: string;
  documentId?: string;
}
```

### Relationship Types

```typescript
type RelationshipType =
  // Person relationships
  | 'KNOWS'              // Person -> Person
  | 'WORKS_WITH'         // Person -> Person
  | 'REPORTS_TO'         // Person -> Person
  | 'MEMBER_OF'          // Person -> Organization

  // Project relationships
  | 'WORKED_ON'          // Person -> Project
  | 'OWNS'               // Person -> Project
  | 'CONTRIBUTED_TO'     // Person -> Project
  | 'DEPENDS_ON'         // Project -> Project

  // Knowledge relationships
  | 'RELATED_TO'         // Any -> Any
  | 'PART_OF'            // Any -> Any
  | 'MENTIONED_IN'       // Entity -> Session
  | 'ABOUT'              // Document -> Concept
  | 'USES'               // Project -> Tool

  // Temporal relationships
  | 'HAPPENED_BEFORE'    // Event -> Event
  | 'CAUSED'             // Event -> Event
  | 'SCHEDULED_FOR'      // Event -> Date

interface Relationship {
  id: string;
  type: RelationshipType;
  fromId: string;
  toId: string;
  properties: Record<string, unknown>;
  confidence: number;
  source: EntitySource;
  validFrom?: Date;         // Temporal validity
  validTo?: Date;
  createdAt: Date;
}
```

---

## Integration with Existing Clawdbrain Systems

### 1. Conversation Ingestion Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                 CONVERSATION → GRAPH PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Message received                                             │
│       │                                                         │
│       ▼                                                         │
│  2. Entity Extraction (LLM)                                      │
│     "Alice mentioned the Q3 launch for ProjectX"                │
│     → Person: Alice                                              │
│     → Project: ProjectX                                          │
│     → Event: Q3 launch                                           │
│       │                                                         │
│       ▼                                                         │
│  3. Relationship Inference                                       │
│     → Alice MENTIONED_IN session123                              │
│     → Alice WORKED_ON ProjectX (inferred)                        │
│     → Q3 launch ABOUT ProjectX                                   │
│       │                                                         │
│       ▼                                                         │
│  4. Entity Resolution                                            │
│     → Is "Alice" the same as existing "Alice Chen"?              │
│     → Merge or create new                                        │
│       │                                                         │
│       ▼                                                         │
│  5. Graph Update                                                 │
│     → Upsert entities                                            │
│     → Create relationships                                       │
│     → Update confidence scores                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Memory System Enhancement

```typescript
// Enhanced memory search using graph

interface GraphEnhancedMemorySearch {
  // Traditional vector search
  vectorResults: MemoryResult[];

  // Graph-augmented context
  relatedEntities: Entity[];
  entityRelationships: Relationship[];

  // Graph traversal insights
  connectionPaths: ConnectionPath[];
}

interface ConnectionPath {
  from: Entity;
  to: Entity;
  path: Array<{
    relationship: Relationship;
    entity: Entity;
  }>;
  significance: number;
}
```

### 3. Agent Context Injection

```typescript
// When agent starts working, inject relevant graph context

interface AgentContextFromGraph {
  // Entities the user has discussed
  userEntities: Entity[];

  // Recent relationships mentioned
  recentRelationships: Relationship[];

  // Background knowledge for current topic
  topicContext: {
    relatedConcepts: Entity[];
    relatedPeople: Entity[];
    relatedProjects: Entity[];
  };
}
```

### 4. Overseer Integration

```typescript
// Overseer can use graph for planning

interface OverseerGraphQueries {
  // "Who should work on this task?"
  findExpertsForTopic(topic: string): Person[];

  // "What's the context for this project?"
  getProjectContext(projectId: string): ProjectContext;

  // "What happened last time we tried this?"
  findSimilarPastEvents(description: string): Event[];
}
```

---

## UX Design for Graph Features

### Challenge: Complexity vs. Value

Graph data is inherently complex. The UX must:
1. Hide complexity for casual users
2. Surface insights without overwhelming
3. Provide power tools for those who want them

### Approach: Three Visibility Levels

```
┌─────────────────────────────────────────────────────────────────┐
│                   GRAPH UX VISIBILITY LEVELS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1: Invisible (Default)                                    │
│  ─────────────────────────────                                  │
│  • Graph enhances agent responses automatically                  │
│  • "The agent seems to remember things better"                   │
│  • No UI changes required                                        │
│                                                                 │
│  Level 2: Contextual Hints (Opt-in)                              │
│  ─────────────────────────────────                              │
│  • "Related: Alice, ProjectX, Q3 Launch"                         │
│  • Small chips showing detected entities                        │
│  • Click to see more context                                     │
│                                                                 │
│  Level 3: Knowledge Explorer (Power User)                        │
│  ────────────────────────────────────────                       │
│  • Full graph visualization                                      │
│  • Entity management UI                                          │
│  • Relationship editing                                          │
│  • Query interface                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Level 1: Invisible Integration

No UI changes. Graph improves:
- Memory search relevance
- Agent context awareness
- Response coherence

### Level 2: Contextual Hints

```
┌─────────────────────────────────────────────────────────────────┐
│ Chat with Research Bot                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ You: What's the status of the redesign?                         │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🔗 Related: [Alice Chen] [UI Redesign] [Q3 Launch]          ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Bot: Based on our discussions, the UI redesign led by           │
│ Alice Chen is targeting the Q3 launch...                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Clicking an entity chip shows a panel:

```
┌─────────────────────────────────────────────────────────────────┐
│ Alice Chen                                              [Edit]  │
│ Person                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Relationships:                                                   │
│ • Works on: UI Redesign, Mobile App                             │
│ • Member of: Design Team                                        │
│ • Reports to: David (Engineering Lead)                          │
│                                                                 │
│ Recent mentions:                                                 │
│ • "Alice is handling the component library" (2 days ago)        │
│ • "Check with Alice about the color scheme" (1 week ago)        │
│                                                                 │
│ [View in Knowledge Graph →]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Level 3: Knowledge Explorer

A dedicated view for power users:

```
┌─────────────────────────────────────────────────────────────────┐
│ Knowledge Graph                              [Search] [+ Add]   │
├────────────────┬────────────────────────────────────────────────┤
│ FILTERS        │                                                │
│                │         ┌─────────────────────┐                │
│ Types:         │         │                     │                │
│ ☑ Person       │    ┌────┤    UI Redesign     ├────┐           │
│ ☑ Project      │    │    │                     │    │           │
│ ☐ Concept      │    │    └─────────────────────┘    │           │
│ ☐ Document     │    │              │                │           │
│                │    ▼              │                ▼           │
│ Time range:    │ ┌──────┐         │           ┌──────┐         │
│ [Last 30 days] │ │Alice │◄────────┴──────────►│ Q3   │         │
│                │ │Chen  │                     │Launch│         │
│ Confidence:    │ └──────┘                     └──────┘         │
│ [High ▼]       │    │                              │           │
│                │    │    ┌─────────────────────┐   │           │
│ ───────────    │    └───►│   Design Team      │◄──┘           │
│                │         │                     │                │
│ RECENT         │         └─────────────────────┘                │
│ • Alice Chen   │                                                │
│ • UI Redesign  │  [Zoom] [Pan] [Reset] [Export]                │
│ • Q3 Launch    │                                                │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

### Entity Management UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Entities                                    [Search] [+ Create] │
├─────────────────────────────────────────────────────────────────┤
│ [All] [People] [Projects] [Concepts] [Organizations]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 👤 Alice Chen                                      [Edit] [⋮]││
│ │    Person • Design Team • 12 relationships                  ││
│ │    Last mentioned: 2 hours ago                              ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 📁 UI Redesign                                     [Edit] [⋮]││
│ │    Project • Q3 Launch • 8 relationships                    ││
│ │    Last mentioned: 1 day ago                                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 💡 Design Systems                                  [Edit] [⋮]││
│ │    Concept • 15 relationships                               ││
│ │    Extracted from: 23 conversations                         ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Relationship Editor

```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Relationship                                         [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  From: [Alice Chen        ▼]                                    │
│                                                                 │
│  Relationship: [WORKED_ON ▼]                                    │
│                                                                 │
│  To: [UI Redesign         ▼]                                    │
│                                                                 │
│  Properties:                                                     │
│  Role: [Lead Designer                           ]               │
│  Start date: [2026-01-15]                                       │
│  End date: [                ] (ongoing)                         │
│                                                                 │
│  Confidence: [● High] [ Medium] [ Low] [ Manual]                │
│                                                                 │
│  Source: Extracted from conversation on Jan 15                  │
│          [View source →]                                        │
│                                                                 │
│  [Cancel]                                           [Save]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Recommendations

### Phase 1: Foundation (Weeks 1-2)

1. **Choose infrastructure:** Graphiti for automatic extraction + Neo4j backend
2. **Define core schema:** Entity and relationship types
3. **Build ingestion pipeline:** Conversation → Entity extraction
4. **Create basic API:** CRUD for entities and relationships

### Phase 2: Backend Integration (Weeks 3-4)

1. **Connect to memory system:** Hybrid vector + graph search
2. **Agent context injection:** Provide graph context to agents
3. **Overseer queries:** Graph-based planning support
4. **Background processing:** Async entity extraction

### Phase 3: Minimal UI (Weeks 5-6)

1. **Entity chips in chat:** Level 2 visibility
2. **Entity detail panels:** Click-to-expand
3. **Settings toggle:** Enable/disable graph features
4. **Basic entity list:** View extracted entities

### Phase 4: Full Knowledge Explorer (Weeks 7-10)

1. **Graph visualization:** Interactive node-link diagram
2. **Entity management:** Full CRUD UI
3. **Relationship editor:** Manual correction
4. **Search and filter:** Power user tools

---

## Files to Create/Modify

### New Files (Backend)

```
src/graph/
├── types.ts                 # Entity, Relationship types
├── client.ts                # Graph database client
├── extraction.ts            # Entity extraction pipeline
├── resolution.ts            # Entity resolution/deduplication
├── queries.ts               # Common graph queries
└── index.ts                 # Exports

src/graph/adapters/
├── graphiti.ts              # Graphiti adapter
├── neo4j.ts                 # Direct Neo4j adapter
└── sqlite.ts                # Fallback SQLite adapter
```

### New Files (Web UI)

```
apps/web/src/components/domain/graph/
├── EntityChip.tsx           # Inline entity mention
├── EntityPanel.tsx          # Entity detail sidebar
├── EntityList.tsx           # Entity management list
├── RelationshipEditor.tsx   # Edit relationships
├── GraphVisualization.tsx   # Interactive graph view
├── KnowledgeExplorer.tsx    # Full explorer page
└── index.ts

apps/web/src/hooks/queries/
├── useEntities.ts           # Fetch entities
├── useRelationships.ts      # Fetch relationships
└── useGraphSearch.ts        # Graph-aware search

apps/web/src/routes/
└── knowledge/
    └── index.tsx            # /knowledge route
```

### Modified Files

```
src/memory/search.ts         # Add graph-enhanced search
src/runtime/context.ts       # Inject graph context to agents
src/overseer/planner.ts      # Use graph for planning
apps/web/src/routes/...      # Add Knowledge nav item
```

---

## Configuration

### Agent Configuration for Graph

```typescript
// In agents.list[].graph

interface AgentGraphConfig {
  // Enable graph features for this agent
  enabled: boolean;

  // What to extract from conversations
  extraction: {
    entities: boolean;
    relationships: boolean;
    concepts: boolean;
  };

  // How to use graph in context
  context: {
    includeRelatedEntities: boolean;
    maxEntities: number;
    includeRelationships: boolean;
  };
}
```

### System-Wide Graph Settings

```typescript
// In config.graph

interface GraphConfig {
  // Infrastructure
  provider: 'graphiti' | 'neo4j' | 'sqlite';
  connectionString?: string;

  // Extraction settings
  extraction: {
    model: string;           // Model for entity extraction
    confidence_threshold: number;
    batch_size: number;
  };

  // Resolution settings
  resolution: {
    similarity_threshold: number;
    auto_merge: boolean;
  };

  // Retention
  retention: {
    low_confidence_ttl: string;  // "30d"
    orphan_entity_ttl: string;   // "90d"
  };
}
```

---

## Open Questions

1. **Schema flexibility:** Should users define custom entity/relationship types?
2. **Privacy:** How to handle sensitive entities (people's personal info)?
3. **Multi-tenancy:** Separate graphs per tenant or shared with isolation?
4. **Sync:** How to handle offline/eventual consistency?
5. **Export:** Should users be able to export their knowledge graph?
