import { useEffect } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { useSettingsStore } from '@/client/store/settings-store.js';
import type { GeneralSettings } from '@/client/store/settings-store.js';
import { useUIPrefsStore } from '@/client/store/ui-prefs-store.js';
import type { StylePreset } from '@/client/store/ui-prefs-store.js';
import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsSaveBar,
  SettingsToggle,
} from '../SettingsComponents.js';
import { cn } from '@/client/lib/utils.js';

// ---------------------------------------------------------------------------
// GeneralSection — connection status, theme, dashboard config
// ---------------------------------------------------------------------------

const STYLE_PRESETS: { value: StylePreset; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'cowork', label: 'Cowork' },
];

function StylePresetField() {
  const preset = useUIPrefsStore((s) => s.stylePreset);
  const setPreset = useUIPrefsStore((s) => s.setStylePreset);

  return (
    <SettingsField
      label="Style Preset"
      description="Switch between visual style presets"
    >
      <div className="flex items-center gap-[var(--spacing-1)]">
        {STYLE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPreset(p.value)}
            className={cn(
              'px-3 py-1 rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] transition-all duration-[var(--duration-fast)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              preset === p.value
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </SettingsField>
  );
}

export function GeneralSection() {
  const connected = useBoardStore((s) => s.connected);
  const draft = useSettingsStore((s) => s.draft?.general);
  const saving = useSettingsStore((s) => s.saving);
  const isDirty = useSettingsStore((s) => s.isDirty('general'));
  const updateDraft = useSettingsStore((s) => s.updateDraft);
  const saveConfig = useSettingsStore((s) => s.saveConfig);
  const discardDraft = useSettingsStore((s) => s.discardDraft);
  const searchTool = useSettingsStore((s) => s.draft?.searchTool ?? 'mcp__ace-tool__search_context');
  const searchToolDirty = useSettingsStore((s) => s.isDirty('searchTool'));
  const chineseResponse = useSettingsStore((s) => s.chineseResponse);
  const loadChineseResponse = useSettingsStore((s) => s.loadChineseResponse);
  const toggleChineseResponse = useSettingsStore((s) => s.toggleChineseResponse);

  useEffect(() => {
    void loadChineseResponse();
  }, [loadChineseResponse]);

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

        <StylePresetField />
      </SettingsCard>

      {/* Search Tool */}
      <SettingsCard
        title="Search Tool"
        description="Configure the MCP semantic search tool used by agents and workflows. Stored in ~/.maestro/config.json"
      >
        <SettingsField
          label="Tool Name"
          description="MCP tool name for semantic codebase search (e.g. mcp__ace-tool__search_context)"
          htmlFor="settings-search-tool"
        >
          <SettingsInput
            id="settings-search-tool"
            value={searchTool}
            onChange={(v) => updateDraft('searchTool', v)}
            placeholder="mcp__ace-tool__search_context"
            className="w-72 font-mono text-[length:var(--font-size-xs)]"
          />
        </SettingsField>
        <SettingsSaveBar
          dirty={searchToolDirty}
          saving={saving}
          onSave={() => void saveConfig('searchTool')}
          onDiscard={() => discardDraft('searchTool')}
        />
      </SettingsCard>

      {/* Response Language */}
      {chineseResponse && (
        <SettingsCard
          title="Response Language"
          description="Configure AI agents to respond in Chinese. Guidelines file: ~/.maestro/workflows/chinese-response.md"
        >
          <SettingsField
            label="Chinese Response — Claude"
            description="Add chinese-response reference to ~/.claude/CLAUDE.md"
          >
            <div className="flex items-center gap-[var(--spacing-2)]">
              <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-accent-blue bg-accent-blue/10 px-[var(--spacing-1-5)] py-0.5 rounded-[var(--radius-sm)]">
                Claude
              </span>
              <SettingsToggle
                enabled={chineseResponse.claudeEnabled}
                onClick={() => void toggleChineseResponse(!chineseResponse.claudeEnabled, 'claude')}
              />
            </div>
          </SettingsField>

          <SettingsField
            label="Chinese Response — Codex"
            description="Add chinese-response content to ~/.codex/AGENTS.md"
          >
            <div className="flex items-center gap-[var(--spacing-2)]">
              <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-green-400 bg-green-400/10 px-[var(--spacing-1-5)] py-0.5 rounded-[var(--radius-sm)]">
                Codex
              </span>
              <SettingsToggle
                enabled={chineseResponse.codexEnabled}
                onClick={() => void toggleChineseResponse(!chineseResponse.codexEnabled, 'codex')}
              />
            </div>
          </SettingsField>

          {chineseResponse.codexNeedsMigration && (
            <div className="mt-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)] bg-status-blocked/10 border border-status-blocked/30">
              <p className="text-[length:var(--font-size-xs)] text-status-blocked">
                Codex has old @ reference format. Toggle off and on to migrate to direct content format.
              </p>
            </div>
          )}

          {!chineseResponse.guidelinesExists && (
            <div className="mt-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)] bg-status-blocked/10 border border-status-blocked/30">
              <p className="text-[length:var(--font-size-xs)] text-status-blocked">
                Guidelines file not found at ~/.maestro/workflows/chinese-response.md
              </p>
            </div>
          )}
        </SettingsCard>
      )}

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void saveConfig('general')}
        onDiscard={() => discardDraft('general')}
      />
    </div>
  );
}
