// ---------------------------------------------------------------------------
// Extension types -- supervisor extension lifecycle and metadata
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Extension type discriminator
// ---------------------------------------------------------------------------

export type ExtensionType = 'strategy' | 'builder' | 'adapter' | 'task' | 'tool';

// ---------------------------------------------------------------------------
// Extension context -- DI container references passed to extensions
// ---------------------------------------------------------------------------

export interface ExtensionContext {
  eventBus: unknown;
  strategyRegistry: unknown;
  promptRegistry: unknown;
  agentManager: unknown;
  journal: unknown;
}

// ---------------------------------------------------------------------------
// Extension manifest -- declarative metadata from extension package
// ---------------------------------------------------------------------------

export interface ExtensionManifest {
  name: string;
  version: string;
  type: ExtensionType;
  entryPoint: string;
  config?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Supervisor extension -- runtime extension with lifecycle hooks
// ---------------------------------------------------------------------------

export interface SupervisorExtension {
  name: string;
  version: string;
  type: ExtensionType;
  description: string;
  init(ctx: ExtensionContext): Promise<void> | void;
  destroy(): Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Extension info -- UI display / status summary
// ---------------------------------------------------------------------------

export interface ExtensionInfo {
  name: string;
  version: string;
  type: ExtensionType;
  description: string;
  status: 'enabled' | 'disabled';
}
