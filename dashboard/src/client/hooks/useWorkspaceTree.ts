import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FileNode } from './useArtifacts.js';

// ---------------------------------------------------------------------------
// FlatTreeNode — flattened tree node for virtualized rendering
// ---------------------------------------------------------------------------

export interface FlatTreeNode {
  node: FileNode;
  depth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a tree into a depth-annotated list, respecting expanded set and search */
function flattenTree(
  nodes: FileNode[],
  expandedPaths: Set<string>,
  searchQuery: string,
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];
  const lc = searchQuery.toLowerCase();

  function walk(items: FileNode[], depth: number): void {
    for (const node of items) {
      // If searching, include files matching query; directories only if descendants match
      if (lc) {
        if (node.type === 'file') {
          if (!node.name.toLowerCase().includes(lc) && !node.path.toLowerCase().includes(lc)) {
            continue;
          }
        }
      }

      result.push({ node, depth });

      // Expand directories when searching or when explicitly expanded
      if (node.type === 'directory' && node.children) {
        if (lc || expandedPaths.has(node.path)) {
          walk(node.children, depth + 1);
        }
      }
    }
  }

  walk(nodes, 0);
  return result;
}

/** Collect all directory paths from a tree */
function collectDirPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  function walk(items: FileNode[]) {
    for (const node of items) {
      if (node.type === 'directory') {
        paths.push(node.path);
        if (node.children) walk(node.children);
      }
    }
  }
  walk(nodes);
  return paths;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkspaceTree() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace?tree=true');
      if (res.ok) {
        setTree(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const toggleExpand = useCallback((node: FileNode) => {
    if (node.type !== 'directory') return;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const flatNodes = useMemo(
    () => flattenTree(tree, expandedPaths, searchQuery),
    [tree, expandedPaths, searchQuery],
  );

  return {
    tree,
    loading,
    refreshTree: fetchTree,
    flatNodes,
    expandedPaths,
    searchQuery,
    setSearchQuery,
    toggleExpand,
    collapseAll,
  };
}
