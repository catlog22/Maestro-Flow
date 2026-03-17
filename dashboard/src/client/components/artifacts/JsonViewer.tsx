import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// JsonViewer -- recursive collapsible JSON tree with color-coded types
// ---------------------------------------------------------------------------

interface JsonViewerProps {
  data: unknown;
}

export function JsonViewer({ data }: JsonViewerProps) {
  const [collapseAll, setCollapseAll] = useState(false);

  return (
    <div className="font-mono text-[length:var(--font-size-sm)] leading-[var(--line-height-normal)]" role="tree" aria-label="JSON data viewer">
      <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-3)] pb-[var(--spacing-2)] border-b border-border bg-bg-secondary px-[var(--spacing-2)] py-[var(--spacing-1-5)] -mx-[var(--spacing-2)] -mt-[var(--spacing-1)]">
        <button
          type="button"
          onClick={() => setCollapseAll((v) => !v)}
          aria-label={collapseAll ? 'Expand all' : 'Collapse all'}
          className={[
            'px-[var(--spacing-2)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] rounded-[var(--radius-default)]',
            'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            'active:scale-[0.98] active:duration-[var(--duration-fast)]',
          ].join(' ')}
        >
          {collapseAll ? 'Expand All' : 'Collapse All'}
        </button>
        <span className="text-[length:var(--font-size-xs)] text-text-tertiary">Click a value to copy</span>
      </div>
      <JsonNode value={data} path="$" depth={0} forceCollapse={collapseAll} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// JsonNode -- recursive renderer for a single JSON node
// ---------------------------------------------------------------------------

function JsonNode({
  value,
  path,
  depth,
  keyName,
  forceCollapse,
}: {
  value: unknown;
  path: string;
  depth: number;
  keyName?: string;
  forceCollapse: boolean;
}) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  // Sync with forceCollapse toggle
  const isCollapsed = forceCollapse ? true : collapsed;

  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).catch(() => {
        // Clipboard API not available
      });
    },
    [],
  );

  const indent = depth * 16;

  // Null
  if (value === null) {
    return (
      <div className="flex items-center gap-[var(--spacing-1)] hover:bg-bg-hover rounded-[var(--radius-default)] transition-colors duration-[var(--duration-fast)]" style={{ paddingLeft: indent }} role="treeitem">
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span
          className="text-text-tertiary cursor-pointer hover:opacity-70"
          onClick={() => handleCopy('null')}
          title={`Copy: null | Path: ${path}`}
        >
          null
        </span>
      </div>
    );
  }

  // Primitives
  if (typeof value !== 'object') {
    const { colorVar, display } = formatPrimitive(value);
    return (
      <div className="flex items-center gap-[var(--spacing-1)] hover:bg-bg-hover rounded-[var(--radius-default)] transition-colors duration-[var(--duration-fast)]" style={{ paddingLeft: indent }} role="treeitem">
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span
          className="cursor-pointer hover:opacity-70"
          style={{ color: colorVar }}
          onClick={() => handleCopy(String(value))}
          title={`Copy value | Path: ${path}`}
        >
          {display}
        </span>
      </div>
    );
  }

  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="flex items-center gap-[var(--spacing-1)]" style={{ paddingLeft: indent }} role="treeitem">
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-text-tertiary">[]</span>
        </div>
      );
    }
    return (
      <div>
        <div
          className="flex items-center gap-[var(--spacing-1)] cursor-pointer hover:bg-bg-hover rounded-[var(--radius-default)] px-[var(--spacing-1)] transition-colors duration-[var(--duration-fast)]"
          style={{ paddingLeft: indent }}
          onClick={() => setCollapsed((v) => !v)}
          role="treeitem"
          aria-expanded={!isCollapsed}
        >
          <Chevron open={!isCollapsed} />
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-text-tertiary">
            [{isCollapsed ? `${value.length} items` : ''}
          </span>
        </div>
        {!isCollapsed && (
          <>
            {value.map((item, i) => (
              <JsonNode
                key={i}
                value={item}
                path={`${path}[${i}]`}
                depth={depth + 1}
                keyName={String(i)}
                forceCollapse={forceCollapse}
              />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="text-text-tertiary">]</span>
            </div>
          </>
        )}
        {isCollapsed && (
          <span className="text-text-tertiary" style={{ paddingLeft: indent }}>
            ]
          </span>
        )}
      </div>
    );
  }

  // Object
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-[var(--spacing-1)]" style={{ paddingLeft: indent }} role="treeitem">
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-text-tertiary">{'{}'}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-[var(--spacing-1)] cursor-pointer hover:bg-bg-hover rounded-[var(--radius-default)] px-[var(--spacing-1)] transition-colors duration-[var(--duration-fast)]"
        style={{ paddingLeft: indent }}
        onClick={() => setCollapsed((v) => !v)}
        role="treeitem"
        aria-expanded={!isCollapsed}
      >
        <Chevron open={!isCollapsed} />
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-text-tertiary">
          {'{'}{isCollapsed ? `${entries.length} keys` : ''}
        </span>
      </div>
      {!isCollapsed && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode
              key={k}
              value={v}
              path={`${path}.${k}`}
              depth={depth + 1}
              keyName={k}
              forceCollapse={forceCollapse}
            />
          ))}
          <div style={{ paddingLeft: indent }}>
            <span className="text-text-tertiary">{'}'}</span>
          </div>
        </>
      )}
      {isCollapsed && (
        <span className="text-text-tertiary" style={{ paddingLeft: indent }}>
          {'}'}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function KeyLabel({ name }: { name: string }) {
  return (
    <span className="text-text-primary font-[var(--font-weight-medium)]">
      &quot;{name}&quot;<span className="text-text-tertiary">: </span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={[
      'text-text-tertiary text-[length:var(--font-size-xs)] w-[var(--size-icon-sm)] inline-flex items-center justify-center select-none',
      'transition-transform duration-[var(--duration-normal)] ease-[var(--ease-notion)]',
      open ? 'rotate-90' : '',
    ].join(' ')}>
      &#9656;
    </span>
  );
}

function formatPrimitive(value: unknown): { colorVar: string; display: string } {
  if (typeof value === 'string') {
    return { colorVar: 'var(--color-status-completed)', display: `"${value}"` };
  }
  if (typeof value === 'number') {
    return { colorVar: 'var(--color-accent-blue)', display: String(value) };
  }
  if (typeof value === 'boolean') {
    return { colorVar: 'var(--color-accent-yellow)', display: String(value) };
  }
  return { colorVar: 'var(--color-text-tertiary)', display: String(value) };
}
