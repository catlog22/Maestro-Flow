import { describe, it, expect } from 'vitest';
import { selectTool } from './cli-tools-config.js';
import type { CliToolsConfig, ToolEntry } from './cli-tools-config.js';

function makeEntry(overrides: Partial<ToolEntry> = {}): ToolEntry {
  return {
    enabled: true,
    primaryModel: 'test-model',
    tags: [],
    type: 'builtin',
    ...overrides,
  };
}

function makeConfig(tools: Record<string, ToolEntry> = {}): CliToolsConfig {
  return { version: '1.0.0', tools };
}

describe('selectTool', () => {
  it('selects by exact name when enabled', () => {
    const config = makeConfig({
      gemini: makeEntry(),
      qwen: makeEntry(),
    });
    const result = selectTool('gemini', config);
    expect(result).toBeDefined();
    expect(result!.name).toBe('gemini');
  });

  it('returns undefined when named tool is disabled', () => {
    const config = makeConfig({
      gemini: makeEntry({ enabled: false }),
    });
    expect(selectTool('gemini', config)).toBeUndefined();
  });

  it('falls back to first enabled tool when name is undefined', () => {
    const config = makeConfig({
      disabled: makeEntry({ enabled: false }),
      fallback: makeEntry({ enabled: true }),
    });
    const result = selectTool(undefined, config);
    expect(result).toBeDefined();
    expect(result!.name).toBe('fallback');
  });

  it('returns undefined when no tools are enabled', () => {
    const config = makeConfig({
      a: makeEntry({ enabled: false }),
      b: makeEntry({ enabled: false }),
    });
    expect(selectTool(undefined, config)).toBeUndefined();
  });

  it('returns undefined for empty tools config', () => {
    expect(selectTool(undefined, makeConfig())).toBeUndefined();
  });

  it('falls back when named tool does not exist', () => {
    const config = makeConfig({
      existing: makeEntry(),
    });
    const result = selectTool('missing', config);
    expect(result).toBeDefined();
    expect(result!.name).toBe('existing');
  });
});
