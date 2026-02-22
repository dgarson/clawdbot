import{r as x,j as e,c as g}from"./index-CleR6dBN.js";const A=new Date,a=s=>new Date(A.getTime()-s),r=s=>s*864e5,C=s=>s*36e5,m=[{id:"kb1",title:"Horizon UI Architecture",type:"spec",status:"published",excerpt:"Technical specification for the Horizon React SPA — stack, component patterns, routing, and design system.",content:`# Horizon UI Architecture

## Overview
Horizon is OpenClaw's next-generation web interface, built with Vite + React + TypeScript + Tailwind CSS.

## Stack
- **Framework:** Vite + React 18 + TypeScript (strict)
- **Styling:** Tailwind CSS v4 + dark zinc theme
- **State:** React Context (no external state library)
- **Icons:** Lucide React (tree-shakeable)
- **Build:** pnpm + vitest

## Component Patterns
All views are lazy-loaded React components with a single default export.
Import only \`cn\` from \`../lib/utils\` for class merging.

## Design System
Dark theme with zinc-950 background, zinc-900 cards, zinc-800 borders.
Accent: indigo-500. Success: emerald-400. Error: rose-400. Warning: amber-400.

## Navigation
Sidebar nav with emoji + label. Cmd+K command palette. Alt+1-9 shortcuts.`,tags:["architecture","frontend","horizon","spec"],author:{name:"Luis",emoji:"🎨"},agentContext:["luis","piper","quinn","wes"],createdAt:a(r(5)),updatedAt:a(C(6)),views:47,wordCount:312},{id:"kb2",title:"Agent PR Review Protocol",type:"runbook",status:"published",excerpt:"Step-by-step guide for reviewing worker PRs — when to approve, fix, or request changes.",content:`# Agent PR Review Protocol

## Decision Tree

### APPROVE + MERGE
All of the following are true:
- TypeScript: no \`any\`, strict types
- Tests present and meaningful
- Follows existing patterns
- No security issues
- No regressions

\`\`\`bash
gh pr review <PR> --approve
gh pr merge <PR> --squash
\`\`\`

### MINOR FIX + MERGE
Small issue, fast to fix yourself. Fix on their branch, then merge.

### REQUEST CHANGES (one revision cycle)
Substantial issues. Leave detailed feedback. Worker gets one revision.

### TAKE OWNERSHIP (worker fails twice)
After two failed cycles: complete it yourself, notify Xavier/Tim.

## What to check
1. Architecture fit
2. TypeScript strictness (NO any)
3. Test coverage
4. Accessibility (ARIA, focus management)
5. Edge cases (loading, error, empty states)
6. Security (no hardcoded secrets, safe rendering)`,tags:["process","PRs","review","workflow"],author:{name:"Luis",emoji:"🎨"},agentContext:["luis"],createdAt:a(r(10)),updatedAt:a(r(2)),views:31,wordCount:198},{id:"kb3",title:"Brand Voice Guidelines",type:"guide",status:"published",excerpt:"OpenClaw's brand personality, tone of voice, and writing principles for all content.",content:`# Brand Voice Guidelines

## Core Personality
**Confident, warm, pragmatic.** We build tools for people who get things done.

## Tone Principles
1. **Direct** — Say it once, clearly. No padding.
2. **Human** — Write like you're talking to a smart peer.
3. **Honest** — Don't oversell. If it's beta, say so.
4. **Empowering** — Every word should make the reader feel capable.

## What we never say
- "Leverage synergies"
- "Best-in-class" (prove it instead)
- "Utilize" (say "use")
- "Solution" (say what you actually built)

## Examples
❌ "Our cutting-edge AI solution leverages state-of-the-art..."
✅ "OpenClaw lets your agents search the web, write code, and send Slack messages — autonomously."

## Writing for documentation
- Short sentences (avg 15 words)
- Active voice always
- Start with the most important thing
- One idea per paragraph`,tags:["brand","writing","tone","content"],author:{name:"Stephan",emoji:"📣"},agentContext:["stephan","luis"],createdAt:a(r(15)),updatedAt:a(r(3)),views:89,wordCount:241},{id:"kb4",title:"Gateway WebSocket Protocol",type:"reference",status:"published",excerpt:"Message format, event types, and authentication for the OpenClaw Gateway WebSocket API.",content:`# Gateway WebSocket Protocol

## Connection
Connect to: \`ws://127.0.0.1:9090\`

## Authentication
Send auth token in first message:
\`\`\`json
{ "type": "auth", "token": "YOUR_TOKEN" }
\`\`\`

## Message Format
All messages are JSON with a required \`type\` field:
\`\`\`json
{
  "type": "session.message",
  "sessionKey": "agent:luis:cron:abc123",
  "content": "Hello from Luis",
  "timestamp": "2026-02-22T01:00:00Z"
}
\`\`\`

## Core Event Types
- \`session.create\` — New session started
- \`session.message\` — Message in session
- \`session.end\` — Session terminated
- \`agent.heartbeat\` — Agent alive ping
- \`cron.fire\` — Scheduled job triggered
- \`tool.call\` — Agent invoked a tool
- \`tool.result\` — Tool returned result

## Error Handling
Reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s.`,tags:["API","WebSocket","protocol","gateway","reference"],author:{name:"Tim",emoji:"⚙️"},agentContext:["tim","xavier","luis"],createdAt:a(r(20)),updatedAt:a(r(5)),views:124,wordCount:287},{id:"kb5",title:"Megabranch Workflow",type:"runbook",status:"published",excerpt:"How to create, manage, and ship megabranches for multi-view feature work.",content:`# Megabranch Workflow

## Create
\`\`\`bash
git fetch origin
git checkout -b feat/<project> origin/dgarson/fork
git push -u origin feat/<project>
\`\`\`

## Delegate to workers
Tell each worker to branch off your megabranch, PR back to it.
Post in #cb-activity: branch name, assignments, dependencies.

## Keep healthy
\`\`\`bash
git rebase origin/dgarson/fork feat/<project>
git push --force-with-lease
\`\`\`

## Ship
1. All tasks merged into megabranch
2. \`pnpm check\` passes
3. Open PR to \`dgarson/fork\`
4. Notify Tim (engineering review) + Xavier (product review)

## PR format
Title: descriptive workstream name
Body: what shipped, affected surfaces, dependencies, testing notes`,tags:["git","workflow","megabranch","process"],author:{name:"Luis",emoji:"🎨"},agentContext:["luis","piper","quinn","reed","wes"],createdAt:a(r(8)),updatedAt:a(r(1)),views:56,wordCount:178},{id:"kb6",title:"Agent Architecture Decisions",type:"decision",status:"published",excerpt:"Key architectural decisions for the multi-agent system — models, memory, orchestration.",content:`# Agent Architecture Decisions

## Model Assignment (Feb 2026)

**Decision:** Tier models by agent complexity/cost.
- Principal agents (Luis, Xavier, Stephan): claude-sonnet-4-6
- Worker agents (Piper, Quinn, Reed, Wes, Sam): minimax-m2.5
- Heavy reasoning tasks: claude-opus-4-6 (Xavier only)

**Rationale:** Sonnet offers best quality/cost for principal roles. MiniMax is fast and cheap for worker coding tasks.

## Memory Architecture

**Decision:** Dual-layer memory: daily notes + MEMORY.md.
- Daily: \`memory/YYYY-MM-DD.md\` — session log
- Long-term: \`MEMORY.md\` — design decisions, key insights

**Rationale:** Daily files prevent MEMORY.md bloat. Agents read both on startup.

## Orchestration Pattern

**Decision:** Principal agents spawn sub-agents (not workers spawning workers).
- Max 2 medium-tier sub-agents simultaneously
- Never use Opus for prototyping (too expensive)
- Sub-agents auto-announce completion

**Rationale:** Centralized orchestration prevents runaway parallelism.`,tags:["architecture","decisions","models","orchestration"],author:{name:"Xavier",emoji:"🏗️"},agentContext:["xavier","luis","tim"],createdAt:a(r(12)),updatedAt:a(r(4)),views:78,wordCount:267},{id:"kb7",title:"Onboarding New Agents",type:"guide",status:"published",excerpt:"Step-by-step guide to creating, configuring, and deploying a new OpenClaw agent.",content:`# Onboarding New Agents

## 1. Define the role
Write AGENTS.md: role, responsibilities, reporting line, decision authority.

## 2. Write SOUL.md
The agent's identity, principles, and voice. Make it feel like a real person.

## 3. Create workspace
\`\`\`
mkdir ~/.openclaw/workspace/<agent-name>
cp _shared/templates/AGENTS.md <agent-name>/
cp _shared/templates/SOUL.md <agent-name>/
\`\`\`

## 4. Configure model
Choose model based on role complexity:
- Principal: claude-sonnet-4-6
- Worker: minimax-m2.5

## 5. Set capabilities
Which tools does this agent need? Start minimal, add as needed.

## 6. Write first memory file
Create \`memory/YYYY-MM-DD.md\` so the agent has context on day one.

## 7. Announce
Post to #cb-activity: new agent name, role, reporting line.
Xavier approves all new principal agents.`,tags:["onboarding","agents","setup","guide"],author:{name:"Xavier",emoji:"🏗️"},agentContext:["xavier","luis"],createdAt:a(r(25)),updatedAt:a(r(7)),views:112,wordCount:224},{id:"kb8",title:"WCAG 2.1 AA Quick Reference",type:"reference",status:"published",excerpt:"Accessibility requirements Luis's squad must meet for all Horizon UI components.",content:`# WCAG 2.1 AA Quick Reference

## Focus Management
- All interactive elements must have visible focus rings
- \`focus-visible:ring-2 focus-visible:ring-indigo-500\`
- Tab order must be logical and predictable
- Modals must trap focus; restore on close

## Labels
- Every input needs a \`<label htmlFor="...">\` or \`aria-label\`
- Icon buttons need \`aria-label\`
- Images need \`alt\` (or \`alt=""\` if decorative)

## Color Contrast
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- Never use color alone to convey meaning

## Dynamic Content
- Use \`aria-live="polite"\` for non-critical updates
- Use \`aria-live="assertive"\` only for critical alerts
- Loading states need descriptive text

## Key ARIA Patterns
\`\`\`tsx
// List selection
<div role="listbox" aria-label="...">
  <button role="option" aria-selected={isSelected}>

// Tabs
<div role="tablist">
  <button role="tab" aria-selected={isActive} aria-controls="panel-id">
  <div role="tabpanel" id="panel-id">

// Modal
<div role="dialog" aria-modal="true" aria-labelledby="title-id">
\`\`\``,tags:["accessibility","WCAG","a11y","reference","frontend"],author:{name:"Luis",emoji:"🎨"},agentContext:["luis","piper","quinn","reed","wes"],createdAt:a(r(18)),updatedAt:a(r(2)),views:93,wordCount:298}],y={note:{label:"Note",emoji:"📝",color:"text-zinc-400"},guide:{label:"Guide",emoji:"📖",color:"text-emerald-400"},reference:{label:"Reference",emoji:"📋",color:"text-indigo-400"},runbook:{label:"Runbook",emoji:"⚙️",color:"text-amber-400"},decision:{label:"Decision",emoji:"⚖️",color:"text-violet-400"},spec:{label:"Spec",emoji:"📐",color:"text-cyan-400"}},j={draft:{label:"Draft",badge:"bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/30"},published:{label:"Published",badge:"bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"},archived:{label:"Archived",badge:"bg-zinc-800 text-zinc-600 ring-1 ring-zinc-700/30"}};function w(s){const l=Date.now()-s.getTime();return l<864e5?`${Math.floor(l/36e5)}h ago`:`${Math.floor(l/864e5)}d ago`}function z({doc:s,selected:l,onSelect:d}){const p=y[s.type],o=j[s.status];return e.jsx("button",{role:"option","aria-selected":l,onClick:d,className:g("w-full text-left p-4 border-b border-zinc-800/50 transition-colors","hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",l&&"bg-zinc-900 border-l-2 border-l-indigo-500"),children:e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-base flex-none mt-0.5",children:p.emoji}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-sm font-semibold text-white leading-tight",children:s.title}),e.jsxs("div",{className:"flex items-center gap-2 mt-1 flex-wrap",children:[e.jsx("span",{className:g("text-xs",p.color),children:p.label}),e.jsx("span",{className:g("px-1.5 py-0.5 text-xs rounded-full",o.badge),children:o.label})]}),e.jsx("p",{className:"text-xs text-zinc-600 mt-1 line-clamp-2 leading-relaxed",children:s.excerpt}),e.jsxs("div",{className:"flex items-center gap-3 mt-2 text-xs text-zinc-700",children:[e.jsxs("span",{children:[s.author.emoji," ",s.author.name]}),e.jsx("span",{children:w(s.updatedAt)}),e.jsxs("span",{children:[s.views," views"]})]})]})]})})}function S({doc:s}){const l=y[s.type],d=j[s.status],p=o=>o.split(`
`).map((i,c)=>{if(i.startsWith("# "))return e.jsx("h1",{className:"text-xl font-bold text-white mt-0 mb-3",children:i.slice(2)},c);if(i.startsWith("## "))return e.jsx("h2",{className:"text-base font-semibold text-zinc-200 mt-5 mb-2",children:i.slice(3)},c);if(i.startsWith("### "))return e.jsx("h3",{className:"text-sm font-semibold text-zinc-300 mt-4 mb-1",children:i.slice(4)},c);if(i.startsWith("- "))return e.jsx("li",{className:"text-sm text-zinc-400 ml-4 list-disc leading-relaxed",children:i.slice(2)},c);if(i.startsWith("```"))return e.jsx("div",{className:i==="```"?"mb-3":"mt-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-zinc-300"},c);if(i.startsWith("**")&&i.endsWith("**"))return e.jsx("p",{className:"text-sm font-semibold text-zinc-200 mt-2",children:i.slice(2,-2)},c);if(i==="")return e.jsx("div",{className:"h-2"},c);if(i.startsWith("❌")||i.startsWith("✅"))return e.jsx("p",{className:g("text-sm font-mono mt-1",i.startsWith("❌")?"text-rose-400":"text-emerald-400"),children:i},c);const v=i.split(/(`[^`]+`)/g);return e.jsx("p",{className:"text-sm text-zinc-400 leading-relaxed",children:v.map((u,h)=>u.startsWith("`")&&u.endsWith("`")?e.jsx("code",{className:"px-1 py-0.5 text-xs font-mono bg-zinc-800 text-emerald-300 rounded",children:u.slice(1,-1)},h):u)},c)});return e.jsxs("div",{className:"flex flex-col h-full overflow-y-auto",children:[e.jsxs("div",{className:"flex-none px-6 py-5 border-b border-zinc-800",children:[e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("span",{className:"text-3xl flex-none",children:l.emoji}),e.jsxs("div",{className:"flex-1",children:[e.jsx("h2",{className:"text-lg font-semibold text-white",children:s.title}),e.jsxs("div",{className:"flex items-center gap-2 mt-1 flex-wrap",children:[e.jsx("span",{className:g("text-xs",l.color),children:l.label}),e.jsx("span",{className:g("px-1.5 py-0.5 text-xs rounded-full",d.badge),children:d.label}),e.jsxs("span",{className:"text-xs text-zinc-600",children:[s.wordCount," words · ",s.views," views"]})]}),e.jsxs("div",{className:"flex items-center gap-3 mt-2 text-xs text-zinc-600",children:[e.jsxs("span",{children:[s.author.emoji," ",s.author.name]}),e.jsx("span",{children:"·"}),e.jsxs("span",{children:["Updated ",w(s.updatedAt)]}),e.jsx("span",{children:"·"}),e.jsxs("span",{children:["Created ",w(s.createdAt)]})]})]}),e.jsx("div",{className:"flex items-center gap-2 flex-none",children:e.jsx("button",{"aria-label":"Edit document",className:"py-1.5 px-3 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",children:"Edit"})})]}),s.agentContext.length>0&&e.jsxs("div",{className:"mt-3 flex items-center gap-2 flex-wrap",children:[e.jsx("span",{className:"text-xs text-zinc-600",children:"Access:"}),s.agentContext.map(o=>e.jsx("span",{className:"text-xs px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 capitalize",children:o},o))]}),e.jsx("div",{className:"mt-2 flex flex-wrap gap-1",children:s.tags.map(o=>e.jsx("span",{className:"px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50",children:o},o))})]}),e.jsx("div",{className:"flex-1 px-6 py-5",children:e.jsx("div",{className:"prose-custom max-w-none space-y-0.5",children:p(s.content)})})]})}function W(){const[s,l]=x.useState(""),[d,p]=x.useState("all"),[o,i]=x.useState("updated"),[c,v]=x.useState(m[0].id),u=x.useRef(null);x.useEffect(()=>{const t=n=>{var b;(n.metaKey||n.ctrlKey)&&n.key==="f"&&(n.preventDefault(),(b=u.current)==null||b.focus())};return document.addEventListener("keydown",t),()=>document.removeEventListener("keydown",t)},[]);const h=m.filter(t=>{if(d!=="all"&&t.type!==d)return!1;if(s.trim()){const n=s.toLowerCase();return t.title.toLowerCase().includes(n)||t.excerpt.toLowerCase().includes(n)||t.tags.some(b=>b.toLowerCase().includes(n))}return!0}).sort((t,n)=>o==="views"?n.views-t.views:o==="title"?t.title.localeCompare(n.title):n.updatedAt.getTime()-t.updatedAt.getTime()),N=m.find(t=>t.id===c)??m[0],f={total:m.length,published:m.filter(t=>t.status==="published").length,totalViews:m.reduce((t,n)=>t+n.views,0),totalWords:m.reduce((t,n)=>t+n.wordCount,0)},k=[{id:"all",label:"All"},...Object.entries(y).map(([t,n])=>({id:t,label:n.label}))];return e.jsxs("div",{className:"flex flex-col h-full bg-zinc-950",children:[e.jsx("div",{className:"flex-none px-6 py-4 border-b border-zinc-800",children:e.jsxs("div",{className:"flex items-center justify-between gap-4 flex-wrap",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-lg font-semibold text-white",children:"Knowledge Base"}),e.jsx("p",{className:"text-sm text-zinc-500 mt-0.5",children:"Agent documentation, runbooks, decisions, and references"})]}),e.jsxs("div",{className:"flex items-center gap-3 text-xs text-zinc-600",children:[e.jsxs("span",{children:[e.jsx("span",{className:"text-zinc-300 font-semibold",children:f.total})," docs"]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-emerald-400 font-semibold",children:f.published})," published"]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-indigo-400 font-semibold",children:f.totalViews})," total views"]}),e.jsxs("span",{children:[e.jsxs("span",{className:"text-zinc-400 font-semibold",children:[(f.totalWords/1e3).toFixed(1),"K"]})," words"]}),e.jsxs("button",{"aria-label":"Create new document",className:"flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors font-medium",children:[e.jsx("svg",{className:"h-3.5 w-3.5",viewBox:"0 0 14 14",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:e.jsx("path",{strokeLinecap:"round",d:"M7 2v10M2 7h10"})}),"New Doc"]})]})]})}),e.jsxs("div",{className:"flex flex-1 min-h-0",children:[e.jsxs("div",{className:"w-72 flex-none flex flex-col border-r border-zinc-800",children:[e.jsxs("div",{className:"flex-none px-3 py-2 border-b border-zinc-800 space-y-2",children:[e.jsxs("div",{className:"relative",children:[e.jsxs("svg",{className:"absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:[e.jsx("circle",{cx:"7",cy:"7",r:"4.5"}),e.jsx("path",{strokeLinecap:"round",d:"M10.5 10.5l3 3"})]}),e.jsx("input",{ref:u,type:"search",value:s,onChange:t=>l(t.target.value),placeholder:"Search docs… (⌘F)","aria-label":"Search knowledge base",className:"w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("select",{value:d,onChange:t=>p(t.target.value),"aria-label":"Filter by type",className:"flex-1 py-1 pl-2 pr-6 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none",children:k.map(({id:t,label:n})=>e.jsx("option",{value:t,children:n},t))}),e.jsxs("select",{value:o,onChange:t=>i(t.target.value),"aria-label":"Sort order",className:"flex-1 py-1 pl-2 pr-6 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none",children:[e.jsx("option",{value:"updated",children:"Updated"}),e.jsx("option",{value:"views",children:"Most viewed"}),e.jsx("option",{value:"title",children:"A–Z"})]})]})]}),e.jsx("div",{role:"listbox","aria-label":"Documents",className:"flex-1 overflow-y-auto",children:h.length===0?e.jsx("p",{className:"px-4 py-8 text-xs text-zinc-600 text-center",children:"No docs match"}):h.map(t=>e.jsx(z,{doc:t,selected:c===t.id,onSelect:()=>v(t.id)},t.id))})]}),e.jsx("div",{className:"flex-1 min-w-0",children:e.jsx(S,{doc:N})})]})]})}export{W as default};
