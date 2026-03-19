import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveConfig, applyProfile, loadCommanderConfig, PROFILES } from './commander-config.js';
import { DEFAULT_COMMANDER_CONFIG } from '../../shared/commander-types.js';

describe('Commander Config', () => {
  // --- test_commander_config_defaults ---
  describe('defaults', () => {
    it('resolveConfig returns defaults with development profile applied when no overrides', () => {
      const config = resolveConfig();

      // Default profile is 'development', so profile presets are applied
      expect(config.pollIntervalMs).toBe(PROFILES.development.pollIntervalMs);
      expect(config.maxConcurrentWorkers).toBe(PROFILES.development.maxConcurrentWorkers);
      expect(config.decisionModel).toBe(PROFILES.development.decisionModel);
      expect(config.autoApproveThreshold).toBe(PROFILES.development.autoApproveThreshold);
      expect(config.defaultExecutor).toBe(DEFAULT_COMMANDER_CONFIG.defaultExecutor);
    });

    it('DEFAULT_COMMANDER_CONFIG has all required fields', () => {
      expect(DEFAULT_COMMANDER_CONFIG.pollIntervalMs).toBe(30_000);
      expect(DEFAULT_COMMANDER_CONFIG.maxConcurrentWorkers).toBe(3);
      expect(DEFAULT_COMMANDER_CONFIG.stallTimeoutMs).toBe(300_000);
      expect(DEFAULT_COMMANDER_CONFIG.maxRetries).toBe(2);
      expect(DEFAULT_COMMANDER_CONFIG.retryBackoffMs).toBe(60_000);
      expect(DEFAULT_COMMANDER_CONFIG.decisionModel).toBe('sonnet');
      expect(DEFAULT_COMMANDER_CONFIG.assessMaxTurns).toBe(5);
      expect(DEFAULT_COMMANDER_CONFIG.autoApproveThreshold).toBe('low');
      expect(DEFAULT_COMMANDER_CONFIG.defaultExecutor).toBe('claude-code');
      expect(DEFAULT_COMMANDER_CONFIG.profile).toBe('development');
    });

    it('DEFAULT_COMMANDER_CONFIG has safety config', () => {
      const safety = DEFAULT_COMMANDER_CONFIG.safety;
      expect(safety.eventDebounceMs).toBe(5_000);
      expect(safety.circuitBreakerThreshold).toBe(3);
      expect(safety.maxTicksPerHour).toBe(120);
      expect(safety.maxTokensPerHour).toBe(500_000);
      expect(safety.protectedPaths).toContain('.env');
    });

    it('DEFAULT_COMMANDER_CONFIG has workspace config', () => {
      const ws = DEFAULT_COMMANDER_CONFIG.workspace;
      expect(ws.enabled).toBe(false);
      expect(ws.useWorktree).toBe(true);
      expect(ws.autoCleanup).toBe(true);
    });
  });

  // --- test_commander_config_profile_merge ---
  describe('profile merge', () => {
    it('applies development profile preset', () => {
      const config = resolveConfig({ profile: 'development' });

      expect(config.pollIntervalMs).toBe(PROFILES.development.pollIntervalMs);
      expect(config.decisionModel).toBe(PROFILES.development.decisionModel);
      expect(config.maxConcurrentWorkers).toBe(PROFILES.development.maxConcurrentWorkers);
    });

    it('applies production profile preset', () => {
      const config = resolveConfig({ profile: 'production' });

      expect(config.pollIntervalMs).toBe(PROFILES.production.pollIntervalMs);
      expect(config.decisionModel).toBe(PROFILES.production.decisionModel);
      expect(config.workspace).toEqual(PROFILES.production.workspace);
    });

    it('applies staging profile preset', () => {
      const config = resolveConfig({ profile: 'staging' });

      expect(config.pollIntervalMs).toBe(PROFILES.staging.pollIntervalMs);
      expect(config.autoApproveThreshold).toBe(PROFILES.staging.autoApproveThreshold);
    });

    it('custom profile does not apply any preset', () => {
      const config = resolveConfig({ profile: 'custom' });

      expect(config.pollIntervalMs).toBe(DEFAULT_COMMANDER_CONFIG.pollIntervalMs);
      expect(config.decisionModel).toBe(DEFAULT_COMMANDER_CONFIG.decisionModel);
    });

    it('runtime overrides take precedence over profile', () => {
      const config = resolveConfig(
        { profile: 'production' },
        undefined,
        { pollIntervalMs: 5_000 },
      );

      expect(config.pollIntervalMs).toBe(5_000);
      expect(config.decisionModel).toBe(PROFILES.production.decisionModel);
    });

    it('project overrides take precedence over profile defaults', () => {
      const config = resolveConfig(
        { profile: 'production', maxConcurrentWorkers: 10 },
      );

      expect(config.maxConcurrentWorkers).toBe(10);
    });

    it('applyProfile only fills fields still at default', () => {
      const config = { ...DEFAULT_COMMANDER_CONFIG, pollIntervalMs: 99_999 };
      const result = applyProfile(config, 'production');

      // pollIntervalMs was changed from default, so profile should NOT override it
      expect(result.pollIntervalMs).toBe(99_999);
      // decisionModel was at default, so profile SHOULD override it
      expect(result.decisionModel).toBe(PROFILES.production.decisionModel);
    });
  });

  // --- Layer merge ordering ---
  describe('layer merge ordering', () => {
    it('merges layers in correct priority: defaults < profile < project < env < runtime', () => {
      const config = resolveConfig(
        { maxConcurrentWorkers: 5 },      // project override
        { maxRetries: 10 },               // env override
        { retryBackoffMs: 1_000 },        // runtime override
      );

      expect(config.maxConcurrentWorkers).toBe(5);
      expect(config.maxRetries).toBe(10);
      expect(config.retryBackoffMs).toBe(1_000);
    });

    it('higher priority layer overrides lower priority', () => {
      const config = resolveConfig(
        { maxConcurrentWorkers: 5 },       // project
        { maxConcurrentWorkers: 8 },       // env (higher priority)
        { maxConcurrentWorkers: 12 },      // runtime (highest)
      );

      expect(config.maxConcurrentWorkers).toBe(12);
    });
  });

  // --- PROFILES validation ---
  describe('profiles', () => {
    it('has development, staging, and production profiles', () => {
      expect(PROFILES).toHaveProperty('development');
      expect(PROFILES).toHaveProperty('staging');
      expect(PROFILES).toHaveProperty('production');
    });

    it('production profile has stricter safety limits', () => {
      const prod = PROFILES.production;
      const dev = PROFILES.development;

      expect(prod.safety!.maxTicksPerHour).toBeLessThan(dev.safety!.maxTicksPerHour!);
      expect(prod.safety!.circuitBreakerThreshold).toBeLessThan(dev.safety!.circuitBreakerThreshold!);
      expect(prod.pollIntervalMs!).toBeGreaterThan(dev.pollIntervalMs!);
    });
  });

  // --- loadCommanderConfig (disk + env) ---
  describe('loadCommanderConfig', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'cmdr-cfg-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('returns defaults when no config files exist', async () => {
      const config = await loadCommanderConfig(tempDir);
      expect(config.defaultExecutor).toBe(DEFAULT_COMMANDER_CONFIG.defaultExecutor);
    });

    it('reads project config from config.json commander section', async () => {
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({ commander: { maxConcurrentWorkers: 7 } }),
      );

      const config = await loadCommanderConfig(tempDir);
      expect(config.maxConcurrentWorkers).toBe(7);
    });

    it('ignores config.json without commander section', async () => {
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({ other: 'stuff' }),
      );

      const config = await loadCommanderConfig(tempDir);
      // Should still have default values
      expect(config.defaultExecutor).toBe(DEFAULT_COMMANDER_CONFIG.defaultExecutor);
    });

    it('handles malformed config.json gracefully', async () => {
      await writeFile(join(tempDir, 'config.json'), '{invalid json}}}');

      const config = await loadCommanderConfig(tempDir);
      // Should fall through to defaults
      expect(config.defaultExecutor).toBe(DEFAULT_COMMANDER_CONFIG.defaultExecutor);
    });

    it('applies profile after loading config', async () => {
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({ commander: { profile: 'production' } }),
      );

      const config = await loadCommanderConfig(tempDir);
      // Production profile should be applied
      expect(config.profile).toBe('production');
    });
  });

  // --- Environment variable overrides ---
  describe('environment variable overrides', () => {
    const envKeys = [
      'COMMANDER_POLL_INTERVAL',
      'COMMANDER_MAX_WORKERS',
      'COMMANDER_MODEL',
      'COMMANDER_PROFILE',
      'COMMANDER_AUTO_APPROVE',
    ];
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const key of envKeys) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    });

    afterEach(async () => {
      for (const key of envKeys) {
        if (savedEnv[key] !== undefined) {
          process.env[key] = savedEnv[key];
        } else {
          delete process.env[key];
        }
      }
    });

    it('COMMANDER_POLL_INTERVAL overrides pollIntervalMs', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cmdr-env-'));
      try {
        process.env.COMMANDER_POLL_INTERVAL = '5000';
        const config = await loadCommanderConfig(tempDir);
        expect(config.pollIntervalMs).toBe(5000);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('COMMANDER_MAX_WORKERS overrides maxConcurrentWorkers', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cmdr-env-'));
      try {
        process.env.COMMANDER_MAX_WORKERS = '8';
        const config = await loadCommanderConfig(tempDir);
        expect(config.maxConcurrentWorkers).toBe(8);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('COMMANDER_MODEL overrides decisionModel', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cmdr-env-'));
      try {
        process.env.COMMANDER_MODEL = 'opus';
        const config = await loadCommanderConfig(tempDir);
        expect(config.decisionModel).toBe('opus');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('COMMANDER_PROFILE overrides profile', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cmdr-env-'));
      try {
        process.env.COMMANDER_PROFILE = 'staging';
        const config = await loadCommanderConfig(tempDir);
        expect(config.profile).toBe('staging');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('COMMANDER_AUTO_APPROVE overrides autoApproveThreshold', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cmdr-env-'));
      try {
        process.env.COMMANDER_AUTO_APPROVE = 'high';
        const config = await loadCommanderConfig(tempDir);
        expect(config.autoApproveThreshold).toBe('high');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('ignores NaN for numeric env vars', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cmdr-env-'));
      try {
        process.env.COMMANDER_POLL_INTERVAL = 'not-a-number';
        process.env.COMMANDER_MAX_WORKERS = 'invalid';
        const config = await loadCommanderConfig(tempDir);
        // Should keep default values (with dev profile applied)
        expect(config.pollIntervalMs).toBe(PROFILES.development.pollIntervalMs);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
