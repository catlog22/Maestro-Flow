#!/usr/bin/env node
/**
 * migrations/run.ts — CLI entrypoint for maestro-update.
 *
 * Usage:
 *   npx tsx src/migrations/run.ts [workflowRoot] [--dry-run] [--force] [--json]
 *
 * Outputs structured JSON for the maestro-update command to consume,
 * or human-readable text for direct CLI use.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { registry, detectVersion, type MigrationPlan, type MigrationResult, type MigrationDef } from '../utils/migration-registry.js';

// Load all registered migrations
import './index.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  json: args.includes('--json'),
};
const positional = args.filter(a => !a.startsWith('--'));
const workflowRoot = resolve(positional[0] || process.cwd());

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface StepResult {
  step: MigrationDef;
  action: 'applied' | 'skipped' | 'dry-run' | 'failed';
  result?: MigrationResult;
}

function main(): void {
  // 1. Detect version
  const version = detectVersion(workflowRoot);
  if (!version) {
    output({ error: 'E001', message: '.workflow/state.json not found', workflowRoot });
    process.exit(1);
  }

  // 2. Build plan
  const plan = registry.buildPlan(version);
  if (!plan) {
    output({ status: 'up-to-date', version, workflowRoot });
    process.exit(0);
  }

  // 3. Execute plan
  const results: StepResult[] = [];

  for (const step of plan.steps) {
    if (flags.dryRun) {
      results.push({ step, action: 'dry-run' });
      continue;
    }

    // Create backup before each migration
    const backupPath = createBackup(workflowRoot, step.from);

    // Execute
    const result = step.migrate(join(workflowRoot, '.workflow'));
    if (result.success) {
      results.push({ step, action: 'applied', result });
    } else {
      results.push({ step, action: 'failed', result });
      break; // stop chain on failure
    }
  }

  // 4. Output
  output({
    status: flags.dryRun ? 'dry-run' : (results.some(r => r.action === 'failed') ? 'failed' : 'completed'),
    workflowRoot,
    from: plan.currentVersion,
    to: plan.targetVersion,
    steps: results.map(r => ({
      name: r.step.name,
      from: r.step.from,
      to: r.step.to,
      description: r.step.description,
      action: r.action,
      summary: r.result?.summary,
      changes: r.result?.changes,
    })),
  });
}

function createBackup(root: string, version: string): string {
  const statePath = join(root, '.workflow', 'state.json');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = join(root, '.workflow', `state.json.backup-v${version}-${ts}`);
  if (existsSync(statePath)) {
    copyFileSync(statePath, backupPath);
  }
  return backupPath;
}

function output(data: unknown): void {
  if (flags.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    printHuman(data as any);
  }
}

function printHuman(data: any): void {
  if (data.error) {
    console.error(`ERROR [${data.error}]: ${data.message}`);
    return;
  }

  if (data.status === 'up-to-date') {
    console.log(`Already up to date (v${data.version})`);
    return;
  }

  console.log(`\n=== Maestro Migration ===`);
  console.log(`From: v${data.from} → v${data.to}`);
  console.log(`Mode: ${data.status}\n`);

  for (const step of data.steps || []) {
    const icon = step.action === 'applied' ? '+' : step.action === 'dry-run' ? '~' : 'x';
    console.log(`[${icon}] ${step.name} (v${step.from} → v${step.to})`);
    if (step.summary) console.log(`    ${step.summary}`);
    if (step.changes?.length) {
      for (const c of step.changes) {
        console.log(`    - ${c}`);
      }
    }
  }
  console.log('');
}

main();
