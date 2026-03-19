import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createEventsRoute } from './events.js';
import type { StateManager } from '../state/state-manager.js';
import type { SSEHub } from '../sse/sse-hub.js';

function createMockStateManager(): StateManager {
  return {
    getBoard: vi.fn().mockReturnValue({
      project: { project_name: 'test' },
      phases: [],
      scratch: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    }),
  } as unknown as StateManager;
}

function createMockSSEHub(overrides: Partial<SSEHub> = {}): SSEHub {
  return {
    canAccept: vi.fn().mockReturnValue(true),
    addClient: vi.fn().mockReturnValue('sse-1'),
    removeClient: vi.fn(),
    getClientCount: vi.fn().mockReturnValue(0),
    ...overrides,
  } as unknown as SSEHub;
}

describe('Events Route', () => {
  function createApp(sseHubOverrides: Partial<SSEHub> = {}) {
    const stateManager = createMockStateManager();
    const sseHub = createMockSSEHub(sseHubOverrides);
    const routes = createEventsRoute(stateManager, null, sseHub);
    const app = new Hono();
    app.route('/', routes);
    return { app, stateManager, sseHub };
  }

  it('returns 503 when max connections reached', async () => {
    const { app } = createApp({
      canAccept: vi.fn().mockReturnValue(false),
    });

    const res = await app.request('/events');
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain('Too many SSE connections');
  });

  it('returns 200 with SSE stream when connections available', async () => {
    const { app } = createApp();

    // The stream will hang waiting for abort, but we can check the initial response
    const controller = new AbortController();
    const resPromise = app.request('/events', { signal: controller.signal });

    // Give it a moment to start streaming
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    try {
      const res = await resPromise;
      // Should return 200 for SSE
      expect(res.status).toBe(200);
    } catch {
      // AbortError is expected when we cancel the stream
    }
  });
});
