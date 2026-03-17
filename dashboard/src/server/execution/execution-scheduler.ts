// ---------------------------------------------------------------------------
// ExecutionScheduler — orchestrates issue execution via agent processes
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AgentType, AgentProcess } from '../../shared/agent-types.js';
import type { Issue, IssueStatus } from '../../shared/issue-types.js';
import type {
  ExecutionSlot,
  IssueExecution,
  SupervisorConfig,
  SupervisorStatus,
} from '../../shared/execution-types.js';
import { DEFAULT_SUPERVISOR_CONFIG } from '../../shared/execution-types.js';
import type { AgentManager } from '../agents/agent-manager.js';
import type { DashboardEventBus } from '../state/event-bus.js';

// ---------------------------------------------------------------------------
// JSONL helpers
// ---------------------------------------------------------------------------

async function readIssuesJsonl(filePath: string): Promise<Issue[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }
  const issues: Issue[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      issues.push(JSON.parse(trimmed) as Issue);
    } catch {
      // skip malformed lines
    }
  }
  return issues;
}

async function writeIssuesJsonl(filePath: string, issues: Issue[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const content = issues.map((i) => JSON.stringify(i)).join('\n') + '\n';
  await writeFile(filePath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Write lock — serialize all JSONL file operations to prevent data races
// ---------------------------------------------------------------------------

let writeLock: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock;
  let resolve!: () => void;
  writeLock = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(resolve);
}

// ---------------------------------------------------------------------------
// Valid agent types for input validation
// ---------------------------------------------------------------------------

const VALID_EXECUTORS = new Set<string>([
  'claude-code', 'codex', 'gemini', 'qwen', 'opencode',
]);

// ---------------------------------------------------------------------------
// ExecutionScheduler
// ---------------------------------------------------------------------------

export class ExecutionScheduler {
  private readonly runningSlots = new Map<string, ExecutionSlot>();
  private readonly queue: string[] = [];
  private readonly retryQueue = new Map<string, { retryAt: number; count: number }>();
  private readonly claimed = new Set<string>();
  private config: SupervisorConfig;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt: string | null = null;
  private stats = { totalDispatched: 0, totalCompleted: 0, totalFailed: 0 };

  constructor(
    private readonly agentManager: AgentManager,
    private readonly eventBus: DashboardEventBus,
    private readonly jsonlPath: string,
    config?: Partial<SupervisorConfig>,
  ) {
    this.config = { ...DEFAULT_SUPERVISOR_CONFIG, ...config };
    this.subscribeToAgentEvents();
    // Recover state from persisted issues on startup
    void this.recoverState();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Dispatch a single issue for execution */
  async executeIssue(issueId: string, executor?: AgentType): Promise<void> {
    if (!this.claim(issueId)) return;

    if (executor && !VALID_EXECUTORS.has(executor)) {
      this.claimed.delete(issueId);
      throw new Error(`Invalid executor: ${executor}`);
    }

    const issue = await this.findIssue(issueId);
    if (!issue) {
      this.claimed.delete(issueId);
      throw new Error(`Issue not found: ${issueId}`);
    }

    const resolvedExecutor = executor ?? issue.executor ?? this.config.defaultExecutor;
    await this.dispatch(issue, resolvedExecutor);
  }

  /** Enqueue multiple issues for batch execution */
  async executeBatch(
    issueIds: string[],
    executor?: AgentType,
    maxConcurrency?: number,
  ): Promise<void> {
    if (executor && !VALID_EXECUTORS.has(executor)) {
      throw new Error(`Invalid executor: ${executor}`);
    }

    const concurrency = maxConcurrency ?? this.config.maxConcurrentAgents;
    const unclaimed = issueIds.filter((id) => this.claim(id));

    // Fill available slots immediately, rest goes to queue
    const availableSlots = concurrency - this.runningSlots.size;
    const immediate = unclaimed.slice(0, Math.max(0, availableSlots));
    const queued = unclaimed.slice(Math.max(0, availableSlots));

    this.queue.push(...queued);

    // Update queued issues' execution state
    for (const id of queued) {
      await this.updateIssueFields(id, {
        execution: { status: 'queued', retryCount: 0 },
      });
    }

    // Dispatch immediate batch
    for (const id of immediate) {
      const issue = await this.findIssue(id);
      if (issue) {
        const resolvedExecutor = executor ?? issue.executor ?? this.config.defaultExecutor;
        await this.dispatch(issue, resolvedExecutor);
      }
    }
  }

  /** Cancel a running or queued issue */
  async cancelIssue(issueId: string): Promise<void> {
    // Remove from queue
    const queueIdx = this.queue.indexOf(issueId);
    if (queueIdx >= 0) this.queue.splice(queueIdx, 1);

    // Remove from retry queue
    this.retryQueue.delete(issueId);

    // Stop running agent
    for (const [processId, slot] of this.runningSlots) {
      if (slot.issueId === issueId) {
        await this.agentManager.stop(processId).catch((err: unknown) => {
          console.warn(`[Execution] Failed to stop agent ${processId}:`, err);
        });
        this.runningSlots.delete(processId);
        break;
      }
    }

    this.claimed.delete(issueId);
    await this.updateIssueFields(issueId, {
      execution: { status: 'idle', retryCount: 0 },
    });
  }

  /** Start the supervisor tick loop */
  startSupervisor(): void {
    if (this.tickTimer) return;
    this.config.enabled = true;
    this.tickTimer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
    this.emitStatus();
  }

  /** Stop the supervisor */
  stopSupervisor(): void {
    this.config.enabled = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.emitStatus();
  }

  /** Update supervisor config */
  updateConfig(partial: Partial<SupervisorConfig>): void {
    const wasEnabled = this.config.enabled;
    Object.assign(this.config, partial);

    // Restart tick timer if interval changed
    if (this.config.enabled && this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
    }

    if (this.config.enabled && !wasEnabled) {
      this.startSupervisor();
    } else if (!this.config.enabled && wasEnabled) {
      this.stopSupervisor();
    }

    this.emitStatus();
  }

  /** Get a snapshot of current scheduler state */
  getStatus(): SupervisorStatus {
    return {
      enabled: this.config.enabled,
      running: Array.from(this.runningSlots.values()),
      queued: [...this.queue],
      retrying: Array.from(this.retryQueue.entries()).map(([issueId, r]) => ({
        issueId,
        retryAt: new Date(r.retryAt).toISOString(),
      })),
      lastTickAt: this.lastTickAt,
      stats: { ...this.stats },
    };
  }

  /** Get config */
  getConfig(): SupervisorConfig {
    return { ...this.config };
  }

  /** Get the execution slot for a given issue */
  getSlotForIssue(issueId: string): ExecutionSlot | undefined {
    for (const slot of this.runningSlots.values()) {
      if (slot.issueId === issueId) return slot;
    }
    return undefined;
  }

  /** Clean shutdown */
  async destroy(): Promise<void> {
    this.stopSupervisor();
  }

  // -------------------------------------------------------------------------
  // Private: Atomic claim
  // -------------------------------------------------------------------------

  /** Atomically claim an issue. Returns true if successfully claimed. */
  private claim(issueId: string): boolean {
    if (this.claimed.has(issueId)) return false;
    this.claimed.add(issueId);
    return true;
  }

  // -------------------------------------------------------------------------
  // Private: State recovery on startup
  // -------------------------------------------------------------------------

  /** Recover in-memory state from persisted JSONL on startup */
  private async recoverState(): Promise<void> {
    const issues = await readIssuesJsonl(this.jsonlPath);

    for (const issue of issues) {
      if (!issue.execution) continue;

      switch (issue.execution.status) {
        case 'running':
          // Agent process is gone after restart — mark as failed for retry
          this.claimed.add(issue.id);
          await this.updateIssueFields(issue.id, {
            execution: {
              ...issue.execution,
              status: 'retrying',
              lastError: 'Server restarted while executing',
            },
          });
          this.retryQueue.set(issue.id, {
            retryAt: Date.now() + this.config.retryBackoffMs,
            count: (issue.execution.retryCount ?? 0) + 1,
          });
          break;

        case 'queued':
          // Re-enqueue
          this.claimed.add(issue.id);
          this.queue.push(issue.id);
          break;

        case 'retrying': {
          // Re-add to retry queue
          this.claimed.add(issue.id);
          const count = issue.execution.retryCount ?? 1;
          const backoff = this.config.retryBackoffMs * Math.pow(2, count - 1);
          this.retryQueue.set(issue.id, {
            retryAt: Date.now() + backoff,
            count,
          });
          break;
        }

        // idle, completed, failed — no recovery needed
      }
    }

    if (this.queue.length > 0 || this.retryQueue.size > 0) {
      console.log(`[Execution] Recovered state: ${this.queue.length} queued, ${this.retryQueue.size} retrying`);
    }
  }

  // -------------------------------------------------------------------------
  // Private: Dispatch
  // -------------------------------------------------------------------------

  private async dispatch(issue: Issue, executor: AgentType): Promise<void> {
    const prompt = this.buildPrompt(issue);
    const workDir = process.cwd();
    const now = new Date().toISOString();
    const retryCount = issue.execution?.retryCount ?? 0;

    // Update issue: execution state + status in a single write
    await this.updateIssueFields(issue.id, {
      status: 'in_progress',
      execution: {
        status: 'running',
        retryCount,
        startedAt: now,
      },
    });

    let proc: AgentProcess;
    try {
      proc = await this.agentManager.spawn(executor, {
        type: executor,
        prompt,
        workDir,
        approvalMode: 'auto',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.handleFailure(issue.id, message);
      return;
    }

    const slot: ExecutionSlot = {
      issueId: issue.id,
      processId: proc.id,
      executor,
      startedAt: now,
      lastActivityAt: now,
    };

    this.runningSlots.set(proc.id, slot);

    // Update processId on issue
    await this.updateIssueFields(issue.id, {
      execution: {
        status: 'running',
        processId: proc.id,
        retryCount,
        startedAt: now,
      },
    });

    this.stats.totalDispatched++;

    this.eventBus.emit('execution:started', {
      issueId: issue.id,
      processId: proc.id,
      executor,
    });
  }

  private buildPrompt(issue: Issue): string {
    const mode = issue.promptMode ?? this.config.defaultPromptMode;

    if (mode === 'skill') {
      return `Execute the following issue:\n\nIssue ID: ${issue.id}\nTitle: ${issue.title}\nType: ${issue.type}\nPriority: ${issue.priority}\n\nDescription:\n${issue.description}`;
    }

    // Direct mode — assemble natural language prompt
    return [
      `You are working on the following ${issue.type} issue:`,
      '',
      `## ${issue.title}`,
      '',
      issue.description,
      '',
      `Priority: ${issue.priority}`,
      '',
      'Please implement this issue. Follow existing code patterns and conventions.',
      'When done, provide a summary of the changes made.',
    ].join('\n');
  }

  // -------------------------------------------------------------------------
  // Private: Agent event handling
  // -------------------------------------------------------------------------

  private subscribeToAgentEvents(): void {
    this.eventBus.on('agent:stopped', (event) => {
      const payload = event.data as { processId: string; reason?: string };
      void this.handleAgentStopped(payload.processId, payload.reason);
    });

    // Track activity for stall detection
    this.eventBus.on('agent:entry', (event) => {
      const entry = event.data as { processId: string };
      const slot = this.runningSlots.get(entry.processId);
      if (slot) {
        slot.lastActivityAt = new Date().toISOString();
      }
    });
  }

  private async handleAgentStopped(processId: string, reason?: string): Promise<void> {
    const slot = this.runningSlots.get(processId);
    if (!slot) return;

    this.runningSlots.delete(processId);

    // Check entries for success/failure
    const entries = this.agentManager.getEntries(processId);
    const lastEntries = entries.slice(-5);
    const hasError = lastEntries.some(
      (e) => e.type === 'error' || (e.type === 'status_change' && e.status === 'error'),
    );

    if (hasError || reason === 'error') {
      const errorMsg = reason ?? 'Agent stopped with error';
      await this.handleFailure(slot.issueId, errorMsg);
    } else {
      await this.handleCompletion(slot.issueId, processId);
    }

    // Dispatch next from queue
    await this.dispatchNext();
  }

  private async handleCompletion(issueId: string, processId: string): Promise<void> {
    await this.updateIssueFields(issueId, {
      status: 'resolved',
      execution: {
        status: 'completed',
        retryCount: 0,
        completedAt: new Date().toISOString(),
      },
    });
    this.claimed.delete(issueId);
    this.stats.totalCompleted++;

    this.eventBus.emit('execution:completed', { issueId, processId });
  }

  private async handleFailure(issueId: string, error: string): Promise<void> {
    const issue = await this.findIssue(issueId);
    const currentRetry = issue?.execution?.retryCount ?? 0;

    if (currentRetry < this.config.maxRetries) {
      // Schedule retry with exponential backoff
      const backoff = this.config.retryBackoffMs * Math.pow(2, currentRetry);
      this.retryQueue.set(issueId, {
        retryAt: Date.now() + backoff,
        count: currentRetry + 1,
      });
      await this.updateIssueFields(issueId, {
        execution: {
          status: 'retrying',
          retryCount: currentRetry + 1,
          lastError: error,
        },
      });
    } else {
      await this.updateIssueFields(issueId, {
        execution: {
          status: 'failed',
          retryCount: currentRetry,
          lastError: error,
        },
      });
      this.claimed.delete(issueId);
      this.stats.totalFailed++;
    }

    // Find processId for the failed issue (may already be removed from runningSlots)
    let processId = '';
    for (const [pid, slot] of this.runningSlots) {
      if (slot.issueId === issueId) {
        processId = pid;
        this.runningSlots.delete(pid);
        break;
      }
    }

    this.eventBus.emit('execution:failed', { issueId, processId, error });
  }

  // -------------------------------------------------------------------------
  // Private: Supervisor tick
  // -------------------------------------------------------------------------

  private async tick(): Promise<void> {
    this.lastTickAt = new Date().toISOString();

    // 1. Stall detection
    await this.detectStalls();

    // 2. Process retry queue
    this.processRetries();

    // 3. Auto-dispatch from backlog (priority mode)
    if (this.config.strategy === 'priority') {
      await this.autoDispatchByPriority();
    }

    // 4. Emit status
    this.emitStatus();
  }

  private async detectStalls(): Promise<void> {
    const now = Date.now();
    for (const [processId, slot] of this.runningSlots) {
      const lastActivity = new Date(slot.lastActivityAt).getTime();
      if (now - lastActivity > this.config.stallTimeoutMs) {
        console.warn(`[Execution] Stall detected for issue ${slot.issueId} (process ${processId})`);
        await this.agentManager.stop(processId).catch((err: unknown) => {
          console.warn(`[Execution] Failed to stop stalled agent ${processId}:`, err);
        });
        // handleAgentStopped will clean up
      }
    }
  }

  private processRetries(): void {
    const now = Date.now();
    for (const [issueId, retry] of this.retryQueue) {
      if (now >= retry.retryAt) {
        this.retryQueue.delete(issueId);
        this.queue.unshift(issueId); // Priority position
      }
    }
  }

  private async autoDispatchByPriority(): Promise<void> {
    if (this.queue.length === 0) {
      // Check for unqueued open issues to auto-enqueue
      const issues = await readIssuesJsonl(this.jsonlPath);
      const priorityOrder: Record<string, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      const candidates = issues
        .filter(
          (i) =>
            (i.status === 'open') &&
            (!i.execution || i.execution.status === 'idle') &&
            !this.claimed.has(i.id),
        )
        .sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

      for (const issue of candidates) {
        if (this.claim(issue.id)) {
          this.queue.push(issue.id);
          await this.updateIssueFields(issue.id, {
            execution: { status: 'queued', retryCount: 0 },
          });
        }
      }
    }

    await this.dispatchNext();
  }

  private async dispatchNext(): Promise<void> {
    while (
      this.queue.length > 0 &&
      this.runningSlots.size < this.config.maxConcurrentAgents
    ) {
      const issueId = this.queue.shift()!;
      const issue = await this.findIssue(issueId);
      if (!issue) {
        this.claimed.delete(issueId);
        continue;
      }
      const executor = issue.executor ?? this.config.defaultExecutor;
      await this.dispatch(issue, executor);
    }
  }

  // -------------------------------------------------------------------------
  // Private: JSONL operations (all serialized via writeLock)
  // -------------------------------------------------------------------------

  private async findIssue(issueId: string): Promise<Issue | null> {
    const issues = await readIssuesJsonl(this.jsonlPath);
    return issues.find((i) => i.id === issueId) ?? null;
  }

  /** Atomically update multiple fields on an issue in a single read-modify-write */
  private async updateIssueFields(
    issueId: string,
    fields: {
      status?: IssueStatus;
      execution?: Partial<IssueExecution>;
    },
  ): Promise<void> {
    await withWriteLock(async () => {
      const issues = await readIssuesJsonl(this.jsonlPath);
      const idx = issues.findIndex((i) => i.id === issueId);
      if (idx === -1) return;

      const issue = issues[idx];

      if (fields.status !== undefined) {
        issue.status = fields.status;
      }

      if (fields.execution !== undefined) {
        issue.execution = {
          status: 'idle',
          retryCount: 0,
          ...issue.execution,
          ...fields.execution,
        };
      }

      issue.updated_at = new Date().toISOString();
      issues[idx] = issue;

      await writeIssuesJsonl(this.jsonlPath, issues);
    });
  }

  private emitStatus(): void {
    this.eventBus.emit('supervisor:status', this.getStatus());
  }
}
