import type { GraphitiClient } from "../graphiti/client.js";
import type { MemoryContentObject } from "../types.js";
import { isGraphitiAvailable } from "../graphiti/health-probe.js";

export type GraphWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export async function writeEpisodesToGraph(params: {
  episodes: MemoryContentObject[];
  client?: GraphitiClient;
}): Promise<{ warnings: GraphWarning[] }> {
  const warnings: GraphWarning[] = [];
  const { episodes, client } = params;

  if (!client) {
    warnings.push({
      code: "graph.missing_adapter",
      message: "Graphiti adapter is not configured; skipping graph write stage.",
    });
    return { warnings };
  }

  if (!isGraphitiAvailable()) {
    warnings.push({
      code: "graph.service_unavailable",
      message: "Graphiti marked unavailable by health probe; skipping graph write.",
    });
    return { warnings };
  }

  const response = await client.ingestEpisodes({ episodes });
  if (!response.ok) {
    warnings.push({
      code: "graph.write_failed",
      message: response.error ?? "Graph ingest failed.",
      details: { nodeCount: response.nodeCount, edgeCount: response.edgeCount },
    });
  }

  return { warnings };
}
