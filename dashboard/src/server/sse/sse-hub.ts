import type { SSEEvent } from '../../shared/types.js';
import { DEFAULT_CONFIG } from '../../shared/constants.js';
import type { DashboardEventBus } from '../state/event-bus.js';

// ---------------------------------------------------------------------------
// SSE client representation
// ---------------------------------------------------------------------------

interface SSEClient {
  id: string;
  write: (chunk: string) => void;
  close: () => void;
}

// ---------------------------------------------------------------------------
// SSEHub — manages connected SSE clients and broadcasts EventBus events
// ---------------------------------------------------------------------------

export class SSEHub {
  private readonly clients = new Map<string, SSEClient>();
  private readonly maxConnections: number;
  private readonly heartbeatMs: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private nextId = 0;

  private readonly eventListener: (event: SSEEvent) => void;

  constructor(
    private readonly eventBus: DashboardEventBus,
    options?: { maxConnections?: number; heartbeatMs?: number },
  ) {
    this.maxConnections = options?.maxConnections ?? DEFAULT_CONFIG.sseMaxConnections;
    this.heartbeatMs = options?.heartbeatMs ?? DEFAULT_CONFIG.sseHeartbeatMs;

    // Subscribe to all EventBus events and broadcast to clients
    this.eventListener = (event: SSEEvent) => {
      this.broadcast(event.type, event.data);
    };
    this.eventBus.onAny(this.eventListener);

    this.startHeartbeat();
  }

  /**
   * Check if a new client can be accepted.
   * Returns false when max connections is reached.
   */
  canAccept(): boolean {
    return this.clients.size < this.maxConnections;
  }

  /**
   * Register a new SSE client.
   * Returns the client ID for later removal, or null if max connections reached.
   */
  addClient(write: (chunk: string) => void, close: () => void): string | null {
    if (!this.canAccept()) {
      return null;
    }

    const id = `sse-${++this.nextId}`;
    this.clients.set(id, { id, write, close });
    return id;
  }

  /** Unregister a client by ID */
  removeClient(id: string): void {
    this.clients.delete(id);
  }

  /** Return the number of connected clients */
  getClientCount(): number {
    return this.clients.size;
  }

  /** Send a named SSE event to all connected clients */
  broadcast(eventType: string, data: unknown): void {
    const payload = formatSSE(eventType, data);
    const toRemove: string[] = [];

    for (const [id, client] of this.clients) {
      try {
        client.write(payload);
      } catch {
        toRemove.push(id);
      }
    }

    // Clean up failed clients
    for (const id of toRemove) {
      this.clients.delete(id);
    }
  }

  /** Stop heartbeat and unsubscribe from EventBus */
  destroy(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.eventBus.offAny(this.eventListener);
    this.clients.clear();
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const comment = ': heartbeat\n\n';
      const toRemove: string[] = [];

      for (const [id, client] of this.clients) {
        try {
          client.write(comment);
        } catch {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        this.clients.delete(id);
      }
    }, this.heartbeatMs);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format data as an SSE message: `event: <type>\ndata: <json>\n\n` */
function formatSSE(eventType: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${json}\n\n`;
}
