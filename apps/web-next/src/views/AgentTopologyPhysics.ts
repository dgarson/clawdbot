/**
 * Optimized Force-Directed Graph Physics Engine
 * 
 * Performance optimizations for large graphs (100+ nodes):
 * - Quadtree spatial indexing for O(n log n) repulsion
 * - Canvas-based rendering (vs SVG)
 * - Viewport culling (only render visible nodes)
 * - Level of Detail (LOD) for distant nodes
 * - Web Worker support for offloading computation
 */

// ─── Types (duplicated from AgentTopologyView for standalone use) ─────────────

type RoleType = "orchestrator" | "worker" | "monitor" | "gateway" | "specialist";
type AgentStatus = "active" | "idle" | "error" | "spawning" | "draining";

interface AgentNode {
  id: string;
  name: string;
  roleType: RoleType;
  status: AgentStatus;
  model: string;
  squad: string;
  activeTokens: number;
  taskCount: number;
  latencyMs: number;
  errorRate: number;
  uptime: string;
}

interface AgentEdge {
  source: string;
  target: string;
  relationship: "reports-to" | "delegates-to" | "collaborates" | "monitors";
  weight: number;
}

interface PhysicsNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  agent: AgentNode;
}

// ─── Quadtree Implementation ────────────────────────────────────────────────

interface QuadTreeNode {
  x: number;
  y: number;
  w: number;
  h: number;
  nodes: PhysicsNode[];
  children?: QuadTreeNode[];
}

function createQuadTree(
  nodes: PhysicsNode[],
  x: number,
  y: number,
  w: number,
  h: number,
  depth = 0,
  maxDepth = 6,
  maxPoints = 4
): QuadTreeNode {
  const tree: QuadTreeNode = { x, y, w, h, nodes: [] };
  
  if (nodes.length <= maxPoints || depth >= maxDepth) {
    tree.nodes = nodes;
    return tree;
  }
  
  const midX = x + w / 2;
  const midY = y + h / 2;
  
  const quadrants = [
    nodes.filter(n => n.x < midX && n.y < midY),
    nodes.filter(n => n.x >= midX && n.y < midY),
    nodes.filter(n => n.x < midX && n.y >= midY),
    nodes.filter(n => n.x >= midX && n.y >= midY),
  ];
  
  tree.children = quadrants
    .filter(q => q.length > 0)
    .map((q, i) => {
      const cx = x + (i % 2) * (w / 2);
      const cy = y + Math.floor(i / 2) * (h / 2);
      return createQuadTree(q, cx, cy, w / 2, h / 2, depth + 1, maxDepth, maxPoints);
    });
  
  return tree;
}

function queryQuadTree(
  tree: QuadTreeNode,
  x: number,
  y: number,
  r: number,
  result: PhysicsNode[] = []
): PhysicsNode[] {
  // Check if this quadrant intersects with query circle
  if (x + r < tree.x || x - r > tree.x + tree.w ||
      y + r < tree.y || y - r > tree.y + tree.h) {
    return result;
  }
  
  // Add points in this node
  for (const node of tree.nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    if (dx * dx + dy * dy <= r * r) {
      result.push(node);
    }
  }
  
  // Recurse into children
  if (tree.children) {
    for (const child of tree.children) {
      queryQuadTree(child, x, y, r, result);
    }
  }
  
  return result;
}

// ─── Optimized Physics Engine ───────────────────────────────────────────────

interface PhysicsConfig {
  repulsionRadius: number;
  repulsionStrength: number;
  springLength: number;
  springStrength: number;
  damping: number;
  centerPull: number;
  maxVelocity: number;
}

const DEFAULT_CONFIG: PhysicsConfig = {
  repulsionRadius: 200,
  repulsionStrength: 6000,
  springLength: 160,
  springStrength: 0.04,
  damping: 0.85,
  centerPull: 0.012,
  maxVelocity: 50,
};

export function initOptimizedPositions(
  agents: AgentNode[],
  w: number,
  h: number
): PhysicsNode[] {
  const cx = w / 2;
  const cy = h / 2;
  
  // Use force-directed initial placement for better starting positions
  return agents.map((agent, i) => {
    const angle = (i / agents.length) * Math.PI * 2;
    const radius = agent.roleType === "orchestrator" ? 80
      : agent.roleType === "gateway" ? 120
      : agent.roleType === "monitor" ? 150
      : 200;
    return {
      id: agent.id,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
      agent,
    };
  });
}

export function tickOptimizedPhysics(
  nodes: PhysicsNode[],
  edges: AgentEdge[],
  w: number,
  h: number,
  config: Partial<PhysicsConfig> = {}
): PhysicsNode[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cx = w / 2;
  const cy = h / 2;
  
  // Build quadtree for spatial queries
  const padding = cfg.repulsionRadius;
  const tree = createQuadTree(nodes, -padding, -padding, w + padding * 2, h + padding * 2);
  
  const next = nodes.map((n) => ({ ...n, vx: n.vx, vy: n.vy }));
  const nodeMap: Record<string, PhysicsNode> = {};
  next.forEach((n) => { nodeMap[n.id] = n; });
  
  // Quadtree-based repulsion (O(n log n) vs O(n²))
  for (let i = 0; i < next.length; i++) {
    const node = next[i];
    
    // Query only nearby nodes using quadtree
    const nearby = queryQuadTree(tree, node.x, node.y, cfg.repulsionRadius);
    
    for (const other of nearby) {
      if (other.id === node.id) continue;
      
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      
      if (dist < cfg.repulsionRadius) {
        const force = cfg.repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force * 0.1;
        const fy = (dy / dist) * force * 0.1;
        
        node.vx -= fx;
        node.vy -= fy;
      }
    }
  }
  
  // Spring forces for edges (still O(E) where E = edges)
  edges.forEach((edge) => {
    const src = nodeMap[edge.source];
    const tgt = nodeMap[edge.target];
    if (!src || !tgt) return;
    
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = dist - cfg.springLength * (3 - edge.weight);
    
    const fx = (dx / dist) * stretch * cfg.springStrength * 0.1;
    const fy = (dy / dist) * stretch * cfg.springStrength * 0.1;
    
    src.vx += fx;
    src.vy += fy;
    tgt.vx -= fx;
    tgt.vy -= fy;
  });
  
  // Center gravity
  next.forEach((n) => {
    n.vx += (cx - n.x) * cfg.centerPull;
    n.vy += (cy - n.y) * cfg.centerPull;
  });
  
  // Integrate, dampen, clamp, and bounce off walls
  return next.map((n) => {
    const vx = Math.max(-cfg.maxVelocity, Math.min(cfg.maxVelocity, n.vx * cfg.damping));
    const vy = Math.max(-cfg.maxVelocity, Math.min(cfg.maxVelocity, n.vy * cfg.damping));
    
    let x = n.x + vx;
    let y = n.y + vy;
    
    // Bounce off walls with padding
    const padding = 60;
    if (x < padding) { x = padding; }
    if (x > w - padding) { x = w - padding; }
    if (y < padding) { y = padding; }
    if (y > h - padding) { y = h - padding; }
    
    return { ...n, vx, vy, x, y };
  });
}

// ─── Canvas Renderer ──────────────────────────────────────────────────────────

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export function isNodeVisible(
  node: PhysicsNode,
  viewport: ViewportState,
  lodThreshold = 0.3
): { visible: boolean; lod: number } {
  const nodeSize = 44; // max size
  const screenX = (node.x - viewport.x) * viewport.zoom;
  const screenY = (node.y - viewport.y) * viewport.zoom;
  const screenSize = nodeSize * viewport.zoom;
  
  // Check if within viewport with margin
  const margin = screenSize;
  const visible = 
    screenX + screenSize > 0 &&
    screenX - screenSize < viewport.width &&
    screenY + screenSize > 0 &&
    screenY - screenSize < viewport.height;
  
  // Calculate LOD (0 = full detail, 1 = minimal)
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const distFromCenter = Math.sqrt(
    Math.pow(screenX - centerX, 2) + Math.pow(screenY - centerY, 2)
  );
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
  const lod = Math.min(1, distFromCenter / maxDist);
  
  return { visible, lod };
}

export function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  nodes: PhysicsNode[],
  edges: AgentEdge[],
  viewport: ViewportState,
  selectedId: string | null,
  config: {
    roleSizes: Record<string, number>;
    roleColors: Record<string, string>;
    statusColors: Record<string, string>;
    edgeColors: Record<string, string>;
  }
): { renderTime: number; nodesRendered: number } {
  const startTime = performance.now();
  
  // Clear canvas
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  
  // Draw grid (static, could be cached)
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 0.5;
  const gridSize = 40 * viewport.zoom;
  const offsetX = (-viewport.x * viewport.zoom) % gridSize;
  const offsetY = (-viewport.y * viewport.zoom) % gridSize;
  
  for (let x = offsetX; x < viewport.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
    ctx.stroke();
  }
  for (let y = offsetY; y < viewport.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
    ctx.stroke();
  }
  
  // Build node map for edge rendering
  const nodeMap: Record<string, PhysicsNode> = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });
  
  // Draw edges
  const visibleEdges = edges.filter(e => {
    const src = nodeMap[e.source];
    const tgt = nodeMap[e.target];
    return src && tgt;
  });
  
  for (const edge of visibleEdges) {
    const src = nodeMap[edge.source];
    const tgt = nodeMap[edge.target];
    
    const x1 = (src.x - viewport.x) * viewport.zoom;
    const y1 = (src.y - viewport.y) * viewport.zoom;
    const x2 = (tgt.x - viewport.x) * viewport.zoom;
    const y2 = (tgt.y - viewport.y) * viewport.zoom;
    
    ctx.strokeStyle = config.edgeColors[edge.relationship] || "#6366f1";
    ctx.lineWidth = edge.weight * viewport.zoom;
    ctx.globalAlpha = 0.35;
    
    if (edge.relationship === "monitors") {
      ctx.setLineDash([4 * viewport.zoom, 4 * viewport.zoom]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Draw edge midpoint marker
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.beginPath();
    ctx.arc(midX, midY, 2 * viewport.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  
  // Draw nodes with LOD
  let nodesRendered = 0;
  for (const node of nodes) {
    const { visible, lod } = isNodeVisible(node, viewport);
    if (!visible) continue;
    
    nodesRendered++;
    
    const screenX = (node.x - viewport.x) * viewport.zoom;
    const screenY = (node.y - viewport.y) * viewport.zoom;
    const baseSize = config.roleSizes[node.agent.roleType] || 30;
    const size = baseSize * viewport.zoom;
    
    const isSelected = node.id === selectedId;
    const roleColor = config.roleColors[node.agent.roleType] || "#6366f1";
    const statusColor = config.statusColors[node.agent.status] || "#6b7280";
    
    // High LOD = more detail
    const showDetails = lod < 0.7;
    const showPulse = lod < 0.5 && (node.agent.status === "active" || node.agent.status === "spawning");
    
    // Pulse ring for active nodes
    if (showPulse) {
      ctx.beginPath();
      ctx.arc(screenX, screenY, size + 8 * viewport.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 1 * viewport.zoom;
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    // Selection halo
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(screenX, screenY, size + 6 * viewport.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * viewport.zoom;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    // Main circle
    ctx.beginPath();
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
    ctx.fillStyle = roleColor;
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.strokeStyle = roleColor;
    ctx.lineWidth = 2 * viewport.zoom;
    ctx.globalAlpha = 1;
    ctx.stroke();
    
    // Status ring
    ctx.beginPath();
    ctx.arc(screenX, screenY, size + 3 * viewport.zoom, 0, Math.PI * 2);
    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 2 * viewport.zoom;
    ctx.setLineDash([3 * viewport.zoom, 3 * viewport.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Name label (only when zoomed in enough)
    if (showDetails && size > 15) {
      ctx.font = `bold ${Math.max(9, 11 * viewport.zoom)}px system-ui`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.agent.name, screenX, screenY);
      
      // Role sub-label
      if (size > 20) {
        ctx.font = `${Math.max(7, 8 * viewport.zoom)}px system-ui`;
        ctx.fillStyle = roleColor;
        ctx.globalAlpha = 0.85;
        ctx.fillText(node.agent.roleType, screenX, screenY + size * 0.4);
        ctx.globalAlpha = 1;
      }
    }
  }
  
  return {
    renderTime: performance.now() - startTime,
    nodesRendered,
  };
}

// ─── Performance Monitoring ─────────────────────────────────────────────────

export interface PerformanceMetrics {
  fps: number;
  physicsTime: number;
  renderTime: number;
  nodesTotal: number;
  nodesVisible: number;
  nodesCulled: number;
}

let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 60;

export function updateFps(): number {
  frameCount++;
  const now = performance.now();
  const elapsed = now - lastFpsTime;
  
  if (elapsed >= 1000) {
    currentFps = Math.round((frameCount * 1000) / elapsed);
    frameCount = 0;
    lastFpsTime = now;
  }
  
  return currentFps;
}

export function getPerformanceClass(fps: number): string {
  if (fps >= 50) return "text-emerald-400";
  if (fps >= 30) return "text-yellow-400";
  return "text-rose-400";
}
