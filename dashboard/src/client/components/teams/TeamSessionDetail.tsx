import { useState, useEffect, useCallback } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { useTeamStore } from '@/client/store/team-store.js';
import { TEAM_API_ENDPOINTS } from '@/shared/constants.js';
import { TeamStatusOverlay } from './TeamStatusOverlay.js';
import type { SessionFileEntry } from '@/shared/team-types.js';
import { TEAM_STATUS_COLORS, PIPELINE_STATUS_COLORS } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// TeamSessionDetail — IDE-style layout: sidebar + file viewer + status overlay
// ---------------------------------------------------------------------------

export function TeamSessionDetail() {
  const session = useTeamStore((s) => s.activeSession);
  const activeSessionId = useTeamStore((s) => s.activeSessionId);
  const loading = useTeamStore((s) => s.loading);
  const clearActiveSession = useTeamStore((s) => s.clearActiveSession);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<SessionFileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [openTabs, setOpenTabs] = useState<SessionFileEntry[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Escape key to go back
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (overlayOpen) setOverlayOpen(false);
        else clearActiveSession();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clearActiveSession, overlayOpen]);

  // Load file content
  const loadFile = useCallback(
    async (file: SessionFileEntry) => {
      if (!activeSessionId) return;
      setActiveFile(file);
      setFileLoading(true);

      // Add to tabs if not already there
      setOpenTabs((prev) => {
        if (prev.some((t) => t.id === file.id)) return prev;
        return [...prev, file];
      });

      try {
        const url = `${TEAM_API_ENDPOINTS.SESSIONS}/${activeSessionId}/files/${encodeURIComponent(file.path)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('json')) {
          const data = await res.json();
          setFileContent(JSON.stringify(data, null, 2));
        } else {
          setFileContent(await res.text());
        }
      } catch {
        setFileContent('// Failed to load file content');
      }
      setFileLoading(false);
    },
    [activeSessionId],
  );

  const closeTab = useCallback(
    (fileId: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((t) => t.id !== fileId);
        if (activeFile?.id === fileId) {
          if (next.length > 0) {
            void loadFile(next[next.length - 1]);
          } else {
            setActiveFile(null);
            setFileContent('');
          }
        }
        return next;
      });
    },
    [activeFile, loadFile],
  );

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        Loading session...
      </div>
    );
  }

  const statusColor = TEAM_STATUS_COLORS[session.status];

  // Group files by category
  const filesByCategory = new Map<string, SessionFileEntry[]>();
  for (const file of session.files) {
    const cat = file.category;
    if (!filesByCategory.has(cat)) filesByCategory.set(cat, []);
    filesByCategory.get(cat)!.push(file);
  }

  const categoryLabels: Record<string, string> = {
    artifacts: 'Artifacts',
    'role-specs': 'Role Specs',
    session: 'Session',
    wisdom: 'Wisdom',
    'message-bus': 'Message Bus',
  };

  return (
    <div className="-m-[var(--spacing-4)] max-sm:-m-[var(--spacing-2)] flex flex-col h-[calc(100%+var(--spacing-4)*2)] max-sm:h-[calc(100%+var(--spacing-2)*2)] overflow-hidden relative">
      {/* Top bar */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border shrink-0 bg-bg-secondary">
        <button
          type="button"
          onClick={clearActiveSession}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
          title="Back to sessions"
        >
          <ArrowLeft size={15} strokeWidth={2} />
        </button>
        <span className="text-[14px] font-semibold text-text-primary truncate">
          {session.title}
        </span>
        <span className="text-[10px] font-mono text-text-tertiary">
          {session.sessionId}
        </span>
        <div className="flex-1" />
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: `${statusColor}18`, color: statusColor }}
        >
          {session.status === 'active' && (
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }} />
              <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ backgroundColor: statusColor }} />
            </span>
          )}
          {session.status}
        </span>
        <span className="text-[11px] font-mono text-text-tertiary">
          {session.duration}
        </span>
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="ml-2 px-2.5 py-1 rounded-lg bg-bg-hover text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-active transition-all flex items-center gap-1.5"
        >
          <Users size={12} />
          Team Status
        </button>
      </div>

      {/* IDE layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[240px] border-r border-border bg-bg-secondary flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-divider">
            <span className="text-[11px] font-semibold text-text-primary">Session Explorer</span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${statusColor}18`, color: statusColor }}
            >
              {session.status}
            </span>
          </div>

          {/* Mini pipeline DAG */}
          <div className="px-3 py-2 border-b border-border-divider">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-text-placeholder mb-2">
              Pipeline DAG
            </div>
            <div className="flex flex-col gap-0.5">
              {session.pipelineStages.map((stage, i) => (
                <div key={stage.id}>
                  <div className="flex items-center gap-2 py-0.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: PIPELINE_STATUS_COLORS[stage.status] }}
                    />
                    <span
                      className={[
                        'text-[10px] flex-1 truncate',
                        stage.status === 'in_progress' ? 'font-semibold text-text-primary' : 'text-text-secondary',
                        stage.status === 'pending' ? 'opacity-50' : '',
                      ].join(' ')}
                    >
                      {stage.name}
                    </span>
                    <span
                      className="text-[8px] font-semibold px-1 rounded-full"
                      style={{
                        background: `${PIPELINE_STATUS_COLORS[stage.status]}18`,
                        color: PIPELINE_STATUS_COLORS[stage.status],
                      }}
                    >
                      {stage.status === 'done' ? 'Done' : stage.status === 'in_progress' ? 'Run' : 'Wait'}
                    </span>
                  </div>
                  {i < session.pipelineStages.length - 1 && (
                    <div className="w-px h-2 bg-border-divider ml-[3.5px]" />
                  )}
                </div>
              ))}
              {session.pipelineStages.length === 0 && (
                <span className="text-[10px] text-text-tertiary italic">No pipeline data</span>
              )}
            </div>
          </div>

          {/* File tree */}
          <div className="flex-1 overflow-y-auto">
            {Array.from(filesByCategory.entries()).map(([cat, files]) => (
              <div key={cat} className="px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => toggleSection(cat)}
                  className="flex items-center gap-1 px-1.5 py-1 w-full text-left text-[9px] font-semibold uppercase tracking-widest text-text-placeholder hover:text-text-primary transition-colors"
                >
                  <ChevronDown
                    size={10}
                    className={[
                      'transition-transform',
                      collapsedSections.has(cat) ? '-rotate-90' : '',
                    ].join(' ')}
                  />
                  {categoryLabels[cat] ?? cat}
                  <span className="ml-auto text-[9px] bg-bg-hover px-1 rounded-full text-text-tertiary">
                    {files.length}
                  </span>
                </button>
                {!collapsedSections.has(cat) && (
                  <div className="flex flex-col gap-0.5">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => void loadFile(file)}
                        className={[
                          'flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] w-full transition-all',
                          activeFile?.id === file.id
                            ? 'bg-bg-active text-text-primary font-medium'
                            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                        ].join(' ')}
                      >
                        <FileText size={11} className="text-text-placeholder shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {session.files.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-text-tertiary italic text-center">
                No files found
              </div>
            )}
          </div>
        </aside>

        {/* File viewer */}
        <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
          {/* Tabs */}
          {openTabs.length > 0 && (
            <div className="flex items-center border-b border-border bg-bg-secondary shrink-0 overflow-x-auto">
              {openTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 text-[11px] cursor-pointer border-r border-border-divider shrink-0',
                    activeFile?.id === tab.id
                      ? 'bg-bg-primary text-text-primary font-medium'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => void loadFile(tab)}
                    className="truncate max-w-[140px]"
                  >
                    {tab.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="w-4 h-4 rounded flex items-center justify-center text-text-placeholder hover:text-text-primary hover:bg-bg-hover transition-all"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-auto p-4">
            {fileLoading && (
              <div className="text-[12px] text-text-tertiary">Loading file...</div>
            )}
            {!fileLoading && !activeFile && (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                <FileText size={32} className="opacity-30" />
                <span className="text-[13px] font-medium">Select a file to view</span>
                <span className="text-[11px]">Choose from the sidebar or click Team Status for an overview</span>
              </div>
            )}
            {!fileLoading && activeFile && (
              <div className="font-mono text-[12px] leading-relaxed text-text-primary whitespace-pre-wrap break-words">
                {fileContent}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Status overlay */}
      <TeamStatusOverlay
        session={session}
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
      />
    </div>
  );
}
