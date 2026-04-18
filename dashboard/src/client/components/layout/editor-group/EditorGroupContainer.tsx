import { useEffect, useCallback, useRef, useState, type ReactNode } from 'react';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { EditorGroupTree } from './EditorGroupTree.js';
import { DropZoneOverlay, type DropZone } from './DropZoneOverlay.js';
import { EditorContentProvider } from './EditorContentContext.js';

// ---------------------------------------------------------------------------
// EditorGroupContainer -- top-level container for the editor area
// ---------------------------------------------------------------------------
// - Reads LayoutContext.editorArea binary tree and renders EditorGroupTree
// - Registers keyboard shortcuts: Ctrl+\ (split right), Ctrl+K Ctrl+\ (split down)
// - Manages drop zone overlay state for tab drag-to-split
// - Accepts children (routed Outlet) to render in default empty leaf
// ---------------------------------------------------------------------------

/** Maximum split depth allowed */
const MAX_SPLIT_DEPTH = 2;

/** Count tree depth for a given group id */
function getGroupDepth(
  node: import('@/client/types/layout-types.js').EditorGroupNode,
  targetId: string,
): number {
  if (node.type === 'leaf') return node.id === targetId ? 0 : -1;
  const first = getGroupDepth(node.first, targetId);
  if (first >= 0) return first + 1;
  const second = getGroupDepth(node.second, targetId);
  if (second >= 0) return second + 1;
  return -1;
}

/** Collect all leaf group ids in tree order */
function getLeafIds(
  node: import('@/client/types/layout-types.js').EditorGroupNode,
): string[] {
  if (node.type === 'leaf') return [node.id];
  return [...getLeafIds(node.first), ...getLeafIds(node.second)];
}

export function EditorGroupContainer({ children }: { children?: ReactNode }) {
  const { dispatch } = useLayoutContext();
  const editorArea = useLayoutSelector((s) => s.editorArea);
  const focusedGroupId = useLayoutSelector((s) => s.focusedGroupId);

  // Refs for keyboard chord state
  const ctrlKPressed = useRef(false);
  const ctrlKTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop zone overlay state
  const [dropZoneVisible, setDropZoneVisible] = useState(false);

  // Stable refs for values used in event handler
  const editorAreaRef = useRef(editorArea);
  editorAreaRef.current = editorArea;
  const focusedGroupIdRef = useRef(focusedGroupId);
  focusedGroupIdRef.current = focusedGroupId;

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const area = editorAreaRef.current;
      const groupId = focusedGroupIdRef.current;

      // Ctrl+\ -> split right
      if (e.ctrlKey && e.key === '\\' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const depth = getGroupDepth(area, groupId);
        if (depth < MAX_SPLIT_DEPTH) {
          dispatch({ type: 'SPLIT_GROUP', groupId, direction: 'horizontal' });
        }
        return;
      }

      // Ctrl+K prefix for chord shortcuts
      if (e.ctrlKey && e.key === 'k' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        ctrlKPressed.current = true;
        if (ctrlKTimer.current) clearTimeout(ctrlKTimer.current);
        ctrlKTimer.current = setTimeout(() => {
          ctrlKPressed.current = false;
        }, 1000);
        return;
      }

      // Ctrl+K Ctrl+\ -> split down
      if (ctrlKPressed.current && e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        ctrlKPressed.current = false;
        if (ctrlKTimer.current) {
          clearTimeout(ctrlKTimer.current);
          ctrlKTimer.current = null;
        }
        const depth = getGroupDepth(area, groupId);
        if (depth < MAX_SPLIT_DEPTH) {
          dispatch({ type: 'SPLIT_GROUP', groupId, direction: 'vertical' });
        }
        return;
      }

      // Ctrl+K Ctrl+Right/Left -> navigate between groups
      if (ctrlKPressed.current && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        ctrlKPressed.current = false;
        if (ctrlKTimer.current) {
          clearTimeout(ctrlKTimer.current);
          ctrlKTimer.current = null;
        }
        const leafIds = getLeafIds(area);
        const currentIdx = leafIds.indexOf(groupId);
        if (currentIdx >= 0) {
          const nextIdx = e.key === 'ArrowRight'
            ? (currentIdx + 1) % leafIds.length
            : (currentIdx - 1 + leafIds.length) % leafIds.length;
          dispatch({ type: 'SET_FOCUSED_GROUP', groupId: leafIds[nextIdx] });
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // ---- Drop zone handling ----

  const handleDrop = useCallback((zone: DropZone) => {
    setDropZoneVisible(false);
    if (!zone || zone === 'center') return;

    const direction = (zone === 'left' || zone === 'right') ? 'horizontal' : 'vertical';
    const depth = getGroupDepth(editorArea, focusedGroupId);
    if (depth >= MAX_SPLIT_DEPTH) return;

    dispatch({ type: 'SPLIT_GROUP', groupId: focusedGroupId, direction });
  }, [dispatch, editorArea, focusedGroupId]);

  return (
    <EditorContentProvider content={children ?? null}>
      <div className="flex-1 flex flex-col overflow-hidden relative bg-bg-primary">
        <EditorGroupTree node={editorArea} />
        <DropZoneOverlay
          visible={dropZoneVisible}
          onDrop={handleDrop}
        />
      </div>
    </EditorContentProvider>
  );
}
