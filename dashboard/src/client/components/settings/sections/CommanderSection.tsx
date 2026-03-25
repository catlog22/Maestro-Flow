import { useSettingsStore } from '@/client/store/settings-store.js';
import type { CommanderConfig, CommanderSafetyConfig } from '@/shared/commander-types.js';
import type { WorkspacePolicy } from '@/shared/execution-types.js';
import type { AgentType } from '@/shared/agent-types.js';
import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsSaveBar,
  SettingsToggle,
} from '../SettingsComponents.js';

// ---------------------------------------------------------------------------
// CommanderSection — Commander agent configuration (5 card groups)
// ---------------------------------------------------------------------------

const PROFILE_OPTIONS = [
  { value: 'development' as const, label: 'Development' },
  { value: 'staging' as const, label: 'Staging' },
  { value: 'production' as const, label: 'Production' },
  { value: 'custom' as const, label: 'Custom' },
];

const MODEL_OPTIONS = [
  { value: 'haiku' as const, label: 'Haiku (fast)' },
  { value: 'sonnet' as const, label: 'Sonnet (balanced)' },
  { value: 'opus' as const, label: 'Opus (thorough)' },
];

const THRESHOLD_OPTIONS = [
  { value: 'low' as const, label: 'Low (manual)' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'high' as const, label: 'High (fully auto)' },
];

const EXECUTOR_OPTIONS: { value: AgentType; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'agent-sdk', label: 'Agent SDK' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'opencode', label: 'OpenCode' },
];

function NumberField({
  label,
  description,
  value,
  onChange,
  id,
  min = 0,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  id: string;
  min?: number;
}) {
  return (
    <SettingsField label={label} description={description} htmlFor={id}>
      <SettingsInput
        id={id}
        type="text"
        value={String(value)}
        onChange={(v) => {
          const n = Number(v);
          if (!isNaN(n) && n >= min) onChange(n);
        }}
        className="w-32 font-mono"
      />
    </SettingsField>
  );
}

export function CommanderSection() {
  const draft = useSettingsStore((s) => s.draft?.commander);
  const saving = useSettingsStore((s) => s.saving);
  const isDirty = useSettingsStore((s) => s.isDirty('commander'));
  const updateDraft = useSettingsStore((s) => s.updateDraft);
  const saveConfig = useSettingsStore((s) => s.saveConfig);
  const discardDraft = useSettingsStore((s) => s.discardDraft);

  if (!draft) return null;

  const update = (patch: Partial<CommanderConfig>) => {
    updateDraft('commander', { ...draft, ...patch });
  };

  const updateSafety = (patch: Partial<CommanderSafetyConfig>) => {
    updateDraft('commander', { ...draft, safety: { ...draft.safety, ...patch } });
  };

  const updateWorkspace = (patch: Partial<WorkspacePolicy>) => {
    updateDraft('commander', { ...draft, workspace: { ...draft.workspace, ...patch } });
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      {/* Profile */}
      <SettingsCard
        title="Profile"
        description="Environment profile that presets key parameters for different deployment stages"
      >
        <SettingsField
          label="Environment"
          description="Select a profile preset (switch to Custom to override individual fields)"
          htmlFor="cmd-profile"
        >
          <SettingsSelect
            id="cmd-profile"
            value={draft.profile}
            onChange={(v) => update({ profile: v })}
            options={PROFILE_OPTIONS}
          />
        </SettingsField>
      </SettingsCard>

      {/* Core Loop */}
      <SettingsCard
        title="Core Loop"
        description="Tick-based orchestration parameters controlling polling, concurrency, and retries"
      >
        <NumberField
          id="cmd-poll-interval"
          label="Poll Interval (ms)"
          description="Time between decision loop ticks"
          value={draft.pollIntervalMs}
          onChange={(v) => update({ pollIntervalMs: v })}
        />
        <NumberField
          id="cmd-max-workers"
          label="Max Concurrent Workers"
          description="Maximum parallel agent executions"
          value={draft.maxConcurrentWorkers}
          onChange={(v) => update({ maxConcurrentWorkers: v })}
        />
        <NumberField
          id="cmd-stall-timeout"
          label="Stall Timeout (ms)"
          description="Marks a worker as stalled after this duration"
          value={draft.stallTimeoutMs}
          onChange={(v) => update({ stallTimeoutMs: v })}
        />
        <NumberField
          id="cmd-max-retries"
          label="Max Retries"
          description="Maximum retries per issue on failure"
          value={draft.maxRetries}
          onChange={(v) => update({ maxRetries: v })}
        />
        <NumberField
          id="cmd-retry-backoff"
          label="Retry Backoff (ms)"
          description="Delay between retry attempts"
          value={draft.retryBackoffMs}
          onChange={(v) => update({ retryBackoffMs: v })}
        />
      </SettingsCard>

      {/* Decision */}
      <SettingsCard
        title="Decision"
        description="Assessment and auto-approval settings controlling how Commander evaluates issues"
      >
        <SettingsField
          label="Decision Model"
          description="Model used for assessment queries"
          htmlFor="cmd-decision-model"
        >
          <SettingsSelect
            id="cmd-decision-model"
            value={draft.decisionModel}
            onChange={(v) => update({ decisionModel: v })}
            options={MODEL_OPTIONS}
          />
        </SettingsField>
        <NumberField
          id="cmd-assess-turns"
          label="Assess Max Turns"
          description="Max exploration turns for assessment"
          value={draft.assessMaxTurns}
          onChange={(v) => update({ assessMaxTurns: v })}
        />
        <SettingsField
          label="Auto-Approve Threshold"
          description="Risk level below which actions are auto-approved"
          htmlFor="cmd-approve-threshold"
        >
          <SettingsSelect
            id="cmd-approve-threshold"
            value={draft.autoApproveThreshold}
            onChange={(v) => update({ autoApproveThreshold: v })}
            options={THRESHOLD_OPTIONS}
          />
        </SettingsField>
        <SettingsField
          label="Default Executor"
          description="Agent type used for dispatched issues"
          htmlFor="cmd-executor"
        >
          <SettingsSelect
            id="cmd-executor"
            value={draft.defaultExecutor}
            onChange={(v) => update({ defaultExecutor: v })}
            options={EXECUTOR_OPTIONS}
          />
        </SettingsField>
      </SettingsCard>

      {/* Safety */}
      <SettingsCard
        title="Safety"
        description="Protective constraints to prevent runaway loops and protect sensitive files"
      >
        <NumberField
          id="cmd-debounce"
          label="Event Debounce (ms)"
          description="Minimum interval between processing events"
          value={draft.safety.eventDebounceMs}
          onChange={(v) => updateSafety({ eventDebounceMs: v })}
        />
        <NumberField
          id="cmd-circuit-breaker"
          label="Circuit Breaker Threshold"
          description="Auto-pause after N consecutive failures"
          value={draft.safety.circuitBreakerThreshold}
          onChange={(v) => updateSafety({ circuitBreakerThreshold: v })}
        />
        <NumberField
          id="cmd-max-ticks"
          label="Max Ticks per Hour"
          description="Prevent runaway decision loops"
          value={draft.safety.maxTicksPerHour}
          onChange={(v) => updateSafety({ maxTicksPerHour: v })}
        />
        <NumberField
          id="cmd-max-tokens"
          label="Max Tokens per Hour"
          description="Token budget limit per hour"
          value={draft.safety.maxTokensPerHour}
          onChange={(v) => updateSafety({ maxTokensPerHour: v })}
        />
        <SettingsField
          label="Protected Paths"
          description="File globs Commander must not operate on (comma-separated)"
          htmlFor="cmd-protected-paths"
        >
          <SettingsInput
            id="cmd-protected-paths"
            value={draft.safety.protectedPaths.join(', ')}
            onChange={(v) =>
              updateSafety({
                protectedPaths: v
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder=".env, *.key, credentials.*"
            className="w-72 font-mono text-[length:var(--font-size-xs)]"
          />
        </SettingsField>
      </SettingsCard>

      {/* Workspace */}
      <SettingsCard
        title="Workspace"
        description="Per-issue workspace isolation settings"
      >
        <SettingsField
          label="Enabled"
          description="Enable per-issue workspace isolation"
        >
          <SettingsToggle
            enabled={draft.workspace.enabled}
            onClick={() => updateWorkspace({ enabled: !draft.workspace.enabled })}
          />
        </SettingsField>
        <SettingsField
          label="Use Worktree"
          description="Use git worktree for isolation (vs plain directory)"
        >
          <SettingsToggle
            enabled={draft.workspace.useWorktree}
            onClick={() => updateWorkspace({ useWorktree: !draft.workspace.useWorktree })}
          />
        </SettingsField>
        <SettingsField
          label="Auto Cleanup"
          description="Automatically remove workspaces after completion"
        >
          <SettingsToggle
            enabled={draft.workspace.autoCleanup}
            onClick={() => updateWorkspace({ autoCleanup: !draft.workspace.autoCleanup })}
          />
        </SettingsField>
        <SettingsField
          label="Strict"
          description="Enforce strict workspace boundaries"
        >
          <SettingsToggle
            enabled={draft.workspace.strict}
            onClick={() => updateWorkspace({ strict: !draft.workspace.strict })}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void saveConfig('commander')}
        onDiscard={() => discardDraft('commander')}
      />
    </div>
  );
}
