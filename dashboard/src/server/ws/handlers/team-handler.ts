import { WebSocket } from 'ws';

import type { WsHandler } from '../ws-handler.js';
import type { WsEventType } from '../../../shared/ws-protocol.js';
import type { DashboardEventBus } from '../../state/event-bus.js';
import type { TeamMailboxMessage } from '../../../shared/team-types.js';

// ---------------------------------------------------------------------------
// TeamWsHandler — client-to-server team actions
//   team:message   -> send message to specific agent role in team session
//   team:broadcast -> broadcast message to all agents in team session
//   team:set_mode  -> toggle auto/manual mode for team session
//   team:approve   -> approve a pending action in team session
// ---------------------------------------------------------------------------

export class TeamWsHandler implements WsHandler {
  readonly actions = [
    'team:message',
    'team:broadcast',
    'team:set_mode',
    'team:approve',
  ] as const;

  constructor(
    private readonly eventBus: DashboardEventBus,
  ) {}

  async handle(
    action: string,
    data: unknown,
    _ws: WebSocket,
    _broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void> {
    const msg = data as Record<string, unknown>;

    switch (action) {
      case 'team:message': {
        const mailboxMessage: TeamMailboxMessage = {
          id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: 'user',
          to: msg.to as string,
          content: msg.content as string,
          dispatch_status: 'pending',
          timestamp: new Date().toISOString(),
        };
        this.eventBus.emit('team:message', mailboxMessage);
        break;
      }

      case 'team:broadcast': {
        const broadcastMessage: TeamMailboxMessage = {
          id: `tb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: 'user',
          to: '*',
          content: msg.content as string,
          dispatch_status: 'pending',
          timestamp: new Date().toISOString(),
        };
        this.eventBus.emit('team:dispatch', broadcastMessage);
        break;
      }

      case 'team:set_mode': {
        this.eventBus.emit('team:phase', {
          current: msg.mode === 'auto' ? 'execution' : 'review',
          history: [],
          fixAttempts: 0,
        });
        break;
      }

      case 'team:approve': {
        const approvalMessage: TeamMailboxMessage = {
          id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: 'user',
          to: 'supervisor',
          content: JSON.stringify({
            type: 'approval',
            requestId: msg.requestId as string,
            allow: msg.allow as boolean,
          }),
          dispatch_status: 'pending',
          timestamp: new Date().toISOString(),
        };
        this.eventBus.emit('team:message', approvalMessage);
        break;
      }
    }
  }
}
