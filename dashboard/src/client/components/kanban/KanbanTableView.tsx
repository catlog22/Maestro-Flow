import { LINEAR_PRIORITY_LABELS } from '@/shared/linear-types.js';
import type { Issue } from '@/shared/issue-types.js';
import type { LinearIssue } from '@/shared/linear-types.js';
import type { SelectedKanbanItem } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// KanbanTableView — flat table layout for phases + issues
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

const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  registered: 'Registered',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  deferred: 'Deferred',
};

const TH = 'text-left px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-wide';

interface KanbanTableViewProps {
  localIssues?: Issue[];
  linearIssues?: LinearIssue[];
  selectedItem?: SelectedKanbanItem | null;
  onSelectItem?: (item: SelectedKanbanItem) => void;
}

export function KanbanTableView({ localIssues, linearIssues, selectedItem, onSelectItem }: KanbanTableViewProps) {
  const hasIssues = (localIssues?.length ?? 0) > 0;
  const hasLinear = (linearIssues?.length ?? 0) > 0;

  if (!hasIssues && !hasLinear) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)] h-full overflow-auto p-[var(--spacing-3)]">

      {/* Local issues table */}
      {hasIssues && (
        <section>
          <SectionHeader label="Issues" count={localIssues!.length} />
          <div className="rounded-[var(--radius-lg)] overflow-hidden border border-border-divider">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-secondary">
                  <th className={`${TH} w-[80px]`}>Type</th>
                  <th className={TH}>Title</th>
                  <th className={`${TH} w-[90px]`}>Priority</th>
                  <th className={`${TH} w-[100px]`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {localIssues!.map((issue, i) => {
                  const typeColor = TYPE_COLORS[issue.type] ?? '#A09D97';
                  const priorityColor = PRIORITY_COLORS[issue.priority] ?? '#A09D97';
                  const isSelected = selectedItem?.type === 'issue' && (selectedItem as { issue: Issue }).issue.id === issue.id;
                  return (
                    <tr
                      key={issue.id}
                      onClick={() => onSelectItem?.({ type: 'issue', issue })}
                      className={rowCls(i, isSelected)}
                    >
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)]">
                        <Badge label={issue.type} color={typeColor} />
                      </td>
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary">
                        {issue.title}
                      </td>
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)]">
                        <Badge label={issue.priority} color={priorityColor} />
                      </td>
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-xs)] text-text-secondary whitespace-nowrap">
                        {ISSUE_STATUS_LABELS[issue.status] ?? issue.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Linear issues table */}
      {hasLinear && (
        <section>
          <SectionHeader label="Linear" count={linearIssues!.length} />
          <div className="rounded-[var(--radius-lg)] overflow-hidden border border-border-divider">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-secondary">
                  <th className={`${TH} w-[80px]`}>ID</th>
                  <th className={TH}>Title</th>
                  <th className={`${TH} w-[110px]`}>State</th>
                  <th className={`${TH} w-[90px]`}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {linearIssues!.map((issue, i) => {
                  const isSelected = selectedItem?.type === 'linearIssue' && (selectedItem as { issue: LinearIssue }).issue.id === issue.id;
                  return (
                    <tr
                      key={issue.id}
                      onClick={() => onSelectItem?.({ type: 'linearIssue', issue })}
                      className={rowCls(i, isSelected)}
                    >
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-xs)] font-mono text-text-tertiary">
                        {issue.identifier}
                      </td>
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary">
                        {issue.title}
                      </td>
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-xs)] text-text-secondary">
                        {issue.state.name}
                      </td>
                      <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-xs)] text-text-secondary">
                        {LINEAR_PRIORITY_LABELS[issue.priority]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small internal helpers
// ---------------------------------------------------------------------------

function rowCls(i: number, selected: boolean): string {
  return [
    'cursor-pointer transition-colors border-t border-border-divider',
    selected
      ? 'bg-[rgba(90,130,200,0.08)]'
      : i % 2 === 0
        ? 'bg-bg-primary hover:bg-bg-hover'
        : 'bg-[rgba(0,0,0,0.015)] hover:bg-bg-hover',
  ].join(' ');
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
      <h3 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] uppercase tracking-wider text-text-tertiary">
        {label}
      </h3>
      <span className="text-[length:var(--font-size-xs)] text-text-tertiary bg-bg-secondary rounded-full px-[var(--spacing-1-5)] tabular-nums">
        {count}
      </span>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] px-2 py-[var(--spacing-0-5)] rounded-full whitespace-nowrap"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}
