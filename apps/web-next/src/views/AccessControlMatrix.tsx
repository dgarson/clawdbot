import React, { useState } from "react"
import { cn } from "../lib/utils"

type AccessLevel = "granted" | "denied" | "conditional"

interface Permission {
  level: AccessLevel
  condition?: string
}

interface RoleInfo {
  name: string
  description: string
  memberCount: number
  inheritsFrom: string | null
}

interface ChangedCell {
  roleIndex: number
  colIndex: number
  from: AccessLevel
  to: AccessLevel
}

type ResourceFilter = "all" | string
type AccessFilter = "all" | AccessLevel

const ROLES: RoleInfo[] = [
  { name: "Admin", description: "Full system access. Can manage all resources, users, and configuration.", memberCount: 3, inheritsFrom: null },
  { name: "Principal", description: "Senior operator with broad access. Can manage most resources except billing and system config.", memberCount: 8, inheritsFrom: "Admin" },
  { name: "Lead", description: "Team lead with elevated permissions. Can manage agents, sessions, and files within their scope.", memberCount: 14, inheritsFrom: "Principal" },
  { name: "Worker", description: "Standard operator. Can read and execute agents, manage own sessions and files.", memberCount: 42, inheritsFrom: "Lead" },
  { name: "Viewer", description: "Read-only access to most resources. Cannot modify or execute.", memberCount: 67, inheritsFrom: null },
  { name: "External", description: "External collaborator with minimal access. Restricted to specific shared resources.", memberCount: 23, inheritsFrom: null },
]

const RESOURCES = ["Agents", "Sessions", "Files", "Config", "Billing", "Logs", "API", "Models"] as const
const ACTIONS = ["Read", "Write", "Delete", "Execute", "Admin"] as const

type ResourceName = (typeof RESOURCES)[number]
type ActionName = (typeof ACTIONS)[number]

const COLUMNS: Array<{ resource: ResourceName; action: ActionName }> = RESOURCES.flatMap(
  (resource) => ACTIONS.map((action) => ({ resource, action }))
)

function buildInitialPermissions(): Permission[][] {
  const g: Permission = { level: "granted" }
  const d: Permission = { level: "denied" }
  const c = (condition: string): Permission => ({ level: "conditional", condition })

  const matrix: Permission[][] = [
    // Admin — full access
    COLUMNS.map(() => ({ ...g })),
    // Principal — most access, conditional on billing/config admin
    COLUMNS.map(({ resource, action }) => {
      if (resource === "Billing" && action === "Admin") return { ...d }
      if (resource === "Config" && action === "Admin") return { ...d }
      if (resource === "Config" && action === "Delete") return { ...d }
      if (resource === "Billing" && action === "Delete") return c("Requires Admin approval for billing deletions")
      if (resource === "Models" && action === "Admin") return c("Can admin models within assigned projects only")
      return { ...g }
    }),
    // Lead — elevated but scoped
    COLUMNS.map(({ resource, action }) => {
      if (action === "Admin" && !["Agents", "Sessions"].includes(resource)) return { ...d }
      if (resource === "Billing") return { ...d }
      if (resource === "Config" && action !== "Read") return { ...d }
      if (resource === "Models" && action === "Delete") return c("Can delete models only in own team scope")
      if (action === "Delete" && resource === "Logs") return { ...d }
      return { ...g }
    }),
    // Worker — standard
    COLUMNS.map(({ resource, action }) => {
      if (action === "Admin") return { ...d }
      if (resource === "Billing") return { ...d }
      if (resource === "Config") return action === "Read" ? c("Read config for assigned projects only") : { ...d }
      if (action === "Delete" && !["Files"].includes(resource)) return { ...d }
      if (action === "Delete" && resource === "Files") return c("Can delete own files only")
      if (resource === "Agents" && action === "Write") return c("Can modify agents assigned to them")
      if (action === "Execute") return ["Agents", "API"].includes(resource) ? { ...g } : { ...d }
      return { ...g }
    }),
    // Viewer — read-only
    COLUMNS.map(({ resource, action }) => {
      if (action === "Read") {
        if (resource === "Billing") return { ...d }
        if (resource === "Config") return { ...d }
        return { ...g }
      }
      return { ...d }
    }),
    // External — minimal
    COLUMNS.map(({ resource, action }) => {
      if (action === "Read" && ["Agents", "Files", "API"].includes(resource)) return c("Only shared resources visible")
      if (action === "Execute" && resource === "API") return c("Rate-limited to 100 req/min")
      return { ...d }
    }),
  ]
  return matrix
}

function deepClonePermissions(matrix: Permission[][]): Permission[][] {
  return matrix.map((row) => row.map((cell) => ({ ...cell })))
}

const LEVEL_CYCLE: AccessLevel[] = ["granted", "denied", "conditional"]

export default function AccessControlMatrix() {
  const [permissions, setPermissions] = useState<Permission[][]>(buildInitialPermissions)
  const [savedPermissions, setSavedPermissions] = useState<Permission[][]>(buildInitialPermissions)
  const [expandedRole, setExpandedRole] = useState<number | null>(null)
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all")
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all")
  const [showDiff, setShowDiff] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const filteredColIndices = COLUMNS.reduce<number[]>((acc, col, i) => {
    if (resourceFilter !== "all" && col.resource !== resourceFilter) return acc
    acc.push(i)
    return acc
  }, [])

  const hasChanges = permissions.some((row, ri) =>
    row.some((cell, ci) => cell.level !== savedPermissions[ri][ci].level)
  )

  const changedCells: ChangedCell[] = []
  permissions.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell.level !== savedPermissions[ri][ci].level) {
        changedCells.push({ roleIndex: ri, colIndex: ci, from: savedPermissions[ri][ci].level, to: cell.level })
      }
    })
  })

  function toggleCell(roleIndex: number, colIndex: number) {
    setPermissions((prev) => {
      const next = deepClonePermissions(prev)
      const current = next[roleIndex][colIndex]
      const idx = LEVEL_CYCLE.indexOf(current.level)
      const nextLevel = LEVEL_CYCLE[(idx + 1) % LEVEL_CYCLE.length]
      next[roleIndex][colIndex] = {
        level: nextLevel,
        condition: nextLevel === "conditional" ? "Custom conditional access" : undefined,
      }
      return next
    })
  }

  function handleSave() {
    setSavedPermissions(deepClonePermissions(permissions))
    setShowDiff(false)
  }

  function handleDiscard() {
    setPermissions(deepClonePermissions(savedPermissions))
    setShowDiff(false)
  }

  function matchesAccessFilter(level: AccessLevel): boolean {
    if (accessFilter === "all") return true
    return level === accessFilter
  }

  function roleHasVisibleCells(roleIndex: number): boolean {
    return filteredColIndices.some((ci) => matchesAccessFilter(permissions[roleIndex][ci].level))
  }

  const visibleRoleIndices = ROLES.map((_, i) => i).filter((i) => roleHasVisibleCells(i))

  // Group columns by resource for headers
  const resourceGroups: Array<{ resource: ResourceName; cols: number[] }> = []
  let lastRes: string | null = null
  for (const ci of filteredColIndices) {
    const res = COLUMNS[ci].resource
    if (res !== lastRes) {
      resourceGroups.push({ resource: res, cols: [ci] })
      lastRes = res
    } else {
      resourceGroups[resourceGroups.length - 1].cols.push(ci)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Access Control Matrix</h1>
        <p className="text-zinc-400 text-sm">Manage role-based permissions across resources and actions</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 uppercase tracking-wide">Resource</label>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Resources</option>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 uppercase tracking-wide">Access</label>
          <select
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value as AccessFilter)}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Levels</option>
            <option value="granted">Granted</option>
            <option value="denied">Denied</option>
            <option value="conditional">Conditional</option>
          </select>
        </div>
        <div className="flex-1" />
        {hasChanges && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400 font-medium">
              {changedCells.length} unsaved change{changedCells.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors"
            >
              {showDiff ? "Hide Diff" : "View Diff"}
            </button>
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors text-rose-400"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded font-medium transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Diff Panel */}
      {showDiff && changedCells.length > 0 && (
        <div className="mb-5 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 text-zinc-300">Permission Changes</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {changedCells.map((ch, i) => {
              const col = COLUMNS[ch.colIndex]
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 w-20 shrink-0">{ROLES[ch.roleIndex].name}</span>
                  <span className="text-zinc-500 w-28 shrink-0">{col.resource} / {col.action}</span>
                  <span className={cn("w-20 shrink-0", ch.from === "granted" ? "text-emerald-400" : ch.from === "denied" ? "text-rose-400" : "text-amber-400")}>
                    {ch.from}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className={cn("w-20 shrink-0", ch.to === "granted" ? "text-emerald-400" : ch.to === "denied" ? "text-rose-400" : "text-amber-400")}>
                    {ch.to}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Matrix */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            {/* Resource group header */}
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="sticky left-0 z-10 bg-zinc-900 p-2 w-28 min-w-[7rem]" />
                {resourceGroups.map((group) => (
                  <th
                    key={group.resource}
                    colSpan={group.cols.length}
                    className="p-2 text-center text-indigo-400 font-semibold border-l border-zinc-800 uppercase tracking-wider"
                  >
                    {group.resource}
                  </th>
                ))}
              </tr>
              {/* Action header */}
              <tr className="border-b border-zinc-700">
                <th className="sticky left-0 z-10 bg-zinc-900 p-2 text-left text-zinc-400 font-medium">Role</th>
                {filteredColIndices.map((ci) => {
                  const col = COLUMNS[ci]
                  const isFirstInGroup = resourceGroups.some((g) => g.cols[0] === ci)
                  return (
                    <th
                      key={ci}
                      className={cn(
                        "p-2 text-center text-zinc-500 font-normal whitespace-nowrap",
                        isFirstInGroup && "border-l border-zinc-800"
                      )}
                    >
                      {col.action}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRoleIndices.map((ri) => {
                const role = ROLES[ri]
                const isExpanded = expandedRole === ri
                return (
                  <React.Fragment key={ri}>
                    <tr className={cn("border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors", isExpanded && "bg-zinc-800/20")}>
                      {/* Role name cell */}
                      <td
                        className="sticky left-0 z-10 bg-zinc-900 p-2 cursor-pointer select-none group"
                        onClick={() => setExpandedRole(isExpanded ? null : ri)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "inline-block w-4 text-center text-zinc-500 transition-transform text-[10px]",
                            isExpanded && "rotate-90"
                          )}>
                            ▶
                          </span>
                          <span className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                            {role.name}
                          </span>
                          <span className="text-zinc-600 text-[10px] ml-1">{role.memberCount}</span>
                        </div>
                      </td>
                      {/* Permission cells */}
                      {filteredColIndices.map((ci) => {
                        const perm = permissions[ri][ci]
                        const isChanged = perm.level !== savedPermissions[ri][ci].level
                        const isHovered = hoveredCell?.row === ri && hoveredCell?.col === ci
                        const isFirstInGroup = resourceGroups.some((g) => g.cols[0] === ci)
                        const dimmed = !matchesAccessFilter(perm.level)

                        return (
                          <td
                            key={ci}
                            className={cn(
                              "p-0 text-center relative",
                              isFirstInGroup && "border-l border-zinc-800"
                            )}
                          >
                            <button
                              onClick={() => toggleCell(ri, ci)}
                              onMouseEnter={() => setHoveredCell({ row: ri, col: ci })}
                              onMouseLeave={() => setHoveredCell(null)}
                              className={cn(
                                "w-full h-full p-2 transition-all cursor-pointer",
                                dimmed && "opacity-20",
                                !dimmed && perm.level === "granted" && "text-emerald-400 hover:bg-emerald-500/10",
                                !dimmed && perm.level === "denied" && "text-rose-400 hover:bg-rose-500/10",
                                !dimmed && perm.level === "conditional" && "text-amber-400 hover:bg-amber-500/10",
                                isChanged && "ring-1 ring-inset ring-indigo-500/50"
                              )}
                              title={
                                perm.level === "conditional" && perm.condition
                                  ? perm.condition
                                  : `${ROLES[ri].name}: ${COLUMNS[ci].resource} ${COLUMNS[ci].action} — ${perm.level}`
                              }
                            >
                              <span className="text-sm font-bold">
                                {perm.level === "granted" ? "✓" : perm.level === "denied" ? "✗" : "⚠"}
                              </span>
                              {isChanged && (
                                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              )}
                            </button>
                            {/* Tooltip for conditional */}
                            {isHovered && perm.level === "conditional" && perm.condition && (
                              <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-[11px] text-zinc-200 whitespace-nowrap pointer-events-none">
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700" />
                                {perm.condition}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {/* Expanded role detail panel */}
                    {isExpanded && (
                      <tr className="border-b border-zinc-800/50">
                        <td colSpan={filteredColIndices.length + 1} className="p-0">
                          <div className="bg-zinc-800/40 border-t border-zinc-800 px-4 py-3">
                            <div className="grid grid-cols-3 gap-6 max-w-2xl">
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Description</div>
                                <div className="text-xs text-zinc-300 leading-relaxed">{role.description}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Members</div>
                                <div className="text-xl font-bold text-white">{role.memberCount}</div>
                                <div className="mt-1.5 h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (role.memberCount / 70) * 100)}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Inherits From</div>
                                <div className="text-xs">
                                  {role.inheritsFrom ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/15 text-indigo-400 rounded border border-indigo-500/20">
                                      {role.inheritsFrom}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">None — standalone role</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Permission summary bars */}
                            <div className="mt-3 pt-3 border-t border-zinc-700/50">
                              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Permission Distribution</div>
                              <div className="flex gap-1 items-end h-6">
                                {(() => {
                                  const total = permissions[ri].length
                                  const granted = permissions[ri].filter((p) => p.level === "granted").length
                                  const denied = permissions[ri].filter((p) => p.level === "denied").length
                                  const conditional = permissions[ri].filter((p) => p.level === "conditional").length
                                  return (
                                    <>
                                      <div className="flex items-center gap-4 text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                                          <span className="text-zinc-400">Granted: {granted}/{total}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                                          <span className="text-zinc-400">Denied: {denied}/{total}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                                          <span className="text-zinc-400">Conditional: {conditional}/{total}</span>
                                        </div>
                                      </div>
                                      <div className="flex-1 flex h-2 rounded-full overflow-hidden ml-4">
                                        <div className="bg-emerald-500 transition-all" style={{ width: `${(granted / total) * 100}%` }} />
                                        <div className="bg-amber-500 transition-all" style={{ width: `${(conditional / total) * 100}%` }} />
                                        <div className="bg-rose-500 transition-all" style={{ width: `${(denied / total) * 100}%` }} />
                                      </div>
                                    </>
                                  )
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Permission Legend</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">✓</div>
            <div>
              <div className="text-xs font-medium text-white">Granted</div>
              <div className="text-[10px] text-zinc-500">Full access to this action</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-sm">✗</div>
            <div>
              <div className="text-xs font-medium text-white">Denied</div>
              <div className="text-[10px] text-zinc-500">No access to this action</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">⚠</div>
            <div>
              <div className="text-xs font-medium text-white">Conditional</div>
              <div className="text-[10px] text-zinc-500">Access granted with restrictions — hover for details</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-zinc-800 border border-indigo-500/50 flex items-center justify-center relative">
              <span className="text-zinc-500 text-sm">·</span>
              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            </div>
            <div>
              <div className="text-xs font-medium text-white">Modified</div>
              <div className="text-[10px] text-zinc-500">Unsaved change — blue dot indicator</div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] text-zinc-600">
          Click any cell to cycle through access levels. Click a role name to expand details. Use filters above to narrow the view.
        </div>
      </div>
    </div>
  )
}
