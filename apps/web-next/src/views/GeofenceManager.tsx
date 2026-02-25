import React, { useState } from "react";
import { cn } from "../lib/utils";
import { useToast } from "../components/Toast";

// Types
interface Geofence {
  id: string;
  name: string;
  shape: "circle" | "polygon";
  centerLat: number;
  centerLng: number;
  radius?: number;
  area?: number;
  isActive: boolean;
  triggeredCount: number;
  polygonCoords?: { lat: number; lng: number }[];
}

interface GeofenceRule {
  id: string;
  name: string;
  trigger: "enter" | "exit" | "dwell";
  geofenceName: string;
  geofenceId: string;
  action: "send_notification" | "block_access" | "log_event" | "webhook";
  conditions: string[];
  isEnabled: boolean;
}

interface GeofenceEvent {
  id: string;
  timestamp: Date;
  userId: string;
  deviceId: string;
  geofenceName: string;
  geofenceId: string;
  eventType: "enter" | "exit" | "dwell";
  duration?: number;
  lat: number;
  lng: number;
  actionTaken: string;
}

// Sample Data
const sampleGeofences: Geofence[] = [
  {
    id: "geo-001",
    name: "Main Office Building",
    shape: "circle",
    centerLat: 40.7128,
    centerLng: -74.006,
    radius: 150,
    isActive: true,
    triggeredCount: 1247,
  },
  {
    id: "geo-002",
    name: "Warehouse Zone A",
    shape: "polygon",
    centerLat: 40.7589,
    centerLng: -73.9851,
    area: 25000,
    polygonCoords: [
      { lat: 40.76, lng: -73.99 },
      { lat: 40.76, lng: -73.98 },
      { lat: 40.758, lng: -73.98 },
      { lat: 40.758, lng: -73.99 },
    ],
    isActive: true,
    triggeredCount: 892,
  },
  {
    id: "geo-003",
    name: "Parking Lot North",
    shape: "circle",
    centerLat: 40.7614,
    centerLng: -73.9776,
    radius: 80,
    isActive: true,
    triggeredCount: 3421,
  },
  {
    id: "geo-004",
    name: "Restricted Area",
    shape: "circle",
    centerLat: 40.7489,
    centerLng: -73.968,
    radius: 50,
    isActive: false,
    triggeredCount: 156,
  },
  {
    id: "geo-005",
    name: "Campus Perimeter",
    shape: "polygon",
    centerLat: 40.75,
    centerLng: -73.975,
    area: 150000,
    polygonCoords: [
      { lat: 40.755, lng: -73.98 },
      { lat: 40.755, lng: -73.97 },
      { lat: 40.745, lng: -73.97 },
      { lat: 40.745, lng: -73.98 },
    ],
    isActive: true,
    triggeredCount: 5678,
  },
  {
    id: "geo-006",
    name: "Loading Dock",
    shape: "circle",
    centerLat: 40.7549,
    centerLng: -73.984,
    radius: 30,
    isActive: true,
    triggeredCount: 789,
  },
  {
    id: "geo-007",
    name: "Server Room",
    shape: "circle",
    centerLat: 40.7527,
    centerLng: -73.9772,
    radius: 15,
    isActive: true,
    triggeredCount: 45,
  },
];

const sampleRules: GeofenceRule[] = [
  {
    id: "rule-001",
    name: "Office Entry Alert",
    trigger: "enter",
    geofenceName: "Main Office Building",
    geofenceId: "geo-001",
    action: "send_notification",
    conditions: ["time between 08:00-18:00", "user is employee"],
    isEnabled: true,
  },
  {
    id: "rule-002",
    name: "After Hours Notification",
    trigger: "enter",
    geofenceName: "Main Office Building",
    geofenceId: "geo-001",
    action: "send_notification",
    conditions: ["time outside 08:00-18:00"],
    isEnabled: true,
  },
  {
    id: "rule-003",
    name: "Warehouse Exit Log",
    trigger: "exit",
    geofenceName: "Warehouse Zone A",
    geofenceId: "geo-002",
    action: "log_event",
    conditions: ["always"],
    isEnabled: true,
  },
  {
    id: "rule-004",
    name: "Restricted Block",
    trigger: "enter",
    geofenceName: "Restricted Area",
    geofenceId: "geo-004",
    action: "block_access",
    conditions: ["user role is not admin"],
    isEnabled: false,
  },
  {
    id: "rule-005",
    name: "Perimeter Webhook",
    trigger: "enter",
    geofenceName: "Campus Perimeter",
    geofenceId: "geo-005",
    action: "webhook",
    conditions: ["always"],
    isEnabled: true,
  },
  {
    id: "rule-006",
    name: "Dwell Time Alert",
    trigger: "dwell",
    geofenceName: "Loading Dock",
    geofenceId: "geo-006",
    action: "send_notification",
    conditions: ["dwell time > 30 minutes"],
    isEnabled: true,
  },
  {
    id: "rule-007",
    name: "Parking Occupancy",
    trigger: "dwell",
    geofenceName: "Parking Lot North",
    geofenceId: "geo-003",
    action: "log_event",
    conditions: ["dwell time > 60 minutes"],
    isEnabled: true,
  },
];

const sampleEvents: GeofenceEvent[] = [
  {
    id: "evt-001",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    userId: "user-123",
    deviceId: "dev-abc",
    geofenceName: "Main Office Building",
    geofenceId: "geo-001",
    eventType: "enter",
    lat: 40.7129,
    lng: -74.0061,
    actionTaken: "Notification sent",
  },
  {
    id: "evt-002",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    userId: "user-456",
    deviceId: "dev-def",
    geofenceName: "Warehouse Zone A",
    geofenceId: "geo-002",
    eventType: "exit",
    lat: 40.7588,
    lng: -73.9852,
    actionTaken: "Event logged",
  },
  {
    id: "evt-003",
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    userId: "user-789",
    deviceId: "dev-ghi",
    geofenceName: "Parking Lot North",
    geofenceId: "geo-003",
    eventType: "dwell",
    duration: 45,
    lat: 40.7615,
    lng: -73.9777,
    actionTaken: "Event logged",
  },
  {
    id: "evt-004",
    timestamp: new Date(Date.now() - 1000 * 60 * 18),
    userId: "user-234",
    deviceId: "dev-jkl",
    geofenceName: "Campus Perimeter",
    geofenceId: "geo-005",
    eventType: "enter",
    lat: 40.749,
    lng: -73.975,
    actionTaken: "Webhook triggered",
  },
  {
    id: "evt-005",
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
    userId: "user-567",
    deviceId: "dev-mno",
    geofenceName: "Main Office Building",
    geofenceId: "geo-001",
    eventType: "exit",
    lat: 40.7127,
    lng: -74.0059,
    actionTaken: "Notification sent",
  },
  {
    id: "evt-006",
    timestamp: new Date(Date.now() - 1000 * 60 * 32),
    userId: "user-890",
    deviceId: "dev-pqr",
    geofenceName: "Loading Dock",
    geofenceId: "geo-006",
    eventType: "dwell",
    duration: 32,
    lat: 40.755,
    lng: -73.9841,
    actionTaken: "Notification sent",
  },
  {
    id: "evt-007",
    timestamp: new Date(Date.now() - 1000 * 60 * 41),
    userId: "user-321",
    deviceId: "dev-stu",
    geofenceName: "Warehouse Zone A",
    geofenceId: "geo-002",
    eventType: "enter",
    lat: 40.759,
    lng: -73.985,
    actionTaken: "Event logged",
  },
  {
    id: "evt-008",
    timestamp: new Date(Date.now() - 1000 * 60 * 55),
    userId: "user-654",
    deviceId: "dev-vwx",
    geofenceName: "Server Room",
    geofenceId: "geo-007",
    eventType: "enter",
    lat: 40.7528,
    lng: -73.9773,
    actionTaken: "Notification sent",
  },
  {
    id: "evt-009",
    timestamp: new Date(Date.now() - 1000 * 60 * 67),
    userId: "user-987",
    deviceId: "dev-yza",
    geofenceName: "Parking Lot North",
    geofenceId: "geo-003",
    eventType: "exit",
    lat: 40.7613,
    lng: -73.9775,
    actionTaken: "Event logged",
  },
  {
    id: "evt-010",
    timestamp: new Date(Date.now() - 1000 * 60 * 78),
    userId: "user-135",
    deviceId: "dev-bcd",
    geofenceName: "Campus Perimeter",
    geofenceId: "geo-005",
    eventType: "exit",
    lat: 40.7491,
    lng: -73.9751,
    actionTaken: "Webhook triggered",
  },
  {
    id: "evt-011",
    timestamp: new Date(Date.now() - 1000 * 60 * 92),
    userId: "user-246",
    deviceId: "dev-efg",
    geofenceName: "Main Office Building",
    geofenceId: "geo-001",
    eventType: "dwell",
    duration: 120,
    lat: 40.7128,
    lng: -74.006,
    actionTaken: "Event logged",
  },
  {
    id: "evt-012",
    timestamp: new Date(Date.now() - 1000 * 60 * 105),
    userId: "user-357",
    deviceId: "dev-hij",
    geofenceName: "Loading Dock",
    geofenceId: "geo-006",
    eventType: "exit",
    lat: 40.7548,
    lng: -73.9839,
    actionTaken: "Notification sent",
  },
  {
    id: "evt-013",
    timestamp: new Date(Date.now() - 1000 * 60 * 118),
    userId: "user-468",
    deviceId: "dev-klm",
    geofenceName: "Warehouse Zone A",
    geofenceId: "geo-002",
    eventType: "dwell",
    duration: 15,
    lat: 40.7589,
    lng: -73.9851,
    actionTaken: "Event logged",
  },
  {
    id: "evt-014",
    timestamp: new Date(Date.now() - 1000 * 60 * 130),
    userId: "user-579",
    deviceId: "dev-nop",
    geofenceName: "Server Room",
    geofenceId: "geo-007",
    eventType: "exit",
    lat: 40.7526,
    lng: -73.9771,
    actionTaken: "Event logged",
  },
  {
    id: "evt-015",
    timestamp: new Date(Date.now() - 1000 * 60 * 145),
    userId: "user-680",
    deviceId: "dev-qrs",
    geofenceName: "Campus Perimeter",
    geofenceId: "geo-005",
    eventType: "dwell",
    duration: 5,
    lat: 40.75,
    lng: -73.975,
    actionTaken: "Webhook triggered",
  },
  {
    id: "evt-016",
    timestamp: new Date(Date.now() - 1000 * 60 * 158),
    userId: "user-791",
    deviceId: "dev-tuv",
    geofenceName: "Main Office Building",
    geofenceId: "geo-001",
    eventType: "enter",
    lat: 40.713,
    lng: -74.0062,
    actionTaken: "Notification sent",
  },
];

// Settings type
interface Settings {
  locationAccuracy: "high" | "balanced" | "low";
  eventRetentionDays: number;
  webhookEndpoint: string;
  batchProcessingEnabled: boolean;
  batchSize: number;
  batchInterval: number;
}

const defaultSettings: Settings = {
  locationAccuracy: "high",
  eventRetentionDays: 30,
  webhookEndpoint: "https://api.example.com/geofence/events",
  batchProcessingEnabled: true,
  batchSize: 100,
  batchInterval: 60,
};

// Tab Types
type TabType = "geofences" | "rules" | "events" | "settings";

// Utility Functions
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) {return "Just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {return `${diffHours}h ago`;}
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {return `${diffDays}d ago`;}
  
  return date.toLocaleDateString();
};

const getEventTypeColor = (eventType: "enter" | "exit" | "dwell"): string => {
  switch (eventType) {
    case "enter":
      return "text-emerald-400";
    case "exit":
      return "text-amber-400";
    case "dwell":
      return "text-primary";
    default:
      return "text-[var(--color-text-primary)]";
  }
};

const getEventTypeEmoji = (eventType: "enter" | "exit" | "dwell"): string => {
  switch (eventType) {
    case "enter":
      return "↗️";
    case "exit":
      return "↙️";
    case "dwell":
      return "⏱️";
    default:
      return "•";
  }
};

// Div-based Map Component
interface DivMapProps {
  geofence: Geofence;
}

const DivMap: React.FC<DivMapProps> = ({ geofence }) => {
  const isPolygon = geofence.shape === "polygon";
  
  return (
    <div className="relative w-full h-48 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)] overflow-hidden">
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />
      
      {/* Geofence shape */}
      {isPolygon && geofence.polygonCoords ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="absolute border-2 border-primary bg-primary/20"
            style={{
              width: "60%",
              height: "60%",
              borderRadius: "4px",
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-xs text-primary">{geofence.name}</span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="rounded-full border-2 border-primary bg-primary/20"
            style={{
              width: geofence.radius ? `${Math.min(geofence.radius / 2, 80)}px` : "60px",
              height: geofence.radius ? `${Math.min(geofence.radius / 2, 80)}px` : "60px",
            }}
          />
          <div className="absolute">
            <span className="text-xs text-primary">{geofence.name}</span>
          </div>
        </div>
      )}
      
      {/* Center marker */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
      </div>
    </div>
  );
};

// Geofences Tab Component
interface GeofencesTabProps {
  geofences: Geofence[];
}

const GeofencesTab: React.FC<GeofencesTabProps> = ({ geofences }) => {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGeofence, setNewGeofence] = useState<Partial<Geofence>>({
    name: "",
    shape: "circle",
    centerLat: 0,
    centerLng: 0,
    radius: 100,
    isActive: true,
    triggeredCount: 0,
  });

  const handleCreate = () => {
    if (newGeofence.name) {
      toast({ message: `Created geofence: ${newGeofence.name}`, type: "success" });
      setShowCreateForm(false);
      setNewGeofence({
        name: "",
        shape: "circle",
        centerLat: 0,
        centerLng: 0,
        radius: 100,
        isActive: true,
        triggeredCount: 0,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Geofences</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary hover:bg-primary text-[var(--color-text-primary)] rounded-lg transition-colors duration-150"
        >
          {showCreateForm ? "Cancel" : "+ Create New"}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Create New Geofence</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Name</label>
              <input
                type="text"
                value={newGeofence.name}
                onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                placeholder="Geofence name"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Shape</label>
              <select
                value={newGeofence.shape}
                onChange={(e) => setNewGeofence({ ...newGeofence, shape: e.target.value as "circle" | "polygon" })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="circle">Circle</option>
                <option value="polygon">Polygon</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Center Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={newGeofence.centerLat}
                onChange={(e) => setNewGeofence({ ...newGeofence, centerLat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Center Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={newGeofence.centerLng}
                onChange={(e) => setNewGeofence({ ...newGeofence, centerLng: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
              />
            </div>
            {newGeofence.shape === "circle" && (
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Radius (meters)</label>
                <input
                  type="number"
                  value={newGeofence.radius}
                  onChange={(e) => setNewGeofence({ ...newGeofence, radius: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                />
              </div>
            )}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={newGeofence.isActive}
                onChange={(e) => setNewGeofence({ ...newGeofence, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--color-surface-3)] bg-[var(--color-surface-2)] text-primary focus:ring-indigo-500"
              />
              <label htmlFor="active" className="ml-2 text-sm text-[var(--color-text-primary)]">Active</label>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="w-full px-4 py-2 bg-primary hover:bg-primary text-[var(--color-text-primary)] rounded-lg transition-colors duration-150"
          >
            Create Geofence
          </button>
        </div>
      )}

      <div className="space-y-2">
        {geofences.map((geofence) => (
          <div
            key={geofence.id}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden"
          >
            <div
              onClick={() => setExpandedId(expandedId === geofence.id ? null : geofence.id)}
              className="p-4 cursor-pointer hover:bg-[var(--color-surface-2)]/50 transition-colors duration-150"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={cn("text-lg", geofence.isActive ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
                    {geofence.isActive ? "🟢" : "🔴"}
                  </span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">{geofence.name}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {geofence.shape === "circle" 
                        ? `Circle • ${geofence.radius}m radius`
                        : `Polygon • ${geofence.area?.toLocaleString()} m²`
                      }
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {geofence.centerLat.toFixed(4)}, {geofence.centerLng.toFixed(4)}
                  </p>
                  <p className="text-sm text-primary">
                    {geofence.triggeredCount.toLocaleString()} triggers
                  </p>
                </div>
              </div>
            </div>
            
            {expandedId === geofence.id && (
              <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30">
                <DivMap geofence={geofence} />
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Center:</span>
                    <p className="text-[var(--color-text-primary)]">{geofence.centerLat.toFixed(6)}, {geofence.centerLng.toFixed(6)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Shape:</span>
                    <p className="text-[var(--color-text-primary)] capitalize">{geofence.shape}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Status:</span>
                    <p className={geofence.isActive ? "text-emerald-400" : "text-[var(--color-text-muted)]"}>
                      {geofence.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Rules Tab Component
interface RulesTabProps {
  rules: GeofenceRule[];
  geofences: Geofence[];
}

const RulesTab: React.FC<RulesTabProps> = ({ rules, geofences }) => {
  const { toast } = useToast();
  const [showBuilder, setShowBuilder] = useState(false);
  const [newRule, setNewRule] = useState<Partial<GeofenceRule>>({
    name: "",
    trigger: "enter",
    geofenceId: "",
    geofenceName: "",
    action: "send_notification",
    conditions: [],
    isEnabled: true,
  });
  const [conditionInput, setConditionInput] = useState("");

  const handleGeofenceChange = (geofenceId: string) => {
    const geofence = geofences.find(g => g.id === geofenceId);
    setNewRule({
      ...newRule,
      geofenceId,
      geofenceName: geofence?.name || "",
    });
  };

  const addCondition = () => {
    if (conditionInput.trim()) {
      setNewRule({
        ...newRule,
        conditions: [...(newRule.conditions || []), conditionInput.trim()],
      });
      setConditionInput("");
    }
  };

  const removeCondition = (index: number) => {
    const conditions = [...(newRule.conditions || [])];
    conditions.splice(index, 1);
    setNewRule({ ...newRule, conditions });
  };

  const handleCreate = () => {
    if (newRule.name && newRule.geofenceId) {
      toast({ message: `Created rule: ${newRule.name}`, type: "success" });
      setShowBuilder(false);
      setNewRule({
        name: "",
        trigger: "enter",
        geofenceId: "",
        geofenceName: "",
        action: "send_notification",
        conditions: [],
        isEnabled: true,
      });
    }
  };

  const toggleRule = (ruleId: string) => {
    toast({ message: `Toggled rule: ${ruleId}`, type: "info" });
  };

  const getTriggerColor = (trigger: string): string => {
    switch (trigger) {
      case "enter":
        return "text-emerald-400 bg-emerald-400/10";
      case "exit":
        return "text-amber-400 bg-amber-400/10";
      case "dwell":
        return "text-primary bg-primary/10";
      default:
        return "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10";
    }
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case "send_notification":
        return "Send Notification";
      case "block_access":
        return "Block Access";
      case "log_event":
        return "Log Event";
      case "webhook":
        return "Webhook";
      default:
        return action;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Geofence Rules</h2>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="px-4 py-2 bg-primary hover:bg-primary text-[var(--color-text-primary)] rounded-lg transition-colors duration-150"
        >
          {showBuilder ? "Cancel" : "+ Rule Builder"}
        </button>
      </div>

      {showBuilder && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Create New Rule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Rule Name</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                placeholder="Enter rule name"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Trigger</label>
              <select
                value={newRule.trigger}
                onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value as "enter" | "exit" | "dwell" })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="enter">Enter</option>
                <option value="exit">Exit</option>
                <option value="dwell">Dwell</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Geofence</label>
              <select
                value={newRule.geofenceId}
                onChange={(e) => handleGeofenceChange(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="">Select geofence</option>
                {geofences.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Action</label>
              <select
                value={newRule.action}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value as GeofenceRule["action"] })}
                className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="send_notification">Send Notification</option>
                <option value="block_access">Block Access</option>
                <option value="log_event">Log Event</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Conditions</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addCondition()}
                className="flex-1 px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                placeholder="Add condition (press Enter)"
              />
              <button
                onClick={addCondition}
                className="px-4 py-2 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] rounded-lg transition-colors duration-150"
              >
                Add
              </button>
            </div>
            {newRule.conditions && newRule.conditions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {newRule.conditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded text-sm"
                  >
                    {cond}
                    <button
                      onClick={() => removeCondition(idx)}
                      className="ml-2 text-[var(--color-text-muted)] hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="ruleEnabled"
              checked={newRule.isEnabled}
              onChange={(e) => setNewRule({ ...newRule, isEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--color-surface-3)] bg-[var(--color-surface-2)] text-primary focus:ring-indigo-500"
            />
            <label htmlFor="ruleEnabled" className="ml-2 text-sm text-[var(--color-text-primary)]">Enable rule</label>
          </div>

          <button
            onClick={handleCreate}
            className="w-full px-4 py-2 bg-primary hover:bg-primary text-[var(--color-text-primary)] rounded-lg transition-colors duration-150"
          >
            Create Rule
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className={cn("px-2 py-1 rounded text-xs font-medium", getTriggerColor(rule.trigger))}>
                  {rule.trigger.toUpperCase()}
                </span>
                <div>
                  <h3 className="font-medium text-[var(--color-text-primary)]">{rule.name}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {rule.geofenceName} • {getActionLabel(rule.action)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors duration-150",
                    rule.isEnabled ? "bg-emerald-500" : "bg-[var(--color-surface-3)]"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-150",
                      rule.isEnabled ? "translate-x-7" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
            {rule.conditions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {rule.conditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded text-xs"
                  >
                    {cond}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Events Tab Component
interface EventsTabProps {
  events: GeofenceEvent[];
  geofences: Geofence[];
}

const EventsTab: React.FC<EventsTabProps> = ({ events, geofences }) => {
  const [geofenceFilter, setGeofenceFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const filteredEvents = events.filter((event) => {
    if (geofenceFilter !== "all" && event.geofenceId !== geofenceFilter) {return false;}
    if (eventTypeFilter !== "all" && event.eventType !== eventTypeFilter) {return false;}
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Geofence Events</h2>
        <span className="text-sm text-[var(--color-text-secondary)]">{filteredEvents.length} events</span>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Filter by Geofence</label>
          <select
            value={geofenceFilter}
            onChange={(e) => setGeofenceFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
          >
            <option value="all">All Geofences</option>
            {geofences.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Filter by Event Type</label>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
          >
            <option value="all">All Events</option>
            <option value="enter">Enter</option>
            <option value="exit">Exit</option>
            <option value="dwell">Dwell</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <span className="text-lg">{getEventTypeEmoji(event.eventType)}</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={cn("font-medium", getEventTypeColor(event.eventType))}>
                      {event.eventType.toUpperCase()}
                    </span>
                    <span className="text-[var(--color-text-muted)]">•</span>
                    <span className="text-[var(--color-text-primary)]">{event.geofenceName}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    User: {event.userId} • Device: {event.deviceId}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {event.lat.toFixed(6)}, {event.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--color-text-secondary)]">{formatTimestamp(event.timestamp)}</p>
                {event.duration && (
                  <p className="text-xs text-primary mt-1">{event.duration} min dwell</p>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)]">
                Action: <span className="text-[var(--color-text-primary)]">{event.actionTaken}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          No events match your filters
        </div>
      )}
    </div>
  );
};

// Settings Tab Component
interface SettingsTabProps {
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdate }) => {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  const handleSave = () => {
    onUpdate(localSettings);
    toast({ message: "Settings saved successfully.", type: "success" });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Settings</h2>

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Location Settings</h3>
        
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Location Accuracy</label>
          <select
            value={localSettings.locationAccuracy}
            onChange={(e) => setLocalSettings({ ...localSettings, locationAccuracy: e.target.value as Settings["locationAccuracy"] })}
            className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
          >
            <option value="high">High (GPS)</option>
            <option value="balanced">Balanced (Wi-Fi + Cell)</option>
            <option value="low">Low (Cell only)</option>
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Higher accuracy uses more battery but provides better geofence precision
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Data Retention</h3>
        
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Event Retention Period</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="365"
              value={localSettings.eventRetentionDays}
              onChange={(e) => setLocalSettings({ ...localSettings, eventRetentionDays: parseInt(e.target.value) || 30 })}
              className="w-24 px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
            />
            <span className="text-[var(--color-text-secondary)]">days</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Events older than this will be automatically deleted
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Webhook Configuration</h3>
        
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Webhook Endpoint</label>
          <input
            type="url"
            value={localSettings.webhookEndpoint}
            onChange={(e) => setLocalSettings({ ...localSettings, webhookEndpoint: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
            placeholder="https://api.example.com/webhook"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Events will be forwarded to this endpoint as JSON
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Batch Processing</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-primary)]">Enable Batch Processing</p>
              <p className="text-xs text-[var(--color-text-muted)]">Process events in batches for better performance</p>
            </div>
            <button
              onClick={() => setLocalSettings({ ...localSettings, batchProcessingEnabled: !localSettings.batchProcessingEnabled })}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors duration-150",
                localSettings.batchProcessingEnabled ? "bg-emerald-500" : "bg-[var(--color-surface-3)]"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-150",
                  localSettings.batchProcessingEnabled ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {localSettings.batchProcessingEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border)]">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Batch Size</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={localSettings.batchSize}
                  onChange={(e) => setLocalSettings({ ...localSettings, batchSize: parseInt(e.target.value) || 100 })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Batch Interval (seconds)</label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={localSettings.batchInterval}
                  onChange={(e) => setLocalSettings({ ...localSettings, batchInterval: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full px-4 py-3 bg-primary hover:bg-primary text-[var(--color-text-primary)] rounded-lg transition-colors duration-150 font-medium"
      >
        Save Settings
      </button>
    </div>
  );
};

// Main Component
const GeofenceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("geofences");
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const tabs: { id: TabType; label: string }[] = [
    { id: "geofences", label: "Geofences" },
    { id: "rules", label: "Rules" },
    { id: "events", label: "Events" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Geofence Manager</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Manage location-based triggers and rules</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-[var(--color-border)]">
          <nav className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "text-primary border-primary"
                    : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6">
          {activeTab === "geofences" && <GeofencesTab geofences={sampleGeofences} />}
          {activeTab === "rules" && <RulesTab rules={sampleRules} geofences={sampleGeofences} />}
          {activeTab === "events" && <EventsTab events={sampleEvents} geofences={sampleGeofences} />}
          {activeTab === "settings" && <SettingsTab settings={settings} onUpdate={setSettings} />}
        </div>
      </div>
    </div>
  );
};

export default GeofenceManager;
