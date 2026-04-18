import type { ReactNode } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { useSettingsStore } from '@/client/store/settings-store.js';
import { WorkspaceSwitcher } from '@/client/components/common/WorkspaceSwitcher.js';

// ---------------------------------------------------------------------------
// TopBar -- 36px compact bar with three-zone slot layout
// Reads from BoardStore and SettingsStore only (stateless presentational)
// ---------------------------------------------------------------------------

export interface TopBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function TopBar({ left, center, right }: TopBarProps) {
  const board = useBoardStore((s) => s.board);
  const setSettingsOpen = useSettingsStore((s) => s.setOpen);

  const project = board?.project;

  return (
    <header
      role="banner"
      className="flex items-center justify-between px-[var(--size-topbar-h-padding)] h-[var(--size-topbar-height)] bg-bg-secondary border-b border-border shrink-0"
    >
      {/* Left zone: branding + workspace switcher (or slot override) */}
      {left ?? (
        <div className="flex items-center gap-[var(--size-topbar-gap)]">
          <span
            className="font-[800] text-[length:var(--font-size-base)] text-text-primary tracking-[-0.02em]"
            aria-hidden="true"
          >
            Maestro
          </span>

          <WorkspaceSwitcher />

          {project && (
            <>
              <span className="text-text-placeholder text-[length:var(--font-size-sm)]">&middot;</span>
              <span className="text-text-secondary text-[length:var(--font-size-sm)] truncate max-w-[200px]">
                {project.current_milestone || project.project_name}
              </span>
            </>
          )}
        </div>
      )}

      {/* Center zone: reserved slot (default empty) */}
      {center && (
        <div className="flex-1 flex justify-center">
          {center}
        </div>
      )}

      {/* Right zone: phase badge + settings (or slot override) */}
      {right ?? (
        <div className="flex items-center gap-[var(--size-topbar-gap)]">
          {/* Phase badge -- condensed "3/7" format */}
          {project && (
            <span
              className="text-[length:var(--font-size-xs)] text-text-secondary tabular-nums px-[var(--spacing-1-5)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)] bg-bg-tertiary"
              title={`${project.current_phase} / ${project.phases_summary.total}`}
            >
              {project.current_phase}/{project.phases_summary.total}
            </span>
          )}

          {/* Settings gear */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className={[
              'flex items-center justify-center rounded-[var(--radius-sm)]',
              'w-[var(--size-topbar-btn-size)] h-[var(--size-topbar-btn-size)]',
              'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
              'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            ].join(' ')}
          >
            <svg
              className="w-[var(--size-topbar-icon-size)] h-[var(--size-topbar-icon-size)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
