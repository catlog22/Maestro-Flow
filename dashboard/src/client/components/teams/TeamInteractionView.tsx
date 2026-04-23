import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { useTeamStore } from '@/client/store/team-store.js';
import { TEAM_API_ENDPOINTS } from '@/shared/constants.js';
import { TEAM_STATUS_COLORS, PIPELINE_STATUS_COLORS } from '@/shared/team-types.js';
import type { TeamAgentRoleStatus, SessionFileEntry } from '@/shared/team-types.js';
import { AgentChatSlot } from './AgentChatSlot.js';
import { TeamStatusOverlay } from './TeamStatusOverlay.js';
import { PhaseProgressBar } from './PhaseProgressBar.js';

// ---------------------------------------------------------------------------
// TeamInteractionView — Interactive multi-agent workspace
//
// 3-zone layout:
//   Header  — session title, status, back button, phase bar
//   Main    — responsive grid of AgentChatSlot per role
//   Side    — file browser + overlay toggle (collapsible)
// ---------------------------------------------------------------------------

export function TeamInteractionView() {
  const session = useTeamStore((s) => s.activeSession);
  const activeSessionId = useTeamStore((s) => s.activeSessionId);
  const loading = useTeamStore((s) => s.loading);
  const clearActiveSession = useTeamStore((s) => s.clearActiveSession);
  const agentStatuses = useTeamStore((s) => s.agentStatuses);
  const phaseState = useTeamStore((s) => s.phaseState);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<SessionFileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Escape key to go back or close panels
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        if (overlayOpen) setOverlayOpen(false);
        else if (sideOpen) setSideOpen(false);
        else clearActiveSession();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clearActiveSession, overlayOpen, sideOpen]);

  // Load file content
  const loadFile = useCallback(
    async (file: SessionFileEntry) => {
      if (!activeSessionId) return;
      setActiveFile(file);
      setFileLoading(true);
      setSideOpen(true);
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

  // Build role status map from agentStatuses array
  const roleStatusMap = new Map<string, TeamAgentRoleStatus>();
  for (const as of agentStatuses) {
    roleStatusMap.set(as.role, as.status);
  }

  // Roles from session detail
  const roles = session.roleDetails.map((r) => r.name);

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
      {/* Header */}
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

        {/* Phase indicator */}
        {phaseState && (
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <PhaseProgressBar />
          </div>
        )}

        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: `${statusColor}18`, color: statusColor }}
        >
          <span className="relative flex w-1.5 h-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }} />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ backgroundColor: statusColor }} />
          </span>
          {session.status}
        </span>
        <span className="text-[11px] font-mono text-text-tertiary">
          {session.duration}
        </span>
        <button
          type="button"
          onClick={() => setSideOpen((v) => !v)}
          className="ml-1 px-2.5 py-1 rounded-lg bg-bg-hover text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-active transition-all flex items-center gap-1.5"
        >
          <FileText size={12} />
          Files
        </button>
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="px-2.5 py-1 rounded-lg bg-bg-hover text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-active transition-all flex items-center gap-1.5"
        >
          <Users size={12} />
          Status
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Agent slot grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
          >
            <AnimatePresence>
              {roles.map((role) => (
                <motion.div
                  key={role}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <AgentChatSlot
                    role={role}
                    sessionId={session.sessionId}
                    status={roleStatusMap.get(role) ?? 'idle'}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {roles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
              <Users size={32} className="opacity-30" />
              <span className="text-[13px] font-medium">No agent roles</span>
              <span className="text-[11px]">Waiting for agents to join the session...</span>
            </div>
          )}
        </div>

        {/* Side panel — file browser */}
        <AnimatePresence>
          {sideOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="border-l border-border bg-bg-secondary flex flex-col shrink-0 overflow-hidden"
            >
              {/* Side header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-divider shrink-0">
                <span className="text-[11px] font-semibold text-text-primary flex-1">Files</span>
                <button
                  type="button"
                  onClick={() => setSideOpen(false)}
                  className="w-5 h-5 rounded flex items-center justify-center text-text-placeholder hover:text-text-primary hover:bg-bg-hover transition-all"
                >
                  <X size={11} />
                </button>
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

              {/* File content preview */}
              {activeFile && (
                <div className="border-t border-border-divider flex flex-col max-h-[40%]">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary shrink-0">
                    <FileText size={11} className="text-text-placeholder" />
                    <span className="text-[10px] font-medium text-text-primary truncate">{activeFile.name}</span>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => { setActiveFile(null); setFileContent(''); }}
                      className="w-4 h-4 rounded flex items-center justify-center text-text-placeholder hover:text-text-primary hover:bg-bg-hover transition-all"
                    >
                      <X size={9} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    {fileLoading ? (
                      <div className="text-[10px] text-text-tertiary">Loading...</div>
                    ) : (
                      <pre className="font-mono text-[10px] leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
                        {fileContent}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
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
