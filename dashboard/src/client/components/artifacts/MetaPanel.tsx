import { useMemo, useState } from 'react';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';

// ---------------------------------------------------------------------------
// MetaPanel -- right sidebar with collapsible metadata sections
// ---------------------------------------------------------------------------

interface MetaPanelProps {
  path: string | null;
  content: string | null;
}

/** Extract file extension */
function getExt(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

/** Extract headings from markdown content for outline */
function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() });
    }
  }
  return headings;
}

/** Extract top-level keys from JSON string */
function extractJsonKeys(content: string): Array<{ key: string; type: string }> {
  try {
    const data = JSON.parse(content);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
    return Object.entries(data).map(([key, val]) => ({
      key,
      type: Array.isArray(val) ? 'array' : typeof val,
    }));
  } catch {
    return [];
  }
}

export function MetaPanel({ path, content }: MetaPanelProps) {
  if (!path) {
    return (
      <div className="w-[240px] bg-bg-primary border-l border-border shrink-0 flex items-center justify-center">
        <p className="text-[length:var(--font-size-xs)] text-text-tertiary">No file selected</p>
      </div>
    );
  }

  const ext = getExt(path);
  const fileName = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '/';

  return (
    <div className="w-[240px] bg-bg-primary border-l border-border shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-[14px] py-[10px] border-b border-border-divider text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-text-primary shrink-0">
        Properties
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-[14px] py-[var(--spacing-3)]">
        {/* Properties section */}
        <MetaSection title="File Info" defaultOpen>
          <MetaRow label="Name" value={fileName} />
          <MetaRow label="Type" value={ext.replace('.', '').toUpperCase() || 'Unknown'} />
          <MetaRow label="Directory" value={directory} mono />
        </MetaSection>

        {/* Tags section */}
        <MetaSection title="Tags">
          <div className="flex flex-wrap gap-[var(--spacing-1)]">
            <MetaTag label={ext.replace('.', '') || 'file'} color="blue" />
            {path.includes('phase') && <MetaTag label="phase" color="purple" />}
            {path.includes('verification') && <MetaTag label="verify" color="green" />}
          </div>
        </MetaSection>

        {/* Outline (markdown only) */}
        {ext === '.md' && content && (
          <OutlineSection content={content} />
        )}

        {/* JSON keys (json only) */}
        {ext === '.json' && content && (
          <JsonKeysSection content={content} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function MetaSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-[var(--spacing-4)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-[var(--spacing-1)] w-full text-left mb-[var(--spacing-1-5)]',
          'text-[9px] font-[var(--font-weight-semibold)] uppercase tracking-[0.06em] text-text-placeholder',
          'hover:text-text-secondary transition-colors duration-[var(--duration-fast)]',
        ].join(' ')}
      >
        <ChevronRight
          size={10}
          strokeWidth={2.5}
          className={[
            'transition-transform duration-[var(--duration-fast)]',
            open ? 'rotate-90' : '',
          ].join(' ')}
        />
        {title}
      </button>
      {open && children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-[var(--spacing-1)] text-[length:var(--font-size-sm)]">
      <span className="text-text-tertiary">{label}</span>
      <span className={`text-text-primary font-[var(--font-weight-medium)] ${mono ? 'font-mono text-[11px]' : ''} truncate max-w-[140px]`}>
        {value}
      </span>
    </div>
  );
}

function MetaTag({ label, color }: { label: string; color: 'blue' | 'purple' | 'green' }) {
  const colorMap = {
    blue: { bg: 'rgba(91,141,184,0.12)', text: 'var(--color-accent-blue)' },
    purple: { bg: 'rgba(145,120,181,0.12)', text: 'var(--color-accent-purple, #9178B5)' },
    green: { bg: 'rgba(90,158,120,0.12)', text: 'var(--color-status-completed)' },
  };
  const c = colorMap[color];

  return (
    <span
      className="text-[10px] font-[var(--font-weight-semibold)] px-[var(--spacing-2)] py-[2px] rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {label}
    </span>
  );
}

function OutlineSection({ content }: { content: string }) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  if (headings.length === 0) return null;

  return (
    <MetaSection title="Outline">
      <div className="flex flex-col gap-[2px]">
        {headings.map((h, i) => (
          <button
            key={i}
            type="button"
            className={[
              'flex items-center gap-[var(--spacing-1-5)] px-[var(--spacing-2)] py-[3px] rounded-[var(--radius-sm)] text-[11px] w-full text-left',
              'hover:bg-bg-hover hover:text-text-primary transition-colors duration-[var(--duration-fast)] cursor-pointer',
              i === 0 ? 'text-text-primary font-[var(--font-weight-semibold)]' : 'text-text-tertiary',
            ].join(' ')}
            style={{ paddingLeft: (h.level - 1) * 10 + 8 }}
          >
            <span
              className="w-1 h-1 rounded-full shrink-0"
              style={{ background: i === 0 ? 'var(--color-accent-purple)' : 'var(--color-text-placeholder)' }}
            />
            <span className="truncate">{h.text}</span>
          </button>
        ))}
      </div>
    </MetaSection>
  );
}

function JsonKeysSection({ content }: { content: string }) {
  const keys = useMemo(() => extractJsonKeys(content), [content]);
  if (keys.length === 0) return null;

  return (
    <MetaSection title="Structure">
      <div className="flex flex-col gap-0">
        {keys.map((entry) => (
          <div key={entry.key} className="flex items-center justify-between py-[var(--spacing-1)] text-[length:var(--font-size-sm)]">
            <span className="text-text-primary font-mono text-[11px] truncate max-w-[120px]">{entry.key}</span>
            <span className="text-text-placeholder text-[10px]">{entry.type}</span>
          </div>
        ))}
      </div>
    </MetaSection>
  );
}
