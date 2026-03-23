import type { WebSocket } from 'ws';
import type { WsEventType } from '../../shared/ws-protocol.js';

export interface WsHandler {
  /** Actions this handler responds to */
  readonly actions: readonly string[];
  /** Handle a client message */
  handle(
    action: string,
    data: unknown,
    ws: WebSocket,
    broadcast: (type: WsEventType, data: unknown) => void,
  ): Promise<void>;
}
