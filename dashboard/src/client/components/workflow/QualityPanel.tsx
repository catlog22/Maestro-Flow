import { useBoardStore } from '@/client/store/board-store.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import CircleCheckIcon from 'lucide-react/dist/esm/icons/circle-check.js';
import CheckIcon from 'lucide-react/dist/esm/icons/check.js';
import AlertCircleIcon from 'lucide-react/dist/esm/icons/circle-alert.js';

// ---------------------------------------------------------------------------
// QualityPanel -- metrics grid, verification rows, issues, coverage
// ---------------------------------------------------------------------------

export function QualityPanel() {
  const board = useBoardStore((s) => s.board);
  const phases = board?.phases ?? [];

  const tasksComplete = phases.reduce((s, p) => s + p.execution.tasks_completed, 0);
  const tasksTotal = phases.reduce((s, p) => s + p.execution.tasks_total, 0);
  const phasesComplete = phases.filter((p) => p.status === 'completed').length;
  const phasesTotal = phases.length;
  const totalCommits = phases.reduce((s, p) => s + p.execution.commits.length, 0);

  // Gather verification data from phases in verifying/testing
  const verifyingPhases = phases.filter((p) => p.status === 'verifying' || p.status === 'testing');
  const allGaps = phases.flatMap((p) => p.verification.gaps.map((g) => ({ phase: p.phase, text: g })));

  return (
    <div className="flex flex-col overflow-hidden border-b border-border-divider">
      {/* Header */}
      <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-4)] py-[var(--spacing-2-5)] border-b border-border-divider shrink-0">
        <CircleCheckIcon size={14} strokeWidth={2} className="text-text-tertiary" />
        <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] uppercase tracking-wider text-text-tertiary">
          Quality
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-[var(--spacing-4)] py-[var(--spacing-3)]">
        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-[var(--spacing-2)] mb-[var(--spacing-3-5)]">
          <MetricCard label="Tasks" value={tasksComplete} sub={`/${tasksTotal}`} detail={`${tasksTotal > 0 ? Math.round((tasksComplete / tasksTotal) * 100) : 0}% complete`} />
          <MetricCard label="Phases" value={phasesComplete} sub={`/${phasesTotal}`} detail={`${phasesTotal > 0 ? Math.round((phasesComplete / phasesTotal) * 100) : 0}% complete`} />
          <MetricCard label="Gaps" value={allGaps.length} color={allGaps.length > 0 ? STATUS_COLORS.blocked : undefined} detail="active" />
          <MetricCard label="Commits" value={totalCommits} detail="this milestone" />
        </div>

        {/* Verification section */}
        {verifyingPhases.length > 0 && (
          <div className="mb-[var(--spacing-3-5)]">
            {verifyingPhases.map((p) => (
              <div key={p.phase} className="mb-[var(--spacing-3)]">
                <div className="flex items-center gap-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary mb-[var(--spacing-1-5)]">
                  <CircleCheckIcon size={12} strokeWidth={2} style={{ color: STATUS_COLORS[p.status] }} />
                  Verification (P-{String(p.phase).padStart(2, '0')})
                </div>
                {p.verification.must_haves.map((item, i) => {
                  const isGap = p.verification.gaps.includes(item);
                  return (
                    <div key={i} className="flex items-center gap-[var(--spacing-1-5)] py-1 border-b border-border-divider text-[length:var(--font-size-sm)]">
                      {isGap ? (
                        <AlertCircleIcon size={12} strokeWidth={2.5} style={{ color: STATUS_COLORS.blocked }} />
                      ) : (
                        <CheckIcon size={12} strokeWidth={2.5} style={{ color: STATUS_COLORS.completed }} />
                      )}
                      <span className="flex-1 text-text-secondary">{item}</span>
                      <span
                        className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)]"
                        style={{ color: isGap ? STATUS_COLORS.blocked : STATUS_COLORS.completed }}
                      >
                        {isGap ? 'Gap' : 'Verified'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Test coverage (from validation data) */}
        {phases.some((p) => p.validation.test_coverage !== null) && (
          <div>
            <div className="flex items-center gap-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary mb-[var(--spacing-1-5)]">
              Test Coverage
            </div>
            {phases
              .filter((p) => p.validation.test_coverage !== null)
              .map((p) => {
                const cov = p.validation.test_coverage!;
                const covColor = cov >= 80 ? STATUS_COLORS.completed : cov >= 60 ? STATUS_COLORS.executing : STATUS_COLORS.verifying;
                return (
                  <div key={p.phase} className="flex items-center gap-[var(--spacing-2)] text-[length:var(--font-size-xs)] mb-1">
                    <span className="w-[70px] text-text-tertiary font-[var(--font-weight-medium)]">P-{String(p.phase).padStart(2, '0')}</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cov}%`, backgroundColor: covColor }} />
                    </div>
                    <span className="w-9 text-right font-mono font-[var(--font-weight-semibold)] text-text-secondary">{cov.toFixed(1)}%</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, detail, color }: { label: string; value: number; sub?: string; detail: string; color?: string }) {
  return (
    <div className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] rounded-[10px] bg-bg-primary border border-border-divider">
      <div className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] uppercase tracking-wide text-text-tertiary mb-1">
        {label}
      </div>
      <div className="text-[length:var(--font-size-xl)] font-bold text-text-primary" style={color ? { color } : undefined}>
        {value}
        {sub && <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-tertiary">{sub}</span>}
      </div>
      <div className="text-[length:var(--font-size-xs)] text-text-tertiary mt-0.5">{detail}</div>
    </div>
  );
}
