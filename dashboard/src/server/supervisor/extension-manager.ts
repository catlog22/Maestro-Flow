// ---------------------------------------------------------------------------
// ExtensionManager -- Phase 1 registry that aggregates registered strategies,
// builders, and adapters into a unified ExtensionInfo[] list
// ---------------------------------------------------------------------------

import type { DashboardEventBus } from '../state/event-bus.js';
import type { AgentManager } from '../agents/agent-manager.js';
import type { PromptRegistry } from '../prompt/prompt-registry.js';
import type { ExtensionInfo, ExtensionType } from '../../shared/extension-types.js';

export class ExtensionManager {
  private readonly extensions: ExtensionInfo[] = [];

  constructor(
    private readonly eventBus: DashboardEventBus,
    private readonly agentManager: AgentManager,
    private readonly promptRegistry?: PromptRegistry,
  ) {}

  /** Scan registries and emit extension_loaded event */
  init(): void {
    this.extensions.length = 0;

    try {
      // Enumerate prompt builders
      if (this.promptRegistry) {
        for (const name of this.promptRegistry.list()) {
          this.extensions.push(
            this.toInfo(name, 'builder'),
          );
        }
      }

      // Enumerate registered agent adapters
      for (const adapterType of this.agentManager.listAdapterTypes()) {
        this.extensions.push(
          this.toInfo(adapterType, 'adapter'),
        );
      }

      this.eventBus.emit('supervisor:extension_loaded', {
        extensions: this.extensions,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.eventBus.emit('supervisor:extension_error', {
        name: 'init',
        error: message,
      });
    }
  }

  /** Return all discovered extensions */
  listExtensions(): ExtensionInfo[] {
    return [...this.extensions];
  }

  /** Find a single extension by name */
  getExtension(name: string): ExtensionInfo | undefined {
    return this.extensions.find((ext) => ext.name === name);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toInfo(name: string, type: ExtensionType): ExtensionInfo {
    return {
      name,
      version: '1.0.0',
      type,
      description: `${type}: ${name}`,
      status: 'enabled',
    };
  }
}
