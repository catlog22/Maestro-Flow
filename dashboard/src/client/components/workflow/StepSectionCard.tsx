import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkflowStep } from '@/client/utils/parseWorkflow.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';

// ---------------------------------------------------------------------------
// StepSectionCard — collapsible card for a single workflow step
// ---------------------------------------------------------------------------

interface StepSectionCardProps {
  step: WorkflowStep;
  defaultOpen?: boolean;
}

export function StepSectionCard({ step, defaultOpen = false }: StepSectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden mb-3">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Step number badge */}
          <span className="font-mono text-xs bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded shrink-0">
            Step {step.stepNumber}
          </span>
          {/* Title */}
          <span className="text-sm font-medium text-[var(--color-text-primary)] text-left truncate">
            {step.title}
          </span>
        </div>
        {/* Chevron */}
        <span
          className="text-[var(--color-text-tertiary)] shrink-0 ml-2 select-none"
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            display: 'inline-block',
          }}
          aria-hidden="true"
        >
          &#8250;
        </span>
      </button>

      {/* Animated body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 py-3 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)]">
              <MarkdownRenderer content={step.body} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
