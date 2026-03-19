// ---------------------------------------------------------------------------
// CLI Agent Runner
// Orchestrates adapter selection, process spawning, stdout rendering, and
// exit handling for the `maestro cli` command.
// ---------------------------------------------------------------------------

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DashboardBridge } from './dashboard-bridge.js';
import { CliHistoryStore, type EntryLike } from './cli-history-store.js';
import { loadTemplate, loadProtocol } from '../config/template-discovery.js';

// ---------------------------------------------------------------------------
// Re-declare minimal types locally to avoid cross-rootDir imports from
// dashboard/src/shared/agent-types.ts. These mirror the canonical types.
// ---------------------------------------------------------------------------

type AgentType = 'claude-code' | 'codex' | 'gemini' | 'qwen' | 'opencode';

type AgentProcessStatus =
  | 'spawning'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

interface AgentConfig {
  type: AgentType;
  prompt: string;
  workDir: string;
  env?: Record<string, string>;
  model?: string;
  approvalMode?: 'suggest' | 'auto';
}

interface AgentProcess {
  id: string;
  type: AgentType;
  status: AgentProcessStatus;
  config: AgentConfig;
  startedAt: string;
  pid?: number;
}

interface NormalizedEntryBase {
  id: string;
  processId: string;
  timestamp: string;
}

type NormalizedEntry =
  | (NormalizedEntryBase & { type: 'user_message'; content: string })
  | (NormalizedEntryBase & { type: 'assistant_message'; content: string; partial: boolean })
  | (NormalizedEntryBase & { type: 'thinking'; content: string })
  | (NormalizedEntryBase & { type: 'tool_use'; name: string; input: Record<string, unknown>; status: string; result?: string })
  | (NormalizedEntryBase & { type: 'file_change'; path: string; action: string; diff?: string })
  | (NormalizedEntryBase & { type: 'command_exec'; command: string; exitCode?: number; output?: string })
  | (NormalizedEntryBase & { type: 'approval_request'; toolName: string; toolInput: Record<string, unknown>; requestId: string })
  | (NormalizedEntryBase & { type: 'approval_response'; requestId: string; allowed: boolean })
  | (NormalizedEntryBase & { type: 'error'; message: string; code?: string })
  | (NormalizedEntryBase & { type: 'status_change'; status: AgentProcessStatus; reason?: string })
  | (NormalizedEntryBase & { type: 'token_usage'; inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number });

/** Minimal adapter interface matching BaseAgentAdapter's public surface */
interface AdapterLike {
  spawn(config: AgentConfig): Promise<AgentProcess>;
  stop(processId: string): Promise<void>;
  onEntry(processId: string, cb: (entry: NormalizedEntry) => void): () => void;
}

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

export interface CliRunOptions {
  prompt: string;
  tool: string;
  mode: 'analysis' | 'write';
  model?: string;
  workDir: string;
  rule?: string;
  execId?: string;
  resume?: string;
  includeDirs?: string[];
}

// ---------------------------------------------------------------------------
// Tool name -> AgentType mapping
// ---------------------------------------------------------------------------

const TOOL_TO_AGENT_TYPE: Record<string, AgentType> = {
  gemini: 'gemini',
  qwen: 'qwen',
  codex: 'codex',
  claude: 'claude-code',
  opencode: 'opencode',
};

// ---------------------------------------------------------------------------
// Execution ID generation
// ---------------------------------------------------------------------------

const TOOL_PREFIX: Record<string, string> = {
  gemini: 'gem',
  qwen: 'qwn',
  codex: 'cdx',
  claude: 'cld',
  opencode: 'opc',
};

function generateExecId(tool: string): string {
  const prefix = TOOL_PREFIX[tool] ?? 'run';
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = randomBytes(2).toString('hex'); // 4 hex chars
  return `${prefix}-${hh}${mm}${ss}-${rand}`;
}

// ---------------------------------------------------------------------------
// Prompt assembly — protocol + user prompt + template
// ---------------------------------------------------------------------------

async function assemblePrompt(
  userPrompt: string,
  mode: 'analysis' | 'write',
  rule?: string,
): Promise<string> {
  const parts: string[] = [];

  // 1. Load mode protocol
  const protocol = await loadProtocol(mode);
  if (protocol) {
    parts.push(protocol);
  }

  // 2. User prompt
  parts.push(userPrompt);

  // 3. Load rule template (if specified)
  if (rule) {
    const template = await loadTemplate(rule);
    if (template) {
      parts.push(template);
    } else {
      console.error(`Warning: template "${rule}" not found, proceeding without it.`);
    }
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Adapter factory — dynamic import avoids rootDir cross-boundary issues
// ---------------------------------------------------------------------------

async function loadAdapterModule(adapterFile: string): Promise<Record<string, unknown>> {
  const dashboardAgents = resolve(
    import.meta.dirname ?? __dirname,
    '..', '..', 'dashboard', 'dist-server', 'server', 'agents',
  );
  const fullPath = resolve(dashboardAgents, adapterFile);
  // Convert to file:// URL for Windows compatibility with dynamic import()
  const fileUrl = pathToFileURL(fullPath).href;
  return await import(fileUrl) as Record<string, unknown>;
}

async function createAdapter(agentType: AgentType): Promise<AdapterLike> {
  switch (agentType) {
    case 'gemini': {
      const mod = await loadAdapterModule('stream-json-adapter.js');
      const Cls = mod.StreamJsonAdapter as new (exe: string, type: string) => AdapterLike;
      return new Cls('npx -y @google/gemini-cli', 'gemini');
    }
    case 'qwen': {
      const mod = await loadAdapterModule('stream-json-adapter.js');
      const Cls = mod.StreamJsonAdapter as new (exe: string, type: string) => AdapterLike;
      return new Cls('qwen', 'qwen');
    }
    case 'codex': {
      const mod = await loadAdapterModule('codex-cli-adapter.js');
      const Cls = mod.CodexCliAdapter as new () => AdapterLike;
      return new Cls();
    }
    case 'opencode': {
      const mod = await loadAdapterModule('opencode-adapter.js');
      const Cls = mod.OpenCodeAdapter as new () => AdapterLike;
      return new Cls();
    }
    case 'claude-code': {
      const mod = await loadAdapterModule('claude-code-adapter.js');
      const Cls = mod.ClaudeCodeAdapter as new () => AdapterLike;
      return new Cls();
    }
    default:
      throw new Error(`Unsupported agent type: ${agentType}`);
  }
}

// ---------------------------------------------------------------------------
// Entry renderer — writes normalized entries to stdout/stderr
// ---------------------------------------------------------------------------

function renderEntry(entry: NormalizedEntry): void {
  switch (entry.type) {
    case 'assistant_message':
      process.stdout.write(entry.content);
      break;

    case 'tool_use':
      if (entry.status === 'running') {
        console.log(`[Tool: ${entry.name}]`);
      } else if (entry.status === 'completed' || entry.status === 'failed') {
        console.log(`[Tool ${entry.name}: ${entry.status}]`);
        if (entry.result) {
          console.log(entry.result);
        }
      }
      break;

    case 'error':
      console.error(`Error: ${entry.message}`);
      break;

    case 'file_change':
      console.log(`[File ${entry.action}: ${entry.path}]`);
      break;

    case 'command_exec':
      console.log(`[Exec: ${entry.command}]`);
      break;

    case 'token_usage':
      console.log(`[Tokens: ${entry.inputTokens}in/${entry.outputTokens}out]`);
      break;

    // Silently skip: user_message, thinking, approval_request,
    // approval_response, status_change (handled by the runner itself)
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// CliAgentRunner
// ---------------------------------------------------------------------------

export class CliAgentRunner {
  /** Resolve dashboard WS URL from env → config → default port 3001 */
  private static getDashboardWsUrl(): string {
    const envPort = process.env.MAESTRO_DASHBOARD_PORT;
    if (envPort) {
      const p = parseInt(envPort, 10);
      if (!isNaN(p)) return `ws://127.0.0.1:${p}/ws`;
    }
    try {
      const configPath = resolve(process.cwd(), '.workflow', 'config.json');
      const raw = readFileSync(configPath, 'utf-8');
      const json = JSON.parse(raw) as Record<string, unknown>;
      const dashboard = json['dashboard'] as Record<string, unknown> | undefined;
      if (dashboard?.port && typeof dashboard.port === 'number') {
        return `ws://127.0.0.1:${dashboard.port}/ws`;
      }
    } catch {
      // Config missing or unreadable — use default
    }
    return 'ws://127.0.0.1:3001/ws';
  }

  /**
   * Run a CLI agent to completion and return its exit code (0 = success).
   */
  async run(options: CliRunOptions): Promise<number> {
    const agentType = TOOL_TO_AGENT_TYPE[options.tool];
    if (!agentType) {
      console.error(`Unknown tool: ${options.tool}`);
      return 1;
    }

    // Generate or use provided execution ID
    const execId = options.execId ?? generateExecId(options.tool);
    process.stderr.write(`[MAESTRO_EXEC_ID=${execId}]\n`);

    // History store for persistence and resume
    const store = new CliHistoryStore();

    // Handle --resume: prepend previous session context to user prompt
    let userPrompt = options.prompt;
    if (options.resume) {
      let resumeId = options.resume;
      if (resumeId === 'last') {
        const recent = store.listRecent(1);
        resumeId = recent.length > 0 ? recent[0].execId : '';
      }
      if (resumeId) {
        userPrompt = store.buildResumePrompt(resumeId, userPrompt);
      } else {
        console.error('No previous execution found for --resume');
      }
    }

    // Assemble final prompt: protocol + user prompt + template
    const finalPrompt = await assemblePrompt(userPrompt, options.mode, options.rule);

    const adapter = await createAdapter(agentType);

    // Optional Dashboard bridge — connect silently, don't block startup
    const bridge = new DashboardBridge();
    const bridgeConnected = await bridge.tryConnect(CliAgentRunner.getDashboardWsUrl(), 1000);
    if (!bridgeConnected) {
      process.stderr.write('[Dashboard not connected — real-time view unavailable]\n');
    }

    const config: AgentConfig = {
      type: agentType,
      prompt: finalPrompt,
      workDir: options.workDir,
      model: options.model,
      approvalMode: options.mode === 'write' ? 'auto' : 'suggest',
    };

    const agentProcess = await adapter.spawn(config);
    bridge.forwardSpawn(agentProcess as unknown as Parameters<typeof bridge.forwardSpawn>[0]);

    // Safety net: if the process exits without a stopped event (e.g. Windows
    // shell process tree doesn't fire exit/close reliably), write meta.json
    // from the synchronous process.on('exit') handler as a last resort.
    let metaWritten = false;

    const saveMeta = (exitCode: number) => {
      if (metaWritten) return;
      metaWritten = true;
      store.saveMeta(execId, {
        execId,
        tool: options.tool,
        model: options.model,
        mode: options.mode,
        prompt: options.prompt.substring(0, 500),
        workDir: options.workDir,
        startedAt: agentProcess.startedAt,
        completedAt: new Date().toISOString(),
        exitCode,
      });
    };

    const processExitHandler = () => {
      saveMeta(0);
    };
    process.on('exit', processExitHandler);

    return new Promise<number>((resolvePromise) => {
      const unsubscribe = adapter.onEntry(agentProcess.id, (entry) => {
        // Persist entry to JSONL history before rendering
        store.appendEntry(execId, entry as unknown as EntryLike);

        renderEntry(entry);
        bridge.forwardEntry(entry as unknown as Parameters<typeof bridge.forwardEntry>[0]);

        // Resolve when the agent process stops
        if (entry.type === 'status_change' && entry.status === 'stopped') {
          saveMeta(0);
          process.removeListener('exit', processExitHandler);
          bridge.forwardStopped(agentProcess.id);
          bridge.close();
          unsubscribe();
          resolvePromise(0);
        }

        // Resolve with error code on error status
        if (entry.type === 'status_change' && entry.status === 'error') {
          saveMeta(1);
          process.removeListener('exit', processExitHandler);
          bridge.forwardStopped(agentProcess.id);
          bridge.close();
          unsubscribe();
          resolvePromise(1);
        }
      });
    });
  }
}
