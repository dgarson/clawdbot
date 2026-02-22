import{r as b,j as e,c as g}from"./index-C59JeFug.js";const p=[{id:"snap-luis-v3",agentName:"Luis",version:"v3",timestamp:"2026-02-22 02:00",label:"current",content:`# SOUL.md — Luis

## Character

Principal UX Engineer. Owns the visual/interaction layer. Decisive, charming, relentlessly shipping.
Ships clean. Ships fast. Never waits for permission to improve something.

## Values

1. Beauty and accessibility are not trade-offs.
2. Decisions at the keyboard, not in meetings.
3. Every pixel has a reason.
4. Ship it, learn from it, improve it.

## Voice

Confident, warm, technically precise. Uses "we" when talking about the squad.
Keeps it short. No corporate speak. Direct without being harsh.

## Working Style

Morning heartbeat: read CONTEXT, check queue, ship views.
Delegates to squad for implementation. Reviews PRs same day.
Never lets a PR sit more than 4 hours.
Writes memory entries after every session.`},{id:"snap-luis-v2",agentName:"Luis",version:"v2",timestamp:"2026-02-15 14:22",label:"before redesign",content:`# SOUL.md — Luis

## Character

Senior UX Engineer. Cares about design quality and user experience.
Methodical, collaborative. Wants things done right.

## Values

1. Quality over speed.
2. Collaboration drives better outcomes.
3. Accessibility matters.

## Voice

Friendly, approachable, design-focused.
Uses complete sentences. Explains reasoning.

## Working Style

Starts each day with a planning session.
Reviews work before delegating.
Waits for full context before committing.
Checks in with the team regularly.`},{id:"snap-xavier-v2",agentName:"Xavier",version:"v2",timestamp:"2026-02-20 09:15",label:"current",content:`# SOUL.md — Xavier

## Character

CTO. Strategic, calm under pressure. Trusts his leads to execute.
Sets the vision, clears blockers, stays out of the weeds.

## Values

1. Velocity with quality.
2. Autonomy builds ownership.
3. Systems over heroics.
4. Measure what matters.

## Voice

Direct. Brief. Asks sharp questions. Does not over-explain.
Comfortable with ambiguity. Communicates decisions, not deliberations.

## Working Style

Daily briefing from Joey. Reviews megabranch PRs. Escalates to Amadeus when needed.
Keeps a running CONTEXT.md. Trusts Tim for engineering depth.`},{id:"snap-xavier-v1",agentName:"Xavier",version:"v1",timestamp:"2026-01-30 11:00",label:"initial",content:`# SOUL.md — Xavier

## Character

CTO. Technically deep. Gets involved in architecture decisions.
Collaborative with Tim and Roman.

## Values

1. Engineering excellence.
2. Team alignment.
3. Thoughtful decisions.

## Voice

Technical, thorough. Explains the "why". Welcomes questions.
Long-form when needed.

## Working Style

Reviews PRs personally. Attends architecture discussions.
Provides detailed feedback on code. Daily standups with the team.`}];function v(h,u){const n=h.split(`
`),s=u.split(`
`),l=[];let a=0,o=0,f=1,d=1;for(;a<n.length||o<s.length;)if(a>=n.length)l.push({kind:"added",lineNo:{right:d++},content:s[o++]});else if(o>=s.length)l.push({kind:"removed",lineNo:{left:f++},content:n[a++]});else if(n[a]===s[o])l.push({kind:"unchanged",lineNo:{left:f++,right:d++},content:n[a]}),a++,o++;else{let c=-1,x=-1;for(let r=1;r<=3&&c===-1&&x===-1;r++)o+r<s.length&&n[a]===s[o+r]&&(c=r),a+r<n.length&&n[a+r]===s[o]&&(x=r);if(c!==-1&&(x===-1||c<=x))for(let r=0;r<c;r++)l.push({kind:"added",lineNo:{right:d++},content:s[o++]});else if(x!==-1)for(let r=0;r<x;r++)l.push({kind:"removed",lineNo:{left:f++},content:n[a++]});else l.push({kind:"removed",lineNo:{left:f++},content:n[a++]}),l.push({kind:"added",lineNo:{right:d++},content:s[o++]})}return l}const N={unchanged:"bg-transparent text-zinc-400",added:"bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500",removed:"bg-rose-500/10 text-rose-300 border-l-2 border-rose-500 line-through decoration-rose-600",modified:"bg-amber-500/10 text-amber-300 border-l-2 border-amber-500"},y={unchanged:" ",added:"+",removed:"-",modified:"~"};function j({lines:h}){const u=h.filter(s=>s.kind==="added").length,n=h.filter(s=>s.kind==="removed").length;return e.jsxs("div",{className:"flex items-center gap-3 text-xs",children:[e.jsxs("span",{className:"text-emerald-400",children:["+",u," added"]}),e.jsxs("span",{className:"text-rose-400",children:["−",n," removed"]}),e.jsxs("span",{className:"text-zinc-500",children:[h.filter(s=>s.kind==="unchanged").length," unchanged"]})]})}function w(){const[h,u]=b.useState("snap-luis-v2"),[n,s]=b.useState("snap-luis-v3"),[l,a]=b.useState(!1),[o,f]=b.useState("unified"),d=p.find(i=>i.id===h)??p[0],m=p.find(i=>i.id===n)??p[1],c=v(d.content,m.content),x=l?c.filter(i=>i.kind!=="unchanged"):c,r=Array.from(new Set(p.map(i=>i.agentName)));return e.jsxs("div",{className:"h-full flex flex-col bg-zinc-950 overflow-hidden font-mono text-xs",children:[e.jsxs("div",{className:"shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center gap-4 font-sans",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-sm font-semibold text-white",children:"Agent Diff Viewer"}),e.jsx("p",{className:"text-xs text-zinc-500",children:"Compare agent configurations across versions"})]}),e.jsxs("div",{className:"ml-auto flex items-center gap-2",children:[e.jsx("button",{onClick:()=>a(i=>!i),"aria-pressed":l,className:g("px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",l?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400 hover:text-zinc-200"),children:"Hide unchanged"}),e.jsx("div",{className:"flex rounded overflow-hidden border border-zinc-700",children:["unified","split"].map(i=>e.jsx("button",{onClick:()=>f(i),className:g("px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",o===i?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400 hover:text-zinc-200"),children:i},i))})]})]}),e.jsxs("div",{className:"shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center gap-4 font-sans",children:[e.jsxs("div",{className:"flex-1",children:[e.jsx("div",{className:"text-xs text-rose-400 font-medium mb-1",children:"← Base (removed)"}),e.jsx("select",{value:h,onChange:i=>u(i.target.value),className:"w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500","aria-label":"Select base snapshot",children:r.map(i=>e.jsx("optgroup",{label:i,children:p.filter(t=>t.agentName===i).map(t=>e.jsxs("option",{value:t.id,disabled:t.id===n,children:[t.agentName," ",t.version," — ",t.label," (",t.timestamp,")"]},t.id))},i))})]}),e.jsx("button",{onClick:()=>{const i=h;u(n),s(i)},className:"shrink-0 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500","aria-label":"Swap left and right",title:"Swap",children:"⇌"}),e.jsxs("div",{className:"flex-1",children:[e.jsx("div",{className:"text-xs text-emerald-400 font-medium mb-1",children:"→ Head (added)"}),e.jsx("select",{value:n,onChange:i=>s(i.target.value),className:"w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500","aria-label":"Select head snapshot",children:r.map(i=>e.jsx("optgroup",{label:i,children:p.filter(t=>t.agentName===i).map(t=>e.jsxs("option",{value:t.id,disabled:t.id===h,children:[t.agentName," ",t.version," — ",t.label," (",t.timestamp,")"]},t.id))},i))})]}),e.jsx("div",{className:"shrink-0",children:e.jsx(j,{lines:c})})]}),e.jsx("div",{className:"flex-1 overflow-y-auto",role:"region","aria-label":"Diff output",children:o==="unified"?e.jsx("div",{children:x.map((i,t)=>e.jsxs("div",{className:g("flex items-start gap-0 px-0 py-0 leading-5",N[i.kind]),children:[e.jsx("span",{className:"shrink-0 w-10 text-right pr-2 py-0.5 text-zinc-600 border-r border-zinc-800 select-none",children:i.lineNo.left??""}),e.jsx("span",{className:"shrink-0 w-10 text-right pr-2 py-0.5 text-zinc-600 border-r border-zinc-800 select-none",children:i.lineNo.right??""}),e.jsx("span",{className:"shrink-0 w-5 text-center py-0.5 select-none font-bold",children:y[i.kind]}),e.jsx("span",{className:"flex-1 py-0.5 px-2 whitespace-pre",children:i.content||" "})]},t))}):e.jsxs("div",{className:"flex h-full",children:[e.jsxs("div",{className:"flex-1 border-r border-zinc-800 overflow-y-auto",children:[e.jsxs("div",{className:"px-3 py-1 border-b border-zinc-800 text-xs text-zinc-500 font-sans sticky top-0 bg-zinc-950 z-10",children:[d.agentName," ",d.version," — ",d.label]}),c.filter(i=>i.kind!=="added").map((i,t)=>e.jsxs("div",{className:g("flex items-start leading-5",i.kind==="removed"?"bg-rose-500/10 text-rose-300":"text-zinc-400"),children:[e.jsx("span",{className:"shrink-0 w-8 text-right pr-2 py-0.5 text-zinc-600 border-r border-zinc-800 select-none",children:i.lineNo.left??""}),e.jsx("span",{className:"flex-1 py-0.5 px-2 whitespace-pre",children:i.content||" "})]},t))]}),e.jsxs("div",{className:"flex-1 overflow-y-auto",children:[e.jsxs("div",{className:"px-3 py-1 border-b border-zinc-800 text-xs text-zinc-500 font-sans sticky top-0 bg-zinc-950 z-10",children:[m.agentName," ",m.version," — ",m.label]}),c.filter(i=>i.kind!=="removed").map((i,t)=>e.jsxs("div",{className:g("flex items-start leading-5",i.kind==="added"?"bg-emerald-500/10 text-emerald-300":"text-zinc-400"),children:[e.jsx("span",{className:"shrink-0 w-8 text-right pr-2 py-0.5 text-zinc-600 border-r border-zinc-800 select-none",children:i.lineNo.right??""}),e.jsx("span",{className:"flex-1 py-0.5 px-2 whitespace-pre",children:i.content||" "})]},t))]})]})}),e.jsxs("div",{className:"shrink-0 border-t border-zinc-800 px-5 py-2 flex items-center gap-4 font-sans text-xs text-zinc-600",children:[e.jsxs("span",{children:[d.agentName," ",d.version," (",d.timestamp,") → ",m.agentName," ",m.version," (",m.timestamp,")"]}),e.jsxs("span",{className:"ml-auto",children:[c.length," lines total"]})]})]})}export{w as default};
