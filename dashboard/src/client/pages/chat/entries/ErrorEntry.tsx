import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import type { ErrorEntry as ErrorEntryType } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ErrorDisplay -- red alert block for error entries
// ---------------------------------------------------------------------------

export function ErrorDisplay({ entry }: { entry: ErrorEntryType }) {
  return (
    <div
      className="flex items-start gap-[6px] py-[4px]"
      role="alert"
      style={{ color: 'var(--color-accent-red)' }}
    >
      <AlertCircle size={14} className="shrink-0 mt-[2px]" strokeWidth={1.8} />
      <div className="min-w-0 text-[12px] leading-[1.5]">
        <span className="break-words">
          {entry.message}
        </span>
        {entry.code && (
          <code
            className="ml-[4px] font-mono text-[11px] px-[5px] py-[1px] rounded-[3px]"
            style={{ backgroundColor: 'rgba(196,101,85,0.06)' }}
          >
            {entry.code}
          </code>
        )}
      </div>
    </div>
  );
}
