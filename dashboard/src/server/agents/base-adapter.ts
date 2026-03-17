// ---------------------------------------------------------------------------
// AgentAdapter interface + BaseAgentAdapter abstract class
// Protocol-agnostic agent abstraction layer
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type {
  AgentType,
  AgentConfig,
  AgentProcess,
  NormalizedEntry,
  ApprovalRequest,
  ApprovalDecision,
} from '../../shared/agent-types.js';

// ---------------------------------------------------------------------------
// AgentAdapter — protocol-agnostic interface
// ---------------------------------------------------------------------------

/** Protocol-agnostic agent interface */
export interface AgentAdapter {
  readonly agentType: AgentType;
  spawn(config: AgentConfig): Promise<AgentProcess>;
  stop(processId: string): Promise<void>;
  sendMessage(processId: string, content: string): Promise<void>;
  onEntry(processId: string, cb: (entry: NormalizedEntry) => void): () => void;
  onApproval(processId: string, cb: (request: ApprovalRequest) => void): () => void;
  respondApproval(decision: ApprovalDecision): Promise<void>;
  getProcess(processId: string): AgentProcess | undefined;
  listProcesses(): AgentProcess[];
}

// ---------------------------------------------------------------------------
// BaseAgentAdapter — abstract base with shared lifecycle management
// ---------------------------------------------------------------------------

/** Abstract base class providing process tracking and event callback plumbing */
export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract readonly agentType: AgentType;

  protected readonly processes = new Map<string, AgentProcess>();

  private readonly entryCallbacks = new Map<
    string,
    Set<(entry: NormalizedEntry) => void>
  >();

  private readonly approvalCallbacks = new Map<
    string,
    Set<(req: ApprovalRequest) => void>
  >();

  // --- Public interface (delegates to abstract hooks) ---------------------

  async spawn(config: AgentConfig): Promise<AgentProcess> {
    const processId = this.generateProcessId();
    const process = await this.doSpawn(processId, config);
    this.addProcess(process);
    return process;
  }

  async stop(processId: string): Promise<void> {
    this.requireProcess(processId);
    await this.doStop(processId);
    this.removeProcess(processId);
  }

  async sendMessage(processId: string, content: string): Promise<void> {
    this.requireProcess(processId);
    await this.doSendMessage(processId, content);
  }

  onEntry(
    processId: string,
    cb: (entry: NormalizedEntry) => void,
  ): () => void {
    let set = this.entryCallbacks.get(processId);
    if (!set) {
      set = new Set();
      this.entryCallbacks.set(processId, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.entryCallbacks.delete(processId);
      }
    };
  }

  onApproval(
    processId: string,
    cb: (request: ApprovalRequest) => void,
  ): () => void {
    let set = this.approvalCallbacks.get(processId);
    if (!set) {
      set = new Set();
      this.approvalCallbacks.set(processId, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.approvalCallbacks.delete(processId);
      }
    };
  }

  async respondApproval(decision: ApprovalDecision): Promise<void> {
    await this.doRespondApproval(decision);
  }

  getProcess(processId: string): AgentProcess | undefined {
    return this.processes.get(processId);
  }

  listProcesses(): AgentProcess[] {
    return Array.from(this.processes.values());
  }

  // --- Protected helpers for subclasses -----------------------------------

  /** Generate a unique process ID */
  protected generateProcessId(): string {
    return randomUUID();
  }

  /** Emit a normalized entry to all registered listeners for a process */
  protected emitEntry(processId: string, entry: NormalizedEntry): void {
    const set = this.entryCallbacks.get(processId);
    if (set) {
      for (const cb of set) {
        cb(entry);
      }
    }
  }

  /** Emit an approval request to all registered listeners for a process */
  protected emitApproval(processId: string, request: ApprovalRequest): void {
    const set = this.approvalCallbacks.get(processId);
    if (set) {
      for (const cb of set) {
        cb(request);
      }
    }
  }

  /** Add a process to the internal tracking map */
  protected addProcess(process: AgentProcess): void {
    this.processes.set(process.id, process);
  }

  /** Remove a process and clean up all associated callbacks */
  protected removeProcess(processId: string): void {
    this.processes.delete(processId);
    this.entryCallbacks.delete(processId);
    this.approvalCallbacks.delete(processId);
  }

  // --- Private helpers ----------------------------------------------------

  private requireProcess(processId: string): void {
    if (!this.processes.has(processId)) {
      throw new Error(`No process found with id: ${processId}`);
    }
  }

  // --- Abstract hooks for subclasses to implement -------------------------

  protected abstract doSpawn(
    processId: string,
    config: AgentConfig,
  ): Promise<AgentProcess>;

  protected abstract doStop(processId: string): Promise<void>;

  protected abstract doSendMessage(
    processId: string,
    content: string,
  ): Promise<void>;

  protected abstract doRespondApproval(
    decision: ApprovalDecision,
  ): Promise<void>;
}
