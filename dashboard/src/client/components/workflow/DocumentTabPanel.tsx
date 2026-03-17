import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/shared/constants.js';
import { parseWorkflow } from '@/client/utils/parseWorkflow.js';
import { FileTree } from './FileTree.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { StepSectionCard } from './StepSectionCard.js';

// ---------------------------------------------------------------------------
// DocumentTabPanel — split pane: file tree (left) + file content (right)
// Markdown files with Step sections are split into collapsible StepSectionCards
// ---------------------------------------------------------------------------

interface DocumentTabPanelProps {
  phaseId: number | null;
}

export function DocumentTabPanel({ phaseId: _phaseId }: DocumentTabPanelProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch file content whenever selectedFilePath changes
  useEffect(() => {
    if (!selectedFilePath) {
      setFileContent(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Encode each path segment individually to handle special characters
    const encodedPath = selectedFilePath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');

    fetch(`${API_ENDPOINTS.ARTIFACTS}/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setFileContent(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setFileContent(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFilePath]);

  const isMarkdown = selectedFilePath?.toLowerCase().endsWith('.md') ?? false;
  const isJson =
    selectedFilePath?.toLowerCase().endsWith('.json') ||
    selectedFilePath?.toLowerCase().endsWith('.ndjson');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: file tree panel */}
      <div className="w-60 shrink-0 border-r border-[var(--color-border)] overflow-y-auto bg-[var(--color-bg-secondary)] p-3">
        <FileTree onSelect={setSelectedFilePath} selectedPath={selectedFilePath} />
      </div>

      {/* Right: content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Breadcrumb / path header */}
        {selectedFilePath && (
          <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <FileBreadcrumb path={selectedFilePath} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedFilePath && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--color-text-tertiary)] text-[length:var(--font-size-sm)]">
                Select a file from the tree to view its contents
              </p>
            </div>
          )}

          {selectedFilePath && loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--color-text-secondary)] text-[length:var(--font-size-sm)] animate-pulse">
                Loading...
              </p>
            </div>
          )}

          {selectedFilePath && !loading && error && (
            <div
              role="alert"
              className="px-3 py-2 rounded border text-[length:var(--font-size-sm)]"
              style={{
                backgroundColor: 'var(--color-status-bg-blocked)',
                color: 'var(--color-status-blocked)',
                borderColor: 'var(--color-status-blocked)',
              }}
            >
              {error}
            </div>
          )}

          {selectedFilePath && !loading && !error && fileContent !== null && (
            <FileContentView content={fileContent} isMarkdown={isMarkdown} isJson={isJson ?? false} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileContentView — renders content based on file type
// ---------------------------------------------------------------------------

function FileContentView({
  content,
  isMarkdown,
  isJson,
}: {
  content: string;
  isMarkdown: boolean;
  isJson: boolean;
}) {
  if (isJson) {
    let formatted = content;
    try {
      formatted = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // Not valid JSON or NDJSON — display raw
    }
    return (
      <pre className="text-[length:var(--font-size-sm)] font-mono text-[var(--color-text-primary)] bg-[var(--color-bg-active)] rounded-lg p-4 overflow-x-auto border border-[var(--color-border)] whitespace-pre-wrap break-words">
        {formatted}
      </pre>
    );
  }

  if (isMarkdown) {
    return <MarkdownDocumentView content={content} />;
  }

  return <MarkdownRenderer content={content} />;
}

// ---------------------------------------------------------------------------
// MarkdownDocumentView — preamble + step cards for .md files
// ---------------------------------------------------------------------------

function MarkdownDocumentView({ content }: { content: string }) {
  const steps = parseWorkflow(content);

  // Preamble: content before the first Step heading
  const preamble = getPreamble(content);

  return (
    <div>
      {preamble && (
        <div className="mb-4">
          <MarkdownRenderer content={preamble} />
        </div>
      )}
      {steps.length > 0 && (
        <div>
          {steps.map((step, i) => (
            <StepSectionCard key={step.stepNumber} step={step} defaultOpen={i === 0} />
          ))}
        </div>
      )}
      {steps.length === 0 && !preamble && (
        <MarkdownRenderer content={content} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileBreadcrumb — renders path as breadcrumb segments
// ---------------------------------------------------------------------------

function FileBreadcrumb({ path }: { path: string }) {
  const segments = path.split('/');
  return (
    <nav aria-label="File path" className="flex items-center gap-1 text-[length:var(--font-size-xs)] text-[var(--color-text-secondary)] overflow-x-auto">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={`${seg}-${i}`} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-[var(--color-text-tertiary)]" aria-hidden="true">/</span>}
            <span
              className={
                isLast
                  ? 'text-[var(--color-text-primary)] font-[var(--font-weight-medium)]'
                  : 'text-[var(--color-text-secondary)]'
              }
              aria-current={isLast ? 'page' : undefined}
            >
              {seg}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract content before the first Step heading.
 * Uses same regex as parseWorkflow but stops at first match.
 */
function getPreamble(content: string): string {
  const stepRe = /^#{1,3}\s+Step\s+\d+/m;
  const match = stepRe.exec(content);
  if (!match) return content.trim();
  return content.slice(0, match.index).trim();
}
