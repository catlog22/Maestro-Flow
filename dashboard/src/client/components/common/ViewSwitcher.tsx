import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useViewSwitcherConfig } from '@/client/hooks/useViewSwitcher.js';

// ---------------------------------------------------------------------------
// ViewSwitcher — animated pill container with sliding background indicator
// ---------------------------------------------------------------------------

export function ViewSwitcher() {
  const config = useViewSwitcherConfig();

  // Keyboard shortcuts: number keys 1/2/3/...
  useEffect(() => {
    if (!config) return;
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= config!.items.length) {
        config!.onSwitch(num - 1);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [config]);

  if (!config || config.items.length === 0) return null;

  return (
    <div className="inline-flex items-center bg-bg-tertiary rounded-[10px] p-[3px] gap-[2px]">
      {config.items.map((item, i) => {
        const isActive = i === config.activeIndex;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => config.onSwitch(i)}
            className={[
              'relative flex items-center gap-[var(--spacing-1-5)] px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[8px]',
              'text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]',
              'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
            ].join(' ')}
          >
            {isActive && (
              <motion.div
                layoutId="vs-bg"
                className="absolute inset-0 bg-bg-card rounded-[8px] shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-[var(--spacing-1-5)]">
              <span className="w-[14px] h-[14px] flex items-center justify-center">{item.icon}</span>
              <span>{item.label}</span>
              <kbd className="text-[length:9px] text-text-placeholder font-mono ml-[var(--spacing-0-5)]">
                {item.shortcut}
              </kbd>
            </span>
          </button>
        );
      })}
    </div>
  );
}
