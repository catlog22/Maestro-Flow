// ---------------------------------------------------------------------------
// `maestro uninstall` — remove installed maestro assets using manifests
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { resolve } from 'node:path';
import {
  getAllManifests,
  findManifest,
  cleanManifestFiles,
  deleteManifest,
  type Manifest,
} from '../core/manifest.js';
import { paths } from '../config/paths.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uninstallManifest(manifest: Manifest): void {
  const { removed, skipped } = cleanManifestFiles(manifest);
  deleteManifest(manifest);
  console.error(`  Removed ${removed} files${skipped > 0 ? `, ${skipped} preserved` : ''}`);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall')
    .description('Remove installed maestro assets')
    .option('--global', 'Uninstall global assets only (~/.maestro/)')
    .option('--path <dir>', 'Uninstall project assets from target directory')
    .option('--all', 'Uninstall all recorded installations')
    .action((opts: { global?: boolean; path?: string; all?: boolean }) => {
      const manifests = getAllManifests();

      if (manifests.length === 0) {
        console.error('No installations found.');
        return;
      }

      // --all: remove everything
      if (opts.all) {
        console.error(`Uninstalling ${manifests.length} installation(s)...`);
        for (const m of manifests) {
          console.error(`\n[${m.scope}] ${m.targetPath}`);
          uninstallManifest(m);
        }
        console.error('\nDone.');
        return;
      }

      // --global
      if (opts.global) {
        const m = findManifest('global', paths.home);
        if (!m) {
          console.error('No global installation found.');
          return;
        }
        console.error(`[Global] ${paths.home}`);
        uninstallManifest(m);
        console.error('Done.');
        return;
      }

      // --path or cwd
      const targetDir = resolve(opts.path ?? process.cwd());
      const m = findManifest('project', targetDir);
      if (!m) {
        console.error(`No project installation found for: ${targetDir}`);

        // Show available installations
        if (manifests.length > 0) {
          console.error('\nKnown installations:');
          for (const mm of manifests) {
            console.error(`  [${mm.scope}] ${mm.targetPath} (${mm.installedAt})`);
          }
        }
        return;
      }

      console.error(`[Project] ${targetDir}`);
      uninstallManifest(m);
      console.error('Done.');
    });
}
