/**
 * Migration Template: v{FROM} → v{TO}
 *
 * Copy this file and rename to v{FROM}-to-v{TO}.ts.
 * Then register in index.ts:
 *   import vXToY from './v{FROM}-to-v{TO}.js';
 *   registry.register(vXToY);
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationDef, MigrationResult } from '../utils/migration-registry.js';

const migration: MigrationDef = {
  from: 'X.0',   // ← source version
  to: 'Y.0',     // ← target version
  name: 'short-descriptive-name',
  description: [
    'What this migration does:',
    '  - Change A',
    '  - Change B',
  ].join('\n'),

  migrate(workflowRoot: string): MigrationResult {
    // workflowRoot = the .workflow/ directory (NOT project root)
    const statePath = join(workflowRoot, 'state.json');
    const changes: string[] = [];

    // 1. Read current state
    let state: Record<string, unknown>;
    try {
      state = JSON.parse(readFileSync(statePath, 'utf8'));
    } catch (e) {
      return { success: false, summary: `Parse error: ${e}`, changes: [] };
    }

    // 2. Guard: already migrated?
    if (state.version === this.to) {
      return { success: true, summary: `Already at v${this.to}`, changes: [] };
    }

    // 3. Apply changes
    // state.newField = 'value';
    // changes.push('Added newField');

    // 4. Bump version
    state.version = this.to;
    changes.push(`Version bumped: ${this.from} → ${this.to}`);

    // 5. Write back (atomic: tmp + rename)
    const tmpPath = statePath + '.tmp';
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    const { renameSync } = require('node:fs');
    renameSync(tmpPath, statePath);

    return {
      success: true,
      summary: `Migrated to v${this.to}`,
      changes,
    };
  },
};

export default migration;
