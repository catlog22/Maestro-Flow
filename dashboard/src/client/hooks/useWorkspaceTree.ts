import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FileNode } from './useArtifacts.js';

// ---------------------------------------------------------------------------
// FlatTreeNode -- flattened node for react-virtuoso rendering
// ---------------------------------------------------------------------------

export interface FlatTreeNode {
  node: FileNode;
  depth: number;
  parentId: string | null;
}

// ---------------------------------------------------------------------------
// useWorkspaceTree -- lazy-loading file tree with search and flatten
// ---------------------------------------------------------------------------
// - Initial fetch loads root-level only (depth=1)
// - Directories expand on demand: fetches children and merges into tree
// - Flattens visible tree for virtualized rendering
// - Search filters flattened nodes by name substring with debouncing
// ---------------------------------------------------------------------------

interface UseWorkspaceTreeOptions {
  /** Debounce delay for search filtering (default 200ms) */
  searchDebounceMs?: number;
}

export function useWorkspaceTree(options: UseWorkspaceTreeOptions = {}) {
  const { searchDebounceMs = 200 } = options;

  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Debounced search query ----
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, searchDebounceMs);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery, searchDebounceMs]);

  // ---- Initial root fetch (depth=1) ----
  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace?tree=true&depth=1');
      if (res.ok) {
        const data: FileNode[] = await res.json();
        setTree(data.map(annotateNode));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // ---- Toggle expand / lazy load children ----
  const toggleExpand = useCallback(async (node: FileNode) => {
    if (node.type !== 'directory') return;

    const path = node.path;
    const isExpanded = expandedPaths.has(path);

    if (isExpanded) {
      // Collapse
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      return;
    }

    // Expand
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });

    // Lazy load children if not already loaded
    if (!node.isLoaded) {
      try {
        const res = await fetch(`/api/workspace?tree=true&path=${encodeURIComponent(path)}&depth=1`);
        if (res.ok) {
          const children: FileNode[] = await res.json();
          setTree((prev) =>
            mergeChildren(prev, path, children.map(annotateNode), true),
          );
        }
      } catch {
        // silent -- children will show empty
      }
    }
  }, [expandedPaths]);

  // ---- Collapse all directories ----
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // ---- Flatten visible tree for rendering ----
  const flatNodes = useMemo<FlatTreeNode[]>(() => {
    const result: FlatTreeNode[] = [];
    const query = debouncedQuery.toLowerCase().trim();

    function walk(nodes: FileNode[], depth: number, parentId: string | null) {
      for (const node of nodes) {
        if (query && node.type === 'file') {
          // In search mode, only include files matching the query
          if (
            !node.name.toLowerCase().includes(query) &&
            !node.path.toLowerCase().includes(query)
          ) {
            continue;
          }
        }

        result.push({ node, depth, parentId });

        if (node.type === 'directory') {
          // In search mode, expand all directories to show matches
          const shouldRecurse = query
            ? true
            : expandedPaths.has(node.path);
          if (shouldRecurse && node.children) {
            walk(node.children, depth + 1, node.path);
          }
        }
      }
    }

    walk(tree, 0, null);
    return result;
  }, [tree, expandedPaths, debouncedQuery]);

  return {
    tree,
    flatNodes,
    loading,
    expandedPaths,
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    toggleExpand,
    collapseAll,
    refreshTree: fetchTree,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add computed fields to a node */
function annotateNode(node: FileNode): FileNode {
  const extension = node.type === 'file' && node.name.includes('.')
    ? node.name.slice(node.name.lastIndexOf('.'))
    : undefined;

  return {
    ...node,
    extension,
    isLoaded: node.isLoaded ?? (node.type === 'file' ? true : !node.children),
    children: node.children?.map(annotateNode),
  };
}

/** Merge fetched children into the tree at a specific path */
function mergeChildren(
  nodes: FileNode[],
  targetPath: string,
  newChildren: FileNode[],
  markLoaded: boolean,
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return {
        ...node,
        children: newChildren,
        isLoaded: markLoaded ? true : node.isLoaded,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: mergeChildren(node.children, targetPath, newChildren, markLoaded),
      };
    }
    return node;
  });
}
