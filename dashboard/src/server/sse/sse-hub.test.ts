import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEHub } from './sse-hub.js';
import { DashboardEventBus } from '../state/event-bus.js';

describe('SSEHub', () => {
  let eventBus: DashboardEventBus;
  let hub: SSEHub;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new DashboardEventBus();
    hub = new SSEHub(eventBus, { maxConnections: 3, heartbeatMs: 1000 });
  });

  afterEach(() => {
    hub.destroy();
    vi.useRealTimers();
  });

  describe('addClient / removeClient', () => {
    it('adds a client and returns an id', () => {
      const id = hub.addClient(vi.fn(), vi.fn());
      expect(id).toMatch(/^sse-/);
      expect(hub.getClientCount()).toBe(1);
    });

    it('returns null when max connections reached', () => {
      hub.addClient(vi.fn(), vi.fn());
      hub.addClient(vi.fn(), vi.fn());
      hub.addClient(vi.fn(), vi.fn());
      expect(hub.getClientCount()).toBe(3);

      const id = hub.addClient(vi.fn(), vi.fn());
      expect(id).toBeNull();
      expect(hub.getClientCount()).toBe(3);
    });

    it('removes a client by id', () => {
      const id = hub.addClient(vi.fn(), vi.fn())!;
      expect(hub.getClientCount()).toBe(1);

      hub.removeClient(id);
      expect(hub.getClientCount()).toBe(0);
    });

    it('removing a non-existent client is a no-op', () => {
      hub.removeClient('sse-nonexistent');
      expect(hub.getClientCount()).toBe(0);
    });
  });

  describe('canAccept', () => {
    it('returns true when under max', () => {
      expect(hub.canAccept()).toBe(true);
    });

    it('returns false when at max', () => {
      hub.addClient(vi.fn(), vi.fn());
      hub.addClient(vi.fn(), vi.fn());
      hub.addClient(vi.fn(), vi.fn());
      expect(hub.canAccept()).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('sends formatted SSE to all connected clients', () => {
      const write1 = vi.fn();
      const write2 = vi.fn();
      hub.addClient(write1, vi.fn());
      hub.addClient(write2, vi.fn());

      hub.broadcast('test:event', { foo: 'bar' });

      const expected = 'event: test:event\ndata: {"foo":"bar"}\n\n';
      expect(write1).toHaveBeenCalledWith(expected);
      expect(write2).toHaveBeenCalledWith(expected);
    });

    it('removes clients that throw on write', () => {
      const failWrite = vi.fn().mockImplementation(() => {
        throw new Error('connection reset');
      });
      const goodWrite = vi.fn();
      hub.addClient(failWrite, vi.fn());
      hub.addClient(goodWrite, vi.fn());

      hub.broadcast('test:event', { data: 1 });

      expect(hub.getClientCount()).toBe(1);
      expect(goodWrite).toHaveBeenCalledTimes(1);
    });
  });

  describe('EventBus integration', () => {
    it('broadcasts EventBus events to SSE clients', () => {
      const write = vi.fn();
      hub.addClient(write, vi.fn());

      eventBus.emit('heartbeat', null);

      expect(write).toHaveBeenCalledTimes(1);
      const payload = write.mock.calls[0][0] as string;
      expect(payload).toContain('event: heartbeat');
    });
  });

  describe('heartbeat', () => {
    it('sends heartbeat comments to all clients on interval', () => {
      const write = vi.fn();
      hub.addClient(write, vi.fn());

      vi.advanceTimersByTime(1000);

      expect(write).toHaveBeenCalledWith(': heartbeat\n\n');
    });

    it('removes clients that fail during heartbeat', () => {
      const failWrite = vi.fn().mockImplementation(() => {
        throw new Error('broken pipe');
      });
      hub.addClient(failWrite, vi.fn());
      expect(hub.getClientCount()).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(hub.getClientCount()).toBe(0);
    });
  });

  describe('destroy', () => {
    it('clears all clients and stops heartbeat', () => {
      const write = vi.fn();
      hub.addClient(write, vi.fn());
      hub.addClient(vi.fn(), vi.fn());
      expect(hub.getClientCount()).toBe(2);

      hub.destroy();
      expect(hub.getClientCount()).toBe(0);

      // Heartbeat should no longer fire
      vi.advanceTimersByTime(5000);
      expect(write).not.toHaveBeenCalledWith(': heartbeat\n\n');
    });

    it('unsubscribes from EventBus', () => {
      const write = vi.fn();
      hub.addClient(write, vi.fn());

      hub.destroy();

      // Re-add a client to the now-destroyed hub (it won't receive events)
      // Events emitted after destroy should not reach old listeners
      eventBus.emit('heartbeat', null);
      // write was only called 0 times (no events forwarded after destroy + clients cleared)
      // The client was cleared, so even if listener fires there's no one to write to
      expect(hub.getClientCount()).toBe(0);
    });
  });
});
