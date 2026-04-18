import type { ReactNode, MouseEvent } from 'react';

// ---------------------------------------------------------------------------
// StatusBarItem -- individual item in the status bar
// ---------------------------------------------------------------------------

export interface StatusBarItemProps {
  children: ReactNode;
  /** Tooltip text */
  tooltip?: string;
  /** Whether the item is clickable (shows hover highlight) */
  clickable?: boolean;
  /** Click handler */
  onClick?: (e: MouseEvent) => void;
}

export function StatusBarItem({ children, tooltip, clickable = false, onClick }: StatusBarItemProps) {
  const interactive = clickable && onClick;
  const className = [
    'flex items-center gap-[var(--spacing-1)]',
    'h-full px-[var(--spacing-1-5)]',
    'text-[11px] font-medium leading-none whitespace-nowrap',
    interactive
      ? 'cursor-pointer hover:bg-bg-hover transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]'
      : 'cursor-default',
  ].join(' ');

  return (
    <span
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={tooltip}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as MouseEvent); } } : undefined}
      className={className}
    >
      {children}
    </span>
  );
}
