import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down.js';
import Edit3 from 'lucide-react/dist/esm/icons/edit-3.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import { useSpecsStore, type SpecType, type SpecEntry } from '@/client/store/specs-store.js';

// ---------------------------------------------------------------------------
// SpecsTableView -- sortable, filterable table of spec entries
// ---------------------------------------------------------------------------

const BADGE_STYLES: Record<SpecType, { bg: string; text: string }> = {
  bug: { bg: 'var(--color-tint-blocked)', text: '#C46555' },
  pattern: { bg: 'var(--color-tint-exploring)', text: '#5B8DB8' },
  decision: { bg: 'var(--color-tint-planning)', text: '#9178B5' },
  rule: { bg: 'var(--color-tint-completed)', text: '#5A9E78' },
  general: { bg: 'var(--color-tint-pending)', text: '#A09D97' },
};

const DOT_COLORS: Record<SpecType, string> = {
  bug: '#C46555',
  pattern: '#5B8DB8',
  decision: '#9178B5',
  rule: '#5A9E78',
  general: '#A09D97',
};

type FilterType = 'all' | SpecType;

const FILTER_CHIPS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bug', label: 'Bug' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'decision', label: 'Decision' },
  { value: 'rule', label: 'Rule' },
];

type SortField = 'timestamp' | 'id' | 'type';
type SortDir = 'asc' | 'desc';

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

export function SpecsTableView() {
  const allEntries = useSpecsStore((s) => s.entries);
  const typeFilter = useSpecsStore((s) => s.typeFilter);
  const setTypeFilter = useSpecsStore((s) => s.setTypeFilter);
  const search = useSpecsStore((s) => s.search);
  const selectedEntry = useSpecsStore((s) => s.selectedEntry);
  const setSelectedEntry = useSpecsStore((s) => s.setSelectedEntry);
  const deleteEntry = useSpecsStore((s) => s.deleteEntry);
  const addEntry = useSpecsStore((s) => s.addEntry);

  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showNewRow, setShowNewRow] = useState(false);
  const [newType, setNewType] = useState<SpecType>('bug');
  const [newContent, setNewContent] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allEntries.length, bug: 0, pattern: 0, decision: 0, rule: 0, general: 0 };
    for (const e of allEntries) c[e.type] = (c[e.type] ?? 0) + 1;
    return c as Record<SpecType | 'all', number>;
  }, [allEntries]);

  const entries = useMemo(() => {
    let result = allEntries;
    if (typeFilter !== 'all') result = result.filter((e) => e.type === typeFilter);
    if (search) {
      const lc = search.toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(lc) || e.content.toLowerCase().includes(lc) || e.id.toLowerCase().includes(lc),
      );
    }
    return result;
  }, [allEntries, typeFilter, search]);

  const sorted = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'timestamp') {
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortField === 'id') {
        cmp = a.id.localeCompare(b.id);
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [entries, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const handleSaveNew = useCallback(async () => {
    if (!newContent.trim()) return;
    await addEntry(newType, newContent.trim(), 'learnings.md');
    setNewContent('');
    setShowNewRow(false);
  }, [newType, newContent, addEntry]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      void deleteEntry(id);
    },
    [deleteEntry],
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border-divider bg-bg-primary shrink-0">
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.04em]">
          Filter
        </span>
        {FILTER_CHIPS.map((chip) => {
          const active = typeFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTypeFilter(chip.value as FilterType)}
              className={[
                'text-[11px] font-medium px-3 py-1 rounded-full border cursor-pointer transition-all',
                'flex items-center gap-[5px]',
                active
                  ? 'bg-text-primary text-white border-text-primary'
                  : 'bg-bg-card text-text-secondary border-border hover:border-text-tertiary hover:text-text-primary',
              ].join(' ')}
            >
              {chip.value !== 'all' && (
                <span
                  className="w-[6px] h-[6px] rounded-full"
                  style={{ background: active ? '#fff' : DOT_COLORS[chip.value as SpecType] }}
                />
              )}
              {chip.label}
              <span className="text-[10px] font-mono opacity-70">
                {counts[chip.value as SpecType | 'all'] ?? 0}
              </span>
            </button>
          );
        })}

        <div className="w-px h-[18px] bg-border-divider" />

        {/* Sort button */}
        <button
          type="button"
          onClick={() => toggleSort('timestamp')}
          className="text-[11px] font-medium px-[10px] py-1 rounded-[6px] border border-border bg-bg-card text-text-tertiary cursor-pointer font-sans transition-all hover:border-text-tertiary hover:text-text-primary flex items-center gap-1 ml-auto"
        >
          <ArrowDown
            size={12}
            strokeWidth={2}
            className={sortDir === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
          {sortDir === 'desc' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th width={60} active={sortField === 'id'} onClick={() => toggleSort('id')}>
                ID
              </Th>
              <Th width={80} active={sortField === 'type'} onClick={() => toggleSort('type')}>
                Type
              </Th>
              <Th>Content</Th>
              <Th width={160}>File</Th>
              <Th width={90} active={sortField === 'timestamp'} onClick={() => toggleSort('timestamp')}>
                Added
              </Th>
              <Th width={80}>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {/* Inline new entry row */}
            {showNewRow && (
              <tr>
                <td
                  className="px-3 py-[10px] border-b-2 align-top"
                  style={{ background: 'var(--color-tint-planning)', borderBottomColor: 'rgba(145,120,181,0.3)' }}
                >
                  <span className="font-mono text-[11px] font-semibold" style={{ color: '#9178B5' }}>
                    NEW
                  </span>
                </td>
                <td
                  className="px-3 py-[10px] border-b-2 align-top"
                  style={{ background: 'var(--color-tint-planning)', borderBottomColor: 'rgba(145,120,181,0.3)' }}
                >
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as SpecType)}
                    className="px-2 py-1 rounded-[6px] border border-border bg-bg-card text-[11px] text-text-primary font-sans outline-none cursor-pointer"
                  >
                    <option value="bug">bug</option>
                    <option value="pattern">pattern</option>
                    <option value="decision">decision</option>
                    <option value="rule">rule</option>
                  </select>
                </td>
                <td
                  className="px-3 py-[10px] border-b-2 align-top"
                  style={{ background: 'var(--color-tint-planning)', borderBottomColor: 'rgba(145,120,181,0.3)' }}
                >
                  <input
                    type="text"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Describe the entry..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveNew();
                      if (e.key === 'Escape') setShowNewRow(false);
                    }}
                    className="w-full px-[10px] py-[6px] rounded-[6px] border border-border bg-bg-card text-[13px] text-text-primary font-sans outline-none focus:border-[#9178B5] transition-colors"
                  />
                </td>
                <td
                  className="px-3 py-[10px] border-b-2 align-top font-mono text-[11px] text-text-tertiary"
                  style={{ background: 'var(--color-tint-planning)', borderBottomColor: 'rgba(145,120,181,0.3)' }}
                >
                  &mdash;
                </td>
                <td
                  className="px-3 py-[10px] border-b-2 align-top font-mono text-[11px] text-text-tertiary"
                  style={{ background: 'var(--color-tint-planning)', borderBottomColor: 'rgba(145,120,181,0.3)' }}
                >
                  now
                </td>
                <td
                  className="px-3 py-[10px] border-b-2 align-top"
                  style={{ background: 'var(--color-tint-planning)', borderBottomColor: 'rgba(145,120,181,0.3)' }}
                >
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void handleSaveNew()}
                      className="px-3 py-[5px] rounded-[6px] border-none bg-text-primary text-white text-[11px] font-semibold cursor-pointer font-sans hover:bg-[#1A1816] transition-all"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewRow(false)}
                      className="px-3 py-[5px] rounded-[6px] border-none bg-bg-secondary text-text-secondary text-[11px] font-semibold cursor-pointer font-sans hover:bg-bg-tertiary transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {sorted.map((entry, idx) => (
              <TableRow
                key={entry.id}
                entry={entry}
                selected={selectedEntry === entry.id}
                onClick={() => setSelectedEntry(entry.id)}
                onDelete={handleDelete}
                index={idx}
              />
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[13px] text-text-tertiary">
                  No entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Th -- sticky table header cell
// ---------------------------------------------------------------------------

function Th({
  children,
  width,
  active,
  onClick,
}: {
  children: React.ReactNode;
  width?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      style={{ width: width ? `${width}px` : undefined }}
      onClick={onClick}
      className={[
        'sticky top-0 z-10 text-left text-[10px] font-semibold uppercase tracking-[0.06em] px-3 py-2',
        'bg-bg-secondary border-b border-border select-none whitespace-nowrap',
        onClick ? 'cursor-pointer' : '',
        active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary',
      ].join(' ')}
    >
      {children}
      {active && (
        <ArrowDown size={10} strokeWidth={2} className="inline-block align-middle ml-[3px]" />
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// TableRow -- individual table row with hover actions
// ---------------------------------------------------------------------------

function TableRow({
  entry,
  selected,
  onClick,
  onDelete,
  index,
}: {
  entry: SpecEntry;
  selected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  index: number;
}) {
  const badge = BADGE_STYLES[entry.type];

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.3) }}
      onClick={onClick}
      className={[
        'cursor-pointer transition-colors group',
        selected ? '[&>td]:bg-tint-planning' : 'hover:[&>td]:bg-bg-hover',
      ].join(' ')}
    >
      <td className="px-3 py-[10px] border-b border-border-divider align-top">
        <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">
          {entry.id}
        </span>
      </td>
      <td className="px-3 py-[10px] border-b border-border-divider align-top">
        <span
          className="text-[9px] font-bold px-[7px] py-[2px] rounded-[4px] uppercase font-mono tracking-[0.04em] whitespace-nowrap inline-block"
          style={{ background: badge.bg, color: badge.text }}
        >
          {entry.type}
        </span>
      </td>
      <td className="px-3 py-[10px] border-b border-border-divider align-top">
        <span className="text-[13px] text-text-primary font-medium leading-[1.5] max-w-[500px] block">
          {entry.content || entry.title}
        </span>
      </td>
      <td className="px-3 py-[10px] border-b border-border-divider align-top">
        <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">
          {entry.file ? entry.file.split('/').pop() : ''}
        </span>
      </td>
      <td className="px-3 py-[10px] border-b border-border-divider align-top">
        <span className="font-mono text-[11px] text-text-quaternary whitespace-nowrap">
          {formatTimestamp(entry.timestamp)}
        </span>
      </td>
      <td className="px-3 py-[10px] border-b border-border-divider align-top">
        <div className="flex gap-[2px] whitespace-nowrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="w-7 h-7 rounded-[6px] border-none bg-transparent cursor-pointer text-text-quaternary flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-bg-hover hover:text-text-primary"
          >
            <Edit3 size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={(e) => onDelete(e, entry.id)}
            className="w-7 h-7 rounded-[6px] border-none bg-transparent cursor-pointer text-text-quaternary flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-[rgba(196,101,85,0.08)] hover:text-[#C46555]"
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}
