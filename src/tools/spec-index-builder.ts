/**
 * Spec Index Builder
 *
 * Scans .workflow/specs/*.md files, parses YAML frontmatter,
 * and builds/caches index at .workflow/.spec-index/specs.index.json.
 *
 * Frontmatter Schema:
 * ---
 * title: "Document Title"
 * readMode: required | optional
 * priority: critical | high | medium | low
 * category: general | exploration | planning | execution | debug | test | review | validation
 * keywords: [auth, security]
 * ---
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';

// ============================================================================
// Types
// ============================================================================

export const SPEC_CATEGORIES = ['general', 'exploration', 'planning', 'execution', 'debug', 'test', 'review', 'validation'] as const;
export type SpecCategory = typeof SPEC_CATEGORIES[number];

export interface SpecFrontmatter {
  title: string;
  readMode: 'required' | 'optional';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: SpecCategory;
  keywords: string[];
}

export interface SpecIndexEntry {
  title: string;
  file: string;
  category: SpecCategory;
  keywords: string[];
  readMode: 'required' | 'optional';
  priority: 'critical' | 'high' | 'medium' | 'low';
  contentLength: number;
}

export interface SpecIndex {
  entries: SpecIndexEntry[];
  built_at: string;
}

// ============================================================================
// Constants
// ============================================================================

const SPECS_DIR = '.workflow/specs';
const INDEX_DIR = '.workflow/.spec-index';
const INDEX_FILE = 'specs.index.json';

const VALID_READ_MODES = ['required', 'optional'] as const;
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

// ============================================================================
// Lightweight Frontmatter Parser (no gray-matter dependency)
// ============================================================================

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Handles simple key: value and key: [array] syntax.
 */
function parseFrontmatter(raw: string): ParsedFrontmatter {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw };
  }

  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { data: {}, content: raw };
  }

  const yamlBlock = trimmed.substring(3, endIdx).trim();
  const content = trimmed.substring(endIdx + 4).trim();
  const data: Record<string, unknown> = {};

  let currentKey = '';
  let arrayItems: string[] | null = null;

  for (const line of yamlBlock.split('\n')) {
    const trimLine = line.trim();

    // Array item: "  - value"
    if (trimLine.startsWith('- ') && arrayItems !== null) {
      arrayItems.push(trimLine.substring(2).trim());
      continue;
    }

    // Flush previous array
    if (arrayItems !== null && currentKey) {
      data[currentKey] = arrayItems;
      arrayItems = null;
    }

    // Key-value pair
    const colonIdx = trimLine.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimLine.substring(0, colonIdx).trim();
    const value = trimLine.substring(colonIdx + 1).trim();

    currentKey = key;

    if (value === '' || value === '[]') {
      // Array will follow on next lines, or empty array
      arrayItems = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array: [a, b, c]
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(s => s.length > 0);
    } else {
      // Scalar value — strip quotes
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  // Flush trailing array
  if (arrayItems !== null && currentKey) {
    data[currentKey] = arrayItems;
  }

  return { data, content };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the specs directory path.
 */
export function getSpecsDir(projectPath: string): string {
  return join(projectPath, SPECS_DIR);
}

/**
 * Build the spec index by scanning .workflow/specs/*.md.
 */
export function buildSpecIndex(projectPath: string): SpecIndex {
  const specsDir = getSpecsDir(projectPath);
  const entries: SpecIndexEntry[] = [];

  if (!existsSync(specsDir)) {
    return { entries, built_at: new Date().toISOString() };
  }

  let files: string[];
  try {
    files = readdirSync(specsDir).filter(f => extname(f).toLowerCase() === '.md');
  } catch {
    return { entries, built_at: new Date().toISOString() };
  }

  for (const file of files) {
    const filePath = join(specsDir, file);
    const entry = parseSpecFile(filePath, projectPath);
    if (entry) {
      entries.push(entry);
    }
  }

  return { entries, built_at: new Date().toISOString() };
}

/**
 * Read cached index from disk.
 */
export function readCachedIndex(projectPath: string): SpecIndex | null {
  const indexPath = join(projectPath, INDEX_DIR, INDEX_FILE);
  if (!existsSync(indexPath)) return null;

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content) as SpecIndex;
    if (parsed && Array.isArray(parsed.entries) && typeof parsed.built_at === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write index to cache file.
 */
export function writeIndexCache(projectPath: string, index: SpecIndex): void {
  const indexDir = join(projectPath, INDEX_DIR);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  writeFileSync(join(indexDir, INDEX_FILE), JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Get spec index with cache-first strategy.
 */
export function getSpecIndex(projectPath: string, forceRebuild = false): SpecIndex {
  if (!forceRebuild) {
    const cached = readCachedIndex(projectPath);
    if (cached) return cached;
  }

  const index = buildSpecIndex(projectPath);
  writeIndexCache(projectPath, index);
  return index;
}

// ============================================================================
// Internal
// ============================================================================

function parseSpecFile(filePath: string, projectPath: string): SpecIndexEntry | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const { data, content } = parseFrontmatter(raw);

  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim()
    : basename(filePath, extname(filePath));

  const rawReadMode = typeof data.readMode === 'string' ? data.readMode : null;
  const readMode = rawReadMode && (VALID_READ_MODES as readonly string[]).includes(rawReadMode)
    ? rawReadMode as 'required' | 'optional'
    : 'optional';

  const rawPriority = typeof data.priority === 'string' ? data.priority : null;
  const priority = rawPriority && (VALID_PRIORITIES as readonly string[]).includes(rawPriority)
    ? rawPriority as 'critical' | 'high' | 'medium' | 'low'
    : 'medium';

  const rawCategory = typeof data.category === 'string' ? data.category : null;
  const category = rawCategory && (SPEC_CATEGORIES as readonly string[]).includes(rawCategory)
    ? rawCategory as SpecCategory
    : 'general';

  let keywords: string[] = [];
  if (Array.isArray(data.keywords)) {
    keywords = data.keywords.filter((k): k is string => typeof k === 'string').map(s => s.trim()).filter(s => s.length > 0);
  } else if (typeof data.keywords === 'string') {
    keywords = data.keywords.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  const relPath = relative(projectPath, filePath).replace(/\\/g, '/');

  return {
    title,
    file: relPath,
    category,
    keywords,
    readMode,
    priority,
    contentLength: content.length,
  };
}
