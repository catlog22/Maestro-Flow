import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import { ArrowDown } from 'lucide-react';
import { CodeBlock } from './CodeBlock.js';

// ---------------------------------------------------------------------------
// StreamingMarkdown -- unified streaming Markdown renderer with plugin pipeline.
// Features: GFM, KaTeX (lazy), syntax highlighting, scroll lock, streaming cursor.
// ---------------------------------------------------------------------------

export interface StreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
  maxHeight?: number;
  className?: string;
}

// -- Lazy KaTeX loading state (module-level singleton) --

let katexLoaded = false;
let katexLoading = false;

let katexPluginsPromise: Promise<{ remarkMath: PluggableList[number]; rehypeKatex: PluggableList[number] }> | null = null;

function loadKatex() {
  if (katexLoaded && katexPluginsPromise) return katexPluginsPromise;
  if (katexLoading && katexPluginsPromise) return katexPluginsPromise;

  katexLoading = true;

  // Inject KaTeX CSS if not already present
  if (!document.querySelector('link[data-katex-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'katex/dist/katex.min.css';
    link.dataset.katexCss = 'true';
    document.head.appendChild(link);
  }

  katexPluginsPromise = Promise.all([
    import('remark-math'),
    import('rehype-katex'),
  ]).then(([remarkMathMod, rehypeKatexMod]) => {
    katexLoaded = true;
    katexLoading = false;
    return {
      remarkMath: remarkMathMod.default as PluggableList[number],
      rehypeKatex: rehypeKatexMod.default as PluggableList[number],
    };
  });

  return katexPluginsPromise;
}

/** Detect math syntax ($ or $$) in content */
function hasMathSyntax(content: string): boolean {
  // Match $$...$$ or $...$ but not inside code fences
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(withoutCode);
}

// -- Markdown components map --

function buildMarkdownComponents(): Components {
  return {
    code({ className, children, ...props }) {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            className="bg-[var(--color-bg-active)] px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)] text-[0.9em] font-mono text-[var(--color-accent-purple)]"
            {...props}
          >
            {children}
          </code>
        );
      }

      const lang = className.replace('language-', '') ?? '';
      const value = String(children).replace(/\n$/, '');
      const isDiff = lang === 'diff' || value.split('\n').some(
        (line) => line.startsWith('+') || line.startsWith('-')
      );

      return (
        <CodeBlock language={lang} value={value} isDiff={isDiff} />
      );
    },
    pre({ children }) {
      // Let the code component handle its own wrapping; pre is passthrough
      return <>{children}</>;
    },
    h1({ children }) {
      return (
        <h1 className="text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-[var(--color-text-primary)] mt-[var(--spacing-6)] mb-[var(--spacing-3)] pb-[var(--spacing-2)] border-b border-[var(--color-border)] tracking-[var(--letter-spacing-tighter)]">
          {children}
        </h1>
      );
    },
    h2({ children }) {
      return (
        <h2 className="text-[length:var(--font-size-xl)] font-[var(--font-weight-bold)] text-[var(--color-text-primary)] mt-[var(--spacing-5)] mb-[var(--spacing-2)] pb-[var(--spacing-1)] border-b border-[var(--color-border-divider)] tracking-[var(--letter-spacing-tighter)]">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--color-text-primary)] mt-[var(--spacing-4)] mb-[var(--spacing-2)] tracking-[var(--letter-spacing-tight)]">
          {children}
        </h3>
      );
    },
    h4({ children }) {
      return (
        <h4 className="text-[length:var(--font-size-md)] font-[var(--font-weight-semibold)] text-[var(--color-text-primary)] mt-[var(--spacing-3)] mb-[var(--spacing-1)] tracking-[var(--letter-spacing-tight)]">
          {children}
        </h4>
      );
    },
    p({ children }) {
      return (
        <p className="text-[length:var(--font-size-base)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] mb-[var(--spacing-3)] font-sans">
          {children}
        </p>
      );
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-[var(--color-accent-blue)] hover:underline transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] rounded-[var(--radius-sm)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    ul({ children }) {
      return (
        <ul className="list-disc pl-[24px] mb-[var(--spacing-3)] space-y-[var(--spacing-1)] text-[var(--color-text-secondary)] marker:text-[var(--color-text-tertiary)]">
          {children}
        </ul>
      );
    },
    ol({ children }) {
      return (
        <ol className="list-decimal pl-[24px] mb-[var(--spacing-3)] space-y-[var(--spacing-1)] text-[var(--color-text-secondary)] marker:text-[var(--color-text-tertiary)]">
          {children}
        </ol>
      );
    },
    li({ children }) {
      return (
        <li className="text-[length:var(--font-size-base)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] mb-[var(--spacing-1)]">
          {children}
        </li>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-[3px] border-[var(--color-accent-purple)] pl-[var(--spacing-4)] py-[var(--spacing-2)] pr-[var(--spacing-4)] my-[var(--spacing-3)] bg-[var(--color-tint-planning)] rounded-r-[var(--radius-md)] text-[length:var(--font-size-sm)] text-[var(--color-text-secondary)] italic leading-[var(--line-height-relaxed)]">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-[var(--spacing-3)]">
          <table className="min-w-full border-collapse border border-[var(--color-border)]">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-[var(--color-bg-secondary)]">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-sm)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
          {children}
        </td>
      );
    },
    hr() {
      return <hr className="border-none h-px bg-[var(--color-border)] my-[var(--spacing-5)]" />;
    },
    strong({ children }) {
      return <strong className="font-[var(--font-weight-semibold)] text-[var(--color-text-primary)]">{children}</strong>;
    },
    em({ children }) {
      return <em className="italic text-[var(--color-text-secondary)]">{children}</em>;
    },
    // GFM task list items
    input({ checked, ...props }) {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mr-[var(--spacing-1-5)] accent-[var(--color-accent-orange)]"
          {...props}
        />
      );
    },
    // GFM strikethrough
    del({ children }) {
      return <del className="line-through text-[var(--color-text-tertiary)]">{children}</del>;
    },
  };
}

// -- Scroll lock hook --

function useScrollLock(containerRef: React.RefObject<HTMLDivElement | null>, isStreaming: boolean) {
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const isAutoScrolling = useRef(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isAutoScrolling.current) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If user is more than 40px from bottom, consider them "scrolled up"
    setUserScrolledUp(distanceFromBottom > 40);
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isAutoScrolling.current = true;
    el.scrollTop = el.scrollHeight;
    setUserScrolledUp(false);
    // Reset flag after scroll settles
    requestAnimationFrame(() => {
      isAutoScrolling.current = false;
    });
  }, [containerRef]);

  // Auto-scroll when new content arrives during streaming
  useEffect(() => {
    if (isStreaming && !userScrolledUp) {
      const el = containerRef.current;
      if (el) {
        isAutoScrolling.current = true;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
          isAutoScrolling.current = false;
        });
      }
    }
  }, [isStreaming, userScrolledUp, containerRef]);

  return { userScrolledUp, handleScroll, scrollToBottom };
}

// -- Main component --

const StreamingMarkdownInner = memo(function StreamingMarkdownInner({
  content,
  isStreaming = false,
  maxHeight,
  className,
}: StreamingMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mathEnabled, setMathEnabled] = useState(false);
  const [mathPlugins, setMathPlugins] = useState<{
    remarkMath: PluggableList[number];
    rehypeKatex: PluggableList[number];
  } | null>(null);

  // Detect math syntax and lazy-load KaTeX
  useEffect(() => {
    if (mathEnabled) return;
    if (hasMathSyntax(content)) {
      setMathEnabled(true);
      loadKatex().then((plugins) => {
        setMathPlugins(plugins);
      });
    }
  }, [content, mathEnabled]);

  // Build remark plugin array
  const remarkPlugins = useMemo<PluggableList>(() => {
    const plugins: PluggableList = [remarkGfm];
    if (mathPlugins) {
      plugins.push(mathPlugins.remarkMath);
    }
    return plugins;
  }, [mathPlugins]);

  // Build rehype plugin array
  const rehypePlugins = useMemo<PluggableList | undefined>(() => {
    if (!mathPlugins) return undefined;
    return [mathPlugins.rehypeKatex];
  }, [mathPlugins]);

  // Markdown components (stable reference)
  const components = useMemo(() => buildMarkdownComponents(), []);

  // Scroll lock
  const { userScrolledUp, handleScroll, scrollToBottom } = useScrollLock(
    containerRef,
    isStreaming,
  );

  // Streaming cursor
  const streamingCursor = isStreaming ? (
    <span
      className="inline-block w-[2px] h-[1em] ml-[1px] align-text-bottom bg-[var(--color-text-primary)]"
      style={{ animation: 'blink-cursor 1s step-end infinite' }}
      aria-hidden="true"
    />
  ) : null;

  const scrollContainerStyle = maxHeight
    ? { maxHeight: `${maxHeight}px`, overflowY: 'auto' as const }
    : undefined;

  return (
    <div
      className={`streaming-markdown ${className ?? ''}`}
      style={scrollContainerStyle}
      ref={containerRef}
      onScroll={handleScroll}
      role="document"
    >
      <div className="max-w-none text-[var(--color-text-primary)] leading-[var(--line-height-relaxed)] text-[length:var(--font-size-base)] font-sans">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
      {streamingCursor}

      {/* Scroll-to-bottom floating button */}
      {isStreaming && userScrolledUp && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={[
            'absolute bottom-[var(--spacing-4)] right-[var(--spacing-4)]',
            'flex items-center gap-[var(--spacing-1)] px-[var(--spacing-2)] py-[var(--spacing-1)]',
            'rounded-[var(--radius-full)] shadow-[var(--shadow-md)]',
            'text-[length:var(--font-size-xs)] font-mono',
            'transition-all duration-[var(--duration-fast)]',
            'hover:shadow-[var(--shadow-lg)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          ].join(' ')}
          style={{
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <ArrowDown size={12} />
          <span>Scroll to bottom</span>
        </button>
      )}
    </div>
  );
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const StreamingMarkdown = StreamingMarkdownInner;
