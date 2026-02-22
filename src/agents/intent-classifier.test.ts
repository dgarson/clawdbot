import { describe, it, expect } from "vitest";
import {
  IntentClassifier,
  DynamicModelRouter,
  classifyAndRoute,
  DEFAULT_ROUTING_RULES,
} from "./intent-classifier.js";

describe("IntentClassifier", () => {
  const classifier = new IntentClassifier();

  describe("trivial complexity", () => {
    it("classifies greetings as trivial", () => {
      const result = classifier.classify("Hi!");
      expect(result.complexity).toBe("trivial");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it("classifies thanks as trivial", () => {
      const result = classifier.classify("Thanks!");
      expect(result.complexity).toBe("trivial");
    });

    it("classifies simple acknowledgments as trivial", () => {
      const result = classifier.classify("okay");
      expect(result.complexity).toBe("trivial");
    });
  });

  describe("simple complexity", () => {
    it("classifies 'what time is it' as simple", () => {
      const result = classifier.classify("What time is it?");
      expect(result.complexity).toBe("simple");
    });

    it("classifies 'help' as simple", () => {
      const result = classifier.classify("help");
      expect(result.complexity).toBe("simple");
    });

    it("classifies 'what are you' as simple", () => {
      const result = classifier.classify("What are you?");
      expect(result.complexity).toBe("simple");
    });
  });

  describe("complexity detection", () => {
    it("classifies architecture design as complex", () => {
      const result = classifier.classify(
        "Design an architecture for a new microservices platform with authentication and monitoring",
      );
      expect(result.complexity).toBe("complex");
    });

    it("classifies multi-step workflow as complex", () => {
      const result = classifier.classify(
        "Create a multi-step workflow that processes user data, validates it, and stores it in the database",
      );
      expect(result.complexity).toBe("complex");
    });

    it("classifies expert-level tasks", () => {
      const result = classifier.classify(
        "Analyze the entire codebase for security vulnerabilities and recommend fixes",
      );
      expect(result.complexity).toBe("expert");
    });

    it("classifies expert performance benchmark", () => {
      const result = classifier.classify(
        "Benchmark performance of the distributed cache system and optimize for latency",
      );
      expect(result.complexity).toBe("expert");
    });
  });

  describe("domain detection", () => {
    it("detects code domain", () => {
      const result = classifier.classify("Write a function to calculate fibonacci numbers");
      expect(result.domain).toBe("code");
    });

    it("detects ops domain", () => {
      const result = classifier.classify("Deploy this to kubernetes with docker");
      expect(result.domain).toBe("ops");
    });

    it("detects analysis domain", () => {
      const result = classifier.classify(
        "Analyze the performance metrics and compare with last month",
      );
      expect(result.domain).toBe("analysis");
    });

    it("detects creative domain", () => {
      const result = classifier.classify("Brainstorm ideas for a new marketing campaign");
      expect(result.domain).toBe("creative");
    });

    it("defaults to chat domain for simple greetings", () => {
      const result = classifier.classify("Hello there!");
      expect(result.domain).toBe("chat");
    });
  });

  describe("tool requirement detection", () => {
    it("detects tool requirement for file operations", () => {
      const result = classifier.classify("Read the config file and show me its contents");
      expect(result.requiresTools).toBe(true);
    });

    it("detects tool requirement for commands", () => {
      const result = classifier.classify("Run the tests in the terminal");
      expect(result.requiresTools).toBe(true);
    });

    it("detects no tool requirement for simple questions", () => {
      const result = classifier.classify("What is the capital of France?");
      expect(result.requiresTools).toBe(false);
    });
  });

  describe("context level estimation", () => {
    it("estimates low context for trivial queries", () => {
      const result = classifier.classify("Hi!");
      expect(result.contextLevel).toBe("low");
    });

    it("estimates high context for expert tasks", () => {
      const result = classifier.classify(
        "Analyze the entire codebase for security vulnerabilities and provide a comprehensive report",
      );
      expect(result.contextLevel).toBe("high");
    });
  });

  describe("signals", () => {
    it("includes classification signals", () => {
      const result = classifier.classify("Write a function to add two numbers");
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });
});

describe("DynamicModelRouter", () => {
  const router = new DynamicModelRouter();

  describe("routing", () => {
    it("routes trivial queries to Sonnet without thinking", () => {
      const result = router.classifyAndRoute("Hi!");
      expect(result.model).toContain("sonnet");
      expect(result.thinkLevel).toBe("off");
      expect(result.isDynamic).toBe(true);
    });

    it("routes simple queries to Sonnet without thinking", () => {
      const result = router.classifyAndRoute("What time is it?");
      expect(result.model).toContain("sonnet");
      expect(result.thinkLevel).toBe("off");
    });

    it("routes moderate queries to Sonnet with low thinking", () => {
      const result = router.classifyAndRoute(
        "Explain the differences between JavaScript Promises and async/await",
      );
      expect(result.model).toContain("sonnet");
      expect(result.thinkLevel).toBe("low");
    });

    it("routes complex queries to Opus with medium thinking", () => {
      const result = router.classifyAndRoute(
        "Design an architecture for a new system that handles millions of requests",
      );
      expect(result.model).toContain("opus");
      expect(result.thinkLevel).toBe("medium");
    });

    it("routes expert queries to Opus with high thinking", () => {
      const result = router.classifyAndRoute(
        "Analyze the entire codebase and recommend improvements for performance and security",
      );
      expect(result.model).toContain("opus");
      expect(result.thinkLevel).toBe("high");
    });
  });

  describe("enable/disable", () => {
    it("can be disabled", () => {
      router.setEnabled(false);
      expect(router.isEnabled()).toBe(false);
    });

    it("can be re-enabled", () => {
      router.setEnabled(true);
      expect(router.isEnabled()).toBe(true);
    });
  });

  describe("custom rules", () => {
    it("allows custom routing rules", () => {
      const customRouter = new DynamicModelRouter({
        rules: [
          {
            complexity: "simple",
            provider: "openai",
            model: "gpt-4o",
            thinkLevel: "off",
            reasoningLevel: "off",
          },
        ],
      });
      const result = customRouter.classifyAndRoute("What time is it?");
      expect(result.model).toBe("gpt-4o");
    });
  });
});

describe("DEFAULT_ROUTING_RULES", () => {
  it("has rules for all complexity levels", () => {
    const complexities = DEFAULT_ROUTING_RULES.map((r) => r.complexity);
    expect(complexities).toContain("trivial");
    expect(complexities).toContain("simple");
    expect(complexities).toContain("moderate");
    expect(complexities).toContain("complex");
    expect(complexities).toContain("expert");
  });
});

describe("convenience function", () => {
  it("classifyAndRoute works as a convenience function", () => {
    const result = classifyAndRoute("Hello!");
    expect(result.provider).toBeDefined();
    expect(result.model).toBeDefined();
    expect(result.thinkLevel).toBeDefined();
  });
});
