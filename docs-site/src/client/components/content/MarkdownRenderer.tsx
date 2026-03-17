import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// ---------------------------------------------------------------------------
// MarkdownRenderer -- Notion-style markdown rendering with GFM support
// Adapted from dashboard for docs-site with heading anchor support
// ---------------------------------------------------------------------------

const components: Components = {
  // Styled code blocks with monospace font
  code({ className, children, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-bg-card px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)] text-[0.9em] font-mono text-accent-blue"
          {...props}
        >
          {children}
        </code>
      );
    }
    // Block code
    const lang = className?.replace('language-', '') ?? '';
    return (
      <div className="relative group">
        {lang && (
          <span className="absolute top-[var(--spacing-2)] right-[var(--spacing-2)] text-[length:var(--font-size-xs)] text-text-tertiary opacity-60">
            {lang}
          </span>
        )}
        <code className={`block font-mono text-[length:var(--font-size-sm)] ${className ?? ''}`} {...props}>
          {children}
        </code>
      </div>
    );
  },
  // Block-level pre wrapper
  pre({ children, ...props }) {
    return (
      <pre
        className="bg-bg-card border border-border rounded-[var(--radius-md)] p-[var(--spacing-4)] overflow-x-auto my-[var(--spacing-3)] text-text-primary"
        {...props}
      >
        {children}
      </pre>
    );
  },
  // Headings — Notion-style with anchor links
  h1({ children, id }) {
    return (
      <h1 id={id} className="group relative text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-text-primary mt-[var(--spacing-6)] mb-[var(--spacing-2)] pb-[var(--spacing-2)] border-b border-border tracking-[var(--letter-spacing-tighter)]">
        {children}
        {id && (
          <a href={`#${id}`} className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue no-underline">
            #
          </a>
        )}
      </h1>
    );
  },
  h2({ children, id }) {
    return (
      <h2 id={id} className="group relative text-[length:var(--font-size-xl)] font-[var(--font-weight-bold)] text-text-primary mt-[var(--spacing-6)] mb-[var(--spacing-2)] pb-[var(--spacing-1)] border-b border-border tracking-[var(--letter-spacing-tighter)]">
        {children}
        {id && (
          <a href={`#${id}`} className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue no-underline">
            #
          </a>
        )}
      </h2>
    );
  },
  h3({ children, id }) {
    return (
      <h3 id={id} className="group relative text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mt-[var(--spacing-6)] mb-[var(--spacing-2)] tracking-[var(--letter-spacing-tight)]">
        {children}
        {id && (
          <a href={`#${id}`} className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue no-underline">
            #
          </a>
        )}
      </h3>
    );
  },
  h4({ children, id }) {
    return (
      <h4 id={id} className="group relative text-[length:var(--font-size-md)] font-[var(--font-weight-semibold)] text-text-primary mt-[var(--spacing-6)] mb-[var(--spacing-2)] tracking-[var(--letter-spacing-tight)]">
        {children}
        {id && (
          <a href={`#${id}`} className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue no-underline">
            #
          </a>
        )}
      </h4>
    );
  },
  // Paragraphs
  p({ children }) {
    return (
      <p className="text-text-primary leading-[var(--line-height-relaxed)] my-[var(--spacing-3)] font-sans">
        {children}
      </p>
    );
  },
  // Links — Notion blue accent
  a({ href, children }) {
    return (
      <a
        href={href}
        className="text-accent-blue hover:underline transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] rounded-[var(--radius-sm)]"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  // Lists
  ul({ children }) {
    return <ul className="list-disc list-inside my-[var(--spacing-3)] space-y-[var(--spacing-1)] text-text-primary marker:text-text-tertiary">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside my-[var(--spacing-3)] space-y-[var(--spacing-1)] text-text-primary marker:text-text-tertiary">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-text-primary">{children}</li>;
  },
  // Blockquote — Notion style with left border
  blockquote({ children }) {
    return (
      <blockquote className="border-l-[3px] border-border pl-[var(--spacing-4)] my-[var(--spacing-3)] text-text-secondary italic">
        {children}
      </blockquote>
    );
  },
  // Table — Notion clean style
  table({ children }) {
    return (
      <div className="overflow-x-auto my-[var(--spacing-3)]">
        <table className="min-w-full border border-border">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-bg-secondary">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary border-b border-border">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-sm)] text-text-primary border-b border-border">
        {children}
      </td>
    );
  },
  // Horizontal rule
  hr() {
    return <hr className="border-border-divider my-[var(--spacing-4)]" />;
  },
  // Strong / em
  strong({ children }) {
    return <strong className="font-[var(--font-weight-semibold)] text-text-primary">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic text-text-secondary">{children}</em>;
  },
};

export interface MarkdownRendererProps {
  content: string;
  extractToc?: boolean;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="max-w-none text-text-primary leading-[var(--line-height-relaxed)] text-[length:var(--font-size-base)] font-sans prose prose-neutral dark:prose-invert max-w-none" role="document">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Extract headings from markdown content for table of contents
 */
export function extractToc(content: string): Array<{ id: string; level: number; text: string }> {
  const headings: Array<{ id: string; level: number; text: string }> = [];
  const headingRegex = /^(#{1,4})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    headings.push({ id, level, text });
  }

  return headings;
}
