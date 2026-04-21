import { useEffect, useState } from 'react';
import { extractToc } from './MarkdownRenderer.js';

// ---------------------------------------------------------------------------
// FloatingToc — sticky right-side TOC with scroll tracking
// Floats alongside content with card-like styling
// ---------------------------------------------------------------------------

interface FloatingTocProps {
  content: string;
}

export function FloatingToc({ content }: FloatingTocProps) {
  const headings = extractToc(content);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block shrink-0 w-[180px]">
      <div className="sticky top-[calc(var(--size-topbar-height)+var(--spacing-6))] max-h-[calc(100vh-var(--size-topbar-height)-var(--spacing-12))] overflow-y-auto p-[var(--spacing-2)]">
        <nav aria-label="Table of contents">
          <div className="text-[length:10px] font-[var(--font-weight-semibold)] uppercase tracking-[var(--letter-spacing-wide)] text-text-tertiary mb-[var(--spacing-3)] px-[var(--spacing-1)]">
            On this page
          </div>
          <ul className="flex flex-col gap-[2px]">
            {headings.map(({ id, level, text }) => {
              const isActive = activeId === id;
              const indent = level > 2 ? (level - 2) * 10 : 0;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={[
                      'block text-[length:12px] leading-[1.5] py-[3px] px-[var(--spacing-2)] rounded-[var(--radius-sm)] transition-all duration-150 no-underline',
                      isActive
                        ? 'text-accent-blue font-[var(--font-weight-medium)] bg-tint-blue'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover',
                    ].join(' ')}
                    style={{ paddingLeft: `calc(var(--spacing-2) + ${indent}px)` }}
                  >
                    {text}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
