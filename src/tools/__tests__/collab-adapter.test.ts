import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getAdaptersConfigPath,
  loadAdapterConfig,
  getEnabledAdapters,
  notifyAdapters,
  DingTalkAdapter,
  LinearAdapter,
} from '../collab-adapter.js';
import type { CollabEvent } from '../collab-adapter.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'collab-adapter-test-'));
  prevRoot = process.env.MAESTRO_PROJECT_ROOT;
  process.env.MAESTRO_PROJECT_ROOT = tmpDir;
}

function teardown(): void {
  if (prevRoot === undefined) {
    delete process.env.MAESTRO_PROJECT_ROOT;
  } else {
    process.env.MAESTRO_PROJECT_ROOT = prevRoot;
  }
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeAdapterConfig(config: Record<string, unknown>): void {
  const collabDir = join(tmpDir, '.workflow', 'collab');
  mkdirSync(collabDir, { recursive: true });
  writeFileSync(
    join(collabDir, 'adapters.json'),
    JSON.stringify(config),
    'utf-8',
  );
}

const SAMPLE_EVENT: CollabEvent = {
  type: 'task.created',
  payload: { actor: 'alice', task_title: 'Fix login bug' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collab-adapter', () => {
  describe('getAdaptersConfigPath', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('returns path under .workflow/collab/adapters.json', () => {
      const path = getAdaptersConfigPath();
      expect(path.endsWith(join('.workflow', 'collab', 'adapters.json'))).toBe(true);
    });
  });

  describe('loadAdapterConfig', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('returns empty enabled array when config file missing', () => {
      const config = loadAdapterConfig();
      expect(config.enabled).toEqual([]);
    });

    it('returns empty enabled array when file is not valid JSON', () => {
      const collabDir = join(tmpDir, '.workflow', 'collab');
      mkdirSync(collabDir, { recursive: true });
      writeFileSync(
        join(collabDir, 'adapters.json'),
        'not-json',
        'utf-8',
      );
      const config = loadAdapterConfig();
      expect(config.enabled).toEqual([]);
    });

    it('returns empty enabled array when enabled field is not an array', () => {
      writeAdapterConfig({ enabled: 'not-an-array' });
      const config = loadAdapterConfig();
      expect(config.enabled).toEqual([]);
    });

    it('parses a valid config file', () => {
      writeAdapterConfig({
        enabled: ['dingtalk'],
        dingtalk: { webhook: 'https://example.com', secret: 's3cret' },
      });
      const config = loadAdapterConfig();
      expect(config.enabled).toEqual(['dingtalk']);
    });
  });

  describe('DingTalkAdapter', () => {
    it('validateConfig returns true for valid config', () => {
      const adapter = new DingTalkAdapter();
      expect(
        adapter.validateConfig({ webhook: 'https://oapi.dingtalk.com/robot/send?access_token=abc', secret: 'SEC123' }),
      ).toBe(true);
    });

    it('validateConfig returns false when webhook is missing', () => {
      const adapter = new DingTalkAdapter();
      expect(adapter.validateConfig({ secret: 'SEC123' })).toBe(false);
    });

    it('validateConfig returns false when secret is missing', () => {
      const adapter = new DingTalkAdapter();
      expect(
        adapter.validateConfig({ webhook: 'https://example.com' }),
      ).toBe(false);
    });

    it('validateConfig returns false for empty strings', () => {
      const adapter = new DingTalkAdapter();
      expect(adapter.validateConfig({ webhook: '', secret: '' })).toBe(false);
    });
  });

  describe('LinearAdapter', () => {
    it('validateConfig returns true for valid config', () => {
      const adapter = new LinearAdapter();
      expect(
        adapter.validateConfig({ apiKey: 'lin_api_xxx', teamId: 'TEAM-001' }),
      ).toBe(true);
    });

    it('validateConfig returns false when apiKey is missing', () => {
      const adapter = new LinearAdapter();
      expect(adapter.validateConfig({ teamId: 'TEAM-001' })).toBe(false);
    });

    it('validateConfig returns false when teamId is missing', () => {
      const adapter = new LinearAdapter();
      expect(adapter.validateConfig({ apiKey: 'lin_api_xxx' })).toBe(false);
    });
  });

  describe('getEnabledAdapters', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('returns empty array when no adapters enabled', () => {
      expect(getEnabledAdapters({ enabled: [] })).toEqual([]);
    });

    it('skips unknown adapter names', () => {
      const adapters = getEnabledAdapters({ enabled: ['nonexistent'] });
      expect(adapters.length).toBe(0);
    });

    it('instantiates valid dingtalk adapter', () => {
      const adapters = getEnabledAdapters({
        enabled: ['dingtalk'],
        dingtalk: { webhook: 'https://example.com', secret: 's3cret' },
      });
      expect(adapters.length).toBe(1);
      expect(adapters[0].name).toBe('dingtalk');
    });

    it('instantiates valid linear adapter', () => {
      const adapters = getEnabledAdapters({
        enabled: ['linear'],
        linear: { apiKey: 'lin_api_xxx', teamId: 'TEAM-001' },
      });
      expect(adapters.length).toBe(1);
      expect(adapters[0].name).toBe('linear');
    });

    it('skips adapter with invalid config', () => {
      const adapters = getEnabledAdapters({
        enabled: ['dingtalk'],
        dingtalk: { webhook: '' }, // missing secret
      });
      expect(adapters.length).toBe(0);
    });

    it('instantiates multiple adapters', () => {
      const adapters = getEnabledAdapters({
        enabled: ['dingtalk', 'linear'],
        dingtalk: { webhook: 'https://example.com', secret: 's3cret' },
        linear: { apiKey: 'lin_api_xxx', teamId: 'TEAM-001' },
      });
      expect(adapters.length).toBe(2);
      expect(adapters[0].name).toBe('dingtalk');
      expect(adapters[1].name).toBe('linear');
    });
  });

  describe('notifyAdapters', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('does not throw when no config file exists', () => {
      expect(() => {
        notifyAdapters(SAMPLE_EVENT);
      }).not.toThrow();
    });

    it('does not throw when config has empty enabled list', () => {
      writeAdapterConfig({ enabled: [] });
      expect(() => {
        notifyAdapters(SAMPLE_EVENT);
      }).not.toThrow();
    });

    it('returns void (not a Promise)', () => {
      const result = notifyAdapters(SAMPLE_EVENT);
      expect(result).toBe(undefined);
    });
  });
});
