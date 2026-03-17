import ShieldQuestion from 'lucide-react/dist/esm/icons/shield-question.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';
import type { ApprovalRequestEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ApprovalCard -- interactive approval card with Allow/Deny buttons
// ---------------------------------------------------------------------------

export function ApprovalCard({ entry }: { entry: ApprovalRequestEntry }) {
  function handleDecision(allow: boolean) {
    sendWsMessage({
      action: 'approve',
      processId: entry.processId,
      requestId: entry.requestId,
      allow,
    });
  }

  return (
    <div
      className="rounded-[10px] overflow-hidden contain-content"
      style={{
        backgroundColor: 'var(--color-tint-verifying)',
        border: '1.5px solid var(--color-accent-orange)',
      }}
    >
      <div
        className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[9px]"
        style={{ borderBottom: '1px solid rgba(200,134,58,0.15)' }}
      >
        <ShieldQuestion size={15} className="shrink-0" strokeWidth={1.8} style={{ color: 'var(--color-accent-orange)' }} />
        <span className="text-[12px] font-semibold text-text-primary">
          Permission Required
        </span>
        <span
          className="ml-auto shrink-0 rounded-[var(--radius-full)] px-[var(--spacing-2)] py-[2px] text-[10px] font-semibold"
          style={{
            backgroundColor: 'rgba(200,134,58,0.12)',
            color: 'var(--color-accent-orange)',
          }}
        >
          {entry.toolName}
        </span>
      </div>
      <div className="px-[var(--spacing-3)] py-[10px]">
        <pre
          className="text-[11px] font-mono rounded-[var(--radius-default)] p-[8px_10px] overflow-x-auto max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words"
          style={{
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-divider)',
          }}
        >
          {JSON.stringify(entry.toolInput, null, 2)}
        </pre>
      </div>
      <div
        className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-2)]"
        style={{ borderTop: '1px solid rgba(200,134,58,0.15)' }}
      >
        <button
          type="button"
          onClick={() => handleDecision(true)}
          className="rounded-[var(--radius-md)] px-[var(--spacing-4)] py-[5px] text-[12px] font-semibold transition-all hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-accent-green)',
            color: '#fff',
          }}
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => handleDecision(false)}
          className="rounded-[var(--radius-md)] px-[var(--spacing-4)] py-[5px] text-[12px] font-semibold border transition-all"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-accent-red)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--color-accent-red)';
            el.style.backgroundColor = 'var(--color-tint-blocked)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--color-border)';
            el.style.backgroundColor = 'var(--color-bg-card)';
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}
