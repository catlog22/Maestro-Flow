import { useSupervisorStore } from '@/client/store/supervisor-store.js';

// ---------------------------------------------------------------------------
// ExtensionsTab -- read-only registry view of loaded extensions
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  strategy: 'var(--color-accent-blue)',
  builder: 'var(--color-accent-green)',
  adapter: 'var(--color-accent-orange, #B89540)',
  task: 'var(--color-accent-purple, #9B59B6)',
  tool: 'var(--color-text-secondary)',
};

export function ExtensionsTab() {
  const extensions = useSupervisorStore((s) => s.extensions);

  return (
    <div className="p-[var(--spacing-4)] h-full overflow-y-auto">
      <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-3)]" style={{ color: 'var(--color-text-primary)' }}>
        Extensions ({extensions.length})
      </div>

      {extensions.length === 0 ? (
        <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-6)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          No extensions registered
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-3)]">
          {extensions.map((ext) => (
            <div
              key={ext.name}
              className="flex flex-col gap-[var(--spacing-2)] p-[var(--spacing-3)] rounded-[var(--radius-sm)]"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
            >
              {/* Header: name + status */}
              <div className="flex items-center justify-between">
                <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-primary)' }}>
                  {ext.name}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ext.status === 'enabled' ? 'var(--color-accent-green)' : 'var(--color-text-tertiary)',
                  }}
                />
              </div>

              {/* Version + type badge */}
              <div className="flex items-center gap-[var(--spacing-2)]">
                <span className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-tertiary)' }}>
                  v{ext.version}
                </span>
                <span
                  className="text-[length:var(--font-size-xs)] px-[var(--spacing-1)] rounded"
                  style={{
                    background: TYPE_COLORS[ext.type] ?? 'var(--color-bg-tertiary)',
                    color: '#fff',
                  }}
                >
                  {ext.type}
                </span>
              </div>

              {/* Description */}
              <div className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>
                {ext.description || 'No description'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
