// ---------------------------------------------------------------------------
// CodexAppServerAdapter — Codex app-server mode (JSON-RPC 2.0 over stdio)
//
// Reference: G:\github_lib\symphony\elixir\lib\symphony_elixir\codex\app_server.ex
//
// Protocol flow:
//   spawn  → start process → initialize → thread/start → turn/start
//   message → turn/start (new turn in same thread)
//   stop   → SIGTERM → SIGKILL fallback
//
// Unlike exec mode, app-server supports:
//   - Multi-turn sessions (continuation)
//   - Configurable approval policies
//   - Workspace-scoped sandboxing
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type {
  AgentConfig,
  AgentProcess,
  ApprovalDecision,
} from '../../shared/agent-types.js';
import { BaseAgentAdapter } from './base-adapter.js';
import { EntryNormalizer } from './entry-normalizer.js';

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  method: string;
  id?: number;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string };
}

interface JsonRpcNotification {
  method: string;
  params?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

interface AppServerSession {
  child: ChildProcess;
  rl: ReadlineInterface;
  threadId: string | null;
  turnId: string | null;
  nextRpcId: number;
  pendingRpc: Map<number, {
    resolve: (result: Record<string, unknown>) => void;
    reject: (error: Error) => void;
  }>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CodexAppServerConfig {
  /** Codex command. Defaults to 'codex app-server' */
  command?: string;
  /** Approval policy: 'never' (auto-approve all) or 'unless-allow-listed' */
  approvalPolicy?: string;
  /** Thread sandbox: 'workspace-write' */
  threadSandbox?: string;
}

const DEFAULT_APP_CONFIG: Required<CodexAppServerConfig> = {
  command: 'codex',
  approvalPolicy: 'never',
  threadSandbox: 'workspace-write',
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class CodexAppServerAdapter extends BaseAgentAdapter {
  readonly agentType = 'codex' as const;

  private readonly sessions = new Map<string, AppServerSession>();
  private readonly appConfig: Required<CodexAppServerConfig>;

  constructor(config?: CodexAppServerConfig) {
    super();
    this.appConfig = { ...DEFAULT_APP_CONFIG, ...config };
  }

  // --- Lifecycle -----------------------------------------------------------

  protected async doSpawn(
    processId: string,
    config: AgentConfig,
  ): Promise<AgentProcess> {
    const child = spawn(this.appConfig.command, ['app-server'], {
      cwd: config.workDir,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    if (!child.stdout || !child.stdin || !child.stderr) {
      throw new Error('Failed to spawn Codex app-server: stdio not available');
    }

    const rl = createInterface({ input: child.stdout });
    const session: AppServerSession = {
      child,
      rl,
      threadId: null,
      turnId: null,
      nextRpcId: 1,
      pendingRpc: new Map(),
    };

    this.sessions.set(processId, session);

    // Wire up line-by-line JSON-RPC processing
    rl.on('line', (line: string) => {
      this.handleLine(processId, session, line);
    });

    // Stderr → error entries
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text.length > 0) {
        // Codex app-server may write progress/debug to stderr
        if (/\b(error|fatal)\b/i.test(text)) {
          this.emitEntry(processId, EntryNormalizer.error(processId, text, 'stderr'));
        }
      }
    });

    // Process exit
    this.setupProcessListeners(child, processId);

    // --- Initialize session ---
    try {
      await this.rpcCall(session, 'initialize', {
        capabilities: { experimentalApi: true },
        clientInfo: {
          name: 'maestro-dashboard',
          title: 'Maestro Dashboard',
          version: '1.0.0',
        },
      });

      // Send 'initialized' notification (no id = notification)
      this.sendNotification(session, 'initialized', {});

      // Start thread
      const threadResult = await this.rpcCall(session, 'thread/start', {
        approvalPolicy: this.appConfig.approvalPolicy,
        sandbox: this.appConfig.threadSandbox,
        cwd: config.workDir,
      });

      const threadId = (threadResult as { thread?: { id?: string } }).thread?.id;
      if (!threadId) {
        throw new Error('thread/start did not return thread.id');
      }
      session.threadId = threadId;

      this.emitEntry(
        processId,
        EntryNormalizer.statusChange(processId, 'running', 'Codex app-server session started'),
      );

      // Start first turn with the prompt
      await this.startTurn(processId, session, config.prompt, config.workDir);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emitEntry(processId, EntryNormalizer.error(processId, message, 'init_error'));
      child.kill('SIGTERM');
      throw err;
    }

    return {
      id: processId,
      type: 'codex',
      status: 'running',
      config,
      startedAt: new Date().toISOString(),
      pid: child.pid,
      interactive: true,
    };
  }

  protected async doStop(processId: string): Promise<void> {
    const session = this.sessions.get(processId);
    if (!session) return;

    const proc = this.getProcess(processId);
    if (proc) {
      proc.status = 'stopping';
      this.emitEntry(
        processId,
        EntryNormalizer.statusChange(processId, 'stopping', 'User requested stop'),
      );
    }

    session.child.kill('SIGTERM');

    const killTimer = setTimeout(() => {
      if (!session.child.killed) {
        session.child.kill('SIGKILL');
      }
    }, 5000);

    session.child.once('exit', () => clearTimeout(killTimer));

    this.cleanup(processId);
  }

  protected async doSendMessage(
    processId: string,
    content: string,
  ): Promise<void> {
    const session = this.sessions.get(processId);
    if (!session?.threadId) {
      throw new Error('No active session for interactive messaging');
    }

    const config = this.getProcess(processId)?.config;
    const workDir = config?.workDir ?? process.cwd();

    // Start a new turn in the existing thread
    await this.startTurn(processId, session, content, workDir);
  }

  protected async doRespondApproval(_decision: ApprovalDecision): Promise<void> {
    // App-server with approvalPolicy='never' auto-approves.
    // If approval policy is changed, implement approval response here.
  }

  // --- Turn management -----------------------------------------------------

  private async startTurn(
    processId: string,
    session: AppServerSession,
    prompt: string,
    workDir: string,
  ): Promise<void> {
    const result = await this.rpcCall(session, 'turn/start', {
      threadId: session.threadId,
      input: [{ type: 'text', text: prompt }],
      cwd: workDir,
      approvalPolicy: this.appConfig.approvalPolicy,
      sandboxPolicy: { type: 'workspaceWrite' },
    });

    const turnId = (result as { turn?: { id?: string } }).turn?.id;
    session.turnId = turnId ?? null;
  }

  // --- JSON-RPC 2.0 communication -----------------------------------------

  private rpcCall(
    session: AppServerSession,
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const id = session.nextRpcId++;

      // Timeout for RPC calls (30s) — cleared on resolve/reject
      const timeoutId = setTimeout(() => {
        if (session.pendingRpc.has(id)) {
          session.pendingRpc.delete(id);
          reject(new Error(`RPC timeout: ${method} (id=${id})`));
        }
      }, 30_000);

      const cleanup = () => clearTimeout(timeoutId);

      session.pendingRpc.set(id, {
        resolve: (result) => { cleanup(); resolve(result); },
        reject: (error) => { cleanup(); reject(error); },
      });

      const request: JsonRpcRequest = { method, id, params };
      const line = JSON.stringify(request);

      if (session.child.stdin?.writable) {
        session.child.stdin.write(line + '\n');
      } else {
        session.pendingRpc.get(id)!.reject(new Error('stdin not writable'));
        session.pendingRpc.delete(id);
      }
    });
  }

  private sendNotification(
    session: AppServerSession,
    method: string,
    params: Record<string, unknown>,
  ): void {
    const notification: JsonRpcNotification = { method, params };
    if (session.child.stdin?.writable) {
      session.child.stdin.write(JSON.stringify(notification) + '\n');
    }
  }

  // --- Line processing -----------------------------------------------------

  private handleLine(
    processId: string,
    session: AppServerSession,
    line: string,
  ): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }

    // JSON-RPC response (has id, matches pending)
    if (typeof msg.id === 'number' && session.pendingRpc.has(msg.id)) {
      const pending = session.pendingRpc.get(msg.id)!;
      session.pendingRpc.delete(msg.id);

      if (msg.error) {
        const err = msg.error as { message?: string };
        pending.reject(new Error(err.message ?? 'RPC error'));
      } else {
        pending.resolve((msg.result as Record<string, unknown>) ?? {});
      }
      return;
    }

    // JSON-RPC notification (method-based events)
    const method = msg.method as string | undefined;
    if (!method) return;

    this.handleNotification(processId, method, msg.params as Record<string, unknown> ?? {});
  }

  private handleNotification(
    processId: string,
    method: string,
    params: Record<string, unknown>,
  ): void {
    switch (method) {
      case 'turn/completed':
        this.emitEntry(
          processId,
          EntryNormalizer.statusChange(processId, 'stopped', 'Turn completed'),
        );
        break;

      case 'turn/failed': {
        const reason = (params.reason as string) ?? 'Turn failed';
        this.emitEntry(processId, EntryNormalizer.error(processId, reason, 'turn_failed'));
        break;
      }

      case 'turn/cancelled':
        this.emitEntry(
          processId,
          EntryNormalizer.statusChange(processId, 'stopped', 'Turn cancelled'),
        );
        break;

      case 'item/completed': {
        const item = params.item as Record<string, unknown> | undefined;
        if (item) {
          this.classifyItem(processId, item);
        }
        break;
      }

      case 'usage/updated': {
        const usage = params as { inputTokens?: number; outputTokens?: number };
        if (usage.inputTokens || usage.outputTokens) {
          this.emitEntry(
            processId,
            EntryNormalizer.tokenUsage(
              processId,
              usage.inputTokens ?? 0,
              usage.outputTokens ?? 0,
            ),
          );
        }
        break;
      }

      // Other methods: silently skip
      default:
        break;
    }
  }

  private classifyItem(processId: string, item: Record<string, unknown>): void {
    const type = item.type as string | undefined;
    const name = (item.name as string | undefined)?.toLowerCase() ?? '';

    // Function call output (command execution)
    if (type === 'function_call_output' || (type === 'function_call' && /exec|shell|command|run|bash/.test(name))) {
      this.emitEntry(
        processId,
        EntryNormalizer.commandExec(
          processId,
          (item.name as string) ?? 'codex_exec',
          undefined,
          (item.output as string) ?? '',
        ),
      );
      return;
    }

    // File operation
    if (type === 'function_call' && /file|write|create|patch|edit|apply/.test(name)) {
      const filePath = (item.filename as string) ?? (item.path as string) ?? name;
      const action = /create|new/.test(name) ? 'create' as const
        : /delete|remove/.test(name) ? 'delete' as const
        : 'modify' as const;
      this.emitEntry(
        processId,
        EntryNormalizer.fileChange(processId, filePath, action, item.diff as string | undefined),
      );
      return;
    }

    // Text content
    const text = this.extractText(item);
    if (text.length > 0) {
      this.emitEntry(
        processId,
        EntryNormalizer.assistantMessage(processId, text, false),
      );
    }
  }

  private extractText(item: Record<string, unknown>): string {
    const content = item.content as Array<{ type?: string; text?: string }> | undefined;
    if (Array.isArray(content)) {
      return content.filter((c) => typeof c.text === 'string').map((c) => c.text!).join('');
    }
    if (typeof item.text === 'string') return item.text;
    if (typeof item.output === 'string') return item.output;
    return '';
  }

  // --- Process lifecycle ---------------------------------------------------

  private setupProcessListeners(child: ChildProcess, processId: string): void {
    child.on('exit', (code: number | null, signal: string | null) => {
      const reason = signal
        ? `Terminated by signal: ${signal}`
        : `Exited with code: ${code ?? 'unknown'}`;

      this.emitEntry(
        processId,
        EntryNormalizer.statusChange(processId, 'stopped', reason),
      );

      const proc = this.getProcess(processId);
      if (proc) {
        proc.status = 'stopped';
      }

      this.cleanup(processId);
      this.removeProcess(processId);
    });

    child.on('error', (err: Error) => {
      this.emitEntry(
        processId,
        EntryNormalizer.error(processId, err.message, 'spawn_error'),
      );

      const proc = this.getProcess(processId);
      if (proc) {
        proc.status = 'error';
      }
    });
  }

  private cleanup(processId: string): void {
    const session = this.sessions.get(processId);
    if (session) {
      session.rl.close();
      // Reject any pending RPCs
      for (const [, pending] of session.pendingRpc) {
        pending.reject(new Error('Session closed'));
      }
      session.pendingRpc.clear();
      this.sessions.delete(processId);
    }
  }
}
