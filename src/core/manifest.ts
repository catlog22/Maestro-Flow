// ---------------------------------------------------------------------------
// Installation Manifest
// Tracks installed files for clean reinstall and uninstall.
// Manifests stored at ~/.maestro/manifests/{id}.json
// ---------------------------------------------------------------------------

import { join } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  rmSync,
  statSync,
} from 'node:fs';
import { paths } from '../config/paths.js';
import { hasAnyMarkers, removeAllSections } from './tag-injector.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManifestEntry {
  path: string;
  type: 'file' | 'dir';
}

export interface Manifest {
  id: string;
  version: string;
  scope: 'global' | 'project';
  targetPath: string;
  installedAt: string;
  entries: ManifestEntry[];
  /** Hook level configured during install (none/minimal/standard/full) */
  hookLevel?: string;
  /** Component IDs selected during interactive install (omitted = all) */
  selectedComponentIds?: string[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const MANIFESTS_DIR = join(paths.home, 'manifests');

function ensureDir(): void {
  if (!existsSync(MANIFESTS_DIR)) {
    mkdirSync(MANIFESTS_DIR, { recursive: true });
  }
}

function manifestFile(id: string): string {
  return join(MANIFESTS_DIR, `${id}.json`);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createManifest(
  scope: 'global' | 'project',
  targetPath: string,
  opts?: { hookLevel?: string; selectedComponentIds?: string[] },
): Manifest {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
  return {
    id: `${scope}-${ts}`,
    version: '1.0',
    scope,
    targetPath,
    installedAt: new Date().toISOString(),
    entries: [],
    hookLevel: opts?.hookLevel,
    selectedComponentIds: opts?.selectedComponentIds,
  };
}

export function addFile(manifest: Manifest, filePath: string): void {
  manifest.entries.push({ path: filePath, type: 'file' });
}

export function addDir(manifest: Manifest, dirPath: string): void {
  manifest.entries.push({ path: dirPath, type: 'dir' });
}

export function saveManifest(manifest: Manifest): string {
  ensureDir();
  // Remove old manifests for same scope+path
  removeOld(manifest.scope, manifest.targetPath);
  const fp = manifestFile(manifest.id);
  writeFileSync(fp, JSON.stringify(manifest, null, 2), 'utf-8');
  return fp;
}

function removeOld(scope: string, targetPath: string): void {
  if (!existsSync(MANIFESTS_DIR)) return;
  const norm = targetPath.toLowerCase().replace(/[\\/]+$/, '');
  for (const f of readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const m = JSON.parse(readFileSync(join(MANIFESTS_DIR, f), 'utf-8')) as Manifest;
      if (m.scope === scope && m.targetPath.toLowerCase().replace(/[\\/]+$/, '') === norm) {
        unlinkSync(join(MANIFESTS_DIR, f));
      }
    } catch { /* skip */ }
  }
}

export function findManifest(scope: 'global' | 'project', targetPath: string): Manifest | null {
  if (!existsSync(MANIFESTS_DIR)) return null;
  const norm = targetPath.toLowerCase().replace(/[\\/]+$/, '');
  for (const f of readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const m = JSON.parse(readFileSync(join(MANIFESTS_DIR, f), 'utf-8')) as Manifest;
      m.entries ??= [];
      if (m.scope === scope && m.targetPath.toLowerCase().replace(/[\\/]+$/, '') === norm) {
        return m;
      }
    } catch { /* skip */ }
  }
  return null;
}

export function getAllManifests(): Manifest[] {
  if (!existsSync(MANIFESTS_DIR)) return [];
  const results: Manifest[] = [];
  for (const f of readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const m = JSON.parse(readFileSync(join(MANIFESTS_DIR, f), 'utf-8')) as Manifest;
      m.entries ??= [];
      // Skip corrupt manifests (no targetPath or no entries)
      if (!m.targetPath || !m.scope) {
        unlinkSync(join(MANIFESTS_DIR, f));
        continue;
      }
      results.push(m);
    } catch { /* skip */ }
  }
  return results.sort((a, b) => b.installedAt.localeCompare(a.installedAt));
}

export function deleteManifest(manifest: Manifest): void {
  const fp = manifestFile(manifest.id);
  if (existsSync(fp)) unlinkSync(fp);
}

// ---------------------------------------------------------------------------
// Cleanup — remove files recorded in a manifest
// ---------------------------------------------------------------------------

/** Files to preserve even during cleanup. */
const PRESERVE = new Set(['settings.json', 'settings.local.json']);

/** Files that should have maestro content removed via tag injection instead of being deleted entirely. */
const CONTENT_MANAGED = new Set(['CLAUDE.md', 'AGENTS.md']);

/**
 * Remove maestro-injected content from a doc file using `<!-- maestro:start/end -->` markers.
 *
 * - If the file has markers, removes only the marked section.
 * - If nothing remains after removal, deletes the file entirely.
 * - Returns true if any content was removed.
 */
function cleanInjectedDoc(filePath: string): boolean {
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf-8');
  if (!hasAnyMarkers(content)) {
    // No markers — this is a legacy install or user-only file, delete entirely
    unlinkSync(filePath);
    return true;
  }

  const cleaned = removeAllSections(content);
  if (!cleaned || cleaned.trim() === '') {
    // Nothing left after removing all maestro sections — delete the file
    unlinkSync(filePath);
    return true;
  }

  // User content remains — write back without maestro sections
  writeFileSync(filePath, cleaned, 'utf-8');
  return true;
}

/**
 * @param skipContentManaged If true, skip CONTENT_MANAGED files (CLAUDE.md, AGENTS.md).
 *   Use during re-install — tag injection updates in-place, so no cleanup needed.
 *   Default false (full cleanup, used by uninstall).
 */
export function cleanManifestFiles(
  manifest: Manifest,
  opts?: { skipContentManaged?: boolean },
): { removed: number; skipped: number } {
  let removed = 0;
  let skipped = 0;

  // Remove files first (deepest paths first)
  const files = manifest.entries
    .filter(e => e.type === 'file')
    .sort((a, b) => b.path.length - a.path.length);

  for (const entry of files) {
    const name = entry.path.split(/[\\/]/).pop() ?? '';
    if (PRESERVE.has(name)) { skipped++; continue; }

    // Content-managed files: skip during re-install, clean during uninstall
    if (CONTENT_MANAGED.has(name)) {
      if (opts?.skipContentManaged) { skipped++; continue; }
      try {
        if (cleanInjectedDoc(entry.path)) removed++;
      } catch { /* skip */ }
      continue;
    }

    try {
      if (existsSync(entry.path)) {
        unlinkSync(entry.path);
        removed++;
      }
    } catch { /* skip */ }
  }

  // Remove empty directories (deepest first)
  const dirs = manifest.entries
    .filter(e => e.type === 'dir')
    .sort((a, b) => b.path.length - a.path.length);

  for (const entry of dirs) {
    try {
      if (existsSync(entry.path)) {
        const contents = readdirSync(entry.path);
        if (contents.length === 0) {
          rmSync(entry.path, { recursive: true });
          removed++;
        }
      }
    } catch { /* skip */ }
  }

  return { removed, skipped };
}
