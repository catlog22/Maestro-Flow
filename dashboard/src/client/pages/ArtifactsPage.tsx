import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.js';
import Code from 'lucide-react/dist/esm/icons/code.js';
import { useArtifacts } from '@/client/hooks/useArtifacts.js';
import { TreeBrowser } from '@/client/components/artifacts/TreeBrowser.js';
import { ReaderView } from '@/client/components/artifacts/ReaderView.js';
import { GalleryView } from '@/client/components/artifacts/GalleryView.js';
import { StructuredView } from '@/client/components/artifacts/StructuredView.js';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';

// ---------------------------------------------------------------------------
// ArtifactsPage -- multi-view artifacts browser with shared file tree
// ---------------------------------------------------------------------------

type ArtifactView = 'reader' | 'gallery' | 'structured';

const VIEW_ITEMS = [
  { label: 'Reader', icon: <FileText size={14} strokeWidth={2} />, shortcut: '1' },
  { label: 'Gallery', icon: <LayoutGrid size={14} strokeWidth={2} />, shortcut: '2' },
  { label: 'Structured', icon: <Code size={14} strokeWidth={2} />, shortcut: '3' },
] as const;

const VIEWS: ArtifactView[] = ['reader', 'gallery', 'structured'];

const viewVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function ArtifactsPage() {
  const [activeView, setActiveView] = useState<ArtifactView>('reader');
  const { tree, selectedPath, content, loading, treeLoading, error, selectFile } =
    useArtifacts();

  // Register ViewSwitcher items in TopBar
  const { register, unregister } = useContext(ViewSwitcherContext);

  useEffect(() => {
    register({
      items: VIEW_ITEMS.map((v) => ({ label: v.label, icon: v.icon, shortcut: v.shortcut })),
      activeIndex: VIEWS.indexOf(activeView),
      onSwitch: (index: number) => setActiveView(VIEWS[index]),
    });
  }, [activeView, register]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);

  // Keyboard shortcut: 1/2/3 to switch views
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') setActiveView('reader');
      else if (e.key === '2') setActiveView('gallery');
      else if (e.key === '3') setActiveView('structured');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Shared file tree panel */}
      <div className="w-[260px] shrink-0 border-r border-border overflow-hidden flex flex-col">
        <TreeBrowser
          tree={tree}
          selectedPath={selectedPath}
          onSelectFile={selectFile}
          loading={treeLoading}
        />
      </div>

      {/* Right: Animated view content */}
      <div className="flex-1 overflow-hidden relative min-w-0">
        <AnimatePresence mode="wait">
          {activeView === 'reader' && (
            <motion.div
              key="reader"
              className="absolute inset-0 flex flex-col"
              variants={viewVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <ReaderView
                content={content}
                path={selectedPath}
                onNavigate={selectFile}
                loading={loading}
                error={error}
              />
            </motion.div>
          )}

          {activeView === 'gallery' && (
            <motion.div
              key="gallery"
              className="absolute inset-0 flex flex-col"
              variants={viewVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <GalleryView
                tree={tree}
                onSelectFile={selectFile}
                selectedPath={selectedPath}
              />
            </motion.div>
          )}

          {activeView === 'structured' && (
            <motion.div
              key="structured"
              className="absolute inset-0 flex flex-col"
              variants={viewVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <StructuredView
                content={content}
                path={selectedPath}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
