import { useInstallStore } from '@/client/store/install-store.js';
import { useEffect } from 'react';

export function StepModeSelect() {
  const mode = useInstallStore((s) => s.mode);
  const setMode = useInstallStore((s) => s.setMode);
  const projectPath = useInstallStore((s) => s.projectPath);
  const setProjectPath = useInstallStore((s) => s.setProjectPath);
  const detecting = useInstallStore((s) => s.detecting);
  const error = useInstallStore((s) => s.error);
  const detect = useInstallStore((s) => s.detect);
  const manifests = useInstallStore((s) => s.manifests);
  const fetchManifests = useInstallStore((s) => s.fetchManifests);

  useEffect(() => {
    void fetchManifests();
  }, [fetchManifests]);

  const canProceed = mode === 'global' || (mode === 'project' && projectPath.trim().length > 0);

  return (
    <div className="flex flex-col gap-6 max-w-[520px] mx-auto py-6">
      <div>
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">Installation Mode</h3>
        <p className="text-[12px] text-text-tertiary">
          Choose where to install maestro commands, agents, and workflows.
        </p>
      </div>

      {/* Mode cards */}
      <div className="flex flex-col gap-3">
        <ModeCard
          selected={mode === 'global'}
          onClick={() => setMode('global')}
          title="Global"
          description="Install to home directory (~/.claude/, ~/.maestro/). Available across all projects."
          recommended
        />
        <ModeCard
          selected={mode === 'project'}
          onClick={() => setMode('project')}
          title="Project"
          description="Install to a specific project directory. Commands are project-scoped."
        />
      </div>

      {/* Project path input */}
      {mode === 'project' && (
        <div className="flex flex-col gap-[6px]">
          <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.04em]">
            Project Path
          </label>
          <input
            type="text"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="/path/to/your/project"
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-border bg-bg-card text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[var(--color-status-planning,#9178B5)] transition-colors"
          />
        </div>
      )}

      {/* Existing manifests info */}
      {manifests.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-border bg-[rgba(184,149,64,0.04)] px-4 py-3">
          <p className="text-[11px] font-semibold text-[var(--color-status-executing,#B89540)] mb-1">
            Existing installations found
          </p>
          <div className="flex flex-col gap-1">
            {manifests.slice(0, 3).map((m) => (
              <p key={m.id} className="text-[10px] text-text-tertiary font-mono">
                {m.scope} — v{m.version} — {new Date(m.installedAt).toLocaleDateString()}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[rgba(196,101,85,0.3)] bg-[rgba(196,101,85,0.04)] px-4 py-3">
          <p className="text-[11px] text-status-failed">{error}</p>
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={!canProceed || detecting}
          onClick={() => void detect()}
          className="flex items-center gap-[6px] px-5 py-[8px] rounded-[var(--radius-lg)] border-none bg-text-primary text-white text-[12px] font-semibold cursor-pointer transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-40 disabled:cursor-default disabled:transform-none"
        >
          {detecting ? (
            <>
              <Spinner />
              Scanning...
            </>
          ) : (
            'Next'
          )}
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  onClick,
  title,
  description,
  recommended,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-[var(--radius-lg)] border text-left transition-all cursor-pointer w-full"
      style={{
        borderColor: selected
          ? 'var(--color-text-primary, #1A1917)'
          : 'var(--color-border, #E8E5DE)',
        background: selected ? 'rgba(26,25,23,0.02)' : 'var(--color-bg-card, #F8F7F5)',
      }}
    >
      {/* Radio indicator */}
      <div
        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 mt-[1px]"
        style={{
          borderColor: selected
            ? 'var(--color-text-primary, #1A1917)'
            : 'var(--color-border, #E8E5DE)',
        }}
      >
        {selected && (
          <div
            className="w-[10px] h-[10px] rounded-full"
            style={{ background: 'var(--color-text-primary, #1A1917)' }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text-primary">{title}</span>
          {recommended && (
            <span className="text-[8px] font-bold px-[6px] py-[1px] rounded-full bg-[rgba(90,158,120,0.1)] text-[var(--color-status-completed,#5A9E78)] uppercase tracking-wider">
              Recommended
            </span>
          )}
        </div>
        <p className="text-[11px] text-text-tertiary mt-[2px] leading-[1.4]">{description}</p>
      </div>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
