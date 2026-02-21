import { useState } from "react";
import { AgentCard, type Agent } from "@/components/domain/agents";
import {
  ChatBubble,
  ChatBubbleMessage,
  ChatBubbleAvatar,
  ChatMessageList,
  ChatInput,
} from "@/components/domain/chat";
import { Button } from "@/components/ui/button";

const sampleAgents: Agent[] = [
  {
    id: "1",
    name: "Research Assistant",
    role: "Knowledge Synthesizer",
    status: "online",
    description: "Gathers and synthesizes information from various sources to answer complex questions.",
    tags: ["Research", "Writing", "Analysis"],
    taskCount: 3,
    lastActive: "2 minutes ago",
  },
  {
    id: "2",
    name: "Code Companion",
    role: "Development Partner",
    status: "busy",
    description: "Helps with coding tasks, reviews, and architectural decisions.",
    tags: ["Code", "Review", "Debug"],
    taskCount: 1,
    lastActive: "Just now",
  },
  {
    id: "3",
    name: "Life Coach",
    role: "Personal Guide",
    status: "paused",
    description: "Provides guidance on goals, habits, and personal development.",
    tags: ["Goals", "Habits"],
    lastActive: "1 hour ago",
  },
  {
    id: "4",
    name: "Data Analyst",
    role: "Insights Generator",
    status: "offline",
    description: "Analyzes data patterns and generates actionable insights.",
    tags: ["Data", "Analytics", "Reports"],
    lastActive: "3 hours ago",
  },
];

function App() {
  const [message, setMessage] = useState("");

  const handleSendMessage = (msg: string) => {
    console.log("Sending message:", msg);
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-8 space-y-12">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Second Brain Platform
          </h1>
          <p className="text-lg text-muted-foreground">
            Your AI-powered command center
          </p>
        </header>

        {/* Agent Cards Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Agents</h2>
            <Button variant="outline">Add Agent</Button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">
              Expanded View
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sampleAgents.slice(0, 3).map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  variant="expanded"
                  onChat={() => console.log("Chat with", agent.name)}
                  onSettings={() => console.log("Settings for", agent.name)}
                  onToggle={() => console.log("Toggle", agent.name)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">
              Compact View
            </h3>
            <div className="space-y-2 max-w-xl">
              {sampleAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  variant="compact"
                  onChat={() => console.log("Chat with", agent.name)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Chat Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">Chat Interface</h2>
          <div className="max-w-2xl border border-border rounded-2xl overflow-hidden bg-card">
            <div className="h-96">
              <ChatMessageList smooth>
                <ChatBubble variant="received">
                  <ChatBubbleAvatar fallback="AI" />
                  <ChatBubbleMessage variant="received">
                    Hello! I'm your AI assistant. How can I help you today?
                  </ChatBubbleMessage>
                </ChatBubble>

                <ChatBubble variant="sent">
                  <ChatBubbleMessage variant="sent">
                    Can you help me organize my project tasks?
                  </ChatBubbleMessage>
                </ChatBubble>

                <ChatBubble variant="received">
                  <ChatBubbleAvatar fallback="AI" />
                  <ChatBubbleMessage variant="received">
                    Of course! I'd be happy to help you organize your project tasks.
                    Could you tell me more about your project and what kind of tasks
                    you're working with?
                  </ChatBubbleMessage>
                </ChatBubble>

                <ChatBubble variant="sent">
                  <ChatBubbleMessage variant="sent">
                    I'm building a new web application and need to track features,
                    bugs, and documentation tasks.
                  </ChatBubbleMessage>
                </ChatBubble>

                <ChatBubble variant="received">
                  <ChatBubbleAvatar fallback="AI" />
                  <ChatBubbleMessage variant="received" isLoading />
                </ChatBubble>
              </ChatMessageList>
            </div>
            <ChatInput
              value={message}
              onChange={setMessage}
              onSubmit={handleSendMessage}
              placeholder="Type your message..."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-muted-foreground py-8 border-t border-border">
          <p>Second Brain Platform - Built with React 19, Tailwind CSS 4, shadcn/ui</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
