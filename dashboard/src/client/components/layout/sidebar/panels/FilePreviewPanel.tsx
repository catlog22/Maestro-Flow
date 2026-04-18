import { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';

// ---------------------------------------------------------------------------
// FilePreviewPanel -- displays file content preview using StreamingMarkdown
// ---------------------------------------------------------------------------
// - Subscribes to FILE_PREVIEW_REQUEST events via a lightweight pub/sub
// - Shows file content rendered as Markdown
// - Empty state when no file is selected
// ---------------------------------------------------------------------------

interface PreviewState {
  filePath: string | null;
  content: string | null;
  loading: boolean;
}

/** Simple event target for cross-component communication */
const previewTarget = new EventTarget();
const PREVIEW_EVENT = 'file-preview-change';

/** Emit a file preview request (consumed by this panel) */
export function emitFilePreview(filePath: string, content?: string) {
  previewTarget.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: { filePath, content } }));
}

export function FilePreviewPanel() {
  const [preview, setPreview] = useState<PreviewState>({
    filePath: null,
    content: null,
    loading: false,
  });

  useEffect(() => {
    function handlePreview(e: Event) {
      const detail = (e as CustomEvent).detail as { filePath: string; content?: string };
      setPreview({
        filePath: detail.filePath,
        content: detail.content ?? null,
        loading: !detail.content,
      });
    }
    previewTarget.addEventListener(PREVIEW_EVENT, handlePreview);
    return () => previewTarget.removeEventListener(PREVIEW_EVENT, handlePreview);
  }, []);

  if (!preview.filePath) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border-divider">
        <span className="text-[length:var(--font-size-xs)] text-text-secondary font-[var(--font-weight-medium)] break-all">
          {preview.filePath}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-[var(--spacing-3)]">
        {preview.loading ? (
          <div className="flex items-center gap-[var(--spacing-2)] text-text-tertiary text-[length:var(--font-size-xs)]">
            <div className="w-[12px] h-[12px] border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
            Loading preview...
          </div>
        ) : preview.content ? (
          <pre className="text-[length:var(--font-size-xs)] text-text-primary whitespace-pre-wrap break-words font-mono">
            {preview.content}
          </pre>
        ) : (
          <p className="text-[length:var(--font-size-xs)] text-text-tertiary">
            No preview available for this file.
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-[var(--spacing-2)] text-text-tertiary">
      <Eye size={24} />
      <p className="text-[length:var(--font-size-xs)]">No file selected for preview</p>
      <p className="text-[length:var(--font-size-xs)] opacity-60">
        Select a file to see its preview here
      </p>
    </div>
  );
}
