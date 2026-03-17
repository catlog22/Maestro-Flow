import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { StateManager } from '../state/state-manager.js';
import type { SSEHub } from '../sse/sse-hub.js';
import { SSE_EVENT_TYPES } from '../../shared/constants.js';

/**
 * SSE events route.
 *
 * GET /events - Server-Sent Events stream.
 *   1. Sends initial board snapshot as "board:full" event.
 *   2. Forwards all EventBus events in real time.
 *   3. Heartbeat comments are handled by SSEHub.
 *   4. Returns 503 when max connections reached.
 */
export function createEventsRoute(
  stateManager: StateManager,
  _eventBus: unknown,
  sseHub: SSEHub,
): Hono {
  const app = new Hono();

  app.get('/events', (c) => {
    // Reject when at capacity
    if (!sseHub.canAccept()) {
      return c.text('Too many SSE connections', 503);
    }

    return streamSSE(c, async (stream) => {
      // Register with SSEHub — bridge raw SSE text to the stream
      const clientId = sseHub.addClient(
        (chunk: string) => {
          void stream.write(chunk);
        },
        () => {
          void stream.close();
        },
      );

      if (clientId === null) {
        // Race condition: another client connected between canAccept and addClient
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: 'Too many connections' }),
        });
        await stream.close();
        return;
      }

      // Send initial board snapshot and connected ack through SSEHub's formatSSE
      // to keep a single delivery path for all events
      const board = stateManager.getBoard();
      void stream.write(`event: ${SSE_EVENT_TYPES.BOARD_FULL}\ndata: ${JSON.stringify(board)}\n\n`);
      void stream.write(`event: ${SSE_EVENT_TYPES.CONNECTED}\ndata: ${JSON.stringify({ clientId })}\n\n`);

      // Block until client disconnects; cleanup SSEHub registration on abort
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          sseHub.removeClient(clientId);
          resolve();
        });
      });
    });
  });

  return app;
}
