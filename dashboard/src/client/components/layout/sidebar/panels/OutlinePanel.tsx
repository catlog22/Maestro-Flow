import { AlignLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// OutlinePanel -- document structure view (headings, sections)
// ---------------------------------------------------------------------------
// - Parses heading structure for outline display
// - Placeholder for future Markdown heading extraction
// - Empty state when no document is active
// ---------------------------------------------------------------------------

interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

export function OutlinePanel() {
  // Static placeholder. Real data will come from Markdown parsing
  // of the currently active document in the editor group.
  const items: OutlineItem[] = [];

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
        <h3 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary uppercase tracking-[var(--letter-spacing-wide)]">
          Document Outline
        </h3>
      </div>
      <nav className="flex-1 overflow-auto" aria-label="Document outline">
        <ul className="py-[var(--spacing-1)]">
          {items.map((item) => (
            <li
              key={item.id}
              className="px-[var(--spacing-3)] py-[var(--spacing-0-5)] text-[length:var(--font-size-xs)] text-text-secondary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
              style={{ paddingLeft: `calc(12px + ${(item.level - 1) * 12}px)` }}
            >
              {item.text}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-[var(--spacing-2)] text-text-tertiary">
      <AlignLeft size={24} />
      <p className="text-[length:var(--font-size-xs)]">No document outline</p>
      <p className="text-[length:var(--font-size-xs)] opacity-60">
        Open a Markdown file to see its structure
      </p>
    </div>
  );
}
