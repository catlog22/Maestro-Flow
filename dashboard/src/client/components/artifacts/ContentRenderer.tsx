import { useState } from 'react';
import { MarkdownRenderer } from '@/client/components/artifacts/MarkdownRenderer.js';
import { JsonViewer } from '@/client/components/artifacts/JsonViewer.js';

// ---------------------------------------------------------------------------
// ContentRenderer -- dispatches to specialized renderer based on file extension
// ---------------------------------------------------------------------------

interface ContentRendererProps {
  content: string;
  path: string;
  /** When provided, controls raw/rendered externally (hides internal toolbar) */
  rawOverride?: boolean;
}

export function ContentRenderer({ content, path, rawOverride }: ContentRendererProps) {
  const [rawViewInternal, setRawViewInternal] = useState(false);

  const ext = getExtension(path);
  const hasExternalToggle = rawOverride !== undefined;
  const rawView = hasExternalToggle ? rawOverride : rawViewInternal;

  // When controlled externally (e.g. from ReaderView), render content only
  if (hasExternalToggle) {
    return (
      <div role="region" aria-label="File content">
        {rawView ? (
          <RawContent content={content} />
        ) : (
          <RenderedContent content={content} ext={ext} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" role="region" aria-label="File content">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border bg-bg-secondary shrink-0 h-9">
        <span className="text-[length:var(--font-size-sm)] text-text-secondary font-mono truncate">{path}</span>
        <button
          type="button"
          onClick={() => setRawViewInternal((v) => !v)}
          aria-pressed={rawView}
          aria-label={rawView ? 'Show rendered view' : 'Show raw view'}
          className={[
            'px-[var(--spacing-2)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] rounded-[var(--radius-default)]',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            rawView
              ? 'bg-bg-active text-accent-blue font-[var(--font-weight-medium)]'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
          ].join(' ')}
        >
          {rawView ? 'Rendered' : 'Raw'}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-[var(--spacing-4)] bg-bg-primary">
        {rawView ? (
          <RawContent content={content} />
        ) : (
          <RenderedContent content={content} ext={ext} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RenderedContent -- picks renderer based on extension
// ---------------------------------------------------------------------------

function RenderedContent({ content, ext }: { content: string; ext: string }) {
  switch (ext) {
    case '.md':
      return <MarkdownRenderer content={content} />;

    case '.json':
      return <JsonContent content={content} />;

    case '.ndjson':
      return <NdjsonContent content={content} />;

    default:
      return <RawContent content={content} />;
  }
}

// ---------------------------------------------------------------------------
// JsonContent -- parses JSON and renders with JsonViewer
// ---------------------------------------------------------------------------

function JsonContent({ content }: { content: string }) {
  try {
    const data = JSON.parse(content);
    return <JsonViewer data={data} />;
  } catch {
    return (
      <div>
        <p className="text-status-blocked text-[length:var(--font-size-sm)] mb-[var(--spacing-2)]">Invalid JSON</p>
        <RawContent content={content} />
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// NdjsonContent -- renders each line as a separate JSON object
// ---------------------------------------------------------------------------

function NdjsonContent({ content }: { content: string }) {
  const lines = content
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return <p className="text-text-secondary text-[length:var(--font-size-sm)] italic">Empty NDJSON file</p>;
  }

  return (
    <div className="space-y-[var(--spacing-3)]">
      <p className="text-[length:var(--font-size-xs)] text-text-secondary mb-[var(--spacing-2)]">
        {lines.length} record{lines.length !== 1 ? 's' : ''}
      </p>
      {lines.map((line, i) => {
        try {
          const data = JSON.parse(line);
          return (
            <div key={i} className="border border-border rounded-[var(--radius-default)] p-[var(--spacing-2)] bg-bg-secondary">
              <span className="text-[length:var(--font-size-xs)] text-text-secondary mb-[var(--spacing-1)] block">#{i + 1}</span>
              <JsonViewer data={data} />
            </div>
          );
        } catch {
          return (
            <div key={i} className="border border-border rounded-[var(--radius-default)] p-[var(--spacing-2)] bg-bg-secondary">
              <span className="text-[length:var(--font-size-xs)] text-text-secondary">#{i + 1} (invalid)</span>
              <pre className="text-[length:var(--font-size-sm)] font-mono text-text-primary whitespace-pre-wrap mt-[var(--spacing-1)]">{line}</pre>
            </div>
          );
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RawContent -- monospace pre-formatted text
// ---------------------------------------------------------------------------

function RawContent({ content }: { content: string }) {
  return (
    <pre className="font-mono text-[length:var(--font-size-sm)] text-text-primary whitespace-pre-wrap break-words leading-[var(--line-height-relaxed)]">
      {content}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return '';
  return path.slice(dot).toLowerCase();
}
