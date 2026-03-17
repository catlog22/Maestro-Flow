// ---------------------------------------------------------------------------
// DashboardBridge — optional WS client for forwarding CLI agent events to
// a running Dashboard instance. Fails silently when Dashboard is unavailable.
// ---------------------------------------------------------------------------

import { WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Minimal types mirrored from dashboard protocol (avoid cross-rootDir imports)
// ---------------------------------------------------------------------------

interface AgentProcess {
  id: string;
  type: string;
  status: string;
  config: unknown;
  startedAt: string;
  pid?: number;
}

interface NormalizedEntry {
  id: string;
  processId: string;
  timestamp: string;
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// DashboardBridge
// ---------------------------------------------------------------------------

export class DashboardBridge {
  private ws: WebSocket | null = null;

  /**
   * Attempt to connect to the Dashboard WS endpoint.
   * Returns immediately if connection fails or times out.
   */
  async tryConnect(url: string, timeoutMs = 1000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        ws.terminate();
        resolve(false);
      }, timeoutMs);

      const ws = new WebSocket(url);

      ws.on('open', () => {
        clearTimeout(timer);
        this.ws = ws;
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /** Forward a process spawn event to the Dashboard */
  forwardSpawn(process: AgentProcess): void {
    this.send({ action: 'cli:spawned', process });
  }

  /** Forward a normalized entry to the Dashboard */
  forwardEntry(entry: NormalizedEntry): void {
    this.send({ action: 'cli:entry', entry });
  }

  /** Notify Dashboard that the CLI process has stopped */
  forwardStopped(processId: string): void {
    this.send({ action: 'cli:stopped', processId });
  }

  /** Close the WS connection */
  close(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {
        // Silent failure — dashboard monitoring is best-effort
      }
    }
  }
}
