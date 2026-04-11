import type { ToolRegistry } from '../core/tool-registry.js';
import type { ToolResult } from '../types/index.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CliHistoryStore, type EntryLike, type ExecutionMeta } from '../agents/cli-history-store.js';
import { DelegateBrokerClient } from '../async/index.js';
import { launchDetachedDelegateWorker, type DelegateExecutionRequest } from '../commands/delegate.js';
import { handleDelegateMessage, toSep1686Status } from '../async/delegate-control.js';
import { loadSpecs, type SpecCategory } from './spec-loader.js';
import { initSpecSystem } from './spec-init.js';
import {
  BRIDGE_PREFIX,
  AUTO_COMPACT_BUFFER_PCT,
  FACES,
  getFaceLevel,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
} from '../hooks/constants.js';
import { ccwResultToMcp } from '../types/tool-schema.js';
import {
  deriveDelegateStatus,
  readExecutionEntries,
  summarizeBrokerEventStructured,
} from '../utils/cli-format.js';

// CCW-style tool modules (schema + handler exports)
import * as editFileTool from './edit-file.js';
import * as writeFileTool from './write-file.js';
import * as readFileTool from './read-file.js';
import * as readManyFilesTool from './read-many-files.js';
import * as teamMsgTool from './team-msg.js';
import * as coreMemoryTool from './core-memory.js';

function jsonResult(payload: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function summarizeHistoryEntry(entry: EntryLike): Record<string, unknown> {
  return {
    type: entry.type,
    status: entry.status ?? null,
    name: entry.name ?? null,
    content: entry.type === 'assistant_message'
      ? String(entry.content ?? '').slice(0, 160)
      : null,
    message: entry.type === 'error'
      ? String(entry.message ?? '')
      : null,
  };
}

function summarizeQueuedMessage(message: {
  messageId: string;
  createdAt: string;
  delivery: string;
  message: string;
  status: string;
  requestedBy?: string;
  dispatchedAt?: string;
  dispatchReason?: string;
}): Record<string, unknown> {
  return {
    messageId: message.messageId,
    createdAt: message.createdAt,
    delivery: message.delivery,
    status: message.status,
    requestedBy: message.requestedBy ?? null,
    dispatchedAt: message.dispatchedAt ?? null,
    dispatchReason: message.dispatchReason ?? null,
    preview: message.message.slice(0, 160),
  };
}

type BuiltinToolDependencies = {
  launchDetachedDelegate?: (request: DelegateExecutionRequest) => void;
};

/**
 * Register a CCW-style tool (with schema + handler exports) into the maestro registry.
 * Adapts CCW's { success, result, error } format to maestro's { content, isError } format.
 */
function registerCcwTool(
  registry: ToolRegistry,
  mod: { schema: { name: string; description: string; inputSchema: Record<string, unknown> }; handler: (params: Record<string, unknown>) => Promise<any> },
): void {
  registry.register({
    name: mod.schema.name,
    description: mod.schema.description,
    inputSchema: mod.schema.inputSchema,
    async handler(input: Record<string, unknown>): Promise<ToolResult> {
      const ccwResult = await mod.handler(input);
      return ccwResultToMcp(ccwResult);
    },
  });
}

export function registerBuiltinTools(
  registry: ToolRegistry,
  dependencies: BuiltinToolDependencies = {},
): void {
  // --- CCW-ported tools (modular) ---
  registerCcwTool(registry, editFileTool);
  registerCcwTool(registry, writeFileTool);
  registerCcwTool(registry, readFileTool);
  registerCcwTool(registry, readManyFilesTool);
  registerCcwTool(registry, teamMsgTool);
  registerCcwTool(registry, coreMemoryTool);

  const historyStore = new CliHistoryStore();
  const delegateBroker = new DelegateBrokerClient();
  const launchDelegate = dependencies.launchDetachedDelegate ?? launchDetachedDelegateWorker;

  // --- Maestro-native tools (inline) ---

  registry.register({
    name: 'list_tools',
    description: 'List all available tools in the registry',
    inputSchema: { type: 'object', properties: {} },
    async handler() {
      const tools = registry.list();
      const summary = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
      return { content: [{ type: 'text', text: summary }] };
    },
  });

  registry.register({
    name: 'spec_load',
    description: 'Load project specs filtered by category',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Project root path' },
        category: { type: 'string', description: 'Filter: general|planning|execution|debug|test|review|validation' },
      },
      required: ['projectPath'],
    },
    async handler(input) {
      const result = loadSpecs(
        input.projectPath as string,
        input.category as SpecCategory | undefined,
      );
      return { content: [{ type: 'text', text: result.content || '(No specs found)' }] };
    },
  });

  registry.register({
    name: 'context_status',
    description:
      'Check current context window usage. Returns used%, remaining%, ASCII face indicator, and warning level. ' +
      'Use this to proactively monitor context consumption during long tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Claude Code session ID (reads bridge file from statusline hook)' },
      },
    },
    async handler(input) {
      const tmp = tmpdir();
      let metrics: { remaining_percentage: number; used_pct: number; timestamp: number } | null = null;

      if (input.session_id) {
        const bridgePath = join(tmp, `${BRIDGE_PREFIX}${input.session_id}.json`);
        if (existsSync(bridgePath)) {
          metrics = JSON.parse(readFileSync(bridgePath, 'utf8'));
        }
      } else {
        try {
          const files = readdirSync(tmp)
            .filter((f) => f.startsWith(BRIDGE_PREFIX) && f.endsWith('.json') && !f.includes('-warned'))
            .map((f) => ({ name: f, path: join(tmp, f) }));

          let newest: { path: string; timestamp: number } | null = null;
          for (const f of files) {
            try {
              const data = JSON.parse(readFileSync(f.path, 'utf8'));
              if (!newest || data.timestamp > newest.timestamp) {
                newest = { path: f.path, timestamp: data.timestamp };
              }
            } catch { /* skip corrupted */ }
          }
          if (newest) {
            metrics = JSON.parse(readFileSync(newest.path, 'utf8'));
          }
        } catch { /* no bridge files */ }
      }

      if (!metrics) {
        return {
          content: [{ type: 'text', text: 'No context metrics available. Statusline hook may not be active.' }],
        };
      }

      const { used_pct: usedPct, remaining_percentage: remaining } = metrics;
      const level = getFaceLevel(usedPct);
      const face = FACES[level];
      const staleSeconds = Math.floor(Date.now() / 1000) - metrics.timestamp;

      let warning = 'none';
      if (remaining <= CRITICAL_THRESHOLD) warning = 'CRITICAL';
      else if (remaining <= WARNING_THRESHOLD) warning = 'WARNING';

      const text = [
        `Context: ${face}  Used: ${usedPct}%  Remaining: ${remaining}%`,
        `Warning level: ${warning}`,
        `Data age: ${staleSeconds}s ago`,
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    },
  });

  registry.register({
    name: 'delegate_message',
    description: 'Queue or dispatch a follow-up message for an async delegate using inject or after_complete delivery.',
    inputSchema: {
      type: 'object',
      properties: {
        execId: { type: 'string', description: 'Delegate execution/job ID' },
        message: { type: 'string', description: 'Follow-up user message to queue' },
        delivery: {
          type: 'string',
          enum: ['inject', 'after_complete'],
          description: 'inject auto-routes: uses streaming stdin injection for interactive adapters (claude), falls back to cancel+resume for others (gemini, codex); after_complete waits for successful completion.',
        },
      },
      required: ['execId', 'message', 'delivery'],
    },
    async handler(input) {
      const execId = String(input.execId ?? '').trim();
      const message = String(input.message ?? '').trim();
      const delivery = String(input.delivery ?? '').trim();
      if (!execId) {
        return jsonResult({ error: 'execId is required' }, true);
      }
      if (!message) {
        return jsonResult({ error: 'message is required' }, true);
      }
      if (delivery !== 'inject' && delivery !== 'after_complete') {
        return jsonResult({ error: 'delivery must be inject or after_complete' }, true);
      }

      const meta = historyStore.loadMeta(execId);
      const job = delegateBroker.getJob(execId);
      if (!meta && !job) {
        return jsonResult({ error: `Delegate execution not found: ${execId}` }, true);
      }
      if (!job) {
        return jsonResult({ error: `Delegate broker state unavailable for: ${execId}` }, true);
      }

      let result;
      try {
        result = handleDelegateMessage({
          execId,
          message,
          delivery: delivery as 'inject' | 'after_complete',
          requestedBy: 'mcp:delegate_message',
        }, {
          historyStore,
          delegateBroker,
          launchDetachedDelegate: launchDelegate,
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        return jsonResult({ error: messageText }, true);
      }

      return jsonResult({
        execId: result.execId,
        accepted: result.accepted,
        delivery: result.delivery,
        status: result.status,
        queuedMessage: summarizeQueuedMessage(result.queuedMessage),
        immediateDispatch: result.immediateDispatch,
        previousStatus: result.previousStatus,
        queueDepth: result.queueDepth,
        tools: {
          status: 'delegate_status',
          tail: 'delegate_tail',
          messages: 'delegate_messages',
          cancel: 'delegate_cancel',
        },
      });
    },
  });

  registry.register({
    name: 'delegate_messages',
    description: 'Inspect queued and dispatched follow-up messages for an async delegate execution.',
    inputSchema: {
      type: 'object',
      properties: {
        execId: { type: 'string', description: 'Delegate execution/job ID' },
      },
      required: ['execId'],
    },
    async handler(input) {
      const execId = String(input.execId ?? '').trim();
      if (!execId) {
        return jsonResult({ error: 'execId is required' }, true);
      }

      const meta = historyStore.loadMeta(execId);
      const job = delegateBroker.getJob(execId);
      if (!meta && !job) {
        return jsonResult({ error: `Delegate execution not found: ${execId}` }, true);
      }

      const messages = delegateBroker.listMessages(execId).map(summarizeQueuedMessage);
      return jsonResult({
        execId,
        status: deriveDelegateStatus(meta, job),
        messages,
      });
    },
  });

  registry.register({
    name: 'delegate_status',
    description: 'Inspect async delegate job status using broker snapshots plus CLI history metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        execId: { type: 'string', description: 'Delegate execution/job ID' },
        eventLimit: { type: 'number', description: 'How many recent broker events to include', default: 5 },
      },
      required: ['execId'],
    },
    async handler(input) {
      const execId = String(input.execId ?? '').trim();
      if (!execId) {
        return jsonResult({ error: 'execId is required' }, true);
      }

      const meta = historyStore.loadMeta(execId);
      const job = delegateBroker.getJob(execId);

      if (!meta && !job) {
        return jsonResult({ error: `Delegate execution not found: ${execId}` }, true);
      }

      const eventLimit = typeof input.eventLimit === 'number' ? Math.max(1, Math.floor(input.eventLimit)) : 5;
      const recentEvents = delegateBroker
        .listJobEvents(execId)
        .slice(-eventLimit)
        .map(summarizeBrokerEventStructured);

      const currentStatus = deriveDelegateStatus(meta, job);

      return jsonResult({
        execId,
        status: currentStatus,
        sep1686_status: toSep1686Status(currentStatus),
        meta: meta
          ? {
              tool: meta.tool,
              model: meta.model ?? null,
              mode: meta.mode,
              workDir: meta.workDir,
              startedAt: meta.startedAt,
              completedAt: meta.completedAt ?? null,
              exitCode: meta.exitCode ?? null,
            }
          : null,
        job: job
          ? {
              status: job.status,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt,
              lastEventType: job.lastEventType,
              lastEventId: job.lastEventId,
              latestSnapshot: job.latestSnapshot,
              metadata: job.metadata ?? null,
            }
          : null,
        queuedMessages: delegateBroker.listMessages(execId).map(summarizeQueuedMessage),
        recentEvents,
        tools: {
          message: 'delegate_message',
          messages: 'delegate_messages',
          output: 'delegate_output',
          tail: 'delegate_tail',
          cancel: 'delegate_cancel',
        },
      });
    },
  });

  registry.register({
    name: 'delegate_output',
    description: 'Get the persisted assistant output for an async delegate execution.',
    inputSchema: {
      type: 'object',
      properties: {
        execId: { type: 'string', description: 'Delegate execution/job ID' },
      },
      required: ['execId'],
    },
    async handler(input) {
      const execId = String(input.execId ?? '').trim();
      if (!execId) {
        return jsonResult({ error: 'execId is required' }, true);
      }

      const meta = historyStore.loadMeta(execId);
      if (!meta) {
        return jsonResult({ error: `Delegate execution not found: ${execId}` }, true);
      }

      const output = historyStore.getOutput(execId);
      if (!output) {
        return jsonResult({ error: `No output available for: ${execId}` }, true);
      }

      return jsonResult({
        execId,
        status: deriveDelegateStatus(meta, delegateBroker.getJob(execId)),
        meta: {
          tool: meta.tool,
          model: meta.model ?? null,
          mode: meta.mode,
          startedAt: meta.startedAt,
          completedAt: meta.completedAt ?? null,
          exitCode: meta.exitCode ?? null,
        },
        output,
      });
    },
  });

  registry.register({
    name: 'delegate_tail',
    description: 'Get recent broker events for an async delegate execution.',
    inputSchema: {
      type: 'object',
      properties: {
        execId: { type: 'string', description: 'Delegate execution/job ID' },
        limit: { type: 'number', description: 'Maximum number of events to include', default: 10 },
      },
      required: ['execId'],
    },
    async handler(input) {
      const execId = String(input.execId ?? '').trim();
      if (!execId) {
        return jsonResult({ error: 'execId is required' }, true);
      }

      const limit = typeof input.limit === 'number' ? Math.max(1, Math.floor(input.limit)) : 10;
      const meta = historyStore.loadMeta(execId);
      const events = delegateBroker.listJobEvents(execId);

      if (!meta && events.length === 0) {
        return jsonResult({ error: `Delegate execution not found: ${execId}` }, true);
      }

      const entries = readExecutionEntries(historyStore, execId).slice(-limit).map(summarizeHistoryEntry);

      return jsonResult({
        execId,
        status: deriveDelegateStatus(meta, delegateBroker.getJob(execId)),
        events: events.slice(-limit).map(summarizeBrokerEventStructured),
        historyTail: entries,
        queuedMessages: delegateBroker.listMessages(execId).map(summarizeQueuedMessage),
      });
    },
  });

  registry.register({
    name: 'delegate_cancel',
    description: 'Request cancellation for an async delegate execution and return the resulting broker state.',
    inputSchema: {
      type: 'object',
      properties: {
        execId: { type: 'string', description: 'Delegate execution/job ID' },
      },
      required: ['execId'],
    },
    async handler(input) {
      const execId = String(input.execId ?? '').trim();
      if (!execId) {
        return jsonResult({ error: 'execId is required' }, true);
      }

      const meta = historyStore.loadMeta(execId);
      const job = delegateBroker.getJob(execId);

      if (!meta && !job) {
        return jsonResult({ error: `Delegate execution not found: ${execId}` }, true);
      }

      const currentStatus = deriveDelegateStatus(meta, job);
      if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'cancelled') {
        return jsonResult({
          execId,
          supported: true,
          cancelled: currentStatus === 'cancelled',
          status: currentStatus,
          message: `Delegate job is already ${currentStatus}.`,
          tools: {
            status: 'delegate_status',
            tail: 'delegate_tail',
            output: 'delegate_output',
          },
        });
      }

      const updatedJob = delegateBroker.requestCancel({
        jobId: execId,
        requestedBy: 'mcp:delegate_cancel',
      });

      return jsonResult({
        execId,
        supported: true,
        cancelled: false,
        status: deriveDelegateStatus(meta, updatedJob),
        message: 'Cancellation requested. Use delegate_status or delegate_tail to follow shutdown progress.',
        job: {
          status: updatedJob.status,
          updatedAt: updatedJob.updatedAt,
          lastEventType: updatedJob.lastEventType,
          metadata: updatedJob.metadata ?? null,
        },
        tools: {
          status: 'delegate_status',
          tail: 'delegate_tail',
          output: 'delegate_output',
        },
      });
    },
  });

  registry.register({
    name: 'spec_init',
    description: 'Initialize spec system with seed documents',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Project root path' },
      },
      required: ['projectPath'],
    },
    async handler(input) {
      const result = initSpecSystem(input.projectPath as string);
      const summary = [
        `Directories: ${result.directories.length} created`,
        `Files: ${result.created.length} created, ${result.skipped.length} skipped`,
      ].join('\n');
      return { content: [{ type: 'text', text: summary }] };
    },
  });
}
