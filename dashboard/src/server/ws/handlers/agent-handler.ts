import { WebSocket } from 'ws';

import type { WsHandler } from '../ws-handler.js';
import type { WsEventType } from '../../../shared/ws-protocol.js';
import type { AgentConfig } from '../../../shared/agent-types.js';
import type { AgentManager } from '../../agents/agent-manager.js';
import type { DashboardEventBus } from '../../state/event-bus.js';
import { loadDashboardAgentSettings } from '../../config.js';
import { EntryNormalizer } from '../../agents/entry-normalizer.js';

// ---------------------------------------------------------------------------
// AgentWsHandler — spawn, stop, message, approve, CLI bridge forwarding
// ---------------------------------------------------------------------------

export class AgentWsHandler implements WsHandler {
  readonly actions = [
    'spawn',
    'stop',
    'message',
    'approve',
    'cli:spawned',
    'cli:entry',
    'cli:stopped',
  ] as const;

  constructor(
    private readonly agentManager: AgentManager,
    private readonly eventBus: DashboardEventBus,
    private readonly workflowRoot: string,
  ) {}

  async handle(
    action: string,
    data: unknown,
    ws: WebSocket,
    broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void> {
    const msg = data as Record<string, unknown>;

    switch (action) {
      case 'spawn':
        await this.mergeSettingsAndSpawn(ws, msg.config as AgentConfig);
        break;

      case 'stop':
        await this.agentManager.stop(msg.processId as string);
        break;

      case 'message':
        await this.agentManager.sendMessage(
          msg.processId as string,
          msg.content as string,
        );
        break;

      case 'approve':
        await this.agentManager.respondApproval({
          id: msg.requestId as string,
          processId: msg.processId as string,
          allow: msg.allow as boolean,
        });
        break;

      case 'cli:spawned': {
        const proc = msg.process as import('../../../shared/agent-types.js').AgentProcess;
        this.agentManager.registerCliProcess(proc);
        this.eventBus.emit('agent:spawned', proc);
        if (proc.config?.prompt) {
          const userEntry = EntryNormalizer.userMessage(proc.id, proc.config.prompt);
          this.agentManager.addCliEntry(proc.id, userEntry);
          this.eventBus.emit('agent:entry', userEntry);
        }
        break;
      }

      case 'cli:entry': {
        const entry = msg.entry as import('../../../shared/agent-types.js').NormalizedEntry;
        this.agentManager.addCliEntry(entry.processId, entry);
        this.eventBus.emit('agent:entry', entry);
        break;
      }

      case 'cli:stopped':
        this.agentManager.updateCliProcessStatus(
          msg.processId as string,
          'stopped',
        );
        this.eventBus.emit('agent:stopped', { processId: msg.processId as string });
        break;
    }
  }

  /**
   * Merge saved agent settings into spawn config, then spawn.
   * Public so ExecutionWsHandler can reuse it for issue analyze/plan.
   */
  async mergeSettingsAndSpawn(ws: WebSocket, config: AgentConfig): Promise<void> {
    const saved = await loadDashboardAgentSettings(this.workflowRoot, config.type);
    const mergedConfig = {
      ...config,
      model: (config.model ?? saved?.model) || undefined,
      approvalMode: config.approvalMode ?? saved?.approvalMode ?? undefined,
      baseUrl: (config.baseUrl ?? saved?.baseUrl) || undefined,
      apiKey: (config.apiKey ?? saved?.apiKey) || undefined,
      settingsFile: (config.settingsFile ?? saved?.settingsFile) || undefined,
      envFile: (config.envFile ?? saved?.envFile) || undefined,
    };
    const proc = await this.agentManager.spawn(mergedConfig.type, mergedConfig);
    const response = {
      type: 'agent:spawned' as const,
      data: proc,
      timestamp: new Date().toISOString(),
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }
}
