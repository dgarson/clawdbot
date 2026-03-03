import React, { useState } from "react";
import { cn } from "../lib/utils";

// Types
interface Collection {
  id: string;
  name: string;
  dimensions: number;
  distanceMetric: "cosine" | "euclidean" | "dot";
  vectorCount: number;
  diskSize: string;
  indexStatus: "ready" | "building" | "error";
  schema: Record<string, string>;
  metadataFields: string[];
  sampleVectors: number[];
}

interface Embedding {
  id: string;
  collectionId: string;
  model: string;
  vector: number[];
  cluster: number;
  createdAt: string;
  payload: Record<string, unknown>;
}

interface SearchResult {
  id: string;
  score: number;
  distance: number;
  payload: Record<string, unknown>;
}

interface IndexStats {
  collectionId: string;
  segments: number;
  memoryUsage: string;
  indexingQueueDepth: number;
  health: "healthy" | "degraded" | "critical";
  lastRebuild: string;
}

// Sample Data
const sampleCollections: Collection[] = [
  {
    id: "col-1",
    name: "customer_embeddings",
    dimensions: 768,
    distanceMetric: "cosine",
    vectorCount: 15420,
    diskSize: "2.4 GB",
    indexStatus: "ready",
    schema: { text: "string", category: "string", timestamp: "datetime" },
    metadataFields: ["source", "created_by", "version", "tags"],
    sampleVectors: [0.12, -0.34, 0.56, 0.78, -0.23, 0.45, 0.67, -0.89],
  },
  {
    id: "col-2",
    name: "product_descriptions",
    dimensions: 384,
    distanceMetric: "euclidean",
    vectorCount: 8930,
    diskSize: "1.1 GB",
    indexStatus: "ready",
    schema: { title: "string", description: "string", price: "float" },
    metadataFields: ["product_id", "category", "brand"],
    sampleVectors: [0.45, 0.23, -0.67, 0.89, 0.12, -0.34, 0.56, 0.78],
  },
  {
    id: "col-3",
    name: "document_chunks",
    dimensions: 1536,
    distanceMetric: "cosine",
    vectorCount: 42150,
    diskSize: "8.7 GB",
    indexStatus: "building",
    schema: { chunk_text: "string", source_doc: "string", page: "int" },
    metadataFields: ["document_id", "chunk_index", "heading"],
    sampleVectors: [-0.12, 0.45, 0.78, -0.23, 0.56, 0.34, -0.67, 0.89],
  },
  {
    id: "col-4",
    name: "user_profiles",
    dimensions: 256,
    distanceMetric: "dot",
    vectorCount: 5280,
    diskSize: "480 MB",
    indexStatus: "ready",
    schema: { user_id: "string", features: "float[]", preferences: "json" },
    metadataFields: ["signup_date", "tier", "last_active"],
    sampleVectors: [0.91, 0.23, -0.45, 0.67, -0.12, 0.89, 0.34, -0.56],
  },
  {
    id: "col-5",
    name: "conversation_history",
    dimensions: 512,
    distanceMetric: "cosine",
    vectorCount: 127500,
    diskSize: "4.2 GB",
    indexStatus: "ready",
    schema: { message: "string", role: "string", timestamp: "datetime" },
    metadataFields: ["conversation_id", "user_id", "channel"],
    sampleVectors: [0.23, -0.56, 0.78, 0.12, -0.89, 0.45, 0.67, -0.34],
  },
  {
    id: "col-6",
    name: "image_features",
    dimensions: 2048,
    distanceMetric: "euclidean",
    vectorCount: 3150,
    diskSize: "9.8 GB",
    indexStatus: "error",
    schema: { image_url: "string", features: "float[]", labels: "string[]" },
    metadataFields: ["image_id", "dataset", "resolution"],
    sampleVectors: [0.78, 0.12, -0.34, 0.56, 0.89, -0.23, -0.67, 0.45],
  },
];

const sampleEmbeddings: Embedding[] = [
  { id: "emb-1", collectionId: "col-1", model: "text-embedding-3-large", vector: [0.12, -0.34, 0.56, 0.78], cluster: 0, createdAt: "2024-01-15T10:30:00Z", payload: { text: "Customer support inquiry about billing" } },
  { id: "emb-2", collectionId: "col-1", model: "text-embedding-3-large", vector: [0.45, 0.23, -0.67, 0.89], cluster: 1, createdAt: "2024-01-15T11:45:00Z", payload: { text: "Product feedback from premium user" } },
  { id: "emb-3", collectionId: "col-1", model: "text-embedding-3-large", vector: [0.78, -0.12, 0.34, -0.56], cluster: 2, createdAt: "2024-01-15T14:20:00Z", payload: { text: "Feature request for dashboard" } },
  { id: "emb-4", collectionId: "col-2", model: "text-embedding-3-small", vector: [-0.23, 0.67, 0.45, -0.89], cluster: 0, createdAt: "2024-01-16T09:00:00Z", payload: { title: "Wireless Bluetooth Headphones" } },
  { id: "emb-5", collectionId: "col-2", model: "text-embedding-3-small", vector: [0.56, -0.34, 0.78, 0.12], cluster: 1, createdAt: "2024-01-16T10:30:00Z", payload: { title: "USB-C Charging Cable 2m" } },
  { id: "emb-6", collectionId: "col-2", model: "text-embedding-3-small", vector: [0.89, 0.45, -0.23, 0.67], cluster: 1, createdAt: "2024-01-16T12:15:00Z", payload: { title: "Portable Power Bank 10000mAh" } },
  { id: "emb-7", collectionId: "col-3", model: "text-embedding-ada-002", vector: [-0.12, 0.89, -0.56, 0.23], cluster: 0, createdAt: "2024-01-17T08:45:00Z", payload: { chunk_text: "Introduction to machine learning concepts..." } },
  { id: "emb-8", collectionId: "col-3", model: "text-embedding-ada-002", vector: [0.34, -0.67, 0.12, -0.45], cluster: 0, createdAt: "2024-01-17T09:30:00Z", payload: { chunk_text: "Supervised learning algorithms overview..." } },
  { id: "emb-9", collectionId: "col-3", model: "text-embedding-ada-002", vector: [0.67, 0.23, 0.89, -0.12], cluster: 2, createdAt: "2024-01-17T11:00:00Z", payload: { chunk_text: "Neural network architecture patterns..." } },
  { id: "emb-10", collectionId: "col-3", model: "text-embedding-ada-002", vector: [-0.45, 0.56, -0.78, 0.34], cluster: 1, createdAt: "2024-01-17T14:45:00Z", payload: { chunk_text: "Deep learning optimization techniques..." } },
  { id: "emb-11", collectionId: "col-4", model: "text-embedding-3-large", vector: [0.23, -0.89, 0.67, 0.45], cluster: 1, createdAt: "2024-01-18T10:00:00Z", payload: { user_id: "user-123", tier: "premium" } },
  { id: "emb-12", collectionId: "col-4", model: "text-embedding-3-large", vector: [-0.56, 0.12, -0.34, 0.78], cluster: 0, createdAt: "2024-01-18T11:30:00Z", payload: { user_id: "user-456", tier: "free" } },
  { id: "emb-13", collectionId: "col-4", model: "text-embedding-3-large", vector: [0.78, 0.56, -0.12, -0.67], cluster: 2, createdAt: "2024-01-18T15:00:00Z", payload: { user_id: "user-789", tier: "enterprise" } },
  { id: "emb-14", collectionId: "col-5", model: "text-embedding-3-small", vector: [0.45, -0.23, 0.89, -0.56], cluster: 0, createdAt: "2024-01-19T09:15:00Z", payload: { message: "Hello, I need help with my order", role: "user" } },
  { id: "emb-15", collectionId: "col-5", model: "text-embedding-3-small", vector: [-0.34, 0.67, -0.12, 0.89], cluster: 1, createdAt: "2024-01-19T09:20:00Z", payload: { message: "I'd be happy to help you with your order!", role: "assistant" } },
  { id: "emb-16", collectionId: "col-5", model: "text-embedding-3-small", vector: [0.12, 0.78, 0.45, -0.23], cluster: 0, createdAt: "2024-01-19T09:25:00Z", payload: { message: "Can you check the tracking number?", role: "user" } },
  { id: "emb-17", collectionId: "col-5", model: "text-embedding-3-small", vector: [0.89, -0.45, 0.67, 0.34], cluster: 1, createdAt: "2024-01-19T09:30:00Z", payload: { message: "Your order is on its way!", role: "assistant" } },
  { id: "emb-18", collectionId: "col-1", model: "text-embedding-3-large", vector: [-0.67, 0.34, -0.89, 0.12], cluster: 2, createdAt: "2024-01-20T10:00:00Z", payload: { text: "Account settings update request" } },
  { id: "emb-19", collectionId: "col-2", model: "text-embedding-3-small", vector: [0.34, 0.89, -0.56, -0.23], cluster: 0, createdAt: "2024-01-20T11:00:00Z", payload: { title: "Smart Watch Pro Series 5" } },
  { id: "emb-20", collectionId: "col-3", model: "text-embedding-ada-002", vector: [-0.89, 0.45, 0.23, -0.67], cluster: 2, createdAt: "2024-01-20T14:00:00Z", payload: { chunk_text: "Transfer learning and fine-tuning strategies..." } },
  { id: "emb-21", collectionId: "col-5", model: "text-embedding-3-small", vector: [0.56, -0.78, 0.34, 0.89], cluster: 1, createdAt: "2024-01-21T09:00:00Z", payload: { message: "Thank you for your help!", role: "user" } },
  { id: "emb-22", collectionId: "col-4", model: "text-embedding-3-large", vector: [-0.23, -0.56, 0.78, -0.45], cluster: 1, createdAt: "2024-01-21T10:30:00Z", payload: { user_id: "user-321", tier: "premium" } },
];

const sampleIndexStats: IndexStats[] = [
  { collectionId: "col-1", segments: 8, memoryUsage: "1.2 GB", indexingQueueDepth: 0, health: "healthy", lastRebuild: "2024-01-10T08:00:00Z" },
  { collectionId: "col-2", segments: 4, memoryUsage: "580 MB", indexingQueueDepth: 0, health: "healthy", lastRebuild: "2024-01-12T14:30:00Z" },
  { collectionId: "col-3", segments: 16, memoryUsage: "3.4 GB", indexingQueueDepth: 1250, health: "degraded", lastRebuild: "2024-01-08T20:00:00Z" },
  { collectionId: "col-4", segments: 3, memoryUsage: "210 MB", indexingQueueDepth: 0, health: "healthy", lastRebuild: "2024-01-15T10:00:00Z" },
  { collectionId: "col-5", segments: 12, memoryUsage: "2.8 GB", indexingQueueDepth: 45, health: "healthy", lastRebuild: "2024-01-14T16:45:00Z" },
  { collectionId: "col-6", segments: 24, memoryUsage: "4.1 GB", indexingQueueDepth: 8900, health: "critical", lastRebuild: "2024-01-05T02:00:00Z" },
];

const clusterColors: Record<number, string> = {
  0: "#6366f1", // indigo-500
  1: "#22c55e", // emerald-500
  2: "#f59e0b", // amber-500
  3: "#ec4899", // pink-500
  4: "#3b82f6", // blue-500
};

type TabType = "collections" | "embeddings" | "search" | "health";

export default function VectorDatabaseViewer(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabType>("collections");
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [embeddingCollectionFilter, setEmbeddingCollectionFilter] = useState<string>("all");
  const [embeddingModelFilter, setEmbeddingModelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchCollection, setSearchCollection] = useState<string>(sampleCollections[0]?.id || "");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const toggleCollection = (id: string): void => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCollections(newExpanded);
  };

  const filteredEmbeddings = sampleEmbeddings.filter((emb) => {
    if (embeddingCollectionFilter !== "all" && emb.collectionId !== embeddingCollectionFilter) {return false;}
    if (embeddingModelFilter !== "all" && emb.model !== embeddingModelFilter) {return false;}
    return true;
  });

  const handleSearch = (): void => {
    if (!searchQuery.trim()) {return;}
    setIsSearching(true);
    
    // Simulate search
    setTimeout(() => {
      const results: SearchResult[] = sampleEmbeddings
        .filter((emb) => emb.collectionId === searchCollection)
        .slice(0, 10)
        .map((emb, idx) => ({
          id: emb.id,
          score: Math.max(0, 1 - idx * 0.08),
          distance: idx * 0.12 + Math.random() * 0.1,
          payload: emb.payload,
        }));
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
  };

  const getHealthColor = (health: IndexStats["health"]): string => {
    switch (health) {
      case "healthy":
        return "text-emerald-400";
      case "degraded":
        return "text-amber-400";
      case "critical":
        return "text-rose-400";
    }
  };

  const getHealthBg = (health: IndexStats["health"]): string => {
    switch (health) {
      case "healthy":
        return "bg-emerald-400/10";
      case "degraded":
        return "bg-amber-400/10";
      case "critical":
        return "bg-rose-400/10";
    }
  };

  const getStatusIndicator = (status: Collection["indexStatus"]): React.ReactNode => {
    switch (status) {
      case "ready":
        return <span className="text-emerald-400">●</span>;
      case "building":
        return <span className="text-amber-400">●</span>;
      case "error":
        return <span className="text-rose-400">●</span>;
    }
  };

  const uniqueModels = Array.from(new Set(sampleEmbeddings.map((e) => e.model)));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Vector Database</h1>
          <p className="text-zinc-400">Manage collections, embeddings, and search across your vector store</p>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 mb-6 border-b border-zinc-800">
          {(["collections", "embeddings", "search", "health"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-all duration-150 border-b-2 -mb-px",
                activeTab === tab
                  ? "text-indigo-400 border-indigo-500"
                  : "text-zinc-400 border-transparent hover:text-white hover:border-zinc-600"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace("health", "Index Health").replace("search", "Search Lab")}
            </button>
          ))}
        </nav>

        {/* Collections Tab */}
        {activeTab === "collections" && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {sampleCollections.map((collection) => (
                <div
                  key={collection.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCollection(collection.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIndicator(collection.indexStatus)}
                      <div className="text-left">
                        <div className="font-medium text-white">{collection.name}</div>
                        <div className="text-xs text-zinc-500">
                          {collection.dimensions}d · {collection.distanceMetric} · {collection.vectorCount.toLocaleString()} vectors
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-zinc-400">{collection.diskSize}</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs rounded",
                          collection.indexStatus === "ready" && "bg-emerald-400/10 text-emerald-400",
                          collection.indexStatus === "building" && "bg-amber-400/10 text-amber-400",
                          collection.indexStatus === "error" && "bg-rose-400/10 text-rose-400"
                        )}
                      >
                        {collection.indexStatus}
                      </span>
                      <span className="text-zinc-500 text-xl">{expandedCollections.has(collection.id) ? "−" : "+"}</span>
                    </div>
                  </button>
                  
                  {expandedCollections.has(collection.id) && (
                    <div className="px-4 py-4 border-t border-zinc-800 bg-zinc-900/50">
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Schema */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Schema</h4>
                          <div className="space-y-1">
                            {Object.entries(collection.schema).map(([key, type]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-zinc-300">{key}</span>
                                <span className="text-zinc-500">{type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Metadata Fields */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Metadata Fields</h4>
                          <div className="flex flex-wrap gap-1">
                            {collection.metadataFields.map((field) => (
                              <span
                                key={field}
                                className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs rounded"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* Sample Vectors */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Sample Vectors</h4>
                          <div className="flex items-end gap-0.5 h-8">
                            {collection.sampleVectors.map((val, idx) => (
                              <div
                                key={idx}
                                className="w-2 rounded-sm"
                                style={{
                                  height: `${Math.abs(val) * 100}%`,
                                  backgroundColor: val >= 0 ? "#6366f1" : "#a78bfa",
                                  minHeight: "2px",
                                }}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-xs text-zinc-600 mt-1">
                            <span>-1</span>
                            <span>0</span>
                            <span>+1</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embeddings Tab */}
        {activeTab === "embeddings" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <select
                value={embeddingCollectionFilter}
                onChange={(e) => setEmbeddingCollectionFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Collections</option>
                {sampleCollections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={embeddingModelFilter}
                onChange={(e) => setEmbeddingModelFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Models</option>
                {uniqueModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-sm text-zinc-500 self-center">
                Showing {filteredEmbeddings.length} embeddings
              </span>
            </div>

            {/* Scatter Plot */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">2D Projection</h3>
              <div className="relative w-full h-64 bg-zinc-950 rounded border border-zinc-800 overflow-hidden">
                {filteredEmbeddings.map((emb, idx) => {
                  // Project to 2D using first 2 dimensions
                  const x = ((emb.vector[0] + 1) / 2) * 100;
                  const y = ((emb.vector[1] + 1) / 2) * 100;
                  return (
                    <div
                      key={emb.id}
                      className="absolute w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-150"
                      style={{
                        left: `${Math.min(96, Math.max(0, x))}%`,
                        top: `${Math.min(96, Math.max(0, y))}%`,
                        backgroundColor: clusterColors[emb.cluster] || "#6366f1",
                        transform: "translate(-50%, -50%)",
                      }}
                      title={`${emb.id} - Cluster ${emb.cluster}`}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex gap-4 mt-3 flex-wrap">
                {[0, 1, 2].map((cluster) => (
                  <div key={cluster} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: clusterColors[cluster] }}
                    />
                    <span className="text-zinc-500">Cluster {cluster}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Embeddings Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-zinc-500 font-medium">ID</th>
                      <th className="px-4 py-2 text-left text-zinc-500 font-medium">Collection</th>
                      <th className="px-4 py-2 text-left text-zinc-500 font-medium">Model</th>
                      <th className="px-4 py-2 text-left text-zinc-500 font-medium">Cluster</th>
                      <th className="px-4 py-2 text-left text-zinc-500 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmbeddings.slice(0, 15).map((emb) => (
                      <tr key={emb.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-2 text-zinc-300 font-mono text-xs">{emb.id}</td>
                        <td className="px-4 py-2 text-zinc-300">
                          {sampleCollections.find((c) => c.id === emb.collectionId)?.name || emb.collectionId}
                        </td>
                        <td className="px-4 py-2 text-zinc-400 text-xs">{emb.model}</td>
                        <td className="px-4 py-2">
                          <span
                            className="px-1.5 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: `${clusterColors[emb.cluster]}20`,
                              color: clusterColors[emb.cluster],
                            }}
                          >
                            {emb.cluster}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-zinc-500 text-xs">
                          {new Date(emb.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Search Lab Tab */}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Search Input */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter your search query..."
                  className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={searchCollection}
                  onChange={(e) => setSearchCollection(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  {sampleCollections.filter((c) => c.indexStatus === "ready").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-400">
                    {searchResults.length} results found
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-zinc-500 font-medium">ID</th>
                        <th className="px-4 py-2 text-left text-zinc-500 font-medium">Similarity</th>
                        <th className="px-4 py-2 text-left text-zinc-500 font-medium">Distance</th>
                        <th className="px-4 py-2 text-left text-zinc-500 font-medium">Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((result) => (
                        <tr key={result.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{result.id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-zinc-800 rounded overflow-hidden">
                                <div
                                  className="h-full bg-indigo-500"
                                  style={{ width: `${result.score * 100}%` }}
                                />
                              </div>
                              <span className="text-zinc-400 text-xs">{result.score.toFixed(3)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{result.distance.toFixed(4)}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs max-w-xs truncate">
                            {JSON.stringify(result.payload)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !isSearching && (
              <div className="text-center py-12 text-zinc-500">
                No results found. Try a different query.
              </div>
            )}

            {searchResults.length === 0 && !searchQuery && (
              <div className="text-center py-12 text-zinc-500">
                Enter a search query to find similar vectors
              </div>
            )}
          </div>
        )}

        {/* Index Health Tab */}
        {activeTab === "health" && (
          <div className="space-y-6">
            <div className="grid gap-4">
              {sampleIndexStats.map((stats) => {
                const collection = sampleCollections.find((c) => c.id === stats.collectionId);
                return (
                  <div
                    key={stats.collectionId}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-white">{collection?.name || stats.collectionId}</h3>
                        <p className="text-xs text-zinc-500">
                          Last rebuild: {new Date(stats.lastRebuild).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-1 text-xs rounded font-medium",
                          getHealthBg(stats.health),
                          getHealthColor(stats.health)
                        )}
                      >
                        {stats.health}
                      </span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider">Segments</div>
                        <div className="text-lg font-medium text-white">{stats.segments}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider">Memory</div>
                        <div className="text-lg font-medium text-white">{stats.memoryUsage}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider">Queue Depth</div>
                        <div className="text-lg font-medium text-white">{stats.indexingQueueDepth.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider">Status</div>
                        <div className={cn("text-lg font-medium", getHealthColor(stats.health))}>
                          {collection?.indexStatus || "unknown"}
                        </div>
                      </div>
                    </div>

                    {/* Queue Depth Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-500">Indexing Queue</span>
                        <span className="text-zinc-400">{stats.indexingQueueDepth.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            stats.indexingQueueDepth === 0 ? "bg-emerald-500" :
                            stats.indexingQueueDepth < 1000 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${Math.min(100, (stats.indexingQueueDepth / 10000) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Rebuild Button */}
                    <button
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded transition-colors"
                    >
                      Rebuild Index
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Overall Health</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">
                    {sampleIndexStats.filter((s) => s.health === "healthy").length}
                  </div>
                  <div className="text-xs text-zinc-500">Healthy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">
                    {sampleIndexStats.filter((s) => s.health === "degraded").length}
                  </div>
                  <div className="text-xs text-zinc-500">Degraded</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-rose-400">
                    {sampleIndexStats.filter((s) => s.health === "critical").length}
                  </div>
                  <div className="text-xs text-zinc-500">Critical</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
