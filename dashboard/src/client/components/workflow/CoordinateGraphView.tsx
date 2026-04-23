import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type {
  DashboardChainGraph,
  DashboardWalkerState,
  DashboardWalkerStatus,
  GraphNodeType,
} from '@/shared/coordinate-types.js';

// ---------------------------------------------------------------------------
// CoordinateGraphView -- SVG-based DAG renderer for ChainGraph visualization
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

export interface LayoutNode {
  id: string;
  type: GraphNodeType;
  x: number;
  y: number;
  status: DashboardWalkerStatus | 'pending';
  label: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_W = 140;
const NODE_H = 56;
const COL_GAP = 200;
const ROW_GAP = 90;
const PADDING = 40;

// ---------------------------------------------------------------------------
// Graph layout — topological sort + layer assignment (BFS from entry)
// ---------------------------------------------------------------------------

export function layoutGraph(
  graph: DashboardChainGraph,
  walkerState?: DashboardWalkerState | null,
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodeIds = Object.keys(graph.nodes);
  if (nodeIds.length === 0) return { nodes: [], edges: [] };

  // Build adjacency list
  const adj: Record<string, string[]> = {};
  for (const id of nodeIds) {
    adj[id] = getOutgoingTargets(graph, id);
  }

  // BFS layer assignment from entry node
  const layers: Record<string, number> = {};
  const queue: string[] = [graph.entry];
  layers[graph.entry] = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextLayer = layers[current] + 1;
    for (const target of adj[current] ?? []) {
      if (layers[target] === undefined) {
        layers[target] = nextLayer;
        queue.push(target);
      }
    }
  }

  // Assign layer to any unreachable nodes
  for (const id of nodeIds) {
    if (layers[id] === undefined) {
      layers[id] = 0;
    }
  }

  // Group nodes by layer
  const layerGroups: Record<number, string[]> = {};
  for (const id of nodeIds) {
    const layer = layers[id];
    if (!layerGroups[layer]) layerGroups[layer] = [];
    layerGroups[layer].push(id);
  }

  // Build history set for completed/failed nodes
  const historyOutcomes: Record<string, 'success' | 'failure' | 'skipped'> = {};
  if (walkerState?.history) {
    for (const entry of walkerState.history) {
      if (entry.outcome) {
        historyOutcomes[entry.node_id] = entry.outcome;
      }
    }
  }

  // Assign x/y positions
  const layoutNodes: LayoutNode[] = [];
  const layerNums = Object.keys(layerGroups).map(Number).sort((a, b) => a - b);

  for (const layer of layerNums) {
    const group = layerGroups[layer];
    const x = PADDING + layer * COL_GAP;

    for (let i = 0; i < group.length; i++) {
      const id = group[i];
      const node = graph.nodes[id];
      const y = PADDING + i * ROW_GAP;
      const status = resolveNodeStatus(id, walkerState, historyOutcomes);
      const label = node.description ?? id;

      layoutNodes.push({ id, type: node.type, x, y, status, label });
    }
  }

  // Build edges
  const activeEdges = new Set<string>();
  if (walkerState) {
    const currentTargets = adj[walkerState.current_node] ?? [];
    for (const t of currentTargets) {
      activeEdges.add(`${walkerState.current_node}->${t}`);
    }
  }

  const layoutEdges: LayoutEdge[] = [];
  for (const fromId of nodeIds) {
    for (const toId of adj[fromId]) {
      if (!graph.nodes[toId]) continue;
      layoutEdges.push({
        from: fromId,
        to: toId,
        active: activeEdges.has(`${fromId}->${toId}`),
      });
    }
  }

  return { nodes: layoutNodes, edges: layoutEdges };
}

/** Extract outgoing target node ids from a graph node */
function getOutgoingTargets(graph: DashboardChainGraph, nodeId: string): string[] {
  const node = graph.nodes[nodeId];
  if (!node) return [];

  const targets: string[] = [];
  const raw = node as unknown as Record<string, unknown>;

  // 'next' field — string or array
  if (typeof raw.next === 'string') targets.push(raw.next);
  if (Array.isArray(raw.next)) targets.push(...raw.next);

  // decision edges
  if (Array.isArray(raw.edges)) {
    for (const edge of raw.edges) {
      if (typeof edge === 'object' && edge !== null && typeof (edge as { target: string }).target === 'string') {
        targets.push((edge as { target: string }).target);
      }
    }
  }

  // gate on_pass / on_fail
  if (typeof raw.on_pass === 'string') targets.push(raw.on_pass);
  if (typeof raw.on_fail === 'string') targets.push(raw.on_fail);

  // fork branches + join
  if (Array.isArray(raw.branches)) targets.push(...raw.branches.filter((b: unknown): b is string => typeof b === 'string'));
  if (typeof raw.join === 'string') targets.push(raw.join);

  // on_failure fallback
  if (typeof raw.on_failure === 'string') targets.push(raw.on_failure);

  return [...new Set(targets)];
}

function resolveNodeStatus(
  nodeId: string,
  walkerState: DashboardWalkerState | null | undefined,
  historyOutcomes: Record<string, 'success' | 'failure' | 'skipped'>,
): DashboardWalkerStatus | 'pending' {
  if (!walkerState) return 'pending';
  if (walkerState.current_node === nodeId) return walkerState.status;
  const outcome = historyOutcomes[nodeId];
  if (outcome === 'success') return 'completed';
  if (outcome === 'failure') return 'failed';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

function statusColor(status: DashboardWalkerStatus | 'pending'): string {
  switch (status) {
    case 'running':
    case 'waiting_command':
    case 'waiting_gate':
    case 'waiting_fork':
      return 'var(--color-accent-blue)';
    case 'completed':
      return 'var(--color-accent-green)';
    case 'failed':
      return 'var(--color-accent-red)';
    case 'step_paused':
    case 'paused':
      return 'var(--color-accent-orange, #B89540)';
    case 'pending':
    default:
      return 'var(--color-text-tertiary)';
  }
}

function statusFill(status: DashboardWalkerStatus | 'pending'): string {
  switch (status) {
    case 'running':
    case 'waiting_command':
    case 'waiting_gate':
    case 'waiting_fork':
      return 'rgba(59,130,246,0.12)';
    case 'completed':
      return 'rgba(34,197,94,0.12)';
    case 'failed':
      return 'rgba(239,68,68,0.12)';
    case 'step_paused':
    case 'paused':
      return 'rgba(184,149,64,0.12)';
    case 'pending':
    default:
      return 'var(--color-bg-secondary)';
  }
}

// ---------------------------------------------------------------------------
// Node shape components — 7 distinct SVG geometries
// ---------------------------------------------------------------------------

function NodeShape({
  node,
  isSelected,
  onClick,
}: {
  node: LayoutNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const stroke = statusColor(node.status);
  const fill = statusFill(node.status);
  const cx = node.x + NODE_W / 2;
  const cy = node.y + NODE_H / 2;
  const hw = NODE_W / 2;
  const hh = NODE_H / 2;

  const shapeElement = (() => {
    switch (node.type) {
      // Command: rounded rectangle
      case 'command':
        return (
          <rect
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={NODE_H}
            rx={8}
            ry={8}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
        );

      // Decision: diamond
      case 'decision':
        return (
          <polygon
            points={`${cx},${node.y - 4} ${node.x + NODE_W + 4},${cy} ${cx},${node.y + NODE_H + 4} ${node.x - 4},${cy}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
        );

      // Gate: hexagon
      case 'gate': {
        const inset = 18;
        const pts = [
          `${node.x + inset},${node.y}`,
          `${node.x + NODE_W - inset},${node.y}`,
          `${node.x + NODE_W},${cy}`,
          `${node.x + NODE_W - inset},${node.y + NODE_H}`,
          `${node.x + inset},${node.y + NODE_H}`,
          `${node.x},${cy}`,
        ].join(' ');
        return (
          <polygon
            points={pts}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
        );
      }

      // Fork: split-lines (rectangle with vertical split lines)
      case 'fork':
        return (
          <g>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx={4}
              ry={4}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <line
              x1={cx - 12}
              y1={node.y + 10}
              x2={cx - 12}
              y2={node.y + NODE_H - 10}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.5}
            />
            <line
              x1={cx + 12}
              y1={node.y + 10}
              x2={cx + 12}
              y2={node.y + NODE_H - 10}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.5}
            />
          </g>
        );

      // Join: merge-lines (rectangle with converging lines)
      case 'join':
        return (
          <g>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx={4}
              ry={4}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <line
              x1={cx - 16}
              y1={node.y + 10}
              x2={cx}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.5}
            />
            <line
              x1={cx + 16}
              y1={node.y + 10}
              x2={cx}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.5}
            />
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={node.y + NODE_H - 10}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.5}
            />
          </g>
        );

      // Eval: brackets shape (rect with bracket decorations)
      case 'eval':
        return (
          <g>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx={4}
              ry={4}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            {/* Left bracket */}
            <path
              d={`M${node.x + 10},${node.y + 8} L${node.x + 6},${node.y + 8} L${node.x + 6},${node.y + NODE_H - 8} L${node.x + 10},${node.y + NODE_H - 8}`}
              fill="none"
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.6}
            />
            {/* Right bracket */}
            <path
              d={`M${node.x + NODE_W - 10},${node.y + 8} L${node.x + NODE_W - 6},${node.y + 8} L${node.x + NODE_W - 6},${node.y + NODE_H - 8} L${node.x + NODE_W - 10},${node.y + NODE_H - 8}`}
              fill="none"
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.6}
            />
          </g>
        );

      // Terminal: circle / pill shape
      case 'terminal':
        return (
          <rect
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={NODE_H}
            rx={NODE_H / 2}
            ry={NODE_H / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
        );

      default:
        return (
          <rect
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={NODE_H}
            rx={4}
            ry={4}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
        );
    }
  })();

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px` }}
      onClick={onClick}
      role="button"
      aria-label={`${node.type} node: ${node.label}`}
    >
      {shapeElement}

      {/* Type label (small, top) */}
      <text
        x={cx}
        y={node.y + 18}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={stroke}
        style={{ pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.04em' }}
      >
        {node.type}
      </text>

      {/* Node label (main) */}
      <text
        x={cx}
        y={node.y + 36}
        textAnchor="middle"
        fontSize={12}
        fill="var(--color-text-primary)"
        style={{ pointerEvents: 'none' }}
      >
        {node.label.length > 18 ? node.label.slice(0, 16) + '..' : node.label}
      </text>
    </motion.g>
  );
}

// ---------------------------------------------------------------------------
// Edge rendering — cubic Bezier curves
// ---------------------------------------------------------------------------

function EdgePath({ edge, nodeMap }: { edge: LayoutEdge; nodeMap: Map<string, LayoutNode> }) {
  const fromNode = nodeMap.get(edge.from);
  const toNode = nodeMap.get(edge.to);
  if (!fromNode || !toNode) return null;

  // From right center of source, to left center of target
  const x1 = fromNode.x + NODE_W;
  const y1 = fromNode.y + NODE_H / 2;
  const x2 = toNode.x;
  const y2 = toNode.y + NODE_H / 2;

  // Control points for smooth Bezier
  const dx = Math.abs(x2 - x1);
  const cpOffset = Math.max(dx * 0.4, 40);
  const cp1x = x1 + cpOffset;
  const cp1y = y1;
  const cp2x = x2 - cpOffset;
  const cp2y = y2;

  const d = `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  const color = edge.active ? 'var(--color-accent-blue)' : 'var(--color-border)';

  return (
    <g>
      {/* Base path */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={edge.active ? 2 : 1.2}
        opacity={edge.active ? 1 : 0.5}
      />

      {/* Animated flow indicator for active edges */}
      {edge.active && (
        <motion.path
          d={d}
          fill="none"
          stroke="var(--color-accent-blue)"
          strokeWidth={2}
          strokeDasharray="6 4"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -30 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        />
      )}

      {/* Arrow head */}
      <polygon
        points={`${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`}
        fill={color}
        opacity={edge.active ? 1 : 0.5}
      />

      {/* Edge label */}
      {edge.label && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-text-tertiary)"
          style={{ pointerEvents: 'none' }}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// CoordinateGraphView — main exported component
// ---------------------------------------------------------------------------

interface CoordinateGraphViewProps {
  graph: DashboardChainGraph;
  walkerState?: DashboardWalkerState | null;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
}

export function CoordinateGraphView({
  graph,
  walkerState,
  selectedNodeId,
  onSelectNode,
}: CoordinateGraphViewProps) {
  const { nodes, edges } = useMemo(
    () => layoutGraph(graph, walkerState),
    [graph, walkerState],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // Compute viewBox from node positions
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 400 200';
    let maxX = 0;
    let maxY = 0;
    for (const n of nodes) {
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + NODE_H);
    }
    return `0 0 ${maxX + PADDING * 2} ${maxY + PADDING * 2}`;
  }, [nodes]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onSelectNode?.(selectedNodeId === nodeId ? null : nodeId);
    },
    [onSelectNode, selectedNodeId],
  );

  if (nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-[length:var(--font-size-sm)]"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        No graph data
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <svg
        viewBox={viewBox}
        className="w-full h-full"
        style={{ minWidth: '100%', minHeight: '100%' }}
      >
        {/* Edges (render below nodes) */}
        <g>
          {edges.map((edge) => (
            <EdgePath
              key={`${edge.from}->${edge.to}`}
              edge={edge}
              nodeMap={nodeMap}
            />
          ))}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node) => (
            <NodeShape
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              onClick={() => handleNodeClick(node.id)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
