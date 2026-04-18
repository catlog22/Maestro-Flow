import { memo } from 'react';
import type { EditorGroupNode } from '@/client/types/layout-types.js';
import { EditorGroupLeaf } from './EditorGroupLeaf.js';
import { EditorGroupBranch } from './EditorGroupBranch.js';

// ---------------------------------------------------------------------------
// EditorGroupTree -- recursive binary tree renderer
// ---------------------------------------------------------------------------
// - If node.type === 'branch': render EditorGroupBranch (PanelGroup + children)
// - If node.type === 'leaf': render EditorGroupLeaf (TabBar + content)
// - React.memo on leaf components to prevent unnecessary re-renders
// ---------------------------------------------------------------------------

interface EditorGroupTreeProps {
  node: EditorGroupNode;
}

export const EditorGroupTree = memo(function EditorGroupTree({ node }: EditorGroupTreeProps) {
  if (node.type === 'branch') {
    return <EditorGroupBranch node={node} />;
  }
  return <EditorGroupLeaf node={node} />;
});
