import { createContext, useContext, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// EditorContentContext -- provides routed Outlet content to EditorGroupLeaf
// ---------------------------------------------------------------------------
// The routed page content (Outlet) is passed through context so leaf nodes
// can render it without prop drilling through the recursive tree.
// ---------------------------------------------------------------------------

const EditorContentContext = createContext<ReactNode>(null);

export function EditorContentProvider({ children, content }: { children: ReactNode; content: ReactNode }) {
  return (
    <EditorContentContext value={content}>
      {children}
    </EditorContentContext>
  );
}

export function useEditorContent(): ReactNode {
  return useContext(EditorContentContext);
}
