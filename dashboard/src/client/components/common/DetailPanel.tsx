import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import X from 'lucide-react/dist/esm/icons/x.js';

// ---------------------------------------------------------------------------
// DetailPanel — animated slide-in panel from right (0→360px)
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function DetailPanel({ open, onClose, title, children }: DetailPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="shrink-0 border-l border-border bg-bg-primary overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[var(--spacing-4)] py-[var(--spacing-3)] border-b border-border-divider min-h-[48px] shrink-0">
            <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-text-primary">
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail panel"
              className={[
                'flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)]',
                'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              ].join(' ')}
            >
              <X size={14} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-[var(--spacing-4)]">
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
