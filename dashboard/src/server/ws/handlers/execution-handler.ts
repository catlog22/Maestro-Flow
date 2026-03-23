import type { WebSocket } from 'ws';

import type { WsHandler } from '../ws-handler.js';
import type { WsEventType } from '../../../shared/ws-protocol.js';
import type { AgentManager } from '../../agents/agent-manager.js';
import type { DashboardEventBus } from '../../state/event-bus.js';
import type { ExecutionScheduler } from '../../execution/execution-scheduler.js';
import type { WaveExecutor } from '../../execution/wave-executor.js';
import type { AgentWsHandler } from './agent-handler.js';
import { loadDashboardAgentSettings } from '../../config.js';
import { readIssuesJsonl } from '../../utils/issue-store.js';

// ---------------------------------------------------------------------------
// ExecutionWsHandler — execute:issue, execute:batch, execute:wave,
//                      supervisor:toggle, issue:analyze, issue:plan
// ---------------------------------------------------------------------------

export class ExecutionWsHandler implements WsHandler {
  readonly actions = [
    'execute:issue',
    'execute:batch',
    'execute:wave',
    'supervisor:toggle',
    'issue:analyze',
    'issue:plan',
  ] as const;

  constructor(
    private readonly executionScheduler: ExecutionScheduler,
    private readonly waveExecutor: WaveExecutor,
    private readonly agentManager: AgentManager,
    private readonly eventBus: DashboardEventBus,
    private readonly workflowRoot: string,
    private readonly agentHandler: AgentWsHandler,
  ) {}

  async handle(
    action: string,
    data: unknown,
    ws: WebSocket,
    _broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void> {
    const msg = data as Record<string, unknown>;

    switch (action) {
      case 'execute:issue':
        await this.executionScheduler.executeIssue(
          msg.issueId as string,
          msg.executor as import('../../../shared/agent-types.js').AgentType | undefined,
        );
        break;

      case 'execute:batch':
        await this.executionScheduler.executeBatch(
          msg.issueIds as string[],
          msg.executor as import('../../../shared/agent-types.js').AgentType | undefined,
          msg.maxConcurrency as number | undefined,
        );
        break;

      case 'execute:wave':
        await this.handleWaveExecute(ws, msg.issueId as string);
        break;

      case 'supervisor:toggle':
        if (msg.config) {
          this.executionScheduler.updateConfig(
            msg.config as Partial<import('../../../shared/execution-types.js').SupervisorConfig>,
          );
        }
        if (msg.enabled === true) {
          this.executionScheduler.startSupervisor();
        } else if (msg.enabled === false) {
          this.executionScheduler.stopSupervisor();
        }
        break;

      case 'issue:analyze':
        if (!msg.issueId) {
          throw new Error('Missing issueId');
        }
        await this.handleIssueAnalyze(ws, msg.issueId as string, msg.tool as string | undefined, msg.depth as string | undefined);
        break;

      case 'issue:plan':
        if (!msg.issueId) {
          throw new Error('Missing issueId');
        }
        await this.handleIssuePlan(ws, msg.issueId as string, msg.tool as string | undefined);
        break;
    }
  }

  private async handleWaveExecute(ws: WebSocket, issueId: string): Promise<void> {
    if (!issueId) {
      throw new Error('Missing issueId');
    }

    const { join } = await import('node:path');
    const jsonlPath = join(this.workflowRoot, 'issues', 'issues.jsonl');
    const issues = await readIssuesJsonl(jsonlPath);
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }
    await this.waveExecutor.execute(issue);
  }

  private async handleIssueAnalyze(ws: WebSocket, issueId: string, tool?: string, depth?: string): Promise<void> {
    const resolvedTool = tool || 'gemini';
    const resolvedDepth = depth || 'standard';
    const prompt = `/manage-issue-analyze ${issueId} --tool ${resolvedTool} --depth ${resolvedDepth}`;
    await this.buildIssuePromptAndSpawn(ws, issueId, () => prompt);
  }

  private async handleIssuePlan(ws: WebSocket, issueId: string, tool?: string): Promise<void> {
    const resolvedTool = tool || 'gemini';
    const prompt = `/manage-issue-plan ${issueId} --tool ${resolvedTool}`;
    await this.buildIssuePromptAndSpawn(ws, issueId, () => prompt);
  }

  private async buildIssuePromptAndSpawn(
    ws: WebSocket,
    issueId: string,
    buildPrompt: (issue: import('../../../shared/issue-types.js').Issue, agentType: import('../../../shared/agent-types.js').AgentType) => string,
  ): Promise<void> {
    const { join } = await import('node:path');
    const jsonlPath = join(this.workflowRoot, 'issues', 'issues.jsonl');
    const issues = await readIssuesJsonl(jsonlPath);
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    const savedSettings = await loadDashboardAgentSettings(this.workflowRoot, 'agent-sdk');
    const agentType = (savedSettings?.settingsFile || savedSettings?.baseUrl || savedSettings?.apiKey)
      ? 'agent-sdk' as const
      : 'claude-code' as const;

    const prompt = buildPrompt(issue, agentType);
    await this.agentHandler.mergeSettingsAndSpawn(ws, {
      type: agentType,
      prompt,
      workDir: this.workflowRoot,
      approvalMode: 'auto',
    });
  }
}
