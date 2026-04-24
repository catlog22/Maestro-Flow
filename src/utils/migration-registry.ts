/**
 * migration-registry.ts — Versioned migration framework for .workflow/ artifacts.
 *
 * Migrations are registered by source→target version pairs.
 * The runner detects the current version from state.json and applies
 * all pending migrations in sequence.
 *
 * Usage:
 *   import { registry, runPendingMigrations } from './migration-registry.js';
 *   registry.register({ from: '1.0', to: '2.0', name: '...', migrate: fn });
 *   const results = runPendingMigrations(workflowRoot);
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationDef {
  /** Source version this migration applies to */
  from: string;
  /** Target version after migration */
  to: string;
  /** Human-readable name */
  name: string;
  /** Description of what changes */
  description: string;
  /** The migration function. Receives workflowRoot, returns summary. */
  migrate: (workflowRoot: string) => MigrationResult;
}

export interface MigrationResult {
  success: boolean;
  summary: string;
  changes: string[];
}

export interface MigrationPlan {
  currentVersion: string;
  targetVersion: string;
  steps: MigrationDef[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class MigrationRegistry {
  private migrations: MigrationDef[] = [];

  register(def: MigrationDef): void {
    // Prevent duplicate registration
    if (this.migrations.some(m => m.from === def.from && m.to === def.to)) return;
    this.migrations.push(def);
  }

  /** Get all registered migrations sorted by version chain */
  getAll(): readonly MigrationDef[] {
    return this.migrations;
  }

  /** Build the migration chain from current version to latest */
  buildPlan(currentVersion: string): MigrationPlan | null {
    const chain: MigrationDef[] = [];
    let version = currentVersion;

    for (let i = 0; i < 20; i++) { // safety limit
      const next = this.migrations.find(m => m.from === version);
      if (!next) break;
      chain.push(next);
      version = next.to;
    }

    if (chain.length === 0) return null;

    return {
      currentVersion,
      targetVersion: version,
      steps: chain,
    };
  }

  /** Get the latest version any migration targets */
  getLatestVersion(): string {
    if (this.migrations.length === 0) return '1.0';
    // Walk the chain to find the terminal version
    const targets = new Set(this.migrations.map(m => m.to));
    const sources = new Set(this.migrations.map(m => m.from));
    for (const t of targets) {
      if (!sources.has(t)) return t; // terminal node
    }
    return this.migrations[this.migrations.length - 1].to;
  }
}

export const registry = new MigrationRegistry();

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/** Detect current workflow version from state.json */
export function detectVersion(workflowRoot: string): string | null {
  const statePath = join(workflowRoot, '.workflow', 'state.json');
  if (!existsSync(statePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    return raw.version ?? '1.0';
  } catch {
    return null;
  }
}

/** Plan pending migrations without executing */
export function planMigrations(workflowRoot: string): MigrationPlan | null {
  const current = detectVersion(workflowRoot);
  if (!current) return null;
  return registry.buildPlan(current);
}

/** Execute all pending migrations in sequence */
export function runPendingMigrations(workflowRoot: string): {
  plan: MigrationPlan | null;
  results: Array<{ step: MigrationDef; result: MigrationResult }>;
} {
  const plan = planMigrations(workflowRoot);
  if (!plan) return { plan: null, results: [] };

  const results: Array<{ step: MigrationDef; result: MigrationResult }> = [];

  for (const step of plan.steps) {
    const result = step.migrate(join(workflowRoot, '.workflow'));
    results.push({ step, result });
    if (!result.success) break; // stop on failure
  }

  return { plan, results };
}

// ---------------------------------------------------------------------------
// Built-in migrations — register on import
// ---------------------------------------------------------------------------

import { migrateV1toV2, writeStateJson, type StateJsonV2 } from './state-schema.js';

registry.register({
  from: '1.0',
  to: '2.0',
  name: 'state-v2-artifact-registry',
  description: [
    'Migrate state.json to v2 schema:',
    '  - Add artifacts[] registry (harvest from phases/ if present)',
    '  - Add milestones[].id and milestones[].status',
    '  - Add current_task_id',
    '  - Remove current_phase (derived from artifacts)',
    '  - Remove phases_summary (derived from artifacts)',
    '  - Normalize status enum (idle|active|executing|completed)',
  ].join('\n'),
  migrate: (workflowRoot: string): MigrationResult => {
    const statePath = join(workflowRoot, 'state.json');
    if (!existsSync(statePath)) {
      return { success: false, summary: 'state.json not found', changes: [] };
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(statePath, 'utf8'));
    } catch (e) {
      return { success: false, summary: `Failed to parse state.json: ${e}`, changes: [] };
    }

    if (raw.version === '2.0') {
      return { success: true, summary: 'Already at v2.0', changes: [] };
    }

    const changes: string[] = [];

    // Track what will change
    if (raw.current_phase !== undefined) changes.push(`Remove current_phase: ${raw.current_phase}`);
    if (raw.phases_summary !== undefined) changes.push('Remove phases_summary');
    if (raw.status && typeof raw.status === 'string' && raw.status !== 'idle' && raw.status !== 'active') {
      changes.push(`Normalize status: "${raw.status}" → "${normalizeStatusForLog(raw.status)}"`);
    }

    const v2 = migrateV1toV2(raw as any, workflowRoot);

    if (v2.artifacts.length > 0) {
      changes.push(`Harvested ${v2.artifacts.length} artifacts from legacy phases/`);
    }
    changes.push(`milestones enriched: ${v2.milestones.map(m => `${m.id}(${m.name})`).join(', ')}`);
    changes.push('Version bumped: 1.0 → 2.0');

    // Write the migrated state — workflowRoot here is the .workflow dir,
    // but writeStateJson expects the project root
    const projectRoot = join(workflowRoot, '..');
    writeStateJson(projectRoot, v2);

    return {
      success: true,
      summary: `Migrated to v2.0 (${v2.artifacts.length} artifacts registered)`,
      changes,
    };
  },
});

function normalizeStatusForLog(status: string): string {
  if (status === 'idle') return 'idle';
  if (status.includes('executing')) return 'executing';
  if (status === 'completed') return 'completed';
  return 'active';
}
