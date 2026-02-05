export type TimeHint = {
  phrase: string;
  type: "relative" | "absolute";
  unit?: "day" | "week" | "month" | "year";
  offset?: number;
  date?: string;
};

export type QueryIntent = {
  entities: string[];
  topics: string[];
  timeHints: TimeHint[];
};

type Indexed<T> = {
  index: number;
  value: T;
};

const STOPWORD_ENTITIES = new Set([
  "a",
  "about",
  "and",
  "are",
  "around",
  "compare",
  "did",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "last",
  "me",
  "next",
  "on",
  "please",
  "previous",
  "show",
  "summarize",
  "tell",
  "that",
  "the",
  "this",
  "today",
  "topic",
  "topics",
  "we",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
  "yesterday",
]);

const MONTHS = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

const TOPIC_KEYWORDS = ["about", "regarding", "related to", "topic", "topics", "re"];

const TIME_HINT_PATTERNS: Array<{
  regex: RegExp;
  toHint: (match: RegExpExecArray) => TimeHint;
}> = [
  {
    regex: /\b(yesterday|today|tonight)\b/gi,
    toHint: (match) => ({
      phrase: match[0].toLowerCase(),
      type: "relative",
      unit: "day",
      offset: match[0].toLowerCase() === "yesterday" ? -1 : 0,
    }),
  },
  {
    regex: /\b(last|past|previous)\s+(week|month|year)\b/gi,
    toHint: (match) => ({
      phrase: match[0].toLowerCase(),
      type: "relative",
      unit: match[2].toLowerCase() as "week" | "month" | "year",
      offset: -1,
    }),
  },
  {
    regex: /\bthis\s+(week|month|year)\b/gi,
    toHint: (match) => ({
      phrase: match[0].toLowerCase(),
      type: "relative",
      unit: match[1].toLowerCase() as "week" | "month" | "year",
      offset: 0,
    }),
  },
  {
    regex:
      /\b(?:in\s+the\s+)?(last|past|previous)\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)\b/gi,
    toHint: (match) => ({
      phrase: match[0].toLowerCase(),
      type: "relative",
      unit: normalizeUnit(match[3]),
      offset: -Number(match[2]),
    }),
  },
  {
    regex: /\bnext\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)\b/gi,
    toHint: (match) => ({
      phrase: match[0].toLowerCase(),
      type: "relative",
      unit: normalizeUnit(match[2]),
      offset: Number(match[1]),
    }),
  },
  {
    regex: /\b(20\d{2}-\d{2}-\d{2})\b/g,
    toHint: (match) => ({
      phrase: match[0],
      type: "absolute",
      date: match[0],
    }),
  },
];

export const parseQueryIntent = (prompt: string): QueryIntent => {
  const entities = extractEntities(prompt);
  const topics = extractTopics(prompt);
  const timeHints = extractTimeHints(prompt);

  return {
    entities,
    topics,
    timeHints,
  };
};

const extractEntities = (prompt: string): string[] => {
  const candidates: Array<Indexed<string>> = [];

  const quotedPatterns = [/"([^"]+)"/g, /'([^']+)'/g, /`([^`]+)`/g];
  for (const pattern of quotedPatterns) {
    for (const match of prompt.matchAll(pattern)) {
      if (match.index === undefined) {
        continue;
      }
      const value = match[1].trim();
      if (value) {
        candidates.push({ index: match.index, value });
      }
    }
  }

  const pathPattern = /\b(?:[\w.-]+\/)+[\w.-]+\b/g;
  for (const match of prompt.matchAll(pathPattern)) {
    if (match.index === undefined) {
      continue;
    }
    candidates.push({ index: match.index, value: match[0] });
  }

  const multiWordProper = /\b[A-Z][\w-]*(?:\s+[A-Z][\w-]*)+\b/g;
  for (const match of prompt.matchAll(multiWordProper)) {
    if (match.index === undefined) {
      continue;
    }
    candidates.push({ index: match.index, value: match[0] });
  }

  const singleProper = /\b(?:[A-Z][a-z]+[A-Z][\w]+|[A-Z]{2,})\b/g;
  for (const match of prompt.matchAll(singleProper)) {
    if (match.index === undefined) {
      continue;
    }
    candidates.push({ index: match.index, value: match[0] });
  }

  return dedupeByAppearance(candidates, (value) => value.toLowerCase()).filter((entity) => {
    const normalized = entity.toLowerCase();
    if (STOPWORD_ENTITIES.has(normalized)) {
      return false;
    }
    if (MONTHS.has(normalized)) {
      return false;
    }
    return true;
  });
};

const extractTopics = (prompt: string): string[] => {
  const candidates: Array<Indexed<string>> = [];

  for (const match of prompt.matchAll(/#([\w-]+)/g)) {
    if (match.index === undefined) {
      continue;
    }
    candidates.push({ index: match.index, value: match[1].toLowerCase() });
  }

  const topicPattern = new RegExp(
    `\\b(?:${TOPIC_KEYWORDS.map((keyword) => keyword.replace(/\s+/g, "\\s+")).join("|")})\\s+([^.?;!]+)`,
    "gi",
  );

  for (const match of prompt.matchAll(topicPattern)) {
    if (match.index === undefined) {
      continue;
    }
    const topicPhrase = match[1].trim().replace(/[,:]$/, "").replace(/\s+/g, " ");

    const splitTopics = topicPhrase
      .split(/\s+and\s+/i)
      .map((topic) => normalizeTopic(topic))
      .filter(Boolean);

    splitTopics.forEach((topic, offset) => {
      candidates.push({
        index: match.index + offset,
        value: topic.toLowerCase(),
      });
    });
  }

  return dedupeByAppearance(candidates, (value) => value.toLowerCase());
};

const normalizeTopic = (topic: string): string => {
  return topic
    .replace(/^\btopics?\b\s*/i, "")
    .replace(/#\w+/g, "")
    .replace(/\b(?:in|during|over|for)\s+(?:the\s+)?(?:last|past|previous|next|this)\b.*$/i, "")
    .replace(
      /\b(?:last|past|previous|next|this)\s+(?:\d+\s+)?(?:day|week|month|year|days|weeks|months|years)\b.*$/i,
      "",
    )
    .replace(/\b(?:yesterday|today|tonight)\b.*$/i, "")
    .replace(/[,:]$/, "")
    .trim()
    .toLowerCase();
};

const extractTimeHints = (prompt: string): TimeHint[] => {
  const candidates: Array<Indexed<TimeHint>> = [];

  for (const { regex, toHint } of TIME_HINT_PATTERNS) {
    for (const match of prompt.matchAll(regex)) {
      if (match.index === undefined) {
        continue;
      }
      candidates.push({ index: match.index, value: toHint(match) });
    }
  }

  const deduped = dedupeByAppearance(candidates, (value) => value.phrase.toLowerCase());
  return deduped.map((hint) => ({ ...hint, phrase: hint.phrase.toLowerCase() }));
};

const normalizeUnit = (unit: string): "day" | "week" | "month" | "year" => {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("day")) {
    return "day";
  }
  if (normalized.startsWith("week")) {
    return "week";
  }
  if (normalized.startsWith("month")) {
    return "month";
  }
  return "year";
};

const dedupeByAppearance = <T>(values: Array<Indexed<T>>, keyFn: (value: T) => string): T[] => {
  const seen = new Set<string>();
  return values
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter((entry) => {
      const key = keyFn(entry.value);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((entry) => entry.value);
};
