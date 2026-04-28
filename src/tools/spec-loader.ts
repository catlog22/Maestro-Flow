/**
 * Spec Loader (simplified)
 *
 * Filename-based category routing. No frontmatter dependency.
 * Reads .workflow/specs/*.md, filters by category via static mapping,
 * returns concatenated content.
 */

import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpecEntries, formatSpecEntries, type SpecEntryParsed } from './spec-entry-parser.js';
import { paths } from '../config/paths.js';

// ============================================================================
// Types
// ============================================================================

export type SpecCategory = 'coding' | 'arch' | 'quality' | 'debug' | 'test' | 'review' | 'learning';

export type SpecScope = 'project' | 'global' | 'team' | 'personal';

export interface SpecLoadResult {
  content: string;
  matchedSpecs: string[];
  totalLoaded: number;
}

// ============================================================================
// Filename → Category mapping (single source of truth)
// ============================================================================

export const CATEGORY_MAP: Record<string, SpecCategory> = {
  'coding-conventions.md':      'coding',
  'architecture-constraints.md': 'arch',
  'quality-rules.md':           'quality',
  'debug-notes.md':             'debug',
  'test-conventions.md':        'test',
  'review-standards.md':        'review',
  'learnings.md':               'learning',
};

const SPECS_DIR = '.workflow/specs';
export const TEAM_SPECS_DIR = '.workflow/collab/specs';

/** Layer labels used as section headers when multi-directory scanning is active. */
const LAYER_LABELS: Record<string, string> = {
  global: '# Global Specs',
  baseline: '# Baseline Specs',
  team: '# Team Specs',
  // personal label is dynamic — includes uid
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve the directory for a given spec scope.
 *
 * | scope      | directory                           |
 * |------------|-------------------------------------|
 * | project    | .workflow/specs/                    |
 * | global     | ~/.maestro/specs/                   |
 * | team       | .workflow/collab/specs/              |
 * | personal   | .workflow/collab/specs/{uid}/        |
 */
export function resolveSpecDir(projectPath: string, scope: SpecScope, uid?: string): string {
  switch (scope) {
    case 'global':   return paths.specs;
    case 'team':     return join(projectPath, TEAM_SPECS_DIR);
    case 'personal': {
      if (!uid) throw new Error('personal scope requires uid');
      return join(projectPath, TEAM_SPECS_DIR, uid);
    }
    case 'project':
    default:         return join(projectPath, SPECS_DIR);
  }
}

/**
 * Load spec files from one or more directories.
 *
 * Layer scanning order (lowest → highest priority):
 *   0. ~/.maestro/specs/             (global — when `scope` includes global)
 *   1. .workflow/specs/              (baseline)
 *   2. .workflow/collab/specs/       (team shared — when `uid` is provided)
 *   3. .workflow/collab/specs/{uid}/ (personal — when `uid` is provided)
 *
 * Content from later layers is appended (never replaces earlier content).
 * Each layer's content is prefixed with a header for clarity.
 *
 * @param scope   Controls which extra layers to include beyond baseline.
 *                - 'project': baseline only (default)
 *                - 'global': global + baseline
 *                - 'team': baseline + team shared
 *                - 'personal': baseline + team shared + personal (requires uid)
 *                - undefined: same as 'project'; uid alone still triggers team+personal for backward compat
 */
export function loadSpecs(projectPath: string, category?: SpecCategory, uid?: string, keyword?: string, scope?: SpecScope): SpecLoadResult {
  // Build ordered list of (directory, label) pairs to scan
  const layers = buildLayers(projectPath, uid, scope);

  // Auto-init only baseline and global layers.
  // Team/personal are per-user — auto-creating them for arbitrary uids is wrong.
  autoInitSeeds(join(projectPath, SPECS_DIR));
  if (scope === 'global') {
    autoInitSeeds(paths.specs);
  }

  const allSections: string[] = [];
  const allMatched: string[] = [];
  let totalCount = 0;

  const multiLayer = layers.length > 1;

  for (const { dir, label } of layers) {
    const { sections, matched } = loadFromDir(dir, category, keyword);
    if (sections.length === 0) continue;

    // Add layer headers when multi-layer mode is active (global or uid)
    if (multiLayer) {
      allSections.push(`${label}\n\n${sections.join('\n\n---\n\n')}`);
    } else {
      allSections.push(...sections);
    }
    allMatched.push(...matched);
    totalCount += matched.length;
  }

  return {
    content: allSections.length > 0
      ? `# Project Specs (${totalCount} loaded)\n\n${allSections.join('\n\n---\n\n')}`
      : '',
    matchedSpecs: allMatched,
    totalLoaded: totalCount,
  };
}

// ============================================================================
// Internal — multi-directory helpers
// ============================================================================

interface LayerDef {
  dir: string;
  label: string;
}

function buildLayers(projectPath: string, uid?: string, scope?: SpecScope): LayerDef[] {
  const layers: LayerDef[] = [];

  // Global layer — lowest priority
  if (scope === 'global') {
    layers.push({ dir: paths.specs, label: LAYER_LABELS.global });
  }

  // Baseline — always included
  layers.push({
    dir: join(projectPath, SPECS_DIR),
    label: LAYER_LABELS.baseline,
  });

  // Team + personal layers
  // Activated by scope='team'|'personal', or by uid (backward compat)
  if (scope === 'team' || scope === 'personal' || uid) {
    layers.push({ dir: join(projectPath, TEAM_SPECS_DIR), label: LAYER_LABELS.team });

    if (uid) {
      layers.push({ dir: join(projectPath, TEAM_SPECS_DIR, uid), label: `# Personal Specs (${uid})` });
    }
  }

  return layers;
}

/**
 * Load spec files from a single directory. Returns empty arrays if the
 * directory does not exist or is unreadable.
 */
function loadFromDir(
  specsDir: string,
  category?: SpecCategory,
  keyword?: string,
): { sections: string[]; matched: string[] } {
  if (!existsSync(specsDir)) return { sections: [], matched: [] };

  let files: string[];
  try {
    files = readdirSync(specsDir).filter(f => f.endsWith('.md'));
  } catch {
    return { sections: [], matched: [] };
  }

  const sections: string[] = [];
  const matched: string[] = [];

  for (const file of files) {
    if (!shouldInclude(file, category)) continue;

    const filePath = join(specsDir, file);
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const body = stripFrontmatter(raw).trim();
    if (!body) continue;

    if (keyword) {
      // Entry-level keyword filtering
      const filtered = filterByKeyword(body, keyword);
      if (filtered) {
        sections.push(filtered);
        matched.push(file);
      }
    } else {
      sections.push(body);
      matched.push(file);
    }
  }

  return { sections, matched };
}

// ============================================================================
// Internal
// ============================================================================

function shouldInclude(filename: string, category?: SpecCategory): boolean {
  // No category filter → load all
  if (!category) return true;

  const cat = CATEGORY_MAP[filename];
  if (cat) return cat === category;

  // Unknown files: include only when no category filter
  return false;
}

/**
 * Filter file content by keyword. Returns matched entry content or null.
 * Handles both <spec-entry> tags (keyword attribute match) and legacy entries (text grep).
 */
function filterByKeyword(body: string, keyword: string): string | null {
  const kw = keyword.toLowerCase();
  const { entries, legacy } = parseSpecEntries(body);

  const matchedSections: string[] = [];

  // New-format: match by keywords attribute
  const matchedEntries = entries.filter(e => e.keywords.includes(kw));
  if (matchedEntries.length > 0) {
    matchedSections.push(formatSpecEntries(matchedEntries));
  }

  // Legacy: grep text match
  for (const leg of legacy) {
    if (leg.content.toLowerCase().includes(kw)) {
      matchedSections.push(leg.content);
    }
  }

  return matchedSections.length > 0 ? matchedSections.join('\n\n---\n\n') : null;
}

function stripFrontmatter(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return raw;
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) return raw;
  return trimmed.substring(endIdx + 4).trim();
}

// ============================================================================
// Auto-init seed files
// ============================================================================

/** Directories already checked this process — skip re-checking. */
const autoInitChecked = new Set<string>();

/** Minimal seed files (filename + header). */
const AUTO_INIT_SEEDS: Array<[string, string]> = [
  ['coding-conventions.md', '# Coding Conventions\n\n## Entries\n\n'],
  ['architecture-constraints.md', '# Architecture Constraints\n\n## Entries\n\n'],
  ['learnings.md', '# Learnings\n\n## Entries\n\n'],
  ['quality-rules.md', '# Quality Rules\n\n## Entries\n\n'],
  ['debug-notes.md', '# Debug Notes\n\n## Entries\n\n'],
  ['test-conventions.md', '# Test Conventions\n\n## Entries\n\n'],
  ['review-standards.md', '# Review Standards\n\n## Entries\n\n'],
];

/**
 * Auto-create a specs directory with seed files if it does not exist.
 * Applies to every layer (global, baseline, team, personal).
 *
 * For project-local dirs: only runs when `.workflow/` already exists
 * (i.e. the project is maestro-managed).
 * For global (`~/.maestro/specs/`): always creates — the home dir exists by definition.
 *
 * Synchronous, per-directory dedup, best-effort — never throws.
 */
function autoInitSeeds(specsDir: string): void {
  if (autoInitChecked.has(specsDir)) return;
  autoInitChecked.add(specsDir);

  if (existsSync(specsDir)) return;

  // For project-local paths, only auto-init when .workflow/ already exists.
  // Global path (under ~/.maestro/) always qualifies.
  const isGlobal = specsDir === paths.specs;
  if (!isGlobal) {
    // Walk up to check if .workflow/ parent exists
    // specsDir patterns: <project>/.workflow/specs, <project>/.workflow/collab/specs[/<uid>]
    const workflowIdx = specsDir.replace(/\\/g, '/').indexOf('.workflow/');
    if (workflowIdx !== -1) {
      const workflowDir = specsDir.substring(0, workflowIdx + '.workflow'.length);
      if (!existsSync(workflowDir)) return;
    }
  }

  try {
    mkdirSync(specsDir, { recursive: true });
    for (const [filename, content] of AUTO_INIT_SEEDS) {
      const filePath = join(specsDir, filename);
      if (!existsSync(filePath)) {
        writeFileSync(filePath, content, 'utf-8');
      }
    }
  } catch {
    // Best-effort — don't block loading
  }
}
