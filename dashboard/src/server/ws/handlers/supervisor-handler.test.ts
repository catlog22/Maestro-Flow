import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupervisorWsHandler } from './supervisor-handler.js';
import type { LearningStats } from '../../../shared/learning-types.js';
import type { ScheduledTask } from '../../../shared/schedule-types.js';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------
class MockWebSocket {
  readyState = 1; // WebSocket.OPEN
  sent: string[] = [];
  send(data: string): void { this.sent.push(data); }
}

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------
class MockLearningService {
  getStats(): LearningStats {
    return {
      totalCommands: 10,
      uniquePatterns: 3,
      topPatterns: [],
      suggestions: [],
      knowledgeBaseSize: 5,
    };
  }
}

class MockSchedulerService {
  listTasks(): ScheduledTask[] {
    return [
      {
        id: 'task-1',
        name: 'Health Check',
        cronExpression: '0 * * * *',
        taskType: 'health-check',
        config: {},
        enabled: true,
        lastRun: null,
        nextRun: null,
        history: [],
      },
    ];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SupervisorWsHandler', () => {
  let handler: SupervisorWsHandler;
  let ws: MockWebSocket;
  let broadcast: (type: import('../../../shared/ws-protocol.js').WsEventType, data: unknown) => void;

  beforeEach(() => {
    handler = new SupervisorWsHandler(
      new MockLearningService() as any,
      new MockSchedulerService() as any,
    );
    ws = new MockWebSocket();
    broadcast = vi.fn() as unknown as typeof broadcast;
  });

  describe('actions', () => {
    it('declares supervisor:learning and supervisor:schedule actions', () => {
      expect(handler.actions).toContain('supervisor:learning');
      expect(handler.actions).toContain('supervisor:schedule');
    });
  });

  describe('supervisor:learning', () => {
    it('sends learning stats to websocket', async () => {
      await handler.handle('supervisor:learning', undefined, ws as any, broadcast);

      expect(ws.sent).toHaveLength(1);
      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('supervisor:learning_update');
      expect(msg.data.totalCommands).toBe(10);
      expect(msg.data.uniquePatterns).toBe(3);
      expect(msg.data.knowledgeBaseSize).toBe(5);
    });

    it('does not call broadcast', async () => {
      await handler.handle('supervisor:learning', undefined, ws as any, broadcast);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('supervisor:schedule', () => {
    it('sends schedule data to websocket', async () => {
      await handler.handle('supervisor:schedule', undefined, ws as any, broadcast);

      expect(ws.sent).toHaveLength(1);
      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('supervisor:schedule_update');
      expect(msg.data.tasks).toHaveLength(1);
      expect(msg.data.tasks[0].name).toBe('Health Check');
    });
  });

  describe('closed websocket', () => {
    it('does not send when readyState is not OPEN', async () => {
      ws.readyState = 3; // CLOSED
      await handler.handle('supervisor:learning', undefined, ws as any, broadcast);
      expect(ws.sent).toHaveLength(0);
    });
  });

  describe('unknown action', () => {
    it('does not send anything for unhandled actions', async () => {
      await handler.handle('unknown:action', undefined, ws as any, broadcast);
      expect(ws.sent).toHaveLength(0);
    });
  });
});
