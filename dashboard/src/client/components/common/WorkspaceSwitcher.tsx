import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';

// ---------------------------------------------------------------------------
// WorkspaceSwitcher — breadcrumb button + dropdown for workspace hot-switch
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'maestro.recentWorkspaces';
const MAX_RECENT = 5;

interface BrowseEntry {
  name: string;
  path: string;
  hasWorkflow: boolean;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  entries: BrowseEntry[];
}

function getBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function loadRecentWorkspaces(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentWorkspaces(workspaces: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch {
    // ignore storage errors
  }
}

function addToRecentWorkspaces(path: string): void {
  const recents = loadRecentWorkspaces().filter((p) => p !== path);
  recents.unshift(path);
  saveRecentWorkspaces(recents.slice(0, MAX_RECENT));
}

export function WorkspaceSwitcher() {
  const workspace = useBoardStore((s) => s.workspace);
  const setWorkspace = useBoardStore((s) => s.setWorkspace);

  const [isOpen, setIsOpen] = useState(false);
  const [inputPath, setInputPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);

  // Browse state
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh recent workspaces when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setRecentWorkspaces(loadRecentWorkspaces());
      setInputPath('');
      setError(null);
      setIsBrowsing(false);
      setBrowseData(null);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const handleSwitch = useCallback(
    async (path: string) => {
      if (!path.trim()) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: path.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? `Error ${res.status}`);
          return;
        }
        addToRecentWorkspaces(path.trim());
        setWorkspace(path.trim());
        setIsOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setIsLoading(false);
      }
    },
    [setWorkspace],
  );

  const browseTo = useCallback(async (path?: string) => {
    setBrowseLoading(true);
    try {
      const url = path
        ? `/api/workspace/browse?path=${encodeURIComponent(path)}`
        : '/api/workspace/browse';
      const res = await fetch(url);
      if (!res.ok) {
        setError('Failed to browse directory');
        return;
      }
      const data: BrowseResult = await res.json();
      setBrowseData(data);
      setIsBrowsing(true);
    } catch {
      setError('Failed to browse directory');
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  // Close dropdown on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (isBrowsing) {
        setIsBrowsing(false);
      } else {
        setIsOpen(false);
      }
    }
  }, [isBrowsing]);

  const workspaceName = workspace ? getBasename(workspace) : '\u2014';

  return (
    <div ref={containerRef} className="relative flex items-center" onKeyDown={handleKeyDown}>
      {/* Breadcrumb button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          'flex items-center gap-[var(--spacing-1)] px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]',
          'text-[length:var(--font-size-sm)] text-text-secondary',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
          'hover:bg-bg-hover hover:text-text-primary',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-text-placeholder">/</span>
        <span className="max-w-[160px] truncate">{workspaceName}</span>
        <span className="text-[length:9px] text-text-placeholder ml-[2px]">&#9660;</span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Switch workspace"
          className={[
            'absolute top-full left-0 mt-[4px] w-[360px] z-50',
            'bg-bg-secondary border border-border rounded-[var(--radius-md)]',
            'shadow-[var(--shadow-lg,0_8px_24px_rgba(0,0,0,0.18))]',
            'p-[var(--spacing-2)]',
          ].join(' ')}
        >
          {/* Browse mode */}
          {isBrowsing && browseData ? (
            <div>
              {/* Browse header */}
              <div className="flex items-center gap-[var(--spacing-1)] mb-[var(--spacing-2)] px-[var(--spacing-1)]">
                <button
                  type="button"
                  onClick={() => setIsBrowsing(false)}
                  className="text-[length:var(--font-size-xs)] text-text-secondary hover:text-text-primary px-[var(--spacing-1)] py-[2px] rounded-[var(--radius-sm)] hover:bg-bg-hover"
                >
                  &#8592; Back
                </button>
                <span className="text-[length:var(--font-size-xs)] text-text-placeholder truncate flex-1 text-right">
                  {browseData.current}
                </span>
              </div>

              {/* Parent directory */}
              {browseData.parent && (
                <button
                  type="button"
                  onClick={() => browseTo(browseData.parent!)}
                  disabled={browseLoading}
                  className={[
                    'w-full text-left flex items-center gap-[var(--spacing-2)]',
                    'px-[var(--spacing-2)] py-[var(--spacing-1-5)] rounded-[var(--radius-sm)]',
                    'text-[length:var(--font-size-sm)] text-text-secondary',
                    'transition-colors duration-[var(--duration-fast)]',
                    'hover:bg-bg-hover cursor-pointer',
                  ].join(' ')}
                >
                  <span className="text-text-placeholder text-[length:var(--font-size-xs)]">&#128194;</span>
                  <span>..</span>
                </button>
              )}

              {/* Directory entries */}
              <div className="max-h-[240px] overflow-y-auto">
                {browseData.entries.length === 0 ? (
                  <p className="text-[length:var(--font-size-xs)] text-text-placeholder px-[var(--spacing-2)] py-[var(--spacing-2)] text-center">
                    No subdirectories
                  </p>
                ) : (
                  browseData.entries.map((entry) => (
                    <div key={entry.path} className="flex items-center gap-[2px]">
                      <button
                        type="button"
                        onClick={() => browseTo(entry.path)}
                        disabled={browseLoading}
                        className={[
                          'flex-1 text-left flex items-center gap-[var(--spacing-2)]',
                          'px-[var(--spacing-2)] py-[var(--spacing-1-5)] rounded-[var(--radius-sm)]',
                          'text-[length:var(--font-size-sm)]',
                          'transition-colors duration-[var(--duration-fast)]',
                          'hover:bg-bg-hover cursor-pointer',
                          entry.hasWorkflow ? 'text-text-primary' : 'text-text-secondary',
                        ].join(' ')}
                      >
                        <span className="text-[length:var(--font-size-xs)]">
                          {entry.hasWorkflow ? '\u{1F4C2}' : '\u{1F4C1}'}
                        </span>
                        <span className="truncate">{entry.name}</span>
                        {entry.hasWorkflow && (
                          <span className="text-[length:9px] text-accent-blue bg-[rgba(55,120,220,0.1)] px-[4px] py-[1px] rounded-[3px] shrink-0">
                            .workflow
                          </span>
                        )}
                      </button>
                      {entry.hasWorkflow && (
                        <button
                          type="button"
                          onClick={() => handleSwitch(entry.path)}
                          disabled={isLoading}
                          className={[
                            'shrink-0 px-[var(--spacing-1-5)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]',
                            'text-[length:var(--font-size-xs)] text-accent-blue',
                            'hover:bg-[rgba(55,120,220,0.1)] cursor-pointer',
                            'transition-colors duration-[var(--duration-fast)]',
                          ].join(' ')}
                        >
                          Open
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Recent workspaces */}
              <div className="mb-[var(--spacing-2)]">
                <p className="text-[length:var(--font-size-xs)] text-text-placeholder px-[var(--spacing-2)] mb-[var(--spacing-1)]">
                  Recent
                </p>
                {recentWorkspaces.length > 0 ? (
                  <ul role="listbox">
                    {recentWorkspaces.map((path) => (
                      <li key={path}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={path === workspace}
                          onClick={() => handleSwitch(path)}
                          disabled={isLoading}
                          className={[
                            'w-full text-left flex items-center gap-[var(--spacing-2)]',
                            'px-[var(--spacing-2)] py-[var(--spacing-1-5)] rounded-[var(--radius-sm)]',
                            'text-[length:var(--font-size-sm)]',
                            'transition-colors duration-[var(--duration-fast)]',
                            'hover:bg-bg-hover focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                            path === workspace ? 'text-text-primary' : 'text-text-secondary',
                            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                          ].join(' ')}
                        >
                          <span className="text-text-placeholder text-[length:var(--font-size-xs)]">&#128193;</span>
                          <span className="truncate flex-1">{path}</span>
                          {path === workspace && (
                            <span className="text-[length:var(--font-size-xs)] text-text-placeholder shrink-0">current</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[length:var(--font-size-xs)] text-text-placeholder px-[var(--spacing-2)] py-[var(--spacing-1)] italic">
                    No recent workspaces
                  </p>
                )}
                <div className="border-t border-border mt-[var(--spacing-2)] mb-[var(--spacing-2)]" />
              </div>

              {/* Manual path input + browse button */}
              <div className="px-[var(--spacing-1)] flex flex-col gap-[var(--spacing-2)]">
                <label className="text-[length:var(--font-size-xs)] text-text-placeholder">
                  Path
                </label>
                <div className="flex gap-[var(--spacing-1)]">
                  <input
                    type="text"
                    value={inputPath}
                    onChange={(e) => setInputPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSwitch(inputPath);
                    }}
                    placeholder="/path/to/workspace"
                    autoFocus
                    className={[
                      'flex-1 min-w-0 px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]',
                      'bg-bg-tertiary border border-border',
                      'text-[length:var(--font-size-sm)] text-text-primary placeholder:text-text-placeholder',
                      'focus:outline-none focus:border-accent-blue',
                      'transition-colors duration-[var(--duration-fast)]',
                    ].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => browseTo(inputPath.trim() || undefined)}
                    disabled={browseLoading}
                    title="Browse folders"
                    className={[
                      'shrink-0 flex items-center justify-center w-[32px] rounded-[var(--radius-sm)]',
                      'bg-bg-tertiary border border-border text-text-secondary',
                      'hover:bg-bg-hover hover:text-text-primary cursor-pointer',
                      'transition-colors duration-[var(--duration-fast)]',
                      'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                    ].join(' ')}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>

                {/* Error message */}
                {error && (
                  <p className="text-[length:var(--font-size-xs)] text-status-blocked px-[var(--spacing-1)]">
                    {error}
                  </p>
                )}

                {/* Confirm button */}
                <button
                  type="button"
                  onClick={() => handleSwitch(inputPath)}
                  disabled={isLoading || !inputPath.trim()}
                  className={[
                    'w-full px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-[var(--radius-sm)]',
                    'text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]',
                    'bg-bg-tertiary border border-border text-text-secondary',
                    'transition-colors duration-[var(--duration-fast)]',
                    'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                    isLoading || !inputPath.trim()
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-bg-hover hover:text-text-primary cursor-pointer',
                  ].join(' ')}
                >
                  {isLoading ? 'Switching...' : 'Switch workspace'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
