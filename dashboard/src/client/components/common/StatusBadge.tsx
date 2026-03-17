import type { PhaseStatus } from '@/shared/types.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import { useI18n } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// StatusBadge — shape + color + text triple-encoding for accessibility
// ---------------------------------------------------------------------------

/** Shape per status for non-color differentiation (per spec) */
const STATUS_SHAPES: Record<PhaseStatus, string> = {
  pending: 'rounded-full',        // circle
  exploring: 'rounded-full',      // circle
  planning: 'rotate-45 rounded-none', // diamond
  executing: 'rounded-full',      // circle (pulsing)
  verifying: 'rotate-45 rounded-none', // diamond
  testing: 'rounded-full',        // circle
  completed: 'rounded-full',      // circle
  blocked: 'rounded-[var(--radius-sm)]', // square
};

/** Translation keys for each status */
const STATUS_LABEL_KEYS: Record<PhaseStatus, string> = {
  pending: 'status.pending',
  exploring: 'status.exploring',
  planning: 'status.planning',
  executing: 'status.executing',
  verifying: 'status.verifying',
  testing: 'status.testing',
  completed: 'status.completed',
  blocked: 'status.blocked',
};

/** Status background token CSS variable names */
const STATUS_BG_VARS: Record<PhaseStatus, string> = {
  pending: 'var(--color-status-bg-pending)',
  exploring: 'var(--color-status-bg-exploring)',
  planning: 'var(--color-status-bg-planning)',
  executing: 'var(--color-status-bg-executing)',
  verifying: 'var(--color-status-bg-verifying)',
  testing: 'var(--color-status-bg-testing)',
  completed: 'var(--color-status-bg-completed)',
  blocked: 'var(--color-status-bg-blocked)',
};

interface StatusBadgeProps {
  status: PhaseStatus;
  /** Show text label next to the dot (default: true) */
  showLabel?: boolean;
  /** Compact mode — smaller dot, no label */
  compact?: boolean;
  /** Card context: full-capsule pill with frosted white bg instead of status-bg token */
  cardVariant?: boolean;
}

export function StatusBadge({ status, showLabel = true, compact = false, cardVariant }: StatusBadgeProps) {
  const { t } = useI18n();
  const color = STATUS_COLORS[status];
  const shape = STATUS_SHAPES[status];
  const labelKey = STATUS_LABEL_KEYS[status];
  const label = t(labelKey);
  const bgVar = STATUS_BG_VARS[status];
  const isExecuting = status === 'executing';
  const dotSize = compact ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={[
        'inline-flex items-center gap-[var(--spacing-1-5)]',
        cardVariant ? 'rounded-full' : 'rounded-[var(--radius-sm)]',
        !compact ? (cardVariant ? 'px-[var(--spacing-2)] py-[var(--spacing-0-5)]' : 'px-[var(--spacing-1-5)] py-[var(--spacing-0-5)]') : '',
      ].join(' ')}
      style={!compact ? { backgroundColor: bgVar } : undefined}
      role="status"
      aria-label={`Status: ${label}`}
    >
      <span className="relative inline-flex" aria-hidden="true">
        <span
          className={`inline-block ${dotSize} ${shape}`}
          style={{ backgroundColor: color }}
        />
        {isExecuting && (
          <span
            className={`absolute inset-0 inline-block ${dotSize} rounded-full animate-ping opacity-40 motion-reduce:hidden`}
            style={{ backgroundColor: color }}
          />
        )}
      </span>
      {showLabel && !compact && (
        <span
          className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] leading-[var(--line-height-tight)] capitalize"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
