import type { ThinkLevel } from "../../auto-reply/thinking.js";

/**
 * Complexity levels for intent classification.
 * Maps to the depth of reasoning required to handle the request.
 */
export type IntentComplexity = "trivial" | "simple" | "moderate" | "complex" | "expert";

/**
 * Domain classification for the incoming message.
 */
export type IntentDomain =
  | "chat" // General conversation, greetings, simple questions
  | "code" // Code-related tasks (write, debug, review, explain)
  | "analysis" // Data analysis, research, comparison
  | "creative" // Creative writing, brainstorming, ideation
  | "ops" // Operations, infra, system management
  | "unknown"; // Unclassified

/**
 * Estimated context requirements.
 */
export type ContextLevel = "low" | "medium" | "high";

/**
 * Result of intent classification.
 */
export interface IntentClassification {
  /** Complexity level of the request */
  complexity: IntentComplexity;
  /** Domain/area the request pertains to */
  domain: IntentDomain;
  /** Whether the request likely requires tool use */
  requiresTools: boolean;
  /** Estimated context level needed */
  contextLevel: ContextLevel;
  /** Confidence score (0-1) */
  confidence: number;
  /** Key signals that led to this classification */
  signals: string[];
}

/**
 * Model routing decision.
 */
export interface ModelRouting {
  /** Provider ID (e.g., "anthropic", "openai") */
  provider: string;
  /** Model ID (e.g., "claude-opus-4-20250514") */
  model: string;
  /** Thinking level to use */
  thinkLevel: ThinkLevel;
  /** Reasoning level to use */
  reasoningLevel: "off" | "on" | "stream";
  /** Whether this routing was determined dynamically */
  isDynamic: boolean;
}

/**
 * Rules-based intent classifier.
 * Uses pattern matching and heuristics to classify incoming messages.
 * This is Phase 1 - fast, no API call required.
 */
export class IntentClassifier {
  // Patterns for complexity assessment
  private static readonly TRIVIAL_PATTERNS = [
    /^(hi|hello|hey|yo|sup|howdy|what'?s up|greetings?)\s*[$!.,]?\s*$/i,
    /^(thanks?|thank you|thx|ty|cheers)\s*[$!.,]?\s*$/i,
    /^(ok|okay|okk|cool|nice|great|awesome|perfect|sure|yes|no|nah)\s*[$!.,]?\s*$/i,
    /^\?$/,
    /^[:;]-?\)\s*$/,
    /^[:;]-?\(\s*$/,
  ];

  private static readonly SIMPLE_PATTERNS = [
    /^(what time|what'?s the time|what date|what day|what'?s the date)\s*is (it|today)\s*[$!.,]?\s*$/i,
    /^(who are you|what are you|what is your name|tell me about yourself)\s*[$!.,]?\s*$/i,
    /^(help|commands?|what can you do)\s*[$!.,]?\s*$/i,
    /^(ping|echo|test)\s*[$!.,]?\s*$/i,
    /^quick\s+(question|ask)/i,
    /^(can you|could you|would you|will you)\s+\w+(\s+\w+)?\s*[$!.,]?\s*$/i,
  ];

  private static readonly COMPLEX_PATTERNS = [
    /design\s+(an?|the)\s+architecture/i,
    /^(create|build|implement|develop)\s+(a\s+)?(new\s+)?(system|platform|framework|architecture)/i,
    /refactor(ing)?\s+(the\s+)?(entire|whole|complex)/i,
    /(multi-step|multi-step|step-by-step)\s+(workflow|process|procedure)/i,
    /(security|authentication|authorization)\s+(audit|review|assessment)/i,
    /^(write|create|generate)\s+(a\s+)?(comprehensive|complete|full)\s+(spec|specification)/i,
  ];

  private static readonly EXPERT_PATTERNS = [
    /^(analyze|review|audit)\s+(the\s+)?entire\s+(codebase|system|architecture)/i,
    /^(create|design|architect)\s+(a\s+)?(distributed|microservice|multi-tenant)/i,
    /^(solve|fix|resolve)\s+(this\s+)?(critical|complex|intricate)\s+(bug|issue|problem)/i,
    /^(research|investigate)\s+(and\s+)?(recommend|propose|design)/i,
    /benchmark\s+performance/i,
    /optimize\s+(for\s+)?(scale|latency|throughput)/i,
  ];

  // Patterns for domain classification
  private static readonly CODE_PATTERNS = [
    /\b(function|class|method|variable|const|let|var|import|export|async|await)\b/,
    /\b(code|program|script|debug|test|bug|error|exception|fix)\b/i,
    /\b(write|create|generate|implement|refactor)\s+(code|function|class|script)\b/i,
    /\.(js|ts|py|rs|go|java|cpp|c|h|rb|php|swift|kt)\b/,
    /`[^`]+`/,
    /```[\s\S]+```/,
    /\b(git|github|pull request|commit|branch|merge|diff)\b/i,
    /\b(api|rest|endpoint|http|json|xml)\b/i,
  ];

  private static readonly OPS_PATTERNS = [
    /\b(deploy|server|docker|kubernetes|k8s|pod|container)\b/i,
    /\b(install|configure|setup|init|initiate)\s+(server|docker|kubernetes)/i,
    /\b(monitor|logs?|metrics|alert|alerting)\b/i,
    /\b(database|db|postgres|mysql|mongodb|redis|cache)\b/i,
    /\b(backup|restore|recovery|disaster|failover)\b/i,
    /\b(security|firewall|ssl|tls|certificate|auth)\b/i,
    /\b(infrastructure|infra|terraform|ansible|puppet)\b/i,
  ];

  private static readonly ANALYSIS_PATTERNS = [
    /\b(analyze|analysis|analyse|review|examine|investigate)\b/i,
    /\b(compare|comparison|versus|vs)\b/i,
    /\b(data|statistics|metrics|report|insights?)\b/i,
    /\b(research|study|findings?|recommend)\b/i,
    /\b(why|how|explain|reason)\s+(does|do|is|are|would|should|could|this|that|the)\b/i,
    /\b(what if|scenario|implications?|impact)\b/i,
  ];

  private static readonly CREATIVE_PATTERNS = [
    /\b(brainstorm|ideate|creative|imagine|invent)\b/i,
    /\b(story|poem|article|blog|content|narrative)\b/i,
    /\b(design|concept|prototype|mockup)\b/i,
    /\b(suggest|recommend|ideas?|thoughts?)\b/i,
    /\b(write|create|generate)\s+(a\s+)?(story|poem|joke|script)/i,
  ];

  // Patterns indicating tool requirements
  private static readonly TOOL_PATTERNS = [
    /\b(run|execute|exec)\s+(command|shell|bash|terminal|tests?|script)/i,
    /\b(search|find|look up)\s+(for|in)\b/i,
    /\b(read|show|get|list)\s+(the\s+)?(file|directory|folder|doc|config|content)/i,
    /\b(write|create|edit|modify|delete|update)\s+(file|directory|code)/i,
    /\b(send|message|email|notify)\b/i,
    /\b(browse|crawl|scrape|fetch)\s+(web|page|website)/i,
    /\b(create|make|generate)\s+(image|picture|photo)/i,
    /\b(get|retrieve|fetch|download)\s+(file|data|info)/i,
    /\b(call|invoke|trigger)\s+(api|function|tool)/i,
    /\brun\s+the\s+(test|build|command)/i,
    /\b(check|verify|validate)\s+(the\s+)?(file|code|config)/i,
  ];

  // Length thresholds
  private static readonly SHORT_LENGTH = 50;
  private static readonly MEDIUM_LENGTH = 200;
  private static readonly LONG_LENGTH = 500;

  /**
   * Classify the intent of an incoming message.
   */
  classify(prompt: string): IntentClassification {
    const trimmed = prompt.trim();
    const signals: string[] = [];
    let confidence = 0.5;

    // Step 1: Detect complexity
    const complexity = this.detectComplexity(trimmed, signals);
    if (complexity !== "moderate") {
      confidence += 0.2;
    }

    // Step 2: Detect domain
    const domain = this.detectDomain(trimmed, signals);
    if (domain !== "unknown") {
      confidence += 0.15;
    }

    // Step 3: Detect tool requirements
    const requiresTools = this.detectToolRequirement(trimmed, signals);

    // Step 4: Estimate context level
    const contextLevel = this.estimateContextLevel(trimmed, complexity);

    // Adjust confidence based on signal count
    confidence = Math.min(0.95, confidence + signals.length * 0.02);

    return {
      complexity,
      domain,
      requiresTools,
      contextLevel,
      confidence,
      signals,
    };
  }

  private detectComplexity(prompt: string, signals: string[]): IntentComplexity {
    // Check for trivial patterns first
    for (const pattern of IntentClassifier.TRIVIAL_PATTERNS) {
      if (pattern.test(prompt)) {
        signals.push("matched trivial pattern");
        return "trivial";
      }
    }

    // Check for simple patterns
    for (const pattern of IntentClassifier.SIMPLE_PATTERNS) {
      if (pattern.test(prompt)) {
        signals.push("matched simple pattern");
        return "simple";
      }
    }

    // Check for expert patterns (high confidence complex)
    for (const pattern of IntentClassifier.EXPERT_PATTERNS) {
      if (pattern.test(prompt)) {
        signals.push("matched expert pattern");
        return "expert";
      }
    }

    // Check for complex patterns
    for (const pattern of IntentClassifier.COMPLEX_PATTERNS) {
      if (pattern.test(prompt)) {
        signals.push("matched complex pattern");
        return "complex";
      }
    }

    // Fall back to length-based heuristics
    const length = prompt.length;
    if (length < IntentClassifier.SHORT_LENGTH) {
      signals.push("short prompt length");
      return "simple";
    }

    if (length > IntentClassifier.LONG_LENGTH) {
      signals.push("long prompt length");
      return "complex";
    }

    if (length > IntentClassifier.MEDIUM_LENGTH) {
      signals.push("medium prompt length");
      return "moderate";
    }

    // Check for question marks (often indicates simple queries)
    const questionCount = (prompt.match(/\?/g) || []).length;
    if (questionCount > 2) {
      signals.push("multiple questions detected");
      return "moderate";
    }

    if (questionCount === 1 && length < IntentClassifier.SHORT_LENGTH) {
      signals.push("single short question");
      return "simple";
    }

    return "moderate";
  }

  private detectDomain(prompt: string, signals: string[]): IntentDomain {
    let codeScore = 0;
    let opsScore = 0;
    let analysisScore = 0;
    let creativeScore = 0;

    for (const pattern of IntentClassifier.CODE_PATTERNS) {
      if (pattern.test(prompt)) {
        codeScore++;
      }
    }

    for (const pattern of IntentClassifier.OPS_PATTERNS) {
      if (pattern.test(prompt)) {
        opsScore++;
      }
    }

    for (const pattern of IntentClassifier.ANALYSIS_PATTERNS) {
      if (pattern.test(prompt)) {
        analysisScore++;
      }
    }

    for (const pattern of IntentClassifier.CREATIVE_PATTERNS) {
      if (pattern.test(prompt)) {
        creativeScore++;
      }
    }

    const scores = [
      { domain: "code" as IntentDomain, score: codeScore },
      { domain: "ops" as IntentDomain, score: opsScore },
      { domain: "analysis" as IntentDomain, score: analysisScore },
      { domain: "creative" as IntentDomain, score: creativeScore },
    ];

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    if (scores[0].score > 0) {
      signals.push(`domain: ${scores[0].domain} (score: ${scores[0].score})`);
      return scores[0].domain;
    }

    // Default to chat for unrecognized
    signals.push("domain: chat (default)");
    return "chat";
  }

  private detectToolRequirement(prompt: string, signals: string[]): boolean {
    for (const pattern of IntentClassifier.TOOL_PATTERNS) {
      if (pattern.test(prompt)) {
        signals.push("matched tool pattern");
        return true;
      }
    }
    return false;
  }

  private estimateContextLevel(prompt: string, complexity: IntentComplexity): ContextLevel {
    const length = prompt.length;

    switch (complexity) {
      case "trivial":
      case "simple":
        return "low";
      case "moderate":
        if (length > IntentClassifier.LONG_LENGTH) {
          return "medium";
        }
        return "low";
      case "complex":
        if (length > IntentClassifier.LONG_LENGTH * 2) {
          return "high";
        }
        return "medium";
      case "expert":
        return "high";
    }
  }
}

/**
 * Default routing rules based on complexity.
 * Maps complexity to provider/model/thinking level.
 */
export interface RoutingRule {
  complexity: IntentComplexity;
  provider: string;
  model: string;
  thinkLevel: ThinkLevel;
  reasoningLevel: "off" | "on" | "stream";
}

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    complexity: "trivial",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    thinkLevel: "off",
    reasoningLevel: "off",
  },
  {
    complexity: "simple",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    thinkLevel: "off",
    reasoningLevel: "off",
  },
  {
    complexity: "moderate",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    thinkLevel: "low",
    reasoningLevel: "off",
  },
  {
    complexity: "complex",
    provider: "anthropic",
    model: "claude-opus-4-20250514",
    thinkLevel: "medium",
    reasoningLevel: "stream",
  },
  {
    complexity: "expert",
    provider: "anthropic",
    model: "claude-opus-4-20250514",
    thinkLevel: "high",
    reasoningLevel: "stream",
  },
];

/**
 * Dynamic model router.
 * Uses intent classification to route to the optimal model/thinking level.
 */
export class DynamicModelRouter {
  private rules: RoutingRule[];
  private enabled: boolean;
  private fallbackProvider: string;
  private fallbackModel: string;
  private fallbackThinkLevel: ThinkLevel;

  constructor(options?: {
    rules?: RoutingRule[];
    enabled?: boolean;
    fallbackProvider?: string;
    fallbackModel?: string;
    fallbackThinkLevel?: ThinkLevel;
  }) {
    this.rules = options?.rules ?? DEFAULT_ROUTING_RULES;
    this.enabled = options?.enabled ?? true;
    this.fallbackProvider = options?.fallbackProvider ?? "anthropic";
    this.fallbackModel = options?.fallbackModel ?? "claude-opus-4-20250514";
    this.fallbackThinkLevel = options?.fallbackThinkLevel ?? "medium";
  }

  /**
   * Whether dynamic routing is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable dynamic routing.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Route to a model based on intent classification.
   */
  route(classification: IntentClassification): ModelRouting {
    // Find matching rule
    const rule = this.rules.find((r) => r.complexity === classification.complexity);

    if (rule) {
      return {
        provider: rule.provider,
        model: rule.model,
        thinkLevel: rule.thinkLevel,
        reasoningLevel: rule.reasoningLevel,
        isDynamic: true,
      };
    }

    // Fallback
    return {
      provider: this.fallbackProvider,
      model: this.fallbackModel,
      thinkLevel: this.fallbackThinkLevel,
      reasoningLevel: "stream",
      isDynamic: false,
    };
  }

  /**
   * Classify and route in one call.
   */
  classifyAndRoute(prompt: string): ModelRouting {
    const classifier = new IntentClassifier();
    const classification = classifier.classify(prompt);
    return this.route(classification);
  }

  /**
   * Add or update a routing rule.
   */
  setRule(rule: RoutingRule): void {
    const index = this.rules.findIndex((r) => r.complexity === rule.complexity);
    if (index >= 0) {
      this.rules[index] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Get current routing rules.
   */
  getRules(): RoutingRule[] {
    return [...this.rules];
  }
}

// Singleton instance for convenience
let _classifier: IntentClassifier | null = null;
let _router: DynamicModelRouter | null = null;

/**
 * Get the singleton IntentClassifier instance.
 */
export function getIntentClassifier(): IntentClassifier {
  if (!_classifier) {
    _classifier = new IntentClassifier();
  }
  return _classifier;
}

/**
 * Get the singleton DynamicModelRouter instance.
 */
export function getDynamicModelRouter(): DynamicModelRouter {
  if (!_router) {
    _router = new DynamicModelRouter();
  }
  return _router;
}

/**
 * Convenience function to classify and route in one call.
 */
export function classifyAndRoute(prompt: string): ModelRouting {
  return getDynamicModelRouter().classifyAndRoute(prompt);
}
