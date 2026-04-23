import { useEffect, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useTeamStore } from '@/client/store/team-store.js';
import type { TeamPhaseName } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// Phase definitions — matches TeamPhaseName type
// ---------------------------------------------------------------------------

const PHASES: { key: TeamPhaseName; label: string }[] = [
  { key: 'initialization', label: 'Init' },
  { key: 'planning', label: 'Planning' },
  { key: 'execution', label: 'Execution' },
  { key: 'review', label: 'Review' },
  { key: 'completion', label: 'Complete' },
];

const PHASE_COLORS: Record<TeamPhaseName, string> = {
  initialization: '#4A90D9',
  planning: '#8B6BBF',
  execution: '#B89540',
  review: '#3D9B6F',
  completion: '#5A9E78',
};

/** Check if user prefers reduced motion */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// PhaseProgressBar - horizontal phase pipeline with animated connectors
// ---------------------------------------------------------------------------

export function PhaseProgressBar() {
  const phaseState = useTeamStore((s) => s.phaseState);
  const reduced = usePrefersReducedMotion();

  const currentPhase = phaseState?.current ?? null;
  const fixAttempts = phaseState?.fixAttempts ?? 0;
  const maxFixAttempts = 3;

  // Determine the index of the current phase (-1 if no phase state)
  const currentIndex = currentPhase ? PHASES.findIndex((p) => p.key === currentPhase) : -1;

  const motionDuration = reduced ? 0 : 0.3;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-1">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-text-placeholder">
          Phase
        </span>
        {currentPhase && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{
            background: `${PHASE_COLORS[currentPhase]}18`,
            color: PHASE_COLORS[currentPhase],
          }}>
            {currentPhase}
          </span>
        )}
      </div>

      {/* Pipeline bar */}
      <LayoutGroup>
        <div className="flex items-center px-4 py-2">
          {PHASES.map((phase, i) => {
            const isActive = phase.key === currentPhase;
            const isDone = currentIndex > i;
            const color = PHASE_COLORS[phase.key];

            return (
              <div key={phase.key} className="flex items-center">
                {/* Phase node with layout animation */}
                <motion.div
                  layout
                  className="flex flex-col items-center gap-1"
                  transition={{ duration: motionDuration, ease: 'easeOut' }}
                >
                  <motion.div
                    layout
                    className="flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isDone || isActive ? color : 'var(--color-bg-hover)',
                      ...(isActive ? {
                        boxShadow: `0 0 0 2px var(--color-bg-primary), 0 0 0 4px ${color}, 0 0 12px ${color}40`,
                      } : {}),
                    }}
                    animate={{
                      width: isActive ? 28 : 20,
                      height: isActive ? 28 : 20,
                    }}
                    transition={{ duration: motionDuration, ease: 'easeOut' }}
                  >
                    {isDone && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {isActive && !reduced && (
                      <motion.div
                        className="rounded-full bg-white"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: 8, height: 8 }}
                      />
                    )}
                    {isActive && reduced && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </motion.div>

                  {/* Label */}
                  <span
                    className={[
                      'text-[9px] font-semibold whitespace-nowrap transition-colors',
                      isActive ? 'text-text-primary' : isDone ? 'text-text-secondary' : 'text-text-placeholder',
                    ].join(' ')}
                  >
                    {phase.label}
                  </span>

                  {/* Fix attempt counter on review phase */}
                  {phase.key === 'review' && fixAttempts > 0 && (
                    <span
                      className="text-[7px] font-bold px-1 py-px rounded-full"
                      style={{
                        background: '#C4655518',
                        color: '#C46555',
                      }}
                    >
                      {fixAttempts}/{maxFixAttempts}
                    </span>
                  )}
                </motion.div>

                {/* Animated connector line between nodes */}
                {i < PHASES.length - 1 && (
                  <div className="relative h-[2px] mx-1 min-w-[20px] flex-1">
                    {/* Background track */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: 'var(--color-bg-hover)' }}
                    />
                    {/* Animated fill */}
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: isDone ? '100%' : '0%' }}
                      transition={{ duration: reduced ? 0 : 0.5, ease: 'easeOut' }}
                      style={{ backgroundColor: PHASE_COLORS[PHASES[i + 1].key] }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
