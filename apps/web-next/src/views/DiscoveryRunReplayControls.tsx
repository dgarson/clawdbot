import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronsRight, 
  ChevronsLeft,
  Clock,
  Target,
  Bot,
  AlertCircle,
  CheckCircle2,
  Hash,
  Zap,
  BarChart3,
  Activity,
  Layers
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
}

interface AgentEvent {
  agentId: string;
  agentName: string;
  action: "spawned" | "completed" | "errored" | "target-hit";
  timestamp: number;
  details?: string;
}

interface WaveData {
  waveIndex: number;
  timestamp: number;
  agentsActive: number;
  agentsSpawned: string[];
  agentsCompleted: string[];
  agentsErrored: string[];
  findings: Finding[];
  targetsHit: number;
  totalTargets: number;
  agentEvents: AgentEvent[];
}

interface RunMetadata {
  id: string;
  label: string;
  startTime: Date;
  endTime: Date;
  totalWaves: number;
  totalFindings: number;
  totalTargets: number;
  targetsHit: number;
  status: "completed" | "failed" | "aborted";
}

// ============================================================================
// MOCK DATA
// ============================================================================

const RUN_METADATA: RunMetadata = {
  id: "run-20260222-0847",
  label: "Production Discovery - AWS us-east-1",
  startTime: new Date("2026-02-22T08:47:00Z"),
  endTime: new Date("2026-02-22T09:23:00Z"),
  totalWaves: 6,
  totalFindings: 47,
  totalTargets: 156,
  targetsHit: 142,
  status: "completed"
};

const WAVES: WaveData[] = [
  {
    waveIndex: 0,
    timestamp: 0,
    agentsActive: 4,
    agentsSpawned: ["agent-alpha", "agent-beta", "agent-gamma", "agent-delta"],
    agentsCompleted: [],
    agentsErrored: [],
    findings: [
      { id: "f001", title: "Open SSH Port Detected", severity: "critical", category: "Network", description: "Port 22 exposed to 0.0.0.0/0" },
      { id: "f002", title: "Default Credentials", severity: "high", category: "Authentication", description: "Default admin/admin credentials found" },
      { id: "f003", title: "Outdated TLS Version", severity: "medium", category: "Configuration", description: "TLS 1.0 still enabled" },
      { id: "f004", title: "Missing Security Headers", severity: "low", category: "Web Security", description: "X-Content-Type-Options not set" }
    ],
    targetsHit: 18,
    totalTargets: 156,
    agentEvents: [
      { agentId: "agent-alpha", agentName: "Port Scanner Alpha", action: "spawned", timestamp: 0 },
      { agentId: "agent-beta", agentName: "Auth Tester Beta", action: "spawned", timestamp: 0 },
      { agentId: "agent-gamma", agentName: "Config Auditor Gamma", action: "spawned", timestamp: 0 },
      { agentId: "agent-delta", agentName: "Web Probe Delta", action: "spawned", timestamp: 0 },
      { agentId: "agent-alpha", agentName: "Port Scanner Alpha", action: "target-hit", timestamp: 45000, details: "Scanned 52 ports" }
    ]
  },
  {
    waveIndex: 1,
    timestamp: 60000,
    agentsActive: 6,
    agentsSpawned: ["agent-epsilon", "agent-zeta"],
    agentsCompleted: [],
    agentsErrored: [],
    findings: [
      { id: "f005", title: "SQL Injection Vector", severity: "critical", category: "Web App", description: "Parameter id=1 vulnerable to SQLi" },
      { id: "f006", title: "Exposed API Endpoint", severity: "high", category: "API", description: "/api/v1/admin exposed without auth" },
      { id: "f007", title: "Weak Password Policy", severity: "medium", category: "Authentication", description: "Minimum 6 characters, no complexity" },
      { id: "f008", title: "CORS Misconfiguration", severity: "medium", category: "Web Security", description: "Access-Control-Allow-Origin: *" },
      { id: "f009", title: "Verbose Error Messages", severity: "low", category: "Information Disclosure", description: "Stack traces visible in responses" }
    ],
    targetsHit: 42,
    totalTargets: 156,
    agentEvents: [
      { agentId: "agent-epsilon", agentName: "Web Scanner Epsilon", action: "spawned", timestamp: 62000 },
      { agentId: "agent-zeta", agentName: "API Fuzzer Zeta", action: "spawned", timestamp: 64000 },
      { agentId: "agent-beta", agentName: "Auth Tester Beta", action: "target-hit", timestamp: 85000, details: "Found default creds on /admin" },
      { agentId: "agent-delta", agentName: "Web Probe Delta", action: "target-hit", timestamp: 95000, details: "Discovered SQL injection" },
      { agentId: "agent-epsilon", agentName: "Web Scanner Epsilon", action: "target-hit", timestamp: 110000, details: "Mapped 24 endpoints" }
    ]
  },
  {
    waveIndex: 2,
    timestamp: 120000,
    agentsActive: 8,
    agentsSpawned: ["agent-eta", "agent-theta"],
    agentsCompleted: ["agent-alpha"],
    agentsErrored: [],
    findings: [
      { id: "f010", title: "Privilege Escalation Path", severity: "critical", category: "Access Control", description: "User can escalate to admin via role parameter" },
      { id: "f011", title: "Sensitive Data in Logs", severity: "high", category: "Data Exposure", description: "PII logged in plaintext" },
      { id: "f012", title: "Missing Rate Limiting", severity: "medium", category: "API", description: "No throttling on login endpoint" },
      { id: "f013", title: "Insecure Session Tokens", severity: "high", category: "Session", description: "Tokens not invalidated on logout" },
      { id: "f014", title: "Debug Mode Enabled", severity: "medium", category: "Configuration", description: "DEBUG=true in production" },
      { id: "f015", title: "Insufficient Logging", severity: "low", category: "Monitoring", description: "Failed logins not recorded" }
    ],
    targetsHit: 78,
    totalTargets: 156,
    agentEvents: [
      { agentId: "agent-eta", agentName: "Priv Esc Hunter Eta", action: "spawned", timestamp: 121000 },
      { agentId: "agent-theta", agentName: "Data Miner Theta", action: "spawned", timestamp: 122000 },
      { agentId: "agent-alpha", agentName: "Port Scanner Alpha", action: "completed", timestamp: 145000, details: "Scanned 156 targets, found 18 issues" },
      { agentId: "agent-eta", agentName: "Priv Esc Hunter Eta", action: "target-hit", timestamp: 160000, details: "Found privilege escalation" }
    ]
  },
  {
    waveIndex: 3,
    timestamp: 180000,
    agentsActive: 7,
    agentsSpawned: [],
    agentsCompleted: ["agent-beta", "agent-gamma"],
    agentsErrored: ["agent-zeta"],
    findings: [
      { id: "f016", title: "Remote Code Execution", severity: "critical", category: "Remote Code", description: "File upload allows code execution" },
      { id: "f017", title: "SSRF Vulnerability", severity: "high", category: "Web App", description: "Image loader vulnerable to SSRF" },
      { id: "f018", title: "XXE Injection", severity: "high", category: "XML", description: "XML parser vulnerable to XXE" },
      { id: "f019", title: "Unsafe Deserialization", severity: "critical", category: "Code Review", description: "Java deserialization not validated" },
      { id: "f020", title: "Path Traversal", severity: "medium", category: "File Access", description: "File download lacks path sanitization" }
    ],
    targetsHit: 98,
    totalTargets: 156,
    agentEvents: [
      { agentId: "agent-beta", agentName: "Auth Tester Beta", action: "completed", timestamp: 185000, details: "Tested 42 auth vectors" },
      { agentId: "agent-gamma", agentName: "Config Auditor Gamma", action: "completed", timestamp: 190000, details: "Audited 24 configs" },
      { agentId: "agent-zeta", agentName: "API Fuzzer Zeta", action: "errored", timestamp: 195000, details: "Rate limited by target" },
      { agentId: "agent-epsilon", agentName: "Web Scanner Epsilon", action: "target-hit", timestamp: 210000, details: "Found RCE via upload" }
    ]
  },
  {
    waveIndex: 4,
    timestamp: 240000,
    agentsActive: 5,
    agentsSpawned: ["agent-iota"],
    agentsCompleted: ["agent-delta", "agent-epsilon"],
    agentsErrored: [],
    findings: [
      { id: "f021", title: "Internal Network Access", severity: "critical", category: "Network", description: "Can access internal VPC endpoints" },
      { id: "f022", title: "Database Credentials Exposed", severity: "critical", category: "Secrets", description: "DB credentials in environment variables" },
      { id: "f023", title: "Backup Files Accessible", severity: "high", category: "File Access", description: "SQL backups world-readable" },
      { id: "f024", title: "Unencrypted Data at Rest", severity: "high", category: "Data Protection", description: "S3 buckets not encrypted" },
      { id: "f025", title: "Missing WAF Protection", severity: "medium", category: "Network", description: "No WAF in front of web apps" },
      { id: "f026", title: "DNS Zone Transfer Allowed", severity: "medium", category: "DNS", description: "AXFR request accepted" }
    ],
    targetsHit: 121,
    totalTargets: 156,
    agentEvents: [
      { agentId: "agent-delta", agentName: "Web Probe Delta", action: "completed", timestamp: 245000, details: "Probed 89 endpoints" },
      { agentId: "agent-epsilon", agentName: "Web Scanner Epsilon", action: "completed", timestamp: 248000, details: "Found 12 web vulns" },
      { agentId: "agent-iota", agentName: "Network Mapper Iota", action: "spawned", timestamp: 242000 },
      { agentId: "agent-iota", agentName: "Network Mapper Iota", action: "target-hit", timestamp: 270000, details: "Mapped internal network" }
    ]
  },
  {
    waveIndex: 5,
    timestamp: 300000,
    agentsActive: 3,
    agentsSpawned: [],
    agentsCompleted: ["agent-eta", "agent-theta", "agent-iota"],
    agentsErrored: [],
    findings: [
      { id: "f027", title: "Full Database Dump Possible", severity: "critical", category: "Data Breach", description: "Attacker can exfiltrate entire DB" },
      { id: "f028", title: "Lateral Movement Path", severity: "critical", category: "Post Exploit", description: "Can pivot to management network" },
      { id: "f029", title: "Privilege Container Escape", severity: "critical", category: "Container", description: "Container escape to host possible" },
      { id: "f030", title: "Kubernetes Secrets Exposed", severity: "critical", category: "Kubernetes", description: "Secrets in etcd readable" },
      { id: "f031", title: "AWS IAM Keys Rotated", severity: "high", category: "Cloud Security", description: "Old keys still valid" },
      { id: "f032", title: "S3 Bucket Public Access", severity: "high", category: "Cloud Storage", description: "3 buckets publicly accessible" },
      { id: "f033", title: "CloudTrail Logging Disabled", severity: "high", category: "Cloud Security", description: "Logging disabled on production account" },
      { id: "f034", title: "Unrestricted Egress", severity: "medium", category: "Network", description: "No egress filtering" },
      { id: "f035", title: "Shared IAM", severity: "medium", category: "Cloud Security", description: "Overly permissive role assignments" },
      { id: "f036", title: "Auto-scaling Without Limits", severity: "low", category: "Configuration", description: "No max instance count set" },
      { id: "f037", title: "Console Access Enabled", severity: "medium", category: "Cloud Security", description: "Root account has console access" }
    ],
    targetsHit: 142,
    totalTargets: 156,
    agentEvents: [
      { agentId: "agent-eta", agentName: "Priv Esc Hunter Eta", action: "completed", timestamp: 310000, details: "Found 8 priv esc paths" },
      { agentId: "agent-theta", agentName: "Data Miner Theta", action: "completed", timestamp: 315000, details: "Exfiltrated sample data" },
      { agentId: "agent-iota", agentName: "Network Mapper Iota", action: "completed", timestamp: 320000, details: "Full network map complete" },
      { agentId: "agent-theta", agentName: "Data Miner Theta", action: "target-hit", timestamp: 330000, details: "Full DB dump confirmed" },
      { agentId: "agent-eta", agentName: "Priv Esc Hunter Eta", action: "target-hit", timestamp: 340000, details: "Container escape confirmed" }
    ]
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatTimestamp = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `+${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case "critical": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "high": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "medium": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "low": return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    default: return "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-border)]/30";
  }
};

const getEventIcon = (action: string) => {
  switch (action) {
    case "spawned": return <Bot className="w-3 h-3 text-emerald-400" />;
    case "completed": return <CheckCircle2 className="w-3 h-3 text-blue-400" />;
    case "errored": return <AlertCircle className="w-3 h-3 text-red-400" />;
    case "target-hit": return <Target className="w-3 h-3 text-purple-400" />;
    default: return <Activity className="w-3 h-3 text-[var(--color-text-secondary)]" />;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DiscoveryRunReplayControls() {
  const [currentWave, setCurrentWave] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showActivityLog, setShowActivityLog] = useState<boolean>(true);
  
  const intervalRef = useRef<number | null>(null);
  
  // Current wave data
  const currentWaveData = useMemo(() => WAVES[currentWave], [currentWave]);
  
  // Cumulative findings up to current wave
  const cumulativeFindings = useMemo(() => {
    return WAVES.slice(0, currentWave + 1).reduce(
      (acc, wave) => acc + wave.findings.length, 
      0
    );
  }, [currentWave]);
  
  // Cumulative targets hit
  const cumulativeTargets = useMemo(() => {
    return WAVES.slice(0, currentWave + 1).reduce(
      (acc, wave) => Math.max(acc, wave.targetsHit),
      0
    );
  }, [currentWave]);
  
  // All findings up to current wave
  const allFindings = useMemo(() => {
    return WAVES.slice(0, currentWave + 1).flatMap(wave => wave.findings);
  }, [currentWave]);
  
  // All agent events up to current wave
  const allEvents = useMemo(() => {
    return WAVES.slice(0, currentWave + 1).flatMap(wave => wave.agentEvents);
  }, [currentWave]);
  
  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    return ((currentWave + 1) / WAVES.length) * 100;
  }, [currentWave]);
  
  // Playback controls
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);
  
  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);
  
  const handleStepForward = useCallback(() => {
    setCurrentWave(prev => Math.min(prev + 1, WAVES.length - 1));
  }, []);
  
  const handleStepBack = useCallback(() => {
    setCurrentWave(prev => Math.max(prev - 1, 0));
  }, []);
  
  const handleJumpToStart = useCallback(() => {
    setCurrentWave(0);
    setIsPlaying(false);
  }, []);
  
  const handleJumpToEnd = useCallback(() => {
    setCurrentWave(WAVES.length - 1);
    setIsPlaying(false);
  }, []);
  
  const handleWaveChange = useCallback((wave: number) => {
    setCurrentWave(wave);
  }, []);
  
  // Auto-advance playback
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentWave(prev => {
          if (prev >= WAVES.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000 / playbackSpeed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed]);
  
  // Speed options
  const speedOptions = [
    { value: 0.5, label: "0.5x" },
    { value: 1, label: "1x" },
    { value: 2, label: "2x" },
    { value: 4, label: "4x" }
  ];
  
  return (
    <div className="min-h-screen bg-[var(--color-surface-1)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  Discovery Run Replay
                </h1>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  RUN_METADATA.status === "completed" 
                    ? "bg-emerald-400/20 text-emerald-400"
                    : "bg-red-400/20 text-red-400"
                }`}>
                  {RUN_METADATA.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm">{RUN_METADATA.label}</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Clock className="w-4 h-4" />
                <span>Duration: {formatDuration(RUN_METADATA.endTime.getTime() - RUN_METADATA.startTime.getTime())}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Target className="w-4 h-4" />
                <span>Targets: {RUN_METADATA.targetsHit}/{RUN_METADATA.totalTargets}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Hash className="w-4 h-4" />
                <span>Findings: {RUN_METADATA.totalFindings}</span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
            {WAVES.map((wave, index) => (
              <div
                key={wave.waveIndex}
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--color-surface-3)] rounded-full cursor-pointer hover:bg-white transition-all duration-200 hover:scale-125"
                style={{ left: `${((index + 1) / WAVES.length) * 100}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => handleWaveChange(index)}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">
        
        {/* Left Column - Timeline & Controls */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Playback Controls */}
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Playback Controls
            </h3>
            
            {/* Timeline Slider */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-2">
                <span>Wave {currentWave + 1}</span>
                <span>of {WAVES.length}</span>
              </div>
              <input
                type="range"
                min={0}
                max={WAVES.length - 1}
                value={currentWave}
                onChange={(e) => handleWaveChange(Number(e.target.value))}
                className="w-full h-2 bg-[var(--color-surface-3)] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                {WAVES.map((wave, index) => (
                  <span 
                    key={index}
                    className={`cursor-pointer hover:text-[var(--color-text-primary)] transition-colors ${index <= currentWave ? 'text-[var(--color-text-secondary)]' : ''}`}
                    onClick={() => handleWaveChange(index)}
                  >
                    W{index + 1}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-2 mb-5">
              <button
                onClick={handleJumpToStart}
                className="p-2 rounded-lg bg-[var(--color-surface-3)]/50 hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
                title="Jump to Start"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handleStepBack}
                disabled={currentWave === 0}
                className="p-2 rounded-lg bg-[var(--color-surface-3)]/50 hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Step Back"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={isPlaying ? handlePause : handlePlay}
                className={`p-3 rounded-lg transition-all ${
                  isPlaying 
                    ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400"
                    : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                }`}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={handleStepForward}
                disabled={currentWave === WAVES.length - 1}
                className="p-2 rounded-lg bg-[var(--color-surface-3)]/50 hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Step Forward"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleJumpToEnd}
                className="p-2 rounded-lg bg-[var(--color-surface-3)]/50 hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
                title="Jump to End"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            
            {/* Speed Selector */}
            <div className="flex items-center justify-center gap-1 bg-[var(--color-surface-3)]/30 rounded-lg p-1">
              {speedOptions.map(speed => (
                <button
                  key={speed.value}
                  onClick={() => setPlaybackSpeed(speed.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    playbackSpeed === speed.value
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Wave Summary */}
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Wave {currentWave + 1} Summary
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Agents Active</div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)] transition-all duration-300">
                  {currentWaveData.agentsActive}
                </div>
              </div>
              <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Findings This Wave</div>
                <div className="text-2xl font-semibold text-purple-400 transition-all duration-300">
                  {currentWaveData.findings.length}
                </div>
              </div>
              <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Targets Hit</div>
                <div className="text-2xl font-semibold text-emerald-400 transition-all duration-300">
                  {currentWaveData.targetsHit}
                </div>
              </div>
              <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Timestamp</div>
                <div className="text-2xl font-semibold text-amber-400 transition-all duration-300">
                  {formatTimestamp(currentWaveData.timestamp)}
                </div>
              </div>
            </div>
            
            {/* Agent Status */}
            <div className="mt-4 space-y-2">
              {currentWaveData.agentsSpawned.length > 0 && (
                <div className="flex items-center gap-2">
                  <Bot className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Spawned:</span>
                  <span className="text-xs text-[var(--color-text-primary)]">{currentWaveData.agentsSpawned.join(", ")}</span>
                </div>
              )}
              {currentWaveData.agentsCompleted.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Completed:</span>
                  <span className="text-xs text-[var(--color-text-primary)]">{currentWaveData.agentsCompleted.join(", ")}</span>
                </div>
              )}
              {currentWaveData.agentsErrored.length > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Errored:</span>
                  <span className="text-xs text-[var(--color-text-primary)]">{currentWaveData.agentsErrored.join(", ")}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Cumulative Chart */}
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Cumulative Findings
            </h3>
            
            <div className="flex items-end justify-between gap-1 h-32 mb-2">
              {WAVES.map((wave, index) => {
                const cumulative = WAVES.slice(0, index + 1).reduce((acc, w) => acc + w.findings.length, 0);
                const maxHeight = Math.max(...WAVES.map(w => w.findings.length)) * 1.5;
                const heightPercent = (cumulative / RUN_METADATA.totalFindings) * 100;
                
                return (
                  <div
                    key={index}
                    className={`flex-1 rounded-t transition-all duration-500 ${
                      index <= currentWave
                        ? "bg-gradient-to-t from-blue-600 to-blue-400"
                        : "bg-[var(--color-surface-3)]"
                    }`}
                    style={{ 
                      height: `${Math.max(heightPercent, 4)}%`,
                      minHeight: '4px'
                    }}
                    onClick={() => handleWaveChange(index)}
                  />
                );
              })}
            </div>
            
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-400 transition-all duration-300">
                  {cumulativeFindings}
                </div>
                <div>Total</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-emerald-400 transition-all duration-300">
                  {Math.round((cumulativeFindings / RUN_METADATA.totalFindings) * 100)}%
                </div>
                <div>Complete</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-400 transition-all duration-300">
                  {cumulativeTargets}
                </div>
                <div>Targets</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column - Details */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          {/* Findings Panel */}
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Findings ({allFindings.length} total up to Wave {currentWave + 1})
              </h3>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs bg-red-400/20 text-red-400 rounded">
                  {allFindings.filter(f => f.severity === "critical").length} Critical
                </span>
                <span className="px-2 py-0.5 text-xs bg-orange-400/20 text-orange-400 rounded">
                  {allFindings.filter(f => f.severity === "high").length} High
                </span>
                <span className="px-2 py-0.5 text-xs bg-yellow-400/20 text-yellow-400 rounded">
                  {allFindings.filter(f => f.severity === "medium").length} Medium
                </span>
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {allFindings.map((finding, index) => (
                <div
                  key={finding.id}
                  className={`p-3 rounded-lg border ${getSeverityColor(finding.severity)} transition-all duration-300`}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animation: 'fadeIn 0.3s ease-out forwards'
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium text-sm">{finding.title}</span>
                    </div>
                    <span className="text-xs uppercase font-medium px-2 py-0.5 rounded bg-opacity-20">
                      {finding.severity}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] ml-6">{finding.description}</p>
                  <div className="flex items-center gap-3 mt-2 ml-6">
                    <span className="text-xs text-[var(--color-text-muted)]">{finding.category}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">•</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{finding.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Agent Activity Log */}
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agent Activity Log
              </h3>
              <button
                onClick={() => setShowActivityLog(!showActivityLog)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {showActivityLog ? "Hide" : "Show"}
              </button>
            </div>
            
            {showActivityLog && (
              <div className="space-y-1 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {allEvents.length === 0 ? (
                  <div className="text-center text-[var(--color-text-muted)] py-8">
                    No agent activity yet
                  </div>
                ) : (
                  allEvents.map((event, index) => (
                    <div
                      key={`${event.agentId}-${event.timestamp}-${index}`}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-3)]/30 transition-colors"
                    >
                      <div className="mt-0.5">
                        {getEventIcon(event.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {event.agentName}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            event.action === "spawned" ? "bg-emerald-400/20 text-emerald-400" :
                            event.action === "completed" ? "bg-blue-400/20 text-blue-400" :
                            event.action === "errored" ? "bg-red-400/20 text-red-400" :
                            "bg-purple-400/20 text-purple-400"
                          }`}>
                            {event.action}
                          </span>
                        </div>
                        {event.details && (
                          <p className="text-xs text-[var(--color-text-secondary)] truncate">{event.details}</p>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Wave Detail Panel */}
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Wave {currentWave + 1} Detailed View
            </h3>
            
            {/* Progress Ring Visualization */}
            <div className="flex items-center gap-6 mb-6">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-[var(--color-text-muted)]"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-emerald-400 transition-all duration-500"
                    strokeDasharray={`${(currentWaveData.targetsHit / currentWaveData.totalTargets) * 251.2} 251.2`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {Math.round((currentWaveData.targetsHit / currentWaveData.totalTargets) * 100)}%
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">Targets</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">Wave Progress</span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {currentWaveData.targetsHit} / {currentWaveData.totalTargets} targets
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${(currentWaveData.targetsHit / currentWaveData.totalTargets) * 100}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-emerald-400">{currentWaveData.agentsActive}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Active</div>
                  </div>
                  <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-blue-400">{currentWaveData.agentsCompleted.length}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Completed</div>
                  </div>
                  <div className="bg-[var(--color-surface-3)]/30 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-red-400">{currentWaveData.agentsErrored.length}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Errored</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Finding Severity Breakdown */}
            <div className="grid grid-cols-5 gap-2">
              {["critical", "high", "medium", "low", "info"].map(severity => {
                const count = currentWaveData.findings.filter(f => f.severity === severity).length;
                const colors: Record<string, string> = {
                  critical: "bg-red-400/20 text-red-400 border-red-400/30",
                  high: "bg-orange-400/20 text-orange-400 border-orange-400/30",
                  medium: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30",
                  low: "bg-blue-400/20 text-blue-400 border-blue-400/30",
                  info: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border-[var(--color-border)]/30"
                };
                
                return (
                  <div 
                    key={severity}
                    className={`p-2 rounded-lg border text-center ${colors[severity]}`}
                  >
                    <div className="text-lg font-semibold">{count}</div>
                    <div className="text-xs uppercase">{severity}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #6b7280;
        }
      `}</style>
    </div>
  );
}
