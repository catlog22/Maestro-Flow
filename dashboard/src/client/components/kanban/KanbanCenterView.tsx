import { useMemo } from 'react';
import { STATUS_COLORS } from '@/shared/constants.js';
import type { SelectedKanbanItem } from '@/shared/types.js';
import type { Issue } from '@/shared/issue-types.js';
import type { LinearIssue } from '@/shared/linear-types.js';
import InboxIcon from 'lucide-react/dist/esm/icons/inbox.js';
import CheckCircleIcon from 'lucide-react/dist/esm/icons/check-circle.js';

// ---------------------------------------------------------------------------
// KanbanCenterView — 2-panel issue dashboard
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  bug: '#C46555',
  feature: '#5B8DB8',
  improvement: '#9178B5',
  task: '#A09D97',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#C46555',
  high: '#B89540',
  medium: '#5B8DB8',
  low: '#A09D97',
};

interface KanbanCenterViewProps {
  localIssues?: Issue[];
  linearIssues?: LinearIssue[];
  selectedItem?: SelectedKanbanItem | null;
  onSelectItem?: (item: SelectedKanbanItem) => void;
}

export function KanbanCenterView({ localIssues, linearIssues, selectedItem, onSelectItem }: KanbanCenterViewProps) {
  const openIssues = useMemo(
    () => (localIssues ?? []).filter((i) => i.status === 'open' || i.status === 'in_progress'),
    [localIssues],
  );
  const closedIssues = useMemo(
    () => (localIssues ?? []).filter((i) => i.status === 'resolved' || i.status === 'closed'),
    [localIssues],
  );

  const totalIssues = (localIssues?.length ?? 0) + (linearIssues?.length ?? 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats strip */}
      <div className="flex items-center gap-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-2-5)] border-b border-border-divider shrink-0 bg-bg-secondary">
        <Stat label="Issues" value={totalIssues} sub={`${openIssues.length} open`} color={STATUS_COLORS.pending} />
        <div className="w-px h-6 bg-border-divider" />
        <Stat label="In Progress" value={(localIssues ?? []).filter((i) => i.status === 'in_progress').length} sub="active" color={STATUS_COLORS.executing} />
        <div className="w-px h-6 bg-border-divider" />
        <Stat label="Resolved" value={closedIssues.length} sub="done" color={STATUS_COLORS.completed} />
      </div>

      {/* 2-panel grid */}
      <div className="flex-1 grid grid-cols-[1fr_280px] overflow-hidden">

        {/* Panel 1: Issue Queue */}
        <div className="flex flex-col overflow-hidden border-r border-border-divider">
          <PanelHeader icon={<InboxIcon size={14} strokeWidth={2} />} label="Issue Queue">
            <span className="ml-auto text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] px-[var(--spacing-1-5)] py-px rounded-full bg-border-subtle text-text-secondary">
              {openIssues.length} open
            </span>
          </PanelHeader>
          <div className="flex-1 overflow-y-auto py-[var(--spacing-1)]">
            {openIssues.length === 0 ? (
              <EmptyState message="No open issues" />
            ) : (
              openIssues.map((issue) => {
                const typeColor = TYPE_COLORS[issue.type] ?? '#A09D97';
                const priorityColor = PRIORITY_COLORS[issue.priority] ?? '#A09D97';
                const isSelected = selectedItem?.type === 'issue' && (selectedItem as { issue: Issue }).issue.id === issue.id;
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => onSelectItem?.({ type: 'issue', issue })}
                    className={[
                      'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-4)] py-[var(--spacing-2)] w-full text-left transition-colors',
                      isSelected ? 'bg-[rgba(90,130,200,0.08)]' : 'hover:bg-bg-hover',
                    ].join(' ')}
                  >
                    <span
                      className="text-[length:9px] font-[var(--font-weight-semibold)] px-[6px] py-[2px] rounded-full shrink-0"
                      style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
                    >
                      {issue.type}
                    </span>
                    <span className="flex-1 text-[length:var(--font-size-xs)] text-text-primary line-clamp-1">
                      {issue.title}
                    </span>
                    <span
                      className="text-[length:9px] font-[var(--font-weight-semibold)] px-[6px] py-[2px] rounded-full shrink-0"
                      style={{ backgroundColor: `${priorityColor}20`, color: priorityColor }}
                    >
                      {issue.priority}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 2: Summary */}
        <div className="flex flex-col overflow-hidden">
          <PanelHeader icon={<CheckCircleIcon size={14} strokeWidth={2} />} label="Summary" />
          <div className="flex-1 overflow-y-auto px-[var(--spacing-4)] py-[var(--spacing-3)] flex flex-col gap-[var(--spacing-4)]">

            {/* Issue breakdown */}
            {(localIssues?.length ?? 0) > 0 && (
              <div>
                <span className="text-[length:10px] text-text-tertiary uppercase tracking-wider font-[var(--font-weight-semibold)]">
                  Issues
                </span>
                <div className="mt-[var(--spacing-2)] flex flex-col gap-[var(--spacing-1-5)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--font-size-xs)] text-text-secondary">Open</span>
                    <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-primary tabular-nums">{openIssues.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--font-size-xs)] text-text-secondary">In Progress</span>
                    <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-primary tabular-nums">{(localIssues ?? []).filter((i) => i.status === 'in_progress').length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--font-size-xs)] text-text-secondary">Resolved</span>
                    <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-primary tabular-nums">{closedIssues.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Linear issues */}
            {(linearIssues?.length ?? 0) > 0 && (
              <div>
                <span className="text-[length:10px] text-text-tertiary uppercase tracking-wider font-[var(--font-weight-semibold)]">
                  Linear
                </span>
                <div className="mt-[var(--spacing-2)]">
                  <span className="text-[length:var(--font-size-xs)] text-text-secondary">{linearIssues!.length} issues</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[length:var(--font-size-xs)] text-text-tertiary">{label}</span>
      <div className="flex items-baseline gap-[var(--spacing-1-5)]">
        <span className="text-[length:var(--font-size-base)] font-[var(--font-weight-semibold)]" style={{ color }}>
          {value}
        </span>
        <span className="text-[length:10px] text-text-tertiary">{sub}</span>
      </div>
    </div>
  );
}

function PanelHeader({ icon, label, children }: { icon: React.ReactNode; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-4)] py-[var(--spacing-2-5)] border-b border-border-divider shrink-0">
      <span className="text-text-tertiary">{icon}</span>
      <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-[length:var(--font-size-xs)] text-text-tertiary text-center py-[var(--spacing-6)] italic">
      {message}
    </div>
  );
}
