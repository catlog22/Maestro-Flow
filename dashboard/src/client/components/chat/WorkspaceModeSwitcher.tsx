import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { MessageSquare, FileText, LayoutGrid } from 'lucide-react';
import type { WorkspaceMode } from '@/client/types/layout-types.js';

// ---------------------------------------------------------------------------
// WorkspaceModeSwitcher — toggle between Conversation/Files/Fusion layouts
// ---------------------------------------------------------------------------
// Renders as a small button group in the ChatPage toolbar.
// Dispatches SET_WORKSPACE_MODE to LayoutContext which applies mode presets.
// ---------------------------------------------------------------------------

const MODES: { mode: WorkspaceMode; icon: typeof MessageSquare; label: string }[] = [
  { mode: 'conversation', icon: MessageSquare, label: 'Conversation' },
  { mode: 'files', icon: FileText, label: 'Files' },
  { mode: 'fusion', icon: LayoutGrid, label: 'Fusion' },
];

export function WorkspaceModeSwitcher() {
  const { dispatch } = useLayoutContext();
  const workspaceMode = useLayoutSelector((s) => s.workspaceMode);

  return (
    <div className="flex items-center gap-[2px] rounded-[var(--radius-sm)] border border-border p-[2px]"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      {MODES.map(({ mode, icon: Icon, label }) => {
        const isActive = workspaceMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => dispatch({ type: 'SET_WORKSPACE_MODE', mode })}
            className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] border-none cursor-pointer transition-colors duration-150"
            style={{
              backgroundColor: isActive ? 'var(--color-tint-exploring)' : 'transparent',
              color: isActive ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
            }}
            title={label}
            aria-label={`Switch to ${label} mode`}
          >
            <Icon size={13} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}
