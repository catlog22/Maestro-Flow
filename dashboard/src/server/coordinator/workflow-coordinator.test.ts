import { describe, it, expect, vi, afterEach } from 'vitest';

// Must mock BEFORE importing WorkflowCoordinator
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>;
  return {
    ...orig,
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('./prompts/index.js', () => ({
  setPromptsDir: vi.fn(),
  loadPrompt: vi.fn().mockResolvedValue('/{command} {args}{autoDirective}'),
  clearPromptCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared mock state — allows per-test override of classify behavior
// ---------------------------------------------------------------------------

let classifyResult = {
  taskType: 'execute',
  confidence: 0.9,
  chainName: 'execute',
  steps: [{ cmd: 'maestro-execute', args: '{phase}' }],
  reasoning: 'User wants to execute',
  clarificationNeeded: false,
  clarificationQuestion: null as string | null,
};

vi.mock('./agents/state-analyzer-agent.js', () => {
  const StateAnalyzerAgent = vi.fn(function (this: any) {
    this.analyze = vi.fn().mockResolvedValue({
      initialized: true,
      currentPhase: 1,
      phaseStatus: 'executing',
      artifacts: { brainstorm: false, analysis: false, context: false, plan: true, verification: false, uat: false },
      execution: { tasksCompleted: 2, tasksTotal: 5 },
      verification: 'not_started',
      uat: 'not_started',
      phasesTotal: 3,
      phasesCompleted: 0,
      hasBlockers: false,
      accumulatedContext: [],
      progressSummary: '2/5 tasks done',
      suggestedNextAction: 'execute',
      readiness: 'ready' as const,
    });
  });
  return { StateAnalyzerAgent };
});

vi.mock('./agents/intent-classifier-agent.js', () => {
  const IntentClassifierAgent = vi.fn(function (this: any) {
    // Dynamically read classifyResult at call time
    this.classify = vi.fn().mockImplementation(async () => ({ ...classifyResult }));
  });
  return { IntentClassifierAgent };
});

vi.mock('./agents/quality-reviewer-agent.js', () => {
  const QualityReviewerAgent = vi.fn(function (this: any) {
    this.review = vi.fn().mockResolvedValue({
      qualityScore: 85,
      executionAssessment: 'Good',
      issues: [],
      nextStepHints: '',
      stepSummary: 'Step completed successfully',
    });
  });
  return { QualityReviewerAgent };
});

import { WorkflowCoordinator } from './workflow-coordinator.js';
import type { DashboardEventBus } from '../state/event-bus.js';
import type { AgentManager } from '../agents/agent-manager.js';
import type { StateManager } from '../state/state-manager.js';
import type { SSEEvent } from '../../shared/types.js';

// ---------------------------------------------------------------------------
// Mock factories (mirrors commander-agent.test.ts pattern)
// ---------------------------------------------------------------------------

function createMockEventBus(): DashboardEventBus & { _fire: (type: string, data: unknown) => void } {
  const handlers = new Map<string, Array<(event: SSEEvent) => void>>();
  return {
    emit: vi.fn(),
    on: vi.fn().mockImplementation((type: string, handler: (event: SSEEvent) => void) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
    }),
    off: vi.fn(),
    _fire: (type: string, data: unknown) => {
      const event = { type, data, timestamp: new Date().toISOString() } as SSEEvent;
      for (const h of handlers.get(type) ?? []) h(event);
    },
  } as unknown as DashboardEventBus & { _fire: (type: string, data: unknown) => void };
}

function createMockAgentManager(): AgentManager {
  return {
    spawn: vi.fn().mockResolvedValue({
      id: 'mock-proc-1',
      type: 'claude-code',
      status: 'running',
      config: { type: 'claude-code', prompt: 'test', workDir: '/tmp' },
      startedAt: new Date().toISOString(),
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    getEntries: vi.fn().mockReturnValue([]),
  } as unknown as AgentManager;
}

function createMockStateManager(): StateManager {
  return {
    getProject: vi.fn().mockReturnValue({
      project_name: 'test-project',
      status: 'active',
      current_milestone: 'v1',
      current_phase: null,
      accumulated_context: { blockers: [] },
    }),
    getPhase: vi.fn().mockReturnValue(undefined),
    getBoard: vi.fn().mockReturnValue({}),
  } as unknown as StateManager;
}

function createCoordinator() {
  const eventBus = createMockEventBus();
  const agentManager = createMockAgentManager();
  const stateManager = createMockStateManager();
  const coordinator = new WorkflowCoordinator(
    eventBus,
    agentManager,
    stateManager,
    '/tmp/test-workflow',
  );
  return { coordinator, eventBus, agentManager, stateManager };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowCoordinator', () => {
  afterEach(() => {
    // Reset classify result to default for next test
    classifyResult = {
      taskType: 'execute',
      confidence: 0.9,
      chainName: 'execute',
      steps: [{ cmd: 'maestro-execute', args: '{phase}' }],
      reasoning: 'User wants to execute',
      clarificationNeeded: false,
      clarificationQuestion: null,
    };
    vi.clearAllMocks();
  });

  // --- getSession ---
  describe('getSession', () => {
    it('returns null when no session is active', () => {
      const { coordinator } = createCoordinator();
      expect(coordinator.getSession()).toBeNull();
    });
  });

  // --- start ---
  describe('start', () => {
    it('creates a session and classifies intent', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.start('implement the feature');

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^coord-/);
      expect(session.intent).toBe('implement the feature');
      expect(session.tool).toBe('claude');
    });

    it('spawns agent for the first step', async () => {
      const { coordinator, agentManager } = createCoordinator();
      await coordinator.start('implement the feature');

      expect(agentManager.spawn).toHaveBeenCalledTimes(1);
      expect(agentManager.spawn).toHaveBeenCalledWith(
        'claude-code',
        expect.objectContaining({
          type: 'claude-code',
          workDir: '/tmp/test-workflow',
          approvalMode: 'suggest',
        }),
      );
    });

    it('uses auto approval mode when autoMode is true', async () => {
      const { coordinator, agentManager } = createCoordinator();
      await coordinator.start('execute the plan', { autoMode: true });

      expect(agentManager.spawn).toHaveBeenCalledWith(
        'claude-code',
        expect.objectContaining({
          approvalMode: 'auto',
        }),
      );
    });

    it('uses specified tool', async () => {
      const { coordinator, agentManager } = createCoordinator();
      await coordinator.start('execute', { tool: 'gemini' });

      expect(agentManager.spawn).toHaveBeenCalledWith(
        'gemini',
        expect.objectContaining({
          type: 'gemini',
        }),
      );
    });

    it('uses explicit chainName when provided', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.start('do something', { chainName: 'execute-verify' });

      expect(session.chainName).toBe('execute-verify');
      expect(session.steps).toHaveLength(2);
      expect(session.steps[0].cmd).toBe('maestro-execute');
      expect(session.steps[1].cmd).toBe('maestro-verify');
    });

    it('throws for unknown explicit chain', async () => {
      const { coordinator } = createCoordinator();
      await expect(
        coordinator.start('do something', { chainName: 'nonexistent-chain' }),
      ).rejects.toThrow('Unknown chain: nonexistent-chain');
    });

    it('throws if session is already running', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.start('first task');

      await expect(
        coordinator.start('second task'),
      ).rejects.toThrow('A coordinate session is already running');
    });

    it('sets session status to running after classification', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.start('execute the plan');

      expect(session.status).toBe('running');
    });

    it('emits coordinate:status events', async () => {
      const { coordinator, eventBus } = createCoordinator();
      await coordinator.start('execute the plan');

      expect(eventBus.emit).toHaveBeenCalledWith('coordinate:status', expect.any(Object));
    });

    it('emits coordinate:analysis event', async () => {
      const { coordinator, eventBus } = createCoordinator();
      await coordinator.start('execute the plan');

      expect(eventBus.emit).toHaveBeenCalledWith(
        'coordinate:analysis',
        expect.objectContaining({
          intent: 'execute the plan',
          chainName: expect.any(String),
        }),
      );
    });

    it('handles agent spawn failure gracefully', async () => {
      const { coordinator, agentManager } = createCoordinator();
      (agentManager.spawn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('spawn failed'),
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await coordinator.start('execute the plan');
      expect(session.status).toBe('failed');

      errorSpy.mockRestore();
    });
  });

  // --- start with clarification ---
  describe('start with clarification needed', () => {
    it('returns session with awaiting_clarification status', async () => {
      // Override classify result before creating coordinator
      classifyResult = {
        taskType: 'quick',
        confidence: 0.3,
        chainName: 'quick',
        steps: [{ cmd: 'maestro-quick', args: '"{description}"' }],
        reasoning: 'Ambiguous intent',
        clarificationNeeded: true,
        clarificationQuestion: 'What exactly do you want to do?',
      };

      const { coordinator, eventBus } = createCoordinator();
      const session = await coordinator.start('do something');

      expect(session.status).toBe('awaiting_clarification');
      expect(eventBus.emit).toHaveBeenCalledWith(
        'coordinate:clarification_needed',
        expect.objectContaining({
          question: 'What exactly do you want to do?',
        }),
      );
    });
  });

  // --- stop ---
  describe('stop', () => {
    it('does nothing when no session exists', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.stop(); // should not throw
    });

    it('stops agent and sets session to failed', async () => {
      const { coordinator, agentManager } = createCoordinator();
      await coordinator.start('execute the plan');
      await coordinator.stop();

      const session = coordinator.getSession();
      expect(session?.status).toBe('failed');
      expect(agentManager.stop).toHaveBeenCalledWith('mock-proc-1');
    });

    it('marks running step as failed', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.start('execute the plan');
      await coordinator.stop();

      const session = coordinator.getSession();
      expect(session?.steps.some(s => s.status === 'failed')).toBe(true);
    });

    it('handles stop when agent already stopped', async () => {
      const { coordinator, agentManager } = createCoordinator();
      (agentManager.stop as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('already stopped'),
      );

      await coordinator.start('execute the plan');
      await coordinator.stop();

      const session = coordinator.getSession();
      expect(session?.status).toBe('failed');
    });
  });

  // --- resume ---
  describe('resume', () => {
    it('returns null when no state file found', async () => {
      const { coordinator } = createCoordinator();
      const result = await coordinator.resume('nonexistent-session');
      expect(result).toBeNull();
    });

    it('returns null when no session and no sessionId', async () => {
      const { coordinator } = createCoordinator();
      const result = await coordinator.resume();
      expect(result).toBeNull();
    });
  });

  // --- clarify ---
  describe('clarify', () => {
    it('does nothing if no session exists', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.clarify('fake-session', 'my response');
      // Should not throw
    });

    it('does nothing if session id does not match', async () => {
      classifyResult = {
        taskType: 'quick',
        confidence: 0.3,
        chainName: 'quick',
        steps: [{ cmd: 'maestro-quick', args: '"{description}"' }],
        reasoning: 'Ambiguous',
        clarificationNeeded: true,
        clarificationQuestion: 'What do you want?',
      };

      const { coordinator } = createCoordinator();
      const session = await coordinator.start('ambiguous intent');
      expect(session.status).toBe('awaiting_clarification');

      await coordinator.clarify('wrong-id', 'my response');
      expect(coordinator.getSession()?.status).toBe('awaiting_clarification');
    });

    it('does nothing if session is not awaiting_clarification', async () => {
      const { coordinator, eventBus } = createCoordinator();
      await coordinator.start('execute the plan');

      const session = coordinator.getSession();
      (eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      await coordinator.clarify(session!.sessionId, 'my response');
      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'coordinate:clarification_needed',
        expect.any(Object),
      );
    });
  });

  // --- agent:stopped handler (lifecycle) ---
  describe('agent:stopped handler', () => {
    it('registers agent:stopped listener on eventBus', () => {
      const { eventBus } = createCoordinator();
      expect(eventBus.on).toHaveBeenCalledWith('agent:stopped', expect.any(Function));
    });

    it('completes step when matching agent stops', async () => {
      const { coordinator, eventBus } = createCoordinator();
      await coordinator.start('execute the plan');

      eventBus._fire('agent:stopped', { processId: 'mock-proc-1', reason: 'done' });

      const session = coordinator.getSession();
      expect(session?.steps[0].status).toBe('completed');
      expect(session?.steps[0].summary).toBe('done');
      expect(session?.status).toBe('completed');
    });

    it('ignores agent:stopped for unknown processId', async () => {
      const { coordinator, eventBus } = createCoordinator();
      await coordinator.start('execute the plan');

      eventBus._fire('agent:stopped', { processId: 'unknown-proc', reason: 'done' });

      const session = coordinator.getSession();
      expect(session?.steps[0].status).toBe('running');
    });

    it('advances to next step in multi-step chain', async () => {
      const { coordinator, agentManager, eventBus } = createCoordinator();

      let spawnCount = 0;
      (agentManager.spawn as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        spawnCount++;
        return {
          id: `proc-${spawnCount}`,
          type: 'claude-code',
          status: 'running',
          config: { type: 'claude-code', prompt: 'test', workDir: '/tmp' },
          startedAt: new Date().toISOString(),
        };
      });

      await coordinator.start('do everything', { chainName: 'execute-verify' });

      let session = coordinator.getSession();
      expect(session?.steps[0].status).toBe('running');
      expect(session?.steps[0].processId).toBe('proc-1');

      // Complete first step
      eventBus._fire('agent:stopped', { processId: 'proc-1', reason: 'step 1 done' });

      // Allow async advance to complete
      await new Promise(r => setTimeout(r, 50));

      session = coordinator.getSession();
      expect(session?.steps[0].status).toBe('completed');
      expect(agentManager.spawn).toHaveBeenCalledTimes(2);
    });
  });

  // --- getSession returns copy ---
  describe('getSession returns a copy', () => {
    it('returns independent copy of session', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.start('execute the plan');

      const s1 = coordinator.getSession();
      const s2 = coordinator.getSession();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2);
      expect(s1?.steps).not.toBe(s2?.steps);
    });
  });

  // --- destroy ---
  describe('destroy', () => {
    it('unregisters agent:stopped listener', () => {
      const { coordinator, eventBus } = createCoordinator();
      coordinator.destroy();
      expect(eventBus.off).toHaveBeenCalledWith('agent:stopped', expect.any(Function));
    });
  });
});
