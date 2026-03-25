import { useState, useMemo, useCallback } from 'react';
import { useExecutionStore } from '@/client/store/execution-store.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';
import type { PriorityAction } from '@/shared/commander-types.js';
import type { AgentType } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// CommanderRecommendationsBar — shows deferred/pending Commander actions
// ---------------------------------------------------------------------------

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  create_issue: { bg: 'rgba(91, 141, 184, 0.1)', text: '#5B8DB8' },
  execute_issue: { bg: 'rgba(90, 158, 120, 0.1)', text: '#5A9E78' },
  analyze_issue: { bg: 'rgba(145, 120, 181, 0.1)', text: '#9178B5' },
  plan_issue: { bg: 'rgba(145, 120, 181, 0.1)', text: '#9178B5' },
  advance_phase: { bg: 'rgba(184, 149, 64, 0.1)', text: '#B89540' },
  flag_blocker: { bg: 'rgba(196, 101, 85, 0.1)', text: '#C46555' },
};

interface RecommendationItem {
  decisionId: string;
  action: PriorityAction;
  timestamp: string;
}

export function CommanderRecommendationsBar() {
  const recentDecisions = useExecutionStore((s) => s.recentDecisions);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const recommendations = useMemo<RecommendationItem[]>(() => {
    const items: RecommendationItem[] = [];
    for (const decision of recentDecisions) {
      for (const action of decision.deferred) {
        const key = `${decision.id}-${action.type}-${action.target}`;
        if (!dismissed.has(key)) {
          items.push({ decisionId: decision.id, action, timestamp: decision.timestamp });
        }
      }
    }
    return items.slice(-5);
  }, [recentDecisions, dismissed]);

  const handleApprove = useCallback((item: RecommendationItem) => {
    if (item.action.type === 'execute_issue') {
      sendWsMessage({
        action: 'execute:issue',
        issueId: item.action.target,
        executor: (item.action.executor ?? 'claude-code') as AgentType,
      });
    }
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(`${item.decisionId}-${item.action.type}-${item.action.target}`);
      return next;
    });
  }, []);

  const handleDismiss = useCallback((item: RecommendationItem) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(`${item.decisionId}-${item.action.type}-${item.action.target}`);
      return next;
    });
  }, []);

  if (recommendations.length === 0) return null;

  return (
    <div className="border-b border-border-divider bg-bg-secondary">
      <div className="flex items-center justify-between px-[var(--spacing-4)] py-[var(--spacing-1-5)]">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent-blue animate-pulse" />
          Commander Recommendations ({recommendations.length})
          <svg
            className={`w-3 h-3 transition-transform duration-150 ${collapsed ? '' : 'rotate-180'}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-[var(--spacing-2)] px-[var(--spacing-4)] pb-[var(--spacing-2)]">
          {recommendations.map((item) => {
            const colors = ACTION_COLORS[item.action.type] ?? { bg: 'var(--color-bg-secondary)', text: 'var(--color-text-secondary)' };
            return (
              <div
                key={`${item.decisionId}-${item.action.type}-${item.action.target}`}
                className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-[var(--radius-md)] text-[length:var(--font-size-xs)]"
                style={{ backgroundColor: colors.bg }}
              >
                <span className="font-[var(--font-weight-medium)]" style={{ color: colors.text }}>
                  {item.action.type.replace('_', ' ')}
                </span>
                <span className="text-text-secondary truncate max-w-[200px]" title={item.action.target}>
                  {item.action.target}
                </span>
                {item.action.reason && (
                  <span className="text-text-tertiary truncate max-w-[150px]" title={item.action.reason}>
                    — {item.action.reason}
                  </span>
                )}
                <div className="flex items-center gap-[var(--spacing-1)] ml-auto">
                  {item.action.type === 'execute_issue' && (
                    <button
                      type="button"
                      onClick={() => handleApprove(item)}
                      className="text-[10px] font-[var(--font-weight-medium)] px-[var(--spacing-2)] py-[var(--spacing-0-5)] rounded-full transition-colors"
                      style={{ backgroundColor: 'rgba(90, 158, 120, 0.15)', color: '#5A9E78' }}
                    >
                      Approve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDismiss(item)}
                    className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors px-1"
                  >
                    x
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
