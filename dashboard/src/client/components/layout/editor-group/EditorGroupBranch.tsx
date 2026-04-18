import { memo, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { Layout } from 'react-resizable-panels';
import { useLayoutContext } from '@/client/components/layout/LayoutContext.js';
import type { EditorGroupBranch as EditorGroupBranchType } from '@/client/types/layout-types.js';
import { EditorGroupTree } from './EditorGroupTree.js';

// ---------------------------------------------------------------------------
// EditorGroupBranch -- renders a PanelGroup split with two child panels
// ---------------------------------------------------------------------------
// - Wraps react-resizable-panels Group component
// - Two Panel children with defaultSize from branch.ratio, minSize 15%
// - Separator with drag resize and double-click to reset 50/50
// - onLayoutChanged callback syncs ratio to LayoutContext via RESIZE_GROUP
// ---------------------------------------------------------------------------

interface EditorGroupBranchProps {
  node: EditorGroupBranchType;
}

/** Minimum panel size as percentage to prevent invisible panels */
const MIN_PANEL_SIZE_PERCENT = 15;

export const EditorGroupBranch = memo(function EditorGroupBranch({ node }: EditorGroupBranchProps) {
  const { dispatch } = useLayoutContext();
  const firstSizePercent = Math.round(node.ratio * 100);
  const secondSizePercent = 100 - firstSizePercent;

  const handleLayoutChanged = useCallback((layout: Layout) => {
    // Layout is a map of panel id -> percentage
    const firstId = `${node.id}-first`;
    const firstPercent = layout[firstId];
    if (typeof firstPercent === 'number') {
      const newRatio = firstPercent / 100;
      // Only dispatch if changed significantly (avoid floating point noise)
      if (Math.abs(newRatio - node.ratio) > 0.005) {
        dispatch({ type: 'RESIZE_GROUP', branchId: node.id, ratio: newRatio });
      }
    }
  }, [dispatch, node.id, node.ratio]);

  return (
    <Group
      orientation={node.direction}
      id={node.id}
      className="h-full"
      onLayoutChanged={handleLayoutChanged}
    >
      <Panel
        id={`${node.id}-first`}
        defaultSize={`${firstSizePercent}%`}
        minSize={`${MIN_PANEL_SIZE_PERCENT}%`}
        className="overflow-hidden"
        style={{ minWidth: 'var(--size-editor-min-width)', minHeight: 'var(--size-editor-min-height)' }}
      >
        <EditorGroupTree node={node.first} />
      </Panel>

      <Separator
        id={`${node.id}-sep`}
        className="group relative flex-shrink-0"
        style={{
          width: node.direction === 'horizontal' ? '1px' : undefined,
          height: node.direction === 'vertical' ? '1px' : undefined,
          backgroundColor: 'var(--color-border)',
          transition: 'background-color 150ms ease',
        }}
      >
        {/* Hover/active highlight for the separator */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            backgroundColor: 'var(--color-border-focused)',
            width: node.direction === 'horizontal' ? '3px' : '100%',
            height: node.direction === 'vertical' ? '3px' : '100%',
            left: node.direction === 'horizontal' ? '-1px' : '0',
            top: node.direction === 'vertical' ? '-1px' : '0',
          }}
        />
      </Separator>

      <Panel
        id={`${node.id}-second`}
        defaultSize={`${secondSizePercent}%`}
        minSize={`${MIN_PANEL_SIZE_PERCENT}%`}
        className="overflow-hidden"
        style={{ minWidth: 'var(--size-editor-min-width)', minHeight: 'var(--size-editor-min-height)' }}
      >
        <EditorGroupTree node={node.second} />
      </Panel>
    </Group>
  );
});
