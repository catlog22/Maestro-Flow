import { describe, it, expect, beforeEach } from 'vitest';

import { DashboardEventBus } from '../state/event-bus.js';
import { ExtensionManager } from './extension-manager.js';
import type { ExtensionInfo } from '../../shared/extension-types.js';

// ---------------------------------------------------------------------------
// Mock AgentManager
// ---------------------------------------------------------------------------
class MockAgentManager {
  private readonly adapterTypes: string[];
  constructor(types: string[] = ['claude-code', 'gemini', 'codex']) {
    this.adapterTypes = types;
  }
  listAdapterTypes(): string[] {
    return [...this.adapterTypes];
  }
}

// ---------------------------------------------------------------------------
// Mock PromptRegistry
// ---------------------------------------------------------------------------
class MockPromptRegistry {
  private readonly names: string[];
  constructor(names: string[] = ['standard', 'deep-analysis', 'tdd']) {
    this.names = names;
  }
  list(): string[] {
    return [...this.names];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ExtensionManager', () => {
  let eventBus: DashboardEventBus;
  let agentManager: MockAgentManager;
  let promptRegistry: MockPromptRegistry;
  const emitted: { type: string; data: unknown }[] = [];

  beforeEach(() => {
    eventBus = new DashboardEventBus();
    agentManager = new MockAgentManager();
    promptRegistry = new MockPromptRegistry();
    emitted.length = 0;

    eventBus.on('supervisor:extension_loaded', (data) => {
      emitted.push({ type: 'extension_loaded', data });
    });
    eventBus.on('supervisor:extension_error', (data) => {
      emitted.push({ type: 'extension_error', data });
    });
  });

  // -------------------------------------------------------------------------
  // init
  // -------------------------------------------------------------------------
  describe('init()', () => {
    it('discovers prompt builders and agent adapters', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      const extensions = manager.listExtensions();
      // 3 builders + 3 adapters = 6
      expect(extensions).toHaveLength(6);
    });

    it('assigns correct types to extensions', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      const extensions = manager.listExtensions();
      const builders = extensions.filter((e) => e.type === 'builder');
      const adapters = extensions.filter((e) => e.type === 'adapter');

      expect(builders).toHaveLength(3);
      expect(adapters).toHaveLength(3);
    });

    it('emits extension_loaded event', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe('extension_loaded');
    });

    it('sets all extensions to enabled status', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      for (const ext of manager.listExtensions()) {
        expect(ext.status).toBe('enabled');
      }
    });

    it('sets version to 1.0.0 for all extensions', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      for (const ext of manager.listExtensions()) {
        expect(ext.version).toBe('1.0.0');
      }
    });

    it('clears previous extensions on re-init', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();
      expect(manager.listExtensions()).toHaveLength(6);

      manager.init();
      expect(manager.listExtensions()).toHaveLength(6); // Not 12
    });
  });

  // -------------------------------------------------------------------------
  // listExtensions
  // -------------------------------------------------------------------------
  describe('listExtensions()', () => {
    it('returns a copy (not internal reference)', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      const list1 = manager.listExtensions();
      const list2 = manager.listExtensions();
      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });

    it('returns empty before init', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      expect(manager.listExtensions()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getExtension
  // -------------------------------------------------------------------------
  describe('getExtension()', () => {
    it('finds extension by name', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      const ext = manager.getExtension('standard');
      expect(ext).toBeDefined();
      expect(ext!.name).toBe('standard');
      expect(ext!.type).toBe('builder');
    });

    it('returns undefined for unknown name', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any, promptRegistry as any);
      manager.init();

      expect(manager.getExtension('nonexistent')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // without PromptRegistry
  // -------------------------------------------------------------------------
  describe('without PromptRegistry', () => {
    it('works with only agent adapters', () => {
      const manager = new ExtensionManager(eventBus, agentManager as any);
      manager.init();

      const extensions = manager.listExtensions();
      expect(extensions).toHaveLength(3); // only adapters
      expect(extensions.every((e) => e.type === 'adapter')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('emits extension_error when agentManager throws', () => {
      const badManager = {
        listAdapterTypes(): string[] {
          throw new Error('Registry failure');
        },
      };

      const manager = new ExtensionManager(eventBus, badManager as any, promptRegistry as any);
      manager.init();

      const errorEvents = emitted.filter((e) => e.type === 'extension_error');
      expect(errorEvents).toHaveLength(1);
    });
  });
});
