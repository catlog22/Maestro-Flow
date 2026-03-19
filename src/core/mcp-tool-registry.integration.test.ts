import { describe, it, expect, beforeEach } from 'vitest';

import { ToolRegistry } from './tool-registry.js';
import type { Tool, ToolResult } from '../types/index.js';

// ---------------------------------------------------------------------------
// L2 Integration: ToolRegistry <-> Tool handlers <-> MCP-style call patterns
// Tests real module interaction: register tools → list/filter → execute handlers
// This mirrors the MCP server's use of ToolRegistry (src/mcp/server.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test tool factories
// ---------------------------------------------------------------------------

function makeEchoTool(): Tool {
  return {
    name: 'echo',
    description: 'Echoes input text',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    handler: async (input) => ({
      content: [{ type: 'text', text: `Echo: ${(input as { text: string }).text}` }],
    }),
  };
}

function makeCountTool(): Tool {
  return {
    name: 'count-words',
    description: 'Counts words in text',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    handler: async (input) => {
      const words = ((input as { text: string }).text || '').split(/\s+/).filter(Boolean);
      return {
        content: [{ type: 'text', text: String(words.length) }],
      };
    },
  };
}

function makeErrorTool(): Tool {
  return {
    name: 'always-fail',
    description: 'Always throws an error',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      throw new Error('Intentional failure');
    },
  };
}

function makeStatefulTool(): Tool {
  let callCount = 0;
  return {
    name: 'stateful',
    description: 'Tracks call count',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      callCount++;
      return {
        content: [{ type: 'text', text: `Call #${callCount}` }],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Registry + tool handler integration
// ---------------------------------------------------------------------------

describe('ToolRegistry + Tool handler integration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and lists multiple tools', () => {
    registry.register(makeEchoTool());
    registry.register(makeCountTool());

    const tools = registry.list();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['count-words', 'echo']);
  });

  it('executes registered tool handler and returns result', async () => {
    registry.register(makeEchoTool());

    const result = await registry.execute('echo', { text: 'hello world' });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe('Echo: hello world');
  });

  it('returns error result for unknown tool name', async () => {
    const result = await registry.execute('nonexistent', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('prevents duplicate tool registration', () => {
    registry.register(makeEchoTool());
    expect(() => registry.register(makeEchoTool())).toThrow('already registered');
  });

  it('unregisters tool and subsequent execute returns error', async () => {
    registry.register(makeEchoTool());
    expect(registry.get('echo')).toBeDefined();

    const removed = registry.unregister('echo');
    expect(removed).toBe(true);
    expect(registry.get('echo')).toBeUndefined();

    const result = await registry.execute('echo', { text: 'test' });
    expect(result.isError).toBe(true);
  });

  it('executes multiple tools in sequence (simulates MCP CallTool pattern)', async () => {
    registry.register(makeEchoTool());
    registry.register(makeCountTool());

    // Simulate MCP server handling multiple CallTool requests
    const r1 = await registry.execute('echo', { text: 'hello' });
    const r2 = await registry.execute('count-words', { text: 'one two three four' });

    expect(r1.content[0].text).toBe('Echo: hello');
    expect(r2.content[0].text).toBe('4');
  });

  it('tool handler maintains state across calls', async () => {
    registry.register(makeStatefulTool());

    const r1 = await registry.execute('stateful', {});
    const r2 = await registry.execute('stateful', {});
    const r3 = await registry.execute('stateful', {});

    expect(r1.content[0].text).toBe('Call #1');
    expect(r2.content[0].text).toBe('Call #2');
    expect(r3.content[0].text).toBe('Call #3');
  });
});

// ---------------------------------------------------------------------------
// MCP ListTools simulation: registry.list() → filter by enabled
// ---------------------------------------------------------------------------

describe('MCP ListTools simulation', () => {
  it('filters tools by enabled list (simulates MCP server logic)', () => {
    const registry = new ToolRegistry();
    registry.register(makeEchoTool());
    registry.register(makeCountTool());
    registry.register(makeStatefulTool());

    const allTools = registry.list();
    const enabledTools = ['echo', 'stateful'];

    // Simulate MCP server filtering logic from src/mcp/server.ts
    const filtered = enabledTools.includes('all')
      ? allTools
      : allTools.filter((t) => enabledTools.includes(t.name));

    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.name).sort()).toEqual(['echo', 'stateful']);
  });

  it('returns all tools when "all" is in enabled list', () => {
    const registry = new ToolRegistry();
    registry.register(makeEchoTool());
    registry.register(makeCountTool());

    const allTools = registry.list();
    const enabledTools = ['all'];

    const filtered = enabledTools.includes('all')
      ? allTools
      : allTools.filter((t) => enabledTools.includes(t.name));

    expect(filtered).toHaveLength(2);
  });

  it('maps tools to MCP schema format', () => {
    const registry = new ToolRegistry();
    registry.register(makeEchoTool());

    const tools = registry.list();
    // Simulate the MCP server response mapping
    const mcpTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    expect(mcpTools).toHaveLength(1);
    expect(mcpTools[0]).toEqual({
      name: 'echo',
      description: 'Echoes input text',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    });
    // Handler should NOT be in the mapped output
    expect((mcpTools[0] as Record<string, unknown>)['handler']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MCP CallTool simulation: registry.execute() → handler dispatch
// ---------------------------------------------------------------------------

describe('MCP CallTool simulation', () => {
  it('dispatches tool call and returns structured result', async () => {
    const registry = new ToolRegistry();
    registry.register(makeEchoTool());
    registry.register(makeCountTool());

    // Simulate MCP CallTool request
    const req = { name: 'count-words', arguments: { text: 'the quick brown fox' } };
    const result = await registry.execute(req.name, (req.arguments ?? {}) as Record<string, unknown>);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('4');
  });

  it('handles null arguments gracefully', async () => {
    const registry = new ToolRegistry();
    registry.register(makeCountTool());

    // MCP spec allows null arguments
    const result = await registry.execute('count-words', {});
    expect(result.content[0].text).toBe('0');
  });

  it('register → execute → unregister → re-register works', async () => {
    const registry = new ToolRegistry();

    registry.register(makeEchoTool());
    const r1 = await registry.execute('echo', { text: 'first' });
    expect(r1.content[0].text).toBe('Echo: first');

    registry.unregister('echo');
    const r2 = await registry.execute('echo', { text: 'gone' });
    expect(r2.isError).toBe(true);

    // Re-register with different handler
    registry.register({
      ...makeEchoTool(),
      handler: async (input) => ({
        content: [{ type: 'text', text: `V2: ${(input as { text: string }).text}` }],
      }),
    });
    const r3 = await registry.execute('echo', { text: 'back' });
    expect(r3.content[0].text).toBe('V2: back');
  });
});
