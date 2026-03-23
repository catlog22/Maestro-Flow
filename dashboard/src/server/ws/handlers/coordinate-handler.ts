import type { WebSocket } from 'ws';

import type { WsHandler } from '../ws-handler.js';
import type { WsEventType } from '../../../shared/ws-protocol.js';
import type { WorkflowCoordinator } from '../../coordinator/workflow-coordinator.js';

// ---------------------------------------------------------------------------
// CoordinateWsHandler — coordinate:start, coordinate:stop,
//                        coordinate:resume, coordinate:clarify
// ---------------------------------------------------------------------------

export class CoordinateWsHandler implements WsHandler {
  readonly actions = [
    'coordinate:start',
    'coordinate:stop',
    'coordinate:resume',
    'coordinate:clarify',
  ] as const;

  constructor(private readonly coordinateRunner: WorkflowCoordinator) {}

  async handle(
    action: string,
    data: unknown,
    _ws: WebSocket,
    _broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void> {
    const msg = data as Record<string, unknown>;

    switch (action) {
      case 'coordinate:start':
        await this.coordinateRunner.start(
          msg.intent as string,
          { tool: msg.tool as string | undefined, autoMode: msg.autoMode as boolean | undefined },
        );
        break;

      case 'coordinate:stop':
        await this.coordinateRunner.stop();
        break;

      case 'coordinate:resume':
        await this.coordinateRunner.resume(msg.sessionId as string | undefined);
        break;

      case 'coordinate:clarify':
        await this.coordinateRunner.clarify(
          msg.sessionId as string,
          msg.response as string,
        );
        break;
    }
  }
}
