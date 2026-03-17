import { Hono } from 'hono';

export function createHealthRoute(workflowRoot: string): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      version: '0.1.0',
      workspace: workflowRoot,
    });
  });

  app.post('/api/shutdown', (c) => {
    // Respond before shutting down so the client sees success
    setTimeout(() => {
      console.log('Shutdown requested via API, exiting...');
      process.exit(0);
    }, 200);
    return c.json({ status: 'shutting_down' });
  });

  return app;
}
