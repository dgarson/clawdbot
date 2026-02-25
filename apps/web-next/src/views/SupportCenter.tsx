import React, { useState, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";

// Types
type ArticleCategory = "getting-started" | "agents" | "billing" | "api" | "integrations" | "troubleshooting";
type TicketStatus = "open" | "in-progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface HelpArticle {
  id: string;
  title: string;
  category: ArticleCategory;
  excerpt: string;
  content: string;
  views: number;
  helpful: number;
  notHelpful: number;
  updatedAt: string;
  tags: string[];
}

interface SupportTicket {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: ArticleCategory;
  description: string;
  createdAt: string;
  updatedAt: string;
  agentResponse?: string;
}

// Seed Data
const helpArticles: HelpArticle[] = [
  {
    id: "gs-1",
    title: "Getting Started with OpenClaw",
    category: "getting-started",
    excerpt: "Learn the basics of setting up your first agent and understanding the dashboard.",
    content: `Welcome to OpenClaw! This guide will help you get started with your first agent setup.

First, navigate to the Agent Dashboard and click the "Create New Agent" button. You'll be guided through a wizard that helps you define your agent's identity, capabilities, and configuration.

OpenClaw uses a unique "SOUL" framework for agent identity — each agent has distinct characteristics that define its behavior. Take time to understand each parameter as it will significantly impact how your agent interacts with users.

After creating your agent, you can deploy it to various channels including Slack, Discord, and custom webhooks. The platform handles all the complexity of message routing and authentication.

Finally, monitor your agent's performance using the built-in analytics dashboard. Track response times, user satisfaction scores, and conversation flows to continuously improve your agent's effectiveness.`,
    views: 1247,
    helpful: 342,
    notHelpful: 12,
    updatedAt: "2024-01-15",
    tags: ["beginner", "setup", "quickstart"]
  },
  {
    id: "gs-2",
    title: "Understanding Agent Identities",
    category: "getting-started",
    excerpt: "Deep dive into the SOUL framework for agent configuration.",
    content: `The SOUL framework is OpenClaw's proprietary approach to defining agent identities. Each component plays a crucial role in shaping your agent's personality and capabilities.

S - System Instructions: Define the core purpose and behavior rules for your agent. This is the foundation upon which all responses are generated.

O - Operational Context: Set the operational boundaries including working hours, response time limits, and escalation paths.

U - User Mapping: Define how your agent identifies and categorizes users, including role-based access and permission levels.

L - Learning Parameters: Configure how your agent learns from interactions, including feedback loops and knowledge base updates.

Understanding each of these components in depth will help you create agents that are both effective and aligned with your organization's values.`,
    views: 892,
    helpful: 256,
    notHelpful: 8,
    updatedAt: "2024-01-10",
    tags: ["identity", "SOUL", "configuration"]
  },
  {
    id: "ag-1",
    title: "Creating Custom Agent Behaviors",
    category: "agents",
    excerpt: "Build agents with specialized behaviors for different use cases.",
    content: `OpenClaw supports highly customizable agent behaviors. When creating or editing an agent, you can define specific response patterns, trigger conditions, and action sequences.

Use the Behavior Editor to create conditional responses based on user input, time of day, or conversation context. You can also integrate with external APIs to fetch real-time data or trigger actions in other systems.

For advanced use cases, consider using agent chaining — where multiple agents collaborate to handle complex requests. Each agent in the chain can specialize in a specific aspect of the conversation.

Remember to test your agent thoroughly using the built-in simulator before deploying to production. The simulator allows you to preview agent responses without affecting real users.`,
    views: 634,
    helpful: 189,
    notHelpful: 15,
    updatedAt: "2024-01-08",
    tags: ["behaviors", "custom", "advanced"]
  },
  {
    id: "ag-2",
    title: "Agent Monitoring and Analytics",
    category: "agents",
    excerpt: "Track performance metrics and optimize agent effectiveness.",
    content: `The Agent Pulse Monitor provides real-time visibility into how your agents are performing. Key metrics include response latency, conversation completion rates, and user satisfaction scores.

Set up custom alerts to notify you when agents deviate from expected behavior or when performance metrics fall below thresholds. This proactive monitoring helps maintain service quality.

The analytics dashboard offers detailed breakdowns of agent conversations, identifying common user intents and potential gaps in agent knowledge. Use these insights to continuously refine your agent's capabilities.

Integration with external monitoring tools like Datadog and Prometheus is available for enterprise customers requiring advanced observability.`,
    views: 445,
    helpful: 134,
    notHelpful: 5,
    updatedAt: "2024-01-05",
    tags: ["monitoring", "analytics", "metrics"]
  },
  {
    id: "bi-1",
    title: "Managing Your Subscription",
    category: "billing",
    excerpt: "Understand billing cycles, payment methods, and plan features.",
    content: `OpenClaw offers flexible subscription plans to match your needs. Navigate to Settings > Billing to view your current plan, usage statistics, and payment history.

The platform supports multiple payment methods including credit cards and ACH transfers for US customers. Invoices are generated monthly and can be downloaded as PDFs directly from the dashboard.

If you need to upgrade or downgrade your plan, changes take effect immediately with prorated billing. Upgrades unlock additional features while downgrades take effect at the start of the next billing cycle.

Enterprise customers have access to custom pricing and dedicated support channels. Contact our sales team for more information about enterprise options.`,
    views: 312,
    helpful: 98,
    notHelpful: 3,
    updatedAt: "2024-01-02",
    tags: ["billing", "subscription", "payment"]
  },
  {
    id: "api-1",
    title: "OpenClaw API Reference",
    category: "api",
    excerpt: "Programmatic access to agent management and conversation data.",
    content: `OpenClaw provides a comprehensive REST API for programmatic access to all platform features. Authentication uses API keys that can be generated from the Developer Settings page.

The API follows RESTful conventions with JSON request and response bodies. Base URL for all API calls is https://api.openclaw.io/v1.

Key endpoints include:
- POST /agents - Create a new agent
- GET /agents/{id} - Retrieve agent details
- PUT /agents/{id} - Update agent configuration
- DELETE /agents/{id} - Remove an agent
- GET /conversations - List conversations with pagination
- GET /conversations/{id} - Get conversation details

Rate limits apply based on your subscription tier. Refer to the full API documentation for complete endpoint specifications and error codes.`,
    views: 567,
    helpful: 178,
    notHelpful: 11,
    updatedAt: "2024-01-12",
    tags: ["API", "developer", "integration"]
  },
  {
    id: "in-1",
    title: "Integrating with Slack",
    category: "integrations",
    excerpt: "Connect your agents to Slack for team communication.",
    content: `Integrating OpenClaw with Slack enables your agents to participate directly in Slack channels and direct messages. This is one of our most popular integration options.

To set up the integration, go to Settings > Integrations > Slack and click "Connect to Slack". You'll be redirected to Slack's OAuth flow to authorize the connection.

After connecting, you can configure which channels your agent should monitor and how it should respond. Options include:
- Respond to mentions only
- Respond to direct messages
- Monitor all channel messages (with keywords)

The integration supports rich message formatting, interactive components, and thread replies. Configure response templates to ensure consistent messaging across channels.`,
    views: 423,
    helpful: 145,
    notHelpful: 7,
    updatedAt: "2024-01-09",
    tags: ["Slack", "integration", "messaging"]
  },
  {
    id: "tr-1",
    title: "Troubleshooting Common Issues",
    category: "troubleshooting",
    excerpt: "Solutions for frequently encountered problems.",
    content: `This guide covers the most common issues users encounter and their solutions.

**Agent not responding**: Check that your agent is deployed and not paused. Verify the agent has the correct permissions in the channel where you're expecting responses.

**Slow response times**: High latency can be caused by complex agent configurations or external API calls. Use the performance profiler to identify bottlenecks.

**Authentication errors**: Ensure your API keys are valid and not expired. API keys can be regenerated from Settings > Developer if needed.

**Integration failures**: Check the integration logs for specific error messages. Most issues relate to permission misconfigurations or rate limiting.

If you're still experiencing issues after trying these solutions, create a support ticket with details about your setup and the error message you're seeing.`,
    views: 789,
    helpful: 267,
    notHelpful: 19,
    updatedAt: "2024-01-14",
    tags: ["troubleshooting", "help", "issues"]
  }
];

const supportTickets: SupportTicket[] = [
  {
    id: "TKT-001",
    title: "Agent not responding in Discord",
    status: "open",
    priority: "high",
    category: "troubleshooting",
    description: "I deployed my agent to Discord yesterday, but it's not responding to any messages. I've checked the permissions and the bot is online.",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z"
  },
  {
    id: "TKT-002",
    title: "API rate limiting questions",
    status: "in-progress",
    priority: "medium",
    category: "api",
    description: "We need to increase our API rate limits for the upcoming product launch. Currently on the Pro plan but need Enterprise-level throughput.",
    createdAt: "2024-01-12T14:22:00Z",
    updatedAt: "2024-01-14T09:15:00Z",
    agentResponse: "Hi there! I've reviewed your request and can confirm that Enterprise rate limits can accommodate your launch traffic. Our team will reach out within 24 hours to discuss migration options. In the meantime, could you provide your estimated peak requests per second?"
  },
  {
    id: "TKT-003",
    title: "Billing discrepancy resolved",
    status: "resolved",
    priority: "low",
    category: "billing",
    description: "I was charged twice for my monthly subscription. Please refund the duplicate charge.",
    createdAt: "2024-01-05T08:00:00Z",
    updatedAt: "2024-01-07T11:30:00Z",
    agentResponse: "We've identified the duplicate charge and processed a full refund to your original payment method. The refund should appear within 3-5 business days. We've also implemented a fix to prevent this issue from recurring. Is there anything else we can help you with?"
  }
];

const CATEGORIES: { value: ArticleCategory; label: string }[] = [
  { value: "getting-started", label: "Getting Started" },
  { value: "agents", label: "Agents" },
  { value: "billing", label: "Billing" },
  { value: "api", label: "API" },
  { value: "integrations", label: "Integrations" },
  { value: "troubleshooting", label: "Troubleshooting" }
];

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

const TICKET_STATUSES: { value: TicketStatus; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "bg-amber-400/20 text-amber-400" },
  { value: "in-progress", label: "In Progress", color: "bg-primary/20 text-primary" },
  { value: "resolved", label: "Resolved", color: "bg-emerald-400/20 text-emerald-400" },
  { value: "closed", label: "Closed", color: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)]" }
];

// Components
function StatusBadge({ status }: { status: TicketStatus }) {
  const statusConfig = TICKET_STATUSES.find(s => s.value === status);
  return (
    <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-medium", statusConfig?.color)}>
      {statusConfig?.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const colors: Record<TicketPriority, string> = {
    low: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)]",
    medium: "bg-primary/20 text-primary",
    high: "bg-amber-400/20 text-amber-400",
    urgent: "bg-rose-400/20 text-rose-400"
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-medium", colors[priority])}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function CategoryChip({ 
  category, 
  selected, 
  onClick 
}: { 
  category: ArticleCategory; 
  selected: boolean; 
  onClick: () => void;
}) {
  const label = CATEGORIES.find(c => c.value === category)?.label || category;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
        selected 
          ? "bg-primary text-[var(--color-text-primary)]" 
          : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
      )}
    >
      {label}
    </button>
  );
}

function HelpCenterTab() {
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "not-helpful" | null>>({});

  const filteredArticles = useMemo(() => {
    return helpArticles.filter(article => {
      const matchesCategory = !selectedCategory || article.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleFeedback = useCallback((articleId: string, type: "helpful" | "not-helpful") => {
    setFeedback(prev => ({ ...prev, [articleId]: type }));
  }, []);

  if (selectedArticle) {
    const feedbackState = feedback[selectedArticle.id];
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelectedArticle(null)}
          className={cn(
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            "px-3 py-2 rounded-md -ml-3"
          )}
          aria-label="Back to articles"
        >
          ← Back to Articles
        </button>
        
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">{selectedArticle.title}</h2>
          <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)] mb-6">
            <span>{selectedArticle.views.toLocaleString()} views</span>
            <span>•</span>
            <span>Updated {selectedArticle.updatedAt}</span>
            <span>•</span>
            <span className="capitalize">{selectedArticle.category.replace("-", " ")}</span>
          </div>
          
          <div className="prose prose-invert prose-zinc max-w-none">
            {selectedArticle.content.split("\n\n").map((paragraph, idx) => (
              <p key={idx} className="text-[var(--color-text-primary)] leading-relaxed mb-4">{paragraph}</p>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-[var(--color-border)]">
            {selectedArticle.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Was this article helpful?</h3>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleFeedback(selectedArticle.id, "helpful")}
              disabled={feedbackState !== undefined}
              aria-pressed={feedbackState === "helpful"}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                feedbackState === "helpful"
                  ? "bg-emerald-400/20 text-emerald-400"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]",
                feedbackState !== undefined && "opacity-50 cursor-not-allowed"
              )}
            >
              <span>👍</span>
              <span>Yes ({selectedArticle.helpful})</span>
            </button>
            <button
              type="button"
              onClick={() => handleFeedback(selectedArticle.id, "not-helpful")}
              disabled={feedbackState !== undefined}
              aria-pressed={feedbackState === "not-helpful"}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                feedbackState === "not-helpful"
                  ? "bg-rose-400/20 text-rose-400"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]",
                feedbackState !== undefined && "opacity-50 cursor-not-allowed"
              )}
            >
              <span>👎</span>
              <span>No ({selectedArticle.notHelpful})</span>
            </button>
          </div>
          {feedbackState && (
            <p className="text-emerald-400 text-sm mt-3">
              Thanks for your feedback!
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">🔍</span>
          <input
            type="search"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search articles"
            className={cn(
              "w-full pl-10 pr-4 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              "transition-colors duration-150"
            )}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <CategoryChip
          category="getting-started"
          selected={selectedCategory === "getting-started"}
          onClick={() => setSelectedCategory(selectedCategory === "getting-started" ? null : "getting-started")}
        />
        <CategoryChip
          category="agents"
          selected={selectedCategory === "agents"}
          onClick={() => setSelectedCategory(selectedCategory === "agents" ? null : "agents")}
        />
        <CategoryChip
          category="billing"
          selected={selectedCategory === "billing"}
          onClick={() => setSelectedCategory(selectedCategory === "billing" ? null : "billing")}
        />
        <CategoryChip
          category="api"
          selected={selectedCategory === "api"}
          onClick={() => setSelectedCategory(selectedCategory === "api" ? null : "api")}
        />
        <CategoryChip
          category="integrations"
          selected={selectedCategory === "integrations"}
          onClick={() => setSelectedCategory(selectedCategory === "integrations" ? null : "integrations")}
        />
        <CategoryChip
          category="troubleshooting"
          selected={selectedCategory === "troubleshooting"}
          onClick={() => setSelectedCategory(selectedCategory === "troubleshooting" ? null : "troubleshooting")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2" role="list" aria-label="Help articles">
        {filteredArticles.map(article => (
          <article
            key={article.id}
            className={cn(
              "bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5 cursor-pointer",
              "hover:border-[var(--color-border)] transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
            onClick={() => setSelectedArticle(article)}
            onKeyDown={(e) => e.key === "Enter" && setSelectedArticle(article)}
            tabIndex={0}
            aria-label={`Read article: ${article.title}`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-primary uppercase tracking-wide">
                {article.category.replace("-", " ")}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{article.views.toLocaleString()} views</span>
            </div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">{article.title}</h3>
            <p className="text-[var(--color-text-secondary)] text-sm line-clamp-2">{article.excerpt}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {article.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs text-[var(--color-text-muted)]">#{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-secondary)] text-lg">No articles found matching your criteria.</p>
          <button
            type="button"
            onClick={() => { setSelectedCategory(null); setSearchQuery(""); }}
            className="mt-4 text-primary hover:text-indigo-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function MyTicketsTab() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  if (selectedTicket) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelectedTicket(null)}
          className={cn(
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            "px-3 py-2 rounded-md -ml-3"
          )}
          aria-label="Back to tickets"
        >
          ← Back to Tickets
        </button>

        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{selectedTicket.title}</h2>
              <p className="text-[var(--color-text-muted)] text-sm mt-1">Ticket #{selectedTicket.id}</p>
            </div>
            <div className="flex gap-2">
              <StatusBadge status={selectedTicket.status} />
              <PriorityBadge priority={selectedTicket.priority} />
            </div>
          </div>

          <div className="flex gap-4 text-sm text-[var(--color-text-muted)] mb-6">
            <span>Category: <span className="capitalize">{selectedTicket.category.replace("-", " ")}</span></span>
            <span>•</span>
            <span>Created: {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>Updated: {new Date(selectedTicket.updatedAt).toLocaleDateString()}</span>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Description</h3>
            <p className="text-[var(--color-text-primary)] bg-[var(--color-surface-0)] p-4 rounded-md">{selectedTicket.description}</p>
          </div>

          {selectedTicket.agentResponse && (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Agent Response</h3>
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-md">
                <p className="text-[var(--color-text-primary)]">{selectedTicket.agentResponse}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" role="table" aria-label="Support tickets">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">Ticket</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">Priority</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">Category</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">Created</th>
          </tr>
        </thead>
        <tbody>
          {supportTickets.map(ticket => (
            <tr
              key={ticket.id}
              className={cn(
                "border-b border-[var(--color-border)] cursor-pointer",
                "hover:bg-[var(--color-surface-2)]/50 transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              )}
              onClick={() => setSelectedTicket(ticket)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedTicket(ticket)}
              tabIndex={0}
              role="row"
            >
              <td className="py-3 px-4">
                <div>
                  <div className="text-[var(--color-text-primary)] font-medium">{ticket.title}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{ticket.id}</div>
                </div>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="py-3 px-4">
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] capitalize">{ticket.category.replace("-", " ")}</td>
              <td className="py-3 px-4 text-[var(--color-text-muted)]">{new Date(ticket.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewTicketTab() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ArticleCategory>("getting-started");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const charCount = description.length;
  const maxChars = 2000;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && description.trim()) {
      setSubmitted(true);
    }
  }, [title, description]);

  if (submitted) {
    return (
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Ticket Submitted!</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          Your support ticket has been created. Our team will review it shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setTitle("");
            setCategory("getting-started");
            setPriority("medium");
            setDescription("");
          }}
          className={cn(
            "px-4 py-2 bg-primary text-[var(--color-text-primary)] rounded-md",
            "hover:bg-primary transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          )}
        >
          Submit Another Ticket
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          Title <span className="text-rose-400">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Brief description of your issue"
          className={cn(
            "w-full px-4 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            "transition-colors duration-150"
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Category <span className="text-rose-400">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ArticleCategory)}
            required
            className={cn(
              "w-full px-4 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md",
              "text-[var(--color-text-primary)]",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              "transition-colors duration-150"
            )}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Priority <span className="text-rose-400">*</span>
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            required
            className={cn(
              "w-full px-4 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md",
              "text-[var(--color-text-primary)]",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              "transition-colors duration-150"
            )}
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          Description <span className="text-rose-400">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, maxChars))}
          required
          placeholder="Provide detailed information about your issue..."
          rows={6}
          aria-describedby="char-count"
          className={cn(
            "w-full px-4 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md resize-none",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            "transition-colors duration-150"
          )}
        />
        <div id="char-count" className="text-right text-sm text-[var(--color-text-muted)] mt-1">
          {charCount} / {maxChars}
        </div>
      </div>

      <button
        type="submit"
        disabled={!title.trim() || !description.trim()}
        className={cn(
          "w-full sm:w-auto px-6 py-2.5 bg-primary text-[var(--color-text-primary)] rounded-md font-medium",
          "hover:bg-primary transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        Submit Ticket
      </button>
    </form>
  );
}

// Main Component
export default function SupportCenter() {
  const [activeTab, setActiveTab] = useState<"help" | "tickets" | "new">("help");

  const tabs: { id: "help" | "tickets" | "new"; label: string; icon: string }[] = [
    { id: "help", label: "Help Center", icon: "📚" },
    { id: "tickets", label: "My Tickets", icon: "🎫" },
    { id: "new", label: "New Ticket", icon: "➕" }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Support Center</h1>
          <p className="text-[var(--color-text-secondary)]">Find answers, manage your tickets, or get help from our team.</p>
        </header>

        <div className="border-b border-[var(--color-border)] mb-6" role="tablist">
          <nav className="flex gap-1" aria-label="Support sections">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors duration-150",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  activeTab === tab.id
                    ? "border-primary text-[var(--color-text-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]"
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <main>
          {activeTab === "help" && (
            <div id="panel-help" role="tabpanel" aria-labelledby="tab-help">
              <HelpCenterTab />
            </div>
          )}
          {activeTab === "tickets" && (
            <div id="panel-tickets" role="tabpanel" aria-labelledby="tab-tickets">
              <MyTicketsTab />
            </div>
          )}
          {activeTab === "new" && (
            <div id="panel-new" role="tabpanel" aria-labelledby="tab-new">
              <NewTicketTab />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
