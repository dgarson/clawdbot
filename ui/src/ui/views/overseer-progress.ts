/**
 * Goal Progress Panel — Per-phase progress tracking with dependency awareness.
 *
 * Features:
 * - Overall goal completion percentage with animated bar
 * - Status distribution (done/in-progress/blocked/pending)
 * - Per-phase progress bars with task counts
 * - Expandable phase detail showing individual tasks
 * - Dependency indicators on tasks
 * - Velocity metrics (tasks/day) and ETA estimation
 */

import { html, nothing } from "lit";
import type {
  OverseerGoalDetail,
  OverseerPhase,
  OverseerTask,
  OverseerAssignmentDetail,
  OverseerCrystallization,
} from "../types/overseer.js";
import { clampText, formatAgo, formatDurationMs } from "../format.js";
import { icon } from "../icons.js";

// --- Types ---

export type GoalProgressProps = {
  goal: OverseerGoalDetail | undefined;
  assignments: OverseerAssignmentDetail[];
  crystallizations: OverseerCrystallization[];
  expandedPhaseIds: Set<string>;
  onTogglePhase: (phaseId: string) => void;
  onSelectWorkNode?: (workNodeId: string) => void;
};

type StatusCounts = {
  done: number;
  in_progress: number;
  blocked: number;
  pending: number;
  total: number;
};

type PhaseProgress = {
  phase: OverseerPhase;
  counts: StatusCounts;
  pct: number;
};

// --- Helpers ---

function countStatuses(nodes: Array<{ status: string }>): StatusCounts {
  const counts: StatusCounts = { done: 0, in_progress: 0, blocked: 0, pending: 0, total: 0 };
  for (const node of nodes) {
    counts.total++;
    if (node.status === "done") counts.done++;
    else if (node.status === "in_progress") counts.in_progress++;
    else if (node.status === "blocked") counts.blocked++;
    else counts.pending++;
  }
  return counts;
}

function getAllWorkNodes(
  goal: OverseerGoalDetail,
): Array<{ id: string; name: string; status: string; dependsOn?: string[]; parentId?: string }> {
  const nodes: Array<{
    id: string;
    name: string;
    status: string;
    dependsOn?: string[];
    parentId?: string;
  }> = [];
  for (const phase of goal.plan?.phases ?? []) {
    nodes.push({
      id: phase.id,
      name: phase.name,
      status: phase.status,
      dependsOn: phase.dependsOn,
    });
    for (const task of phase.tasks) {
      nodes.push({
        id: task.id,
        name: task.name,
        status: task.status,
        dependsOn: task.dependsOn,
        parentId: phase.id,
      });
      for (const subtask of task.subtasks) {
        nodes.push({
          id: subtask.id,
          name: subtask.name,
          status: subtask.status,
          dependsOn: subtask.dependsOn,
          parentId: task.id,
        });
      }
    }
  }
  return nodes;
}

function computeVelocity(
  goal: OverseerGoalDetail,
  assignments: OverseerAssignmentDetail[],
): { tasksPerDay: number; estimatedDaysRemaining: number | null } {
  const allNodes = getAllWorkNodes(goal);
  const doneTasks = allNodes.filter((n) => n.status === "done");
  const remainingTasks = allNodes.filter((n) => n.status !== "done");

  if (doneTasks.length === 0) {
    return { tasksPerDay: 0, estimatedDaysRemaining: null };
  }

  // Compute velocity based on goal creation time
  const now = Date.now();
  const goalAge = now - goal.createdAt;
  const daysElapsed = Math.max(goalAge / (1000 * 60 * 60 * 24), 0.1);
  const tasksPerDay = doneTasks.length / daysElapsed;

  const estimatedDaysRemaining =
    tasksPerDay > 0 ? Math.ceil(remainingTasks.length / tasksPerDay) : null;

  return { tasksPerDay: Math.round(tasksPerDay * 10) / 10, estimatedDaysRemaining };
}

function statusColor(status: string): string {
  switch (status) {
    case "done":
      return "var(--accent-2)";
    case "in_progress":
      return "var(--accent)";
    case "blocked":
      return "var(--danger)";
    default:
      return "rgba(255, 255, 255, 0.2)";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "done":
      return "Done";
    case "in_progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

// --- Render ---

export function renderGoalProgress(props: GoalProgressProps) {
  if (!props.goal?.plan?.phases?.length) {
    return html`
      <div class="goal-progress">
        <div class="goal-progress__header">
          <div class="goal-progress__header-left">
            <div class="goal-progress__header-icon">
              ${icon("barChart", { size: 18 })}
            </div>
            <div>
              <div class="goal-progress__title">Goal Progress</div>
              <div class="goal-progress__subtitle">Track completion across phases</div>
            </div>
          </div>
        </div>
        <div class="goal-progress__empty">
          <div class="goal-progress__empty-icon">${icon("barChart", { size: 32 })}</div>
          <div>No plan generated yet. Create a goal and generate a plan to see progress.</div>
        </div>
      </div>
    `;
  }

  const goal = props.goal;
  const phases = goal.plan!.phases;

  // Collect all task-level work nodes (tasks + subtasks, not phases)
  const allTasks: Array<{ id: string; name: string; status: string; dependsOn?: string[] }> = [];
  for (const phase of phases) {
    for (const task of phase.tasks) {
      allTasks.push(task);
      for (const subtask of task.subtasks) {
        allTasks.push(subtask);
      }
    }
  }

  const overallCounts = countStatuses(allTasks);
  const overallPct =
    overallCounts.total > 0 ? Math.round((overallCounts.done / overallCounts.total) * 100) : 0;

  // Phase-level progress
  const phaseProgress: PhaseProgress[] = phases.map((phase) => {
    const phaseTasks: Array<{ status: string }> = [];
    for (const task of phase.tasks) {
      phaseTasks.push(task);
      for (const sub of task.subtasks) {
        phaseTasks.push(sub);
      }
    }
    const counts = countStatuses(phaseTasks);
    const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
    return { phase, counts, pct };
  });

  const velocity = computeVelocity(goal, props.assignments);

  return html`
    <div class="goal-progress">
      ${renderProgressHeader(goal, overallCounts, overallPct)}
      ${renderOverallProgress(overallCounts, overallPct)}
      ${renderStatusDistribution(overallCounts)}
      ${renderPhaseProgress(phaseProgress, props)}
      ${renderVelocityMetrics(velocity, overallCounts)}
    </div>
  `;
}

function renderProgressHeader(goal: OverseerGoalDetail, counts: StatusCounts, pct: number) {
  return html`
    <div class="goal-progress__header">
      <div class="goal-progress__header-left">
        <div class="goal-progress__header-icon">
          ${icon("barChart", { size: 18 })}
        </div>
        <div>
          <div class="goal-progress__title">Goal Progress</div>
          <div class="goal-progress__subtitle">
            ${clampText(goal.title, 50)} · ${counts.done}/${counts.total} tasks complete
          </div>
        </div>
      </div>
      <div class="goal-progress__overall-pct">${pct}%</div>
    </div>
  `;
}

function renderOverallProgress(counts: StatusCounts, pct: number) {
  return html`
    <div class="goal-progress__overall">
      <div class="goal-progress__overall-bar">
        <div class="goal-progress__overall-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="goal-progress__overall-meta">
        <span>${counts.done} done · ${counts.in_progress} active · ${counts.blocked} blocked · ${counts.pending} pending</span>
      </div>
    </div>
  `;
}

function renderStatusDistribution(counts: StatusCounts) {
  if (counts.total === 0) return nothing;

  const donePct = (counts.done / counts.total) * 100;
  const inProgressPct = (counts.in_progress / counts.total) * 100;
  const blockedPct = (counts.blocked / counts.total) * 100;
  const pendingPct = (counts.pending / counts.total) * 100;

  return html`
    <div>
      <div class="goal-progress__status-bar">
        ${donePct > 0 ? html`<div class="goal-progress__status-segment goal-progress__status-segment--done" style="width: ${donePct}%;"></div>` : nothing}
        ${inProgressPct > 0 ? html`<div class="goal-progress__status-segment goal-progress__status-segment--in_progress" style="width: ${inProgressPct}%;"></div>` : nothing}
        ${blockedPct > 0 ? html`<div class="goal-progress__status-segment goal-progress__status-segment--blocked" style="width: ${blockedPct}%;"></div>` : nothing}
        ${pendingPct > 0 ? html`<div class="goal-progress__status-segment goal-progress__status-segment--pending" style="width: ${pendingPct}%;"></div>` : nothing}
      </div>
      <div class="goal-progress__legend">
        ${counts.done > 0 ? html`<div class="goal-progress__legend-item"><span class="goal-progress__legend-dot goal-progress__legend-dot--done"></span> Done (${counts.done})</div>` : nothing}
        ${counts.in_progress > 0 ? html`<div class="goal-progress__legend-item"><span class="goal-progress__legend-dot goal-progress__legend-dot--in_progress"></span> In Progress (${counts.in_progress})</div>` : nothing}
        ${counts.blocked > 0 ? html`<div class="goal-progress__legend-item"><span class="goal-progress__legend-dot goal-progress__legend-dot--blocked"></span> Blocked (${counts.blocked})</div>` : nothing}
        ${counts.pending > 0 ? html`<div class="goal-progress__legend-item"><span class="goal-progress__legend-dot goal-progress__legend-dot--pending"></span> Pending (${counts.pending})</div>` : nothing}
      </div>
    </div>
  `;
}

function renderPhaseProgress(phaseProgress: PhaseProgress[], props: GoalProgressProps) {
  return html`
    <div class="goal-progress__phases">
      ${phaseProgress.map((pp) => renderPhaseItem(pp, props))}
    </div>
  `;
}

function renderPhaseItem(pp: PhaseProgress, props: GoalProgressProps) {
  const { phase, counts, pct } = pp;
  const isExpanded = props.expandedPhaseIds.has(phase.id);
  const statusDotColor = statusColor(phase.status);

  // Compute stacked bar widths
  const donePct = counts.total > 0 ? (counts.done / counts.total) * 100 : 0;
  const ipPct = counts.total > 0 ? (counts.in_progress / counts.total) * 100 : 0;
  const blockedPct = counts.total > 0 ? (counts.blocked / counts.total) * 100 : 0;

  return html`
    <div class="goal-progress__phase goal-progress__phase--${phase.status}">
      <div
        class="goal-progress__phase-header"
        @click=${() => props.onTogglePhase(phase.id)}
        role="button"
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onTogglePhase(phase.id);
          }
        }}
        style="cursor: pointer;"
      >
        <div class="goal-progress__phase-info">
          <div
            class="goal-progress__phase-status-dot"
            style="background: ${statusDotColor};"
          ></div>
          <span class="goal-progress__phase-name">${phase.name}</span>
        </div>
        <div class="goal-progress__phase-counts">
          ${counts.done}/${counts.total} · ${pct}%
          <span style="display: inline-block; transition: transform 150ms ease; transform: rotate(${isExpanded ? "180deg" : "0deg"});">
            ${icon("chevron-down", { size: 12 })}
          </span>
        </div>
      </div>
      <div class="goal-progress__phase-bar">
        ${donePct > 0 ? html`<div class="goal-progress__phase-fill goal-progress__phase-fill--done" style="width: ${donePct}%;"></div>` : nothing}
        ${ipPct > 0 ? html`<div class="goal-progress__phase-fill goal-progress__phase-fill--in_progress" style="width: ${ipPct}%;"></div>` : nothing}
        ${blockedPct > 0 ? html`<div class="goal-progress__phase-fill goal-progress__phase-fill--blocked" style="width: ${blockedPct}%;"></div>` : nothing}
      </div>
      ${isExpanded ? renderPhaseTasks(pp.phase, props) : nothing}
    </div>
  `;
}

function renderPhaseTasks(phase: OverseerPhase, props: GoalProgressProps) {
  const tasks: Array<{
    id: string;
    name: string;
    status: string;
    dependsOn?: string[];
    isSubtask: boolean;
  }> = [];
  for (const task of phase.tasks) {
    tasks.push({ ...task, isSubtask: false });
    for (const subtask of task.subtasks) {
      tasks.push({ ...subtask, isSubtask: true });
    }
  }

  if (tasks.length === 0) {
    return html`
      <div class="goal-progress__phase-tasks">
        <div style="font-size: 12px; color: var(--muted); padding: 4px 6px">No tasks in this phase.</div>
      </div>
    `;
  }

  return html`
    <div class="goal-progress__phase-tasks">
      ${tasks.map(
        (task) => html`
          <div
            class="goal-progress__task"
            style="${task.isSubtask ? "padding-left: 22px;" : ""}"
            @click=${() => props.onSelectWorkNode?.(task.id)}
            role=${props.onSelectWorkNode ? "button" : nothing}
            tabindex=${props.onSelectWorkNode ? "0" : nothing}
          >
            <div
              class="goal-progress__task-dot"
              style="background: ${statusColor(task.status)};"
            ></div>
            <span class="goal-progress__task-name">${task.name}</span>
            ${
              task.dependsOn?.length
                ? html`<span class="goal-progress__task-deps" title="Depends on: ${task.dependsOn.join(", ")}">
                    ${icon("link", { size: 10 })} ${task.dependsOn.length}
                  </span>`
                : nothing
            }
            <span class="goal-progress__task-status goal-progress__task-status--${task.status === "in_progress" || task.status === "done" || task.status === "blocked" ? task.status : "pending"}">
              ${statusLabel(task.status)}
            </span>
          </div>
        `,
      )}
    </div>
  `;
}

function renderVelocityMetrics(
  velocity: { tasksPerDay: number; estimatedDaysRemaining: number | null },
  counts: StatusCounts,
) {
  if (counts.total === 0) return nothing;

  return html`
    <div class="goal-progress__velocity">
      <div class="goal-progress__velocity-item">
        <span class="goal-progress__velocity-label">Velocity</span>
        <span class="goal-progress__velocity-value">
          ${velocity.tasksPerDay > 0 ? `${velocity.tasksPerDay}/day` : "—"}
        </span>
      </div>
      <div class="goal-progress__velocity-item">
        <span class="goal-progress__velocity-label">Est. Remaining</span>
        <span class="goal-progress__velocity-value">
          ${
            velocity.estimatedDaysRemaining !== null
              ? velocity.estimatedDaysRemaining === 0
                ? "< 1 day"
                : `~${velocity.estimatedDaysRemaining}d`
              : "—"
          }
        </span>
      </div>
    </div>
  `;
}
