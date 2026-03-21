// ---------------------------------------------------------------------------
// Team Session REST API routes -- read-only access to .workflow/.team/ data
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, normalize } from 'node:path';

import type {
  TeamSessionSummary,
  TeamSessionDetail,
  TeamMessage,
  PipelineNode,
  TeamRole,
  SessionFileEntry,
} from '../../shared/team-types.js';
import { inferSkill } from '../../shared/team-types.js';

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

function countLines(filePath: string): number {
  try {
    if (!existsSync(filePath)) return 0;
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return 0;
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function buildSummary(sessionId: string, sessionDir: string): TeamSessionSummary | null {
  const sessionPath = join(sessionDir, 'team-session.json');
  const metaPath = join(sessionDir, '.msg', 'meta.json');
  const messagesPath = join(sessionDir, '.msg', 'messages.jsonl');

  const sessionData = readJsonSafe(sessionPath) ?? {};
  const meta = readJsonSafe(metaPath) ?? {};

  const messageCount = countLines(messagesPath);

  // Extract roles
  const roles: string[] = [];
  if (Array.isArray(sessionData.roles)) {
    for (const r of sessionData.roles) {
      if (typeof r === 'string') roles.push(r);
      else if (r && typeof r === 'object' && 'name' in (r as object)) roles.push((r as { name: string }).name);
    }
  } else if (Array.isArray(meta.roles)) {
    roles.push(...(meta.roles as string[]));
  }

  // Extract pipeline stages
  const pipelineStages: PipelineNode[] = [];
  const stages = (sessionData.pipeline_stages || meta.pipeline_stages) as string[] | undefined;
  if (Array.isArray(stages)) {
    stages.forEach((name, i) => {
      pipelineStages.push({ id: `stage-${i}`, name: String(name), status: 'pending' });
    });
  }

  // Determine status
  const status = (meta.status as string) || 'active';

  // Timestamps
  const createdAt = (meta.created_at as string) || (sessionData.created_at as string) || '';
  const updatedAt = (meta.updated_at as string) || (sessionData.updated_at as string) || createdAt;

  // Duration
  let duration = '';
  if (createdAt) {
    const diffMs = (updatedAt ? new Date(updatedAt).getTime() : Date.now()) - new Date(createdAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) duration = `${mins}m`;
    else if (mins < 1440) duration = `${Math.floor(mins / 60)}h ${mins % 60}m`;
    else duration = `${Math.floor(mins / 1440)}d`;
  }

  // Task progress from role_state
  let completed = 0;
  let total = 0;
  if (meta.role_state && typeof meta.role_state === 'object') {
    for (const rs of Object.values(meta.role_state as Record<string, Record<string, unknown>>)) {
      if (rs.status === 'done') completed++;
      total++;
    }
  }

  return {
    sessionId,
    title: (sessionData.task_description as string) || (sessionData.team_name as string) || (meta.team_name as string) || sessionId,
    description: (sessionData.task_description as string) || '',
    status: (['active', 'completed', 'failed', 'archived'].includes(status) ? status : 'active') as TeamSessionSummary['status'],
    skill: inferSkill(sessionId),
    roles,
    taskProgress: { completed, total },
    messageCount,
    duration,
    createdAt,
    updatedAt,
    pipelineStages,
  };
}

function scanSessionFiles(sessionDir: string, sessionId: string): SessionFileEntry[] {
  const files: SessionFileEntry[] = [];
  let fileIdx = 0;

  const categoryDirs: { dir: string; category: SessionFileEntry['category'] }[] = [
    { dir: 'artifacts', category: 'artifacts' },
    { dir: 'wisdom', category: 'wisdom' },
    { dir: 'plan', category: 'role-specs' },
  ];

  for (const { dir, category } of categoryDirs) {
    const dirPath = join(sessionDir, dir);
    try {
      if (!existsSync(dirPath)) continue;
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        files.push({
          id: `file-${fileIdx++}`,
          path: `${dir}/${entry.name}`,
          name: entry.name,
          category,
        });
      }
    } catch {
      // skip unreadable directories
    }
  }

  // Add session-level files
  const sessionFiles = ['team-session.json', 'shared-memory.json'];
  for (const name of sessionFiles) {
    if (existsSync(join(sessionDir, name))) {
      files.push({
        id: `file-${fileIdx++}`,
        path: name,
        name,
        category: 'session',
      });
    }
  }

  // Add message bus files
  const msgDir = join(sessionDir, '.msg');
  if (existsSync(msgDir)) {
    try {
      const msgEntries = readdirSync(msgDir, { withFileTypes: true });
      for (const entry of msgEntries) {
        if (!entry.isFile()) continue;
        files.push({
          id: `file-${fileIdx++}`,
          path: `.msg/${entry.name}`,
          name: entry.name,
          category: 'message-bus',
        });
      }
    } catch {
      // skip
    }
  }

  return files;
}

function buildRoleDetails(sessionData: Record<string, unknown>, meta: Record<string, unknown>): TeamRole[] {
  const roleDetails: TeamRole[] = [];
  const roleState = (meta.role_state || {}) as Record<string, Record<string, unknown>>;

  // Get role names from session data or meta
  const roleNames: string[] = [];
  if (Array.isArray(sessionData.roles)) {
    for (const r of sessionData.roles) {
      if (typeof r === 'string') roleNames.push(r);
      else if (r && typeof r === 'object' && 'name' in (r as object)) roleNames.push((r as { name: string }).name);
    }
  } else if (Array.isArray(meta.roles)) {
    roleNames.push(...(meta.roles as string[]));
  } else {
    roleNames.push(...Object.keys(roleState));
  }

  for (const name of roleNames) {
    const rs = roleState[name] || {};
    const statusVal = (rs.status as string) || 'pending';
    roleDetails.push({
      name,
      prefix: name.substring(0, 3).toUpperCase(),
      status: (['done', 'active', 'pending', 'injected'].includes(statusVal) ? statusVal : 'pending') as TeamRole['status'],
      taskCount: typeof rs.task_count === 'number' ? rs.task_count : 0,
      innerLoop: rs.inner_loop === true,
      injected: rs.injected === true,
      injectionReason: typeof rs.injection_reason === 'string' ? rs.injection_reason : undefined,
    });
  }

  return roleDetails;
}

function buildPipelineWaves(sessionData: Record<string, unknown>, meta: Record<string, unknown>): { waves: { number: number; nodes: PipelineNode[] }[] } {
  const waves: { number: number; nodes: PipelineNode[] }[] = [];
  const stages = (sessionData.pipeline_stages || meta.pipeline_stages) as string[] | undefined;

  if (Array.isArray(stages)) {
    // Group into a single wave if no wave info available
    const nodes: PipelineNode[] = stages.map((name, i) => ({
      id: `stage-${i}`,
      name: String(name),
      status: 'pending' as PipelineNode['status'],
      wave: 0,
    }));
    waves.push({ number: 0, nodes });
  }

  return { waves };
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createTeamRoutes(workflowRoot: string | (() => string)): Hono {
  const app = new Hono();
  const getTeamDir = () => join(typeof workflowRoot === 'function' ? workflowRoot() : workflowRoot, '.team');

  // GET /api/teams/sessions
  app.get('/api/teams/sessions', async (c) => {
    try {
      const teamDir = getTeamDir();
      if (!existsSync(teamDir)) {
        return c.json([]);
      }

      const entries = readdirSync(teamDir, { withFileTypes: true });
      let summaries: TeamSessionSummary[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const sessionDir = join(teamDir, entry.name);
        const summary = buildSummary(entry.name, sessionDir);
        if (summary) summaries.push(summary);
      }

      // Sort by updatedAt descending
      summaries.sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      // Apply filters
      const statusFilter = c.req.query('status');
      if (statusFilter) {
        summaries = summaries.filter((s) => s.status === statusFilter);
      }

      const skillFilter = c.req.query('skill');
      if (skillFilter) {
        summaries = summaries.filter((s) => s.skill === skillFilter);
      }

      return c.json(summaries);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/teams/sessions/:sessionId
  app.get('/api/teams/sessions/:sessionId', async (c) => {
    try {
      const sessionId = c.req.param('sessionId');
      const sessionDir = join(getTeamDir(), sessionId);

      if (!existsSync(sessionDir)) {
        return c.json({ error: `Session not found: ${sessionId}` }, 404);
      }

      const summary = buildSummary(sessionId, sessionDir);
      if (!summary) {
        return c.json({ error: `Failed to read session: ${sessionId}` }, 500);
      }

      const sessionData = readJsonSafe(join(sessionDir, 'team-session.json')) ?? {};
      const meta = readJsonSafe(join(sessionDir, '.msg', 'meta.json')) ?? {};

      // Read last 50 messages
      const allMessages = readJsonlSafe(join(sessionDir, '.msg', 'messages.jsonl')) as unknown as TeamMessage[];
      const messages = allMessages.slice(-50);

      const roleDetails = buildRoleDetails(sessionData, meta);
      const pipeline = buildPipelineWaves(sessionData, meta);
      const files = scanSessionFiles(sessionDir, sessionId);

      const detail: TeamSessionDetail = {
        ...summary,
        roleDetails,
        messages,
        files,
        pipeline,
      };

      return c.json(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/teams/sessions/:sessionId/messages
  app.get('/api/teams/sessions/:sessionId/messages', async (c) => {
    try {
      const sessionId = c.req.param('sessionId');
      const sessionDir = join(getTeamDir(), sessionId);

      if (!existsSync(sessionDir)) {
        return c.json({ error: `Session not found: ${sessionId}` }, 404);
      }

      const messagesPath = join(sessionDir, '.msg', 'messages.jsonl');
      let messages = readJsonlSafe(messagesPath) as unknown as TeamMessage[];

      // Apply filters
      const fromFilter = c.req.query('from');
      if (fromFilter) {
        messages = messages.filter((m) => m.from === fromFilter);
      }

      const typeFilter = c.req.query('type');
      if (typeFilter) {
        messages = messages.filter((m) => m.type === typeFilter);
      }

      // Slice to last N
      const last = parseInt(c.req.query('last') || '50', 10);
      const limit = isNaN(last) || last <= 0 ? 50 : last;
      messages = messages.slice(-limit);

      return c.json(messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/teams/sessions/:sessionId/files/*
  app.get('/api/teams/sessions/:sessionId/files/*', async (c) => {
    try {
      const sessionId = c.req.param('sessionId');
      const sessionDir = join(getTeamDir(), sessionId);

      if (!existsSync(sessionDir)) {
        return c.json({ error: `Session not found: ${sessionId}` }, 404);
      }

      // Extract wildcard path
      const url = new URL(c.req.url);
      const prefix = `/api/teams/sessions/${sessionId}/files/`;
      const filePath = decodeURIComponent(url.pathname.slice(prefix.length));

      if (!filePath) {
        return c.json({ error: 'File path required' }, 400);
      }

      // Security: resolve and validate path stays within session directory
      const resolvedSession = resolve(sessionDir);
      const resolvedFile = resolve(sessionDir, filePath);
      const normalizedFile = normalize(resolvedFile);

      if (!normalizedFile.startsWith(resolvedSession)) {
        return c.json({ error: 'Access denied: path traversal detected' }, 403);
      }

      if (!existsSync(resolvedFile) || !statSync(resolvedFile).isFile()) {
        return c.json({ error: `File not found: ${filePath}` }, 404);
      }

      const content = readFileSync(resolvedFile, 'utf-8');

      // Return based on file extension
      if (filePath.endsWith('.json')) {
        try {
          return c.json(JSON.parse(content));
        } catch {
          return c.text(content);
        }
      }

      if (filePath.endsWith('.jsonl')) {
        try {
          const lines = content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
          return c.json(lines);
        } catch {
          return c.text(content);
        }
      }

      // Text files (.md, .txt, etc.)
      return c.text(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
