import { type ComponentType, useState, useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// ActivityBarItem -- individual icon button in the Activity Bar
// ---------------------------------------------------------------------------
// Features:
// - 36x36 hit area with centered 20px icon
// - 2px left indicator bar for active state (VS Code standard)
// - Badge count display (top-right corner)
// - Hover tooltip (positioned to the right)
// ---------------------------------------------------------------------------

export interface ActivityBarItemProps {
  /** Unique panel identifier */
  id: string;
  /** Lucide icon component */
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Display label for tooltip */
  label: string;
  /** Whether this item is the currently active panel */
  isActive: boolean;
  /** Badge count (null = no badge, 0 = hidden) */
  badge: number | null;
  /** Click handler -- three-state toggle is handled by parent */
  onClick: () => void;
  /** Keyboard shortcut hint for tooltip */
  shortcut?: string;
}

export function ActivityBarItem({
  icon: Icon,
  label,
  isActive,
  badge,
  onClick,
  shortcut,
}: ActivityBarItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number }>({ top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show tooltip after 400ms hover delay (VS Code standard)
  const handleMouseEnter = useCallback(() => {
    tooltipTimerRef.current = setTimeout(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setTooltipPos({ top: rect.top + rect.height / 2 });
      }
      setShowTooltip(true);
    }, 400);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setShowTooltip(false);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className={[
        'group relative flex items-center justify-center',
        'w-[var(--size-activitybar-hit-area)] h-[var(--size-activitybar-hit-area)]',
        'rounded-[6px] transition-colors duration-[var(--duration-fast)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        isActive
          ? 'text-text-primary'
          : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
      ].join(' ')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left indicator bar -- 2px wide, accent blue */}
      {isActive && (
        <span
          className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-r-[1px]"
          style={{ backgroundColor: 'var(--color-accent-blue)' }}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <Icon
        size={20}
        strokeWidth={1.8}
        className="w-[var(--size-activitybar-icon-size)] h-[var(--size-activitybar-icon-size)]"
      />

      {/* Badge */}
      {badge != null && badge > 0 && (
        <span
          className="absolute top-[2px] right-[2px] min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[9px] font-semibold leading-none px-[3px]"
          style={{
            backgroundColor: 'var(--color-accent-blue)',
            color: '#FFFFFF',
          }}
          aria-hidden="true"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}

      {/* Tooltip -- positioned to the right */}
      {showTooltip && (
        <span
          className="fixed left-[calc(var(--size-activitybar-width)+8px)] z-[200] pointer-events-none"
          style={{ top: tooltipPos.top }}
          role="tooltip"
        >
          <span
            className="absolute left-0 -translate-y-1/2 bg-text-primary text-[11px] font-medium text-white px-2 py-0.5 rounded-[6px] whitespace-nowrap"
          >
            {label}
            {shortcut && (
              <span className="ml-2 text-[10px] opacity-60">{shortcut}</span>
            )}
          </span>
        </span>
      )}
    </button>
  );
}
