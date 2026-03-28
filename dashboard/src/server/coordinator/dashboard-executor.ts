// ---------------------------------------------------------------------------
// DashboardExecutor — CommandExecutor implementation for the Dashboard.
// Bridges the Graph Coordinator's ExecuteRequest/ExecuteResult interface
// to the Dashboard's AgentManager spawn/stop lifecycle.
// ---------------------------------------------------------------------------

import type { AgentStoppedPayload, NormalizedEntry } from '../../shared/agent-types.js';
import type { SSEEvent } from '../../shared/types.js';
import type { DashboardEventBus } from '../state/event-bus.js';
import type { AgentManager } from '../agents/agent-manager.js';

import type {
  ExecuteRequest,
  ExecuteResult,
  CommandExecutor,
} from '../../../../src/coordinator/graph-types.js';
import type { AgentType as DashboardAgentType } from '../../shared/agent-types.js';

// ---------------------------------------------------------------------------
// DashboardExecutor
// ---------------------------------------------------------------------------

export class DashboardExecutor implements CommandExecutor {
  private activeProcessId: string | null = null;

  constructor(
    private readonly agentManager: AgentManager,
    private readonly eventBus: DashboardEventBus,
  ) {}

  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const startTime = Date.now();

    try {
      const agentType = request.agent_type as unknown as DashboardAgentType;
      const proc = await this.agentManager.spawn(agentType, {
        type: agentType,
        prompt: request.prompt,
        workDir: request.work_dir,
        approvalMode: request.approval_mode,
      });

      this.activeProcessId = proc.id;

      // Wait for the agent to stop (completed or errored)
      const reason = await this.waitForStopped(proc.id, request.timeout_ms);
      this.activeProcessId = null;

      const output = this.collectOutput(proc.id);
      const durationMs = Date.now() - startTime;

      return {
        success: !reason?.startsWith('error'),
        raw_output: output,
        exec_id: proc.id,
        duration_ms: durationMs,
        process_id: proc.id,
      };
    } catch (err: unknown) {
      this.activeProcessId = null;
      return {
        success: false,
        raw_output: err instanceof Error ? err.message : String(err),
        exec_id: '',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  async abort(): Promise<void> {
    if (!this.activeProcessId) return;
    try {
      await this.agentManager.stop(this.activeProcessId);
    } catch { /* Agent may have already stopped */ }
    this.activeProcessId = null;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private waitForStopped(processId: string, timeoutMs: number): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const handler = (event: SSEEvent) => {
        const payload = event.data as AgentStoppedPayload;
        if (payload.processId !== processId) return;
        cleanup();
        resolve(payload.reason);
      };

      const cleanup = () => {
        this.eventBus.off('agent:stopped', handler);
        if (timer) clearTimeout(timer);
      };

      this.eventBus.on('agent:stopped', handler);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Agent timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private collectOutput(processId: string): string {
    const entries: NormalizedEntry[] = this.agentManager.getEntries(processId);
    const parts: string[] = [];

    for (const entry of entries) {
      if (entry.type === 'assistant_message') {
        const msg = entry as NormalizedEntry & { content?: string; message?: string };
        parts.push(msg.content ?? msg.message ?? '');
      }
    }

    const joined = parts.join('\n');
    return joined.length > 50_000 ? joined.slice(-50_000) : joined;
  }
}
