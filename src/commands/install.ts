// ---------------------------------------------------------------------------
// `maestro install` — install maestro assets to global and project directories
//
// Global (~/.maestro/):  templates/, workflows/
// Project (target dir):  .claude/ (commands, agents, skills, CLAUDE.md),
//                        .codex/ (skills)
//
// Tracks installed files in manifests for clean reinstall and uninstall.
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { paths } from '../config/paths.js';
import {
  createManifest,
  addFile,
  addDir,
  saveManifest,
  findManifest,
  cleanManifestFiles,
  type Manifest,
} from '../core/manifest.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Package root: maestro2/ (from dist/commands/ or src/commands/) */
function getPackageRoot(): string {
  return resolve(__dirname, '..', '..');
}

/** Directories installed to ~/.maestro/ */
const GLOBAL_ASSETS = ['templates', 'workflows'] as const;

/** Subdirectories of .claude/ installed to project */
const PROJECT_CLAUDE_DIRS = ['commands', 'agents', 'skills'] as const;

/** Individual files of .claude/ installed to project */
const PROJECT_CLAUDE_FILES = ['CLAUDE.md'] as const;

/** Settings files to preserve during overwrite */
const PRESERVE_FILES = new Set(['settings.json', 'settings.local.json']);

// ---------------------------------------------------------------------------
// Recursive copy with manifest tracking
// ---------------------------------------------------------------------------

interface CopyStats {
  files: number;
  dirs: number;
  skipped: number;
}

function copyDirRecursive(
  src: string,
  dest: string,
  stats: CopyStats,
  manifest: Manifest,
): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
    stats.dirs++;
    addDir(manifest, dest);
  }

  for (const entry of readdirSync(src)) {
    if (PRESERVE_FILES.has(entry) && existsSync(join(dest, entry))) {
      stats.skipped++;
      continue;
    }

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const st = statSync(srcPath);

    if (st.isDirectory()) {
      copyDirRecursive(srcPath, destPath, stats, manifest);
    } else {
      copyFileSync(srcPath, destPath);
      stats.files++;
      addFile(manifest, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Install logic
// ---------------------------------------------------------------------------

function installGlobal(pkgRoot: string, manifest: Manifest): CopyStats {
  const stats: CopyStats = { files: 0, dirs: 0, skipped: 0 };
  const home = paths.home;

  paths.ensure(home);

  for (const dir of GLOBAL_ASSETS) {
    const src = join(pkgRoot, dir);
    if (!existsSync(src)) {
      console.error(`  skip: ${dir}/ (not found)`);
      continue;
    }
    const dest = join(home, dir);
    console.error(`  ${dir}/ → ${dest}`);
    copyDirRecursive(src, dest, stats, manifest);
  }

  // Version marker
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8'));
  const versionData = {
    version: pkg.version ?? '0.1.0',
    installedAt: new Date().toISOString(),
    installer: 'maestro',
  };
  const versionPath = join(home, 'version.json');
  writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf-8');
  addFile(manifest, versionPath);
  stats.files++;

  return stats;
}

function installProject(pkgRoot: string, targetDir: string, manifest: Manifest): CopyStats {
  const stats: CopyStats = { files: 0, dirs: 0, skipped: 0 };
  const srcClaude = join(pkgRoot, '.claude');
  const destClaude = join(targetDir, '.claude');

  paths.ensure(destClaude);

  // .claude/{commands,agents,skills}/
  for (const sub of PROJECT_CLAUDE_DIRS) {
    const src = join(srcClaude, sub);
    if (!existsSync(src)) {
      console.error(`  skip: .claude/${sub}/ (not found)`);
      continue;
    }
    const dest = join(destClaude, sub);
    console.error(`  .claude/${sub}/ → ${dest}`);
    copyDirRecursive(src, dest, stats, manifest);
  }

  // .claude/CLAUDE.md etc.
  for (const file of PROJECT_CLAUDE_FILES) {
    const src = join(srcClaude, file);
    if (!existsSync(src)) continue;
    const dest = join(destClaude, file);
    console.error(`  .claude/${file} → ${dest}`);
    copyFileSync(src, dest);
    addFile(manifest, dest);
    stats.files++;
  }

  // .codex/ (entire directory)
  const srcCodex = join(pkgRoot, '.codex');
  if (existsSync(srcCodex)) {
    const destCodex = join(targetDir, '.codex');
    console.error(`  .codex/ → ${destCodex}`);
    copyDirRecursive(srcCodex, destCodex, stats, manifest);
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Summary helper
// ---------------------------------------------------------------------------

function showStats(label: string, stats: CopyStats): void {
  const parts = [`${stats.files} files`];
  if (stats.dirs > 0) parts.push(`${stats.dirs} dirs`);
  if (stats.skipped > 0) parts.push(`${stats.skipped} preserved`);
  console.error(`  ${label}: ${parts.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerInstallCommand(program: Command): void {
  program
    .command('install')
    .description('Install maestro assets (templates, workflows, commands, agents, codex skills)')
    .option('--global', 'Install global assets only (~/.maestro/)')
    .option('--path <dir>', 'Install project assets to target directory')
    .option('--force', 'Skip confirmation for overwrite')
    .action(async (opts: { global?: boolean; path?: string; force?: boolean }) => {
      const pkgRoot = getPackageRoot();

      // Validate
      const hasTemplates = existsSync(join(pkgRoot, 'templates'));
      const hasWorkflows = existsSync(join(pkgRoot, 'workflows'));
      if (!hasTemplates && !hasWorkflows) {
        console.error(`Error: Package root missing source directories: ${pkgRoot}`);
        process.exit(1);
      }

      const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8'));
      console.error(`maestro install v${pkg.version ?? '0.1.0'}`);
      console.error('');

      // ---- Global install ---------------------------------------------------

      if (!opts.path || opts.global) {
        console.error(`[Global] → ${paths.home}`);

        // Clean previous installation
        const prev = findManifest('global', paths.home);
        if (prev) {
          const { removed, skipped } = cleanManifestFiles(prev);
          if (removed > 0) {
            console.error(`  Cleaned: ${removed} old files${skipped > 0 ? `, ${skipped} preserved` : ''}`);
          }
        }

        const manifest = createManifest('global', paths.home);
        const gStats = installGlobal(pkgRoot, manifest);
        saveManifest(manifest);
        showStats('Global', gStats);
        console.error('');
      }

      // ---- Project install --------------------------------------------------

      if (opts.path || !opts.global) {
        const targetDir = resolve(opts.path ?? process.cwd());

        if (!existsSync(targetDir)) {
          console.error(`Error: Target directory does not exist: ${targetDir}`);
          process.exit(1);
        }

        console.error(`[Project] → ${targetDir}`);

        // Clean previous installation
        const prev = findManifest('project', targetDir);
        if (prev) {
          const { removed, skipped } = cleanManifestFiles(prev);
          if (removed > 0) {
            console.error(`  Cleaned: ${removed} old files${skipped > 0 ? `, ${skipped} preserved` : ''}`);
          }
        }

        const manifest = createManifest('project', targetDir);
        const pStats = installProject(pkgRoot, targetDir, manifest);
        saveManifest(manifest);
        showStats('Project', pStats);
        console.error('');
      }

      console.error('Done. Restart Claude Code or IDE to pick up changes.');
    });
}
