import { describe, it, expect } from "vitest";
import type { MemoryContentObject } from "../types.js";
import {
  extractEntitiesFromEpisodes,
  writeEntitiesToGraph,
  type ExtractedEntity,
  type EntityExtractorConfig,
} from "./entity-extract.js";

function makeEpisode(id: string, text: string): MemoryContentObject {
  return {
    id,
    kind: "episode",
    text,
    provenance: { source: "test" },
  };
}

describe("extractEntitiesFromEpisodes", () => {
  it("extracts technology entities", () => {
    const episodes = [
      makeEpisode(
        "ep1",
        "We use TypeScript and React for the frontend with Node.js for the backend.",
      ),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    expect(result.entities.length).toBeGreaterThan(0);
    const names = result.entities.map((e) => e.name.toLowerCase());
    expect(names).toContain("typescript");
    expect(names).toContain("react");
    // Node.js uses escaped regex pattern
    expect(names.some((n) => n.includes("node"))).toBe(true);
    expect(result.entities.every((e) => e.type === "Technology")).toBe(true);
  });

  it("extracts person entities from @mentions", () => {
    const episodes = [
      makeEpisode("ep2", "Talked to @dgarson about the new feature and asked @sarah for review."),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    const people = result.entities.filter((e) => e.type === "Person");
    const names = people.map((e) => e.name.toLowerCase());
    expect(names).toContain("dgarson");
    expect(names).toContain("sarah");
  });

  it("extracts person entities from conversational patterns", () => {
    const episodes = [
      makeEpisode(
        "ep3",
        "Had a meeting with David about the architecture. Told Sarah to prioritize the tests.",
      ),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    const people = result.entities.filter((e) => e.type === "Person");
    const names = people.map((e) => e.name);
    expect(names).toContain("David");
    expect(names).toContain("Sarah");
  });

  it("extracts project references", () => {
    const episodes = [
      makeEpisode(
        "ep4",
        "Opened PR #147 on the repo clawdbrain and created a branch feature/entity-extraction.",
      ),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    const projects = result.entities.filter((e) => e.type === "Project");
    expect(projects.length).toBeGreaterThan(0);
  });

  it("extracts GitHub URLs as projects", () => {
    const episodes = [
      makeEpisode("ep5", "Check out https://github.com/dgarson/clawdbrain for the latest code."),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    const projects = result.entities.filter((e) => e.type === "Project");
    expect(projects.some((p) => p.name.includes("dgarson/clawdbrain"))).toBe(true);
    expect(projects[0].properties?.url).toContain("github.com");
  });

  it("deduplicates entities", () => {
    const episodes = [
      makeEpisode(
        "ep6",
        "TypeScript is great. We love TypeScript. TypeScript TypeScript TypeScript.",
      ),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    const tsEntities = result.entities.filter((e) => e.name.toLowerCase() === "typescript");
    expect(tsEntities.length).toBe(1);
  });

  it("returns empty when disabled", () => {
    const episodes = [makeEpisode("ep7", "TypeScript and React are great technologies.")];
    const result = extractEntitiesFromEpisodes(episodes, { enabled: false });
    expect(result.entities).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("entity_extract.disabled");
  });

  it("skips short text below minTextLength", () => {
    const episodes = [makeEpisode("ep8", "short")];
    const result = extractEntitiesFromEpisodes(episodes, { minTextLength: 20 });
    expect(result.entities).toHaveLength(0);
  });

  it("respects maxEntitiesPerEpisode", () => {
    const longText = TECHNOLOGY_NAMES_FOR_TEST.join(" and ") + " are all great.";
    const episodes = [makeEpisode("ep9", longText)];
    const result = extractEntitiesFromEpisodes(episodes, {
      maxEntitiesPerEpisode: 3,
    });
    expect(result.entities.length).toBeLessThanOrEqual(3);
  });

  it("infers relations between co-occurring entities", () => {
    const episodes = [
      makeEpisode(
        "ep10",
        "The project clawdbrain uses TypeScript and React. @dgarson works on it.",
      ),
    ];
    const result = extractEntitiesFromEpisodes(episodes);
    expect(result.relations.length).toBeGreaterThan(0);

    // Check for USES relations
    const usesRelations = result.relations.filter((r) => r.relation === "USES");
    expect(usesRelations.length).toBeGreaterThan(0);
  });

  it("supports custom patterns", () => {
    const episodes = [makeEpisode("ep11", "The JIRA ticket PROJ-1234 needs attention.")];
    const config: EntityExtractorConfig = {
      customPatterns: [
        {
          type: "Event",
          pattern: /\b([A-Z]+-\d+)\b/g,
          nameGroup: 1,
        },
      ],
    };
    const result = extractEntitiesFromEpisodes(episodes, config);
    const events = result.entities.filter((e) => e.type === "Event");
    expect(events.some((e) => e.name === "PROJ-1234")).toBe(true);
  });

  it("handles empty episodes array", () => {
    const result = extractEntitiesFromEpisodes([]);
    expect(result.entities).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles episodes with no text", () => {
    const episodes: MemoryContentObject[] = [{ id: "ep12", kind: "episode", text: undefined }];
    const result = extractEntitiesFromEpisodes(episodes);
    expect(result.entities).toHaveLength(0);
  });
});

describe("writeEntitiesToGraph", () => {
  it("warns when no client is configured", async () => {
    const entities: ExtractedEntity[] = [
      {
        name: "TypeScript",
        type: "Technology",
        sourceEpisodeId: "ep1",
      },
    ];
    const result = await writeEntitiesToGraph({
      entities,
      relations: [],
      client: undefined,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("entity_extract.no_client");
  });

  it("returns no warnings when entities is empty", async () => {
    const result = await writeEntitiesToGraph({
      entities: [],
      relations: [],
      client: undefined,
    });
    expect(result.warnings).toHaveLength(0);
  });
});

// A subset of tech names for testing maxEntitiesPerEpisode
const TECHNOLOGY_NAMES_FOR_TEST = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "React",
  "Vue",
  "Angular",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "Redis",
  "MongoDB",
  "GraphQL",
];
