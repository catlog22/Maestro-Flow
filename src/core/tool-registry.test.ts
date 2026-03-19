import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './tool-registry.js';
import type { Tool, ToolResult } from '../types/index.js';

function makeTool(name: string, handler?: Tool['handler']): Tool {
  return {
    name,
    description: `Test tool: ${name}`,
    inputSchema: {},
    handler: handler ?? (async () => ({
      content: [{ type: 'text', text: `${name} result` }],
    })),
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('registers a tool', () => {
      const tool = makeTool('test-tool');
      registry.register(tool);
      expect(registry.get('test-tool')).toBe(tool);
    });

    it('throws on duplicate registration', () => {
      registry.register(makeTool('dup'));
      expect(() => registry.register(makeTool('dup'))).toThrow(
        'Tool "dup" is already registered',
      );
    });
  });

  describe('unregister', () => {
    it('removes a registered tool', () => {
      registry.register(makeTool('rm'));
      expect(registry.unregister('rm')).toBe(true);
      expect(registry.get('rm')).toBeUndefined();
    });

    it('returns false for non-existent tool', () => {
      expect(registry.unregister('nope')).toBe(false);
    });
  });

  describe('get', () => {
    it('returns undefined for unknown tool', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('returns the registered tool', () => {
      const tool = makeTool('findme');
      registry.register(tool);
      expect(registry.get('findme')).toBe(tool);
    });
  });

  describe('list', () => {
    it('returns empty array when no tools registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('returns all registered tools', () => {
      registry.register(makeTool('a'));
      registry.register(makeTool('b'));
      const names = registry.list().map((t) => t.name);
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toHaveLength(2);
    });
  });

  describe('execute', () => {
    it('executes a registered tool handler', async () => {
      registry.register(
        makeTool('exec', async (input) => ({
          content: [{ type: 'text', text: `got: ${JSON.stringify(input)}` }],
        })),
      );
      const result = await registry.execute('exec', { key: 'value' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('key');
    });

    it('returns error for unknown tool', async () => {
      const result = await registry.execute('missing', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool: missing');
    });
  });
});
