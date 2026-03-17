import { useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useBoardStore } from '@/client/store/board-store.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import type { PhaseCard } from '@/shared/types.js';
import type { AgentProcess, AgentType } from '@/shared/agent-types.js';
import { useI18n } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// DockRail — 48px icon strip with floating panel (hover to reveal)
// ---------------------------------------------------------------------------

const EMPTY_PHASES: PhaseCard[] = [];

interface DockNavItem {
  labelKey: string;
  tooltipKey: string;
  path: string;
  icon: 'kanban' | 'artifacts' | 'chat' | 'workflow' | 'mcp' | 'specs';
  shortcut?: string;
}

const NAV_ITEMS: DockNavItem[] = [
  { labelKey: 'nav.kanban', tooltipKey: 'dock.kanban_tooltip', path: '/kanban', icon: 'kanban', shortcut: 'K' },
  { labelKey: 'nav.artifacts', tooltipKey: 'dock.artifacts_tooltip', path: '/artifacts', icon: 'artifacts', shortcut: 'A' },
  { labelKey: 'nav.chat', tooltipKey: 'dock.chat_tooltip', path: '/chat', icon: 'chat', shortcut: 'C' },
  { labelKey: 'nav.workflow', tooltipKey: 'dock.workflow_tooltip', path: '/workflow', icon: 'workflow', shortcut: 'W' },
  { labelKey: 'nav.mcp', tooltipKey: 'dock.mcp_tooltip', path: '/mcp', icon: 'mcp', shortcut: 'M' },
  { labelKey: 'nav.specs', tooltipKey: 'dock.specs_tooltip', path: '/specs', icon: 'specs', shortcut: 'S' },
];

// Agent type → dot color mapping (matches design)
const AGENT_DOT_COLORS: Record<AgentType, string> = {
  'claude-code': 'var(--color-accent-purple)',
  'codex': 'var(--color-accent-green)',
  'gemini': 'var(--color-accent-blue)',
  'qwen': 'var(--color-accent-orange)',
  'opencode': 'var(--color-text-tertiary)',
};

// ---------------------------------------------------------------------------
// DockRail — public component
// ---------------------------------------------------------------------------

export interface DockRailProps {
  isPinned: boolean;
  onTogglePin: () => void;
}

export function DockRail({ isPinned, onTogglePin }: DockRailProps) {
  const { t } = useI18n();
  const phases = useBoardStore((s) => s.board?.phases ?? EMPTY_PHASES);
  const processes = useAgentStore((s) => s.processes);
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const selectedPhase = useBoardStore((s) => s.selectedPhase);
  const setSelectedPhase = useBoardStore((s) => s.setSelectedPhase);
  const navigate = useNavigate();
  const location = useLocation();

  const railRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const processList = Object.values(processes);

  // Open panel on rail hover (if not pinned)
  const handleRailEnter = useCallback(() => {
    if (!isPinned) panelRef.current?.classList.add('dock-panel-open');
  }, [isPinned]);

  // Close panel when leaving rail — unless mouse moved to panel
  const handleRailLeave = useCallback((e: React.MouseEvent) => {
    if (!isPinned && !panelRef.current?.contains(e.relatedTarget as Node)) {
      panelRef.current?.classList.remove('dock-panel-open');
    }
  }, [isPinned]);

  // Close panel when leaving panel — unless mouse moved to rail
  const handlePanelLeave = useCallback((e: React.MouseEvent) => {
    if (!isPinned && !railRef.current?.contains(e.relatedTarget as Node)) {
      panelRef.current?.classList.remove('dock-panel-open');
    }
  }, [isPinned]);

  // Nav button click: navigate only, close panel
  const handleNavClick = useCallback((path: string) => {
    navigate(path);
    panelRef.current?.classList.remove('dock-panel-open');
  }, [navigate]);

  return (
    <div className="relative flex">
      {/* Icon rail — always visible */}
      <nav
        ref={railRef}
        role="navigation"
        aria-label={t('nav.views')}
        className="w-[var(--size-rail-width)] bg-bg-secondary border-r border-border flex-shrink-0 flex flex-col items-center pt-2 gap-0.5 z-50"
        onMouseEnter={handleRailEnter}
        onMouseLeave={handleRailLeave}
      >
        {/* View buttons */}
        {NAV_ITEMS.map((item) => (
          <RailButton
            key={item.path}
            item={item}
            isActive={location.pathname.startsWith(item.path)}
            onActivate={() => handleNavClick(item.path)}
            t={t}
          />
        ))}

        {/* Separator */}
        <div className="w-6 h-px bg-border-divider my-1.5" aria-hidden="true" />

        {/* Session dots (agent processes) */}
        <div
          className="flex flex-col items-center gap-1.5 py-1"
          role="list"
          aria-label={t('dock.phases_label')}
        >
          {processList.length > 0
            ? processList.map((proc) => (
                <SessionDot
                  key={proc.id}
                  process={proc}
                  isActive={proc.id === activeProcessId}
                />
              ))
            : phases.map((phase) => (
                <PhaseDot key={phase.phase} phase={phase} t={t} />
              ))
          }
        </div>

        {/* Sidebar toggle — pushed to bottom */}
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={t('dock.toggle_sidebar')}
          className={[
            'mt-auto mb-2 flex items-center justify-center w-9 h-9 rounded-[6px]',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            isPinned
              ? 'text-text-primary bg-bg-active'
              : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary',
          ].join(' ')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </nav>

      {/* Floating panel */}
      <aside
        ref={panelRef}
        aria-label={t('dock.views_label')}
        className={[
          'dock-floating-panel',
          'absolute left-[var(--size-rail-width)] top-0 bottom-0',
          'w-[calc(var(--size-panel-width)-var(--size-rail-width))]',
          'bg-bg-secondary border-r border-border overflow-y-auto z-40',
          'shadow-[4px_0_16px_rgba(0,0,0,0.06)]',
          'transition-[transform,opacity] duration-[200ms] ease-[var(--ease-spring)]',
          '-translate-x-full opacity-0 pointer-events-none',
          isPinned ? 'dock-panel-open' : '',
        ].join(' ')}
        onMouseLeave={handlePanelLeave}
      >
        {/* Views section */}
        <div className="px-2 py-2.5 border-b border-border-divider">
          <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)] px-2 mb-1">
            {t('dock.views_label')}
          </h2>
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <PanelNavItem key={item.path} item={item} t={t} />
            ))}
          </nav>
        </div>

        {/* Sessions section (if agents exist) */}
        {processList.length > 0 && (
          <div className="px-2 py-2.5 border-b border-border-divider">
            <div className="flex items-center justify-between px-2 mb-1">
              <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)]">
                Sessions
              </h2>
              <button
                type="button"
                className="w-[18px] h-[18px] rounded flex items-center justify-center border-none bg-transparent cursor-pointer transition-all duration-100"
                style={{ color: 'var(--color-text-placeholder)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-placeholder)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                aria-label="New session"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {processList.map((proc) => (
                <SessionItem
                  key={proc.id}
                  process={proc}
                  isActive={proc.id === activeProcessId}
                />
              ))}
            </nav>
          </div>
        )}

        {/* Phases section */}
        <div className="px-2 py-2.5">
          <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)] px-2 mb-1">
            {t('dock.phases_label')}
          </h2>
          <nav className="flex flex-col gap-0.5" aria-label="Project phases">
            {phases.map((phase) => (
              <PhaseItem
                key={phase.phase}
                phase={phase}
                selected={selectedPhase === phase.phase}
                onSelect={() =>
                  setSelectedPhase(selectedPhase === phase.phase ? null : phase.phase)
                }
              />
            ))}
            {phases.length === 0 && (
              <p className="text-[length:var(--font-size-xs)] text-text-secondary italic px-2">
                {t('sidebar.no_phases_loaded')}
              </p>
            )}
          </nav>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RailButton — icon button in the 48px rail (with tooltip)
// ---------------------------------------------------------------------------

function RailButton({
  item,
  isActive,
  onActivate,
  t,
}: {
  item: DockNavItem;
  isActive: boolean;
  onActivate: () => void;
  t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={t(item.tooltipKey)}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'group relative flex items-center justify-center w-9 h-9 rounded-[8px]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        isActive
          ? 'bg-bg-active text-text-primary'
          : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary',
      ].join(' ')}
    >
      <NavIcon icon={item.icon} />
      {/* Tooltip */}
      <span className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-text-primary text-[11px] font-medium text-white px-2 py-0.5 rounded-[6px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-[200]">
        {t(item.tooltipKey)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// NavIcon — inline SVG icons
// ---------------------------------------------------------------------------

function NavIcon({ icon }: { icon: DockNavItem['icon'] }) {
  const shared = {
    className: 'w-[18px] h-[18px]',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (icon) {
    case 'kanban':
      return (
        <svg {...shared}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'artifacts':
      return (
        <svg {...shared}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...shared}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'workflow':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'mcp':
      return (
        <svg {...shared}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case 'specs':
      return (
        <svg {...shared}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// SessionDot — 8px colored dot with ping animation for active sessions
// ---------------------------------------------------------------------------

function SessionDot({
  process,
  isActive,
}: {
  process: AgentProcess;
  isActive: boolean;
}) {
  const color = AGENT_DOT_COLORS[process.type] ?? 'var(--color-text-tertiary)';
  const isRunning = process.status === 'running' || process.status === 'spawning';

  return (
    <span
      role="listitem"
      title={`${process.type} — ${process.status}`}
      className={[
        'relative w-2 h-2 rounded-full cursor-pointer transition-transform duration-150 hover:scale-[1.4]',
        isActive ? 'ring-2 ring-offset-2 ring-offset-bg-secondary' : '',
      ].join(' ')}
      style={{
        backgroundColor: isRunning ? color : 'var(--color-text-placeholder)',
        color,
        ...(isActive ? { boxShadow: `0 0 0 2px var(--color-bg-secondary), 0 0 0 3.5px ${color}` } : {}),
      }}
    >
      {isRunning && (
        <span
          className="absolute inset-[-2px] rounded-full animate-[sdot-ping_2s_ease_infinite]"
          style={{ background: color, opacity: 0.4 }}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PhaseDot — 8px colored dot in the rail (fallback when no sessions)
// ---------------------------------------------------------------------------

function PhaseDot({
  phase,
  t,
}: {
  phase: PhaseCard;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <span
      role="listitem"
      aria-label={t('dock.phase_dot_aria', {
        phase: phase.phase,
        title: phase.title,
        status: phase.status,
      })}
      className="w-2 h-2 rounded-full cursor-pointer transition-transform duration-150 hover:scale-[1.4]"
      style={{ backgroundColor: STATUS_COLORS[phase.status] }}
    />
  );
}

// ---------------------------------------------------------------------------
// SessionItem — session row in the floating panel
// ---------------------------------------------------------------------------

function SessionItem({
  process,
  isActive,
}: {
  process: AgentProcess;
  isActive: boolean;
}) {
  const color = AGENT_DOT_COLORS[process.type] ?? 'var(--color-text-tertiary)';
  const setActive = useAgentStore((s) => s.setActiveProcessId);
  const elapsed = getElapsed(process.startedAt);

  return (
    <button
      type="button"
      onClick={() => setActive(process.id)}
      className={[
        'flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-left text-[12px] w-full',
        'transition-all duration-150',
        isActive
          ? 'bg-bg-active'
          : 'hover:bg-bg-hover',
      ].join(' ')}
    >
      <span
        className="w-[7px] h-[7px] rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 font-medium text-text-primary truncate">
        {process.type}
      </span>
      <span className="text-[10px] text-text-placeholder shrink-0">
        {elapsed}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// PanelNavItem — text nav link in the floating panel
// ---------------------------------------------------------------------------

const BASE_PANEL_NAV = [
  'flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-default)]',
  'text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] w-full',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
].join(' ');

function PanelNavItem({
  item,
  t,
}: {
  item: DockNavItem;
  t: (key: string) => string;
}) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `${BASE_PANEL_NAV} ${
          isActive
            ? 'bg-bg-active text-text-primary font-semibold'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`
      }
    >
      <span className="truncate">{t(item.labelKey)}</span>
      {item.shortcut && (
        <span className="ml-auto text-[10px] text-text-placeholder">{item.shortcut}</span>
      )}
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// PhaseItem — phase row in the floating panel
// ---------------------------------------------------------------------------

function PhaseItem({
  phase,
  selected,
  onSelect,
}: {
  phase: PhaseCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const dotColor = STATUS_COLORS[phase.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={[
        'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1-5)] rounded-[var(--radius-default)] text-left text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] w-full',
        'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'disabled:opacity-[var(--opacity-disabled)] disabled:pointer-events-none',
        selected
          ? 'bg-bg-active text-text-primary border-l-2 border-l-accent-blue'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
      ].join(' ')}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        aria-hidden="true"
        style={{ backgroundColor: dotColor }}
      />
      <span className="truncate">
        {phase.phase}. {phase.title}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElapsed(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}
