// ---------------------------------------------------------------------------
// SmartStrategy — priority + executor affinity + failure avoidance
// ---------------------------------------------------------------------------

import type { DispatchStrategy, DispatchContext, DispatchDecision } from '../dispatch-strategy.js';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class SmartStrategy implements DispatchStrategy {
  readonly name = 'smart';

  async selectIssues(context: DispatchContext): Promise<DispatchDecision[]> {
    if (context.availableSlots <= 0) return [];

    // Determine which executor types are currently in use
    const busyExecutors = new Map<string, number>();
    for (const slot of context.runningSlots.values()) {
      busyExecutors.set(slot.executor, (busyExecutors.get(slot.executor) ?? 0) + 1);
    }

    const scored = context.issues
      .filter(
        (i) =>
          i.status === 'open' &&
          (!i.execution || i.execution.status === 'idle') &&
          !context.claimed.has(i.id),
      )
      .map((issue) => {
        const executor = issue.executor ?? context.config.defaultExecutor;
        const priorityScore = PRIORITY_ORDER[issue.priority] ?? 3;
        // Prefer executors with fewer running slots (load balancing)
        const affinityScore = busyExecutors.get(executor) ?? 0;
        // Penalize if previous execution failed (avoid re-failing)
        const failurePenalty = issue.execution?.lastError ? 2 : 0;

        return {
          issue,
          score: priorityScore + affinityScore + failurePenalty,
        };
      })
      .sort((a, b) => a.score - b.score);

    const decisions: DispatchDecision[] = [];
    for (const { issue, score } of scored) {
      if (decisions.length >= context.availableSlots) break;
      decisions.push({
        issueId: issue.id,
        executor: issue.executor ?? undefined,
        reason: `smart_score=${score}`,
      });
    }

    return decisions;
  }
}
