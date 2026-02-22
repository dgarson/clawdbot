# Ingestion and Retrieval Pipeline Design

> Data ingestion, processing, multi-modal capture, web crawling, and hybrid RAG/Graph retrieval

---

## Overview

This document designs a comprehensive pipeline for:
1. **Ingestion** — Processing data from agents, user input, capture, and web sources
2. **Retrieval** — Querying the hybrid RAG (vector) + Graph database system
3. **Multi-Modal** — Handling images, audio, video, and documents

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INGESTION PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         INPUT SOURCES                                 │   │
│  │                                                                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │ Agent   │ │ User    │ │ Capture │ │ Web     │ │ Document│        │   │
│  │  │ Output  │ │ Input   │ │ (Multi- │ │ Crawler │ │ Upload  │        │   │
│  │  │         │ │         │ │ Modal)  │ │         │ │         │        │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │   │
│  └───────┼──────────┼──────────┼──────────┼──────────┼──────────────────┘   │
│          │          │          │          │          │                       │
│          └──────────┴──────────┴──────────┴──────────┘                       │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     PREPROCESSING STAGE                               │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ Format      │  │ Media       │  │ Text        │  │ Metadata    │  │   │
│  │  │ Detection   │  │ Extraction  │  │ Cleaning    │  │ Extraction  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     PROCESSING STAGE                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ Chunking    │  │ Embedding   │  │ Entity      │  │ Relationship│  │   │
│  │  │ Strategy    │  │ Generation  │  │ Extraction  │  │ Inference   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       STORAGE STAGE                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────────┐│   │
│  │  │     Vector Store        │  │        Graph Store                  ││   │
│  │  │  (SQLite + embeddings)  │  │  (Neo4j / Graphiti / SQLite)        ││   │
│  │  │                         │  │                                     ││   │
│  │  │  • Chunks               │  │  • Entities                         ││   │
│  │  │  • Embeddings           │  │  • Relationships                    ││   │
│  │  │  • Metadata             │  │  • Facts                            ││   │
│  │  └─────────────────────────┘  └─────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Input Sources

### 1. Agent Output Ingestion

Process output from agent conversations for knowledge extraction.

```typescript
interface AgentOutputSource {
  type: 'agent_output';
  sessionId: string;
  agentId: string;
  messages: Message[];
  toolResults: ToolResult[];
}
```

**Processing triggers:**
- On conversation completion
- On tool result with significant content
- Periodic batch processing of recent sessions

### 2. User Input / Direct Messages

Real-time processing of user inputs.

```typescript
interface UserInputSource {
  type: 'user_input';
  userId: string;
  sessionId: string;
  content: string | MultiModalContent;
  timestamp: Date;
}
```

### 3. Multi-Modal Capture

Images, audio, video, and documents from capture interfaces.

```typescript
interface CaptureSource {
  type: 'capture';
  captureId: string;
  mediaType: 'image' | 'audio' | 'video' | 'document' | 'screenshot';
  content: Buffer | string;  // Binary or base64
  metadata: CaptureMetadata;
}

interface CaptureMetadata {
  source: 'camera' | 'microphone' | 'screen' | 'file_upload';
  duration?: number;         // For audio/video
  dimensions?: { width: number; height: number };
  format: string;
  capturedAt: Date;
  deviceInfo?: string;
}
```

### 4. Web Crawler / Scraper

Ingest content from web pages.

```typescript
interface WebCrawlSource {
  type: 'web_crawl';
  url: string;
  crawlJobId: string;
  depth: number;             // Crawl depth from seed URL
  content: {
    html: string;
    text: string;
    title: string;
    metadata: PageMetadata;
  };
  links: string[];           // Discovered links
  media: MediaReference[];   // Images, videos on page
}

interface PageMetadata {
  author?: string;
  publishedAt?: Date;
  modifiedAt?: Date;
  language?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
}
```

### 5. Document Upload

Structured documents (PDF, DOCX, etc.).

```typescript
interface DocumentSource {
  type: 'document';
  documentId: string;
  filename: string;
  mimeType: string;
  content: Buffer;
  extractedText?: string;
  pages?: number;
}
```

---

## Preprocessing Stage

### Format Detection

```typescript
async function detectFormat(input: IngestionInput): Promise<ContentFormat> {
  if (input.type === 'capture') {
    return detectMediaFormat(input.content, input.metadata);
  }
  if (input.type === 'web_crawl') {
    return { type: 'html', encoding: 'utf-8' };
  }
  if (input.type === 'document') {
    return detectDocumentFormat(input.mimeType, input.content);
  }
  return { type: 'text', encoding: 'utf-8' };
}
```

### Media Extraction (Multi-Modal)

```typescript
interface MediaExtractionResult {
  // Text extracted from media
  text: string;

  // Visual descriptions (images, video frames)
  visualDescriptions: VisualDescription[];

  // Audio transcription
  transcription?: Transcription;

  // Structured data extracted
  structuredData?: Record<string, unknown>;
}

async function extractFromMedia(
  content: Buffer,
  mediaType: string
): Promise<MediaExtractionResult> {
  switch (mediaType) {
    case 'image':
      return extractFromImage(content);
    case 'audio':
      return extractFromAudio(content);
    case 'video':
      return extractFromVideo(content);
    case 'document':
      return extractFromDocument(content);
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }
}
```

#### Image Processing

```typescript
async function extractFromImage(content: Buffer): Promise<MediaExtractionResult> {
  // 1. OCR for text in image
  const ocrText = await performOCR(content);

  // 2. Visual description via vision model
  const visualDescription = await describeImage(content);

  // 3. Object/entity detection
  const detectedEntities = await detectEntities(content);

  return {
    text: ocrText,
    visualDescriptions: [visualDescription],
    structuredData: { detectedEntities }
  };
}
```

**Image Description Prompt:**

```markdown
> **System Prompt for Image Description:**
>
> ```
> You are analyzing an image for knowledge extraction.
>
> Describe:
> 1. What is shown in the image (objects, people, text, scenes)
> 2. Any text visible in the image (transcribe exactly)
> 3. Key entities that could be extracted (people, organizations, products, locations)
> 4. The likely context or purpose of this image
> 5. Any relationships between elements in the image
>
> Output format:
> {
>   "description": "string",
>   "visibleText": ["string"],
>   "entities": [{"type": "string", "name": "string", "confidence": number}],
>   "context": "string",
>   "relationships": [{"from": "string", "to": "string", "type": "string"}]
> }
> ```
```

#### Audio Processing

```typescript
async function extractFromAudio(content: Buffer): Promise<MediaExtractionResult> {
  // 1. Transcription
  const transcription = await transcribeAudio(content);

  // 2. Speaker diarization (if multiple speakers)
  const speakers = await identifySpeakers(content);

  // 3. Entity extraction from transcript
  const entities = await extractEntitiesFromText(transcription.text);

  return {
    text: transcription.text,
    transcription: {
      ...transcription,
      speakers
    },
    structuredData: { entities }
  };
}
```

#### Video Processing

```typescript
async function extractFromVideo(content: Buffer): Promise<MediaExtractionResult> {
  // 1. Extract key frames
  const frames = await extractKeyFrames(content, { maxFrames: 10 });

  // 2. Process each frame
  const frameDescriptions = await Promise.all(
    frames.map(frame => extractFromImage(frame.buffer))
  );

  // 3. Extract audio track
  const audioTrack = await extractAudioTrack(content);
  const audioResult = await extractFromAudio(audioTrack);

  // 4. Combine results
  return combineVideoResults(frameDescriptions, audioResult);
}
```

### Text Cleaning

```typescript
async function cleanText(text: string, source: IngestionSource): Promise<string> {
  // Remove boilerplate based on source
  if (source.type === 'web_crawl') {
    text = removeWebBoilerplate(text);
  }

  // Normalize whitespace
  text = normalizeWhitespace(text);

  // Handle encoding issues
  text = fixEncoding(text);

  // Remove personal information if configured
  if (config.ingestion.redactPII) {
    text = redactPII(text);
  }

  return text;
}
```

---

## Processing Stage

### Chunking Strategy

Different content types require different chunking approaches.

```typescript
interface ChunkingConfig {
  strategy: 'fixed' | 'semantic' | 'recursive' | 'document';
  maxChunkSize: number;        // tokens
  overlapSize: number;         // tokens
  minChunkSize: number;        // tokens
  preserveBoundaries: boolean; // Respect paragraph/section boundaries
}

const CHUNKING_STRATEGIES: Record<string, ChunkingConfig> = {
  conversation: {
    strategy: 'semantic',
    maxChunkSize: 512,
    overlapSize: 50,
    minChunkSize: 100,
    preserveBoundaries: true   // Preserve turn boundaries
  },
  document: {
    strategy: 'recursive',
    maxChunkSize: 1000,
    overlapSize: 100,
    minChunkSize: 200,
    preserveBoundaries: true   // Preserve section/paragraph
  },
  webpage: {
    strategy: 'document',
    maxChunkSize: 800,
    overlapSize: 80,
    minChunkSize: 150,
    preserveBoundaries: true   // Preserve article structure
  }
};
```

**Chunking Implementation:**

```typescript
async function chunkContent(
  content: string,
  config: ChunkingConfig,
  metadata: ContentMetadata
): Promise<Chunk[]> {
  switch (config.strategy) {
    case 'fixed':
      return fixedSizeChunking(content, config);

    case 'semantic':
      return semanticChunking(content, config);

    case 'recursive':
      return recursiveChunking(content, config);

    case 'document':
      return documentAwareChunking(content, config, metadata);
  }
}

interface Chunk {
  id: string;
  content: string;
  tokenCount: number;
  position: {
    start: number;
    end: number;
    section?: string;
  };
  metadata: ChunkMetadata;
}
```

### Embedding Generation

```typescript
interface EmbeddingConfig {
  model: string;              // e.g., 'text-embedding-3-small'
  dimensions: number;         // e.g., 1536
  batchSize: number;          // Process in batches
}

async function generateEmbeddings(
  chunks: Chunk[],
  config: EmbeddingConfig
): Promise<EmbeddedChunk[]> {
  const batches = batchArray(chunks, config.batchSize);
  const results: EmbeddedChunk[] = [];

  for (const batch of batches) {
    const embeddings = await embeddingModel.embed(
      batch.map(c => c.content),
      { model: config.model, dimensions: config.dimensions }
    );

    for (let i = 0; i < batch.length; i++) {
      results.push({
        ...batch[i],
        embedding: embeddings[i]
      });
    }
  }

  return results;
}
```

### Entity Extraction

**Entity Extraction Prompt:**

```markdown
> **System Prompt for Entity Extraction:**
>
> ```
> Extract entities and facts from the following content.
>
> Entity types to extract:
> - Person: Names of people
> - Organization: Companies, teams, groups
> - Project: Work items, initiatives, products
> - Concept: Ideas, topics, technologies
> - Location: Places, regions
> - Event: Meetings, milestones, incidents
> - Document: Referenced files, articles
> - Tool: Software, services, APIs
>
> For each entity:
> 1. Identify the canonical name
> 2. Note any aliases or variations
> 3. Assign a confidence score (0-1)
> 4. Provide context for the mention
>
> Output format:
> {
>   "entities": [
>     {
>       "type": "Person",
>       "name": "Alice Chen",
>       "aliases": ["Alice", "A. Chen"],
>       "confidence": 0.95,
>       "context": "Lead designer on the UI redesign project",
>       "mentions": [
>         {"text": "Alice is handling...", "position": 42}
>       ]
>     }
>   ],
>   "facts": [
>     {
>       "subject": "Alice Chen",
>       "predicate": "leads",
>       "object": "UI Redesign",
>       "confidence": 0.9,
>       "source": "Alice is leading the UI redesign effort"
>     }
>   ]
> }
> ```
```

**TDD Test Cases for Entity Extraction:**

```typescript
describe('EntityExtraction', () => {
  it('should extract person entities from conversation', async () => {
    const input = `
      User: Can you check with Alice about the design review?
      Agent: I'll reach out to Alice Chen from the Design team.
    `;

    const result = await extractEntities(input);

    expect(result.entities).toContainEqual(
      expect.objectContaining({
        type: 'Person',
        name: 'Alice Chen',
        aliases: expect.arrayContaining(['Alice']),
        confidence: expect.toBeGreaterThan(0.8)
      })
    );
  });

  it('should extract project relationships', async () => {
    const input = `
      Alice is leading the UI redesign project, which depends on
      the component library that Bob maintains.
    `;

    const result = await extractEntities(input);

    expect(result.facts).toContainEqual(
      expect.objectContaining({
        subject: 'Alice',
        predicate: expect.stringMatching(/leads?/i),
        object: 'UI redesign'
      })
    );

    expect(result.facts).toContainEqual(
      expect.objectContaining({
        subject: 'UI redesign',
        predicate: expect.stringMatching(/depends/i),
        object: 'component library'
      })
    );
  });

  it('should handle multi-modal input descriptions', async () => {
    const imageDescription = {
      description: 'A whiteboard showing project timeline with Alice presenting',
      visibleText: ['Q3 Launch', 'Design Review', 'Alice Chen'],
      entities: [
        { type: 'Person', name: 'Alice Chen' },
        { type: 'Event', name: 'Q3 Launch' }
      ]
    };

    const result = await extractEntities(JSON.stringify(imageDescription));

    expect(result.entities.length).toBeGreaterThanOrEqual(2);
  });
});
```

### Relationship Inference

**Relationship Inference Prompt:**

```markdown
> **System Prompt for Relationship Inference:**
>
> ```
> Given the extracted entities and context, infer relationships between them.
>
> Relationship types:
> - KNOWS: Person knows Person
> - WORKS_WITH: Person collaborates with Person
> - MEMBER_OF: Person is part of Organization/Team
> - WORKED_ON: Person contributed to Project
> - OWNS: Person/Team owns Project
> - DEPENDS_ON: Project depends on Project
> - RELATED_TO: Generic relationship
> - PART_OF: Entity is part of larger Entity
> - USES: Project/Person uses Tool
> - ABOUT: Document/Discussion is about Concept
>
> For each relationship:
> 1. Identify source and target entities
> 2. Determine relationship type
> 3. Assign confidence score
> 4. Note if temporal (has start/end dates)
> 5. Extract any properties (role, duration, etc.)
>
> Output format:
> {
>   "relationships": [
>     {
>       "from": {"type": "Person", "name": "Alice Chen"},
>       "to": {"type": "Project", "name": "UI Redesign"},
>       "type": "WORKED_ON",
>       "properties": {"role": "Lead Designer"},
>       "confidence": 0.9,
>       "evidence": "Alice is leading the UI redesign"
>     }
>   ]
> }
> ```
```

---

## Web Crawler Integration

### Crawler Architecture

```typescript
interface CrawlJob {
  id: string;
  seedUrls: string[];
  config: CrawlConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    discovered: number;
    processed: number;
    failed: number;
  };
  createdAt: Date;
  completedAt?: Date;
}

interface CrawlConfig {
  maxDepth: number;           // How many links deep to follow
  maxPages: number;           // Total pages to crawl
  allowedDomains?: string[];  // Restrict to these domains
  excludePatterns?: string[]; // URL patterns to skip
  respectRobotsTxt: boolean;
  rateLimit: {
    requestsPerSecond: number;
    delayBetweenRequests: number;
  };
  userAgent: string;
  timeout: number;
  extractMedia: boolean;      // Download images, etc.
}
```

### Crawler Pipeline

```typescript
async function crawlUrl(url: string, config: CrawlConfig): Promise<CrawlResult> {
  // 1. Fetch page
  const response = await fetchWithTimeout(url, config.timeout, {
    userAgent: config.userAgent
  });

  // 2. Parse HTML
  const dom = parseHTML(response.body);

  // 3. Extract content
  const content = extractMainContent(dom);
  const metadata = extractMetadata(dom);
  const links = extractLinks(dom, url);
  const media = config.extractMedia ? extractMedia(dom, url) : [];

  // 4. Clean and process text
  const cleanedText = await cleanText(content.text, { type: 'web_crawl' });

  // 5. Create ingestion source
  return {
    url,
    content: {
      html: content.html,
      text: cleanedText,
      title: metadata.title,
      metadata
    },
    links: filterLinks(links, config),
    media
  };
}
```

### Content Extraction (Readability-style)

```typescript
function extractMainContent(dom: Document): { html: string; text: string } {
  // Use readability algorithm to find main content
  // Similar to Mozilla Readability or newspaper3k

  // 1. Remove boilerplate (nav, footer, sidebar, ads)
  removeBoilerplate(dom);

  // 2. Score content blocks by text density
  const scores = scoreContentBlocks(dom);

  // 3. Select highest-scoring content
  const mainContent = selectMainContent(dom, scores);

  // 4. Clean and extract
  return {
    html: mainContent.innerHTML,
    text: mainContent.textContent
  };
}
```

### Existing Crawler Reference

Check OpenClaw for existing crawler implementation:

```bash
# Look for crawler in openclaw
ls ~/dev/openclaw/src/**/crawler*
ls ~/dev/openclaw/src/**/scrape*
```

---

## Storage Stage

### Vector Store Schema

```sql
-- Chunks table with embeddings
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'conversation', 'document', 'webpage', 'capture'
  content TEXT NOT NULL,
  token_count INTEGER,
  position_start INTEGER,
  position_end INTEGER,
  section TEXT,
  embedding BLOB,             -- Vector embedding
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- Sources table
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  uri TEXT,                   -- URL, file path, session ID
  title TEXT,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

-- Vector index (using sqlite-vec or similar)
CREATE VIRTUAL TABLE chunks_vec USING vec0(
  embedding float[1536]
);
```

### Graph Store Schema

```cypher
// Neo4j schema

// Entity nodes
CREATE CONSTRAINT entity_id IF NOT EXISTS
FOR (e:Entity) REQUIRE e.id IS UNIQUE;

// Relationship constraints
CREATE CONSTRAINT relationship_id IF NOT EXISTS
FOR ()-[r:RELATES_TO]-() REQUIRE r.id IS UNIQUE;

// Indexes for common queries
CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type);
CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX source_session IF NOT EXISTS FOR (s:Source) ON (s.sessionId);
```

---

## Retrieval Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RETRIEVAL PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                            Query Input                                       │
│                                │                                             │
│                                ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      QUERY ANALYSIS                                   │   │
│  │                                                                       │   │
│  │  • Intent classification                                              │   │
│  │  • Entity recognition                                                 │   │
│  │  • Query expansion                                                    │   │
│  │  • Strategy selection                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                │                                             │
│              ┌─────────────────┼─────────────────┐                          │
│              │                 │                 │                          │
│              ▼                 ▼                 ▼                          │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │  Vector Search   │ │  Graph Query     │ │  Keyword Search  │            │
│  │                  │ │                  │ │                  │            │
│  │  Semantic        │ │  Entity paths    │ │  BM25 / FTS      │            │
│  │  similarity      │ │  Relationships   │ │  Exact matches   │            │
│  │                  │ │  Traversals      │ │                  │            │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘            │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                             │
│                                ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       RESULT FUSION                                   │   │
│  │                                                                       │   │
│  │  • Reciprocal Rank Fusion (RRF)                                       │   │
│  │  • Score normalization                                                │   │
│  │  • Deduplication                                                      │   │
│  │  • Relevance reranking                                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                │                                             │
│                                ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      CONTEXT ASSEMBLY                                 │   │
│  │                                                                       │   │
│  │  • Chunk retrieval                                                    │   │
│  │  • Graph context expansion                                            │   │
│  │  • Source attribution                                                 │   │
│  │  • Token budget management                                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                │                                             │
│                                ▼                                             │
│                         Retrieved Context                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Query Analysis

```typescript
interface QueryAnalysis {
  intent: QueryIntent;
  entities: RecognizedEntity[];
  expandedQuery: string;
  strategy: RetrievalStrategy;
}

type QueryIntent =
  | 'factual'           // "What is X?"
  | 'relational'        // "How is X related to Y?"
  | 'temporal'          // "What happened before/after X?"
  | 'aggregation'       // "Who all worked on X?"
  | 'comparison'        // "Compare X and Y"
  | 'exploratory';      // "Tell me about X"

type RetrievalStrategy =
  | 'vector_only'       // Pure semantic search
  | 'graph_only'        // Pure graph traversal
  | 'hybrid_balanced'   // Equal weight
  | 'hybrid_vector'     // Vector-primary with graph augmentation
  | 'hybrid_graph';     // Graph-primary with vector augmentation
```

**Query Analysis Prompt:**

```markdown
> **System Prompt for Query Analysis:**
>
> ```
> Analyze the user query to determine the best retrieval strategy.
>
> Input: User query and conversation context
>
> Determine:
> 1. Query intent (factual, relational, temporal, aggregation, comparison, exploratory)
> 2. Entities mentioned or implied
> 3. Whether relationships are important
> 4. Time constraints if any
> 5. Recommended retrieval strategy
>
> Output:
> {
>   "intent": "relational",
>   "entities": [
>     {"name": "Alice", "type": "Person", "role": "subject"},
>     {"name": "UI redesign", "type": "Project", "role": "object"}
>   ],
>   "requiresRelationships": true,
>   "timeConstraint": null,
>   "strategy": "hybrid_graph",
>   "expandedQuery": "Alice Chen contributions to UI redesign project work involvement"
> }
> ```
```

### Strategy-Specific Retrieval

#### Vector-Only Retrieval

Best for: Factual queries, exploratory queries, when entities are not specified.

```typescript
async function vectorRetrieval(
  query: string,
  config: VectorRetrievalConfig
): Promise<VectorResult[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Search vector store
  const results = await vectorStore.search({
    embedding: queryEmbedding,
    topK: config.topK,
    filter: config.filter,
    threshold: config.similarityThreshold
  });

  return results;
}
```

#### Graph-Only Retrieval

Best for: Relational queries, aggregation queries, when entities are specified.

```typescript
async function graphRetrieval(
  entities: RecognizedEntity[],
  intent: QueryIntent,
  config: GraphRetrievalConfig
): Promise<GraphResult[]> {
  const queries: string[] = [];

  if (intent === 'relational') {
    // Find paths between entities
    queries.push(`
      MATCH path = shortestPath(
        (a:Entity {name: $entity1})-[*..${config.maxDepth}]-(b:Entity {name: $entity2})
      )
      RETURN path
    `);
  }

  if (intent === 'aggregation') {
    // Find all related entities
    queries.push(`
      MATCH (e:Entity {name: $entity})-[r]-(related)
      RETURN e, r, related
      ORDER BY r.confidence DESC
      LIMIT $limit
    `);
  }

  // Execute queries
  const results = await Promise.all(
    queries.map(q => graphStore.query(q, { entities, ...config }))
  );

  return mergeGraphResults(results);
}
```

#### Hybrid Retrieval

Best for: Most queries. Combines vector similarity with graph structure.

```typescript
async function hybridRetrieval(
  query: string,
  analysis: QueryAnalysis,
  config: HybridRetrievalConfig
): Promise<HybridResult[]> {
  // 1. Run vector and graph in parallel
  const [vectorResults, graphResults] = await Promise.all([
    vectorRetrieval(query, config.vector),
    graphRetrieval(analysis.entities, analysis.intent, config.graph)
  ]);

  // 2. Fuse results
  const fusedResults = reciprocalRankFusion(
    vectorResults,
    graphResults,
    config.weights
  );

  // 3. Expand with graph context
  const expandedResults = await expandWithGraphContext(
    fusedResults,
    config.graphExpansion
  );

  return expandedResults;
}
```

### Result Fusion

```typescript
function reciprocalRankFusion(
  vectorResults: VectorResult[],
  graphResults: GraphResult[],
  weights: { vector: number; graph: number }
): FusedResult[] {
  const k = 60; // RRF constant

  const scores = new Map<string, number>();

  // Score vector results
  vectorResults.forEach((result, rank) => {
    const rrf = weights.vector * (1 / (k + rank));
    scores.set(result.id, (scores.get(result.id) || 0) + rrf);
  });

  // Score graph results
  graphResults.forEach((result, rank) => {
    const rrf = weights.graph * (1 / (k + rank));
    scores.set(result.id, (scores.get(result.id) || 0) + rrf);
  });

  // Sort by combined score
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}
```

### Context Assembly

```typescript
interface RetrievedContext {
  chunks: ContextChunk[];
  entities: Entity[];
  relationships: Relationship[];
  sources: Source[];
  totalTokens: number;
}

async function assembleContext(
  fusedResults: FusedResult[],
  config: ContextConfig
): Promise<RetrievedContext> {
  let tokenBudget = config.maxTokens;
  const chunks: ContextChunk[] = [];
  const entities = new Set<string>();
  const relationships: Relationship[] = [];

  for (const result of fusedResults) {
    // Get full chunk
    const chunk = await getChunk(result.id);

    // Check token budget
    if (chunk.tokenCount > tokenBudget) {
      break;
    }

    chunks.push(chunk);
    tokenBudget -= chunk.tokenCount;

    // Collect entities from chunk
    const chunkEntities = await getEntitiesForChunk(chunk.id);
    chunkEntities.forEach(e => entities.add(e.id));
  }

  // Get relationships between collected entities
  const entityIds = Array.from(entities);
  const rels = await getRelationshipsBetween(entityIds);

  return {
    chunks,
    entities: await getEntitiesByIds(entityIds),
    relationships: rels,
    sources: await getSourcesForChunks(chunks),
    totalTokens: config.maxTokens - tokenBudget
  };
}
```

---

## When to Use Each Query Type

| Query Type | Example | Strategy | Why |
|------------|---------|----------|-----|
| "What is GraphRAG?" | Factual | `vector_only` | Semantic similarity finds definitions |
| "Who worked on the UI redesign?" | Aggregation | `hybrid_graph` | Graph finds all WORKED_ON relationships |
| "How is Alice related to the Q3 launch?" | Relational | `graph_only` | Path finding between entities |
| "What happened last week?" | Temporal | `hybrid_balanced` | Time filter + relevance |
| "Tell me about our design system" | Exploratory | `hybrid_vector` | Broad semantic + entity expansion |
| "Compare React and Vue for our project" | Comparison | `hybrid_balanced` | Find info on both + relationships |

---

## Multi-Modal Retrieval

### Image Query

```typescript
async function imageQuery(
  image: Buffer,
  textQuery?: string
): Promise<RetrievedContext> {
  // 1. Extract visual description
  const description = await describeImage(image);

  // 2. Extract entities from image
  const imageEntities = await extractEntitiesFromImage(image);

  // 3. Combine with text query if provided
  const combinedQuery = textQuery
    ? `${textQuery}. Image shows: ${description.description}`
    : description.description;

  // 4. Run hybrid retrieval
  return hybridRetrieval(combinedQuery, {
    intent: 'exploratory',
    entities: imageEntities,
    strategy: 'hybrid_balanced'
  });
}
```

### Audio Query

```typescript
async function audioQuery(
  audio: Buffer
): Promise<RetrievedContext> {
  // 1. Transcribe audio
  const transcription = await transcribeAudio(audio);

  // 2. Analyze transcription for query intent
  const analysis = await analyzeQuery(transcription.text);

  // 3. Run hybrid retrieval
  return hybridRetrieval(transcription.text, analysis);
}
```

---

## TDD Test Suite

```typescript
describe('Ingestion Pipeline', () => {
  describe('Preprocessing', () => {
    it('should detect image format correctly', async () => {
      const png = await readFile('test/fixtures/image.png');
      const format = await detectFormat({ type: 'capture', content: png });
      expect(format.type).toBe('image/png');
    });

    it('should extract text from PDF', async () => {
      const pdf = await readFile('test/fixtures/document.pdf');
      const result = await extractFromMedia(pdf, 'document');
      expect(result.text).toContain('expected content');
    });

    it('should transcribe audio accurately', async () => {
      const audio = await readFile('test/fixtures/speech.mp3');
      const result = await extractFromMedia(audio, 'audio');
      expect(result.transcription.text).toContain('hello world');
    });
  });

  describe('Chunking', () => {
    it('should respect paragraph boundaries', async () => {
      const text = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const chunks = await chunkContent(text, {
        strategy: 'semantic',
        maxChunkSize: 100,
        preserveBoundaries: true
      });

      // Should not split mid-paragraph
      expect(chunks.every(c => !c.content.includes('\n\n'))).toBe(true);
    });

    it('should handle overlap correctly', async () => {
      const chunks = await chunkContent(longText, {
        strategy: 'fixed',
        maxChunkSize: 100,
        overlapSize: 20
      });

      // Check overlap exists between consecutive chunks
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].content.slice(-20);
        const currStart = chunks[i].content.slice(0, 20);
        expect(prevEnd).toBe(currStart);
      }
    });
  });

  describe('Entity Extraction', () => {
    it('should extract people with high confidence', async () => {
      const text = 'Alice Chen and Bob Smith discussed the project.';
      const result = await extractEntities(text);

      expect(result.entities).toContainEqual(
        expect.objectContaining({
          type: 'Person',
          name: expect.stringMatching(/Alice Chen/i),
          confidence: expect.toBeGreaterThan(0.9)
        })
      );
    });

    it('should resolve entity aliases', async () => {
      const text = 'Alice mentioned she talked to A. Chen yesterday.';
      const result = await extractEntities(text);

      // Should recognize these as the same person
      const aliceEntities = result.entities.filter(
        e => e.type === 'Person' && e.name.includes('Alice')
      );
      expect(aliceEntities.length).toBe(1);
      expect(aliceEntities[0].aliases).toContain('A. Chen');
    });
  });

  describe('Retrieval', () => {
    it('should use graph strategy for relational queries', async () => {
      const analysis = await analyzeQuery('How is Alice related to the project?');
      expect(analysis.strategy).toBe('hybrid_graph');
    });

    it('should use vector strategy for factual queries', async () => {
      const analysis = await analyzeQuery('What is machine learning?');
      expect(analysis.strategy).toBe('vector_only');
    });

    it('should fuse results correctly', () => {
      const vectorResults = [
        { id: 'a', score: 0.9 },
        { id: 'b', score: 0.8 },
        { id: 'c', score: 0.7 }
      ];
      const graphResults = [
        { id: 'b', score: 0.95 },
        { id: 'd', score: 0.85 },
        { id: 'a', score: 0.75 }
      ];

      const fused = reciprocalRankFusion(vectorResults, graphResults, {
        vector: 0.5,
        graph: 0.5
      });

      // 'b' should rank highest (good in both)
      expect(fused[0].id).toBe('b');
    });
  });
});
```

---

## Configuration

```typescript
interface IngestionConfig {
  // Preprocessing
  preprocessing: {
    mediaExtraction: {
      enabled: boolean;
      imageModel: string;       // Vision model for image description
      audioModel: string;       // Whisper or similar
      maxMediaSize: number;     // Max bytes to process
    };
    textCleaning: {
      removeBoilerplate: boolean;
      redactPII: boolean;
      normalizeWhitespace: boolean;
    };
  };

  // Processing
  processing: {
    chunking: ChunkingConfig;
    embedding: EmbeddingConfig;
    entityExtraction: {
      model: string;
      confidenceThreshold: number;
      batchSize: number;
    };
  };

  // Web crawler
  crawler: CrawlConfig;

  // Storage
  storage: {
    vectorStore: 'sqlite' | 'qdrant' | 'pinecone';
    graphStore: 'graphiti' | 'neo4j' | 'sqlite';
  };
}

interface RetrievalConfig {
  // Query analysis
  analysis: {
    model: string;
    enableQueryExpansion: boolean;
  };

  // Vector search
  vector: {
    topK: number;
    similarityThreshold: number;
  };

  // Graph search
  graph: {
    maxDepth: number;
    maxResults: number;
  };

  // Hybrid
  hybrid: {
    weights: { vector: number; graph: number };
    fusionMethod: 'rrf' | 'linear' | 'rerank';
  };

  // Context assembly
  context: {
    maxTokens: number;
    includeRelationships: boolean;
    includeSources: boolean;
  };
}
```

---

## Integration Points in Clawdbrain

### Files to Create

```
src/ingestion/
├── types.ts                 # Input source types
├── pipeline.ts              # Main ingestion pipeline
├── preprocessing/
│   ├── format-detection.ts
│   ├── media-extraction.ts
│   ├── text-cleaning.ts
│   └── metadata-extraction.ts
├── processing/
│   ├── chunking.ts
│   ├── embedding.ts
│   ├── entity-extraction.ts
│   └── relationship-inference.ts
├── storage/
│   ├── vector-store.ts
│   └── graph-store.ts
├── crawler/
│   ├── crawler.ts
│   ├── content-extraction.ts
│   └── url-frontier.ts
└── index.ts

src/retrieval/
├── types.ts
├── pipeline.ts              # Main retrieval pipeline
├── query-analysis.ts
├── strategies/
│   ├── vector.ts
│   ├── graph.ts
│   └── hybrid.ts
├── fusion.ts
├── context-assembly.ts
└── index.ts
```

### Files to Modify

```
src/memory/search.ts         # Integrate new retrieval
src/runtime/context.ts       # Use retrieval for agent context
src/overseer/planner.ts      # Use graph for planning
src/cli/commands/ingest.ts   # CLI for manual ingestion
```
