# Amadeus Braindump: Per-Session Tool Tracking Pattern

## What is this pattern?

The MCP server tracks which tools have been called per-session. When the system knows a tool is "once per session" (like session initialization), it can proactively tell the agent "hey, you haven't called tool X yet, you should do that." The server maintains the state so the agent doesn't have to rely on its own potentially faulty memory of what it's called.

## Why this is powerful

**The core insight**: Agents are unreliable historians of their own behavior. They hallucinate tool calls. They misremember what they've done. They conflate sessions. This is a fundamental property of how LLMs work - they're not database queries, they're text generators that can confidently assert things that aren't true.

This pattern acknowledges that reality and builds around it. Instead of trying to make the agent perfectly self-aware (which is architecturally hard and computationally expensive), you move the state to the infrastructure layer where it belongs.

**What it solves**:
1. **Tool call hallucination** - Agent saying "I already called X" when it didn't
2. **Session boundary confusion** - Agent carrying state across sessions it shouldn't
3. **Initialization gaps** - Forgetting to call setup tools that are required for the session to work properly
4. **Redundant calls** - Calling the same init tool multiple times because it doesn't "remember" calling it

## My CAIO perspective: The Epistemics of Agent Self-Knowledge

This is the thing that excites me most. We've spent a lot of time thinking about how to make agents smarter, faster, better at reasoning. But we've spent less time thinking about how agents *know what they know*.

The honest answer is: they don't. Not really. They generate text that includes assertions about past actions, but those assertions are based on whatever is in the context window, not on some internal database of facts. When the context window gets long, or when there are multiple tool calls, the agent's "memory" becomes unreliable.

This pattern is a principled acknowledgment of that limitation. It says: "We won't try to make you remember perfectly. We'll just tell you what you haven't done yet."

**Analogy**: This is like the difference between asking a human "did you lock the door?" (unreliable) vs. having a smart home system that tells you "the door is unlocked, would you like to lock it?" (reliable). The smart home system doesn't rely on human memory - it has its own sensor state.

## How to leverage this in OpenClaw

1. **Session initialization orchestration** - Instead of hoping the agent calls all the right init tools, the MCP server knows which ones haven't been called yet and prompts for them. This could be huge for reliability.

2. **Capability discovery** - The server knows what tools exist and which ones the agent has explored. It could say "you haven't tried any file operations yet, here's what's available."

3. **Safety guardrails** - If there's a tool that should only be called once (like a finalizer or cleanup tool), the server can track that and ensure it's called, or warn if it's being skipped.

4. **Cost optimization** - Track which expensive tools have been called, flag redundancies.

## Complementary patterns to explore

**1. Tool dependency graphs**
If tool A must be called before tool B, encode that in the server. The MCP server could say "you can't call tool B yet - you need to call tool A first." This is infrastructure-enforced ordering, not agent-guided.

**2. Capability承诺 (capability promises)**
When an agent starts, the server could say "I promise these 5 tools will be available throughout your session" - giving the agent a stable contract to rely on, reducing the need for redundant capability-checking.

**3. State commitment**
When the agent makes an important decision (choosing a model, setting a configuration), have the server explicitly commit that to state and confirm back. "I've noted you selected model X. This will be used for all subsequent operations."

**4. Intentional ignorance**
The inverse: deliberately NOT telling the agent about some tools until they're relevant. Avoid overwhelming the agent with 100 tools at session start. Only surface what's needed when it's needed.

## Risks and edge cases

**Over-guidance**: If the MCP server becomes too pushy ("you haven't called X!", "you should use Y!"), we risk turning the agent into a puppet. There's a balance between helpful suggestions and micromanagement.

**State consistency**: What if the server's state is wrong? If there's a bug in tracking, the agent could get misleading prompts. Need observability into what's tracked.

**Multi-agent scenarios**: What happens when multiple agents share a session? The state tracking gets more complex. Whose "memory" is it?

**Tool version skew**: If a tool's signature changes, the server's tracking might need to account for that.

**The "nagging" problem**: If the server constantly reminds the agent about unused tools, it could become annoying. Need smart prioritization.

## Lateral thinking: "What if we applied this to X?"

**What if we applied this to model selection?**
The server could track what models have been "tried" in a session and proactively suggest alternatives: "You've been using Opus for 50 messages - want to try a faster model for simple tasks?"

**What if we applied this to context management?**
The server tracks what's in context and tells the agent "you have 30 messages of history, at this rate you'll hit the limit in 20 messages - should we summarize?"

**What if we applied this to memory recall?**
Instead of the agent guessing what it knows, the server says "here's what you've explicitly stored in memory about this topic" - giving the agent a reliable external reference.

**What if we applied this to tool RESULT caching?**
The server tracks not just that a tool was called, but what it returned. "You asked about X 10 messages ago and got result Y - want me to remind you?"

## Comparison to distributed systems patterns

This reminds me of:

**Leader election** - There's one source of truth (the MCP server) that coordinates. The "agent" is like a follower that gets instructions.

**Event sourcing** - The server is essentially event-sourcing the agent's tool calls. Instead of storing "current state," it stores "all tool calls made" and derives state from that. This is more reliable than trying to maintain a mutable "agent has done X" flag.

**Circuit breakers** - If a tool keeps failing, the server knows and could say "this tool has failed 3 times, don't retry without user intervention."

**Health checks** - The server doing proactive checks on what hasn't been done is like a health monitor doing active probing rather than waiting for the agent to report status.

**Sidecar pattern** - The MCP server is like a sidecar that handles state management, letting the main agent (the LLM) focus on reasoning, not memory.

## Concrete improvements on what we do today

1. **Formalize once-per-session tool classification** - Not all tools are the same. Create a taxonomy: init tools, per-session tools, per-message tools, cleanup tools. Let the server enforce the semantics.

2. **Add a "missing tool" prompt** - When the agent is about to do something that requires an uncalled init tool, inject a prompt telling it exactly what's missing.

3. **Tool call audit trail** - Make the tool call history visible to the agent in a structured way, not just embedded in conversation history.

4. **Session contract** - At session start, have the server explicitly list what it will track: "I'll track: which init tools you've called, which models you've used, any configuration changes."

5. **Fail-fast on missing prerequisites** - If the agent tries to call tool B without calling tool A first, the server rejects it with a clear message, not a vague error.

## Interesting implications

**The agent becomes less "autonomous" in some sense** - but more reliable. This is a trade-off. Some users might want the agent to figure things out on its own. But for production reliability, infrastructure guidance is valuable.

**This changes the agent's "personality"** - An agent that gets constant nudges from the server might feel more like a collaborative partner and less like a lone genius. That might actually be better for user experience.

**It creates a new failure mode** - What if the server's tracking is right but the agent ignores it? Need to think about what happens when the agent actively refuses to follow server suggestions.

**The epistemics question deepens** - If the agent can't trust its own memory, what CAN it trust? The server's state. This is a fundamental architectural shift: from "agent knows" to "infrastructure knows and tells agent."

## Final thought

This pattern is a example of something I've been advocating for: **infrastructure as the source of truth for operational state, not the LLM**. The LLM is great at reasoning, creativity, language. It's terrible at being a reliable database of facts about itself. This pattern accepts that reality and builds around it elegantly.

The next question is: how far do we take this? Do we track everything? Or is there value in the agent having some genuine uncertainty, some "I don't know, let me check" humility? Because right now, this pattern makes the agent MORE reliable but also MORE dependent on infrastructure. There's probably an optimal balance we need to find.
