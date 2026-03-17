import { useState, useMemo, useCallback, type ReactNode } from 'react';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Folder from 'lucide-react/dist/esm/icons/folder.js';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import FileJson from 'lucide-react/dist/esm/icons/file-json.js';
import Database from 'lucide-react/dist/esm/icons/database.js';
import type { FileNode } from '@/client/hooks/useArtifacts.js';

// ---------------------------------------------------------------------------
// TreeBrowser -- collapsible directory tree with filter and file type icons
// ---------------------------------------------------------------------------

interface TreeBrowserProps {
  tree: FileNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  loading?: boolean;
}

export function TreeBrowser({ tree, selectedPath, onSelectFile, loading }: TreeBrowserProps) {
  const [filter, setFilter] = useState('');

  // Filter tree nodes by fuzzy match on name/path
  const filteredTree = useMemo(() => {
    if (!filter.trim()) return tree;
    const q = filter.toLowerCase();
    return filterNodes(tree, q);
  }, [tree, filter]);

  if (loading) {
    return (
      <div className="p-[var(--spacing-3)]">
        <p className="text-[length:var(--font-size-xs)] text-text-secondary animate-pulse">Loading tree...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary" role="tree" aria-label="File browser">
      {/* Header */}
      <div className="flex items-center gap-[var(--spacing-2)] px-[14px] py-[10px] border-b border-border-divider shrink-0">
        <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-text-primary">Artifacts</span>
        <span className="text-[10px] text-text-tertiary ml-auto font-mono">{countAllFiles(filteredTree)}</span>
      </div>

      {/* Filter input */}
      <div className="px-[10px] py-[var(--spacing-2)] shrink-0">
        <div className={[
          'flex items-center gap-[var(--spacing-1-5)] px-[10px] py-[5px]',
          'bg-bg-secondary border border-border-divider rounded-[var(--radius-md)]',
          'focus-within:border-accent-purple',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        ].join(' ')}>
          <Search size={12} strokeWidth={2} className="text-text-tertiary shrink-0" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search files..."
            aria-label="Search files"
            className="w-full bg-transparent border-none outline-none text-[11px] text-text-primary placeholder:text-text-placeholder font-[inherit]"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-[var(--spacing-1)] px-0" role="group">
        {filteredTree.length === 0 ? (
          <p className="text-[length:var(--font-size-xs)] text-text-secondary italic px-[var(--spacing-2)] py-[var(--spacing-1)]">
            {filter ? 'No matches' : 'No artifacts'}
          </p>
        ) : (
          filteredTree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              defaultOpen={!filter.trim()}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeItem -- single directory or file node
// ---------------------------------------------------------------------------

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
  defaultOpen,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(depth < 1 || !defaultOpen);

  const handleClick = useCallback(() => {
    if (node.type === 'directory') {
      setOpen((v) => !v);
    } else {
      onSelectFile(node.path);
    }
  }, [node, onSelectFile]);

  const isSelected = node.path === selectedPath;
  const indent = depth * 12 + 4;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        role="treeitem"
        aria-expanded={node.type === 'directory' ? open : undefined}
        aria-selected={isSelected}
        className={[
          'flex items-center gap-[var(--spacing-1-5)] w-full text-left px-[10px] py-[4px] text-[length:var(--font-size-sm)]',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)] border-none bg-transparent',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          isSelected
            ? 'bg-bg-active'
            : 'hover:bg-bg-hover',
        ].join(' ')}
        style={{ paddingLeft: indent }}
        title={node.path}
      >
        {/* Expand/collapse indicator for directories */}
        {node.type === 'directory' ? (
          <svg
            className={[
              'w-[var(--size-icon-sm)] h-[var(--size-icon-sm)] text-text-tertiary shrink-0',
              'transition-transform duration-[var(--duration-normal)] ease-[var(--ease-notion)]',
              open ? 'rotate-90' : '',
            ].join(' ')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <span className="w-[var(--size-icon-sm)] shrink-0" />
        )}

        {/* Icon */}
        <span className="shrink-0 text-text-secondary" aria-hidden="true">{getIcon(node, open)}</span>

        {/* Name */}
        <span className={[
          'truncate',
          node.type === 'directory'
            ? 'font-[var(--font-weight-semibold)] text-text-primary'
            : isSelected
              ? 'font-[var(--font-weight-semibold)] text-text-primary'
              : 'text-text-secondary',
        ].join(' ')}>{node.name}</span>

        {/* File type badge */}
        {node.type === 'file' && <FileTypeBadge name={node.name} />}

        {/* Directory: phase status badge or child count */}
        {node.type === 'directory' && (
          <PhaseBadgeOrCount node={node} />
        )}
      </button>

      {/* Render children */}
      {node.type === 'directory' && open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              defaultOpen={defaultOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** File type icon based on extension and state */
function getIcon(node: FileNode, isOpen?: boolean): ReactNode {
  if (node.type === 'directory') {
    return isOpen
      ? <FolderOpen size={14} strokeWidth={1.8} style={{ color: 'var(--color-accent-yellow)' }} />
      : <Folder size={14} strokeWidth={1.8} style={{ color: 'var(--color-accent-yellow)' }} />;
  }
  const ext = node.name.slice(node.name.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.json':
      return <FileJson size={14} strokeWidth={1.8} />;
    case '.ndjson':
    case '.jsonl':
      return <Database size={14} strokeWidth={1.8} />;
    default:
      return <FileText size={14} strokeWidth={1.8} />;
  }
}

/** Count total files in a directory node recursively */
function countFiles(node: FileNode): number {
  if (node.type === 'file') return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

/** Count all files across an array of tree roots */
function countAllFiles(nodes: FileNode[]): number {
  return nodes.reduce((sum, node) => sum + countFiles(node), 0);
}

/** File type badge for tree items */
function FileTypeBadge({ name }: { name: string }) {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  let label = '';
  let bg = '';
  let color = '';

  switch (ext) {
    case '.json':
      label = 'JSON';
      bg = 'var(--color-status-bg-executing)';
      color = 'var(--color-accent-yellow)';
      break;
    case '.md':
      label = 'MD';
      bg = 'var(--color-status-bg-exploring)';
      color = 'var(--color-accent-blue)';
      break;
    case '.ndjson':
    case '.jsonl':
      label = 'JSONL';
      bg = 'var(--color-status-bg-verifying)';
      color = 'var(--color-accent-orange)';
      break;
    default:
      return null;
  }

  return (
    <span
      className="ml-auto text-[9px] font-[var(--font-weight-semibold)] px-[5px] py-[1px] rounded-[var(--radius-sm)] font-mono shrink-0 uppercase"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

/** Phase status badge or child count for directory nodes */
function PhaseBadgeOrCount({ node }: { node: FileNode }) {
  // Check if directory name matches a phase pattern (e.g., "01-project-setup")
  const phaseMatch = node.name.match(/^(\d{2})-/);
  if (phaseMatch) {
    // Infer status from name conventions
    const statusMap: Record<string, { label: string; bg: string; color: string }> = {
      setup: { label: 'Done', bg: 'var(--color-status-bg-completed)', color: 'var(--color-status-completed)' },
      complete: { label: 'Done', bg: 'var(--color-status-bg-completed)', color: 'var(--color-status-completed)' },
    };

    // Default phase badge by presence of children
    const childCount = node.children ? countFiles(node) : 0;
    const hasContent = childCount > 0;

    // Try to match known status keywords in the name
    const nameLower = node.name.toLowerCase();
    for (const [keyword, style] of Object.entries(statusMap)) {
      if (nameLower.includes(keyword)) {
        return (
          <span
            className="ml-auto text-[9px] font-[var(--font-weight-semibold)] px-[5px] rounded-full shrink-0"
            style={{ background: style.bg, color: style.color }}
          >
            {style.label}
          </span>
        );
      }
    }

    // Generic phase badge
    if (hasContent) {
      return (
        <span
          className="ml-auto text-[9px] font-[var(--font-weight-semibold)] px-[5px] rounded-full shrink-0"
          style={{ background: 'var(--color-status-bg-exploring)', color: 'var(--color-accent-blue)' }}
        >
          {childCount}
        </span>
      );
    }
  }

  // Default: show child count for directories
  if (node.children) {
    return (
      <span className="text-text-tertiary ml-auto text-[length:var(--font-size-xs)] shrink-0">
        {countFiles(node)}
      </span>
    );
  }

  return null;
}

/** Filter tree nodes by query, keeping matching files and their ancestor directories */
function filterNodes(nodes: FileNode[], query: string): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      if (
        node.name.toLowerCase().includes(query) ||
        node.path.toLowerCase().includes(query)
      ) {
        result.push(node);
      }
    } else {
      // Directory -- recurse and include if any children match
      const filteredChildren = node.children
        ? filterNodes(node.children, query)
        : [];
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      } else if (node.name.toLowerCase().includes(query)) {
        result.push(node);
      }
    }
  }
  return result;
}
