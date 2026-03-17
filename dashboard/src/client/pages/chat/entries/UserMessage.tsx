import type { UserMessageEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// UserMessage -- right-aligned chat bubble for user input
// ---------------------------------------------------------------------------

export function UserMessage({ entry }: { entry: UserMessageEntry }) {
  return (
    <div className="flex justify-end py-[var(--spacing-1-5)]">
      <div
        className="max-w-[70%] px-[14px] py-[10px] text-[13px] leading-[1.6] whitespace-pre-wrap break-words"
        style={{
          backgroundColor: '#3D352D',
          color: '#F0EBE5',
          borderRadius: '16px 16px 4px 16px',
        }}
      >
        {entry.content}
      </div>
    </div>
  );
}
