/**
 * Phase Gate Evaluator — computes whether a phase is ready to be marked complete.
 *
 * Called by transition-recorder before appending a transition entry.
 * Returns a structured result indicating whether completion is allowed,
 * with reasons for blocking and whether --force can override.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GateResult {
  /** Whether the phase may be marked complete */
  allowed: boolean;
  /** Human-readable reasons for blocking */
  reasons: string[];
  /** Whether --force can override (false when review verdict is BLOCK) */
  overridable: boolean;
}

/** Subset of phase index.json fields consumed by the evaluator */
export interface PhaseGateInput {
  review?: {
    verdict?: string;
    findings_count?: number;
  };
  verification?: {
    status?: string;
    gaps?: Array<{ id?: string; severity?: string; description?: string }>;
  };
  validation?: {
    status?: string;
    test_coverage?: { statements?: number; branches?: number; functions?: number; lines?: number } | number | null;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a phase is ready to transition to `completed`.
 * Pure function — no I/O.
 */
export function evaluatePhaseGate(phase: PhaseGateInput): GateResult {
  const reasons: string[] = [];
  let hasHardBlock = false;

  // Hard rule: review verdict BLOCK — not overridable
  if (phase.review?.verdict === 'BLOCK') {
    reasons.push(
      `review verdict is BLOCK (${phase.review.findings_count ?? '?'} findings)`,
    );
    hasHardBlock = true;
  }

  // Soft rule: high-severity verification gaps
  if (phase.verification?.status === 'gaps_found') {
    const gaps = phase.verification.gaps ?? [];
    const highGaps = gaps.filter((g) => g.severity === 'high' || g.severity === 'critical');
    if (highGaps.length > 0) {
      reasons.push(
        `${highGaps.length} high/critical verification gap(s): ${highGaps.map((g) => g.id ?? g.description ?? 'unknown').join(', ')}`,
      );
    }
  }

  // Soft rule: zero test coverage
  const cov = phase.validation?.test_coverage;
  if (cov != null && typeof cov === 'object' && cov.lines === 0) {
    reasons.push('0% test coverage');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    overridable: !hasHardBlock,
  };
}
