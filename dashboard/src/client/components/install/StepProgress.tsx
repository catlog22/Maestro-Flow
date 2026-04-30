import { useInstallStore } from '@/client/store/install-store.js';

export function StepProgress() {
  const installing = useInstallStore((s) => s.installing);
  const result = useInstallStore((s) => s.result);
  const setOpen = useInstallStore((s) => s.setOpen);
  const reset = useInstallStore((s) => s.reset);

  // Installing state
  if (installing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <svg className="animate-spin w-8 h-8 text-text-primary" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.15" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <p className="text-[13px] font-semibold text-text-primary">Installing...</p>
        <p className="text-[11px] text-text-tertiary">Copying files and registering configuration</p>
      </div>
    );
  }

  // No result yet (shouldn't happen)
  if (!result) return null;

  // Error state
  if (!result.success) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 max-w-[440px] mx-auto">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(196,101,85,0.1)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-status-failed, #C46555)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-[14px] font-semibold text-text-primary mb-1">Installation Failed</h3>
          <p className="text-[11px] text-status-failed">{result.error}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-[7px] rounded-[var(--radius-lg)] border border-border bg-bg-card text-[12px] font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-[7px] rounded-[var(--radius-lg)] border-none bg-text-primary text-white text-[12px] font-semibold cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="flex flex-col items-center gap-5 py-10 max-w-[440px] mx-auto">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(90,158,120,0.1)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-status-completed, #5A9E78)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">Installation Complete</h3>
        <p className="text-[11px] text-text-tertiary">All components installed successfully.</p>
      </div>

      {/* Result details */}
      <div className="w-full rounded-[var(--radius-md)] border border-border bg-bg-card overflow-hidden">
        <ResultRow label="Files installed" value={String(result.filesInstalled)} />
        <ResultRow label="Directories created" value={String(result.dirsCreated)} />
        <ResultRow label="Components" value={result.components.join(', ')} />
        {result.disabledItemsRestored > 0 && (
          <ResultRow label="Disabled items restored" value={String(result.disabledItemsRestored)} />
        )}
        <ResultRow label="MCP registered" value={result.mcpRegistered ? 'Yes' : 'No'} />
        <ResultRow label="Manifest" value={result.manifestPath.replace(/\\/g, '/').split('/').slice(-1)[0]} last />
      </div>

      {/* Migration warnings */}
      {result.migrationWarnings && result.migrationWarnings.length > 0 && (
        <div className="w-full rounded-[var(--radius-md)] border border-[rgba(184,149,64,0.3)] bg-[rgba(184,149,64,0.04)] px-4 py-3">
          <p className="text-[11px] font-semibold text-[var(--color-status-executing,#B89540)] mb-2">
            Migration Warnings
          </p>
          {result.migrationWarnings.map((w, i) => (
            <p key={i} className="text-[10px] text-text-secondary mb-1 break-all">{w}</p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-5 py-[8px] rounded-[var(--radius-lg)] border-none bg-text-primary text-white text-[12px] font-semibold cursor-pointer transition-all hover:-translate-y-px hover:shadow-md"
      >
        Done
      </button>
    </div>
  );
}

function ResultRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-[8px]"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-border-divider)' }}
    >
      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.04em]">
        {label}
      </span>
      <span className="text-[11px] font-mono text-text-primary">{value}</span>
    </div>
  );
}
