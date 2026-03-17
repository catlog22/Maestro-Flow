import { useEffect, useRef } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { WS_EVENT_TYPES } from '@/shared/constants.js';
import type { BoardState, PhaseCard } from '@/shared/types.js';
import type { WsServerMessage, WsClientMessage } from '@/shared/ws-protocol.js';
import type { AgentProcess, NormalizedEntry, ApprovalRequest, AgentStatusPayload, AgentStoppedPayload } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// useWebSocket — connect to /ws, dispatch to stores, auto-reconnect
// ---------------------------------------------------------------------------

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

/** Module-level send function so external code can send messages */
let wsSendFn: ((msg: WsClientMessage) => void) | null = null;

/** Send a client message to the server via the active WebSocket */
export function sendWsMessage(msg: WsClientMessage): void {
  if (wsSendFn) {
    wsSendFn(msg);
  } else {
    console.warn('[WS] Cannot send — no active WebSocket connection');
  }
}

export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_MS);

  useEffect(() => {
    let disposed = false;

    // Access actions via getState() to avoid selector re-renders
    const { setBoard, updatePhase, updateTask, setConnected } = useBoardStore.getState();
    const {
      addProcess,
      removeProcess,
      updateProcessStatus,
      addEntry,
      setApproval,
    } = useAgentStore.getState();

    function connect() {
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      // Expose send function at module level
      wsSendFn = (msg: WsClientMessage) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      };

      ws.onopen = () => {
        setConnected(true);
        reconnectDelay.current = RECONNECT_BASE_MS; // reset on success

        // Resync state after reconnect
        fetch('/api/board').then(r => r.ok ? r.json() : null).then(data => {
          if (data) setBoard(data as BoardState);
        }).catch(() => {});
        fetch('/api/agents').then(r => r.ok ? r.json() : null).then((agents: unknown) => {
          if (Array.isArray(agents)) {
            for (const proc of agents) addProcess(proc as AgentProcess);
          }
        }).catch(() => {});
      };

      ws.onmessage = (event) => {
        let msg: WsServerMessage;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          console.warn('[WS] Failed to parse message', event.data);
          return;
        }

        switch (msg.type) {
          // --- Board events (same logic as useSSE) ---
          case WS_EVENT_TYPES.BOARD_FULL:
            setBoard(msg.data as BoardState);
            break;

          case WS_EVENT_TYPES.PHASE_UPDATED: {
            const phase = msg.data as PhaseCard;
            updatePhase(phase.phase, phase);
            break;
          }

          case WS_EVENT_TYPES.TASK_UPDATED: {
            const taskData = msg.data as { id: string };
            if (taskData.id) {
              updateTask(taskData.id, taskData);
            }
            break;
          }

          case WS_EVENT_TYPES.PROJECT_UPDATED: {
            const project = msg.data;
            const board = useBoardStore.getState().board;
            if (board) {
              setBoard({ ...board, project: project as BoardState['project'] });
            }
            break;
          }

          case WS_EVENT_TYPES.HEARTBEAT:
          case WS_EVENT_TYPES.CONNECTED:
            // no-op, connection is alive
            break;

          // --- Agent events ---
          case WS_EVENT_TYPES.AGENT_SPAWNED:
            addProcess(msg.data as AgentProcess);
            break;

          case WS_EVENT_TYPES.AGENT_ENTRY: {
            const entry = msg.data as NormalizedEntry;
            addEntry(entry.processId, entry);
            break;
          }

          case WS_EVENT_TYPES.AGENT_APPROVAL:
            setApproval(msg.data as ApprovalRequest);
            break;

          case WS_EVENT_TYPES.AGENT_STATUS: {
            const statusPayload = msg.data as AgentStatusPayload;
            updateProcessStatus(statusPayload.processId, statusPayload.status);
            break;
          }

          case WS_EVENT_TYPES.AGENT_STOPPED: {
            const stoppedPayload = msg.data as AgentStoppedPayload;
            updateProcessStatus(stoppedPayload.processId, 'stopped');
            break;
          }

          default:
            // Ignore unknown event types
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        wsSendFn = null;

        if (!disposed) {
          const delay = reconnectDelay.current;
          reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, handling reconnect there
      };
    }

    connect();

    return () => {
      disposed = true;
      wsSendFn = null;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, []); // No deps — actions from getState() are stable
}
