import type { ToolRegistry } from '../core/tool-registry.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSpecs } from './spec-loader.js';
import { initSpecSystem } from './spec-init.js';
import type { SpecCategory } from './spec-index-builder.js';
import {
  BRIDGE_PREFIX,
  AUTO_COMPACT_BUFFER_PCT,
  FACES,
  getFaceLevel,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
} from '../hooks/constants.js';

export function registerBuiltinTools(registry: ToolRegistry): void {
  registry.register({
    name: 'read_file',
    description: 'Read file contents from the filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative file path' },
      },
      required: ['path'],
    },
    async handler(input) {
      const path = input.path as string;
      if (!existsSync(path)) {
        return { content: [{ type: 'text', text: `File not found: ${path}` }], isError: true };
      }
      const text = readFileSync(path, 'utf-8');
      return { content: [{ type: 'text', text }] };
    },
  });

  registry.register({
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
    async handler(input) {
      writeFileSync(input.path as string, input.content as string, 'utf-8');
      return { content: [{ type: 'text', text: `Written to ${input.path}` }] };
    },
  });

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
    description: 'Load project specs filtered by category and keywords',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Project root path' },
        category: { type: 'string', description: 'Filter: general|exploration|planning|execution|debug|test|review|validation' },
        keywords: { type: 'string', description: 'Space-separated keywords for matching' },
      },
      required: ['projectPath'],
    },
    async handler(input) {
      const keywords = typeof input.keywords === 'string'
        ? (input.keywords as string).split(/\s+/).filter(Boolean)
        : undefined;
      const result = loadSpecs({
        projectPath: input.projectPath as string,
        category: input.category as SpecCategory | undefined,
        keywords,
        outputFormat: 'cli',
      });
      return { content: [{ type: 'text', text: result.content }] };
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
      // Try to find the most recent bridge file if no session_id provided
      const tmp = tmpdir();
      let metrics: { remaining_percentage: number; used_pct: number; timestamp: number } | null = null;

      if (input.session_id) {
        const bridgePath = join(tmp, `${BRIDGE_PREFIX}${input.session_id}.json`);
        if (existsSync(bridgePath)) {
          metrics = JSON.parse(readFileSync(bridgePath, 'utf8'));
        }
      } else {
        // Scan for most recent bridge file
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
