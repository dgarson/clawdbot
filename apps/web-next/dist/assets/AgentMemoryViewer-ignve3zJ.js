import{r,j as e,c as o}from"./index-CfJpWGW4.js";const c=[{id:"mem-luis-d1",agentId:"luis",agentName:"Luis",agentEmoji:"🎨",kind:"daily",date:"2026-02-22",title:"Feb 22 — Sprint: 52 Horizon UI Views",content:`## Session Notes

**Goal:** Horizon UI sprint — 40 views by 7:30 AM MST
**Status:** 52 views committed by 2:15 AM — 5× over goal

### Views shipped this session (#20-#52)
Built AuditLog, BillingSubscription, SystemHealth, IntegrationHub, TeamManagement, GlobalSearch, PromptLibrary, DataExportManager, VoiceInterface, AgentInsights, DeveloperConsole, SecurityDashboard, ChangelogView, EnvironmentManager, FeatureFlags, AgentComparison, KnowledgeBase, CrashReporter, ModelBenchmark, RateLimitDashboard, TaskQueue, StorageExplorer, AlertCenter, WebhookManager, ConversationHistory, AgentScheduler, TokenLedger, ThemeEditor, PermissionsManager, ActivityFeed, CommandPalette, SupportCenter, ReleasePipeline.

### Key decisions
- All views: zinc-950/900/800 dark theme, indigo-500 accent, Tailwind only
- No lucide-react anywhere — emoji or inline SVG only
- Build verification before every commit (pnpm build, 0 TS errors)
- Delegated 10+ views to squad (Piper×3, Quinn×2, Reed×3, Wes×3)

### Agent collaboration
Piper: TeamManagement, AgentComparison, ThemeEditor, SupportCenter
Quinn: BillingSubscription, ConversationHistory, OnboardingChecklist
Reed: DeveloperConsole, ChangelogView, PermissionsManager, ReleasePipeline  
Wes: DataExportManager, CrashReporter, WebhookManager, AnalyticsOverview`,wordCount:187,lastModified:"2026-02-22T02:15:00Z",tags:["sprint","horizon-ui","views"],significant:!0},{id:"mem-luis-lt1",agentId:"luis",agentName:"Luis",agentEmoji:"🎨",kind:"longterm",date:"2026-02-01",title:"Horizon UI Design System Decisions",content:`## Horizon UI — Canonical Design Decisions

### Stack
- Vite + React 18 + TypeScript (strict) + Tailwind CSS
- No component library (pure Tailwind utility classes)
- Single App.tsx shell, all views React.lazy() loaded

### Color System
- Background hierarchy: zinc-950 → zinc-900 → zinc-800
- Text hierarchy: white → zinc-300 → zinc-400 → zinc-500 → zinc-600
- Accent: indigo-500/600 (primary actions, focus rings, selection)
- Success: emerald-400, Error: rose-400, Warning: amber-400, Info: blue-400

### Component Patterns
- All interactive elements: focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none
- Cards: rounded-xl bg-zinc-900 border border-zinc-800
- Buttons: rounded-lg, variants (primary indigo, secondary zinc-800, danger rose)
- Master/detail: 280-320px sidebar + flex-1 content

### Accessibility
- ARIA roles throughout: listbox/option, tab/tablist, switch, dialog, feed, tree
- aria-selected, aria-expanded, aria-checked on all stateful elements
- Focus management in modals (trap + restore)`,wordCount:156,lastModified:"2026-02-15T10:00:00Z",tags:["design-system","decisions","ux"],significant:!0},{id:"mem-luis-ctx",agentId:"luis",agentName:"Luis",agentEmoji:"🎨",kind:"context",date:"2026-02-22",title:"Active Sprint: Horizon UI",content:`Active sprint: Building Horizon UI views for the OpenClaw web app.
Repo: dgarson/clawdbot | Branch: master | App: apps/web-next
Build: pnpm build (NOT pnpm check — doesn't exist)
Squad: Piper, Quinn, Reed, Wes — all delegated via sessions_spawn
Current view count: 52 | Goal exceeded by 5×`,wordCount:52,lastModified:"2026-02-22T02:00:00Z",tags:["sprint","active"]},{id:"mem-xavier-d1",agentId:"xavier",agentName:"Xavier",agentEmoji:"🎯",kind:"daily",date:"2026-02-22",title:"Feb 22 — Sprint Review Prep",content:`## Sprint Status Review

Reviewing Horizon UI sprint progress for morning standup.
Luis has shipped 52 views vs 10-12 target — extraordinary output.
Key concerns: test coverage, PR not yet opened to dgarson/fork.
Action items: request PR from Luis, schedule design review with David.`,wordCount:48,lastModified:"2026-02-22T01:00:00Z",tags:["sprint","review"]},{id:"mem-xavier-lt1",agentId:"xavier",agentName:"Xavier",agentEmoji:"🎯",kind:"longterm",date:"2026-01-15",title:"Product Priorities Q1 2026",content:`## Q1 2026 Product Priorities

1. **Horizon UI MVP** — Ship production-ready UI for OpenClaw platform
2. **Agent reliability** — Reduce session failure rate from 4% to <1%
3. **Provider diversity** — Reduce Anthropic dependency from 80% to 50%
4. **Team growth** — Onboard 3 new agents by end of quarter

Key metric: Daily active sessions should reach 500 by March 31.`,wordCount:72,lastModified:"2026-01-15T09:00:00Z",tags:["product","q1","priorities"],significant:!0},{id:"mem-stephan-d1",agentId:"stephan",agentName:"Stephan",agentEmoji:"📣",kind:"daily",date:"2026-02-21",title:"Feb 21 — Brand Voice Review",content:`Reviewed 4 landing page variants. Approved v3 with adjusted headline.
Notes: tone should be confident but not arrogant — "powerful" not "best".
Next: coordinate with Luis on Horizon UI copy once views are ready.`,wordCount:38,lastModified:"2026-02-21T16:00:00Z",tags:["brand","copy"]},{id:"mem-tim-lt1",agentId:"tim",agentName:"Tim",agentEmoji:"🏗️",kind:"longterm",date:"2026-01-20",title:"Frontend Architecture: Megabranch Protocol",content:`## Megabranch Workflow — Canonical Protocol

All feature work branches from dgarson/fork, not main.
Main is upstream only — David merges to openclaw/openclaw.
Luis owns feat/horizon-ui megabranch.
Workers (Piper/Quinn/Reed/Wes) cut branches off Luis's megabranch.

PRs: worker → Luis's megabranch (Luis reviews)
Then: Luis's megabranch → dgarson/fork (Tim reviews)
Then: dgarson/fork → openclaw/openclaw (David approves)`,wordCount:74,lastModified:"2026-01-20T14:00:00Z",tags:["architecture","git","protocol"],significant:!0},{id:"mem-piper-d1",agentId:"piper",agentName:"Piper",agentEmoji:"🧩",kind:"daily",date:"2026-02-22",title:"Feb 22 — Sub-agent runs",content:`Built 4 views as Luis sub-agent: TeamManagement, AgentComparison, ThemeEditor, SupportCenter.
ThemeEditor had TS errors in bgBase scope — Luis fixed post-merge.
Learned: define bgBase at component level, not inside useMemo only.`,wordCount:40,lastModified:"2026-02-22T02:01:00Z",tags:["builds","lessons"]}],b={daily:"Daily",longterm:"Long-term",soul:"Soul",context:"Context",decision:"Decision"},f={daily:"text-indigo-400 bg-indigo-400/10 border-indigo-400/20",longterm:"text-violet-400 bg-violet-400/10 border-violet-400/20",soul:"text-amber-400 bg-amber-400/10 border-amber-400/20",context:"text-emerald-400 bg-emerald-400/10 border-emerald-400/20",decision:"text-rose-400 bg-rose-400/10 border-rose-400/20"};function v(a){const m=Date.now()-new Date(a).getTime(),i=Math.floor(m/6e4);if(i<1)return"just now";if(i<60)return`${i}m ago`;const s=Math.floor(i/60);return s<24?`${s}h ago`:`${Math.floor(s/24)}d ago`}function C(a){return a.split(`
`).map((i,s)=>i.startsWith("## ")?e.jsx("h2",{className:"text-base font-bold text-white mt-4 mb-2 first:mt-0",children:i.slice(3)},s):i.startsWith("### ")?e.jsx("h3",{className:"text-sm font-semibold text-zinc-200 mt-3 mb-1",children:i.slice(4)},s):i.startsWith("**")&&i.endsWith("**")?e.jsx("p",{className:"text-sm font-semibold text-white",children:i.slice(2,-2)},s):i.match(/^\d+\.\s/)?e.jsx("li",{className:"text-sm text-zinc-300 ml-4 list-decimal",children:i.replace(/^\d+\.\s/,"")},s):i.startsWith("- ")?e.jsx("li",{className:"text-sm text-zinc-300 ml-4 list-disc",children:i.slice(2)},s):i.trim()===""?e.jsx("div",{className:"h-1"},s):e.jsx("p",{className:"text-sm text-zinc-400 leading-relaxed",children:i},s))}function M(){const[a,m]=r.useState("all"),[i,s]=r.useState("all"),[l,w]=r.useState(""),[g,y]=r.useState(c[0].id),[u,j]=r.useState(!1),p=r.useMemo(()=>{const t=new Set,x=[];for(const d of c)t.has(d.agentId)||(t.add(d.agentId),x.push({id:d.agentId,name:d.agentName,emoji:d.agentEmoji}));return x},[]),h=r.useMemo(()=>c.filter(t=>!(a!=="all"&&t.agentId!==a||i!=="all"&&t.kind!==i||u&&!t.significant||l&&!t.title.toLowerCase().includes(l.toLowerCase())&&!t.content.toLowerCase().includes(l.toLowerCase()))).sort((t,x)=>new Date(x.lastModified).getTime()-new Date(t.lastModified).getTime()),[a,i,l,u]),n=r.useMemo(()=>c.find(t=>t.id===g)??null,[g]),N=r.useCallback(()=>{n&&navigator.clipboard.writeText(n.content)},[n]),z=[{value:"all",label:"All"},{value:"daily",label:"Daily"},{value:"longterm",label:"Long-term"},{value:"context",label:"Context"},{value:"decision",label:"Decision"}];return e.jsxs("main",{className:"flex h-full bg-zinc-950 text-white overflow-hidden",role:"main","aria-label":"Agent Memory Viewer",children:[e.jsxs("div",{className:"w-80 shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden",children:[e.jsxs("div",{className:"p-4 border-b border-zinc-800",children:[e.jsx("h1",{className:"text-lg font-bold text-white",children:"Agent Memory"}),e.jsxs("p",{className:"text-xs text-zinc-500 mt-0.5",children:[c.length," memory entries across ",p.length," agents"]})]}),e.jsx("div",{className:"p-3 border-b border-zinc-800",children:e.jsx("input",{type:"search",value:l,onChange:t=>w(t.target.value),placeholder:"Search memories…","aria-label":"Search agent memory",className:o("w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500","focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none")})}),e.jsx("div",{className:"px-3 py-2 border-b border-zinc-800",children:e.jsxs("select",{value:a,onChange:t=>m(t.target.value),"aria-label":"Filter by agent",className:o("w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white","focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"),children:[e.jsx("option",{value:"all",children:"All agents"}),p.map(t=>e.jsxs("option",{value:t.id,children:[t.emoji," ",t.name]},t.id))]})}),e.jsxs("div",{className:"px-3 py-2 border-b border-zinc-800",children:[e.jsx("div",{className:"flex flex-wrap gap-1",role:"group","aria-label":"Filter by memory type",children:z.map(t=>e.jsx("button",{onClick:()=>s(t.value),"aria-pressed":i===t.value,className:o("text-xs px-2 py-1 rounded border transition-colors","focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",i===t.value?"border-indigo-500 bg-indigo-950/40 text-indigo-300":"border-zinc-700 text-zinc-400 hover:text-white"),children:t.label},t.value))}),e.jsx("button",{onClick:()=>j(t=>!t),"aria-pressed":u,className:o("mt-2 text-xs px-2 py-1 rounded border transition-colors w-full text-left","focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",u?"border-indigo-500 bg-indigo-950/40 text-indigo-300":"border-zinc-700 text-zinc-400 hover:text-white"),children:"⭐ Significant only"})]}),e.jsx("div",{className:"flex-1 overflow-y-auto",role:"list","aria-label":"Memory entries",children:h.length===0?e.jsxs("div",{className:"text-center py-10",children:[e.jsx("p",{className:"text-3xl mb-2",children:"🧠"}),e.jsx("p",{className:"text-sm text-zinc-500",children:"No memories match filters"})]}):h.map(t=>e.jsx("div",{role:"listitem",children:e.jsxs("button",{onClick:()=>y(t.id),"aria-pressed":g===t.id,className:o("w-full text-left px-4 py-3 border-b border-zinc-800 last:border-b-0 transition-colors","focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none",g===t.id?"bg-indigo-950/30":"hover:bg-zinc-800/30"),children:[e.jsxs("div",{className:"flex items-start justify-between gap-2 mb-1",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("span",{children:t.agentEmoji}),e.jsx("span",{className:"text-xs text-zinc-400",children:t.agentName}),t.significant&&e.jsx("span",{className:"text-yellow-400 text-xs",children:"⭐"})]}),e.jsx("span",{className:o("text-[10px] px-1.5 py-0.5 rounded border shrink-0",f[t.kind]),children:b[t.kind]})]}),e.jsx("p",{className:"text-sm font-medium text-white truncate",children:t.title}),e.jsxs("div",{className:"flex items-center gap-2 mt-1 text-[10px] text-zinc-600",children:[e.jsxs("span",{children:[t.wordCount," words"]}),e.jsx("span",{children:"·"}),e.jsx("span",{children:v(t.lastModified)})]})]})},t.id))})]}),e.jsx("div",{className:"flex-1 overflow-y-auto p-6",children:n?e.jsxs("div",{className:"max-w-2xl",children:[e.jsxs("div",{className:"flex items-start justify-between gap-4 mb-5",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2 flex-wrap",children:[e.jsx("span",{className:"text-2xl",children:n.agentEmoji}),e.jsx("span",{className:"font-semibold text-white",children:n.agentName}),e.jsx("span",{className:o("text-xs px-2 py-0.5 rounded border",f[n.kind]),children:b[n.kind]}),n.significant&&e.jsx("span",{className:"text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded",children:"⭐ Significant"})]}),e.jsx("h2",{className:"text-xl font-bold text-white",children:n.title}),e.jsxs("p",{className:"text-xs text-zinc-500 mt-1",children:[n.wordCount," words · ",v(n.lastModified)," · ",n.date]})]}),e.jsx("button",{onClick:N,"aria-label":"Copy memory content",className:o("shrink-0 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-colors","focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"),children:"Copy"})]}),n.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5 mb-4",children:n.tags.map(t=>e.jsxs("span",{className:"text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400",children:["#",t]},t))}),e.jsx("div",{className:"rounded-xl bg-zinc-900 border border-zinc-800 p-5",children:e.jsx("div",{className:"prose-sm space-y-1",children:C(n.content)})})]}):e.jsxs("div",{className:"flex flex-col items-center justify-center h-full text-center",children:[e.jsx("p",{className:"text-5xl mb-4",children:"🧠"}),e.jsx("p",{className:"text-lg font-semibold text-white",children:"Select a memory"}),e.jsx("p",{className:"text-sm text-zinc-500 mt-1",children:"Choose a memory entry to view its content"})]})})]})}export{M as default};
