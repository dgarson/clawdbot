import React, { useState, useMemo, useCallback } from "react";
import { 
  Users, 
  Target, 
  GitCompare, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  ArrowRightLeft, 
  Filter, 
  SortAsc, 
  SortDesc,
  Merge,
  ChevronDown,
  Search,
  RefreshCw,
  Eye,
  FileDiff,
  Shield,
  Bug,
  Database,
  Network,
  Lock,
  Server,
  Globe,
  Terminal,
  Code,
  Layers,
  Cpu,
  HardDrive,
  Wifi,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Activity,
  Zap,
  Clock,
  TrendingUp,
  Box,
  Cloud,
  Container,
  Layers2,
  Workflow,
  Settings,
  UserCheck,
  UserX,
  Key,
  Fingerprint,
  EyeOff,
  Undo2,
  Redo2,
  Copy,
  Download,
  Share2,
  MoreHorizontal,
  X,
  Plus,
  Minus,
  Equal,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Octagon,
  Pentagon,
  Star,
  Heart,
  Sparkles,
  Lightbulb,
  Rocket,
  Crosshair,
  Microscope,
  Compass,
  Map as MapIcon,
  Route,
  Footprints,
  Scan,
  ScanLine,
  Radar,
  Satellite,
  Orbit,
  Atom,
  Beaker,
  FlaskConical,
  TestTube,
  FlaskRound,
  Pipette,
  Scale,
  Gavel,
  Award,
  Medal,
  Trophy,
  Crown,
  Gem,
  Diamond,
  Swords,
  ShieldHalf,
  Target as TargetIcon,
  Crosshair as CrosshairIcon,
  CircleDot,
  CircleDashed,
  SquareDashed,
  Pentagon as PentagonIcon,
  Hexagon as HexagonIcon,
  Octagon as OctagonIcon,
  Box as BoxIcon,
  Package,
  Archive,
  Warehouse,
  Building2,
  Factory,
  Store,
  Landmark,
  Banknote,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp as TrendingUpIcon,
  DollarSign,
  Euro,
  Bitcoin,
  Coins,
  Receipt,
  FileText,
  FileJson,
  FileCode,
  File,
  Folder,
  FolderOpen,
  FolderSearch,
  FolderPlus,
  FolderMinus,
  FilePlus,
  FileMinus,
  FileEdit,
  FileCheck,
  FileWarning,
  FileX,
  FileSearch,
  FileQuestion,
  FileOutput,
  FileInput,
  Upload,
  Download as DownloadIcon,
  Share,
  Printer,
  Monitor,
  Laptop,
  Smartphone,
  Tablet,
  Watch,
  Speaker,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Video,
  VideoOff,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Inbox,
  Mailbox,
  Archive as ArchiveIcon,
  Trash2,
  Trash,
  Recycle,
  ArchiveX,
  ArchiveRestore,
  Calendar,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  CalendarCheck,
  Clock as ClockIcon,
  Timer,
  Hourglass,
  Bell,
  BellOff,
  BellRing,
  Rss,
  Wifi as WifiIcon,
  WifiOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Antenna,
  Radio,
  Disc,
  Music,
  Headphones,
  Volume,
  Volume1,
  Volume2 as Volume2Icon,
  Mic as MicIcon
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  type: "scanner" | "analyzer" | "recon" | "exploit" | "validator";
  version: string;
  lastRun: string;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  category: "vulnerability" | "misconfiguration" | "exposure" | "compliance" | "asset" | "service";
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  evidence: string;
  remediation?: string;
  cwe?: string;
  cve?: string;
  cvss?: number;
  affectedAsset?: string;
  port?: number;
  protocol?: string;
  timestamp: string;
  rawOutput?: string;
  tags?: string[];
}

interface AgentRun {
  id: string;
  agentId: string;
  target: string;
  startTime: string;
  endTime: string;
  status: "completed" | "failed" | "running" | "partial";
  findings: Finding[];
  summary: {
    totalFindings: number;
    bySeverity: Record<string, number>;
    duration: number;
  };
}

interface DiffResult {
  findingId: string;
  status: "agreement" | "contradiction" | "a-only" | "b-only" | "severity-mismatch";
  findingA?: Finding;
  findingB?: Finding;
  similarity?: number;
}

interface MockData {
  agents: Agent[];
  runs: AgentRun[];
  targets: string[];
}

const mockData: MockData = {
  agents: [
    {
      id: "agent-001",
      name: "NmapScanner-Pro",
      type: "scanner",
      version: "2.4.1",
      lastRun: "2026-02-22T14:30:00Z"
    },
    {
      id: "agent-002",
      name: "DeepRecon-AI",
      type: "recon",
      version: "3.1.0",
      lastRun: "2026-02-22T14:28:00Z"
    },
    {
      id: "agent-003",
      name: "VulnAnalyze-X",
      type: "analyzer",
      version: "1.8.2",
      lastRun: "2026-02-22T14:25:00Z"
    },
    {
      id: "agent-004",
      name: "ConfigValidator",
      type: "validator",
      version: "2.0.5",
      lastRun: "2026-02-22T14:20:00Z"
    }
  ],
  targets: [
    "192.168.1.100",
    "10.0.0.50",
    "corp.example.com",
    "api.example.com",
    "192.168.1.0/24"
  ],
  runs: [
    {
      id: "run-001",
      agentId: "agent-001",
      target: "192.168.1.100",
      startTime: "2026-02-22T14:25:00Z",
      endTime: "2026-02-22T14:30:00Z",
      status: "completed",
      findings: [
        {
          id: "find-001",
          title: "Open SSH Port (22)",
          description: "SSH service detected on port 22 with version OpenSSH 8.4p1",
          category: "exposure",
          severity: "medium",
          confidence: 0.98,
          evidence: "Port 22/tcp open ssh OpenSSH 8.4p1 Debian 5",
          remediation: "Ensure SSH is behind VPN or use key-based authentication only",
          affectedAsset: "192.168.1.100",
          port: 22,
          protocol: "tcp",
          timestamp: "2026-02-22T14:26:00Z",
          tags: ["ssh", "remote-access", "linux"]
        },
        {
          id: "find-002",
          title: "HTTP Service on Port 80",
          description: "Apache httpd 2.4.41 detected on port 80",
          category: "exposure",
          severity: "low",
          confidence: 0.95,
          evidence: "Port 80/tcp open http Apache httpd 2.4.41",
          remediation: "Ensure HTTP is redirected to HTTPS",
          affectedAsset: "192.168.1.100",
          port: 80,
          protocol: "tcp",
          timestamp: "2026-02-22T14:26:30Z",
          tags: ["http", "web", "apache"]
        },
        {
          id: "find-003",
          title: "Outdated OpenSSL Version",
          description: "OpenSSL 1.1.1k detected which has known vulnerabilities",
          category: "vulnerability",
          severity: "high",
          confidence: 0.92,
          evidence: "OpenSSL 1.1.1k 25 Mar 2021",
          remediation: "Upgrade to OpenSSL 3.0.x or latest 1.1.1 version",
          cwe: "CWE-1104",
          cvss: 7.5,
          affectedAsset: "192.168.1.100",
          timestamp: "2026-02-22T14:27:00Z",
          tags: ["openssl", "cryptography", "outdated"]
        },
        {
          id: "find-004",
          title: "MySQL Service Detected",
          description: "MySQL 8.0.23 detected on port 3306",
          category: "exposure",
          severity: "critical",
          confidence: 0.97,
          evidence: "Port 3306/tcp open mysql MySQL 8.0.23",
          remediation: "Ensure MySQL is not exposed to public internet; use VPC",
          affectedAsset: "192.168.1.100",
          port: 3306,
          protocol: "tcp",
          timestamp: "2026-02-22T14:27:30Z",
          tags: ["mysql", "database", "internal"]
        },
        {
          id: "find-005",
          title: "Default Apache Page Visible",
          description: "Default Apache2 Ubuntu default page is being served",
          category: "misconfiguration",
          severity: "low",
          confidence: 0.88,
          evidence: "HTTP title: \"Apache2 Ubuntu Default Page\"",
          remediation: "Deploy proper application to document root",
          affectedAsset: "192.168.1.100",
          port: 80,
          protocol: "tcp",
          timestamp: "2026-02-22T14:28:00Z",
          tags: ["apache", "misconfiguration", "default"]
        }
      ],
      summary: {
        totalFindings: 5,
        bySeverity: { critical: 1, high: 1, medium: 1, low: 2, info: 0 },
        duration: 300
      }
    },
    {
      id: "run-002",
      agentId: "agent-002",
      target: "192.168.1.100",
      startTime: "2026-02-22T14:24:00Z",
      endTime: "2026-02-22T14:28:00Z",
      status: "completed",
      findings: [
        {
          id: "find-001-b",
          title: "Open SSH Port (22)",
          description: "SSH service detected - OpenSSH 8.4p1 Debian 5",
          category: "exposure",
          severity: "medium",
          confidence: 0.99,
          evidence: "SSH-2.0-OpenSSH_8.4p1 Debian-5",
          remediation: "Restrict SSH access to specific IPs",
          affectedAsset: "192.168.1.100",
          port: 22,
          protocol: "tcp",
          timestamp: "2026-02-22T14:25:00Z",
          tags: ["ssh", "remote-access"]
        },
        {
          id: "find-002-b",
          title: "HTTP Service on Port 80",
          description: "Apache HTTP server running on port 80",
          category: "exposure",
          severity: "info",
          confidence: 0.90,
          evidence: "Server: Apache/2.4.41",
          remediation: "Consider redirecting to HTTPS",
          affectedAsset: "192.168.1.100",
          port: 80,
          protocol: "tcp",
          timestamp: "2026-02-22T14:25:30Z",
          tags: ["http", "web"]
        },
        {
          id: "find-003-b",
          title: "Critical OpenSSL Vulnerability",
          description: "OpenSSL 1.1.1k has CVE-2021-3711 and other CVEs",
          category: "vulnerability",
          severity: "critical",
          confidence: 0.95,
          evidence: "OpenSSL 1.1.1k - Multiple CVEs reported",
          remediation: "URGENT: Upgrade OpenSSL immediately",
          cwe: "CWE-119",
          cve: "CVE-2021-3711",
          cvss: 9.1,
          affectedAsset: "192.168.1.100",
          timestamp: "2026-02-22T14:26:00Z",
          tags: ["openssl", "critical", "cve"]
        },
        {
          id: "find-004-b",
          title: "Exposed MySQL Database",
          description: "MySQL 8.0.23 listening on port 3306 - potential data exposure",
          category: "vulnerability",
          severity: "critical",
          confidence: 0.98,
          evidence: "MySQL 8.0.23 - Protocol negotiation successful",
          remediation: "CRITICAL: Block port 3306 at firewall immediately",
          affectedAsset: "192.168.1.100",
          port: 3306,
          protocol: "tcp",
          timestamp: "2026-02-22T14:26:30Z",
          tags: ["mysql", "critical", "database", "exposed"]
        },
        {
          id: "find-006-b",
          title: "Redis Cache Exposed",
          description: "Redis 6.0.16 detected on port 6379",
          category: "vulnerability",
          severity: "high",
          confidence: 0.94,
          evidence: "Redis 6.0.16 - RESP protocol detected",
          remediation: "Bind Redis to localhost or enable authentication",
          affectedAsset: "192.168.1.100",
          port: 6379,
          protocol: "tcp",
          timestamp: "2026-02-22T14:27:00Z",
          tags: ["redis", "cache", "no-auth"]
        },
        {
          id: "find-007-b",
          title: "SMB Service Running",
          description: "SMB (Samba) detected on ports 445/139",
          category: "exposure",
          severity: "high",
          confidence: 0.91,
          evidence: "SMB dialect: NT LM 0.12",
          remediation: "Disable SMB if not required or restrict access",
          affectedAsset: "192.168.1.100",
          port: 445,
          protocol: "tcp",
          timestamp: "2026-02-22T14:27:30Z",
          tags: ["smb", "samba", "windows"]
        }
      ],
      summary: {
        totalFindings: 6,
        bySeverity: { critical: 3, high: 2, medium: 0, low: 0, info: 1 },
        duration: 240
      }
    },
    {
      id: "run-003",
      agentId: "agent-001",
      target: "api.example.com",
      startTime: "2026-02-22T13:00:00Z",
      endTime: "2026-02-22T13:15:00Z",
      status: "completed",
      findings: [
        {
          id: "find-api-001",
          title: "TLS 1.0 Enabled",
          description: "Server supports TLS 1.0 which is deprecated",
          category: "misconfiguration",
          severity: "high",
          confidence: 0.96,
          evidence: "TLSv1.0 cipher suites offered",
          remediation: "Disable TLS 1.0 and 1.1",
          affectedAsset: "api.example.com",
          timestamp: "2026-02-22T13:05:00Z",
          tags: ["tls", "ssl", "deprecated"]
        },
        {
          id: "find-api-002",
          title: "API Endpoint Without Rate Limiting",
          description: "No rate limiting detected on /api/v1/ endpoint",
          category: "vulnerability",
          severity: "medium",
          confidence: 0.85,
          evidence: "200+ requests/minute accepted without throttling",
          remediation: "Implement rate limiting middleware",
          affectedAsset: "api.example.com",
          timestamp: "2026-02-22T13:10:00Z",
          tags: ["api", "rate-limit", "dos"]
        }
      ],
      summary: {
        totalFindings: 2,
        bySeverity: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
        duration: 900
      }
    },
    {
      id: "run-004",
      agentId: "agent-002",
      target: "api.example.com",
      startTime: "2026-02-22T12:55:00Z",
      endTime: "2026-02-22T13:08:00Z",
      status: "completed",
      findings: [
        {
          id: "find-api-001-b",
          title: "TLS 1.0/1.1 Deprecated Protocols",
          description: "Server accepts TLS 1.0 and TLS 1.1 connections",
          category: "compliance",
          severity: "high",
          confidence: 0.97,
          evidence: "SSL Labs: TLS 1.0 and 1.1 enabled",
          remediation: "Disable TLS 1.0 and 1.1 - PCI DSS violation",
          affectedAsset: "api.example.com",
          timestamp: "2026-02-22T13:00:00Z",
          tags: ["tls", "compliance", "pci"]
        },
        {
          id: "find-api-002-b",
          title: "Missing Rate Limiting on API",
          description: "API endpoints lack rate limiting protection",
          category: "vulnerability",
          severity: "high",
          confidence: 0.88,
          evidence: "No X-RateLimit headers observed",
          remediation: "Add rate limiting to all public endpoints",
          affectedAsset: "api.example.com",
          timestamp: "2026-02-22T13:05:00Z",
          tags: ["api", "rate-limit", "protection"]
        },
        {
          id: "find-api-003-b",
          title: "Weak SSL Cipher Suites",
          description: "Server supports weak cipher suites including 3DES",
          category: "misconfiguration",
          severity: "medium",
          confidence: 0.82,
          evidence: "3DES, RC4 ciphers accepted",
          remediation: "Disable weak ciphers - use only AES-GCM",
          affectedAsset: "api.example.com",
          timestamp: "2026-02-22T13:06:00Z",
          tags: ["ssl", "cipher", "weak"]
        }
      ],
      summary: {
        totalFindings: 3,
        bySeverity: { critical: 0, high: 2, medium: 1, low: 0, info: 0 },
        duration: 780
      }
    }
  ]
};

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40" },
  medium: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/40" },
  low: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40" },
  info: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/40" }
};

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  vulnerability: ShieldAlert,
  misconfiguration: Settings,
  exposure: Eye,
  compliance: FileCheck,
  asset: HardDrive,
  service: Server
};

function FindingCard({ 
  finding, 
  compact = false,
  variant = "default"
}: { 
  finding: Finding;
  compact?: boolean;
  variant?: "default" | "green" | "red" | "yellow" | "gray";
}) {
  const colors = severityColors[finding.severity];
  const CategoryIcon = categoryIcons[finding.category] || Bug;
  
  const variantStyles = {
    default: "border-zinc-700/50 bg-zinc-800/50",
    green: "border-emerald-500/30 bg-emerald-900/20",
    red: "border-red-500/30 bg-red-900/20",
    yellow: "border-yellow-500/30 bg-yellow-900/20",
    gray: "border-zinc-600/30 bg-zinc-800/30"
  };

  if (compact) {
    return (
      <div className={`p-2 rounded-md border ${variantStyles[variant]} ${colors.border}`}>
        <div className="flex items-start gap-2">
          <CategoryIcon className={`w-4 h-4 mt-0.5 ${colors.text}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} font-medium`}>
                {finding.severity.toUpperCase()}
              </span>
              <span className="text-sm text-gray-200 truncate">{finding.title}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${variantStyles[variant]} ${colors.border} hover:border-zinc-600 transition-colors`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CategoryIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.text}`} />
          <span className="text-sm font-medium text-gray-100 truncate">{finding.title}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${colors.bg} ${colors.text} font-medium`}>
          {finding.severity.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-2 line-clamp-2">{finding.description}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {finding.port && (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            :{finding.port}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {Math.round(finding.confidence * 100)}%
        </span>
        {finding.cvss && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            CVSS {finding.cvss}
          </span>
        )}
      </div>
    </div>
  );
}

function AgentOutputDiffViewer() {
  const [selectedAgentA, setSelectedAgentA] = useState<string>("agent-001");
  const [selectedAgentB, setSelectedAgentB] = useState<string>("agent-002");
  const [selectedTarget, setSelectedTarget] = useState<string>("192.168.1.100");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"severity" | "category" | "confidence">("severity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showRawOutput, setShowRawOutput] = useState<string | null>(null);

  const availableRuns = useMemo(() => {
    return mockData.runs.filter(
      run => run.target === selectedTarget && 
             mockData.agents.find(a => a.id === run.agentId)
    );
  }, [selectedTarget]);

  const runA = useMemo(() => {
    return mockData.runs.find(
      r => r.agentId === selectedAgentA && r.target === selectedTarget
    );
  }, [selectedAgentA, selectedTarget]);

  const runB = useMemo(() => {
    return mockData.runs.find(
      r => r.agentId === selectedAgentB && r.target === selectedTarget
    );
  }, [selectedAgentB, selectedTarget]);

  const diffResults = useMemo(() => {
    const results: DiffResult[] = [];
    const findingsA = runA?.findings || [];
    const findingsB = runB?.findings || [];

    const titleToFindingA = new Map(findingsA.map(f => [f.title.toLowerCase(), f]));
    const titleToFindingB = new Map(findingsB.map(f => [f.title.toLowerCase(), f]));

    findingsA.forEach(findingA => {
      const findingB = titleToFindingB.get(findingA.title.toLowerCase());
      
      if (findingB) {
        if (findingA.severity === findingB.severity) {
          results.push({
            findingId: findingA.id,
            status: "agreement",
            findingA,
            findingB,
            similarity: 1
          });
        } else {
          results.push({
            findingId: findingA.id,
            status: "severity-mismatch",
            findingA,
            findingB,
            similarity: 0.8
          });
        }
      } else {
        results.push({
          findingId: findingA.id,
          status: "a-only",
          findingA
        });
      }
    });

    findingsB.forEach(findingB => {
      const findingA = titleToFindingA.get(findingB.title.toLowerCase());
      if (!findingA) {
        results.push({
          findingId: findingB.id,
          status: "b-only",
          findingB
        });
      }
    });

    const contradictions = results.filter(r => 
      r.status === "severity-mismatch" || 
      (r.findingA && r.findingB && r.status === "agreement" && 
       r.findingA.severity !== r.findingB.severity)
    );

    return results;
  }, [runA, runB]);

  const filteredAndSortedResults = useMemo(() => {
    let results = [...diffResults];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(r => {
        const titleA = r.findingA?.title.toLowerCase() || "";
        const titleB = r.findingB?.title.toLowerCase() || "";
        return titleA.includes(query) || titleB.includes(query);
      });
    }

    switch (activeFilter) {
      case "agreements":
        results = results.filter(r => r.status === "agreement");
        break;
      case "contradictions":
        results = results.filter(r => r.status === "severity-mismatch");
        break;
      case "a-only":
        results = results.filter(r => r.status === "a-only");
        break;
      case "b-only":
        results = results.filter(r => r.status === "b-only");
        break;
    }

    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "severity":
          const severityA = severityOrder[a.findingA?.severity || a.findingB?.severity || "info"];
          const severityB = severityOrder[b.findingA?.severity || b.findingB?.severity || "info"];
          comparison = severityA - severityB;
          break;
        case "category":
          const catA = a.findingA?.category || a.findingB?.category || "";
          const catB = b.findingA?.category || b.findingB?.category || "";
          comparison = catA.localeCompare(catB);
          break;
        case "confidence":
          const confA = a.findingA?.confidence || a.findingB?.confidence || 0;
          const confB = b.findingA?.confidence || b.findingB?.confidence || 0;
          comparison = confA - confB;
          break;
      }
      
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return results;
  }, [diffResults, activeFilter, sortBy, sortOrder, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: diffResults.length,
      agreements: diffResults.filter(r => r.status === "agreement").length,
      contradictions: diffResults.filter(r => r.status === "severity-mismatch").length,
      aOnly: diffResults.filter(r => r.status === "a-only").length,
      bOnly: diffResults.filter(r => r.status === "b-only").length
    };
  }, [diffResults]);

  const getDiffRowVariant = (status: DiffResult["status"]): "green" | "red" | "yellow" | "gray" => {
    switch (status) {
      case "a-only": return "green";
      case "b-only": return "red";
      case "severity-mismatch": return "yellow";
      case "agreement": return "gray";
      default: return "gray";
    }
  };

  const getStatusIcon = (status: DiffResult["status"]) => {
    switch (status) {
      case "agreement":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "severity-mismatch":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "a-only":
        return <ArrowLeft className="w-4 h-4 text-emerald-400" />;
      case "b-only":
        return <ArrowRight className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: DiffResult["status"]) => {
    switch (status) {
      case "agreement": return "Agreement";
      case "severity-mismatch": return "Severity Mismatch";
      case "a-only": return "Agent A Only";
      case "b-only": return "Agent B Only";
      default: return status;
    }
  };

  const handleMerge = useCallback((diff: DiffResult) => {
    console.log("Merge action for:", diff.findingId);
  }, []);

  const agentOptions = mockData.agents.map(agent => ({
    value: agent.id,
    label: agent.name
  }));

  const targetOptions = mockData.targets.map(target => ({
    value: target,
    label: target
  }));

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg border border-zinc-700">
              <GitCompare className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-100">Agent Output Diff Viewer</h1>
              <p className="text-sm text-gray-400">Compare findings between two agents on the same target</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-sm text-gray-300 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-sm text-gray-300 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Agent A Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Agent A</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={selectedAgentA}
                  onChange={(e) => setSelectedAgentA(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-100 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  {agentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Target Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Target</label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-100 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  {targetOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Agent B Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Agent B</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={selectedAgentB}
                  onChange={(e) => setSelectedAgentB(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-100 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  {agentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter findings..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Total</span>
            </div>
            <p className="text-2xl font-semibold text-gray-100">{stats.total}</p>
          </div>
          <div className="bg-emerald-900/10 rounded-xl border border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 uppercase tracking-wider">Agreements</span>
            </div>
            <p className="text-2xl font-semibold text-emerald-400">{stats.agreements}</p>
          </div>
          <div className="bg-yellow-900/10 rounded-xl border border-yellow-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-400 uppercase tracking-wider">Contradictions</span>
            </div>
            <p className="text-2xl font-semibold text-yellow-400">{stats.contradictions}</p>
          </div>
          <div className="bg-green-900/10 rounded-xl border border-green-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeft className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 uppercase tracking-wider">A Only</span>
            </div>
            <p className="text-2xl font-semibold text-green-400">{stats.aOnly}</p>
          </div>
          <div className="bg-red-900/10 rounded-xl border border-red-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRight className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400 uppercase tracking-wider">B Only</span>
            </div>
            <p className="text-2xl font-semibold text-red-400">{stats.bOnly}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-4 border-b border-zinc-700/50">
          {[
            { id: "all", label: "All", count: stats.total },
            { id: "agreements", label: "Agreements", count: stats.agreements },
            { id: "contradictions", label: "Contradictions", count: stats.contradictions },
            { id: "a-only", label: "A-Only", count: stats.aOnly },
            { id: "b-only", label: "B-Only", count: stats.bOnly }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeFilter === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeFilter === tab.id ? "bg-indigo-500/20 text-indigo-300" : "bg-zinc-800 text-gray-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
          
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "severity" | "category" | "confidence")}
              className="bg-transparent border border-zinc-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="severity">Severity</option>
              <option value="category">Category</option>
              <option value="confidence">Confidence</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
            >
              {sortOrder === "asc" ? <SortAsc className="w-4 h-4 text-gray-400" /> : <SortDesc className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {filteredAndSortedResults.map(diff => (
            <div
              key={diff.findingId}
              className={`rounded-xl border overflow-hidden ${
                diff.status === "a-only" ? "border-emerald-500/30 bg-emerald-900/5" :
                diff.status === "b-only" ? "border-red-500/30 bg-red-900/5" :
                diff.status === "severity-mismatch" ? "border-yellow-500/30 bg-yellow-900/5" :
                "border-zinc-700/50 bg-zinc-800/30"
              }`}
            >
              {/* Diff Row Header */}
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-700/30">
                <div className="flex items-center gap-3">
                  {getStatusIcon(diff.status)}
                  <span className="text-sm font-medium text-gray-200">{getStatusLabel(diff.status)}</span>
                  {diff.status === "severity-mismatch" && diff.findingA && diff.findingB && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${severityColors[diff.findingA.severity].bg} ${severityColors[diff.findingA.severity].text}`}>
                        {diff.findingA.severity}
                      </span>
                      <ArrowRightLeft className="w-3 h-3 text-gray-500" />
                      <span className={`px-1.5 py-0.5 rounded ${severityColors[diff.findingB.severity].bg} ${severityColors[diff.findingB.severity].text}`}>
                        {diff.findingB.severity}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {diff.status === "severity-mismatch" && (
                    <button
                      onClick={() => handleMerge(diff)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded text-xs text-yellow-300 transition-colors"
                    >
                      <Merge className="w-3 h-3" />
                      Merge
                    </button>
                  )}
                  <button
                    onClick={() => setShowRawOutput(showRawOutput === diff.findingId ? null : diff.findingId)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-gray-400 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    {showRawOutput === diff.findingId ? "Hide" : "Raw"}
                  </button>
                </div>
              </div>

              {/* Three Column Layout */}
              <div className="grid grid-cols-[1fr_auto_1fr] divide-x divide-zinc-700/30">
                {/* Agent A Findings */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-indigo-500/20 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-400">A</span>
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        {mockData.agents.find(a => a.id === selectedAgentA)?.name}
                      </span>
                    </div>
                    {diff.findingA && (
                      <span className="text-xs text-gray-500">
                        {diff.findingA.port && `:${diff.findingA.port}`}
                      </span>
                    )}
                  </div>
                  {diff.findingA ? (
                    <FindingCard 
                      finding={diff.findingA} 
                      variant={diff.status === "a-only" ? "green" : diff.status === "severity-mismatch" ? "yellow" : "gray"}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No finding from Agent A
                    </div>
                  )}
                </div>

                {/* Diff Summary / Connector */}
                <div className="w-20 flex flex-col items-center justify-center gap-2 py-4 bg-zinc-900/30">
                  {diff.status === "agreement" ? (
                    <>
                      <Equal className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Match</span>
                    </>
                  ) : diff.status === "severity-mismatch" ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      <span className="text-xs text-yellow-400">Diff Severity</span>
                    </>
                  ) : diff.status === "a-only" ? (
                    <>
                      <ArrowLeft className="w-5 h-5 text-green-400" />
                      <span className="text-xs text-green-400">A Only</span>
                    </>
                  ) : diff.status === "b-only" ? (
                    <>
                      <ArrowRight className="w-5 h-5 text-red-400" />
                      <span className="text-xs text-red-400">B Only</span>
                    </>
                  ) : null}
                  
                  {diff.similarity !== undefined && (
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${diff.similarity * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(diff.similarity * 100)}%</span>
                    </div>
                  )}
                </div>

                {/* Agent B Findings */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400">B</span>
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        {mockData.agents.find(a => a.id === selectedAgentB)?.name}
                      </span>
                    </div>
                    {diff.findingB && (
                      <span className="text-xs text-gray-500">
                        {diff.findingB.port && `:${diff.findingB.port}`}
                      </span>
                    )}
                  </div>
                  {diff.findingB ? (
                    <FindingCard 
                      finding={diff.findingB}
                      variant={diff.status === "b-only" ? "red" : diff.status === "severity-mismatch" ? "yellow" : "gray"}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No finding from Agent B
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Output Toggle */}
              {showRawOutput === diff.findingId && (
                <div className="border-t border-zinc-700/30 bg-zinc-900/80 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Raw Output</span>
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-zinc-800 rounded transition-colors">
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-zinc-800 rounded transition-colors">
                        <Download className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-gray-400 font-mono bg-zinc-950 rounded-lg p-4 overflow-x-auto border border-zinc-800">
                    {diff.findingA?.rawOutput || diff.findingB?.rawOutput || "No raw output available"}
                    {"\n\n"}
                    {diff.findingA?.evidence && `Agent A Evidence:\n${diff.findingA.evidence}\n`}
                    {diff.findingB?.evidence && `Agent B Evidence:\n${diff.findingB.evidence}\n`}
                    {"\n--- Comparison Analysis ---"}
                    {"\n"}Title Match: {diff.status === "agreement" || diff.status === "severity-mismatch" ? "Yes" : "No"}
                    {"\n"}Severity Match: {diff.findingA?.severity === diff.findingB?.severity ? "Yes" : "No"}
                    {"\n"}Category Match: {diff.findingA?.category === diff.findingB?.category ? "Yes" : "No"}
                    {"\n"}Confidence Delta: {Math.abs((diff.findingA?.confidence || 0) - (diff.findingB?.confidence || 0)).toFixed(2)}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {filteredAndSortedResults.length === 0 && (
            <div className="text-center py-16 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
              <FileDiff className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 font-medium">No findings match your filters</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 py-4 border-t border-zinc-700/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400/50" />
            <span className="text-xs text-gray-400">Green: Unique to Agent A</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/50" />
            <span className="text-xs text-gray-400">Red: Unique to Agent B</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
            <span className="text-xs text-gray-400">Yellow: Same finding, different severity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-400/50" />
            <span className="text-xs text-gray-400">Gray: Both agents agree</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentOutputDiffViewer;
