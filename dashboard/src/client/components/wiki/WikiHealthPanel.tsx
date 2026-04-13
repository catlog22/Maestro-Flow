import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Activity from 'lucide-react/dist/esm/icons/activity.js';

import { useWikiStore } from '@/client/store/wiki-store.js';

/**
 * WikiHealthPanel — collapsible compact health summary.
 * Collapsed: single row showing score + key stats.
 * Expanded: hubs, orphans, broken links detail.
 */
export function WikiHealthPanel() {
  const { health, fetchHealth, setSelected, byId } = useWikiStore(
    useShallow((s) => ({
      health: s.health,
      fetchHealth: s.fetchHealth,
      setSelected: s.setSelected,
      byId: s.byId,
    })),
  );

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  if (!health) {
    return (
      <div className="px-3 py-2 text-[length:var(--font-size-xs)] text-text-tertiary border-b border-border">
        Loading health…
      </div>
    );
  }

  const scoreColor =
    health.score >= 80
      ? 'var(--color-accent-green, #16a34a)'
      : health.score >= 50
        ? 'var(--color-accent-yellow, #ca8a04)'
        : 'var(--color-accent-red, #dc2626)';

  return (
    <div className="border-b border-border">
      {/* Compact header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-secondary transition-colors"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className="text-text-tertiary transition-transform shrink-0"
          style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
        />
        <Activity size={12} strokeWidth={2} className="text-text-tertiary shrink-0" />
        <span className="text-[length:var(--font-size-xs)] text-text-secondary font-medium">Health</span>
        <span
          className="text-[length:var(--font-size-sm)] font-semibold ml-auto"
          style={{ color: scoreColor }}
        >
          {health.score}
        </span>
        <div className="flex gap-2 text-[length:var(--font-size-xs)] text-text-tertiary">
          <span>{health.totals.entries} entries</span>
          {health.totals.orphans > 0 && (
            <span>· {health.totals.orphans} orphans</span>
          )}
          {health.totals.brokenLinks > 0 && (
            <span className="text-accent-red">· {health.totals.brokenLinks} broken</span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-2 text-[length:var(--font-size-xs)]">
          {health.hubs.length > 0 && (
            <div>
              <div className="uppercase tracking-wider text-text-tertiary mb-1 text-[10px]">Top hubs</div>
              <ul className="flex flex-col gap-0.5">
                {health.hubs.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(h.id)}
                      className="truncate text-accent-blue hover:underline text-left"
                    >
                      {byId[h.id]?.title ?? h.id}
                    </button>
                    <span className="text-text-tertiary shrink-0">{h.inDegree}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {health.orphans.length > 0 && (
            <div>
              <div className="uppercase tracking-wider text-text-tertiary mb-1 text-[10px]">
                Orphans ({health.orphans.length})
              </div>
              <ul className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {health.orphans.slice(0, 10).map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelected(id)}
                      className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary hover:text-accent-blue hover:underline transition-colors"
                    >
                      {byId[id]?.title ?? id}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {health.brokenLinks.length > 0 && (
            <div>
              <div className="uppercase tracking-wider text-text-tertiary mb-1 text-[10px]">
                Broken ({health.brokenLinks.length})
              </div>
              <ul className="flex flex-col gap-0.5 max-h-16 overflow-y-auto text-text-secondary">
                {health.brokenLinks.slice(0, 5).map((bl, i) => (
                  <li key={`${bl.sourceId}-${i}`} className="truncate">
                    <span className="text-text-tertiary">{bl.sourceId}</span>{' → '}
                    <span className="line-through">{bl.target}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
