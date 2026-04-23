import { useCallback, useMemo } from 'react';
import X from 'lucide-react/dist/esm/icons/x.js';
import type { TeamSessionDetail, PipelineNode, TeamRole, TeamMessage } from '@/shared/team-types.js';
import { PIPELINE_STATUS_COLORS, ROLE_STATUS_COLORS } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// TeamStatusOverlay — slide-down panel with 3-column layout
// Pipeline | Roles | Messages
// ---------------------------------------------------------------------------

export function TeamStatusOverlay({
  session,
  open,
  onClose,
}: {
  session: TeamSessionDetail;
  open: boolean;
  onClose: () => void;
}) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'absolute inset-0 z-40 bg-black/[.18] backdrop-blur-[2px] transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={handleBackdropClick}
      >
        {/* Panel */}
        <div
          className={[
            'absolute top-0 left-0 right-0 z-50 bg-bg-card border-b border-border',
            'rounded-b-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
            'transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            'max-h-[68vh] overflow-hidden flex flex-col',
            open ? 'translate-y-0' : '-translate-y-full',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-divider shrink-0">
            <h3 className="text-[14px] font-bold text-text-primary">
              {session.title}
            </h3>
            <span className="text-[10px] font-mono text-text-tertiary">
              {session.sessionId}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* 3-column body */}
          <div className="grid grid-cols-3 flex-1 overflow-auto">
            {/* Pipeline column — mini DAG view */}
            <div className="p-3.5">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-placeholder mb-2.5 flex items-center gap-1.5">
                Pipeline
                <span className="bg-bg-hover px-1.5 rounded-full text-[9px] text-text-tertiary">
                  {session.pipelineStages.length}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex gap-2 mb-3">
                <StatBox label="Done" value={session.pipelineStages.filter(s => s.status === 'done').length} />
                <StatBox label="Active" value={session.pipelineStages.filter(s => s.status === 'in_progress').length} />
                <StatBox label="Pending" value={session.pipelineStages.filter(s => s.status === 'pending').length} />
              </div>

              {/* Mini DAG: grouped by wave with SVG flow arrows */}
              {session.pipeline.waves.length > 0 ? (
                <PipelineMiniDAG waves={session.pipeline.waves} />
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {session.pipelineStages.map((node) => (
                    <PipelineNodeBadge key={node.id} node={node} />
                  ))}
                </div>
              )}
            </div>

            {/* Roles column */}
            <div className="p-3.5 border-l border-border-divider">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-placeholder mb-2.5 flex items-center gap-1.5">
                Roles
                <span className="bg-bg-hover px-1.5 rounded-full text-[9px] text-text-tertiary">
                  {session.roleDetails.length}
                </span>
              </div>
              <div className="flex flex-col">
                {session.roleDetails.map((role) => (
                  <RoleRow key={role.name} role={role} />
                ))}
                {session.roleDetails.length === 0 && (
                  <span className="text-[11px] text-text-tertiary italic">No roles data</span>
                )}
              </div>
            </div>

            {/* Messages column */}
            <div className="p-3.5 border-l border-border-divider">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-placeholder mb-2.5 flex items-center gap-1.5">
                Messages
                <span className="bg-bg-hover px-1.5 rounded-full text-[9px] text-text-tertiary">
                  {session.messages.length}
                </span>
              </div>
              <div className="flex flex-col max-h-[50vh] overflow-y-auto">
                {session.messages.slice(-20).map((msg) => (
                  <MessageRow key={msg.id} message={msg} />
                ))}
                {session.messages.length === 0 && (
                  <span className="text-[11px] text-text-tertiary italic">No messages</span>
                )}
              </div>
            </div>
          </div>

          {/* Drag handle */}
          <div className="flex justify-center py-1.5 border-t border-border-divider cursor-pointer hover:bg-bg-hover">
            <div className="w-10 h-1 rounded-full bg-text-placeholder" />
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PipelineMiniDAG — SVG mini-graph with wave-based columns and flow arrows
// ---------------------------------------------------------------------------

interface WaveData {
  number: number;
  nodes: PipelineNode[];
}

/** Layout constants for the mini DAG */
const DAG = {
  nodeW: 100,
  nodeH: 26,
  colGap: 36,
  rowGap: 6,
  padX: 12,
  padY: 8,
  arrowLen: 36,
} as const;

function PipelineMiniDAG({ waves }: { waves: WaveData[] }) {
  const layout = useMemo(() => {
    // Sort waves by number
    const sorted = [...waves].sort((a, b) => a.number - b.number);

    // Compute node positions: each wave is a column, nodes stack vertically
    const positions = new Map<string, { x: number; y: number; wave: number }>();
    const waveXPositions: number[] = [];

    let x = DAG.padX;
    for (const wave of sorted) {
      waveXPositions.push(x);
      let y = DAG.padY;
      for (const node of wave.nodes) {
        positions.set(node.id, { x, y, wave: wave.number });
        y += DAG.nodeH + DAG.rowGap;
      }
      x += DAG.nodeW + DAG.arrowLen;
    }

    // Calculate SVG dimensions
    const maxNodesInWave = Math.max(...sorted.map((w) => w.nodes.length), 1);
    const svgW = sorted.length * (DAG.nodeW + DAG.arrowLen) - DAG.arrowLen + DAG.padX * 2;
    const svgH = maxNodesInWave * (DAG.nodeH + DAG.rowGap) - DAG.rowGap + DAG.padY * 2;

    return { sorted, positions, waveXPositions, svgW, svgH };
  }, [waves]);

  const { sorted, positions, waveXPositions, svgW, svgH } = layout;

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block"
      >
        <defs>
          <marker
            id="dag-arrow"
            markerWidth="6"
            markerHeight="4"
            refX="5"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L6,2 L0,4" fill="var(--color-text-placeholder)" />
          </marker>
        </defs>

        {/* Flow arrows between consecutive waves */}
        {sorted.map((wave, waveIdx) => {
          if (waveIdx === 0) return null;
          const prevWave = sorted[waveIdx - 1];
          const prevX = waveXPositions[waveIdx - 1];
          const currX = waveXPositions[waveIdx];

          // Draw arrows from each node in prev wave to each node in current wave
          const arrows: React.ReactNode[] = [];
          for (const fromNode of prevWave.nodes) {
            const fromPos = positions.get(fromNode.id)!;
            const fromEndX = prevX + DAG.nodeW;
            const fromMidY = fromPos.y + DAG.nodeH / 2;

            for (const toNode of wave.nodes) {
              const toPos = positions.get(toNode.id)!;
              const toStartX = currX;
              const toMidY = toPos.y + DAG.nodeH / 2;

              arrows.push(
                <line
                  key={`${fromNode.id}-${toNode.id}`}
                  x1={fromEndX + 2}
                  y1={fromMidY}
                  x2={toStartX - 2}
                  y2={toMidY}
                  stroke="var(--color-text-placeholder)"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  markerEnd="url(#dag-arrow)"
                />,
              );
            }
          }
          return <g key={`arrows-${wave.number}`}>{arrows}</g>;
        })}

        {/* Wave column nodes */}
        {sorted.map((wave) =>
          wave.nodes.map((node) => {
            const pos = positions.get(node.id)!;
            const color = PIPELINE_STATUS_COLORS[node.status];
            return (
              <g key={node.id}>
                {/* Node background */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={DAG.nodeW}
                  height={DAG.nodeH}
                  rx={6}
                  fill="var(--color-bg-hover)"
                  stroke={color}
                  strokeWidth={node.status === 'in_progress' ? 1.5 : 0.5}
                  strokeOpacity={node.status === 'in_progress' ? 1 : 0.4}
                />

                {/* Status dot */}
                <circle
                  cx={pos.x + 10}
                  cy={pos.y + DAG.nodeH / 2}
                  r={3}
                  fill={color}
                />

                {/* Node label */}
                <text
                  x={pos.x + 18}
                  y={pos.y + DAG.nodeH / 2}
                  dominantBaseline="central"
                  fill="var(--color-text-primary)"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="inherit"
                >
                  {truncateLabel(node.name, 10)}
                </text>
              </g>
            );
          }),
        )}

        {/* Wave labels */}
        {sorted.map((wave, waveIdx) => (
          <text
            key={`wave-label-${wave.number}`}
            x={waveXPositions[waveIdx] + DAG.nodeW / 2}
            y={svgH - 1}
            textAnchor="middle"
            fill="var(--color-text-placeholder)"
            fontSize="8"
            fontWeight="600"
          >
            W{wave.number}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Truncate label to fit in node box */
function truncateLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 text-center p-1.5 bg-bg-hover rounded-lg">
      <div className="text-[16px] font-bold text-text-primary">{value}</div>
      <div className="text-[9px] font-semibold uppercase text-text-tertiary">{label}</div>
    </div>
  );
}

function PipelineNodeBadge({ node }: { node: PipelineNode }) {
  const color = PIPELINE_STATUS_COLORS[node.status];
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border text-[10px] mb-1 hover:border-accent-blue transition-colors">
      <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: color }} />
      <span className="font-semibold text-text-primary">{node.name}</span>
    </div>
  );
}

function RoleRow({ role }: { role: TeamRole }) {
  const statusColor = ROLE_STATUS_COLORS[role.status];
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border-divider last:border-0">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: statusColor }}
      >
        {role.prefix || role.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-text-primary truncate">{role.name}</div>
        <div className="text-[10px] text-text-tertiary">
          {role.taskCount} task{role.taskCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <span
          className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: `${statusColor}18`, color: statusColor }}
        >
          {role.status}
        </span>
        {role.injected && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-[#8B6BBF18] text-[#8B6BBF]">
            injected
          </span>
        )}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: TeamMessage }) {
  const typeColors: Record<string, string> = {
    message: '#4A90D9',
    state_update: '#3D9B6F',
    task_complete: '#5A9E78',
    error: '#D05454',
    broadcast: '#8B6BBF',
    shutdown: '#A09D97',
  };
  const typeColor = typeColors[message.type] ?? '#A09D97';

  return (
    <div className="flex gap-2 py-1.5 border-b border-border-divider last:border-0 text-[11px] items-start">
      <div
        className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[10px] shrink-0 mt-0.5"
        style={{ background: `${typeColor}18`, color: typeColor }}
      >
        {message.from.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-text-primary">{message.from}</span>
          <span
            className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${typeColor}18`, color: typeColor }}
          >
            {message.type}
          </span>
          <span className="text-[9px] font-mono text-text-placeholder ml-auto">
            {message.ts.substring(11, 19)}
          </span>
        </div>
        <div className="text-[11px] text-text-secondary truncate mt-0.5">{message.summary}</div>
      </div>
    </div>
  );
}
