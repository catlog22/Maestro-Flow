import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Database from 'lucide-react/dist/esm/icons/database.js';
import Code from 'lucide-react/dist/esm/icons/code.js';
import Folder from 'lucide-react/dist/esm/icons/folder.js';
import GlobeIcon from 'lucide-react/dist/esm/icons/globe.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import { useMcpStore } from '@/client/store/mcp-store.js';
import type { McpTemplate } from '@/client/store/mcp-store.js';

// ---------------------------------------------------------------------------
// McpTemplatesView -- template store with category filters and install
// ---------------------------------------------------------------------------

/** Map category names to icon + color */
const CATEGORY_META: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  database: { icon: <Database size={18} strokeWidth={1.8} />, bg: 'rgba(91,141,184,0.08)', color: 'var(--color-accent-blue, #5B8DB8)' },
  search: { icon: <Search size={18} strokeWidth={1.8} />, bg: 'rgba(145,120,181,0.08)', color: 'var(--color-status-planning, #9178B5)' },
  code: { icon: <Code size={18} strokeWidth={1.8} />, bg: 'rgba(90,158,120,0.08)', color: 'var(--color-status-completed, #5A9E78)' },
  filesystem: { icon: <Folder size={18} strokeWidth={1.8} />, bg: 'rgba(184,149,64,0.08)', color: 'var(--color-status-idle, #B89540)' },
  api: { icon: <GlobeIcon size={18} strokeWidth={1.8} />, bg: 'rgba(200,134,58,0.08)', color: 'var(--color-status-verifying, #C8863A)' },
  utility: { icon: <Wrench size={18} strokeWidth={1.8} />, bg: 'rgba(160,157,151,0.08)', color: 'var(--color-text-tertiary, #A09D97)' },
};

/** Map tag names to colors */
const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  database: { bg: 'rgba(91,141,184,0.12)', color: 'var(--color-accent-blue, #5B8DB8)' },
  sql: { bg: 'rgba(90,158,120,0.12)', color: 'var(--color-status-completed, #5A9E78)' },
  search: { bg: 'rgba(145,120,181,0.12)', color: 'var(--color-status-planning, #9178B5)' },
  code: { bg: 'rgba(90,158,120,0.12)', color: 'var(--color-status-completed, #5A9E78)' },
  tools: { bg: 'rgba(90,158,120,0.12)', color: 'var(--color-status-completed, #5A9E78)' },
  filesystem: { bg: 'rgba(184,149,64,0.12)', color: 'var(--color-status-idle, #B89540)' },
  files: { bg: 'rgba(184,149,64,0.12)', color: 'var(--color-status-idle, #B89540)' },
  api: { bg: 'rgba(200,134,58,0.12)', color: 'var(--color-status-verifying, #C8863A)' },
  web: { bg: 'rgba(200,134,58,0.12)', color: 'var(--color-status-verifying, #C8863A)' },
  docs: { bg: 'rgba(145,120,181,0.12)', color: 'var(--color-status-planning, #9178B5)' },
  research: { bg: 'rgba(200,134,58,0.12)', color: 'var(--color-status-verifying, #C8863A)' },
};

const CATEGORY_CHIP_COLORS: Record<string, string> = {
  database: 'var(--color-accent-blue, #5B8DB8)',
  search: 'var(--color-status-planning, #9178B5)',
  code: 'var(--color-status-completed, #5A9E78)',
  filesystem: 'var(--color-status-idle, #B89540)',
  api: 'var(--color-status-verifying, #C8863A)',
  utility: 'var(--color-text-tertiary, #A09D97)',
};

export function McpTemplatesView() {
  const allTemplates = useMcpStore((s) => s.templates);
  const categories = useMcpStore((s) => s.categories);
  const servers = useMcpStore((s) => s.servers);
  const templateSearch = useMcpStore((s) => s.templateSearch);
  const templateCategory = useMcpStore((s) => s.templateCategory);

  const filteredTemplates = useMemo(() => {
    let result = allTemplates;
    if (templateCategory) result = result.filter((t) => t.category === templateCategory);
    if (templateSearch) {
      const lc = templateSearch.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(lc) || (t.description?.toLowerCase().includes(lc) ?? false),
      );
    }
    return result;
  }, [allTemplates, templateSearch, templateCategory]);
  const setTemplateSearch = useMcpStore((s) => s.setTemplateSearch);
  const setTemplateCategory = useMcpStore((s) => s.setTemplateCategory);
  const installTemplate = useMcpStore((s) => s.installTemplate);

  // Compute installed set from server names
  const installedNames = useMemo(
    () => new Set(servers.map((s) => s.name.toLowerCase())),
    [servers],
  );

  // Category counts
  const catCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of allTemplates) {
      if (t.category) {
        map[t.category] = (map[t.category] ?? 0) + 1;
      }
    }
    return map;
  }, [allTemplates]);

  const installedCount = useMemo(
    () => allTemplates.filter((t) => installedNames.has(t.name.toLowerCase())).length,
    [allTemplates, installedNames],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Stats strip */}
      <div className="flex items-center gap-5 px-5 py-2 border-b border-border-divider bg-bg-primary shrink-0">
        <StatItem color="var(--color-status-planning, #9178B5)" value={allTemplates.length} label="Templates" />
        <StatItem color="var(--color-accent-blue, #5B8DB8)" value={categories.length} label="Categories" />
        <StatItem color="var(--color-status-completed, #5A9E78)" value={installedCount} label="Installed" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[10px] px-5 py-2 border-b border-border-divider shrink-0">
        {/* Search */}
        <div className="flex items-center gap-[6px] px-3 py-[6px] rounded-[var(--radius-lg)] bg-bg-card border border-border w-[260px] focus-within:border-[var(--color-status-planning,#9178B5)] transition-colors">
          <Search size={13} strokeWidth={2} className="text-text-tertiary shrink-0" />
          <input
            type="text"
            placeholder="Search templates..."
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            className="border-none bg-transparent outline-none text-[12px] text-text-primary w-full placeholder:text-text-tertiary"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-[6px]">
          <button
            type="button"
            onClick={() => setTemplateCategory(null)}
            className={[
              'flex items-center gap-1 px-[10px] py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all cursor-pointer',
              templateCategory === null
                ? 'bg-text-primary text-white border-text-primary'
                : 'bg-bg-card text-text-tertiary border-border hover:border-text-tertiary hover:text-text-secondary',
            ].join(' ')}
          >
            All
            <span className="font-mono text-[9px] opacity-60">{allTemplates.length}</span>
          </button>
          {categories.map((cat) => {
            const isActive = templateCategory === cat;
            const chipColor = CATEGORY_CHIP_COLORS[cat.toLowerCase()];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setTemplateCategory(isActive ? null : cat)}
                className={[
                  'flex items-center gap-1 px-[10px] py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all cursor-pointer',
                  isActive
                    ? 'bg-text-primary text-white border-text-primary'
                    : 'bg-bg-card text-text-tertiary border-border hover:border-text-tertiary hover:text-text-secondary',
                ].join(' ')}
              >
                {chipColor && !isActive && (
                  <span className="w-[6px] h-[6px] rounded-full" style={{ background: chipColor }} />
                )}
                {cat}
                <span className="font-mono text-[9px] opacity-60">{catCounts[cat] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* New Template button */}
        <button
          type="button"
          className="flex items-center gap-[6px] px-[14px] py-[6px] rounded-[var(--radius-lg)] border-none bg-text-primary text-white text-[11px] font-semibold cursor-pointer transition-all hover:-translate-y-px hover:shadow-md whitespace-nowrap"
        >
          <Plus size={13} strokeWidth={2} />
          New Template
        </button>
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {filteredTemplates.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-[length:var(--font-size-sm)]">
            No templates found
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
            {filteredTemplates.map((tpl, i) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                installed={installedNames.has(tpl.name.toLowerCase())}
                delay={i * 0.04}
                onInstall={() => void installTemplate(tpl.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

function StatItem({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-[6px]">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[16px] font-extrabold text-text-primary font-mono">{value}</span>
      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.04em]">{label}</span>
    </div>
  );
}

function TemplateCard({
  template,
  installed,
  delay,
  onInstall,
}: {
  template: McpTemplate;
  installed: boolean;
  delay: number;
  onInstall: () => void;
}) {
  const cat = template.category?.toLowerCase() ?? '';
  const meta = CATEGORY_META[cat] ?? CATEGORY_META.utility;

  const commandText = template.serverConfig.command
    ? `${template.serverConfig.command}${template.serverConfig.args?.length ? ' ' + template.serverConfig.args.join(' ') : ''}`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      className="bg-bg-card border border-border rounded-[10px] p-[14px] transition-all duration-200 cursor-pointer flex flex-col gap-[10px] hover:border-text-tertiary hover:shadow-md hover:-translate-y-[2px]"
    >
      {/* Head: icon + info */}
      <div className="flex items-start gap-[10px]">
        <div
          className="w-9 h-9 rounded-[var(--radius-lg)] shrink-0 flex items-center justify-center"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-text-primary">{template.name}</div>
          {template.description && (
            <div className="text-[11px] text-text-secondary leading-[1.5] mt-[2px] line-clamp-2">
              {template.description}
            </div>
          )}
        </div>
      </div>

      {/* Command */}
      {commandText && (
        <div className="font-mono text-[10px] text-text-secondary bg-bg-secondary rounded-[var(--radius-md)] px-[10px] py-[6px] whitespace-nowrap overflow-hidden text-ellipsis">
          {commandText}
        </div>
      )}

      {/* Footer: tags + install */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {(template.tags ?? []).map((tag) => {
            const tc = TAG_COLORS[tag.toLowerCase()] ?? { bg: 'rgba(160,157,151,0.12)', color: 'var(--color-text-tertiary)' };
            return (
              <span
                key={tag}
                className="text-[9px] font-semibold px-[6px] py-[2px] rounded-[4px] uppercase tracking-[0.03em]"
                style={{ background: tc.bg, color: tc.color }}
              >
                {tag}
              </span>
            );
          })}
        </div>

        {installed ? (
          <span
            className="flex items-center gap-1 px-[10px] py-1 rounded-[var(--radius-md)] border text-[10px] font-semibold whitespace-nowrap"
            style={{
              borderColor: 'var(--color-status-completed, #5A9E78)',
              color: 'var(--color-status-completed, #5A9E78)',
              background: 'rgba(90,158,120,0.06)',
            }}
          >
            <Check size={10} strokeWidth={2.5} />
            Installed
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInstall(); }}
            className="flex items-center gap-1 px-[10px] py-1 rounded-[var(--radius-md)] border border-border bg-bg-card text-[10px] font-semibold text-text-secondary transition-all hover:border-[var(--color-status-completed,#5A9E78)] hover:text-[var(--color-status-completed,#5A9E78)] hover:bg-[rgba(90,158,120,0.04)] whitespace-nowrap cursor-pointer"
          >
            <Download size={10} strokeWidth={2.5} />
            Install
          </button>
        )}
      </div>
    </motion.div>
  );
}
