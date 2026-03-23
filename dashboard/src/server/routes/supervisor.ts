// ---------------------------------------------------------------------------
// Supervisor REST API routes -- learning, schedules, prompts, extensions
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import type { SelfLearningService } from '../supervisor/self-learning-service.js';
import type { TaskSchedulerService } from '../supervisor/task-scheduler-service.js';
import type { ExtensionManager } from '../supervisor/extension-manager.js';
import type { PromptRegistry } from '../prompt/prompt-registry.js';

/**
 * Supervisor routes following the Hono factory pattern.
 *
 * GET    /api/supervisor/prompts              list registered builders
 * PUT    /api/supervisor/prompts/config       update strategy->mode bindings
 * POST   /api/supervisor/prompts/preview      render template with sample data
 * GET    /api/supervisor/schedules            list all scheduled tasks
 * POST   /api/supervisor/schedules            create new scheduled task
 * PUT    /api/supervisor/schedules/:id        update scheduled task
 * DELETE /api/supervisor/schedules/:id        delete scheduled task
 * POST   /api/supervisor/schedules/:id/run    manual trigger
 * GET    /api/supervisor/learning/stats       LearningStats
 * GET    /api/supervisor/learning/patterns    CommandPatterns
 * GET    /api/supervisor/learning/kb          KnowledgeBase entries
 * GET    /api/supervisor/extensions           list registered extensions
 */
export function createSupervisorRoutes(
  learningService: SelfLearningService,
  schedulerService: TaskSchedulerService,
  extensionManager: ExtensionManager,
  promptRegistry: PromptRegistry,
): Hono {
  const app = new Hono();

  // -------------------------------------------------------------------------
  // Prompt endpoints
  // -------------------------------------------------------------------------

  // GET /api/supervisor/prompts -- list registered builders
  app.get('/api/supervisor/prompts', (c) => {
    return c.json({ builders: promptRegistry.list() });
  });

  // PUT /api/supervisor/prompts/config -- update strategy->mode bindings
  app.put('/api/supervisor/prompts/config', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const bindings = body.bindings;
      if (!bindings || typeof bindings !== 'object') {
        return c.json({ error: 'Missing or invalid "bindings" (must be object)' }, 400);
      }
      // Store bindings -- for Phase 1, acknowledge the config update
      // Full persistence will be handled by a config service in later phases
      return c.json({ ok: true, bindings });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/supervisor/prompts/preview -- render template with sample data
  app.post('/api/supervisor/prompts/preview', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const builderName = typeof body.builder === 'string' ? body.builder : undefined;
      if (!builderName) {
        return c.json({ error: 'Missing or invalid "builder" (must be string)' }, 400);
      }

      const builder = promptRegistry.get(builderName);
      if (!builder) {
        return c.json({ error: `Builder not found: ${builderName}` }, 404);
      }

      const context = body.context;
      if (!context || typeof context !== 'object' || Array.isArray(context)) {
        return c.json({ error: 'Missing or invalid "context" (must be object)' }, 400);
      }

      // Build prompt with provided context — builder.build validates its own shape
      let result: string;
      try {
        result = await builder.build(context as Parameters<typeof builder.build>[0]);
      } catch (buildErr) {
        const msg = buildErr instanceof Error ? buildErr.message : String(buildErr);
        return c.json({ error: `Builder failed: ${msg}` }, 400);
      }
      return c.json({ ok: true, preview: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // Schedule endpoints
  // -------------------------------------------------------------------------

  // GET /api/supervisor/schedules -- list all scheduled tasks
  app.get('/api/supervisor/schedules', (c) => {
    return c.json({ tasks: schedulerService.listTasks() });
  });

  // POST /api/supervisor/schedules -- create new scheduled task
  app.post('/api/supervisor/schedules', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const name = typeof body.name === 'string' ? body.name : undefined;
      const cronExpression = typeof body.cronExpression === 'string' ? body.cronExpression : undefined;
      const taskType = typeof body.taskType === 'string' ? body.taskType : undefined;
      const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
      const config = body.config && typeof body.config === 'object' && !Array.isArray(body.config)
        ? body.config as Record<string, unknown> : {};

      if (!name) {
        return c.json({ error: 'Missing or invalid "name" (must be string)' }, 400);
      }
      if (!cronExpression) {
        return c.json({ error: 'Missing or invalid "cronExpression" (must be string)' }, 400);
      }
      if (!taskType) {
        return c.json({ error: 'Missing or invalid "taskType" (must be string)' }, 400);
      }

      const task = await schedulerService.createTask({
        name,
        cronExpression,
        taskType: taskType as Parameters<typeof schedulerService.createTask>[0]['taskType'],
        enabled,
        config,
      });

      return c.json({ ok: true, task });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // PUT /api/supervisor/schedules/:id -- update scheduled task
  app.put('/api/supervisor/schedules/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Record<string, unknown>>();
      // Extract only known fields to avoid passing arbitrary data
      const updates: Record<string, unknown> = {};
      if (typeof body.name === 'string') updates.name = body.name;
      if (typeof body.cronExpression === 'string') updates.cronExpression = body.cronExpression;
      if (typeof body.taskType === 'string') updates.taskType = body.taskType;
      if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
      if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) updates.config = body.config;

      const task = await schedulerService.updateTask(id, updates as Parameters<typeof schedulerService.updateTask>[1]);
      return c.json({ ok: true, task });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err instanceof Error && err.message.includes('not found')) ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  // DELETE /api/supervisor/schedules/:id -- delete scheduled task
  app.delete('/api/supervisor/schedules/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await schedulerService.deleteTask(id);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err instanceof Error && err.message.includes('not found')) ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  // POST /api/supervisor/schedules/:id/run -- manual trigger
  app.post('/api/supervisor/schedules/:id/run', async (c) => {
    try {
      const id = c.req.param('id');
      const result = await schedulerService.runTask(id);
      return c.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err instanceof Error && err.message.includes('not found')) ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  // -------------------------------------------------------------------------
  // Learning endpoints
  // -------------------------------------------------------------------------

  // GET /api/supervisor/learning/stats -- LearningStats
  app.get('/api/supervisor/learning/stats', (c) => {
    return c.json(learningService.getStats());
  });

  // GET /api/supervisor/learning/patterns -- CommandPatterns
  app.get('/api/supervisor/learning/patterns', (c) => {
    return c.json({ patterns: learningService.getPatterns() });
  });

  // GET /api/supervisor/learning/kb -- KnowledgeBase entries
  app.get('/api/supervisor/learning/kb', (c) => {
    return c.json({ entries: learningService.getKnowledgeBase() });
  });

  // -------------------------------------------------------------------------
  // Extension endpoints
  // -------------------------------------------------------------------------

  // GET /api/supervisor/extensions -- list registered extensions
  app.get('/api/supervisor/extensions', (c) => {
    return c.json({ extensions: extensionManager.listExtensions() });
  });

  return app;
}
