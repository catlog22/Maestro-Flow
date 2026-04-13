import { useCollabStore } from '@/client/store/collab-store.js';
import type { CollabAggregatedActivity } from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// ConflictHeatmap — card-based activity concentration & risk analysis
// ---------------------------------------------------------------------------

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high: { label: 'High', color: '#dc2626', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  medium: { label: 'Medium', color: '#ca8a04', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
  low: { label: 'Low', color: '#16a34a', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
  none: { label: 'None', color: 'var(--color-text-tertiary, #9ca3af)', bg: 'var(--color-bg-secondary)', border: 'var(--color-border)' },
};

function getRiskConfig(risk: string) {
  return RISK_CONFIG[risk] ?? RISK_CONFIG.none;
}

export function ConflictHeatmap() {
  const aggregated = useCollabStore((s) => s.aggregated);
  const members = useCollabStore((s) => s.members);
  const loading = useCollabStore((s) => s.loading);

  // Loading state
  if (loading && aggregated.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-[length:var(--font-size-sm)]">
        <svg className="animate-spin h-5 w-5 mr-2 text-text-secondary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading analysis data...
      </div>
    );
  }

  // Empty state
  if (aggregated.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-quaternary">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <span className="text-text-tertiary text-[length:var(--font-size-sm)]">No activity data available for analysis</span>
        <span className="text-text-quaternary text-[length:var(--font-size-xs)]">Activity will appear here as team members work on phases and tasks</span>
      </div>
    );
  }

  // Summary stats
  const totalActivity = aggregated.reduce((sum, a) => sum + a.count, 0);
  const uniqueMembers = new Set(aggregated.flatMap((a) => a.members)).size;
  const highRisk = aggregated.filter((a) => a.risk === 'high').length;
  const mediumRisk = aggregated.filter((a) => a.risk === 'medium').length;

  // Sort: high risk first, then by count
  const sorted = [...aggregated].sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2, none: 3 };
    const ra = riskOrder[a.risk] ?? 3;
    const rb = riskOrder[b.risk] ?? 3;
    if (ra !== rb) return ra - rb;
    return b.count - a.count;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Total Activity" value={totalActivity} />
        <SummaryCard label="Active Members" value={uniqueMembers} total={members.length} />
        <SummaryCard label="High Risk" value={highRisk} color={highRisk > 0 ? '#dc2626' : undefined} />
        <SummaryCard label="Medium Risk" value={mediumRisk} color={mediumRisk > 0 ? '#ca8a04' : undefined} />
      </div>

      {/* Risk legend */}
      <div className="flex items-center gap-4 text-[length:var(--font-size-xs)] text-text-tertiary">
        <span>Risk levels:</span>
        {['none', 'low', 'medium', 'high'].map((risk) => {
          const cfg = getRiskConfig(risk);
          return (
            <div key={risk} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color, opacity: 0.7 }} />
              <span>{cfg.label}</span>
              <span className="text-text-quaternary">
                ({risk === 'none' ? '1' : risk === 'low' ? '2' : risk === 'medium' ? '3' : '4+'}
                {risk === 'none' ? ' member' : ' members'})
              </span>
            </div>
          );
        })}
      </div>

      {/* Activity concentration cards */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[length:var(--font-size-xs)] font-semibold text-text-secondary uppercase tracking-wider">
          Activity Concentration
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {sorted.map((entry, i) => (
            <ConcentrationCard key={`${entry.phase}::${entry.task}::${i}`} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, total, color }: { label: string; value: number; total?: number; color?: string }) {
  return (
    <div className="rounded-[var(--radius-md,6px)] border border-border bg-bg-secondary px-4 py-3">
      <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[length:var(--font-size-xl)] font-bold" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {value}
        {total != null && (
          <span className="text-[length:var(--font-size-sm)] font-normal text-text-quaternary"> / {total}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConcentrationCard — single activity concentration entry
// ---------------------------------------------------------------------------

function ConcentrationCard({ entry }: { entry: CollabAggregatedActivity }) {
  const cfg = getRiskConfig(entry.risk);
  const phaseLabel = entry.phase || '(no phase)';
  const taskLabel = entry.task || '(general)';

  return (
    <div
      className="flex items-center gap-4 rounded-[var(--radius-md,6px)] px-4 py-3 border transition-colors"
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
    >
      {/* Risk indicator */}
      <div className="flex flex-col items-center gap-1 shrink-0 w-[52px]">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Phase/Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[length:var(--font-size-sm)] font-medium text-text-primary truncate">
            {phaseLabel}
          </span>
          {entry.task && (
            <>
              <span className="text-text-quaternary">/</span>
              <span className="text-[length:var(--font-size-sm)] text-text-secondary truncate">
                {taskLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Activity count */}
      <div className="flex flex-col items-center shrink-0">
        <span className="text-[length:var(--font-size-sm)] font-bold text-text-primary">{entry.count}</span>
        <span className="text-[10px] text-text-tertiary">actions</span>
      </div>

      {/* Members */}
      <div className="flex items-center gap-1 shrink-0">
        {entry.members.slice(0, 5).map((name) => (
          <span
            key={name}
            className="w-6 h-6 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[10px] font-medium text-text-secondary uppercase"
            title={name}
          >
            {name.charAt(0)}
          </span>
        ))}
        {entry.members.length > 5 && (
          <span className="text-[10px] text-text-tertiary">+{entry.members.length - 5}</span>
        )}
      </div>
    </div>
  );
}
