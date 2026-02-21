"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import type { WorkflowVizEdgeType } from "./types";

export type WorkflowEdgeData = {
  edgeType?: WorkflowVizEdgeType;
  isActive?: boolean;
  label?: string;
};

export type WorkflowFlowEdge = Edge<WorkflowEdgeData, "workflowEdge">;

const colors: Record<WorkflowVizEdgeType, { stroke: string; muted: string; dash?: string }> = {
  default: { stroke: "#3b82f6", muted: "#64748b" },
  conditional: { stroke: "#f59e0b", muted: "#64748b", dash: "8 4" },
  parallel: { stroke: "#8b5cf6", muted: "#64748b" },
  feedback: { stroke: "#ec4899", muted: "#64748b" },
};

export function WorkflowEdge(props: EdgeProps<WorkflowFlowEdge>) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, data } = props;
  const edgeType = data?.edgeType ?? "default";
  const cfg = colors[edgeType];
  const stroke = data?.isActive ? cfg.stroke : cfg.muted;

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: 2,
          strokeDasharray: cfg.dash ?? "none",
        }}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="rounded-full border border-border bg-card/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
