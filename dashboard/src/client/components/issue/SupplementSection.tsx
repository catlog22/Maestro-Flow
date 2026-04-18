import { useState, useCallback } from 'react';
import type { Issue, IssueSupplement, SupplementStage } from '@/shared/issue-types.js';
import { deriveSupplementStage } from '@/shared/issue-types.js';
import { useIssueStore } from '@/client/store/issue-store.js';

// ---------------------------------------------------------------------------
// SupplementSection — timeline of user-added context + inline add form
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<SupplementStage, string> = {
  post_creation: '创建后补充',
  analysis: '分析阶段补充',
  planning: '规划阶段补充',
  pre_execution: '执行前补充',
  execution: '执行阶段补充',
  resolution: '解决阶段补充',
  general: '通用补充',
};

const STAGE_COLORS: Record<SupplementStage, string> = {
  post_creation: '#A09D97',
  analysis: '#5B8DB8',
  planning: '#9178B5',
  pre_execution: '#B89540',
  execution: '#C8863A',
  resolution: '#5A9E78',
  general: '#6B6966',
};

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StageBadge({ stage }: { stage: SupplementStage }) {
  const color = STAGE_COLORS[stage] ?? '#6B6966';
  const label = STAGE_LABELS[stage] ?? stage;
  return (
    <span
      className="text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

function SupplementEntry({ entry }: { entry: IssueSupplement }) {
  const color = STAGE_COLORS[entry.stage] ?? '#6B6966';
  return (
    <div className="flex gap-2.5">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center pt-1.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 w-px mt-1" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <StageBadge stage={entry.stage} />
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {entry.author} · {formatRelative(entry.created_at)}
          </span>
        </div>
        <p
          className="leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
        >
          {entry.content}
        </p>
      </div>
    </div>
  );
}

interface Props {
  issue: Issue;
}

export function SupplementSection({ issue }: Props) {
  const addSupplement = useIssueStore((s) => s.addSupplement);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentStage = deriveSupplementStage(issue);
  const supplements = issue.supplements ?? [];

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    await addSupplement(issue.id, content.trim(), currentStage, 'user');
    setContent('');
    setSubmitting(false);
    setExpanded(false);
  }, [content, submitting, addSupplement, issue.id, currentStage]);

  return (
    <div className="space-y-2">
      {/* Existing supplements timeline */}
      {supplements.length > 0 && (
        <div>
          {supplements.map((entry, i) => (
            <SupplementEntry key={`${entry.created_at}-${i}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Add supplement toggle / form */}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-tertiary)',
            backgroundColor: 'transparent',
          }}
        >
          + Add supplement
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StageBadge stage={currentStage} />
            <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Current stage
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add context, reproduction steps, notes..."
            rows={3}
            className="w-full px-2.5 py-2 rounded-md border text-[length:var(--font-size-sm)] resize-y min-h-[72px] focus:outline-none focus:shadow-[var(--shadow-focus-ring)] transition-shadow"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
            }}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setExpanded(false); setContent(''); }}
              className="text-[11px] px-2.5 py-1 rounded-md transition-colors hover:opacity-80"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!content.trim() || submitting}
              onClick={handleSubmit}
              className="text-[11px] font-medium px-3 py-1 rounded-md transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent-blue)', color: 'white' }}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
