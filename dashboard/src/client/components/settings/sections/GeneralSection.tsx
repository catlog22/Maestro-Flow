import { useBoardStore } from '@/client/store/board-store.js';
import { useSettingsStore } from '@/client/store/settings-store.js';
import type { GeneralSettings } from '@/client/store/settings-store.js';
import {
  SettingsCard,
  SettingsField,
  SettingsSelect,
  SettingsSaveBar,
} from '../SettingsComponents.js';

// ---------------------------------------------------------------------------
// GeneralSection — connection status, theme, dashboard config
// ---------------------------------------------------------------------------

export function GeneralSection() {
  const connected = useBoardStore((s) => s.connected);
  const draft = useSettingsStore((s) => s.draft?.general);
  const saving = useSettingsStore((s) => s.saving);
  const isDirty = useSettingsStore((s) => s.isDirty('general'));
  const updateDraft = useSettingsStore((s) => s.updateDraft);
  const saveConfig = useSettingsStore((s) => s.saveConfig);
  const discardDraft = useSettingsStore((s) => s.discardDraft);

  if (!draft) return null;

  const update = (patch: Partial<GeneralSettings>) => {
    updateDraft('general', { ...draft, ...patch });
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      {/* Connection status */}
      <SettingsCard title="Connection" description="WebSocket connection status to the dashboard server">
        <div className="flex items-center gap-[var(--spacing-2)]">
          <span
            className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-status-completed' : 'bg-status-blocked'}`}
          />
          <span className="text-[length:var(--font-size-sm)] text-text-primary">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </SettingsCard>

      {/* Theme */}
      <SettingsCard title="Appearance" description="Customize the dashboard look and feel">
        <SettingsField
          label="Theme"
          description="Select the color theme for the dashboard"
          htmlFor="settings-theme"
        >
          <SettingsSelect
            id="settings-theme"
            value={draft.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </SettingsField>

        <SettingsField
          label="Language"
          description="Dashboard display language"
          htmlFor="settings-language"
        >
          <SettingsSelect
            id="settings-language"
            value={draft.language}
            onChange={(v) => update({ language: v })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh-CN', label: 'Chinese' },
            ]}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void saveConfig('general')}
        onDiscard={() => discardDraft('general')}
      />
    </div>
  );
}
