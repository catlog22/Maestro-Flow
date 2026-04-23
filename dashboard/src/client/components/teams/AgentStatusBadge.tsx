import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TeamAgentRoleStatus } from '@/shared/team-types.js';
import { AGENT_STATUS_COLORS } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// AgentStatusBadge — 3-layer animation status indicator
//
// Layer 1: CSS @keyframes pulse-dot (GPU-accelerated, always-on for active states)
// Layer 2: framer-motion breathing scale/opacity (phase glow)
// Layer 3: framer-motion AnimatePresence for inline status text morphing
// ---------------------------------------------------------------------------

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

const STATUS_LABELS: Record<TeamAgentRoleStatus, string> = {
  idle: 'Idle',
  active: 'Active',
  busy: 'Busy',
  error: 'Error',
  offline: 'Offline',
};

/** Statuses that should show the pulse dot animation */
const ANIMATED_STATUSES = new Set<TeamAgentRoleStatus>(['active', 'busy']);

export function AgentStatusBadge({
  status,
  role,
}: {
  status: TeamAgentRoleStatus;
  role: string;
}) {
  const reduced = usePrefersReducedMotion();
  const color = AGENT_STATUS_COLORS[status];
  const isAnimated = ANIMATED_STATUSES.has(status);

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Layer 2: framer-motion breathing glow wrapper */}
      <motion.div
        className="relative flex items-center justify-center w-[14px] h-[14px]"
        animate={
          isAnimated && !reduced
            ? { scale: [1, 1.05, 1], opacity: [1, 0.85, 1] }
            : { scale: 1, opacity: 1 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Glow ring (visible only for animated statuses) */}
        {isAnimated && !reduced && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: `${color}20`,
              boxShadow: `0 0 6px ${color}30`,
            }}
          />
        )}

        {/* Layer 1: CSS pulse-dot (GPU-accelerated) */}
        <div
          className={isAnimated && !reduced ? 'pulse-dot' : undefined}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: color,
            animation: isAnimated && !reduced ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
            willChange: isAnimated ? 'transform, opacity' : 'auto',
          }}
        />
      </motion.div>

      {/* Layer 3: AnimatePresence text morphing for status label */}
      <div className="flex items-center gap-1 overflow-hidden">
        <span className="text-[10px] font-semibold text-text-primary">{role}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: `${color}18`, color }}
            initial={reduced ? false : { opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -6, scale: 0.9 }}
            transition={reduced ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
          >
            {STATUS_LABELS[status]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
