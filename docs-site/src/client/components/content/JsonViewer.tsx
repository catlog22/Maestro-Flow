import { useState, useCallback, useMemo } from 'react';
import { useI18nContext } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// JsonViewer -- recursive collapsible JSON tree with color-coded types
// Adapted from dashboard with search and i18n support
// ---------------------------------------------------------------------------

export interface JsonViewerProps {
  data: unknown;
  searchable?: boolean;
}

export function JsonViewer({ data, searchable = true }: JsonViewerProps) {
  const { t } = useI18nContext();
  const [collapseAll, setCollapseAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    return filterBySearch(data, searchQuery.toLowerCase());
  }, [data, searchQuery]);

  return (
    <div className="font-mono text-[length:var(--font-size-sm)] leading-[var(--line-height-normal)]" role="tree" aria-label="JSON data viewer">
      <div className="flex items-center justify-between gap-[var(--spacing-2)] mb-[var(--spacing-3)] pb-[var(--spacing-2)] border-b border-border bg-bg-secondary px-[var(--spacing-2)] py-[var(--spacing-1-5)] -mx-[var(--spacing-2)] -mt-[var(--spacing-1)]">
        <button
          type="button"
          onClick={() => setCollapseAll((v) => !v)}
          aria-label={collapseAll ? t('content.expand_all') : t('content.collapse_all')}
          className={[
            'px-[var(--spacing-2)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] rounded-[var(--radius-default)]',
            'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            'active:scale-[0.98] active:duration-[var(--duration-fast)]',
          ].join(' ')}
        >
          {collapseAll ? t('content.expand_all') : t('content.collapse_all')}
        </button>
        <span className="text-[length:var(--font-size-xs)] text-text-tertiary">
          {t('content.copy')}
        </span>
      </div>
      {searchable && (
        <div className="mb-[var(--spacing-2)]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('content.search_json')}
            className={[
              'w-full px-[var(--spacing-2)] py-[var(--spacing-1)] text-[length:var(--font-size-sm)]',
              'bg-bg-card border border-border rounded-[var(--radius-default)]',
              'text-text-primary placeholder-text-tertiary',
              'focus:outline-none focus:shadow-[var(--shadow-focus-ring)]',
              'transition-all duration-[var(--duration-fast)]',
            ].join(' ')}
          />
        </div>
      )}
      <JsonNode value={filteredData} path="$" depth={0} forceCollapse={collapseAll} />
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
  const [copied, setCopied] = useState(false);

  // Sync with forceCollapse toggle
  const isCollapsed = forceCollapse ? true : collapsed;

  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
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
          className="cursor-pointer hover:opacity-70 relative"
          style={{ color: colorVar }}
          onClick={() => handleCopy(String(value))}
          title={`Copy value | Path: ${path}`}
        >
          {display}
          {copied && <CopyBadge />}
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

function CopyBadge() {
  return (
    <span className="absolute -top-1 -right-4 bg-accent-green text-bg-primary text-[length:var(--font-size-xs)] px-1 rounded">
      &#10003;
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

/**
 * Recursively filter JSON data by search query
 */
function filterBySearch(data: unknown, query: string): unknown {
  if (typeof data === 'string' && data.toLowerCase().includes(query)) {
    return data;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data).toLowerCase().includes(query) ? data : null;
  }
  if (Array.isArray(data)) {
    const filtered = data.map(item => filterBySearch(item, query)).filter(item => item !== null);
    return filtered.length > 0 ? filtered : [];
  }
  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {};
    let hasMatch = false;
    for (const [key, value] of Object.entries(data)) {
      const filtered = filterBySearch(value, query);
      if (filtered !== null && (typeof filtered !== 'object' || Object.keys(filtered).length > 0 || Array.isArray(filtered) && filtered.length > 0)) {
        result[key] = filtered;
        hasMatch = true;
      }
    }
    return hasMatch ? result : null;
  }
  return null;
}
