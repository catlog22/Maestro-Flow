import { useState } from 'react';
import { useSupervisorStore } from '@/client/store/supervisor-store.js';

// ---------------------------------------------------------------------------
// PromptsTab -- mode selector, template editor, live preview (Phase 1)
// ---------------------------------------------------------------------------

export function PromptsTab() {
  const promptModes = useSupervisorStore((s) => s.promptModes);
  const promptBindings = useSupervisorStore((s) => s.promptBindings);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState('');

  const handleSelectMode = (mode: string) => {
    setSelectedMode(mode);
    setTemplateText(promptBindings[mode] ?? '');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column -- mode selector */}
      <div
        className="w-[200px] shrink-0 flex flex-col overflow-y-auto p-[var(--spacing-3)]"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
          Prompt Modes
        </div>
        {promptModes.length === 0 ? (
          <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            No modes loaded
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--spacing-1)]">
            {promptModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSelectMode(mode)}
                className="px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-left text-[length:var(--font-size-xs)] transition-colors"
                style={{
                  background: selectedMode === mode ? 'var(--color-bg-tertiary)' : 'transparent',
                  color: selectedMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center column -- template editor */}
      <div
        className="flex-1 flex flex-col p-[var(--spacing-3)] min-w-0"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
          Template {selectedMode ? `(${selectedMode})` : ''}
        </div>
        <textarea
          value={templateText}
          onChange={(e) => setTemplateText(e.target.value)}
          placeholder={selectedMode ? 'Edit template...' : 'Select a mode to edit'}
          disabled={!selectedMode}
          className="flex-1 w-full resize-none rounded-[var(--radius-sm)] p-[var(--spacing-3)] text-[length:var(--font-size-xs)] font-mono outline-none"
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }}
        />
      </div>

      {/* Right column -- live preview */}
      <div className="w-[280px] shrink-0 flex flex-col p-[var(--spacing-3)] overflow-y-auto">
        <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
          Preview
        </div>
        {templateText ? (
          <pre
            className="text-[length:var(--font-size-xs)] rounded-[var(--radius-sm)] p-[var(--spacing-3)] whitespace-pre-wrap break-words"
            style={{
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
            }}
          >
            {templateText}
          </pre>
        ) : (
          <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            {selectedMode ? 'Template is empty' : 'Select a mode to preview'}
          </div>
        )}
      </div>
    </div>
  );
}
