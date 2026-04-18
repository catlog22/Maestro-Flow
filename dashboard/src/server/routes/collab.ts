// ---------------------------------------------------------------------------
// Collab REST API routes — .workflow/collab/ data management
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname, userInfo } from 'node:os';

import type { DashboardEventBus } from '../state/event-bus.js';
import type {
  CollabMember,
  CollabActivityEntry,
  CollabPresence,
  CollabAggregatedActivity,
  CollabPreflightResult,
} from '../../shared/collab-types.js';
import type { CollabTask, CollabCheckEntry, CollabTaskStatus } from '../../shared/collab-types.js';
import { COLLAB_TASK_TRANSITIONS } from '../../shared/collab-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readJsonlSafe(filePath: string): Record<string, unknown>[] {
  try {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    return content.split('\n').map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Presence computation
// ---------------------------------------------------------------------------

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const AWAY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function computeStatus(lastSeenTs: string): 'online' | 'away' | 'offline' {
  const diff = Date.now() - new Date(lastSeenTs).getTime();
  if (diff <= ONLINE_THRESHOLD_MS) return 'online';
  if (diff <= AWAY_THRESHOLD_MS) return 'away';
  return 'offline';
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createCollabRoutes(
  workflowRoot: string | (() => string),
  _eventBus: DashboardEventBus,
): Hono {
  const app = new Hono();
  const getCollabDir = () =>
    join(typeof workflowRoot === 'function' ? workflowRoot() : workflowRoot, '.workflow/collab');

  // POST /api/collab/init — initialize collab workspace
  app.post('/api/collab/init', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');

      if (existsSync(collabDir)) {
        return c.json({ success: true, message: 'Already initialized' });
      }

      mkdirSync(membersDir, { recursive: true });

      // Create initial activity.jsonl
      writeFileSync(join(collabDir, 'activity.jsonl'), '');

      // Auto-register the current machine user as the first member
      const uid = userInfo().username || 'user';
      const now = new Date().toISOString();
      const memberData = {
        uid,
        name: uid,
        email: '',
        role: 'owner',
        host: hostname(),
        joinedAt: now,
      };
      writeFileSync(join(membersDir, `${uid}.json`), JSON.stringify(memberData, null, 2));

      // Log the init + join activity
      const initEntry = JSON.stringify({ ts: now, user: uid, host: hostname(), action: 'init' });
      const joinEntry = JSON.stringify({ ts: now, user: uid, host: hostname(), action: 'join' });
      writeFileSync(join(collabDir, 'activity.jsonl'), initEntry + '\n' + joinEntry + '\n');

      return c.json({ success: true, uid, message: 'Initialized with owner: ' + uid });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/collab/disable — remove collab directory to disable team mode
  app.post('/api/collab/disable', async (c) => {
    try {
      const collabDir = getCollabDir();

      if (!existsSync(collabDir)) {
        return c.json({ success: true, message: 'Already disabled' });
      }

      const { rmSync } = await import('node:fs');
      rmSync(collabDir, { recursive: true, force: true });

      return c.json({ success: true, message: 'Team mode disabled' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/collab/members — add a new team member
  app.post('/api/collab/members', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');

      if (!existsSync(membersDir)) {
        return c.json({ error: 'Collab not initialized. Call POST /api/collab/init first.' }, 400);
      }

      const body = await c.req.json<{ name?: string; email?: string; role?: string }>();
      const name = (body.name || '').trim();
      if (!name) {
        return c.json({ error: 'name is required' }, 400);
      }

      const uid = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      const memberPath = join(membersDir, `${uid}.json`);

      if (existsSync(memberPath)) {
        return c.json({ error: `Member "${uid}" already exists` }, 409);
      }

      const now = new Date().toISOString();
      const memberData = {
        uid,
        name,
        email: body.email || '',
        role: body.role || 'member',
        host: '',
        joinedAt: now,
      };
      writeFileSync(memberPath, JSON.stringify(memberData, null, 2));

      // Log join activity
      const activityPath = join(collabDir, 'activity.jsonl');
      const entry = JSON.stringify({ ts: now, user: uid, host: '', action: 'join' }) + '\n';
      const existing = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
      writeFileSync(activityPath, existing + entry);

      return c.json({ success: true, uid, member: memberData });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // DELETE /api/collab/members/:uid — remove a team member
  app.delete('/api/collab/members/:uid', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');
      const uid = c.req.param('uid');
      const memberPath = join(membersDir, `${uid}.json`);

      if (!existsSync(memberPath)) {
        return c.json({ error: `Member "${uid}" not found` }, 404);
      }

      const { unlinkSync } = await import('node:fs');
      unlinkSync(memberPath);

      return c.json({ success: true, uid });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/members
  app.get('/api/collab/members', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');

      if (!existsSync(membersDir)) {
        return c.json([]);
      }

      // Read activity to derive lastSeen timestamps
      const activityPath = join(collabDir, 'activity.jsonl');
      const activityEntries = readJsonlSafe(activityPath);

      // Build per-user last activity map
      const lastActivityByUser: Record<string, string> = {};
      for (const entry of activityEntries) {
        const user = entry.user as string | undefined;
        const ts = entry.ts as string | undefined;
        if (!user || !ts) continue;
        if (!lastActivityByUser[user] || ts > lastActivityByUser[user]) {
          lastActivityByUser[user] = ts;
        }
      }

      // Build per-user current phase/task from most recent activity
      const latestByUser: Record<string, Record<string, unknown>> = {};
      for (const entry of activityEntries) {
        const user = entry.user as string | undefined;
        if (!user) continue;
        const ts = entry.ts as string | undefined;
        const existing = latestByUser[user];
        if (!existing || (ts && ts >= (existing.ts as string))) {
          latestByUser[user] = entry;
        }
      }

      const entries = readdirSync(membersDir);
      const members: CollabMember[] = [];

      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const data = readJsonSafe(join(membersDir, entry));
        if (!data) continue;

        const uid = data.uid as string;
        const joinedAt = data.joinedAt as string;
        const lastSeen = lastActivityByUser[uid] || joinedAt;
        const status = computeStatus(lastSeen);

        const latest = latestByUser[uid];

        members.push({
          uid,
          name: (data.name as string) || uid,
          email: (data.email as string) || '',
          status,
          currentPhase: latest?.phase_id != null ? String(latest.phase_id) : undefined,
          currentTask: (latest?.task_id as string) || undefined,
          lastSeen,
          joinedAt,
          role: (data.role as string) || 'member',
          host: (data.host as string) || '',
        });
      }

      // Sort by name
      members.sort((a, b) => a.name.localeCompare(b.name));

      return c.json(members);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/activity
  app.get('/api/collab/activity', async (c) => {
    try {
      const collabDir = getCollabDir();
      const activityPath = join(collabDir, 'activity.jsonl');

      let entries = readJsonlSafe(activityPath) as unknown as CollabActivityEntry[];

      // Filter by since
      const since = c.req.query('since');
      if (since) {
        const sinceTime = new Date(since).getTime();
        if (!isNaN(sinceTime)) {
          entries = entries.filter((e) => new Date(e.ts).getTime() >= sinceTime);
        }
      }

      // Reverse chronological order
      entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

      // Apply limit
      const limitParam = parseInt(c.req.query('limit') || '50', 10);
      const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : limitParam;
      entries = entries.slice(0, limit);

      return c.json(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/status
  app.get('/api/collab/status', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');

      if (!existsSync(membersDir)) {
        return c.json({ online: 0, total: 0, members: [] });
      }

      // Read activity to derive lastSeen timestamps
      const activityPath = join(collabDir, 'activity.jsonl');
      const activityEntries = readJsonlSafe(activityPath);

      // Build per-user last activity map
      const lastActivityByUser: Record<string, string> = {};
      for (const entry of activityEntries) {
        const user = entry.user as string | undefined;
        const ts = entry.ts as string | undefined;
        if (!user || !ts) continue;
        if (!lastActivityByUser[user] || ts > lastActivityByUser[user]) {
          lastActivityByUser[user] = ts;
        }
      }

      const entries = readdirSync(membersDir);
      const members: CollabPresence[] = [];
      let online = 0;

      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const data = readJsonSafe(join(membersDir, entry));
        if (!data) continue;

        const uid = data.uid as string;
        const joinedAt = data.joinedAt as string;
        const lastSeen = lastActivityByUser[uid] || joinedAt;
        const status = computeStatus(lastSeen);

        if (status === 'online') online++;

        members.push({
          uid,
          name: (data.name as string) || uid,
          status,
          lastSeen,
        });
      }

      return c.json({ online, total: members.length, members });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/activity/aggregated
  app.get('/api/collab/activity/aggregated', async (c) => {
    try {
      const collabDir = getCollabDir();
      const activityPath = join(collabDir, 'activity.jsonl');

      const entries = readJsonlSafe(activityPath) as unknown as CollabActivityEntry[];
      if (entries.length === 0) {
        return c.json([]);
      }

      // Group by (phase_id, task_id) pair
      const groups = new Map<string, { phase: string; task: string; members: Set<string>; count: number }>();

      for (const entry of entries) {
        const phase = entry.phase_id != null ? String(entry.phase_id) : '';
        const task = entry.task_id || '';
        const key = `${phase}::${task}`;

        let group = groups.get(key);
        if (!group) {
          group = { phase, task, members: new Set<string>(), count: 0 };
          groups.set(key, group);
        }

        group.count++;
        if (entry.user) {
          group.members.add(entry.user);
        }
      }

      const result: CollabAggregatedActivity[] = [];
      for (const group of groups.values()) {
        const memberCount = group.members.size;
        let risk: CollabAggregatedActivity['risk'] = 'none';
        if (memberCount >= 4) risk = 'high';
        else if (memberCount === 3) risk = 'medium';
        else if (memberCount === 2) risk = 'low';

        result.push({
          phase: group.phase,
          task: group.task,
          count: group.count,
          members: Array.from(group.members),
          risk,
        });
      }

      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/preflight
  app.get('/api/collab/preflight', async (c) => {
    try {
      const collabDir = getCollabDir();

      if (!existsSync(collabDir)) {
        return c.json({ exists: false, memberCount: 0, hasActivity: false } as CollabPreflightResult);
      }

      // Count member files
      const membersDir = join(collabDir, 'members');
      let memberCount = 0;
      if (existsSync(membersDir)) {
        try {
          const entries = readdirSync(membersDir);
          memberCount = entries.filter((e) => e.endsWith('.json')).length;
        } catch {
          memberCount = 0;
        }
      }

      // Check activity
      const activityPath = join(collabDir, 'activity.jsonl');
      let hasActivity = false;
      if (existsSync(activityPath)) {
        try {
          const content = readFileSync(activityPath, 'utf-8').trim();
          hasActivity = content.length > 0;
        } catch {
          hasActivity = false;
        }
      }

      return c.json({
        exists: true,
        memberCount,
        hasActivity,
      } as CollabPreflightResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -----------------------------------------------------------------------
  // Task CRUD endpoints
  // -----------------------------------------------------------------------

  // GET /api/collab/tasks — list with optional ?status=&assignee= filters
  app.get('/api/collab/tasks', async (c) => {
    try {
      const collabDir = getCollabDir();
      const tasksDir = join(collabDir, 'tasks');
      if (!existsSync(tasksDir)) return c.json([]);

      const entries = readdirSync(tasksDir).filter((e) => e.endsWith('.json'));
      const tasks: CollabTask[] = [];
      for (const entry of entries) {
        const data = readJsonSafe(join(tasksDir, entry));
        if (data) tasks.push(data as unknown as CollabTask);
      }

      // Apply filters
      const statusFilter = c.req.query('status');
      const assigneeFilter = c.req.query('assignee');
      let result = tasks;
      if (statusFilter) result = result.filter((t) => t.status === statusFilter);
      if (assigneeFilter) result = result.filter((t) => t.assignee === assigneeFilter);

      result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/collab/tasks — create task
  app.post('/api/collab/tasks', async (c) => {
    try {
      const collabDir = getCollabDir();
      const tasksDir = join(collabDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      const body = await c.req.json<{
        title?: string;
        description?: string;
        priority?: string;
        reporter?: string;
        tags?: string[];
      }>();

      const title = (body.title || '').trim();
      if (!title) return c.json({ error: 'title is required' }, 400);

      // Auto-increment task ID
      const counterPath = join(tasksDir, '.counter');
      let nextNum = 1;
      if (existsSync(counterPath)) {
        const raw = readFileSync(counterPath, 'utf-8').trim();
        nextNum = parseInt(raw, 10) + 1;
      }
      const taskId = `TASK-${String(nextNum).padStart(3, '0')}`;

      const now = new Date().toISOString();
      const task: CollabTask = {
        id: taskId,
        title,
        description: body.description || '',
        status: 'open',
        priority: (body.priority as CollabTask['priority']) || 'medium',
        assignee: null,
        reporter: body.reporter || '',
        tags: body.tags || [],
        check_log: [],
        created_at: now,
        updated_at: now,
      };

      writeFileSync(join(tasksDir, `${taskId}.json`), JSON.stringify(task, null, 2));
      writeFileSync(counterPath, String(nextNum));

      // Log activity
      const activityPath = join(collabDir, 'activity.jsonl');
      const actEntry = JSON.stringify({ ts: now, user: task.reporter, host: hostname(), action: 'task_create', task_id: taskId, target: title }) + '\n';
      const existing = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
      writeFileSync(activityPath, existing + actEntry);

      return c.json(task, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/tasks/:id — single task
  app.get('/api/collab/tasks/:id', async (c) => {
    try {
      const taskId = c.req.param('id');
      const taskPath = join(getCollabDir(), 'tasks', `${taskId}.json`);
      const data = readJsonSafe(taskPath);
      if (!data) return c.json({ error: `Task "${taskId}" not found` }, 404);
      return c.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // PATCH /api/collab/tasks/:id — update (status transition validation)
  app.patch('/api/collab/tasks/:id', async (c) => {
    try {
      const taskId = c.req.param('id');
      const collabDir = getCollabDir();
      const taskPath = join(collabDir, 'tasks', `${taskId}.json`);
      const existing = readJsonSafe(taskPath);
      if (!existing) return c.json({ error: `Task "${taskId}" not found` }, 404);

      const body = await c.req.json<Partial<Pick<CollabTask, 'title' | 'description' | 'status' | 'priority' | 'tags'>>>();

      // Validate status transition
      if (body.status && body.status !== existing.status) {
        const allowed = COLLAB_TASK_TRANSITIONS[existing.status as CollabTaskStatus] ?? [];
        if (!allowed.includes(body.status as CollabTaskStatus)) {
          return c.json({ error: `Invalid transition: ${existing.status} → ${body.status}. Allowed: ${allowed.join(', ')}` }, 400);
        }
      }

      const now = new Date().toISOString();
      const updated = { ...existing, ...body, id: taskId, updated_at: now };
      writeFileSync(taskPath, JSON.stringify(updated, null, 2));

      // Log activity for status change
      if (body.status && body.status !== existing.status) {
        const activityPath = join(collabDir, 'activity.jsonl');
        const actEntry = JSON.stringify({ ts: now, user: '', host: hostname(), action: 'task_status', task_id: taskId, target: `${existing.status} → ${body.status}` }) + '\n';
        const log = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
        writeFileSync(activityPath, log + actEntry);
      }

      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/collab/tasks/:id/assign — assign + auto open→assigned
  app.post('/api/collab/tasks/:id/assign', async (c) => {
    try {
      const taskId = c.req.param('id');
      const collabDir = getCollabDir();
      const taskPath = join(collabDir, 'tasks', `${taskId}.json`);
      const existing = readJsonSafe(taskPath);
      if (!existing) return c.json({ error: `Task "${taskId}" not found` }, 404);

      const body = await c.req.json<{ assignee?: string }>();
      const assignee = body.assignee || null;
      const now = new Date().toISOString();

      // Auto transition open→assigned when assigning
      let newStatus = existing.status as string;
      if (assignee && existing.status === 'open') {
        newStatus = 'assigned';
      } else if (!assignee && existing.status === 'assigned') {
        newStatus = 'open';
      }

      const updated = { ...existing, assignee, status: newStatus, updated_at: now };
      writeFileSync(taskPath, JSON.stringify(updated, null, 2));

      // Log activity
      const activityPath = join(collabDir, 'activity.jsonl');
      const actEntry = JSON.stringify({ ts: now, user: '', host: hostname(), action: 'task_assign', task_id: taskId, target: assignee || 'unassigned' }) + '\n';
      const log = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
      writeFileSync(activityPath, log + actEntry);

      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/collab/tasks/:id/check — append check entry
  app.post('/api/collab/tasks/:id/check', async (c) => {
    try {
      const taskId = c.req.param('id');
      const collabDir = getCollabDir();
      const taskPath = join(collabDir, 'tasks', `${taskId}.json`);
      const existing = readJsonSafe(taskPath);
      if (!existing) return c.json({ error: `Task "${taskId}" not found` }, 404);

      const body = await c.req.json<{ action?: string; author?: string; comment?: string }>();
      const checkEntry: CollabCheckEntry = {
        action: (body.action as CollabCheckEntry['action']) || 'comment',
        author: body.author || '',
        comment: body.comment || '',
        ts: new Date().toISOString(),
      };

      const checkLog = Array.isArray(existing.check_log) ? existing.check_log : [];
      checkLog.push(checkEntry);

      const now = new Date().toISOString();
      const updated = { ...existing, check_log: checkLog, updated_at: now };
      writeFileSync(taskPath, JSON.stringify(updated, null, 2));

      // Log activity
      const activityPath = join(collabDir, 'activity.jsonl');
      const actEntry = JSON.stringify({ ts: now, user: checkEntry.author, host: hostname(), action: 'task_check', task_id: taskId, target: checkEntry.action }) + '\n';
      const log = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
      writeFileSync(activityPath, log + actEntry);

      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // DELETE /api/collab/tasks/:id — delete task
  app.delete('/api/collab/tasks/:id', async (c) => {
    try {
      const taskId = c.req.param('id');
      const collabDir = getCollabDir();
      const taskPath = join(collabDir, 'tasks', `${taskId}.json`);
      if (!existsSync(taskPath)) return c.json({ error: `Task "${taskId}" not found` }, 404);

      const { unlinkSync } = await import('node:fs');
      unlinkSync(taskPath);

      // Log activity
      const now = new Date().toISOString();
      const activityPath = join(collabDir, 'activity.jsonl');
      const actEntry = JSON.stringify({ ts: now, user: '', host: hostname(), action: 'task_delete', task_id: taskId }) + '\n';
      const log = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
      writeFileSync(activityPath, log + actEntry);

      return c.json({ success: true, id: taskId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/collab/join — join team using git identity
  app.post('/api/collab/join', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');
      if (!existsSync(membersDir)) {
        return c.json({ error: 'Collab not initialized' }, 400);
      }

      const uid = userInfo().username || 'user';
      const memberPath = join(membersDir, `${uid}.json`);
      if (existsSync(memberPath)) {
        // Already a member — update lastSeen
        const existing = readJsonSafe(memberPath);
        return c.json({ success: true, uid, member: existing, message: 'Already a member' });
      }

      const now = new Date().toISOString();
      const memberData = {
        uid,
        name: uid,
        email: '',
        role: 'member',
        host: hostname(),
        joinedAt: now,
      };
      writeFileSync(memberPath, JSON.stringify(memberData, null, 2));

      // Log join activity
      const activityPath = join(collabDir, 'activity.jsonl');
      const entry = JSON.stringify({ ts: now, user: uid, host: hostname(), action: 'join' }) + '\n';
      const existing = existsSync(activityPath) ? readFileSync(activityPath, 'utf-8') : '';
      writeFileSync(activityPath, existing + entry);

      return c.json({ success: true, uid, member: memberData });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/collab/whoami — return current user member record or null
  app.get('/api/collab/whoami', async (c) => {
    try {
      const collabDir = getCollabDir();
      const membersDir = join(collabDir, 'members');
      if (!existsSync(membersDir)) return c.json(null);

      const uid = userInfo().username || 'user';
      const memberPath = join(membersDir, `${uid}.json`);
      const data = readJsonSafe(memberPath);
      return c.json(data ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
