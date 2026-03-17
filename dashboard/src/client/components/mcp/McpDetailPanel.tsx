import { useMemo } from 'react';
import { motion } from 'framer-motion';
import X from 'lucide-react/dist/esm/icons/x.js';
import Terminal from 'lucide-react/dist/esm/icons/terminal.js';
import Globe from 'lucide-react/dist/esm/icons/globe.js';
import Edit3 from 'lucide-react/dist/esm/icons/edit-3.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import { useMcpStore } from '@/client/store/mcp-store.js';
import type { McpServerEntry } from '@/client/store/mcp-store.js';

// ---------------------------------------------------------------------------
// McpDetailPanel -- sliding panel showing server details (380px from right)
// ---------------------------------------------------------------------------

const SCOPE_STYLES: Record<string, { bg: string; text: string }> = {
  global: { bg: 'rgba(91,141,184,0.12)', text: 'var(--color-accent-blue, #5B8DB8)' },
  project: { bg: 'rgba(145,120,181,0.12)', text: 'var(--color-status-planning, #9178B5)' },
  enterprise: { bg: 'rgba(200,134,58,0.12)', text: 'var(--color-status-verifying, #C8863A)' },
  codex: { bg: 'rgba(90,158,120,0.12)', text: 'var(--color-status-completed, #5A9E78)' },
};

const TRANSPORT_STYLES: Record<string, { bg: string; text: string }> = {
  stdio: { bg: 'rgba(91,141,184,0.08)', text: 'var(--color-accent-blue, #5B8DB8)' },
  http: { bg: 'rgba(145,120,181,0.08)', text: 'var(--color-status-planning, #9178B5)' },
};

interface McpDetailPanelProps {
  server: McpServerEntry;
  onClose: () => void;
}

export function McpDetailPanel({ server, onClose }: McpDetailPanelProps) {
  const removeServer = useMcpStore((s) => s.removeServer);
  const removeGlobalServer = useMcpStore((s) => s.removeGlobalServer);

  const envEntries = useMemo(
    () => (server.env ? Object.entries(server.env) : []),
    [server.env],
  );

  const rawJson = useMemo(
    () => JSON.stringify(server.raw, null, 2),
    [server.raw],
  );

  const scopeStyle = SCOPE_STYLES[server.scope] ?? SCOPE_STYLES.global;
  const transportStyle = TRANSPORT_STYLES[server.transport] ?? TRANSPORT_STYLES.stdio;

  function handleRemove() {
    if (server.scope === 'global') {
      void removeGlobalServer(server.name);
    } else {
      void removeServer(server.projectPath ?? '', server.name);
    }
    onClose();
  }

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="shrink-0 border-l border-border bg-bg-card overflow-hidden flex flex-col"
    >
        {/* Header */}
        <div className="flex items-center gap-[10px] px-[18px] py-[14px] border-b border-border-divider shrink-0">
          <div
            className="w-9 h-9 rounded-[var(--radius-lg)] shrink-0 flex items-center justify-center"
            style={{ background: transportStyle.bg, color: transportStyle.text }}
          >
            {server.transport === 'stdio' ? (
              <Terminal size={18} strokeWidth={1.8} />
            ) : (
              <Globe size={18} strokeWidth={1.8} />
            )}
          </div>
          <span className="text-[15px] font-bold text-text-primary flex-1 min-w-0 truncate">
            {server.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-[18px] py-[16px]" style={{ width: 380 }}>
          {/* Info section */}
          <Section label="Info">
            <CfgRow label="Scope">
              <span
                className="text-[9px] font-bold px-[7px] py-[2px] rounded-[4px] uppercase tracking-[0.03em] font-mono"
                style={{ background: scopeStyle.bg, color: scopeStyle.text }}
              >
                {server.scope}
              </span>
            </CfgRow>
            <CfgRow label="Transport">
              <span
                className="text-[9px] font-semibold px-[7px] py-[2px] rounded-[4px] uppercase"
                style={{ background: transportStyle.bg, color: transportStyle.text }}
              >
                {server.transport}
              </span>
            </CfgRow>
            <CfgRow label="Status">
              <span
                className="text-[12px] font-semibold flex items-center gap-[4px]"
                style={{ color: server.enabled ? 'var(--color-status-completed, #5A9E78)' : 'var(--color-text-tertiary)' }}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full inline-block"
                  style={{ background: server.enabled ? 'var(--color-status-completed, #5A9E78)' : 'var(--color-text-tertiary)' }}
                />
                {server.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </CfgRow>
            {server.projectPath && (
              <CfgRow label="Source">
                <span className="font-mono text-[11px] text-text-primary break-all">
                  {server.projectPath}
                </span>
              </CfgRow>
            )}
          </Section>

          {/* CLI Presence */}
          <Section label="CLI Presence">
            <CliRow
              letter="C"
              label="Claude Code"
              present={server.cli.claude}
              tintBg="rgba(200,134,58,0.08)"
              tintColor="var(--color-status-verifying, #C8863A)"
            />
            <CliRow
              letter="X"
              label="Codex CLI"
              present={server.cli.codex}
              tintBg="rgba(90,158,120,0.08)"
              tintColor="var(--color-status-completed, #5A9E78)"
            />
          </Section>

          {/* Command */}
          <Section label="Command">
            <div className="bg-bg-secondary border border-border-divider rounded-[var(--radius-lg)] px-3 py-[10px] font-mono text-[11px] text-text-primary leading-[1.7] whitespace-pre-wrap break-all">
              {server.command
                ? `${server.command}${server.args?.length ? ' ' + server.args.join(' ') : ''}`
                : server.url ?? '(no command)'}
            </div>
          </Section>

          {/* Environment */}
          {envEntries.length > 0 && (
            <Section label="Environment">
              <div className="bg-bg-secondary border border-border-divider rounded-[var(--radius-lg)] overflow-hidden">
                <table className="w-full border-collapse">
                  <tbody>
                    {envEntries.map(([key, val]) => (
                      <tr key={key}>
                        <td className="px-2 py-1 text-[11px] font-mono font-medium whitespace-nowrap border-b border-border-divider" style={{ color: 'var(--color-accent-blue, #5B8DB8)' }}>
                          {key}
                        </td>
                        <td className="px-2 py-1 text-[11px] font-mono text-text-secondary break-all border-b border-border-divider">
                          {val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Raw Config */}
          <Section label="Raw Config">
            <div
              className="rounded-[var(--radius-lg)] px-3 py-[10px] font-mono text-[11px] leading-[1.7] whitespace-pre-wrap break-all"
              style={{
                background: 'var(--color-code-bg, #2C2723)',
                color: 'var(--color-code-text, #D9D0C4)',
                border: '1px solid var(--color-code-border, #3D3731)',
              }}
            >
              {rawJson}
            </div>
          </Section>
        </div>

        {/* Actions footer */}
        <div className="flex gap-[6px] px-[18px] py-3 border-t border-border-divider shrink-0">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-[4px] px-[10px] py-[5px] rounded-[var(--radius-md)] border border-border bg-bg-card text-[10px] font-semibold text-text-secondary hover:border-text-tertiary hover:text-text-primary transition-all"
          >
            <Edit3 size={11} strokeWidth={2} />
            Edit
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="flex-1 flex items-center justify-center gap-[4px] px-[10px] py-[5px] rounded-[var(--radius-md)] border border-border bg-bg-card text-[10px] font-semibold text-status-failed hover:border-status-failed hover:bg-red-50 transition-all"
          >
            <Trash2 size={11} strokeWidth={2} />
            Remove
          </button>
        </div>
    </motion.aside>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-text-tertiary mb-[6px]">
        {label}
      </div>
      {children}
    </div>
  );
}

function CfgRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="text-[11px] font-semibold text-text-secondary min-w-[70px] shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function CliRow({
  letter,
  label,
  present,
  tintBg,
  tintColor,
}: {
  letter: string;
  label: string;
  present: boolean;
  tintBg: string;
  tintColor: string;
}) {
  return (
    <div
      className="flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius-md)] mb-1"
      style={{ background: present ? tintBg : undefined }}
    >
      <div
        className="w-6 h-[18px] rounded-[4px] flex items-center justify-center text-[9px] font-extrabold font-mono"
        style={{ background: tintBg, color: tintColor }}
      >
        {letter}
      </div>
      <span className="text-[12px] font-semibold text-text-primary flex-1">{label}</span>
      <span
        className="text-[10px] font-semibold"
        style={{ color: present ? 'var(--color-status-completed, #5A9E78)' : 'var(--color-text-tertiary)' }}
      >
        {present ? 'Installed' : 'Not found'}
      </span>
    </div>
  );
}
