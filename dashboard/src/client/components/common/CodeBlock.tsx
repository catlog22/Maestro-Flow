import { useState, useCallback, useMemo } from 'react';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// CodeBlock -- custom code block with syntax highlighting, diff coloring,
// copy button, fold/expand, and line numbers.
// Replaces default <pre><code> rendering in StreamingMarkdown.
// ---------------------------------------------------------------------------

const FOLD_THRESHOLD = 20;

export interface CodeBlockProps {
  language: string;
  value: string;
  isDiff?: boolean;
  meta?: string;
}

export function CodeBlock({ language, value, isDiff: isDiffProp, meta }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => value.split('\n'), [value]);

  // Detect diff mode: either passed as prop or detected from content
  const isDiff = isDiffProp ?? lines.some(
    (line) => line.startsWith('+') || line.startsWith('-')
  );

  // Strip trailing empty line (common from markdown fences)
  const displayLines = lines.length > 1 && lines[lines.length - 1] === ''
    ? lines.slice(0, -1)
    : lines;

  const showLineNumbers = displayLines.length >= 3;
  const isLong = displayLines.length > FOLD_THRESHOLD;
  const visibleLines = isLong && !expanded
    ? displayLines.slice(0, FOLD_THRESHOLD)
    : displayLines;
  const hiddenCount = displayLines.length - FOLD_THRESHOLD;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  // Extract title from meta string (e.g. title="example.ts")
  const title = useMemo(() => {
    if (!meta) return null;
    const match = meta.match(/title="([^"]+)"/);
    return match ? match[1] : null;
  }, [meta]);

  const displayLabel = title ?? language;

  return (
    <div className="code-block-wrapper group relative my-[var(--spacing-3)]">
      {/* Header bar */}
      {(displayLabel || true) && (
        <div
          className="flex items-center justify-between px-[var(--spacing-4)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] rounded-t-[var(--radius-md)]"
          style={{
            background: 'var(--code-bg2)',
            color: 'var(--code-t2)',
          }}
        >
          <span className="font-mono select-none">{displayLabel}</span>
          <button
            type="button"
            onClick={handleCopy}
            className={[
              'flex items-center gap-[var(--spacing-1)] px-[var(--spacing-1-5)] py-[var(--spacing-0-5)]',
              'rounded-[var(--radius-sm)] font-mono text-[length:var(--font-size-xs)]',
              'transition-colors duration-[var(--duration-fast)]',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              'hover:bg-white/5',
            ].join(' ')}
            style={{ color: 'var(--code-t2)' }}
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check size={12} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Code content */}
      <div
        className="overflow-x-auto"
        style={{ background: 'var(--code-bg)' }}
      >
        <table
          className="w-full border-collapse"
          style={{ color: 'var(--code-t1)' }}
        >
          <tbody>
            {visibleLines.map((line, i) => (
              <tr key={i} className={diffLineClass(line, isDiff)}>
                {showLineNumbers && (
                  <td
                    className="select-none text-right pr-[var(--spacing-3)] pl-[var(--spacing-4)] align-top font-mono text-[length:var(--font-size-xs)]"
                    style={{ color: 'var(--code-t2)', minWidth: '3ch' }}
                  >
                    {i + 1}
                  </td>
                )}
                <td className="pr-[var(--spacing-4)] font-mono text-[length:var(--font-size-sm)] whitespace-pre">
                  {isDiff && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) ? (
                    <>
                      <span className="code-diff-marker">{line[0]}</span>
                      <span>{line.slice(1)}</span>
                    </>
                  ) : (
                    line || '\u00A0'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fold/expand toggle */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={[
            'flex items-center justify-center w-full gap-[var(--spacing-1)]',
            'py-[var(--spacing-1)] text-[length:var(--font-size-xs)] font-mono',
            'rounded-b-[var(--radius-md)]',
            'transition-colors duration-[var(--duration-fast)]',
            'hover:bg-white/5',
          ].join(' ')}
          style={{ background: 'var(--code-bg)', color: 'var(--code-t2)' }}
        >
          {expanded ? (
            <>
              <ChevronUp size={12} />
              <span>Collapse</span>
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              <span>Expand ({hiddenCount} more lines)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

/** Determine CSS class for diff-colored lines */
function diffLineClass(line: string, isDiff: boolean): string {
  if (!isDiff) return '';
  if (line.startsWith('+')) return 'code-diff-added';
  if (line.startsWith('-')) return 'code-diff-removed';
  return '';
}
