// ---------------------------------------------------------------------------
// `maestro install` — interactive install wizard for maestro assets
//
// Global (~/.maestro/):  templates/, workflows/
// Project (target dir):  .claude/ (commands, agents, skills, CLAUDE.md),
//                        .codex/ (skills)
//
// Tracks installed files in manifests for clean reinstall and uninstall.
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runInstallWizard } from './install-ui/index.js';
import { paths } from '../config/paths.js';
import {
  createManifest,
  addFile,
  saveManifest,
  findManifest,
  cleanManifestFiles,
} from '../core/manifest.js';
import {
  installHooksByLevel,
  HOOK_LEVELS,
  type HookLevel,
} from './hooks.js';
import {
  getPackageRoot,
  scanComponents,
  scanDisabledItems,
  restoreDisabledState,
  applyOverlaysPostInstall,
  copyRecursive,
  type CopyStats,
} from './install-backend.js';

// ---------------------------------------------------------------------------
// Non-interactive (force) install — preserves original batch behavior
// ---------------------------------------------------------------------------

function forceInstall(
  pkgRoot: string,
  version: string,
  opts: { global?: boolean; path?: string; hooks?: string },
): void {
  console.error(`maestro install v${version}`);
  console.error('');

  const mode: 'global' | 'project' = opts.global ? 'global' : (opts.path ? 'project' : 'global');
  const projectPath = opts.path ? resolve(opts.path) : '';

  if (mode === 'project' && projectPath && !existsSync(projectPath)) {
    console.error(`Error: Target directory does not exist: ${projectPath}`);
    process.exit(1);
  }

  const components = scanComponents(pkgRoot, mode, projectPath);
  const available = components.filter((c) => c.available);

  // Determine what to install based on mode
  const targetPath = mode === 'global' ? paths.home : projectPath;
  const targetBase = mode === 'global' ? homedir() : projectPath;

  // Scan disabled items
  const disabledItems = scanDisabledItems(targetBase);

  // Clean previous
  const existingManifest = findManifest(mode, targetPath);
  if (existingManifest) {
    const { removed, skipped } = cleanManifestFiles(existingManifest);
    if (removed > 0) {
      console.error(`  Cleaned: ${removed} old files${skipped > 0 ? `, ${skipped} preserved` : ''}`);
    }
  }

  paths.ensure(paths.home);

  const manifest = createManifest(mode, targetPath);
  const totalStats: CopyStats = { files: 0, dirs: 0, skipped: 0 };

  for (const comp of available) {
    // In global-only mode, skip project-scoped items unless they're alwaysGlobal
    if (opts.global && !comp.def.alwaysGlobal) continue;
    console.error(`  ${comp.def.label} → ${comp.targetDir}`);
    copyRecursive(comp.sourceFull, comp.targetDir, totalStats, manifest);
  }

  // Version marker
  const versionData = {
    version,
    installedAt: new Date().toISOString(),
    installer: 'maestro',
  };
  const versionPath = join(paths.home, 'version.json');
  writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf-8');
  addFile(manifest, versionPath);
  totalStats.files++;

  // Restore disabled state
  const disabledRestored = restoreDisabledState(disabledItems, targetBase);

  // Apply overlays (non-invasive command patches)
  const overlaysAppliedCount = applyOverlaysPostInstall(mode, targetBase);

  // Hook installation
  const hookLevel = (opts.hooks ?? 'none') as HookLevel;
  if (hookLevel !== 'none' && HOOK_LEVELS.includes(hookLevel)) {
    const hookResult = installHooksByLevel(hookLevel, { project: mode === 'project' });
    console.error(`  Hooks (${hookLevel}): ${hookResult.installedHooks.length} hooks → ${hookResult.settingsPath}`);
  }

  saveManifest(manifest);

  const parts = [`${totalStats.files} files`];
  if (totalStats.dirs > 0) parts.push(`${totalStats.dirs} dirs`);
  if (totalStats.skipped > 0) parts.push(`${totalStats.skipped} preserved`);
  if (disabledRestored > 0) parts.push(`${disabledRestored} disabled restored`);
  if (overlaysAppliedCount > 0) parts.push(`${overlaysAppliedCount} overlays applied`);
  console.error(`  Result: ${parts.join(', ')}`);
  console.error('');
  console.error('Done. Restart Claude Code or IDE to pick up changes.');
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerInstallCommand(program: Command): void {
  program
    .command('install')
    .description('Install maestro assets (interactive wizard or --force for batch mode)')
    .option('--global', 'Install global assets only (~/.maestro/)')
    .option('--path <dir>', 'Install project assets to target directory')
    .option('--force', 'Skip interactive prompts, install all available components')
    .option('--hooks <level>', 'Install Claude Code hooks: none, minimal, standard, full (default: none)')
    .action(async (opts: { global?: boolean; path?: string; force?: boolean; hooks?: string }) => {
      const pkgRoot = getPackageRoot();

      // Validate package root
      const hasTemplates = existsSync(join(pkgRoot, 'templates'));
      const hasWorkflows = existsSync(join(pkgRoot, 'workflows'));
      if (!hasTemplates && !hasWorkflows) {
        console.error(`Error: Package root missing source directories: ${pkgRoot}`);
        process.exit(1);
      }

      const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8'));
      const version = (pkg.version as string) ?? '0.1.0';

      if (opts.force) {
        forceInstall(pkgRoot, version, opts);
      } else {
        await runInstallWizard(pkgRoot, version);
      }
    });
}
