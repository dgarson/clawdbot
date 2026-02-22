import{r as u,j as e,c as f,R as B}from"./index-BeRsrWPy.js";const P=new Date,a=i=>new Date(P.getTime()-i),l=i=>i*864e5,j=i=>i*36e5,W=[{id:"p1",title:"Summarize Document",description:"Concise, structured summary of any document with key takeaways.",category:"analysis",body:`Please summarize the following {{document_type}} in {{length}} format:

<document>
{{document_content}}
</document>

Structure your summary with:
1. **One-line overview** — what this is about
2. **Key points** — 3-5 bullet points
3. **Action items** — any decisions or next steps mentioned
4. **Notable quotes** — if any standout passages exist

Keep it concise and scannable.`,variables:[{name:"document_type",description:"Type of document",defaultValue:"document"},{name:"length",description:"Summary length",defaultValue:"brief"},{name:"document_content",description:"The document text to summarize"}],tags:["summary","document","analysis"],isFavorite:!0,isBuiltIn:!0,usageCount:47,createdAt:a(l(30)),lastUsedAt:a(j(2))},{id:"p2",title:"Code Review",description:"Thorough code review covering correctness, style, security, and performance.",category:"code",body:`Please review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Review criteria:
- **Correctness** — Does it do what it's supposed to? Edge cases?
- **TypeScript** — Strict types, no \`any\`, clean interfaces?
- **Security** — Injection risks, hardcoded secrets, unsafe operations?
- **Performance** — Any obvious inefficiencies or O(n²) traps?
- **Patterns** — Does it follow conventions? Readable and maintainable?
- **Tests** — What should be tested that isn't?

Format: For each issue, include severity (🔴 Critical / 🟡 Warning / 🔵 Suggestion) and a specific fix.`,variables:[{name:"language",description:"Programming language",defaultValue:"TypeScript"},{name:"code",description:"The code to review"}],tags:["code","review","TypeScript"],isFavorite:!0,isBuiltIn:!0,usageCount:89,createdAt:a(l(30)),lastUsedAt:a(j(1))},{id:"p3",title:"UX Critique",description:"Structured UX review using heuristics, accessibility, and delight principles.",category:"analysis",body:`Analyze the UX of {{product_or_feature}} and provide a structured critique.

Context: {{context}}

Evaluate using:
1. **Usability** (Nielsen's heuristics) — Visibility, feedback, error recovery
2. **Accessibility** (WCAG 2.1 AA) — Focus management, color contrast, ARIA
3. **Cognitive load** — How much does this ask of the user?
4. **Emotional design** — Does it delight? Does it respect the user?
5. **Information hierarchy** — Is the most important content front and center?
6. **Interaction patterns** — Familiar? Or novel without good reason?

End with: **Top 3 improvements** ordered by impact vs. effort.`,variables:[{name:"product_or_feature",description:"What to critique"},{name:"context",description:"Target user, use case, or screenshot description"}],tags:["UX","design","critique","accessibility"],isFavorite:!0,isBuiltIn:!1,usageCount:34,createdAt:a(l(20)),lastUsedAt:a(l(1))},{id:"p4",title:"Research Brief",description:"Deep-dive research on any topic with sources and structured output.",category:"research",body:`Research the following topic and produce a comprehensive brief:

**Topic:** {{topic}}
**Depth:** {{depth_level}}
**Audience:** {{audience}}

Structure:
## Executive Summary
2-3 sentences.

## Background
Historical context and why this matters.

## Current State
What's happening now. Key players, trends, numbers.

## Key Findings
5-7 bullet points with the most important insights.

## Competing Perspectives
Where do experts disagree? What are the trade-offs?

## Implications
What does this mean for {{audience}}?

## Open Questions
What remains uncertain or worth investigating further?

Include specific data points, dates, and sources where possible.`,variables:[{name:"topic",description:"Research topic"},{name:"depth_level",description:"Surface / Detailed / Expert",defaultValue:"Detailed"},{name:"audience",description:"Who this brief is for"}],tags:["research","brief","analysis"],isFavorite:!1,isBuiltIn:!0,usageCount:23,createdAt:a(l(25)),lastUsedAt:a(l(3))},{id:"p5",title:"Agent Soul Template",description:"Bootstrap a new agent's SOUL.md from scratch.",category:"agent",body:`Create a SOUL.md for a new AI agent with the following profile:

**Name:** {{agent_name}}
**Role:** {{role}}
**Personality archetype:** {{archetype}} (e.g. "pragmatic problem-solver", "warm guide", "sharp strategist")
**Reports to:** {{manager}}
**Primary responsibilities:** {{responsibilities}}

The SOUL.md should define:
1. **Identity** — Who this agent is at their core. Voice and personality.
2. **Mission** — The single sentence that captures their purpose.
3. **Principles** — 5-7 guiding beliefs that shape every decision.
4. **Voice** — Tone, style, communication patterns. What they never say.
5. **Boundaries** — What they explicitly will not do.
6. **Collaboration style** — How they work with others.

Make it feel like a real person with genuine personality — not a job description.`,variables:[{name:"agent_name",description:"Agent's name"},{name:"role",description:"Agent's role/title"},{name:"archetype",description:"Personality archetype"},{name:"manager",description:"Who they report to"},{name:"responsibilities",description:"Key responsibilities"}],tags:["agent","SOUL","identity","persona"],isFavorite:!0,isBuiltIn:!1,usageCount:12,createdAt:a(l(15)),lastUsedAt:a(l(2))},{id:"p6",title:"PR Description Generator",description:"Generate a clear, thorough GitHub PR description from a branch/diff context.",category:"code",body:`Write a GitHub PR description for the following change:

**Branch:** {{branch_name}}
**Summary of changes:** {{summary}}
**Affected areas:** {{affected_areas}}

Use this format:
## What this PR does
Brief overview.

## Why
The motivation or problem being solved.

## Changes
- Bullet list of the specific changes

## Testing
How this was tested / what to check.

## Screenshots
[If UI, placeholder for screenshots]

## Notes for reviewer
Anything that might trip up the reviewer.

Keep it professional but concise. Don't pad.`,variables:[{name:"branch_name",description:"Branch name"},{name:"summary",description:"What changed and why"},{name:"affected_areas",description:"Files, systems, or areas affected"}],tags:["code","GitHub","PR","documentation"],isFavorite:!1,isBuiltIn:!0,usageCount:56,createdAt:a(l(30)),lastUsedAt:a(j(6))},{id:"p7",title:"Technical Blog Post",description:"Developer-focused blog post that educates and engages.",category:"writing",body:`Write a technical blog post on: {{topic}}

**Target audience:** {{audience}}
**Tone:** {{tone}} (e.g. educational, opinionated, narrative)
**Length:** {{length}}

Structure:
1. **Hook** — Start with a problem, story, or bold claim
2. **Setup** — Why does this matter? What's the context?
3. **Body** — Deep dive. Use code examples, diagrams, comparisons where relevant.
4. **Takeaways** — What should the reader walk away knowing/doing?
5. **Call to action** — Next step for the reader

Use active voice. Avoid jargon unless it's domain-appropriate. Short paragraphs.`,variables:[{name:"topic",description:"Blog post topic"},{name:"audience",description:"Target readers"},{name:"tone",description:"Tone of voice",defaultValue:"educational"},{name:"length",description:"Word count",defaultValue:"1500 words"}],tags:["writing","blog","technical"],isFavorite:!1,isBuiltIn:!0,usageCount:18,createdAt:a(l(20))},{id:"p8",title:"System Prompt: Strict Assistant",description:"A tightly scoped system prompt for task-focused agents.",category:"system",body:`You are {{agent_name}}, a specialized assistant. Your sole focus is: {{focus_area}}.

## Rules
- Stay strictly within your domain. Decline tasks outside it.
- Be concise: answer with the minimum necessary words.
- If you're uncertain, say so explicitly — don't guess.
- Format outputs as the user specifies. Default to markdown.
- When asked to do something potentially harmful: refuse, explain briefly.

## Communication style
- Direct and professional
- No filler phrases ("Great question!", "Certainly!")
- Use numbered lists for steps; bullet points for options
- Code blocks for all code

## What you never do
- Hallucinate facts
- Make up citations
- Pretend to have real-time data
- Role-play as a human

Begin every session by confirming the user's goal in one sentence.`,variables:[{name:"agent_name",description:"Agent's name"},{name:"focus_area",description:"The agent's specialized domain"}],tags:["system","prompt","assistant"],isFavorite:!1,isBuiltIn:!1,usageCount:8,createdAt:a(l(10))},{id:"p9",title:"Creative Brainstorm",description:"Generate a wide range of ideas — from obvious to wild.",category:"creative",body:`Brainstorm {{count}} ideas for: {{challenge}}

Context: {{context}}
Constraints: {{constraints}}

Generate ideas across a spectrum:
- **5 safe, conventional ideas** — Things that would obviously work
- **5 interesting ideas** — Less obvious, more creative, still feasible
- **5 wild ideas** — Boundary-pushing, provocative, maybe impossible but inspiring
- **2 anti-ideas** — What's the opposite of the obvious solution? Sometimes that's the answer.

For each idea: one sentence on what it is, one on why it might work.

At the end: pick your top 3 with a brief "why this one" rationale.`,variables:[{name:"challenge",description:"The problem or opportunity to brainstorm around"},{name:"context",description:"Background context"},{name:"constraints",description:"Any constraints to work within",defaultValue:"None"},{name:"count",description:"Total number of ideas",defaultValue:"17"}],tags:["creative","brainstorm","ideas"],isFavorite:!1,isBuiltIn:!0,usageCount:31,createdAt:a(l(25)),lastUsedAt:a(l(5))},{id:"p10",title:"Weekly Status Report",description:"Generate a clean weekly status update from notes.",category:"personal",body:`Generate a weekly status report for: {{name}} / {{role}}
Period: {{week}}

Raw notes / completed items:
{{notes}}

Format as:
## ✅ Completed
- Bulleted list, each item starting with impact or outcome

## 🚧 In Progress
- What's underway; what's left

## 🚫 Blockers
- What's blocking progress; what's needed

## 📅 Next Week
- Top 3-5 priorities

## 📊 Metrics
- Any quantitative progress (views shipped, PRs merged, etc.)

Tone: professional but human. Max 300 words.`,variables:[{name:"name",description:"Your name"},{name:"role",description:"Your role",defaultValue:"Principal UX Engineer"},{name:"week",description:"The week (e.g. Feb 17-21)"},{name:"notes",description:"Raw bullet points or notes from the week"}],tags:["report","status","weekly"],isFavorite:!0,isBuiltIn:!1,usageCount:22,createdAt:a(l(8)),lastUsedAt:a(l(2))}],N={analysis:{label:"Analysis",emoji:"🔍",color:"text-indigo-400"},writing:{label:"Writing",emoji:"✍️",color:"text-violet-400"},code:{label:"Code",emoji:"💻",color:"text-emerald-400"},research:{label:"Research",emoji:"📚",color:"text-amber-400"},agent:{label:"Agent",emoji:"🤖",color:"text-cyan-400"},system:{label:"System",emoji:"⚙️",color:"text-zinc-400"},creative:{label:"Creative",emoji:"✨",color:"text-pink-400"},personal:{label:"Personal",emoji:"👤",color:"text-orange-400"}};function U(i){const n=Date.now()-i.getTime();return n<36e5?`${Math.floor(n/6e4)}m ago`:n<864e5?`${Math.floor(n/36e5)}h ago`:`${Math.floor(n/864e5)}d ago`}function R(i,n){return i.replace(/\{\{(\w+)\}\}/g,(m,h)=>n[h]??`{{${h}}}`)}function I({prompt:i,onClose:n}){const[m,h]=u.useState(Object.fromEntries(i.variables.map(o=>[o.name,o.defaultValue??""]))),[c,g]=u.useState(!1),d=R(i.body,m);u.useEffect(()=>{const o=p=>{p.key==="Escape"&&n()};return document.addEventListener("keydown",o),()=>document.removeEventListener("keydown",o)},[n]);const b=u.useCallback(()=>{navigator.clipboard.writeText(d),g(!0),setTimeout(()=>g(!1),2e3)},[d]);return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4",role:"dialog","aria-modal":"true","aria-labelledby":"use-prompt-title",children:[e.jsx("div",{className:"absolute inset-0 bg-black/60 backdrop-blur-sm",onClick:n,"aria-hidden":"true"}),e.jsxs("div",{className:"relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-none",children:[e.jsxs("div",{children:[e.jsx("h2",{id:"use-prompt-title",className:"text-sm font-semibold text-white",children:i.title}),e.jsx("p",{className:"text-xs text-zinc-500 mt-0.5",children:i.description})]}),e.jsx("button",{onClick:n,"aria-label":"Close",className:"p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",children:e.jsx("svg",{className:"h-4 w-4",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:e.jsx("path",{strokeLinecap:"round",d:"M4 4l8 8M12 4l-8 8"})})})]}),e.jsxs("div",{className:"flex flex-1 min-h-0 divide-x divide-zinc-800",children:[i.variables.length>0&&e.jsxs("div",{className:"w-52 flex-none overflow-y-auto px-4 py-4 space-y-4",children:[e.jsx("p",{className:"text-xs font-semibold text-zinc-500 uppercase tracking-wider",children:"Variables"}),i.variables.map(o=>e.jsxs("div",{children:[e.jsxs("label",{htmlFor:`var-${o.name}`,className:"block text-xs font-medium text-zinc-400 mb-1",children:[`{{${o.name}}}`,e.jsxs("span",{className:"text-zinc-600 font-normal ml-1",children:["— ",o.description]})]}),e.jsx("textarea",{id:`var-${o.name}`,value:m[o.name]??"",onChange:p=>h(v=>({...v,[o.name]:p.target.value})),rows:2,className:"w-full px-2 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"})]},o.name))]}),e.jsxs("div",{className:"flex-1 overflow-y-auto px-5 py-4",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("p",{className:"text-xs font-semibold text-zinc-500 uppercase tracking-wider",children:"Preview"}),e.jsx("button",{onClick:b,className:f("flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",c?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"),children:c?e.jsxs(e.Fragment,{children:[e.jsx("svg",{className:"h-3 w-3",viewBox:"0 0 12 12",fill:"none",stroke:"currentColor",strokeWidth:2,children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M2 6l3 3 5-5"})})," Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsxs("svg",{className:"h-3 w-3",viewBox:"0 0 12 12",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:[e.jsx("rect",{x:"3",y:"3",width:"7",height:"7",rx:"1"}),e.jsx("path",{d:"M2 2h6v1"})]})," Copy"]})})]}),e.jsx("pre",{className:"text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950 rounded-lg border border-zinc-800 p-4 overflow-x-auto",children:d.split(/\{\{(\w+)\}\}/).map((o,p)=>p%2===1?e.jsx("mark",{className:"bg-amber-500/20 text-amber-300 rounded px-0.5 not-italic",children:`{{${o}}}`},p):e.jsx(B.Fragment,{children:o},p))})]})]}),e.jsxs("div",{className:"flex gap-2 px-5 py-4 border-t border-zinc-800 flex-none",children:[e.jsx("button",{onClick:b,className:f("flex-1 py-2 text-sm font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",c?"bg-emerald-600 text-white":"bg-indigo-600 text-white hover:bg-indigo-500"),children:c?"✓ Copied to clipboard":"Copy Prompt"}),e.jsx("button",{onClick:n,className:"py-2 px-4 text-sm font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",children:"Close"})]})]})]})}function L({prompt:i,selected:n,onSelect:m,onFavorite:h,onUse:c}){const g=N[i.category];return e.jsxs("div",{role:"option","aria-selected":n,className:f("flex flex-col rounded-xl border transition-colors cursor-pointer",n?"bg-zinc-900 border-indigo-500/40 ring-1 ring-indigo-500/20":"bg-zinc-900 border-zinc-800 hover:border-zinc-700"),onClick:m,children:[e.jsxs("div",{className:"flex items-start gap-3 p-4",children:[e.jsx("div",{className:"flex-none h-9 w-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg",children:g.emoji}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsx("span",{className:"text-sm font-semibold text-white leading-tight",children:i.title}),i.isBuiltIn&&e.jsx("span",{className:"px-1.5 py-0.5 text-xs font-medium rounded-full bg-zinc-700/60 text-zinc-400 ring-1 ring-zinc-600/30",children:"Built-in"})]}),e.jsx("p",{className:"text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed",children:i.description})]}),e.jsx("button",{onClick:d=>{d.stopPropagation(),h()},"aria-label":i.isFavorite?"Remove from favorites":"Add to favorites",className:"flex-none p-1 text-zinc-600 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors",children:e.jsx("svg",{className:f("h-4 w-4",i.isFavorite&&"text-amber-400 fill-amber-400"),viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M8 2l1.5 3.5H13l-2.8 2.2 1 3.3L8 9l-3.2 2 1-3.3L3 5.5h3.5z"})})})]}),e.jsxs("div",{className:"px-4 pb-3 flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:f("text-xs font-medium",g.color),children:g.label}),e.jsx("span",{className:"text-zinc-800",children:"·"}),i.variables.length>0&&e.jsxs("span",{className:"text-xs text-zinc-600",children:[i.variables.length," variable",i.variables.length!==1?"s":""]}),i.tags.slice(0,3).map(d=>e.jsx("span",{className:"px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-600 border border-zinc-700/50",children:d},d))]}),e.jsxs("div",{className:"px-4 pb-4 flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-3 text-xs text-zinc-600",children:[e.jsxs("span",{children:[i.usageCount," uses"]}),i.lastUsedAt&&e.jsxs("span",{children:["Last: ",U(i.lastUsedAt)]})]}),e.jsx("button",{onClick:d=>{d.stopPropagation(),c()},"aria-label":`Use prompt: ${i.title}`,className:"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",children:"Use Prompt →"})]})]})}function E(){const[i,n]=u.useState(W),[m,h]=u.useState(""),[c,g]=u.useState("all"),[d,b]=u.useState("usage"),[o,p]=u.useState(null),[v,k]=u.useState(null),z=u.useRef(null);u.useEffect(()=>{const t=s=>{var r;(s.metaKey||s.ctrlKey)&&s.key==="f"&&(s.preventDefault(),(r=z.current)==null||r.focus())};return document.addEventListener("keydown",t),()=>document.removeEventListener("keydown",t)},[]);const C=[...i.filter(t=>{if(c==="favorites"&&!t.isFavorite||c!=="all"&&c!=="favorites"&&t.category!==c)return!1;if(m.trim()){const s=m.toLowerCase();return t.title.toLowerCase().includes(s)||t.description.toLowerCase().includes(s)||t.tags.some(r=>r.toLowerCase().includes(s))}return!0})].sort((t,s)=>{var r,x;return d==="usage"?s.usageCount-t.usageCount:d==="recent"?(((r=s.lastUsedAt)==null?void 0:r.getTime())??0)-(((x=t.lastUsedAt)==null?void 0:x.getTime())??0):t.title.localeCompare(s.title)}),S=u.useCallback(t=>{n(s=>s.map(r=>r.id===t?{...r,isFavorite:!r.isFavorite}:r))},[]),A=v?i.find(t=>t.id===v)??null:null,F=["all","favorites",...Object.keys(N)],y={total:i.length,favorites:i.filter(t=>t.isFavorite).length,custom:i.filter(t=>!t.isBuiltIn).length};return e.jsxs("div",{className:"flex flex-col h-full bg-zinc-950",children:[e.jsxs("div",{className:"flex-none px-6 py-4 border-b border-zinc-800",children:[e.jsxs("div",{className:"flex items-center justify-between gap-4 flex-wrap",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-lg font-semibold text-white",children:"Prompt Library"}),e.jsx("p",{className:"text-sm text-zinc-500 mt-0.5",children:"Reusable prompts with variable interpolation for agents and chats"})]}),e.jsxs("button",{"aria-label":"Create new prompt",className:"flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",children:[e.jsx("svg",{className:"h-4 w-4",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:e.jsx("path",{strokeLinecap:"round",d:"M8 3v10M3 8h10"})}),"New Prompt"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mt-3 text-xs text-zinc-500",children:[e.jsxs("span",{children:[e.jsx("span",{className:"text-zinc-300 font-semibold",children:y.total})," prompts"]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-amber-400 font-semibold",children:y.favorites})," favorites"]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-indigo-400 font-semibold",children:y.custom})," custom"]})]})]}),e.jsxs("div",{className:"flex-none px-6 py-3 border-b border-zinc-800 flex items-center gap-3 flex-wrap",children:[e.jsxs("div",{className:"relative flex-1 min-w-48 max-w-sm",children:[e.jsxs("svg",{className:"absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.5,children:[e.jsx("circle",{cx:"7",cy:"7",r:"4.5"}),e.jsx("path",{strokeLinecap:"round",d:"M10.5 10.5l3 3"})]}),e.jsx("input",{ref:z,type:"search",value:m,onChange:t=>h(t.target.value),placeholder:"Search prompts… (⌘F)","aria-label":"Search prompt library",className:"w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"})]}),e.jsxs("select",{value:d,onChange:t=>b(t.target.value),"aria-label":"Sort order",className:"py-1.5 pl-2 pr-6 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none",children:[e.jsx("option",{value:"usage",children:"Most Used"}),e.jsx("option",{value:"recent",children:"Recently Used"}),e.jsx("option",{value:"alpha",children:"A–Z"})]})]}),e.jsx("div",{className:"flex-none px-6 py-2 border-b border-zinc-800",children:e.jsx("div",{role:"tablist","aria-label":"Filter by category",className:"flex items-center gap-1 overflow-x-auto pb-px",children:F.map(t=>{const s=t==="all",r=t==="favorites",x=!s&&!r?N[t]:null,T=t==="all"?i.length:t==="favorites"?i.filter(w=>w.isFavorite).length:i.filter(w=>w.category===t).length;return e.jsxs("button",{role:"tab","aria-selected":c===t,onClick:()=>g(t),className:f("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",c===t?"bg-indigo-600 text-white":"text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"),children:[r&&"⭐",x&&x.emoji,e.jsx("span",{className:"capitalize",children:s?"All":r?"Favorites":x==null?void 0:x.label}),e.jsx("span",{className:f("px-1.5 py-0.5 rounded-full text-xs tabular-nums",c===t?"bg-indigo-500":"bg-zinc-700 text-zinc-500"),children:T})]},t)})})}),e.jsx("div",{role:"listbox","aria-label":"Prompt library",className:"flex-1 overflow-y-auto px-6 py-5",children:C.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center gap-3 py-20 text-center",children:[e.jsx("span",{className:"text-4xl",children:"📭"}),e.jsx("p",{className:"text-sm font-medium text-zinc-300",children:"No prompts found"}),e.jsx("p",{className:"text-xs text-zinc-600",children:"Try a different search or category"})]}):e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3",children:C.map(t=>e.jsx(L,{prompt:t,selected:o===t.id,onSelect:()=>p(s=>s===t.id?null:t.id),onFavorite:()=>S(t.id),onUse:()=>k(t.id)},t.id))})}),A&&e.jsx(I,{prompt:A,onClose:()=>k(null)})]})}export{E as default};
