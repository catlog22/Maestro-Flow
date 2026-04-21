/**
 * L3 E2E Tests -- End-to-end workflows for the team communication architecture
 *
 * Tests complete data flows across modules with minimal mocking:
 * 1. Message lifecycle: send -> persist -> dispatch -> read -> deliver -> verify status
 * 2. Agent lifecycle: spawn -> members -> task assignment -> shutdown -> cleanup
 * 3. Phase orchestrator pipeline: planning -> execution -> review -> verification -> fix -> complete
 * 4. MCP tool chain: registration -> schema -> handler invocation -> result verification
 * 5. Error recovery: invalid transitions, max retry exceeded, broker failures
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --- Direct imports for cross-module E2E flows ---
import { handler as msgHandler, readAllMessages } from '../team-msg.js';
import type { TeamMessage, DispatchStatus } from '../team-msg.js';
import { handler as mailboxHandler } from '../team-mailbox.js';
import type { MailboxMessage } from '../team-mailbox.js';
import { handler as agentsHandler } from '../team-agents.js';
import { PhaseOrchestrator } from '../../team/phase-orchestrator.js';
import { TeamPhase } from '../../team/phase-types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;
let uid = 0;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'team-e2e-test-'));
  prevRoot = process.env.MAESTRO_PROJECT_ROOT;
  process.env.MAESTRO_PROJECT_ROOT = tmpDir;
  uid++;
}

function sid(label: string): string {
  return `e2e-${label}-${uid}-${process.pid}`;
}

function teardown(): void {
  if (prevRoot === undefined) {
    delete process.env.MAESTRO_PROJECT_ROOT;
  } else {
    process.env.MAESTRO_PROJECT_ROOT = prevRoot;
  }
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 1. Message lifecycle E2E
// ---------------------------------------------------------------------------

describe('E2E: message lifecycle', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('full lifecycle: send_message -> persist -> dispatch pending -> read_mailbox -> delivered -> mailbox_status verified', async () => {
    const session = sid('msg-lifecycle');

    // Step 1: Send a message via team-mailbox (persist to mailbox.jsonl)
    const sendResult = await mailboxHandler({
      operation: 'send',
      session_id: session,
      from: 'coordinator',
      to: 'analyst',
      message: 'Please analyze the codebase',
      type: 'task_assignment',
      delivery_method: 'poll',
      data: { priority: 'high', deadline: '2026-04-22' },
    });
    expect(sendResult.success).toBe(true);
    const sendData = sendResult.result as { id: string; delivery_status: string };
    expect(sendData.id).toBe('MBX-001');
    expect(sendData.delivery_status).toBe('pending');

    // Step 2: Also log via team-msg bus with dispatch tracking
    const logResult = await msgHandler({
      operation: 'log',
      session_id: session,
      from: 'coordinator',
      to: 'analyst',
      type: 'task_assignment',
      summary: 'Analyze codebase',
      delivery_method: 'inject',
    });
    expect(logResult.success).toBe(true);

    // Step 3: Verify both storage files exist independently
    const msgPath = join(tmpDir, '.workflow', '.team', session, '.msg', 'messages.jsonl');
    const mbxPath = join(tmpDir, '.workflow', '.team', session, '.msg', 'mailbox.jsonl');
    expect(existsSync(msgPath)).toBe(true);
    expect(existsSync(mbxPath)).toBe(true);

    // Step 4: Check mailbox_status before read (team-msg side)
    const beforeStatus = await msgHandler({
      operation: 'mailbox_status',
      session_id: session,
    });
    const beforeData = beforeStatus.result as {
      roles: Record<string, Record<DispatchStatus, number>>;
      total_messages: number;
    };
    expect(beforeData.total_messages).toBe(1);
    expect(beforeData.roles['analyst'].pending).toBe(1);

    // Step 5: Read mailbox via team-msg (marks delivered)
    const readMsgResult = await msgHandler({
      operation: 'read_mailbox',
      session_id: session,
      role: 'analyst',
    });
    expect(readMsgResult.success).toBe(true);
    const readMsgData = readMsgResult.result as { count: number; messages: TeamMessage[] };
    expect(readMsgData.count).toBe(1);
    expect(readMsgData.messages[0].type).toBe('task_assignment');

    // Step 6: Read mailbox via team-mailbox (separate storage)
    const readMbxResult = await mailboxHandler({
      operation: 'read',
      session_id: session,
      role: 'analyst',
    });
    expect(readMbxResult.success).toBe(true);
    const readMbxData = readMbxResult.result as { unread_count: number; messages: MailboxMessage[] };
    expect(readMbxData.unread_count).toBe(1);
    expect(readMbxData.messages[0].message).toBe('Please analyze the codebase');

    // Step 7: Verify dispatch status updated to delivered (team-msg side)
    const afterStatus = await msgHandler({
      operation: 'mailbox_status',
      session_id: session,
    });
    const afterData = afterStatus.result as {
      roles: Record<string, Record<DispatchStatus, number>>;
    };
    expect(afterData.roles['analyst'].delivered).toBe(1);
    expect(afterData.roles['analyst'].pending).toBe(0);

    // Step 8: Second read returns empty (already delivered)
    const secondRead = await msgHandler({
      operation: 'read_mailbox',
      session_id: session,
      role: 'analyst',
    });
    const secondData = secondRead.result as { count: number };
    expect(secondData.count).toBe(0);
  });

  it('multi-role message routing: coordinator -> analyst, analyst -> executor, executor -> coordinator', async () => {
    const session = sid('multi-role');

    // Coordinator sends to analyst
    await mailboxHandler({
      operation: 'send',
      session_id: session,
      from: 'coordinator',
      to: 'analyst',
      message: 'Start analysis',
    });

    // Analyst sends to executor
    await mailboxHandler({
      operation: 'send',
      session_id: session,
      from: 'analyst',
      to: 'executor',
      message: 'Analysis done, proceed with implementation',
      data: { findings: ['issue-1', 'issue-2'] },
    });

    // Executor sends back to coordinator
    await mailboxHandler({
      operation: 'send',
      session_id: session,
      from: 'executor',
      to: 'coordinator',
      message: 'Implementation complete',
    });

    // Each role reads only their own messages
    const analystRead = await mailboxHandler({
      operation: 'read',
      session_id: session,
      role: 'analyst',
      mark_delivered: false,
    });
    const executorRead = await mailboxHandler({
      operation: 'read',
      session_id: session,
      role: 'executor',
      mark_delivered: false,
    });
    const coordRead = await mailboxHandler({
      operation: 'read',
      session_id: session,
      role: 'coordinator',
      mark_delivered: false,
    });

    expect((analystRead.result as { unread_count: number }).unread_count).toBe(1);
    expect((executorRead.result as { unread_count: number }).unread_count).toBe(1);
    expect((coordRead.result as { unread_count: number }).unread_count).toBe(1);

    // Verify message content routing
    const executorMsgs = (executorRead.result as { messages: MailboxMessage[] }).messages;
    expect(executorMsgs[0].from).toBe('analyst');
    expect(executorMsgs[0].data?.findings).toEqual(['issue-1', 'issue-2']);

    // Status shows all 3 roles
    const status = await mailboxHandler({
      operation: 'status',
      session_id: session,
    });
    const statusData = status.result as { total_messages: number; roles: { role: string }[] };
    expect(statusData.total_messages).toBe(3);
    expect(statusData.roles).toHaveLength(3);
  });

  it('team-msg state_update integrates with dispatch and get_state', async () => {
    const session = sid('state-dispatch');

    // Log a state_update with dispatch tracking
    await msgHandler({
      operation: 'log',
      session_id: session,
      from: 'analyst',
      to: 'coordinator',
      type: 'state_update',
      summary: 'Analysis complete',
      delivery_method: 'inject',
      data: {
        status: 'completed',
        key_findings: ['finding-1', 'finding-2'],
        artifact_path: 'artifacts/analysis.md',
      },
    });

    // Verify dispatch_status is pending (has delivery_method)
    const msgs = readAllMessages(session);
    expect(msgs[0].dispatch_status).toBe('pending');

    // Verify state was persisted in meta.json
    const stateResult = await msgHandler({
      operation: 'get_state',
      session_id: session,
      role: 'analyst',
    });
    const stateData = stateResult.result as { state: Record<string, unknown> };
    expect(stateData.state.status).toBe('completed');
    expect(stateData.state.key_findings).toEqual(['finding-1', 'finding-2']);

    // Read the mailbox to deliver
    await msgHandler({
      operation: 'read_mailbox',
      session_id: session,
      role: 'coordinator',
    });

    // Verify state still intact after delivery
    const stateAfter = await msgHandler({
      operation: 'get_state',
      session_id: session,
      role: 'analyst',
    });
    expect((stateAfter.result as { state: Record<string, unknown> }).state.status).toBe('completed');

    // Second state_update merges incrementally
    await msgHandler({
      operation: 'log',
      session_id: session,
      from: 'analyst',
      to: 'coordinator',
      type: 'state_update',
      data: { progress_pct: 100, files_modified: ['src/a.ts'] },
    });

    const mergedState = await msgHandler({
      operation: 'get_state',
      session_id: session,
      role: 'analyst',
    });
    const merged = (mergedState.result as { state: Record<string, unknown> }).state;
    expect(merged.status).toBe('completed'); // from first update
    expect(merged.progress_pct).toBe(100); // from second update
    expect(merged.files_modified).toEqual(['src/a.ts']);
  });
});

// ---------------------------------------------------------------------------
// 2. Agent lifecycle E2E
// ---------------------------------------------------------------------------

describe('E2E: agent lifecycle', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('full lifecycle: spawn -> members -> message -> shutdown -> remove -> cleanup', async () => {
    const session = sid('agent-lifecycle');

    // Step 1: Spawn multiple agents
    const spawn1 = await agentsHandler({
      operation: 'spawn_agent',
      session_id: session,
      role: 'analyst',
      prompt: 'Analyze the codebase for issues',
      tool: 'gemini',
    });
    expect(spawn1.success).toBe(true);

    const spawn2 = await agentsHandler({
      operation: 'spawn_agent',
      session_id: session,
      role: 'executor',
      prompt: 'Implement fixes based on analysis',
      tool: 'codex',
    });
    expect(spawn2.success).toBe(true);

    // Step 2: Verify members list shows both agents running
    const membersResult = await agentsHandler({
      operation: 'members',
      session_id: session,
    });
    const membersData = membersResult.result as {
      members: { role: string; status: string; tool: string; job_id: string }[];
      total: number;
    };
    expect(membersData.total).toBe(2);
    const analyst = membersData.members.find(m => m.role === 'analyst');
    const executor = membersData.members.find(m => m.role === 'executor');
    expect(analyst?.status).toBe('running');
    expect(analyst?.tool).toBe('gemini');
    expect(executor?.status).toBe('running');
    expect(executor?.tool).toBe('codex');

    // Step 3: Send message between agents via mailbox
    await mailboxHandler({
      operation: 'send',
      session_id: session,
      from: 'analyst',
      to: 'executor',
      message: 'Found 3 critical issues',
      type: 'analysis_complete',
      data: { issue_count: 3 },
    });

    // Step 4: Executor reads its mailbox
    const execRead = await mailboxHandler({
      operation: 'read',
      session_id: session,
      role: 'executor',
    });
    const execReadData = execRead.result as { unread_count: number; messages: MailboxMessage[] };
    expect(execReadData.unread_count).toBe(1);
    expect(execReadData.messages[0].from).toBe('analyst');

    // Step 5: Shutdown analyst agent
    const shutdownResult = await agentsHandler({
      operation: 'shutdown_agent',
      session_id: session,
      role: 'analyst',
    });
    expect(shutdownResult.success).toBe(true);
    const shutdownData = shutdownResult.result as { status: string };
    expect(shutdownData.status).toBe('cancelling');

    // Step 6: Verify analyst is now idle, executor still running
    const afterShutdown = await agentsHandler({
      operation: 'members',
      session_id: session,
    });
    const afterData = afterShutdown.result as {
      members: { role: string; status: string }[];
    };
    const analystAfter = afterData.members.find(m => m.role === 'analyst');
    const executorAfter = afterData.members.find(m => m.role === 'executor');
    expect(analystAfter?.status).toBe('idle');
    expect(executorAfter?.status).toBe('running');

    // Step 7: Remove analyst from team config
    const removeResult = await agentsHandler({
      operation: 'remove_agent',
      session_id: session,
      role: 'analyst',
    });
    expect(removeResult.success).toBe(true);

    // Step 8: Verify cleanup - only executor remains
    const finalMembers = await agentsHandler({
      operation: 'members',
      session_id: session,
    });
    const finalData = finalMembers.result as { total: number; members: { role: string }[] };
    expect(finalData.total).toBe(1);
    expect(finalData.members[0].role).toBe('executor');

    // Step 9: Verify members.json on disk
    const membersPath = join(tmpDir, '.workflow', '.team', session, 'members.json');
    const raw = JSON.parse(readFileSync(membersPath, 'utf-8'));
    expect(raw.members).toHaveLength(1);
    expect(raw.members[0].role).toBe('executor');
  });

  it('agent spawn with duplicate role prevention', async () => {
    const session = sid('agent-dup');

    await agentsHandler({
      operation: 'spawn_agent',
      session_id: session,
      role: 'worker',
      prompt: 'First worker',
    });

    // Attempt to spawn same role again
    const dup = await agentsHandler({
      operation: 'spawn_agent',
      session_id: session,
      role: 'worker',
      prompt: 'Duplicate worker',
    });
    expect(dup.success).toBe(false);
    expect(dup.error).toContain('already exists');

    // Remove and re-spawn should work
    await agentsHandler({
      operation: 'remove_agent',
      session_id: session,
      role: 'worker',
    });

    const respawn = await agentsHandler({
      operation: 'spawn_agent',
      session_id: session,
      role: 'worker',
      prompt: 'Re-spawned worker',
    });
    expect(respawn.success).toBe(true);
  });

  it('agents + messaging + state_update integration', async () => {
    const session = sid('agent-state');

    // Spawn an agent
    await agentsHandler({
      operation: 'spawn_agent',
      session_id: session,
      role: 'researcher',
      prompt: 'Research the topic',
    });

    // Agent logs a state_update via team-msg
    await msgHandler({
      operation: 'log',
      session_id: session,
      from: 'researcher',
      to: 'coordinator',
      type: 'state_update',
      data: {
        status: 'completed',
        artifact_path: 'artifacts/research.md',
        key_findings: ['finding-a'],
      },
    });

    // Coordinator can read agent's state
    const stateResult = await msgHandler({
      operation: 'get_state',
      session_id: session,
      role: 'researcher',
    });
    const stateData = stateResult.result as { state: Record<string, unknown> };
    expect(stateData.state.status).toBe('completed');

    // Agent is still running (state_update doesn't affect lifecycle)
    const members = await agentsHandler({
      operation: 'members',
      session_id: session,
    });
    const membersData = members.result as { members: { role: string; status: string }[] };
    expect(membersData.members[0].status).toBe('running');

    // Shutdown after completion
    await agentsHandler({
      operation: 'shutdown_agent',
      session_id: session,
      role: 'researcher',
    });

    // Verify state persists after shutdown
    const stateAfter = await msgHandler({
      operation: 'get_state',
      session_id: session,
      role: 'researcher',
    });
    expect((stateAfter.result as { state: Record<string, unknown> }).state.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// 3. Phase orchestrator pipeline E2E
// ---------------------------------------------------------------------------

describe('E2E: phase orchestrator pipeline', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('full happy path: planning -> execution -> review -> verification -> complete', () => {
    const session = sid('phase-happy');
    const orch = new PhaseOrchestrator(session);
    const transitions: { from: TeamPhase; to: TeamPhase }[] = [];
    const broadcastFn = (_: string, phase: TeamPhase) => {
      transitions.push({ from: orch.currentPhase, to: phase });
    };

    // Start at planning
    expect(orch.currentPhase).toBe(TeamPhase.planning);

    // planning -> execution
    let result = orch.transitionTo(TeamPhase.execution, { broadcast: broadcastFn });
    expect(result.success).toBe(true);
    expect(orch.currentPhase).toBe(TeamPhase.execution);

    // execution -> review
    result = orch.transitionTo(TeamPhase.review, { broadcast: broadcastFn });
    expect(result.success).toBe(true);

    // review -> verification
    result = orch.transitionTo(TeamPhase.verification, { broadcast: broadcastFn });
    expect(result.success).toBe(true);

    // verification -> complete
    result = orch.transitionTo(TeamPhase.complete, { broadcast: broadcastFn });
    expect(result.success).toBe(true);
    expect(orch.currentPhase).toBe(TeamPhase.complete);
    expect(orch.fixAttempts).toBe(0);

    // Verify transitions were persisted
    const filePath = join(tmpDir, '.workflow', '.team', session, 'transitions.jsonl');
    expect(existsSync(filePath)).toBe(true);
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(4);

    // Verify history
    const status = orch.getPhaseStatus();
    expect(status.current).toBe(TeamPhase.complete);
    expect(status.history).toHaveLength(4);
    expect(status.history[0].from).toBe(TeamPhase.planning);
    expect(status.history[0].to).toBe(TeamPhase.execution);
    expect(status.history[3].to).toBe(TeamPhase.complete);
  });

  it('fix loop pipeline: planning -> execution -> review -> verification -> fix -> review -> verification -> complete', () => {
    const session = sid('phase-fix');
    const orch = new PhaseOrchestrator(session);

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);
    expect(orch.fixAttempts).toBe(0);

    // Enter fix loop
    orch.transitionTo(TeamPhase.fix);
    expect(orch.currentPhase).toBe(TeamPhase.fix);
    expect(orch.fixAttempts).toBe(0); // Not counted until fix->review

    // Complete fix cycle
    orch.transitionTo(TeamPhase.review);
    expect(orch.fixAttempts).toBe(1);

    // Back to verification
    orch.transitionTo(TeamPhase.verification);

    // This time pass - go to complete
    const result = orch.transitionTo(TeamPhase.complete);
    expect(result.success).toBe(true);
    expect(orch.currentPhase).toBe(TeamPhase.complete);
    expect(orch.fixAttempts).toBe(0); // Reset on complete

    // Verify full history
    const status = orch.getPhaseStatus();
    expect(status.history).toHaveLength(7);

    // Verify JSONL has all transitions
    const filePath = join(tmpDir, '.workflow', '.team', session, 'transitions.jsonl');
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(7);
  });

  it('max retry exceeded forces completion: 3 fix cycles then forced complete', () => {
    const session = sid('phase-maxretry');
    const orch = new PhaseOrchestrator(session);

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Run 3 fix cycles
    for (let i = 0; i < 3; i++) {
      orch.transitionTo(TeamPhase.fix);
      orch.transitionTo(TeamPhase.review);
      orch.transitionTo(TeamPhase.verification);
    }
    expect(orch.fixAttempts).toBe(3);

    // 4th attempt to enter fix should be forced to complete
    const result = orch.transitionTo(TeamPhase.fix);
    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.complete); // Forced redirect
    expect(result.reason).toContain('Max fix attempts');
    expect(orch.currentPhase).toBe(TeamPhase.complete);
    expect(orch.fixAttempts).toBe(0); // Reset on complete

    // Cannot transition from complete (terminal)
    const afterComplete = orch.transitionTo(TeamPhase.planning);
    expect(afterComplete.success).toBe(false);
  });

  it('phase transitions with broadcast callback and state tracking', async () => {
    const session = sid('phase-broadcast');
    const orch = new PhaseOrchestrator(session);

    const broadcasts: { phase: TeamPhase; fixAttempts: number }[] = [];

    // Use broadcast callback that also logs to team-msg
    const broadcastFn = async (sessionId: string, phase: TeamPhase, fixAttempts: number) => {
      broadcasts.push({ phase, fixAttempts });

      // Simulate coordinator broadcasting phase change via team-msg
      await msgHandler({
        operation: 'broadcast',
        session_id: sessionId,
        from: 'coordinator',
        type: 'phase_transition',
        summary: `Phase: ${phase} (fixes: ${fixAttempts})`,
      });
    };

    // Run through a fix cycle
    orch.transitionTo(TeamPhase.execution, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.review, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.verification, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.fix, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.review, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.verification, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.complete, { broadcast: broadcastFn });

    // Verify broadcasts were called for each transition
    expect(broadcasts).toHaveLength(7);
    expect(broadcasts[0].phase).toBe(TeamPhase.execution);
    expect(broadcasts[3].phase).toBe(TeamPhase.fix);
    expect(broadcasts[4].phase).toBe(TeamPhase.review);
    expect(broadcasts[4].fixAttempts).toBe(1);
    expect(broadcasts[6].phase).toBe(TeamPhase.complete);

    // Verify team-msg received all broadcasts
    const msgs = readAllMessages(session);
    expect(msgs).toHaveLength(7);
    expect(msgs[0].to).toBe('all'); // broadcast sets to='all'
    expect(msgs[0].type).toBe('phase_transition');
  });

  it('phase gate evaluation blocks invalid transitions', () => {
    const session = sid('phase-gate');
    const orch = new PhaseOrchestrator(session);

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Try to complete with hard-blocking gate
    const blocked = orch.transitionTo(TeamPhase.complete, {
      gateConfig: {
        gateInput: {
          review: { verdict: 'BLOCK', findings_count: 10 },
        },
        allowForceOverride: false,
      },
    });
    expect(blocked.success).toBe(false);
    expect(blocked.reason).toContain('Hard gate block');
    expect(orch.currentPhase).toBe(TeamPhase.verification); // Stayed in verification

    // Try with passing gate
    const passed = orch.transitionTo(TeamPhase.complete, {
      gateConfig: {
        gateInput: {
          review: { verdict: 'APPROVE', findings_count: 0 },
          verification: { status: 'complete', gaps: [] },
        },
        allowForceOverride: false,
      },
    });
    expect(passed.success).toBe(true);
    expect(orch.currentPhase).toBe(TeamPhase.complete);
  });
});

// ---------------------------------------------------------------------------
// 4. MCP tool chain E2E
// ---------------------------------------------------------------------------

describe('E2E: MCP tool chain', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('all team tools register and return valid results via handler chain', async () => {
    const { registerBuiltinTools } = await import('../../tools/index.js');

    const handlers = new Map<string, (input: Record<string, unknown>) => Promise<any>>();
    const mockRegistry = {
      register(tool: { name: string; handler: (input: Record<string, unknown>) => Promise<any> }) {
        handlers.set(tool.name, tool.handler);
      },
    };

    registerBuiltinTools(mockRegistry as any);

    // Verify all team tools registered
    expect(handlers.has('team_msg')).toBe(true);
    expect(handlers.has('team_mailbox')).toBe(true);
    expect(handlers.has('team_agent')).toBe(true);
    expect(handlers.has('team_task')).toBe(true);

    const session = sid('mcp-chain');

    // Test team_msg via registered handler
    const msgResult = await handlers.get('team_msg')!({
      operation: 'log',
      session_id: session,
      from: 'test-user',
      to: 'coordinator',
      summary: 'MCP chain test',
    });
    // Handler returns MCP-formatted result (ccwResultToMcp wrapper)
    expect(msgResult).toBeDefined();
    expect(msgResult.isError).toBeFalsy();

    // Test team_mailbox via registered handler
    const mbxResult = await handlers.get('team_mailbox')!({
      operation: 'send',
      session_id: session,
      from: 'test-user',
      to: 'coordinator',
      message: 'MCP mailbox test',
    });
    expect(mbxResult).toBeDefined();
    expect(mbxResult.isError).toBeFalsy();

    // Test team_agent via registered handler
    const agentResult = await handlers.get('team_agent')!({
      operation: 'members',
      session_id: session,
    });
    expect(agentResult).toBeDefined();
    expect(agentResult.isError).toBeFalsy();

    // Test error handling via MCP handler
    const errorResult = await handlers.get('team_msg')!({
      operation: 'log',
      // Missing required 'from' - should error
    });
    expect(errorResult).toBeDefined();
    expect(errorResult.isError).toBe(true);
  });

  it('MCP schema validation covers all operations', async () => {
    const { schema: msgSchema } = await import('../team-msg.js');
    const { schema: mbxSchema } = await import('../team-mailbox.js');
    const { schema: agentSchema } = await import('../team-agents.js');

    // team_msg has 10 operations
    const msgOps = (msgSchema.inputSchema.properties as any).operation.enum;
    expect(msgOps).toContain('log');
    expect(msgOps).toContain('read');
    expect(msgOps).toContain('list');
    expect(msgOps).toContain('status');
    expect(msgOps).toContain('delete');
    expect(msgOps).toContain('clear');
    expect(msgOps).toContain('broadcast');
    expect(msgOps).toContain('get_state');
    expect(msgOps).toContain('read_mailbox');
    expect(msgOps).toContain('mailbox_status');
    expect(msgOps).toHaveLength(10);

    // team_mailbox has 3 operations
    const mbxOps = (mbxSchema.inputSchema.properties as any).operation.enum;
    expect(mbxOps).toHaveLength(3);

    // team_agent has 4 operations
    const agentOps = (agentSchema.inputSchema.properties as any).operation.enum;
    expect(agentOps).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 5. Error recovery E2E
// ---------------------------------------------------------------------------

describe('E2E: error recovery', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('invalid phase transitions do not corrupt state', () => {
    const session = sid('error-transition');
    const orch = new PhaseOrchestrator(session);

    // Try invalid transitions in sequence
    const results: boolean[] = [];

    results.push(orch.transitionTo(TeamPhase.review).success); // Skip execution - fail
    results.push(orch.transitionTo(TeamPhase.complete).success); // Skip everything - fail
    results.push(orch.transitionTo(TeamPhase.fix).success); // Can't enter fix from planning - fail

    expect(results).toEqual([false, false, false]);
    expect(orch.currentPhase).toBe(TeamPhase.planning); // Still at planning

    // Valid transition still works after failed attempts
    const valid = orch.transitionTo(TeamPhase.execution);
    expect(valid.success).toBe(true);
    expect(orch.currentPhase).toBe(TeamPhase.execution);

    // Verify history only contains the successful transition
    const status = orch.getPhaseStatus();
    expect(status.history).toHaveLength(1);
    expect(status.history[0].to).toBe(TeamPhase.execution);
  });

  it('max retry exceeded gracefully transitions to complete without data loss', async () => {
    const session = sid('error-maxretry');
    const orch = new PhaseOrchestrator(session);

    // Navigate to verification and run 3 fix cycles
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    for (let i = 0; i < 3; i++) {
      orch.transitionTo(TeamPhase.fix);
      orch.transitionTo(TeamPhase.review);
      orch.transitionTo(TeamPhase.verification);
    }

    // Log state updates during each fix cycle
    for (let i = 0; i < 3; i++) {
      await msgHandler({
        operation: 'log',
        session_id: session,
        from: 'executor',
        to: 'coordinator',
        type: 'state_update',
        data: { fix_attempt: i + 1, status: 'fix_applied' },
      });
    }

    // Force to complete
    const result = orch.transitionTo(TeamPhase.fix);
    expect(result.to).toBe(TeamPhase.complete);

    // Verify state data is preserved
    const stateResult = await msgHandler({
      operation: 'get_state',
      session_id: session,
      role: 'executor',
    });
    const stateData = stateResult.result as { state: Record<string, unknown> };
    expect(stateData.state.fix_attempt).toBe(3); // Last merge wins
    expect(stateData.state.status).toBe('fix_applied');

    // Verify transition log captures the forced complete
    const filePath = join(tmpDir, '.workflow', '.team', session, 'transitions.jsonl');
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    const lastTransition = JSON.parse(lines[lines.length - 1]);
    expect(lastTransition.to).toBe(TeamPhase.complete);
    expect(lastTransition.force).toBe(true);
  });

  it('broker unavailability does not block message persistence', async () => {
    const session = sid('error-broker');

    // Send message with inject delivery (broker job won't exist)
    const result = await mailboxHandler({
      operation: 'send',
      session_id: session,
      from: 'coordinator',
      to: 'ghost-agent',
      message: 'Message to non-existent agent',
      delivery_method: 'inject',
    });

    // Should succeed (message persisted) even though inject failed
    expect(result.success).toBe(true);
    const data = result.result as { id: string; delivery_status: string };
    expect(data.id).toBe('MBX-001');
    expect(data.delivery_status).toBe('pending'); // Not notified since no job found

    // Message should still be readable
    const readResult = await mailboxHandler({
      operation: 'read',
      session_id: session,
      role: 'ghost-agent',
      mark_delivered: false,
    });
    const readData = readResult.result as { unread_count: number };
    expect(readData.unread_count).toBe(1);
  });

  it('missing parameters return clear error messages', async () => {
    // team-msg: missing session_id
    const r1 = await msgHandler({ operation: 'log', from: 'alice' });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('session_id');

    // team-mailbox: missing required fields
    const r2 = await mailboxHandler({ operation: 'send', session_id: 's1' });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('from');

    // team-agents: missing role for spawn
    const r3 = await agentsHandler({ operation: 'spawn_agent', session_id: 's1', prompt: 'x' });
    expect(r3.success).toBe(false);
    expect(r3.error).toContain('role');

    // Invalid operations
    const r4 = await msgHandler({ operation: 'bogus', session_id: 's1' });
    expect(r4.success).toBe(false);
    expect(r4.error).toContain('Invalid');
  });

  it('shutdown non-existent agent returns clear error', async () => {
    const session = sid('error-shutdown');

    const result = await agentsHandler({
      operation: 'shutdown_agent',
      session_id: session,
      role: 'nonexistent',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// 6. Multi-session isolation E2E
// ---------------------------------------------------------------------------

describe('E2E: multi-session isolation', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('complete workflows in separate sessions do not interfere', async () => {
    const sessionA = sid('iso-a');
    const sessionB = sid('iso-b');

    // --- Session A: full message + agent workflow ---
    await msgHandler({
      operation: 'log',
      session_id: sessionA,
      from: 'coordinator',
      to: 'analyst',
      type: 'task_assignment',
      delivery_method: 'inject',
    });
    await mailboxHandler({
      operation: 'send',
      session_id: sessionA,
      from: 'coordinator',
      to: 'analyst',
      message: 'Session A task',
    });
    await agentsHandler({
      operation: 'spawn_agent',
      session_id: sessionA,
      role: 'analyst',
      prompt: 'Work on session A',
    });

    // --- Session B: different workflow ---
    await msgHandler({
      operation: 'log',
      session_id: sessionB,
      from: 'lead',
      to: 'worker',
      type: 'progress',
    });
    await mailboxHandler({
      operation: 'send',
      session_id: sessionB,
      from: 'lead',
      to: 'worker',
      message: 'Session B task',
    });

    // Verify team-msg isolation
    const msgsA = readAllMessages(sessionA);
    const msgsB = readAllMessages(sessionB);
    expect(msgsA).toHaveLength(1);
    expect(msgsA[0].from).toBe('coordinator');
    expect(msgsB).toHaveLength(1);
    expect(msgsB[0].from).toBe('lead');

    // Verify mailbox isolation
    const mbxA = await mailboxHandler({
      operation: 'read',
      session_id: sessionA,
      role: 'analyst',
      mark_delivered: false,
    });
    const mbxB = await mailboxHandler({
      operation: 'read',
      session_id: sessionB,
      role: 'analyst',
      mark_delivered: false,
    });
    expect((mbxA.result as { unread_count: number }).unread_count).toBe(1);
    expect((mbxB.result as { unread_count: number }).unread_count).toBe(0);

    // Verify agent isolation
    const agentsA = await agentsHandler({
      operation: 'members',
      session_id: sessionA,
    });
    const agentsB = await agentsHandler({
      operation: 'members',
      session_id: sessionB,
    });
    expect((agentsA.result as { total: number }).total).toBe(1);
    expect((agentsB.result as { total: number }).total).toBe(0);

    // Verify phase orchestrator isolation (separate JSONL files)
    const orchA = new PhaseOrchestrator(sessionA);
    const orchB = new PhaseOrchestrator(sessionB);

    orchA.transitionTo(TeamPhase.execution);
    orchB.transitionTo(TeamPhase.execution);
    orchA.transitionTo(TeamPhase.review);

    expect(orchA.currentPhase).toBe(TeamPhase.review);
    expect(orchB.currentPhase).toBe(TeamPhase.execution);

    // Verify separate JSONL files
    const pathA = join(tmpDir, '.workflow', '.team', sessionA, 'transitions.jsonl');
    const pathB = join(tmpDir, '.workflow', '.team', sessionB, 'transitions.jsonl');
    const linesA = readFileSync(pathA, 'utf-8').trim().split('\n');
    const linesB = readFileSync(pathB, 'utf-8').trim().split('\n');
    expect(linesA).toHaveLength(2);
    expect(linesB).toHaveLength(1);
  });
});
