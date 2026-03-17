import { useMemo } from 'react';
import { motion } from 'framer-motion';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import Code from 'lucide-react/dist/esm/icons/code.js';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import { useSpecsStore, type SpecType, type SpecEntry } from '@/client/store/specs-store.js';

// ---------------------------------------------------------------------------
// SpecsKanbanView -- 4-column kanban grouped by spec type
// ---------------------------------------------------------------------------

interface SpecsKanbanViewProps {
  onAddEntry: () => void;
}

// Type configuration: icon, color, label
const TYPE_CONFIG: Record<
  Exclude<SpecType, 'general'>,
  { label: string; icon: React.ReactNode; tintBg: string; color: string; dotColor: string }
> = {
  bug: {
    label: 'Bugs',
    icon: <AlertCircle size={14} strokeWidth={1.8} />,
    tintBg: 'var(--color-tint-blocked)',
    color: '#C46555',
    dotColor: '#C46555',
  },
  pattern: {
    label: 'Patterns',
    icon: <Code size={14} strokeWidth={1.8} />,
    tintBg: 'var(--color-tint-exploring)',
    color: '#5B8DB8',
    dotColor: '#5B8DB8',
  },
  decision: {
    label: 'Decisions',
    icon: <BarChart3 size={14} strokeWidth={1.8} />,
    tintBg: 'var(--color-tint-planning)',
    color: '#9178B5',
    dotColor: '#9178B5',
  },
  rule: {
    label: 'Rules',
    icon: <Shield size={14} strokeWidth={1.8} />,
    tintBg: 'var(--color-tint-completed)',
    color: '#5A9E78',
    dotColor: '#5A9E78',
  },
};

const COLUMN_ORDER: Exclude<SpecType, 'general'>[] = ['bug', 'pattern', 'decision', 'rule'];

const BADGE_STYLES: Record<SpecType, { bg: string; text: string }> = {
  bug: { bg: 'var(--color-tint-blocked)', text: '#C46555' },
  pattern: { bg: 'var(--color-tint-exploring)', text: '#5B8DB8' },
  decision: { bg: 'var(--color-tint-planning)', text: '#9178B5' },
  rule: { bg: 'var(--color-tint-completed)', text: '#5A9E78' },
  general: { bg: 'var(--color-tint-pending)', text: '#A09D97' },
};

function formatTimestamp(ts: string): string {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--';
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SpecsKanbanView({ onAddEntry }: SpecsKanbanViewProps) {
  const entries = useSpecsStore((s) => s.entries);
  const typeFilter = useSpecsStore((s) => s.typeFilter);
  const search = useSpecsStore((s) => s.search);
  const selectedEntry = useSpecsStore((s) => s.selectedEntry);
  const setSelectedEntry = useSpecsStore((s) => s.setSelectedEntry);

  const grouped = useMemo(() => {
    let filtered = entries;
    if (typeFilter !== 'all') filtered = filtered.filter((e) => e.type === typeFilter);
    if (search) {
      const lc = search.toLowerCase();
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(lc) || e.content.toLowerCase().includes(lc) || e.id.toLowerCase().includes(lc),
      );
    }
    const result: Record<SpecType, SpecEntry[]> = { bug: [], pattern: [], decision: [], rule: [], general: [] };
    for (const e of filtered) (result[e.type] ?? result.general).push(e);
    return result;
  }, [entries, typeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { bug: 0, pattern: 0, decision: 0, rule: 0, general: 0 };
    for (const e of entries) c[e.type] = (c[e.type] ?? 0) + 1;
    return c;
  }, [entries]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-border-divider bg-bg-primary shrink-0">
        {COLUMN_ORDER.map((type) => {
          const cfg = TYPE_CONFIG[type];
          return (
            <div key={type} className="flex items-center gap-[6px] text-[11px] font-medium text-text-secondary">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: cfg.dotColor }}
              />
              <span className="font-mono font-semibold text-text-primary">{counts[type]}</span>
              {cfg.label}
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 flex-1 overflow-x-auto p-3">
        {COLUMN_ORDER.map((type, colIdx) => {
          const cfg = TYPE_CONFIG[type];
          const items = grouped[type] ?? [];
          return (
            <div
              key={type}
              className="flex flex-col min-w-[280px] flex-1 bg-bg-secondary rounded-[12px] overflow-hidden"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-[14px] py-3 border-b border-black/[0.04]">
                <div
                  className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ background: cfg.tintBg, color: cfg.color }}
                >
                  {cfg.icon}
                </div>
                <span className="text-[13px] font-bold text-text-primary">{cfg.label}</span>
                <span className="text-[10px] text-text-tertiary bg-bg-card px-[6px] rounded-full font-mono">
                  {items.length}
                </span>
                <button
                  type="button"
                  onClick={onAddEntry}
                  className="ml-auto w-6 h-6 rounded-[6px] border border-dashed border-border bg-transparent cursor-pointer flex items-center justify-center text-text-quaternary hover:border-text-tertiary hover:text-text-primary hover:bg-bg-card transition-all"
                >
                  <Plus size={12} strokeWidth={2} />
                </button>
              </div>

              {/* Column body (scrollable cards) */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {items.map((entry, idx) => (
                  <SpecCard
                    key={entry.id}
                    entry={entry}
                    selected={selectedEntry === entry.id}
                    onClick={() => setSelectedEntry(entry.id)}
                    index={colIdx * 100 + idx}
                  />
                ))}
                {items.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-[11px] text-text-quaternary">
                    No entries
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpecCard -- individual card in the kanban column
// ---------------------------------------------------------------------------

function SpecCard({
  entry,
  selected,
  onClick,
  index,
}: {
  entry: SpecEntry;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  const badge = BADGE_STYLES[entry.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className={[
        'bg-bg-card rounded-[10px] px-[14px] py-3 border cursor-pointer',
        'transition-all duration-[180ms]',
        'hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-border',
        selected
          ? 'border-[#9178B5] shadow-[0_0_0_2px_rgba(145,120,181,0.2)]'
          : 'border-border-divider',
      ].join(' ')}
    >
      {/* Top: type badge + id */}
      <div className="flex items-center gap-[6px] mb-2">
        <span
          className="text-[9px] font-bold px-[7px] py-[2px] rounded-[4px] uppercase font-mono tracking-[0.04em]"
          style={{ background: badge.bg, color: badge.text }}
        >
          {entry.type}
        </span>
        <span className="text-[10px] font-mono text-text-quaternary ml-auto">{entry.id}</span>
      </div>

      {/* Content (3-line clamp) */}
      <div className="text-[13px] text-text-primary font-medium leading-[1.5] mb-2 line-clamp-3">
        {entry.content || entry.title}
      </div>

      {/* Meta: timestamp + file */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-quaternary font-mono flex items-center gap-[3px]">
          <Clock size={10} strokeWidth={2} />
          {formatTimestamp(entry.timestamp)}
        </span>
        {entry.file && (
          <span className="text-[10px] text-text-tertiary flex items-center gap-[3px] ml-auto">
            <FileText size={10} strokeWidth={2} />
            {entry.file.split('/').pop()}
          </span>
        )}
      </div>
    </motion.div>
  );
}
