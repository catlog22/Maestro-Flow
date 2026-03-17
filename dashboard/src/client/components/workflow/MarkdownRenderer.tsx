import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import type { Components } from 'react-markdown';

// ---------------------------------------------------------------------------
// MarkdownRenderer — markdown renderer for workflow document tab
// Supports GFM (tables, strikethrough, task lists) + code copy button
// ---------------------------------------------------------------------------

function CopyableCodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = typeof children === 'string' ? children : String(children ?? '');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lang = className?.replace('language-', '') ?? '';

  return (
    <div className="relative group my-[var(--spacing-3)]">
      <pre className="bg-[var(--color-bg-active)] rounded-lg p-4 text-sm overflow-x-auto text-[var(--color-text-primary)] border border-[var(--color-border)]">
        {lang && (
          <span className="absolute top-2 left-4 text-[length:var(--font-size-xs)] text-[var(--color-text-tertiary)] opacity-60 font-mono select-none">
            {lang}
          </span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className={[
            'absolute top-2 right-2 px-2 py-0.5 rounded text-[length:var(--font-size-xs)] font-mono',
            'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
            'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]',
            'transition-colors duration-[var(--duration-fast)] opacity-0 group-hover:opacity-100',
            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          ].join(' ')}
          aria-label="Copy code"
        >
          {copied ? '✓' : 'Copy'}
        </button>
        <code className={`block font-mono text-[length:var(--font-size-sm)] ${lang ? 'mt-4' : ''} ${className ?? ''}`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

const components: Components = {
  // code: inline vs block detection via className presence
  code({ className, children, ...props }) {
    const isBlock = Boolean(className);
    if (!isBlock) {
      return (
        <code
          className="bg-[var(--color-bg-active)] px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)] text-[0.9em] font-mono text-[var(--color-accent-blue)]"
          {...props}
        >
          {children}
        </code>
      );
    }
    // Block code is handled by pre wrapping CopyableCodeBlock
    return (
      <code className={`font-mono text-[length:var(--font-size-sm)] ${className ?? ''}`} {...props}>
        {children}
      </code>
    );
  },
  // pre: wrap with copy button for block code
  pre({ children, ...props }) {
    // Extract className from child code element to detect language
    const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }> | null;
    const codeClassName = child?.props?.className;
    const codeChildren = child?.props?.children;

    return (
      <CopyableCodeBlock className={codeClassName} {...props}>
        {codeChildren ?? children}
      </CopyableCodeBlock>
    );
  },
  // Headings
  h1({ children }) {
    return (
      <h1 className="text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-[var(--color-text-primary)] mt-[var(--spacing-6)] mb-[var(--spacing-2)] pb-[var(--spacing-2)] border-b border-[var(--color-border)]">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="text-[length:var(--font-size-xl)] font-[var(--font-weight-bold)] text-[var(--color-text-primary)] mt-[var(--spacing-5)] mb-[var(--spacing-2)] pb-[var(--spacing-1)] border-b border-[var(--color-border)]">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--color-text-primary)] mt-[var(--spacing-4)] mb-[var(--spacing-2)]">
        {children}
      </h3>
    );
  },
  h4({ children }) {
    return (
      <h4 className="text-[length:var(--font-size-md)] font-[var(--font-weight-semibold)] text-[var(--color-text-primary)] mt-[var(--spacing-3)] mb-[var(--spacing-1)]">
        {children}
      </h4>
    );
  },
  // Paragraphs
  p({ children }) {
    return (
      <p className="text-[var(--color-text-primary)] leading-[var(--line-height-relaxed)] my-[var(--spacing-3)] font-sans">
        {children}
      </p>
    );
  },
  // Links
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
  // Lists
  ul({ children }) {
    return (
      <ul className="list-disc list-inside my-[var(--spacing-3)] space-y-[var(--spacing-1)] text-[var(--color-text-primary)] marker:text-[var(--color-text-tertiary)]">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="list-decimal list-inside my-[var(--spacing-3)] space-y-[var(--spacing-1)] text-[var(--color-text-primary)] marker:text-[var(--color-text-tertiary)]">
        {children}
      </ol>
    );
  },
  li({ children }) {
    return <li className="text-[var(--color-text-primary)]">{children}</li>;
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-[3px] border-[var(--color-border)] pl-[var(--spacing-4)] my-[var(--spacing-3)] text-[var(--color-text-secondary)] italic">
        {children}
      </blockquote>
    );
  },
  // Table
  table({ children }) {
    return (
      <div className="overflow-x-auto my-[var(--spacing-3)]">
        <table className="min-w-full border-collapse border border-[var(--color-border)]">{children}</table>
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
  // Horizontal rule
  hr() {
    return <hr className="border-[var(--color-border)] my-[var(--spacing-4)]" />;
  },
  // Strong / em
  strong({ children }) {
    return <strong className="font-[var(--font-weight-semibold)] text-[var(--color-text-primary)]">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic text-[var(--color-text-secondary)]">{children}</em>;
  },
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={`text-[var(--color-text-primary)] leading-[var(--line-height-relaxed)] text-[length:var(--font-size-base)] font-sans ${className ?? ''}`}
      role="document"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
