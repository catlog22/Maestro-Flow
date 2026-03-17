import { motion, AnimatePresence } from 'framer-motion';
import type { TaskCard, TaskStatus } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// TaskDetailDrawer — slide-in drawer showing full task details
// ---------------------------------------------------------------------------

interface TaskDetailDrawerProps {
  task: TaskCard | null;
  onClose: () => void;
}

const SECTION_HEADER = 'text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2';
const SECTION_CONTAINER = 'bg-[var(--color-bg-primary)] rounded-lg p-3';

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending: 'bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)]',
  in_progress: 'bg-blue-950/40 text-blue-400',
  completed: 'bg-green-950/40 text-green-400',
  failed: 'bg-red-950/40 text-red-400',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

export function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  return (
    <AnimatePresence>
      {task && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs bg-blue-950/30 text-blue-400 px-2 py-1 rounded shrink-0">
                  {task.id}
                </span>
                <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {task.title}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] ml-2 shrink-0 transition-colors"
                aria-label="Close drawer"
              >
                &#x2715;
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Section 1: Description */}
              {task.description && (
                <div>
                  <p className={SECTION_HEADER}>Description</p>
                  <div className={SECTION_CONTAINER}>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      {task.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Section 2: Meta */}
              <div>
                <p className={SECTION_HEADER}>Meta</p>
                <div className={`${SECTION_CONTAINER} flex flex-wrap gap-2`}>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[task.meta.status]}`}>
                    {STATUS_LABELS[task.meta.status]}
                  </span>
                  {task.priority && (
                    <span className="bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] text-[10px] px-2 py-0.5 rounded-full">
                      Priority: {task.priority}
                    </span>
                  )}
                  {task.effort && (
                    <span className="bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] text-[10px] px-2 py-0.5 rounded-full">
                      Effort: {task.effort}
                    </span>
                  )}
                  <span className="bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] text-[10px] px-2 py-0.5 rounded-full">
                    Wave {task.meta.wave}
                  </span>
                  {task.meta.autonomous && (
                    <span className="bg-purple-950/40 text-purple-400 text-[10px] px-2 py-0.5 rounded-full">
                      Autonomous
                    </span>
                  )}
                </div>
              </div>

              {/* Section 3: Convergence Criteria */}
              {task.convergence.criteria.length > 0 && (
                <div>
                  <p className={SECTION_HEADER}>Acceptance Criteria</p>
                  <div className={SECTION_CONTAINER}>
                    <ul className="space-y-1.5">
                      {task.convergence.criteria.map((criterion, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                          <span className="text-[var(--color-text-tertiary)] shrink-0 mt-0.5">-</span>
                          <span className="leading-snug">{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Section 4: Files */}
              {task.files.length > 0 && (
                <div>
                  <p className={SECTION_HEADER}>Files</p>
                  <div className={`${SECTION_CONTAINER} overflow-x-auto`}>
                    <table className="w-full text-xs min-w-[320px]">
                      <thead>
                        <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                          <th className="pb-1.5 pr-3 font-medium">Path</th>
                          <th className="pb-1.5 pr-3 font-medium">Action</th>
                          <th className="pb-1.5 font-medium">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {task.files.map((file, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-3 font-mono text-[var(--color-text-secondary)] truncate max-w-[160px]" title={file.path}>
                              {file.path.split('/').pop() ?? file.path}
                            </td>
                            <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)] whitespace-nowrap">
                              {file.action}
                            </td>
                            <td className="py-1.5 text-[var(--color-text-tertiary)] truncate max-w-[120px]" title={file.change}>
                              {file.change}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 5: Implementation Steps */}
              {task.implementation.length > 0 && (
                <div>
                  <p className={SECTION_HEADER}>Implementation</p>
                  <div className={SECTION_CONTAINER}>
                    <ol className="space-y-1.5 list-none">
                      {task.implementation.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                          <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-hover)] px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* Section 6: Test / Manual Checks */}
              {task.test.unit.length > 0 || task.test.integration.length > 0 || task.test.commands.length > 0 ? (
                <div>
                  <p className={SECTION_HEADER}>Tests</p>
                  <div className={SECTION_CONTAINER}>
                    {task.test.commands.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wide">Commands</p>
                        <ul className="space-y-1">
                          {task.test.commands.map((cmd, i) => (
                            <li key={i} className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-hover)] px-2 py-1 rounded">
                              {cmd}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {task.test.unit.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wide">Unit</p>
                        <ul className="space-y-1">
                          {task.test.unit.map((check, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                              <span className="text-[var(--color-text-tertiary)] shrink-0">-</span>
                              <span>{check}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {task.test.integration.length > 0 && (
                      <div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wide">Integration</p>
                        <ul className="space-y-1">
                          {task.test.integration.map((check, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                              <span className="text-[var(--color-text-tertiary)] shrink-0">-</span>
                              <span>{check}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
