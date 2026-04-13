import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMcpStore } from '@/client/store/mcp-store.js';
import type { McpServerEntry } from '@/client/store/mcp-store.js';
import { cn } from '@/client/lib/utils.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Minus from 'lucide-react/dist/esm/icons/minus.js';

// ---------------------------------------------------------------------------
// McpEditDialog -- modal for editing an existing MCP server config
// ---------------------------------------------------------------------------

const SCOPE_STYLES: Record<string, { bg: string; text: string }> = {
  global: { bg: 'rgba(91,141,184,0.12)', text: 'var(--color-accent-blue, #5B8DB8)' },
  project: { bg: 'rgba(145,120,181,0.12)', text: 'var(--color-status-planning, #9178B5)' },
  enterprise: { bg: 'rgba(200,134,58,0.12)', text: 'var(--color-status-verifying, #C8863A)' },
  codex: { bg: 'rgba(90,158,120,0.12)', text: 'var(--color-status-completed, #5A9E78)' },
};

export function McpEditDialog() {
  const editingServer = useMcpStore((s) => s.editingServer);
  const setEditingServer = useMcpStore((s) => s.setEditingServer);
  const updateServer = useMcpStore((s) => s.updateServer);

  if (!editingServer) return null;

  return (
    <Dialog.Root
      open={!!editingServer}
      onOpenChange={(next) => {
        if (!next) setEditingServer(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[560px] max-w-[95vw] max-h-[85vh]',
            'rounded-[var(--radius-lg)] border border-border bg-bg-primary shadow-lg',
            'flex flex-col overflow-hidden',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <Dialog.Title className="text-[14px] font-semibold text-text-primary">
                Edit Server
              </Dialog.Title>
              <ScopeBadge scope={editingServer.scope} />
            </div>
            <Dialog.Close
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)]',
                'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                'transition-colors',
              )}
              aria-label="Close"
            >
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          {/* Form */}
          <EditForm
            server={editingServer}
            onSave={(config) => void updateServer(editingServer, config)}
            onCancel={() => setEditingServer(null)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// EditForm -- inner form with fields
// ---------------------------------------------------------------------------

function EditForm({
  server,
  onSave,
  onCancel,
}: {
  server: McpServerEntry;
  onSave: (config: unknown) => void;
  onCancel: () => void;
}) {
  const isStdio = server.transport === 'stdio';
  const isEnterprise = server.scope === 'enterprise';

  const [command, setCommand] = useState(server.command ?? '');
  const [argsText, setArgsText] = useState(server.args?.join(' ') ?? '');
  const [url, setUrl] = useState(server.url ?? '');
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>(() => {
    if (!server.env) return [];
    return Object.entries(server.env).map(([key, value]) => ({ key, value }));
  });
  const [saving, setSaving] = useState(false);

  // Build the JSON config from current raw, overriding edited fields
  const buildConfig = useMemo(() => {
    return () => {
      const cfg: Record<string, unknown> = { ...server.raw };

      if (isStdio) {
        cfg.command = command;
        const args = argsText.trim().split(/\s+/).filter(Boolean);
        if (args.length > 0) cfg.args = args;
        else delete cfg.args;
        delete cfg.url;
      } else {
        cfg.url = url;
        delete cfg.command;
        delete cfg.args;
      }

      // Rebuild env
      delete cfg.env;
      const envObj: Record<string, string> = {};
      for (const p of envPairs) {
        if (p.key.trim()) envObj[p.key.trim()] = p.value;
      }
      if (Object.keys(envObj).length > 0) cfg.env = envObj;

      // Clean internal fields
      delete cfg.enabled;
      return cfg;
    };
  }, [server.raw, isStdio, command, argsText, url, envPairs]);

  function handleSave() {
    setSaving(true);
    onSave(buildConfig());
  }

  function addEnvPair() {
    setEnvPairs((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeEnvPair(index: number) {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEnvPair(index: number, field: 'key' | 'value', val: string) {
    setEnvPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: val } : p)));
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Server name (read-only) */}
        <FieldGroup label="Server Name">
          <input
            type="text"
            value={server.name}
            readOnly
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-border bg-bg-secondary text-[12px] text-text-tertiary font-mono cursor-not-allowed"
          />
        </FieldGroup>

        {/* Transport type (read-only) */}
        <FieldGroup label="Transport">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-bold px-[7px] py-[2px] rounded-[4px] uppercase tracking-[0.03em] font-mono"
              style={{
                background: isStdio ? 'rgba(91,141,184,0.08)' : 'rgba(145,120,181,0.08)',
                color: isStdio ? 'var(--color-accent-blue, #5B8DB8)' : 'var(--color-status-planning, #9178B5)',
              }}
            >
              {server.transport}
            </span>
          </div>
        </FieldGroup>

        {isEnterprise && (
          <div className="mb-4 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-status-verifying,#C8863A)] bg-[rgba(200,134,58,0.06)] text-[11px] text-[var(--color-status-verifying,#C8863A)]">
            Enterprise-managed servers cannot be edited from the dashboard.
          </div>
        )}

        {/* Command (stdio) */}
        {isStdio && (
          <FieldGroup label="Command">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={isEnterprise}
              placeholder="e.g. npx"
              className={inputClass}
            />
          </FieldGroup>
        )}

        {/* Args (stdio) */}
        {isStdio && (
          <FieldGroup label="Arguments">
            <input
              type="text"
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              disabled={isEnterprise}
              placeholder="space-separated arguments"
              className={inputClass}
            />
          </FieldGroup>
        )}

        {/* URL (http) */}
        {!isStdio && (
          <FieldGroup label="URL">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isEnterprise}
              placeholder="https://..."
              className={inputClass}
            />
          </FieldGroup>
        )}

        {/* Environment variables */}
        <FieldGroup label="Environment Variables">
          <div className="space-y-2">
            {envPairs.map((pair, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e) => updateEnvPair(i, 'key', e.target.value)}
                  disabled={isEnterprise}
                  placeholder="KEY"
                  className={cn(inputClass, 'w-[160px] shrink-0 font-mono text-[11px]')}
                />
                <input
                  type="text"
                  value={pair.value}
                  onChange={(e) => updateEnvPair(i, 'value', e.target.value)}
                  disabled={isEnterprise}
                  placeholder="value"
                  className={cn(inputClass, 'flex-1 font-mono text-[11px]')}
                />
                {!isEnterprise && (
                  <button
                    type="button"
                    onClick={() => removeEnvPair(i)}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-text-tertiary hover:text-status-failed hover:bg-red-50 transition-colors"
                  >
                    <Minus size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
            {!isEnterprise && (
              <button
                type="button"
                onClick={addEnvPair}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-text-tertiary hover:text-text-primary transition-colors"
              >
                <Plus size={11} strokeWidth={2} />
                Add variable
              </button>
            )}
          </div>
        </FieldGroup>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-[6px] rounded-[var(--radius-md)] border border-border bg-bg-card text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || isEnterprise}
          className={cn(
            'px-4 py-[6px] rounded-[var(--radius-md)] border-none bg-text-primary text-white text-[11px] font-semibold transition-all',
            'hover:-translate-y-px hover:shadow-md',
            (saving || isEnterprise) && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none',
          )}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const inputClass = cn(
  'w-full px-3 py-2 rounded-[var(--radius-md)] border border-border bg-bg-card',
  'text-[12px] text-text-primary outline-none',
  'focus:border-[var(--color-status-planning,#9178B5)] transition-colors',
  'placeholder:text-text-tertiary',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-text-tertiary mb-[6px]">
        {label}
      </div>
      {children}
    </div>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const style = SCOPE_STYLES[scope] ?? SCOPE_STYLES.global;
  return (
    <span
      className="text-[9px] font-bold px-[7px] py-[2px] rounded-[4px] uppercase tracking-[0.03em] font-mono"
      style={{ background: style.bg, color: style.text }}
    >
      {scope}
    </span>
  );
}
