import { useState } from 'react';
import { ContentRenderer } from '@/client/components/artifacts/ContentRenderer.js';
import { MetaPanel } from '@/client/components/artifacts/MetaPanel.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import FileJson from 'lucide-react/dist/esm/icons/file-json.js';
import Database from 'lucide-react/dist/esm/icons/database.js';

// ---------------------------------------------------------------------------
// ReaderView -- document reader with breadcrumbs, content, and meta panel
// ---------------------------------------------------------------------------

interface ReaderViewProps {
  content: string | null;
  path: string | null;
  onNavigate: (path: string) => void;
  loading: boolean;
  error: string | null;
}

/** File extension to icon component */
function getFileIcon(path: string) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.json': return { Icon: FileJson, bg: 'rgba(184,149,64,0.10)', color: 'var(--color-accent-yellow)' };
    case '.md': return { Icon: FileText, bg: 'rgba(91,141,184,0.10)', color: 'var(--color-accent-blue)' };
    case '.ndjson': return { Icon: Database, bg: 'rgba(200,134,58,0.10)', color: 'var(--color-accent-orange, #C8863A)' };
    default: return { Icon: FileText, bg: 'rgba(160,157,151,0.10)', color: 'var(--color-text-tertiary)' };
  }
}

export function ReaderView({ content, path, onNavigate: _onNavigate, loading, error }: ReaderViewProps) {
  const [rawView, setRawView] = useState(false);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          role="alert"
          className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] rounded-[var(--radius-default)]"
          style={{
            backgroundColor: 'var(--color-status-bg-blocked)',
            color: 'var(--color-status-blocked)',
            borderColor: 'var(--color-status-blocked)',
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary text-[length:var(--font-size-sm)] animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!path || content === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-secondary">
        <p className="text-[length:var(--font-size-lg)] mb-[var(--spacing-2)]">Select a file</p>
        <p className="text-[length:var(--font-size-sm)]">Choose an artifact from the tree to view</p>
      </div>
    );
  }

  const fileName = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
  const { Icon, bg, color } = getFileIcon(path);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Reader header */}
        <div className="flex items-center gap-[var(--spacing-3)] px-[24px] py-[10px] border-b border-border-divider shrink-0">
          <div
            className="w-7 h-7 rounded-[var(--radius-default)] flex items-center justify-center shrink-0"
            style={{ background: bg, color }}
          >
            <Icon size={14} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-[var(--font-weight-bold)] text-text-primary truncate">{fileName}</div>
            <div className="text-[10px] font-mono text-text-tertiary truncate">{path}</div>
          </div>
          {/* Rendered / Source toggle */}
          <div className="flex gap-[var(--spacing-1)]">
            <button
              type="button"
              onClick={() => setRawView(false)}
              className={[
                'px-[10px] py-[var(--spacing-1)] rounded-[var(--radius-default)] border text-[10px] font-[var(--font-weight-semibold)]',
                'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                !rawView
                  ? 'bg-text-primary text-bg-primary border-text-primary'
                  : 'bg-bg-card text-text-secondary border-border hover:border-text-tertiary hover:text-text-primary',
              ].join(' ')}
            >
              Rendered
            </button>
            <button
              type="button"
              onClick={() => setRawView(true)}
              className={[
                'px-[10px] py-[var(--spacing-1)] rounded-[var(--radius-default)] border text-[10px] font-[var(--font-weight-semibold)]',
                'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                rawView
                  ? 'bg-text-primary text-bg-primary border-text-primary'
                  : 'bg-bg-card text-text-secondary border-border hover:border-text-tertiary hover:text-text-primary',
              ].join(' ')}
            >
              Source
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-[32px] py-[24px]">
            <ContentRenderer content={content} path={path} rawOverride={rawView} />
          </div>
        </div>
      </div>

      {/* Right: Meta panel */}
      <MetaPanel path={path} content={content} />
    </div>
  );
}

