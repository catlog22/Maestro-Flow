// ---------------------------------------------------------------------------
// StreamJsonAdapter — shared adapter for Gemini CLI and Qwen CLI
// Both use the `-o stream-json` output protocol with identical message shapes.
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type {
  AgentType,
  AgentConfig,
  AgentProcess,
  ApprovalDecision,
} from '../../shared/agent-types.js';
import { BaseAgentAdapter } from './base-adapter.js';
import { EntryNormalizer } from './entry-normalizer.js';

// ---------------------------------------------------------------------------
// Stream-json message shapes (shared by Gemini CLI and Qwen CLI)
// ---------------------------------------------------------------------------

interface StreamJsonInit {
  type: 'init';
}

interface StreamJsonMessage {
  type: 'message';
  content?: string;
  delta?: boolean;
}

interface StreamJsonToolUse {
  type: 'tool_use';
  name?: string;
  input?: Record<string, unknown>;
}

interface StreamJsonToolResult {
  type: 'tool_result';
  name?: string;
  content?: string;
  is_error?: boolean;
}

interface StreamJsonResult {
  type: 'result';
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

type StreamJsonMsg =
  | StreamJsonInit
  | StreamJsonMessage
  | StreamJsonToolUse
  | StreamJsonToolResult
  | StreamJsonResult;

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class StreamJsonAdapter extends BaseAgentAdapter {
  readonly agentType: AgentType;

  private readonly executable: string;
  private readonly childProcesses = new Map<string, ChildProcess>();
  private readonly readlineInterfaces = new Map<string, ReadlineInterface>();
  private readonly lastContentLength = new Map<string, number>();

  constructor(executable: string, agentType: AgentType) {
    super();
    this.executable = executable;
    this.agentType = agentType;
  }

  // --- Lifecycle hooks -----------------------------------------------------

  protected async doSpawn(
    processId: string,
    config: AgentConfig,
  ): Promise<AgentProcess> {
    const args = this.buildArgs(config);
    const [cmd, ...cmdArgs] = this.executable.split(/\s+/);

    const child = spawn(cmd, [...cmdArgs, ...args], {
      cwd: config.workDir,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    if (!child.stdout || !child.stdin || !child.stderr) {
      throw new Error(
        `Failed to spawn ${this.agentType}: stdio streams not available`,
      );
    }

    // Pipe prompt to stdin then close the write end
    child.stdin.write(config.prompt);
    child.stdin.end();

    // Line-by-line parsing of stream-json stdout
    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line: string) => {
      this.parseStreamJsonMessage(line, processId);
    });

    // Stderr => error entries
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text.length > 0) {
        this.emitEntry(processId, EntryNormalizer.error(processId, text, 'stderr'));
      }
    });

    // Process exit handling
    this.setupProcessListeners(child, processId);

    // Store references
    this.childProcesses.set(processId, child);
    this.readlineInterfaces.set(processId, rl);

    return {
      id: processId,
      type: this.agentType,
      status: 'running',
      config,
      startedAt: new Date().toISOString(),
      pid: child.pid,
    };
  }

  protected async doStop(processId: string): Promise<void> {
    const child = this.childProcesses.get(processId);
    if (!child) {
      return;
    }

    const proc = this.getProcess(processId);
    if (proc) {
      proc.status = 'stopping';
      this.emitEntry(
        processId,
        EntryNormalizer.statusChange(processId, 'stopping', 'User requested stop'),
      );
    }

    // Graceful SIGTERM
    child.kill('SIGTERM');

    // SIGKILL fallback after 5 seconds
    const killTimer = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5000);

    child.once('exit', () => {
      clearTimeout(killTimer);
    });

    this.cleanup(processId);
  }

  protected async doSendMessage(
    processId: string,
    _content: string,
  ): Promise<void> {
    // Gemini/Qwen receive prompt via stdin at spawn time.
    // Follow-up messages are not supported in stream-json mode.
    throw new Error(
      `[${this.agentType}] Follow-up messages are not supported in stream-json mode`,
    );
  }

  protected async doRespondApproval(_decision: ApprovalDecision): Promise<void> {
    // Gemini/Qwen handle approvals via --approval-mode flag, not stdin.
    // No-op.
  }

  // --- Stream-json parsing -------------------------------------------------

  private parseStreamJsonMessage(line: string, processId: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }

    let msg: StreamJsonMsg;
    try {
      msg = JSON.parse(trimmed) as StreamJsonMsg;
    } catch {
      // Non-JSON lines (e.g. npx bootstrap output) are silently skipped
      return;
    }

    if (!msg || typeof msg !== 'object' || !('type' in msg)) {
      return;
    }

    switch (msg.type) {
      case 'init': {
        this.emitEntry(
          processId,
          EntryNormalizer.statusChange(processId, 'running', 'Session started'),
        );
        break;
      }

      case 'message': {
        this.handleMessageEntry(msg, processId);
        break;
      }

      case 'tool_use': {
        const name = msg.name ?? 'unknown';
        const input = msg.input ?? {};
        this.emitEntry(
          processId,
          EntryNormalizer.toolUse(processId, name, input, 'running'),
        );
        break;
      }

      case 'tool_result': {
        const name = msg.name ?? 'unknown';
        const status = msg.is_error ? 'failed' : 'completed';
        this.emitEntry(
          processId,
          EntryNormalizer.toolUse(processId, name, {}, status, msg.content),
        );
        break;
      }

      case 'result': {
        if (msg.usage) {
          this.emitEntry(
            processId,
            EntryNormalizer.tokenUsage(
              processId,
              msg.usage.input_tokens ?? 0,
              msg.usage.output_tokens ?? 0,
            ),
          );
        }
        break;
      }

      default:
        break;
    }
  }

  private handleMessageEntry(msg: StreamJsonMessage, processId: string): void {
    const content = msg.content ?? '';

    if (msg.delta) {
      // Cumulative-to-delta conversion: stream-json sends cumulative text
      const lastLen = this.lastContentLength.get(processId) ?? 0;
      const delta = content.slice(lastLen);
      this.lastContentLength.set(processId, content.length);
      if (delta.length > 0) {
        this.emitEntry(
          processId,
          EntryNormalizer.assistantMessage(processId, delta, true),
        );
      }
    } else {
      // Complete message — reset cumulative tracker and emit full content
      this.lastContentLength.delete(processId);
      if (content.length > 0) {
        this.emitEntry(
          processId,
          EntryNormalizer.assistantMessage(processId, content, false),
        );
      }
    }
  }

  // --- Helpers -------------------------------------------------------------

  private buildArgs(config: AgentConfig): string[] {
    const args: string[] = ['-o', 'stream-json'];

    if (config.model) {
      args.push('-m', config.model);
    }

    if (config.approvalMode === 'auto') {
      args.push('--approval-mode', 'yolo');
    }

    return args;
  }

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
    const rl = this.readlineInterfaces.get(processId);
    if (rl) {
      rl.close();
      this.readlineInterfaces.delete(processId);
    }
    this.childProcesses.delete(processId);
    this.lastContentLength.delete(processId);
  }
}
