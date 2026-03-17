import type { TokenUsageEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// TokenUsage -- stats bar with meter (matches design-chat-v1a)
// ---------------------------------------------------------------------------

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TokenUsage({ entry }: { entry: TokenUsageEntry }) {
  const total = entry.inputTokens + entry.outputTokens;
  const maxTokens = 200_000; // context window estimate
  const pct = Math.min(100, Math.round((total / maxTokens) * 100));

  return (
    <div
      className="flex items-center gap-[10px] px-3 py-[6px] rounded-[8px] border"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border-divider)',
      }}
    >
      <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Tokens</span>
      <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {formatNum(total)}
      </span>

      {/* Token meter bar */}
      <div
        className="flex-1 max-w-[60px] h-1 rounded-[2px] overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      >
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${pct}%`,
            backgroundColor: 'var(--color-accent-orange)',
          }}
        />
      </div>

      <span className="w-px h-3" style={{ backgroundColor: 'var(--color-border-divider)' }} />

      {entry.cacheReadTokens != null && entry.cacheReadTokens > 0 && (
        <>
          <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Cache</span>
          <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {formatNum(entry.cacheReadTokens)}
          </span>
        </>
      )}

      {'cost' in entry && typeof (entry as Record<string, unknown>).cost === 'number' && (
        <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          ${((entry as Record<string, unknown>).cost as number).toFixed(3)}
        </span>
      )}
    </div>
  );
}
