import { useState, useCallback, useEffect, useRef } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import FolderTree from 'lucide-react/dist/esm/icons/folder-tree.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useUIPrefsStore } from '@/client/store/ui-prefs-store.js';
import { useApprovalKeyboard } from '@/client/hooks/useApprovalKeyboard.js';
import { useWorkspaceTree } from '@/client/hooks/useWorkspaceTree.js';
import { HistoryPanel } from './SessionSidebar.js';
import { TreeBrowser } from '@/client/components/artifacts/TreeBrowser.js';
import { ChatWorkspace } from '@/client/components/chat/ChatWorkspace.js';
import { WorkspaceModeSwitcher } from '@/client/components/chat/WorkspaceModeSwitcher.js';
import { AGENT_DOT_COLORS, AGENT_LABELS } from '@/shared/constants.js';
import type { AgentProcess } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// WelcomeView — shown when no sessions exist
// ---------------------------------------------------------------------------

const COWORK_QUICK_START = [
  {
    title: 'Explore your codebase',
    desc: 'Ask questions, trace code paths, understand architecture',
    icon: Search,
    iconColor: 'var(--color-accent-blue)',
    iconBg: 'var(--color-tint-exploring)',
  },
  {
    title: 'Plan a feature',
    desc: 'Break down requirements into phases and tasks',
    icon: GitBranch,
    iconColor: 'var(--color-accent-purple)',
    iconBg: 'var(--color-tint-planning)',
  },
  {
    title: 'Execute a workflow',
    desc: 'Run parallel tasks with automatic verification',
    icon: Zap,
    iconColor: 'var(--color-accent-orange)',
    iconBg: 'var(--color-tint-verifying)',
  },
  {
    title: 'Review & debug',
    desc: 'Multi-dimensional code review and hypothesis-driven debugging',
    icon: LayoutDashboard,
    iconColor: 'var(--color-accent-green)',
    iconBg: 'var(--color-tint-completed)',
  },
] as const;

// ---------------------------------------------------------------------------
// ChatPage — VS Code-style multi-split layout
// ---------------------------------------------------------------------------
// Uses ChatWorkspace (which uses LayoutContext + EditorGroupContainer)
// for the main editor area with tab-based session management.
// Sidebar panels (file tree, history) remain as local state.
// ---------------------------------------------------------------------------

export function ChatPage() {
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const workspace = useWorkspaceTree();

  useApprovalKeyboard(activeProcessId);

  return (
    <div className="h-full flex min-w-0 overflow-hidden relative">
      {/* Collapsible file tree panel */}
      <div
        className="shrink-0 flex flex-col overflow-hidden border-r transition-[width] duration-200 ease-[var(--ease-notion)]"
        style={{
          width: fileTreeOpen ? 260 : 0,
          borderColor: fileTreeOpen ? 'var(--color-border)' : 'transparent',
        }}
      >
        {fileTreeOpen && (
          <TreeBrowser
            tree={workspace.tree}
            selectedPath={null}
            onSelectFile={() => {}}
            loading={workspace.loading}
          />
        )}
      </div>

      {/* Main workspace area — uses LayoutContext + EditorGroupContainer */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Utility toolbar */}
        <div className="flex items-center justify-between px-2 py-1 shrink-0">
          <WorkspaceModeSwitcher />
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFileTreeOpen(!fileTreeOpen)}
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] border-none bg-transparent cursor-pointer transition-colors"
            style={{
              color: fileTreeOpen ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
              backgroundColor: fileTreeOpen ? 'var(--color-tint-exploring)' : 'transparent',
            }}
            title="Toggle file tree"
          >
            <FolderTree size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] border-none bg-transparent cursor-pointer transition-colors"
            style={{
              color: historyOpen ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
              backgroundColor: historyOpen ? 'var(--color-tint-exploring)' : 'transparent',
            }}
            title="Toggle history"
          >
            <Clock size={14} strokeWidth={1.8} />
          </button>
          </div>
        </div>

        {/* Editor workspace — tabs, splits, content managed by LayoutContext */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatWorkspace />
        </div>
      </div>

      {/* Collapsible history panel */}
      <HistoryPanel open={historyOpen} />
    </div>
  );
}
