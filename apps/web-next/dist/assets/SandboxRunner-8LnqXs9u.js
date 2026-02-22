import{r as l,j as e,c as r}from"./index-BuITcl8D.js";const h=[{id:"s1",name:"Token Counter",lang:"typescript",description:"Estimate token count for a string",tags:["tokens","util"],code:`// Approximate token counter
function countTokens(text: string): number {
  // ~4 chars per token on average
  const words = text.trim().split(/\\s+/);
  return Math.ceil(words.reduce((sum, w) => sum + Math.ceil(w.length / 4), 0));
}

const text = "Hello, I am an AI agent running in the OpenClaw system.";
console.log(\`Text: "\${text}"\`);
console.log(\`Estimated tokens: \${countTokens(text)}\`);
`},{id:"s2",name:"Agent Health Check",lang:"bash",description:"Check OpenClaw gateway status",tags:["ops","gateway"],code:`#!/bin/bash
echo "=== OpenClaw Health Check ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "--- Gateway ---"
openclaw gateway status 2>/dev/null || echo "Gateway: not running"
echo ""
echo "--- Disk Usage ---"
df -h /Users/openclaw/.openclaw 2>/dev/null | tail -1
echo ""
echo "--- Recent Logs ---"
tail -5 /tmp/openclaw.log 2>/dev/null || echo "No log file found"
`},{id:"s3",name:"JSON Schema Validator",lang:"json",description:"Validate agent config structure",tags:["config","validation"],code:`{
  "schema": {
    "type": "object",
    "required": ["name", "role", "model", "squad"],
    "properties": {
      "name": { "type": "string", "minLength": 2 },
      "role": { "type": "string" },
      "model": { "type": "string", "pattern": "^[a-z-]+/[\\\\w.-]+$" },
      "squad": {
        "type": "string",
        "enum": ["product-ui", "platform-core", "feature-dev", "ops"]
      },
      "tier": {
        "type": "string",
        "enum": ["executive", "principal", "senior", "worker"]
      }
    }
  },
  "sample": {
    "name": "Luis",
    "role": "Principal UX Engineer",
    "model": "anthropic/claude-sonnet-4-6",
    "squad": "product-ui",
    "tier": "principal"
  }
}`},{id:"s4",name:"Cost Calculator",lang:"python",description:"Calculate LLM API cost from token usage",tags:["cost","billing"],code:`#!/usr/bin/env python3
# LLM Cost Calculator

PRICING = {
    "anthropic/claude-opus-4-6":   {"input": 15.00, "output": 75.00},
    "anthropic/claude-sonnet-4-6": {"input":  3.00, "output": 15.00},
    "minimax-portal/MiniMax-M2.5": {"input":  0.40, "output":  1.60},
    "google/gemini-flash-preview":  {"input":  0.10, "output":  0.40},
}

usage = [
    ("anthropic/claude-opus-4-6",    12500, 3200),
    ("anthropic/claude-sonnet-4-6", 450000, 85000),
    ("minimax-portal/MiniMax-M2.5", 820000, 210000),
]

total = 0
print(f"{'Model':<35} {'Input':>10} {'Output':>10} {'Cost':>10}")
print("-" * 70)
for model, inp, out in usage:
    p = PRICING.get(model, {"input": 1, "output": 4})
    cost = (inp / 1_000_000 * p["input"]) + (out / 1_000_000 * p["output"])
    total += cost
    print(f"{model:<35} {inp:>10,} {out:>10,} \${cost:>9.4f}")
print("-" * 70)
print(f"{'TOTAL':<56} \${total:>9.4f}")
`},{id:"s5",name:"Fibonacci",lang:"typescript",description:"Memoized Fibonacci sequence",tags:["algo","example"],code:`// Memoized Fibonacci
const memo = new Map<number, bigint>();

function fib(n: number): bigint {
  if (n <= 1) return BigInt(n);
  if (memo.has(n)) return memo.get(n)!;
  const result = fib(n - 1) + fib(n - 2);
  memo.set(n, result);
  return result;
}

for (let i = 0; i <= 20; i++) {
  console.log(\`fib(\${i.toString().padStart(2)}) = \${fib(i)}\`);
}
`}],w=[{id:"run-1",code:h[0].code,lang:"typescript",startedAt:"2026-02-22T02:10:00Z",durationMs:234,status:"success",stdout:`Text: "Hello, I am an AI agent running in the OpenClaw system."
Estimated tokens: 14`,stderr:"",exitCode:0},{id:"run-2",code:h[3].code,lang:"python",startedAt:"2026-02-22T01:55:00Z",durationMs:89,status:"success",stdout:`Model                               Input      Output       Cost
----------------------------------------------------------------------
anthropic/claude-opus-4-6           12,500       3,200   $0.4275
anthropic/claude-sonnet-4-6        450,000      85,000   $2.6250
minimax-portal/MiniMax-M2.5        820,000     210,000   $0.6640
----------------------------------------------------------------------
TOTAL                                                    $3.7165`,stderr:"",exitCode:0},{id:"run-3",code:`import sys
print(sys.version
print('done')`,lang:"python",startedAt:"2026-02-22T01:42:00Z",durationMs:45,status:"error",stdout:"",stderr:`  File "<string>", line 2
    print(sys.version
                     ^
SyntaxError: '(' was never closed`,exitCode:1},{id:"run-4",code:"while true; do echo 'loop'; sleep 0.1; done",lang:"bash",startedAt:"2026-02-22T01:30:00Z",durationMs:3e4,status:"timeout",stdout:`loop
loop
loop
...`,stderr:"Process killed: execution timeout (30s)",exitCode:124}],d={typescript:{label:"TypeScript",color:"text-blue-400",bg:"bg-blue-900/20",border:"border-blue-700/50",mono:"ts"},python:{label:"Python",color:"text-yellow-400",bg:"bg-yellow-900/20",border:"border-yellow-700/50",mono:"py"},bash:{label:"Bash",color:"text-emerald-400",bg:"bg-emerald-900/20",border:"border-emerald-700/50",mono:"sh"},json:{label:"JSON",color:"text-orange-400",bg:"bg-orange-900/20",border:"border-orange-700/50",mono:"json"}},u={idle:{label:"Idle",color:"text-zinc-400",dot:"bg-zinc-400"},running:{label:"Running",color:"text-amber-400",dot:"bg-amber-400 animate-pulse"},success:{label:"Success",color:"text-emerald-400",dot:"bg-emerald-400"},error:{label:"Error",color:"text-rose-400",dot:"bg-rose-400"},timeout:{label:"Timeout",color:"text-orange-400",dot:"bg-orange-400"}};function I(){const[p,g]=l.useState(h[0].code),[a,j]=l.useState("typescript"),[i,m]=l.useState("idle"),[x,N]=l.useState(w),[s,b]=l.useState(w[0]),[f,z]=l.useState("snippets"),[v,C]=l.useState("stdout");function M(){if(i==="running")return;m("running");const t={id:`run-${Date.now()}`,code:p,lang:a,startedAt:new Date().toISOString(),durationMs:0,status:"running",stdout:"",stderr:"",exitCode:-1};N(o=>[t,...o]),b(t);const n=800+Math.random()*1200;setTimeout(()=>{const o=Math.random()>.25,c={...t,durationMs:Math.round(n),status:o?"success":"error",stdout:o?a==="typescript"?`[Compiled OK]
${p.includes("console.log")?"Output: <simulated result>":"Module evaluated successfully."}`:a==="python"?`Script executed successfully.
Return code: 0`:a==="bash"?`Command completed.
$ _`:"JSON parsed: valid":"",stderr:o?"":`RuntimeError: Execution failed at line ${Math.floor(Math.random()*10)+1}
  Unexpected token`,exitCode:o?0:1};N(A=>A.map(y=>y.id===t.id?c:y)),b(c),m(o?"success":"error"),setTimeout(()=>m("idle"),2e3)},n)}function S(t){g(t.code),j(t.lang),m("idle")}const k=x.filter(t=>t.status==="success").length,T=x.filter(t=>t.status==="error").length,$=x.filter(t=>t.durationMs>0).reduce((t,n,o,c)=>t+n.durationMs/c.length,0);return e.jsxs("div",{className:"h-full flex flex-col bg-zinc-950 overflow-hidden",children:[e.jsxs("div",{className:"flex-shrink-0 px-6 py-4 border-b border-zinc-800",children:[e.jsxs("div",{className:"flex items-center justify-between mb-3",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-xl font-bold text-white",children:"Sandbox Runner"}),e.jsx("p",{className:"text-sm text-zinc-400",children:"Execute code safely in an isolated environment"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"flex gap-1",children:Object.keys(d).map(t=>{const n=d[t];return e.jsxs("button",{onClick:()=>j(t),className:r("px-2.5 py-1 rounded text-xs border transition-all",a===t?`${n.bg} ${n.color} ${n.border}`:"bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300"),children:[".",n.mono]},t)})}),e.jsx("button",{onClick:M,disabled:i==="running",className:r("px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",i==="running"?"bg-zinc-700 text-zinc-400 cursor-not-allowed":"bg-indigo-600 hover:bg-indigo-500 text-white"),children:i==="running"?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"animate-spin",children:"⟳"})," Running…"]}):e.jsx(e.Fragment,{children:"▶ Run"})})]})]}),e.jsxs("div",{className:"flex items-center gap-6 text-sm",children:[e.jsxs("span",{children:[e.jsx("span",{className:"text-zinc-500",children:"Runs:"})," ",e.jsx("span",{className:"text-white font-medium",children:x.length})]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-zinc-500",children:"Success:"})," ",e.jsx("span",{className:"text-emerald-400 font-medium",children:k})]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-zinc-500",children:"Errors:"})," ",e.jsx("span",{className:"text-rose-400 font-medium",children:T})]}),e.jsxs("span",{children:[e.jsx("span",{className:"text-zinc-500",children:"Avg duration:"})," ",e.jsxs("span",{className:"text-indigo-400 font-medium",children:[Math.round($),"ms"]})]}),e.jsxs("div",{className:"flex items-center gap-1.5 ml-auto",children:[e.jsx("span",{className:r("w-2 h-2 rounded-full",u[i].dot)}),e.jsx("span",{className:r("text-xs",u[i].color),children:u[i].label})]})]})]}),e.jsxs("div",{className:"flex-1 overflow-hidden flex",children:[e.jsxs("div",{className:"flex-1 flex flex-col overflow-hidden border-r border-zinc-800",children:[e.jsxs("div",{className:"flex-1 overflow-hidden flex flex-col",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:r("text-xs font-medium",d[a].color),children:d[a].label}),e.jsx("span",{className:"text-zinc-700",children:"·"}),e.jsxs("span",{className:"text-xs text-zinc-500",children:[p.split(`
`).length," lines"]})]}),e.jsx("button",{onClick:()=>g(""),className:"text-xs text-zinc-600 hover:text-zinc-400",children:"Clear"})]}),e.jsx("textarea",{value:p,onChange:t=>g(t.target.value),spellCheck:!1,className:"flex-1 bg-zinc-950 text-zinc-200 font-mono text-xs p-4 resize-none outline-none leading-relaxed",style:{tabSize:2}})]}),e.jsxs("div",{className:"flex-shrink-0 h-48 border-t border-zinc-800 flex flex-col",children:[e.jsxs("div",{className:"flex items-center gap-0 px-4 bg-zinc-900/50 border-b border-zinc-800",children:[["stdout","stderr"].map(t=>e.jsxs("button",{onClick:()=>C(t),className:r("px-3 py-2 text-xs border-b-2 -mb-px transition-colors",v===t?"border-indigo-500 text-white":"border-transparent text-zinc-500 hover:text-zinc-300"),children:[t,t==="stderr"&&(s==null?void 0:s.stderr)&&e.jsx("span",{className:"ml-1.5 bg-rose-900/50 text-rose-400 px-1 rounded text-[9px]",children:"!"})]},t)),s&&e.jsxs("div",{className:"ml-auto flex items-center gap-2 text-xs",children:[e.jsx("span",{className:r(u[s.status].color),children:u[s.status].label}),s.durationMs>0&&e.jsxs("span",{className:"text-zinc-600",children:[s.durationMs,"ms"]}),e.jsxs("span",{className:"text-zinc-600",children:["exit: ",s.exitCode===-1?"…":s.exitCode]})]})]}),e.jsx("div",{className:"flex-1 overflow-y-auto p-3 font-mono text-xs",children:s?v==="stdout"?s.stdout?e.jsx("pre",{className:"text-emerald-300 whitespace-pre-wrap",children:s.stdout}):e.jsx("span",{className:"text-zinc-600",children:"No output"}):s.stderr?e.jsx("pre",{className:"text-rose-400 whitespace-pre-wrap",children:s.stderr}):e.jsx("span",{className:"text-zinc-600",children:"No stderr"}):e.jsx("span",{className:"text-zinc-600",children:"Run code to see output"})})]})]}),e.jsxs("div",{className:"flex-shrink-0 w-72 flex flex-col overflow-hidden",children:[e.jsx("div",{className:"flex border-b border-zinc-800 bg-zinc-900/30",children:["snippets","history"].map(t=>e.jsx("button",{onClick:()=>z(t),className:r("flex-1 px-3 py-3 text-xs capitalize border-b-2 -mb-px transition-colors",f===t?"border-indigo-500 text-white":"border-transparent text-zinc-500 hover:text-zinc-300"),children:t},t))}),e.jsxs("div",{className:"flex-1 overflow-y-auto",children:[f==="snippets"&&e.jsx("div",{className:"p-3 space-y-2",children:h.map(t=>{const n=d[t.lang];return e.jsxs("button",{onClick:()=>S(t),className:"w-full text-left p-3 rounded-lg border bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-all",children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("span",{className:"text-sm font-medium text-white",children:t.name}),e.jsxs("span",{className:r("text-[10px] px-1.5 py-0.5 rounded border",n.bg,n.color,n.border),children:[".",n.mono]})]}),e.jsx("div",{className:"text-xs text-zinc-400 mb-2",children:t.description}),e.jsx("div",{className:"flex flex-wrap gap-1",children:t.tags.map(o=>e.jsx("span",{className:"text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded",children:o},o))})]},t.id)})}),f==="history"&&e.jsx("div",{className:"p-3 space-y-2",children:x.map(t=>{const n=u[t.status],o=d[t.lang],c=(s==null?void 0:s.id)===t.id;return e.jsxs("button",{onClick:()=>b(t),className:r("w-full text-left p-3 rounded-lg border transition-all",c?"bg-indigo-900/20 border-indigo-600/50":"bg-zinc-900 border-zinc-800 hover:border-zinc-600"),children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsxs("span",{className:r("flex items-center gap-1.5 text-xs font-medium",n.color),children:[e.jsx("span",{className:r("w-1.5 h-1.5 rounded-full",n.dot)}),n.label]}),e.jsxs("span",{className:r("text-[10px] px-1.5 py-0.5 rounded border",o.bg,o.color,o.border),children:[".",o.mono]})]}),e.jsxs("div",{className:"text-[10px] text-zinc-500",children:[t.startedAt.slice(11,19)," · ",t.durationMs>0?`${t.durationMs}ms`:"…"]}),t.stdout&&e.jsx("div",{className:"text-[10px] text-zinc-600 font-mono truncate mt-1",children:t.stdout.split(`
`)[0]})]},t.id)})})]})]})]})]})}export{I as default};
