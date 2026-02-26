import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low"
type TicketStatus = "open" | "in-progress" | "pending" | "resolved"
type SLATier = "enterprise" | "pro" | "free"
type TabId = "queue" | "analytics" | "sla" | "knowledge"

interface ConversationMessage {
  id: string
  author: string
  role: "customer" | "agent" | "system"
  content: string
  timestamp: string
}

interface Ticket {
  id: string
  title: string
  customer: string
  priority: Priority
  status: TicketStatus
  assignee: string
  category: string
  created: string
  slaDeadline: string
  slaMinutesRemaining: number
  tier: SLATier
  conversation: ConversationMessage[]
}

interface DayAnalytics {
  date: string
  tickets: number
  resolved: number
  avgResolutionHours: number
}

interface CategoryBreakdown {
  category: string
  count: number
  percentage: number
  color: string
}

interface AgentWorkload {
  agent: string
  openTickets: number
  resolvedToday: number
  avgHandleTime: string
  satisfactionScore: number
}

interface SLACompliance {
  tier: SLATier
  total: number
  compliant: number
  breached: number
  complianceRate: number
  avgResponseTime: string
  avgResolutionTime: string
}

interface SLABreach {
  id: string
  ticketId: string
  ticketTitle: string
  customer: string
  tier: SLATier
  breachType: "response" | "resolution"
  breachedAt: string
  overdueDuration: string
  assignee: string
}

interface SLAPriorityOverride {
  priority: Priority
  response: string
  resolution: string
}

interface SLAPolicy {
  tier: SLATier
  responseTarget: string
  resolutionTarget: string
  priorityOverrides: SLAPriorityOverride[]
}

interface AtRiskTicket {
  id: string
  title: string
  customer: string
  tier: SLATier
  priority: Priority
  minutesRemaining: number
  assignee: string
}

interface KBArticle {
  id: string
  title: string
  category: string
  views: number
  helpfulnessRate: number
  deflectionRate: number
  linkedTickets: number
  lastUpdated: string
}

interface SuggestedArticle {
  articleId: string
  articleTitle: string
  ticketId: string
  ticketTitle: string
  relevanceScore: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TICKETS: Ticket[] = [
  {
    id: "TKT-1001",
    title: "Payment processing fails on checkout",
    customer: "Acme Corp",
    priority: "critical",
    status: "in-progress",
    assignee: "Jordan Lee",
    category: "Billing",
    created: "2026-02-22T08:00:00Z",
    slaDeadline: "2026-02-22T09:00:00Z",
    slaMinutesRemaining: 23,
    tier: "enterprise",
    conversation: [
      {
        id: "m1",
        author: "Sarah K.",
        role: "customer",
        content:
          "Our checkout is completely broken. Customers are getting payment declined errors on every transaction. This is a revenue-critical issue.",
        timestamp: "2026-02-22T08:00:00Z",
      },
      {
        id: "m2",
        author: "Jordan Lee",
        role: "agent",
        content:
          "Hi Sarah, I understand the urgency. I've escalated this to our payments team. Can you share the error codes you're seeing in your payment processor logs?",
        timestamp: "2026-02-22T08:12:00Z",
      },
      {
        id: "m3",
        author: "Sarah K.",
        role: "customer",
        content:
          "Error code: PAYMENT_DECLINED_3DS. Started at 8am EST. Affects all card types.",
        timestamp: "2026-02-22T08:18:00Z",
      },
      {
        id: "m4",
        author: "Jordan Lee",
        role: "agent",
        content:
          "Got it. Our 3DS provider had a configuration update deployed at 7:55am. I'm coordinating a rollback now — ETA 15 minutes.",
        timestamp: "2026-02-22T08:25:00Z",
      },
      {
        id: "m5",
        author: "System",
        role: "system",
        content: "Ticket escalated to P0. Engineering team notified.",
        timestamp: "2026-02-22T08:26:00Z",
      },
    ],
  },
  {
    id: "TKT-1002",
    title: "SSO login loop with SAML provider",
    customer: "Meridian Health",
    priority: "high",
    status: "open",
    assignee: "Alex Rivera",
    category: "Authentication",
    created: "2026-02-22T07:30:00Z",
    slaDeadline: "2026-02-22T11:30:00Z",
    slaMinutesRemaining: 187,
    tier: "enterprise",
    conversation: [
      {
        id: "m1",
        author: "Mike T.",
        role: "customer",
        content:
          "Users are getting stuck in a redirect loop when logging in via our Okta SSO integration. Started this morning after we updated our SAML metadata.",
        timestamp: "2026-02-22T07:30:00Z",
      },
      {
        id: "m2",
        author: "Alex Rivera",
        role: "agent",
        content:
          "Thanks for the report Mike. I'll need your entity ID and the new ACS URL from your updated metadata to investigate.",
        timestamp: "2026-02-22T07:45:00Z",
      },
    ],
  },
  {
    id: "TKT-1003",
    title: "CSV export includes incorrect date format",
    customer: "Quantum Analytics",
    priority: "medium",
    status: "pending",
    assignee: "Sam Chen",
    category: "Data Export",
    created: "2026-02-21T14:00:00Z",
    slaDeadline: "2026-02-24T14:00:00Z",
    slaMinutesRemaining: 4320,
    tier: "pro",
    conversation: [
      {
        id: "m1",
        author: "Priya M.",
        role: "customer",
        content:
          "The CSV export from the Reports module shows dates as MM/DD/YYYY but our ETL pipeline expects YYYY-MM-DD ISO format.",
        timestamp: "2026-02-21T14:00:00Z",
      },
      {
        id: "m2",
        author: "Sam Chen",
        role: "agent",
        content:
          "Hi Priya, this is a known limitation. We have a date format setting in Account > Preferences. Set it to ISO 8601 and re-export. Let me know if that resolves it.",
        timestamp: "2026-02-21T14:30:00Z",
      },
      {
        id: "m3",
        author: "Priya M.",
        role: "customer",
        content:
          "I see the setting but it only affects the dashboard display, not exports. Exports are still US format.",
        timestamp: "2026-02-21T15:00:00Z",
      },
      {
        id: "m4",
        author: "Sam Chen",
        role: "agent",
        content:
          "You're right — I've reproduced this. Export date format is hardcoded. I'm filing this as a bug and assigning to our data team.",
        timestamp: "2026-02-21T15:20:00Z",
      },
      {
        id: "m5",
        author: "System",
        role: "system",
        content: "Ticket status changed to Pending. Awaiting engineering fix.",
        timestamp: "2026-02-21T15:21:00Z",
      },
    ],
  },
  {
    id: "TKT-1004",
    title: "API rate limit too restrictive for batch jobs",
    customer: "DataStream Inc.",
    priority: "high",
    status: "open",
    assignee: "Jordan Lee",
    category: "API",
    created: "2026-02-22T06:00:00Z",
    slaDeadline: "2026-02-22T10:00:00Z",
    slaMinutesRemaining: 98,
    tier: "pro",
    conversation: [
      {
        id: "m1",
        author: "Chris W.",
        role: "customer",
        content:
          "Our nightly batch job hits the 1000 req/min rate limit and fails. We need either higher limits or a bulk endpoint.",
        timestamp: "2026-02-22T06:00:00Z",
      },
      {
        id: "m2",
        author: "Jordan Lee",
        role: "agent",
        content:
          "I understand. Your plan allows up to 2000 req/min with the burst header X-Burst-Mode: true. Can you try adding that header to your requests?",
        timestamp: "2026-02-22T06:30:00Z",
      },
    ],
  },
  {
    id: "TKT-1005",
    title: "Mobile app crashes on iOS 18.3",
    customer: "RetailEdge",
    priority: "critical",
    status: "in-progress",
    assignee: "Morgan Davis",
    category: "Mobile",
    created: "2026-02-22T05:00:00Z",
    slaDeadline: "2026-02-22T06:00:00Z",
    slaMinutesRemaining: -45,
    tier: "enterprise",
    conversation: [
      {
        id: "m1",
        author: "Tom B.",
        role: "customer",
        content:
          "App crashes immediately on launch for all iOS 18.3 users. Store associates cannot process transactions. Critical business impact.",
        timestamp: "2026-02-22T05:00:00Z",
      },
      {
        id: "m2",
        author: "Morgan Davis",
        role: "agent",
        content:
          "Confirmed reproduction on our end. iOS 18.3 introduced a change to WKWebView sandboxing that affects hybrid apps. Our mobile team is working on a patch.",
        timestamp: "2026-02-22T05:15:00Z",
      },
      {
        id: "m3",
        author: "Morgan Davis",
        role: "agent",
        content:
          "Interim workaround: users can disable the app sandbox in iOS settings temporarily. Not ideal but operational. Patch ETA: 2 hours.",
        timestamp: "2026-02-22T05:30:00Z",
      },
      {
        id: "m4",
        author: "System",
        role: "system",
        content: "SLA breach: Resolution deadline passed at 06:00 UTC.",
        timestamp: "2026-02-22T06:00:00Z",
      },
    ],
  },
  {
    id: "TKT-1006",
    title: "Dashboard widgets not loading for some users",
    customer: "Nexus Solutions",
    priority: "medium",
    status: "in-progress",
    assignee: "Alex Rivera",
    category: "Dashboard",
    created: "2026-02-21T16:00:00Z",
    slaDeadline: "2026-02-23T16:00:00Z",
    slaMinutesRemaining: 2880,
    tier: "pro",
    conversation: [
      {
        id: "m1",
        author: "Lena G.",
        role: "customer",
        content:
          "About 30% of our users see blank widgets on the analytics dashboard. Rest of the team is fine.",
        timestamp: "2026-02-21T16:00:00Z",
      },
      {
        id: "m2",
        author: "Alex Rivera",
        role: "agent",
        content:
          "Hi Lena, this looks like a browser cache issue. Can you ask affected users to hard-refresh (Ctrl+Shift+R)?",
        timestamp: "2026-02-21T16:20:00Z",
      },
      {
        id: "m3",
        author: "Lena G.",
        role: "customer",
        content: "Tried that on 3 machines - still blank. All Chrome 121.",
        timestamp: "2026-02-21T16:45:00Z",
      },
    ],
  },
  {
    id: "TKT-1007",
    title: "Webhook deliveries failing with 500 errors",
    customer: "CloudBase Inc.",
    priority: "high",
    status: "open",
    assignee: "Sam Chen",
    category: "Integrations",
    created: "2026-02-22T09:00:00Z",
    slaDeadline: "2026-02-22T13:00:00Z",
    slaMinutesRemaining: 225,
    tier: "enterprise",
    conversation: [
      {
        id: "m1",
        author: "James P.",
        role: "customer",
        content:
          "All outbound webhooks are returning 500. Checked our endpoint — it's healthy. Issue seems to be on your side.",
        timestamp: "2026-02-22T09:00:00Z",
      },
    ],
  },
  {
    id: "TKT-1008",
    title: "Two-factor authentication emails not delivered",
    customer: "SecureVault",
    priority: "high",
    status: "in-progress",
    assignee: "Morgan Davis",
    category: "Authentication",
    created: "2026-02-22T08:30:00Z",
    slaDeadline: "2026-02-22T12:30:00Z",
    slaMinutesRemaining: 155,
    tier: "pro",
    conversation: [
      {
        id: "m1",
        author: "Rachel S.",
        role: "customer",
        content:
          "New employees can't log in. 2FA emails aren't arriving. Spam folders checked.",
        timestamp: "2026-02-22T08:30:00Z",
      },
      {
        id: "m2",
        author: "Morgan Davis",
        role: "agent",
        content:
          "Hi Rachel, I'm checking our email delivery logs for your domain.",
        timestamp: "2026-02-22T08:45:00Z",
      },
      {
        id: "m3",
        author: "Morgan Davis",
        role: "agent",
        content:
          "Found the issue — your domain's DMARC policy changed to p=reject. Our emails are being blocked. You'll need to add our sending domain to your DMARC allowlist.",
        timestamp: "2026-02-22T08:55:00Z",
      },
    ],
  },
  {
    id: "TKT-1009",
    title: "Report scheduler not running at configured time",
    customer: "Beacon Analytics",
    priority: "low",
    status: "open",
    assignee: "Sam Chen",
    category: "Reports",
    created: "2026-02-20T10:00:00Z",
    slaDeadline: "2026-02-27T10:00:00Z",
    slaMinutesRemaining: 7200,
    tier: "free",
    conversation: [
      {
        id: "m1",
        author: "Ben A.",
        role: "customer",
        content:
          "Set up weekly report for Monday 9am but it ran at midnight. Timezone issue?",
        timestamp: "2026-02-20T10:00:00Z",
      },
    ],
  },
  {
    id: "TKT-1010",
    title: "Custom branding logo not displaying in PDF exports",
    customer: "Brandsmith Agency",
    priority: "low",
    status: "resolved",
    assignee: "Alex Rivera",
    category: "Customization",
    created: "2026-02-19T12:00:00Z",
    slaDeadline: "2026-02-26T12:00:00Z",
    slaMinutesRemaining: 8640,
    tier: "pro",
    conversation: [
      {
        id: "m1",
        author: "Nina C.",
        role: "customer",
        content:
          "Our logo shows in the web UI but PDF exports use the default Horizon logo.",
        timestamp: "2026-02-19T12:00:00Z",
      },
      {
        id: "m2",
        author: "Alex Rivera",
        role: "agent",
        content:
          "Hi Nina, PDF exports require logo in SVG or PNG format under 500KB. What format is your uploaded logo?",
        timestamp: "2026-02-19T12:30:00Z",
      },
      {
        id: "m3",
        author: "Nina C.",
        role: "customer",
        content: "It's a WEBP file, 1.2MB.",
        timestamp: "2026-02-19T13:00:00Z",
      },
      {
        id: "m4",
        author: "Alex Rivera",
        role: "agent",
        content:
          "That's the issue — PDF renderer doesn't support WEBP. Converting to PNG and re-uploading should fix it.",
        timestamp: "2026-02-19T13:15:00Z",
      },
      {
        id: "m5",
        author: "Nina C.",
        role: "customer",
        content:
          "Converted and re-uploaded. PDF exports look perfect now. Thanks!",
        timestamp: "2026-02-19T14:00:00Z",
      },
      {
        id: "m6",
        author: "System",
        role: "system",
        content: "Ticket resolved. Customer satisfaction: 5/5.",
        timestamp: "2026-02-19T14:05:00Z",
      },
    ],
  },
  {
    id: "TKT-1011",
    title: "Bulk user import fails silently for large files",
    customer: "GlobalTeam Ltd.",
    priority: "medium",
    status: "pending",
    assignee: "Jordan Lee",
    category: "User Management",
    created: "2026-02-21T09:00:00Z",
    slaDeadline: "2026-02-24T09:00:00Z",
    slaMinutesRemaining: 3780,
    tier: "enterprise",
    conversation: [
      {
        id: "m1",
        author: "Oscar T.",
        role: "customer",
        content:
          "Trying to import 5,000 users from CSV. Upload says 'complete' but only 200 users appear.",
        timestamp: "2026-02-21T09:00:00Z",
      },
      {
        id: "m2",
        author: "Jordan Lee",
        role: "agent",
        content:
          "Oscar, there's a 500-user batch limit per import job. For 5000 users you'd need to split into 10 files — or use our bulk API endpoint which has no limit. Want me to share the API docs?",
        timestamp: "2026-02-21T09:20:00Z",
      },
      {
        id: "m3",
        author: "Oscar T.",
        role: "customer",
        content:
          "The UI says nothing about this limit. Please document it and ideally handle it automatically.",
        timestamp: "2026-02-21T09:35:00Z",
      },
      {
        id: "m4",
        author: "System",
        role: "system",
        content:
          "Product feedback filed: UI-2847 — Add batch limit messaging to user import flow.",
        timestamp: "2026-02-21T09:36:00Z",
      },
    ],
  },
  {
    id: "TKT-1012",
    title: "Search results missing recently created records",
    customer: "FastFind Corp.",
    priority: "medium",
    status: "open",
    assignee: "Morgan Davis",
    category: "Search",
    created: "2026-02-22T07:00:00Z",
    slaDeadline: "2026-02-24T07:00:00Z",
    slaMinutesRemaining: 2860,
    tier: "pro",
    conversation: [
      {
        id: "m1",
        author: "Yuki M.",
        role: "customer",
        content:
          "Records created in the last 2 hours don't appear in search. They show up in the list view fine.",
        timestamp: "2026-02-22T07:00:00Z",
      },
      {
        id: "m2",
        author: "Morgan Davis",
        role: "agent",
        content:
          "Hi Yuki, search index updates run every 15 minutes. Are these records older than 15 minutes and still not indexed?",
        timestamp: "2026-02-22T07:20:00Z",
      },
    ],
  },
]

const ANALYTICS_DATA: DayAnalytics[] = [
  { date: "Feb 9", tickets: 34, resolved: 28, avgResolutionHours: 3.2 },
  { date: "Feb 10", tickets: 41, resolved: 37, avgResolutionHours: 2.8 },
  { date: "Feb 11", tickets: 29, resolved: 26, avgResolutionHours: 3.5 },
  { date: "Feb 12", tickets: 52, resolved: 44, avgResolutionHours: 4.1 },
  { date: "Feb 13", tickets: 47, resolved: 43, avgResolutionHours: 2.9 },
  { date: "Feb 14", tickets: 38, resolved: 31, avgResolutionHours: 3.7 },
  { date: "Feb 15", tickets: 22, resolved: 22, avgResolutionHours: 2.1 },
  { date: "Feb 16", tickets: 19, resolved: 18, avgResolutionHours: 1.9 },
  { date: "Feb 17", tickets: 55, resolved: 48, avgResolutionHours: 4.3 },
  { date: "Feb 18", tickets: 63, resolved: 54, avgResolutionHours: 5.1 },
  { date: "Feb 19", tickets: 48, resolved: 42, avgResolutionHours: 3.8 },
  { date: "Feb 20", tickets: 71, resolved: 59, avgResolutionHours: 6.2 },
  { date: "Feb 21", tickets: 44, resolved: 38, avgResolutionHours: 3.4 },
  { date: "Feb 22", tickets: 12, resolved: 4, avgResolutionHours: 2.3 },
]

const CATEGORY_BREAKDOWN: CategoryBreakdown[] = [
  {
    category: "Authentication",
    count: 87,
    percentage: 22,
    color: "bg-indigo-500",
  },
  { category: "Billing", count: 71, percentage: 18, color: "bg-violet-500" },
  { category: "API", count: 63, percentage: 16, color: "bg-blue-500" },
  { category: "Dashboard", count: 51, percentage: 13, color: "bg-cyan-500" },
  {
    category: "Integrations",
    count: 43,
    percentage: 11,
    color: "bg-emerald-500",
  },
  { category: "Mobile", count: 35, percentage: 9, color: "bg-amber-500" },
  { category: "Reports", count: 24, percentage: 6, color: "bg-rose-500" },
  { category: "Other", count: 20, percentage: 5, color: "bg-zinc-500" },
]

const AGENT_WORKLOAD: AgentWorkload[] = [
  {
    agent: "Jordan Lee",
    openTickets: 8,
    resolvedToday: 12,
    avgHandleTime: "1h 42m",
    satisfactionScore: 4.8,
  },
  {
    agent: "Alex Rivera",
    openTickets: 6,
    resolvedToday: 9,
    avgHandleTime: "2h 05m",
    satisfactionScore: 4.6,
  },
  {
    agent: "Morgan Davis",
    openTickets: 9,
    resolvedToday: 7,
    avgHandleTime: "2h 31m",
    satisfactionScore: 4.4,
  },
  {
    agent: "Sam Chen",
    openTickets: 5,
    resolvedToday: 14,
    avgHandleTime: "1h 18m",
    satisfactionScore: 4.9,
  },
  {
    agent: "Riley Kim",
    openTickets: 7,
    resolvedToday: 11,
    avgHandleTime: "1h 55m",
    satisfactionScore: 4.7,
  },
]

const SLA_COMPLIANCE: SLACompliance[] = [
  {
    tier: "enterprise",
    total: 142,
    compliant: 136,
    breached: 6,
    complianceRate: 95.8,
    avgResponseTime: "18m",
    avgResolutionTime: "3h 12m",
  },
  {
    tier: "pro",
    total: 298,
    compliant: 274,
    breached: 24,
    complianceRate: 91.9,
    avgResponseTime: "1h 22m",
    avgResolutionTime: "8h 45m",
  },
  {
    tier: "free",
    total: 184,
    compliant: 149,
    breached: 35,
    complianceRate: 80.9,
    avgResponseTime: "5h 07m",
    avgResolutionTime: "26h 18m",
  },
]

const SLA_BREACHES: SLABreach[] = [
  {
    id: "B001",
    ticketId: "TKT-1005",
    ticketTitle: "Mobile app crashes on iOS 18.3",
    customer: "RetailEdge",
    tier: "enterprise",
    breachType: "resolution",
    breachedAt: "2026-02-22T06:00:00Z",
    overdueDuration: "45m",
    assignee: "Morgan Davis",
  },
  {
    id: "B002",
    ticketId: "TKT-0987",
    ticketTitle: "Data migration stuck at 67%",
    customer: "Vertex Systems",
    tier: "enterprise",
    breachType: "resolution",
    breachedAt: "2026-02-21T14:00:00Z",
    overdueDuration: "2h 15m",
    assignee: "Jordan Lee",
  },
  {
    id: "B003",
    ticketId: "TKT-0956",
    ticketTitle: "Audit log export corrupted",
    customer: "CompliancePro",
    tier: "enterprise",
    breachType: "response",
    breachedAt: "2026-02-20T10:30:00Z",
    overdueDuration: "35m",
    assignee: "Alex Rivera",
  },
  {
    id: "B004",
    ticketId: "TKT-0934",
    ticketTitle: "SFTP sync fails intermittently",
    customer: "DataBridge Corp",
    tier: "pro",
    breachType: "resolution",
    breachedAt: "2026-02-19T16:00:00Z",
    overdueDuration: "4h 20m",
    assignee: "Sam Chen",
  },
  {
    id: "B005",
    ticketId: "TKT-0921",
    ticketTitle: "Invoice PDF watermark missing",
    customer: "InvoiceNow",
    tier: "pro",
    breachType: "resolution",
    breachedAt: "2026-02-18T12:00:00Z",
    overdueDuration: "1h 08m",
    assignee: "Riley Kim",
  },
]

const SLA_POLICIES: SLAPolicy[] = [
  {
    tier: "enterprise",
    responseTarget: "30 minutes",
    resolutionTarget: "4 hours",
    priorityOverrides: [
      { priority: "critical", response: "15 min", resolution: "1 hour" },
      { priority: "high", response: "30 min", resolution: "4 hours" },
      { priority: "medium", response: "2 hours", resolution: "24 hours" },
      { priority: "low", response: "4 hours", resolution: "72 hours" },
    ],
  },
  {
    tier: "pro",
    responseTarget: "2 hours",
    resolutionTarget: "12 hours",
    priorityOverrides: [
      { priority: "critical", response: "30 min", resolution: "4 hours" },
      { priority: "high", response: "2 hours", resolution: "12 hours" },
      { priority: "medium", response: "8 hours", resolution: "48 hours" },
      { priority: "low", response: "24 hours", resolution: "7 days" },
    ],
  },
  {
    tier: "free",
    responseTarget: "24 hours",
    resolutionTarget: "72 hours",
    priorityOverrides: [
      { priority: "critical", response: "4 hours", resolution: "24 hours" },
      { priority: "high", response: "24 hours", resolution: "72 hours" },
      { priority: "medium", response: "48 hours", resolution: "7 days" },
      { priority: "low", response: "72 hours", resolution: "14 days" },
    ],
  },
]

const AT_RISK_TICKETS: AtRiskTicket[] = [
  {
    id: "TKT-1001",
    title: "Payment processing fails on checkout",
    customer: "Acme Corp",
    tier: "enterprise",
    priority: "critical",
    minutesRemaining: 23,
    assignee: "Jordan Lee",
  },
  {
    id: "TKT-1004",
    title: "API rate limit too restrictive for batch jobs",
    customer: "DataStream Inc.",
    tier: "pro",
    priority: "high",
    minutesRemaining: 98,
    assignee: "Jordan Lee",
  },
  {
    id: "TKT-1008",
    title: "Two-factor authentication emails not delivered",
    customer: "SecureVault",
    tier: "pro",
    priority: "high",
    minutesRemaining: 155,
    assignee: "Morgan Davis",
  },
  {
    id: "TKT-1002",
    title: "SSO login loop with SAML provider",
    customer: "Meridian Health",
    tier: "enterprise",
    priority: "high",
    minutesRemaining: 187,
    assignee: "Alex Rivera",
  },
  {
    id: "TKT-1007",
    title: "Webhook deliveries failing with 500 errors",
    customer: "CloudBase Inc.",
    tier: "enterprise",
    priority: "high",
    minutesRemaining: 225,
    assignee: "Sam Chen",
  },
]

const KB_ARTICLES: KBArticle[] = [
  {
    id: "KB-001",
    title: "How to configure SAML SSO with Okta",
    category: "Authentication",
    views: 8420,
    helpfulnessRate: 94,
    deflectionRate: 78,
    linkedTickets: 143,
    lastUpdated: "2026-02-10",
  },
  {
    id: "KB-002",
    title: "Understanding API rate limits and burst mode",
    category: "API",
    views: 6750,
    helpfulnessRate: 91,
    deflectionRate: 72,
    linkedTickets: 98,
    lastUpdated: "2026-02-15",
  },
  {
    id: "KB-003",
    title: "Troubleshooting 2FA email delivery issues",
    category: "Authentication",
    views: 5830,
    helpfulnessRate: 88,
    deflectionRate: 69,
    linkedTickets: 87,
    lastUpdated: "2026-02-12",
  },
  {
    id: "KB-004",
    title: "CSV export formats and date localization",
    category: "Data Export",
    views: 4210,
    helpfulnessRate: 85,
    deflectionRate: 65,
    linkedTickets: 64,
    lastUpdated: "2026-01-28",
  },
  {
    id: "KB-005",
    title: "Setting up webhook endpoints and debugging failures",
    category: "Integrations",
    views: 3990,
    helpfulnessRate: 90,
    deflectionRate: 71,
    linkedTickets: 76,
    lastUpdated: "2026-02-08",
  },
  {
    id: "KB-006",
    title: "Mobile app compatibility guide by OS version",
    category: "Mobile",
    views: 3640,
    helpfulnessRate: 82,
    deflectionRate: 58,
    linkedTickets: 52,
    lastUpdated: "2026-02-18",
  },
  {
    id: "KB-007",
    title: "Bulk user import: limits, formats, and API guide",
    category: "User Management",
    views: 2980,
    helpfulnessRate: 87,
    deflectionRate: 63,
    linkedTickets: 44,
    lastUpdated: "2026-02-05",
  },
  {
    id: "KB-008",
    title: "Custom branding: logo formats and PDF exports",
    category: "Customization",
    views: 2760,
    helpfulnessRate: 92,
    deflectionRate: 81,
    linkedTickets: 38,
    lastUpdated: "2026-01-20",
  },
  {
    id: "KB-009",
    title: "Report scheduler timezone configuration",
    category: "Reports",
    views: 2340,
    helpfulnessRate: 79,
    deflectionRate: 55,
    linkedTickets: 31,
    lastUpdated: "2026-01-15",
  },
  {
    id: "KB-010",
    title: "Search indexing latency and real-time search",
    category: "Search",
    views: 1980,
    helpfulnessRate: 83,
    deflectionRate: 60,
    linkedTickets: 27,
    lastUpdated: "2026-02-01",
  },
]

const SUGGESTED_ARTICLES: SuggestedArticle[] = [
  {
    articleId: "KB-002",
    articleTitle: "Understanding API rate limits and burst mode",
    ticketId: "TKT-1004",
    ticketTitle: "API rate limit too restrictive for batch jobs",
    relevanceScore: 97,
  },
  {
    articleId: "KB-001",
    articleTitle: "How to configure SAML SSO with Okta",
    ticketId: "TKT-1002",
    ticketTitle: "SSO login loop with SAML provider",
    relevanceScore: 95,
  },
  {
    articleId: "KB-003",
    articleTitle: "Troubleshooting 2FA email delivery issues",
    ticketId: "TKT-1008",
    ticketTitle: "Two-factor authentication emails not delivered",
    relevanceScore: 93,
  },
  {
    articleId: "KB-005",
    articleTitle: "Setting up webhook endpoints and debugging failures",
    ticketId: "TKT-1007",
    ticketTitle: "Webhook deliveries failing with 500 errors",
    relevanceScore: 91,
  },
  {
    articleId: "KB-010",
    articleTitle: "Search indexing latency and real-time search",
    ticketId: "TKT-1012",
    ticketTitle: "Search results missing recently created records",
    relevanceScore: 88,
  },
  {
    articleId: "KB-006",
    articleTitle: "Mobile app compatibility guide by OS version",
    ticketId: "TKT-1005",
    ticketTitle: "Mobile app crashes on iOS 18.3",
    relevanceScore: 86,
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPriorityClasses(priority: Priority): string {
  switch (priority) {
    case "critical":
      return "text-red-400 bg-red-400/10 border-red-400/30"
    case "high":
      return "text-orange-400 bg-orange-400/10 border-orange-400/30"
    case "medium":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
    case "low":
      return "text-zinc-400 bg-zinc-400/10 border-zinc-400/30"
  }
}

function getStatusClasses(status: TicketStatus): string {
  switch (status) {
    case "open":
      return "text-blue-400 bg-blue-400/10"
    case "in-progress":
      return "text-indigo-400 bg-indigo-400/10"
    case "pending":
      return "text-amber-400 bg-amber-400/10"
    case "resolved":
      return "text-emerald-400 bg-emerald-400/10"
  }
}

function getTierClasses(tier: SLATier): string {
  switch (tier) {
    case "enterprise":
      return "text-violet-400 bg-violet-400/10 border-violet-400/30"
    case "pro":
      return "text-indigo-400 bg-indigo-400/10 border-indigo-400/30"
    case "free":
      return "text-zinc-400 bg-zinc-400/10 border-zinc-400/30"
  }
}

function getSLAUrgencyClass(minutes: number): string {
  if (minutes < 0) return "text-red-400"
  if (minutes < 60) return "text-red-400"
  if (minutes < 240) return "text-amber-400"
  return "text-emerald-400"
}

function getComplianceClass(rate: number): string {
  if (rate >= 95) return "text-emerald-400"
  if (rate >= 90) return "text-amber-400"
  return "text-red-400"
}

function getComplianceBarClass(rate: number): string {
  if (rate >= 95) return "bg-emerald-500"
  if (rate >= 90) return "bg-amber-500"
  return "bg-red-500"
}

function formatSLATime(minutes: number): string {
  if (minutes < 0) {
    const abs = Math.abs(minutes)
    if (abs < 60) return `-${abs}m`
    return `-${Math.floor(abs / 60)}h ${abs % 60}m`
  }
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusLabel(status: TicketStatus): string {
  if (status === "in-progress") return "In Progress"
  return capitalize(status)
}

// ─── Small shared components ──────────────────────────────────────────────────

interface PriorityBadgeProps {
  priority: Priority
}
function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded border",
        getPriorityClasses(priority)
      )}
    >
      {capitalize(priority)}
    </span>
  )
}

interface StatusBadgeProps {
  status: TicketStatus
}
function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded",
        getStatusClasses(status)
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

interface TierBadgeProps {
  tier: SLATier
}
function TierBadge({ tier }: TierBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded border",
        getTierClasses(tier)
      )}
    >
      {capitalize(tier)}
    </span>
  )
}

// ─── Queue Tab ────────────────────────────────────────────────────────────────

interface QueueTabProps {
  tickets: Ticket[]
}

function QueueTab({ tickets }: QueueTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all")
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all")

  const priorityOrder: Record<Priority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  const filtered = tickets
    .filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false
      if (filterPriority !== "all" && t.priority !== filterPriority)
        return false
      return true
    })
    .slice()
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  const selected = tickets.find((t) => t.id === selectedId) ?? null

  return (
    <div className="flex gap-4">
      {/* Left: Ticket list */}
      <div
        className={cn(
          "flex flex-col gap-2 transition-all",
          selected ? "w-[44%]" : "w-full"
        )}
      >
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as TicketStatus | "all")
            }
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as Priority | "all")
            }
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span className="ml-auto text-sm text-zinc-500">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Ticket rows */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[70vh]">
          {filtered.map((ticket) => {
            const isSelected = selectedId === ticket.id
            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedId(isSelected ? null : ticket.id)}
                className={cn(
                  "bg-zinc-900 border rounded-lg p-3.5 cursor-pointer hover:border-indigo-500/40 transition-colors",
                  isSelected ? "border-indigo-500" : "border-zinc-800"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs text-zinc-500 font-mono">
                        {ticket.id}
                      </span>
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="text-sm font-medium text-white leading-snug">
                      {ticket.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500 flex-wrap">
                      <span>{ticket.customer}</span>
                      <span className="text-zinc-700">·</span>
                      <span>{ticket.category}</span>
                      <span className="text-zinc-700">·</span>
                      <span>{ticket.assignee}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <TierBadge tier={ticket.tier} />
                    <span
                      className={cn(
                        "text-xs font-mono font-bold",
                        getSLAUrgencyClass(ticket.slaMinutesRemaining)
                      )}
                    >
                      {ticket.slaMinutesRemaining < 0 ? "BREACH " : "SLA "}
                      {formatSLATime(ticket.slaMinutesRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Detail panel */}
      {selected && (
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden max-h-[76vh]">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-zinc-800 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500 font-mono">
                  {selected.id}
                </span>
                <PriorityBadge priority={selected.priority} />
                <StatusBadge status={selected.status} />
                <TierBadge tier={selected.tier} />
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-zinc-500 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                aria-label="Close detail panel"
              >
                &times;
              </button>
            </div>
            <h2 className="text-white font-semibold text-base leading-snug">
              {selected.title}
            </h2>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 mt-3">
              {[
                { label: "Customer", value: selected.customer },
                { label: "Assignee", value: selected.assignee },
                {
                  label: "SLA",
                  value: (
                    <span
                      className={cn(
                        "font-semibold",
                        getSLAUrgencyClass(selected.slaMinutesRemaining)
                      )}
                    >
                      {selected.slaMinutesRemaining < 0 ? "BREACHED " : ""}
                      {formatSLATime(selected.slaMinutesRemaining)}
                    </span>
                  ),
                },
                { label: "Category", value: selected.category },
                {
                  label: "Created",
                  value: formatTimestamp(selected.created),
                },
              ].map((field, i) => (
                <div key={i}>
                  <div className="text-xs text-zinc-500 mb-0.5">
                    {field.label}
                  </div>
                  <div className="text-sm text-white">{field.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversation thread */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Conversation ({selected.conversation.length} messages)
            </p>
            {selected.conversation.map((msg) => {
              if (msg.role === "system") {
                return (
                  <div
                    key={msg.id}
                    className="text-center text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2"
                  >
                    {msg.content}
                    <span className="ml-2 text-zinc-600">
                      · {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                )
              }
              const isAgent = msg.role === "agent"
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-xl p-3.5 text-sm",
                    isAgent
                      ? "bg-indigo-600/15 border border-indigo-500/25 ml-8"
                      : "bg-zinc-800 mr-8"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isAgent ? "text-indigo-300" : "text-white"
                      )}
                    >
                      {msg.author}
                      {isAgent && (
                        <span className="ml-1.5 text-indigo-500 font-normal">
                          · Agent
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed">{msg.content}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const maxTickets = Math.max(...ANALYTICS_DATA.map((d) => d.tickets))
  const maxResolution = Math.max(
    ...ANALYTICS_DATA.map((d) => d.avgResolutionHours)
  )

  const totalTickets = ANALYTICS_DATA.reduce((sum, d) => sum + d.tickets, 0)
  const totalResolved = ANALYTICS_DATA.reduce((sum, d) => sum + d.resolved, 0)
  const resolutionRate = ((totalResolved / totalTickets) * 100).toFixed(1)
  const avgResolution = (
    ANALYTICS_DATA.reduce((sum, d) => sum + d.avgResolutionHours, 0) /
    ANALYTICS_DATA.length
  ).toFixed(1)

  return (
    <div className="flex flex-col gap-5">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total Tickets (14d)",
            value: totalTickets.toString(),
            sub: "submitted",
            color: "text-white",
          },
          {
            label: "Resolved (14d)",
            value: totalResolved.toString(),
            sub: "closed",
            color: "text-emerald-400",
          },
          {
            label: "Resolution Rate",
            value: `${resolutionRate}%`,
            sub: "of submitted",
            color: "text-indigo-400",
          },
          {
            label: "Avg Resolution",
            value: `${avgResolution}h`,
            sub: "to close",
            color: "text-amber-400",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <div className="text-xs text-zinc-500 mb-1">{kpi.label}</div>
            <div className={cn("text-2xl font-bold", kpi.color)}>
              {kpi.value}
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar chart: ticket volume */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-0.5">
            Ticket Volume — Last 14 Days
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            New and resolved tickets per day
          </p>
          <div className="flex items-end gap-1" style={{ height: 144 }}>
            {ANALYTICS_DATA.map((day) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col justify-end gap-0.5 group relative"
                style={{ height: "100%" }}
              >
                {/* Tooltip */}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-700 border border-zinc-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                  {day.date}: {day.tickets} in / {day.resolved} out
                </div>
                {/* Submitted bar */}
                <div
                  className="w-full bg-indigo-500/70 rounded-t"
                  style={{
                    height: `${(day.tickets / maxTickets) * 100}%`,
                  }}
                />
                {/* Resolved overlay indicator */}
                <div
                  className="w-full bg-emerald-500/40 rounded-t absolute bottom-0 left-0"
                  style={{
                    height: `${(day.resolved / maxTickets) * 100}%`,
                  }}
                />
              </div>
            ))}
          </div>
          {/* x-axis labels */}
          <div className="flex gap-1 mt-1.5">
            {ANALYTICS_DATA.map((day, i) => (
              <div key={day.date} className="flex-1 text-center">
                {i % 2 === 0 ? (
                  <span className="text-zinc-600 text-[9px]">
                    {day.date.split(" ")[1]}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/70 inline-block" />
              Submitted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 inline-block" />
              Resolved
            </span>
          </div>
        </div>

        {/* Bar chart: avg resolution time */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-0.5">
            Avg Resolution Time Trend
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Hours to resolve, daily average
          </p>
          <div className="flex items-end gap-1 relative" style={{ height: 144 }}>
            {/* Reference line at average */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-zinc-700 z-10"
              style={{
                bottom: `${(parseFloat(avgResolution) / maxResolution) * 100}%`,
              }}
            />
            {ANALYTICS_DATA.map((day) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col justify-end group relative"
                style={{ height: "100%" }}
              >
                <div
                  className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-700 border border-zinc-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none"
                >
                  {day.date}: {day.avgResolutionHours}h
                </div>
                <div
                  className={cn(
                    "w-full rounded-t",
                    day.avgResolutionHours > parseFloat(avgResolution)
                      ? "bg-amber-500/70"
                      : "bg-violet-500/70"
                  )}
                  style={{
                    height: `${(day.avgResolutionHours / maxResolution) * 100}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1.5">
            {ANALYTICS_DATA.map((day, i) => (
              <div key={day.date} className="flex-1 text-center">
                {i % 2 === 0 ? (
                  <span className="text-zinc-600 text-[9px]">
                    {day.date.split(" ")[1]}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>
              Min:{" "}
              {Math.min(...ANALYTICS_DATA.map((d) => d.avgResolutionHours)).toFixed(1)}
              h
            </span>
            <span>Avg: {avgResolution}h (dashed)</span>
            <span>Max: {maxResolution.toFixed(1)}h</span>
          </div>
        </div>
      </div>

      {/* Category breakdown + Team workload */}
      <div className="grid grid-cols-2 gap-4">
        {/* Category breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Tickets by Category
          </h3>
          <div className="flex flex-col gap-2.5">
            {CATEGORY_BREAKDOWN.map((cat) => (
              <div key={cat.category} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-28 shrink-0">
                  {cat.category}
                </span>
                <div className="flex-1 bg-zinc-800 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full", cat.color)}
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-zinc-300 w-8 text-right">
                  {cat.percentage}%
                </span>
                <span className="text-xs text-zinc-600 w-6 text-right">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Team workload table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Team Workload
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                <th className="text-left pb-2.5 font-medium">Agent</th>
                <th className="text-right pb-2.5 font-medium">Open</th>
                <th className="text-right pb-2.5 font-medium">Resolved</th>
                <th className="text-right pb-2.5 font-medium">Avg Time</th>
                <th className="text-right pb-2.5 font-medium">CSAT</th>
              </tr>
            </thead>
            <tbody>
              {AGENT_WORKLOAD.map((row) => (
                <tr key={row.agent} className="border-b border-zinc-800/50">
                  <td className="py-2.5 text-white">{row.agent}</td>
                  <td className="py-2.5 text-right text-amber-400 font-medium">
                    {row.openTickets}
                  </td>
                  <td className="py-2.5 text-right text-emerald-400 font-medium">
                    {row.resolvedToday}
                  </td>
                  <td className="py-2.5 text-right text-zinc-300">
                    {row.avgHandleTime}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={cn(
                        "font-bold",
                        row.satisfactionScore >= 4.8
                          ? "text-emerald-400"
                          : row.satisfactionScore >= 4.5
                          ? "text-indigo-400"
                          : "text-zinc-300"
                      )}
                    >
                      {row.satisfactionScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── SLA Dashboard Tab ────────────────────────────────────────────────────────

function SLADashboardTab() {
  return (
    <div className="flex flex-col gap-5">
      {/* Compliance by tier */}
      <div className="grid grid-cols-3 gap-4">
        {SLA_COMPLIANCE.map((tier) => (
          <div
            key={tier.tier}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <TierBadge tier={tier.tier} />
              <span
                className={cn(
                  "text-2xl font-bold",
                  getComplianceClass(tier.complianceRate)
                )}
              >
                {tier.complianceRate}%
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-4">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  getComplianceBarClass(tier.complianceRate)
                )}
                style={{ width: `${tier.complianceRate}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs border-b border-zinc-800 pb-3 mb-3">
              <div>
                <div className="text-zinc-500 mb-0.5">Total</div>
                <div className="text-white font-semibold">{tier.total}</div>
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5">Compliant</div>
                <div className="text-emerald-400 font-semibold">
                  {tier.compliant}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5">Breached</div>
                <div className="text-red-400 font-semibold">{tier.breached}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-zinc-500">Avg Response</div>
                <div className="text-white font-medium">
                  {tier.avgResponseTime}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Avg Resolution</div>
                <div className="text-white font-medium">
                  {tier.avgResolutionTime}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SLA Policy cards */}
      <div className="grid grid-cols-3 gap-4">
        {SLA_POLICIES.map((policy) => (
          <div
            key={policy.tier}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <TierBadge tier={policy.tier} />
              <span className="text-xs text-zinc-500">Policy</span>
            </div>
            <div className="flex gap-5 mb-4 text-xs">
              <div>
                <div className="text-zinc-500 mb-0.5">Default Response</div>
                <div className="text-white font-semibold">
                  {policy.responseTarget}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5">Default Resolution</div>
                <div className="text-white font-semibold">
                  {policy.resolutionTarget}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-xs text-zinc-600 uppercase tracking-wider mb-0.5">
                By Priority
              </div>
              {policy.priorityOverrides.map((override) => (
                <div
                  key={override.priority}
                  className="flex items-center gap-2 text-xs"
                >
                  <PriorityBadge priority={override.priority} />
                  <span className="text-zinc-400">{override.response}</span>
                  <span className="text-zinc-700">/</span>
                  <span className="text-zinc-500">{override.resolution}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* At-risk tickets + Breach history */}
      <div className="grid grid-cols-2 gap-4">
        {/* At-risk */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-white">
              At-Risk Tickets
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
              {AT_RISK_TICKETS.length} active
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {AT_RISK_TICKETS.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center gap-3 py-2.5 border-b border-zinc-800/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-xs text-zinc-500 font-mono">
                      {ticket.id}
                    </span>
                    <PriorityBadge priority={ticket.priority} />
                    <TierBadge tier={ticket.tier} />
                  </div>
                  <p className="text-xs text-white truncate">{ticket.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {ticket.customer} · {ticket.assignee}
                  </p>
                </div>
                <div
                  className={cn(
                    "text-sm font-bold font-mono shrink-0",
                    getSLAUrgencyClass(ticket.minutesRemaining)
                  )}
                >
                  {formatSLATime(ticket.minutesRemaining)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breach history */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Breach History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left pb-2.5 font-medium">Ticket</th>
                  <th className="text-left pb-2.5 font-medium">Tier</th>
                  <th className="text-left pb-2.5 font-medium">Type</th>
                  <th className="text-left pb-2.5 font-medium">Assignee</th>
                  <th className="text-right pb-2.5 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {SLA_BREACHES.map((breach) => (
                  <tr key={breach.id} className="border-b border-zinc-800/50">
                    <td className="py-2">
                      <div className="font-mono text-zinc-500">
                        {breach.ticketId}
                      </div>
                      <div className="text-white max-w-[130px] truncate">
                        {breach.ticketTitle}
                      </div>
                      <div className="text-zinc-600">{breach.customer}</div>
                    </td>
                    <td className="py-2">
                      <TierBadge tier={breach.tier} />
                    </td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          breach.breachType === "response"
                            ? "bg-orange-400/10 text-orange-400"
                            : "bg-red-400/10 text-red-400"
                        )}
                      >
                        {capitalize(breach.breachType)}
                      </span>
                    </td>
                    <td className="py-2 text-zinc-400">{breach.assignee}</td>
                    <td className="py-2 text-right text-red-400 font-mono font-bold">
                      +{breach.overdueDuration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Knowledge Base Tab ───────────────────────────────────────────────────────

function KnowledgeBaseTab() {
  const [highlightedArticle, setHighlightedArticle] = useState<string | null>(
    null
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Top articles + Suggested articles */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top by deflection rate */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">
            Top Articles by Deflection Rate
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Articles that prevent the most tickets from being created
          </p>
          <div className="flex flex-col gap-1">
            {KB_ARTICLES.slice(0, 5).map((article, idx) => (
              <div
                key={article.id}
                onClick={() =>
                  setHighlightedArticle(
                    highlightedArticle === article.id ? null : article.id
                  )
                }
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                  highlightedArticle === article.id
                    ? "bg-zinc-800 ring-1 ring-inset ring-indigo-500/40"
                    : "hover:bg-zinc-800/60"
                )}
              >
                <span className="text-zinc-600 text-sm font-bold w-5 text-center shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{article.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {article.category} ·{" "}
                    {article.views.toLocaleString("en-US")} views
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-emerald-400">
                    {article.deflectionRate}%
                  </div>
                  <div className="text-xs text-zinc-600">deflection</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested for open tickets */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">
            Suggested Articles for Open Tickets
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            AI-matched articles that may resolve open tickets
          </p>
          <div className="flex flex-col gap-2">
            {SUGGESTED_ARTICLES.map((suggestion) => (
              <div
                key={`${suggestion.articleId}-${suggestion.ticketId}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-indigo-400 truncate">
                    {suggestion.articleTitle}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    for{" "}
                    <span className="text-zinc-400 font-mono">
                      {suggestion.ticketId}
                    </span>{" "}
                    — {suggestion.ticketTitle}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      "text-xs font-bold",
                      suggestion.relevanceScore >= 95
                        ? "text-emerald-400"
                        : suggestion.relevanceScore >= 90
                        ? "text-indigo-400"
                        : "text-amber-400"
                    )}
                  >
                    {suggestion.relevanceScore}%
                  </div>
                  <div className="text-xs text-zinc-600">match</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Article performance table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">
          Article Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                <th className="text-left pb-3 font-medium">Article</th>
                <th className="text-left pb-3 font-medium">Category</th>
                <th className="text-right pb-3 font-medium">Views</th>
                <th className="text-right pb-3 font-medium">Helpfulness</th>
                <th className="text-right pb-3 font-medium">Deflection</th>
                <th className="text-right pb-3 font-medium">Linked</th>
                <th className="text-right pb-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {KB_ARTICLES.map((article) => (
                <tr
                  key={article.id}
                  className={cn(
                    "border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30",
                    highlightedArticle === article.id && "bg-indigo-500/5"
                  )}
                >
                  <td className="py-3">
                    <div className="text-white font-medium leading-snug">
                      {article.title}
                    </div>
                    <div className="text-xs text-zinc-600 font-mono">
                      {article.id}
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">
                      {article.category}
                    </span>
                  </td>
                  <td className="py-3 text-right text-zinc-300">
                    {article.views.toLocaleString("en-US")}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 bg-zinc-800 rounded-full h-1.5">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            article.helpfulnessRate >= 90
                              ? "bg-emerald-500"
                              : article.helpfulnessRate >= 80
                              ? "bg-indigo-500"
                              : "bg-amber-500"
                          )}
                          style={{ width: `${article.helpfulnessRate}%` }}
                        />
                      </div>
                      <span className="text-zinc-300 text-xs w-8">
                        {article.helpfulnessRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        article.deflectionRate >= 70
                          ? "text-emerald-400"
                          : article.deflectionRate >= 60
                          ? "text-indigo-400"
                          : "text-zinc-400"
                      )}
                    >
                      {article.deflectionRate}%
                    </span>
                  </td>
                  <td className="py-3 text-right text-zinc-400">
                    {article.linkedTickets}
                  </td>
                  <td className="py-3 text-right text-zinc-500 text-xs">
                    {article.lastUpdated}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

interface TabConfig {
  id: TabId
  label: string
  count?: number
}

export default function SupportTicketDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("queue")

  const tabs: TabConfig[] = [
    {
      id: "queue",
      label: "Queue",
      count: TICKETS.filter((t) => t.status !== "resolved").length,
    },
    { id: "analytics", label: "Analytics" },
    { id: "sla", label: "SLA Dashboard", count: SLA_BREACHES.length },
    { id: "knowledge", label: "Knowledge Base", count: KB_ARTICLES.length },
  ]

  const breachedCount = TICKETS.filter(
    (t) => t.slaMinutesRemaining < 0
  ).length

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Support Ticket Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Horizon UI · Manage, analyze, and resolve customer support
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              {breachedCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  {breachedCount} breached
                </span>
              )}
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                {AT_RISK_TICKETS.length} at-risk
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                {TICKETS.filter((t) => t.status === "resolved").length} resolved
              </span>
            </div>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              + New Ticket
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 border-b border-zinc-800 mb-6">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  isActive
                    ? "text-white border-indigo-500"
                    : "text-zinc-400 border-transparent hover:text-zinc-200 hover:border-zinc-700"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full font-medium",
                      isActive
                        ? "bg-indigo-500/25 text-indigo-300"
                        : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "queue" && <QueueTab tickets={TICKETS} />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "sla" && <SLADashboardTab />}
          {activeTab === "knowledge" && <KnowledgeBaseTab />}
        </div>
      </div>
    </div>
  )
}
