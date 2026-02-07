Decision Framework: When to Build What

Here's the framework for deciding which extensibility layer to use:

Build a Plugin when:

• You need to register new tools the agent can invoke
• You need a background service with start/stop lifecycle
• You need gateway RPC methods (WebSocket API)
• You need CLI subcommands
• You need a new messaging channel
• You need configuration validation with a schema
• You need HTTP endpoints on the gateway
• It should be distributable (npm, others can use it)
• It has state (database, files) that needs lifecycle management

Build a Hook when:
• You just need to react to events (session start, compaction, message received)
• It's lightweight — no tools, no services, no config
• It's a behavior modifier (e.g., inject context before agent starts, log commands)
• Don't use hooks if you need to register tools or services

Build a Skill (SKILL.md) when:
• You need to teach the agent how to use existing tools in a specific way
• It's pure documentation — no new capabilities, just knowledge
• You want the agent to follow a specific workflow pattern (e.g., "verification-before-completion")
• Don't use skills if you need actual code execution or new tools

Build a Standalone App when:
• It has zero relationship to the agent gateway
• It needs a fundamentally different runtime (e.g., a Go binary, a mobile app)
• If it needs gateway config, tools, or lifecycle → make it a plugin instead
