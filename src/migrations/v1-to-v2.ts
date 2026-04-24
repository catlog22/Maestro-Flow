/**
 * Migration: v1.0 → v2.0 — Artifact Registry
 *
 * Converts phase-directory model to scratch-based artifact registry.
 * Harvests existing artifacts from .workflow/phases/ into state.json.artifacts[].
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationDef, MigrationResult } from '../utils/migration-registry.js';
import { migrateV1toV2, writeStateJson } from '../utils/state-schema.js';

const migration: MigrationDef = {
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

  migrate(workflowRoot: string): MigrationResult {
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

    if (raw.current_phase !== undefined) changes.push(`Remove current_phase: ${raw.current_phase}`);
    if (raw.phases_summary !== undefined) changes.push('Remove phases_summary');
    if (raw.status && typeof raw.status === 'string' && raw.status !== 'idle' && raw.status !== 'active') {
      changes.push(`Normalize status: "${raw.status}" → "${normalizeStatus(raw.status)}"`);
    }

    const v2 = migrateV1toV2(raw as any, workflowRoot);

    if (v2.artifacts.length > 0) {
      changes.push(`Harvested ${v2.artifacts.length} artifacts from legacy phases/`);
    }
    changes.push(`milestones enriched: ${v2.milestones.map(m => `${m.id}(${m.name})`).join(', ') || 'none'}`);
    changes.push('Version bumped: 1.0 → 2.0');

    const projectRoot = join(workflowRoot, '..');
    writeStateJson(projectRoot, v2);

    return {
      success: true,
      summary: `Migrated to v2.0 (${v2.artifacts.length} artifacts registered)`,
      changes,
    };
  },
};

function normalizeStatus(status: string): string {
  if (status === 'idle') return 'idle';
  if (status.includes('executing')) return 'executing';
  if (status === 'completed') return 'completed';
  return 'active';
}

export default migration;
