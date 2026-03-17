import { useState, useMemo } from 'react';
import { ContentRenderer } from '@/client/components/artifacts/ContentRenderer.js';
import FileJson from 'lucide-react/dist/esm/icons/file-json.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Circle from 'lucide-react/dist/esm/icons/circle.js';

// ---------------------------------------------------------------------------
// StructuredView -- key-value grid display for JSON, fallback for others
// ---------------------------------------------------------------------------

interface StructuredViewProps {
  content: string | null;
  path: string | null;
}

export function StructuredView({ content, path }: StructuredViewProps) {
  const [rawMode, setRawMode] = useState(false);

  if (!path || content === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-secondary">
        <p className="text-[length:var(--font-size-lg)] mb-[var(--spacing-2)]">Select a file</p>
        <p className="text-[length:var(--font-size-sm)]">Choose a JSON artifact to view its structure</p>
      </div>
    );
  }

  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  const isJson = ext === '.json';
  const fileName = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;

  // Non-JSON files fall back to ContentRenderer
  if (!isJson) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <StructuredHeader
          fileName={fileName}
          path={path}
          isJson={false}
          rawMode={false}
          onToggle={() => {}}
        />
        <div className="flex-1 overflow-hidden">
          <ContentRenderer content={content} path={path} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StructuredHeader
        fileName={fileName}
        path={path}
        isJson
        rawMode={rawMode}
        onToggle={() => setRawMode((v) => !v)}
      />

      <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
        <div className="max-w-[780px] mx-auto">
          {rawMode ? (
            <RawJsonBlock content={content} />
          ) : (
            <StructuredContent content={content} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function StructuredHeader({
  fileName,
  path,
  isJson,
  rawMode,
  onToggle,
}: {
  fileName: string;
  path: string;
  isJson: boolean;
  rawMode: boolean;
  onToggle: () => void;
}) {
  const Icon = isJson ? FileJson : FileText;
  const iconBg = isJson ? 'rgba(184,149,64,0.10)' : 'rgba(91,141,184,0.10)';
  const iconColor = isJson ? 'var(--color-accent-yellow)' : 'var(--color-accent-blue)';

  return (
    <div className="flex items-center gap-[var(--spacing-3)] px-[24px] py-[10px] border-b border-border-divider shrink-0">
      <div
        className="w-7 h-7 rounded-[var(--radius-default)] flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={14} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-[var(--font-weight-bold)] text-text-primary truncate">{fileName}</div>
        <div className="text-[10px] font-mono text-text-tertiary truncate">{path}</div>
      </div>

      {isJson && (
        <div className="flex gap-[var(--spacing-1)]">
          <button
            type="button"
            onClick={onToggle}
            className={[
              'px-[10px] py-[var(--spacing-1)] rounded-[var(--radius-default)] border text-[10px] font-[var(--font-weight-semibold)]',
              'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              !rawMode
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-bg-card text-text-secondary border-border hover:border-text-tertiary hover:text-text-primary',
            ].join(' ')}
          >
            Structured
          </button>
          <button
            type="button"
            onClick={onToggle}
            className={[
              'px-[10px] py-[var(--spacing-1)] rounded-[var(--radius-default)] border text-[10px] font-[var(--font-weight-semibold)]',
              'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              rawMode
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-bg-card text-text-secondary border-border hover:border-text-tertiary hover:text-text-primary',
            ].join(' ')}
          >
            Raw
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StructuredContent -- renders parsed JSON as key-value sections
// ---------------------------------------------------------------------------

function StructuredContent({ content }: { content: string }) {
  const data = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!data || typeof data !== 'object') {
    return <RawJsonBlock content={content} />;
  }

  if (Array.isArray(data)) {
    return (
      <div className="flex flex-col gap-[var(--spacing-4)]">
        {data.map((item, i) => (
          <JsonSection key={i} title={`Item ${i + 1}`} data={item} />
        ))}
      </div>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      {entries.map(([key, value]) => {
        // Render arrays of objects as sections with cards
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          return (
            <div key={key}>
              <SectionHeader title={key} badge={`${value.length}`} />
              <div className="flex flex-col gap-[var(--spacing-1-5)]">
                {value.map((item, i) => {
                  if (isGapItem(item)) {
                    return <GapCard key={i} data={item} />;
                  }
                  if (isChecklistItem(item)) {
                    return <ChecklistItem key={i} data={item} />;
                  }
                  return <JsonSection key={i} title={`#${i + 1}`} data={item} />;
                })}
              </div>
            </div>
          );
        }

        // Nested object as its own section
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return <JsonSection key={key} title={key} data={value} />;
        }

        // Simple key-value
        return null;
      })}

      {/* Render all simple key-value pairs as one section */}
      <SimpleKvSection data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)] pb-[var(--spacing-1-5)] border-b border-border-divider">
      <span className="text-[11px] font-[var(--font-weight-bold)] uppercase tracking-[0.06em] text-text-tertiary">
        {title}
      </span>
      {badge && (
        <span
          className="text-[10px] font-[var(--font-weight-semibold)] px-[var(--spacing-1-5)] py-[1px] rounded-full"
          style={{ background: 'rgba(91,141,184,0.12)', color: 'var(--color-accent-blue)' }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function JsonSection({ title, data }: { title: string; data: unknown }) {
  if (typeof data !== 'object' || data === null) {
    return (
      <div>
        <SectionHeader title={title} />
        <div className="text-[13px] text-text-primary">{String(data)}</div>
      </div>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);

  return (
    <div>
      <SectionHeader title={title} />
      <div className="flex flex-col">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className="grid grid-cols-[140px_1fr] gap-[var(--spacing-3)] py-[var(--spacing-1-5)] border-b border-border-divider last:border-b-0 items-start"
          >
            <span className="text-[11px] font-[var(--font-weight-semibold)] text-text-tertiary font-mono pt-[1px]">
              {key}
            </span>
            <KvValue value={val} />
          </div>
        ))}
      </div>
    </div>
  );
}

function KvValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-[13px] text-text-placeholder italic">null</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span
        className="text-[10px] font-[var(--font-weight-semibold)] px-[var(--spacing-2)] py-[2px] rounded-full inline-flex items-center gap-[var(--spacing-1)]"
        style={{
          background: value ? 'rgba(90,158,120,0.12)' : 'rgba(160,157,151,0.12)',
          color: value ? 'var(--color-status-completed)' : 'var(--color-text-tertiary)',
        }}
      >
        {value ? <CheckCircle2 size={10} strokeWidth={2.5} /> : <Circle size={10} strokeWidth={2.5} />}
        {String(value)}
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-[13px] font-mono text-accent-blue">{value}</span>;
  }

  if (typeof value === 'string') {
    // Status-like strings
    if (/^(completed|done|passed|active|success)$/i.test(value)) {
      return (
        <span
          className="text-[10px] font-[var(--font-weight-semibold)] px-[var(--spacing-2)] py-[2px] rounded-full inline-flex items-center gap-[var(--spacing-1)]"
          style={{ background: 'rgba(90,158,120,0.12)', color: 'var(--color-status-completed)' }}
        >
          <CheckCircle2 size={10} strokeWidth={2.5} />
          {value}
        </span>
      );
    }
    if (/^(blocked|failed|error)$/i.test(value)) {
      return (
        <span
          className="text-[10px] font-[var(--font-weight-semibold)] px-[var(--spacing-2)] py-[2px] rounded-full"
          style={{ background: 'var(--color-status-bg-blocked)', color: 'var(--color-status-blocked)' }}
        >
          {value}
        </span>
      );
    }
    if (/^(in.?progress|running|executing)$/i.test(value)) {
      return (
        <span
          className="text-[10px] font-[var(--font-weight-semibold)] px-[var(--spacing-2)] py-[2px] rounded-full"
          style={{ background: 'rgba(91,141,184,0.12)', color: 'var(--color-accent-blue)' }}
        >
          {value}
        </span>
      );
    }
    return <span className="text-[13px] text-text-primary">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[13px] text-text-placeholder italic">[]</span>;
    // Simple string array
    if (value.every((v) => typeof v === 'string')) {
      return (
        <div className="flex flex-wrap gap-[var(--spacing-1)]">
          {value.map((v, i) => (
            <span key={i} className="text-[11px] px-[var(--spacing-2)] py-[2px] rounded-[var(--radius-default)] bg-bg-secondary text-text-secondary">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return <span className="text-[13px] font-mono text-text-secondary">[{value.length} items]</span>;
  }

  if (typeof value === 'object') {
    return <span className="text-[13px] font-mono text-text-secondary">{JSON.stringify(value)}</span>;
  }

  return <span className="text-[13px] text-text-primary">{String(value)}</span>;
}

function SimpleKvSection({ data }: { data: Record<string, unknown> }) {
  const simpleEntries = Object.entries(data).filter(
    ([, v]) => typeof v !== 'object' || v === null,
  );

  if (simpleEntries.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Properties" />
      <div className="flex flex-col">
        {simpleEntries.map(([key, val]) => (
          <div
            key={key}
            className="grid grid-cols-[140px_1fr] gap-[var(--spacing-3)] py-[var(--spacing-1-5)] border-b border-border-divider last:border-b-0 items-start"
          >
            <span className="text-[11px] font-[var(--font-weight-semibold)] text-text-tertiary font-mono pt-[1px]">
              {key}
            </span>
            <KvValue value={val} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GapCard -- for gap/issue objects with severity
// ---------------------------------------------------------------------------

function isGapItem(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return 'severity' in obj || 'gap_id' in obj || 'type' in obj;
}

function GapCard({ data }: { data: Record<string, unknown> }) {
  const id = String(data.gap_id || data.id || '');
  const severity = String(data.severity || 'medium');
  const type = String(data.type || '');
  const description = String(data.description || data.claim || '');
  const fix = String(data.suggested_fix || data.fix || '');

  const sevColors: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(196,101,85,0.20)', color: 'var(--color-status-blocked)' },
    high: { bg: 'rgba(200,134,58,0.20)', color: 'var(--color-accent-orange, #C8863A)' },
    medium: { bg: 'rgba(184,149,64,0.20)', color: 'var(--color-accent-yellow)' },
    low: { bg: 'rgba(91,141,184,0.20)', color: 'var(--color-accent-blue)' },
  };
  const sev = sevColors[severity.toLowerCase()] || sevColors.medium;

  return (
    <div
      className="p-[10px_14px] rounded-[10px] border-l-[3px] mb-[var(--spacing-1-5)]"
      style={{ borderLeftColor: 'var(--color-status-blocked)', background: 'var(--color-status-bg-blocked)' }}
    >
      <div className="flex items-center gap-[var(--spacing-1-5)] mb-[var(--spacing-1)]">
        {id && <span className="text-[10px] font-[var(--font-weight-bold)] font-mono" style={{ color: 'var(--color-status-blocked)' }}>{id}</span>}
        <span
          className="text-[9px] font-[var(--font-weight-bold)] px-[5px] py-[1px] rounded-[var(--radius-sm)] uppercase"
          style={{ background: sev.bg, color: sev.color }}
        >
          {severity}
        </span>
        {type && <span className="text-[10px] text-text-tertiary ml-auto font-mono">{type}</span>}
      </div>
      {description && <p className="text-[13px] text-text-primary mb-[var(--spacing-1)]">{description}</p>}
      {fix && (
        <p className="text-[length:var(--font-size-sm)] text-text-secondary italic">
          <strong className="font-[var(--font-weight-semibold)] not-italic text-text-tertiary text-[10px] uppercase">Fix: </strong>
          {fix}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistItem
// ---------------------------------------------------------------------------

function isChecklistItem(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return ('claim' in obj || 'check' in obj) && !('severity' in obj);
}

function ChecklistItem({ data }: { data: Record<string, unknown> }) {
  const claim = String(data.claim || data.check || data.description || '');
  const evidence = String(data.evidence || data.detail || '');
  const passed = data.passed === true || data.status === 'passed' || data.status === 'completed';

  return (
    <div className="flex items-start gap-[var(--spacing-2)] p-[var(--spacing-2)_var(--spacing-3)] rounded-[var(--radius-md)] bg-bg-card border border-border-divider">
      {passed ? (
        <CheckCircle2 size={16} strokeWidth={2} className="shrink-0 mt-[1px]" style={{ color: 'var(--color-status-completed)' }} />
      ) : (
        <Circle size={16} strokeWidth={2} className="shrink-0 mt-[1px] text-text-placeholder" />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-text-primary font-[var(--font-weight-medium)]">{claim}</span>
        {evidence && <p className="text-[11px] text-text-tertiary mt-[2px] italic">{evidence}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RawJsonBlock -- syntax-highlighted raw JSON
// ---------------------------------------------------------------------------

function RawJsonBlock({ content }: { content: string }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <pre
      className={[
        'rounded-[10px] p-[16px_20px] font-mono text-[11px] leading-[1.6] overflow-x-auto',
        'bg-[#2C2723] text-[#D9D0C4] border border-[#3D3731]',
      ].join(' ')}
    >
      {formatted}
    </pre>
  );
}
