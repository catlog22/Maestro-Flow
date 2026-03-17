import { useState } from 'react';
import { useSettingsStore } from '@/client/store/settings-store.js';
import type { AgentSettingsEntry } from '@/client/store/settings-store.js';
import type { AgentType } from '@/shared/agent-types.js';
import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsSaveBar,
} from '../SettingsComponents.js';
import { cn } from '@/client/lib/utils.js';

// ---------------------------------------------------------------------------
// AgentsSection — 5 agent types with per-type model/config form
// ---------------------------------------------------------------------------

const AGENT_TYPES: { type: AgentType; label: string; description: string }[] = [
  { type: 'claude-code', label: 'Claude Code', description: 'Anthropic Claude CLI agent' },
  { type: 'codex', label: 'Codex', description: 'OpenAI Codex CLI agent' },
  { type: 'gemini', label: 'Gemini', description: 'Google Gemini CLI agent' },
  { type: 'qwen', label: 'Qwen', description: 'Alibaba Qwen CLI agent' },
  { type: 'opencode', label: 'OpenCode', description: 'Open-source code agent' },
];

export function AgentsSection() {
  const draft = useSettingsStore((s) => s.draft?.agents);
  const saving = useSettingsStore((s) => s.saving);
  const isDirty = useSettingsStore((s) => s.isDirty('agents'));
  const updateDraft = useSettingsStore((s) => s.updateDraft);
  const saveConfig = useSettingsStore((s) => s.saveConfig);
  const discardDraft = useSettingsStore((s) => s.discardDraft);
  const [expanded, setExpanded] = useState<AgentType | null>(null);

  if (!draft) return null;

  const updateAgent = (type: AgentType, patch: Partial<AgentSettingsEntry>) => {
    updateDraft('agents', {
      ...draft,
      [type]: { ...draft[type], ...patch },
    });
  };

  const toggle = (type: AgentType) => {
    setExpanded((prev) => (prev === type ? null : type));
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-3)]">
      {AGENT_TYPES.map(({ type, label, description }) => {
        const agent = draft[type];
        const isExpanded = expanded === type;

        return (
          <SettingsCard key={type} title={label} description={description}>
            <button
              type="button"
              onClick={() => toggle(type)}
              className={cn(
                'w-full text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]',
                'text-accent-blue hover:underline',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] rounded-[var(--radius-sm)]',
              )}
            >
              {isExpanded ? 'Hide configuration' : 'Show configuration'}
            </button>

            {isExpanded && (
              <div className="mt-[var(--spacing-3)] border-t border-border-divider pt-[var(--spacing-3)]">
                <SettingsField
                  label="Model"
                  description="Override the default model for this agent type"
                  htmlFor={`agent-model-${type}`}
                >
                  <SettingsInput
                    id={`agent-model-${type}`}
                    value={agent.model}
                    onChange={(v) => updateAgent(type, { model: v })}
                    placeholder="Default"
                  />
                </SettingsField>

                <SettingsField
                  label="Approval Mode"
                  description="How tool calls are approved"
                  htmlFor={`agent-approval-${type}`}
                >
                  <SettingsSelect
                    id={`agent-approval-${type}`}
                    value={agent.approvalMode}
                    onChange={(v) => updateAgent(type, { approvalMode: v })}
                    options={[
                      { value: 'suggest', label: 'Suggest (manual)' },
                      { value: 'auto', label: 'Auto-approve' },
                    ]}
                  />
                </SettingsField>
              </div>
            )}
          </SettingsCard>
        );
      })}

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void saveConfig('agents')}
        onDiscard={() => discardDraft('agents')}
      />
    </div>
  );
}
