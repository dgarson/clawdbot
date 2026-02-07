"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

interface ObstacleNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AvoidingEdgeData extends Record<string, unknown> {
  obstacles?: ObstacleNode[];
  routeDirection?: "left" | "right" | "none";
  clearanceOffset?: number;
}

/**
 * Custom edge that routes around obstacles using an L-shaped path.
 * Goes straight down from source until target's vertical center, then turns 90° horizontally.
 */
export const AvoidingEdge = memo(function AvoidingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = data as AvoidingEdgeData | undefined;
  const obstacles = edgeData?.obstacles || [];
  const routeDirection = edgeData?.routeDirection || "none";

  // If no obstacles, use a simple smooth step path
  if (obstacles.length === 0 || routeDirection === "none") {
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 8,
    });

    return (
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
      />
    );
  }

  // Build L-shaped path:
  // 1. Go straight DOWN from source
  // 2. At the target's vertical center, turn 90°
  // 3. Go straight HORIZONTALLY to the target
  const path = buildLShapedPath(sourceX, sourceY, targetX, targetY, 8);

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
    />
  );
});

// Node dimensions (should match TaskNode)
const NODE_WIDTH = 260;
const NODE_HEIGHT = 180;

/**
 * Build an L-shaped SVG path:
 * - Straight down from source to target's vertical center
 * - Turn 90° with rounded corner
 * - Straight horizontally to target's closest edge (left or right side)
 */
function buildLShapedPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  borderRadius: number
): string {
  const r = borderRadius;

  // targetX is the center of the node (where the handle is)
  // targetY is the top of the node
  // We want the turn to happen at the vertical CENTER of the target node
  const targetCenterY = targetY + NODE_HEIGHT / 2;
  const turnY = targetCenterY;

  // Calculate the target node's left and right edges
  const targetLeftEdge = targetX - NODE_WIDTH / 2;
  const targetRightEdge = targetX + NODE_WIDTH / 2;

  // Determine which side to connect to (closest edge)
  const goingLeft = sourceX > targetX;
  const endpointX = goingLeft ? targetRightEdge : targetLeftEdge;

  // Build the path with a rounded corner at the turn
  let path = `M ${sourceX} ${sourceY}`;

  // Go straight down to just before the turn
  path += ` L ${sourceX} ${turnY - r}`;

  // Rounded corner turn (90°)
  if (goingLeft) {
    // Turning left - connect to target's RIGHT edge
    path += ` Q ${sourceX} ${turnY} ${sourceX - r} ${turnY}`;
    path += ` L ${endpointX} ${turnY}`;
  } else {
    // Turning right - connect to target's LEFT edge
    path += ` Q ${sourceX} ${turnY} ${sourceX + r} ${turnY}`;
    path += ` L ${endpointX} ${turnY}`;
  }

  return path;
}

export default AvoidingEdge;
