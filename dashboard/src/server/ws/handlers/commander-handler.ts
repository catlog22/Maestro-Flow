import type { WebSocket } from 'ws';

import type { WsHandler } from '../ws-handler.js';
import type { WsEventType } from '../../../shared/ws-protocol.js';
import type { CommanderAgent } from '../../commander/commander-agent.js';
import type { CommanderConfig } from '../../../shared/commander-types.js';

// ---------------------------------------------------------------------------
// CommanderWsHandler — commander:start, commander:stop, commander:pause,
//                      commander:config
// ---------------------------------------------------------------------------

export class CommanderWsHandler implements WsHandler {
  readonly actions = [
    'commander:start',
    'commander:stop',
    'commander:pause',
    'commander:config',
  ] as const;

  constructor(private readonly commanderAgent: CommanderAgent) {}

  async handle(
    action: string,
    data: unknown,
    _ws: WebSocket,
    _broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void> {
    const msg = data as Record<string, unknown>;

    switch (action) {
      case 'commander:start':
        await this.commanderAgent.start();
        break;

      case 'commander:stop':
        this.commanderAgent.stop();
        break;

      case 'commander:pause': {
        const state = this.commanderAgent.getState();
        if (state.status === 'paused') {
          this.commanderAgent.resume();
        } else {
          this.commanderAgent.pause();
        }
        break;
      }

      case 'commander:config':
        this.commanderAgent.updateConfig(msg.config as Partial<CommanderConfig>);
        break;
    }
  }
}
