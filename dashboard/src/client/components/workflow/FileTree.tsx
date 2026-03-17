import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_ENDPOINTS } from '@/shared/constants.js';

// ---------------------------------------------------------------------------
// FileTree — fetches /api/artifacts?tree=true and renders a collapsible tree
//
// API response shape (from useArtifacts.ts / FileNode interface):
//   FileNode[] — nested tree where each node is:
//     { name: string; path: string; type: 'file' | 'directory'; children?: FileNode[] }
//
// The endpoint is GET /api/artifacts/?tree=true (trailing slash matches server route)
// ---------------------------------------------------------------------------

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  onSelect: (path: string) => void;
  selectedPath: string | null;
}

export function FileTree({ onSelect, selectedPath }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_ENDPOINTS.ARTIFACTS}/?tree=true`);
      if (!res.ok) {
        setError(`Could not load file tree (${res.status})`);
        return;
      }
      const data: FileNode[] = await res.json();
      setTree(data);
    } catch {
      setError('Could not load file tree');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-5 rounded bg-[var(--color-bg-active)] animate-pulse"
            style={{ width: `${60 + i * 15}%` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[length:var(--font-size-xs)] text-[var(--color-text-tertiary)] italic p-3">
        {error}
      </p>
    );
  }

  if (tree.length === 0) {
    return (
      <p className="text-[length:var(--font-size-xs)] text-[var(--color-text-tertiary)] italic p-3">
        No files available
      </p>
    );
  }

  return (
    <div role="tree" aria-label="Workflow file browser" className="py-1">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeNode — recursive directory / file node
// ---------------------------------------------------------------------------

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);

  const isSelected = node.path === selectedPath;
  const indent = depth * 14 + 8;

  const handleClick = useCallback(() => {
    if (node.type === 'directory') {
      setOpen((v) => !v);
    } else {
      onSelect(node.path);
    }
  }, [node, onSelect]);

  return (
    <div>
      <button
        type="button"
        role="treeitem"
        aria-expanded={node.type === 'directory' ? open : undefined}
        aria-selected={isSelected}
        onClick={handleClick}
        title={node.path}
        className={[
          'flex items-center gap-1.5 w-full text-left py-0.5 rounded text-[length:var(--font-size-sm)] h-7',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          isSelected
            ? 'bg-[var(--color-bg-active)] text-[var(--color-accent-blue)] border-l-2 border-l-[var(--color-accent-blue)]'
            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]',
        ].join(' ')}
        style={{ paddingLeft: indent }}
      >
        {/* Expand indicator for directories */}
        {node.type === 'directory' ? (
          <span
            className="text-[var(--color-text-tertiary)] shrink-0 select-none transition-transform duration-[var(--duration-normal)] ease-[var(--ease-notion)] inline-flex items-center justify-center w-4"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
            aria-hidden="true"
          >
            &#9656;
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* File icon */}
        <span className="shrink-0 text-[var(--color-text-secondary)] text-xs" aria-hidden="true">
          {getFileIcon(node)}
        </span>

        {/* Name */}
        <span className="truncate">{node.name}</span>
      </button>

      {/* Children with animation */}
      {node.type === 'directory' && node.children && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              {node.children.map((child) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') {
    return '\u{1F4C1}';
  }
  const dot = node.name.lastIndexOf('.');
  if (dot === -1) return '\u{1F4C4}';
  const ext = node.name.slice(dot).toLowerCase();
  switch (ext) {
    case '.md':
      return 'M';
    case '.json':
      return '{}';
    case '.ndjson':
      return '=';
    default:
      return '\u{1F4C4}';
  }
}
